#!/usr/bin/env node

/**
 * ZeroToShip Scheduler CLI
 *
 * Command-line interface for running and managing the pipeline.
 */

import http from 'http';
import { runPipeline } from './orchestrator';
import { startScheduler, stopScheduler } from './index';
import { checkPipelineFreshness } from './watchdog';
import { closeDatabase } from '../api/db/client';
import { processOnboardingDrip } from '../delivery/onboarding';
import { logger } from './utils/logger';
import type { PipelineConfig } from './types';

export interface CliOptions {
  command: 'run' | 'schedule' | 'health' | 'onboarding-drip' | 'watchdog' | 'help';
  dryRun: boolean;
  hoursBack: number;
  verbose: boolean;
  maxBriefs: number;
  maxAgeHours?: number;
  generationMode?: 'legacy' | 'graph';
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    command: 'help',
    dryRun: false,
    hoursBack: 24,
    verbose: false,
    maxBriefs: 10,
    maxAgeHours: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === 'run') options.command = 'run';
    else if (arg === 'schedule') options.command = 'schedule';
    else if (arg === 'health') options.command = 'health';
    else if (arg === 'onboarding-drip') options.command = 'onboarding-drip';
    else if (arg === 'watchdog') options.command = 'watchdog';
    else if (arg === 'help' || arg === '--help' || arg === '-h')
      options.command = 'help';
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--verbose' || arg === '-v') options.verbose = true;
    else if (arg === '--hours' && args[i + 1]) {
      options.hoursBack = parseInt(args[++i], 10);
    } else if (arg === '--max-briefs' && args[i + 1]) {
      options.maxBriefs = parseInt(args[++i], 10);
    } else if (arg === '--max-age-hours' && args[i + 1]) {
      options.maxAgeHours = parseFloat(args[++i]);
    } else if (arg === '--generation-mode' && args[i + 1]) {
      const mode = args[++i];
      if (mode === 'legacy' || mode === 'graph') {
        options.generationMode = mode;
      }
    }
  }

  return options;
}

/**
 * Check environment health
 */
async function checkHealth(): Promise<boolean> {
  const checks: { name: string; ok: boolean; message?: string }[] = [];

  // Check required environment variables
  const requiredEnvVars = ['OPENAI_API_KEY', 'RESEND_API_KEY'];
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    checks.push({
      name: `ENV: ${envVar}`,
      ok: !!value,
      message: value ? 'Set' : 'Missing',
    });
  }

  // Check optional environment variables
  const optionalEnvVars = ['GITHUB_TOKEN', 'TWITTER_BEARER_TOKEN'];
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar];
    checks.push({
      name: `ENV: ${envVar} (optional)`,
      ok: true, // Optional vars are always "ok"
      message: value ? 'Set' : 'Not set',
    });
  }

  console.log('\nHealth Check Results:');
  console.log('='.repeat(50));

  let allOk = true;
  for (const check of checks) {
    const status = check.ok ? '[OK]' : '[FAIL]';
    console.log(`${status} ${check.name}: ${check.message || ''}`);
    if (!check.ok) allOk = false;
  }

  console.log('='.repeat(50));
  console.log(allOk ? '\nAll checks passed!' : '\nSome checks failed!');

  return allOk;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
ZeroToShip Scheduler CLI

USAGE:
  npx ts-node src/scheduler/cli.ts <command> [options]
  npm run scheduler <command> [options]

COMMANDS:
  run              Run the pipeline once
  schedule         Start the scheduler (runs continuously)
  onboarding-drip  Process onboarding drip emails for eligible users
  watchdog         Check for stale/missed successful runs
  health           Check environment and configuration
  help             Show this help message

OPTIONS:
  --dry-run                  Skip actual email delivery
  --hours <n>                Look back N hours (default: 24)
  --max-briefs <n>           Maximum briefs to generate (default: 10)
  --generation-mode <mode>   Generation mode: 'legacy' or 'graph' (default: from env)
  --max-age-hours            Watchdog threshold for latest successful run age
  --verbose, -v              Enable verbose output

EXAMPLES:
  npm run scheduler run --dry-run
  npm run scheduler run --hours 48 --max-briefs 5
  npm run scheduler schedule
  npm run scheduler onboarding-drip
  npm run scheduler watchdog --max-age-hours 30
  npm run scheduler health
`);
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  // Ignore EPIPE errors on stdout/stderr — these occur when the parent
  // process (e.g. piped to `head`) closes before we finish writing.
  process.stdout.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') return;
    throw err;
  });
  process.stderr.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') return;
    throw err;
  });

  const options = parseArgs(process.argv.slice(2));

  if (options.verbose) {
    process.env.LOG_LEVEL = 'debug';
  }

  switch (options.command) {
    case 'run': {
      console.log('Running ZeroToShip pipeline...\n');

      const pipelineConfig: Partial<PipelineConfig> = {
        hoursBack: options.hoursBack,
        dryRun: options.dryRun,
        maxBriefs: options.maxBriefs,
        verbose: options.verbose,
        ...(options.generationMode && { generationMode: options.generationMode }),
      };

      try {
        const result = await runPipeline(pipelineConfig);

        console.log('\n' + '='.repeat(60));
        console.log('  PIPELINE RESULTS');
        console.log('='.repeat(60));
        console.log(`Run ID: ${result.runId}`);
        console.log(`Success: ${result.success}`);
        console.log(`Duration: ${(result.totalDuration / 1000).toFixed(1)}s`);
        console.log('\nPhase Summary:');

        const phases = ['scrape', 'analyze', 'generate', 'deliver'] as const;
        for (const phase of phases) {
          const phaseResult = result.phases[phase];
          const status = phaseResult.success ? 'OK' : 'FAIL';
          console.log(
            `  ${phase}: [${status}] ${(phaseResult.duration / 1000).toFixed(1)}s`
          );
        }

        console.log('\nStats:');
        console.log(`  Posts scraped: ${result.stats.postsScraped}`);
        console.log(`  Clusters created: ${result.stats.clustersCreated}`);
        console.log(`  Ideas generated: ${result.stats.ideasGenerated}`);
        console.log(`  Emails sent: ${result.stats.emailsSent}`);

        if (result.errors.length > 0) {
          console.log('\nErrors:');
          for (const error of result.errors) {
            console.log(`  [${error.phase}] ${error.message}`);
          }
        }

        if (!result.success) {
          await closeDatabase();
          process.exit(1);
        }

        await closeDatabase();
        process.exit(0);
      } catch (error) {
        console.error('Pipeline failed:', error);
        await closeDatabase();
        process.exit(1);
      }
      break;
    }

    case 'schedule': {
      console.log('Starting ZeroToShip scheduler...\n');

      startScheduler({
        pipelineConfig: {
          dryRun: options.dryRun,
          hoursBack: options.hoursBack,
          maxBriefs: options.maxBriefs,
          verbose: options.verbose,
          ...(options.generationMode && { generationMode: options.generationMode }),
        },
      });

      // Minimal HTTP server so Railway keeps the container alive
      const port = parseInt(process.env.PORT || '8080', 10);
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'scheduler' }));
      });
      server.listen(port, () => {
        console.log(`Scheduler keepalive listening on port ${port}`);
      });

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\nShutting down scheduler...');
        stopScheduler();
        server.close();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        console.log('\nShutting down scheduler...');
        stopScheduler();
        server.close();
        process.exit(0);
      });

      // Keep process running
      console.log('Scheduler is running. Press Ctrl+C to stop.\n');
      break;
    }

    case 'onboarding-drip': {
      console.log('Processing onboarding drip emails...\n');

      try {
        const dripResult = await processOnboardingDrip();

        console.log('\n' + '='.repeat(60));
        console.log('  ONBOARDING DRIP RESULTS');
        console.log('='.repeat(60));
        console.log(`Processed: ${dripResult.processed}`);
        console.log(`Sent: ${dripResult.sent}`);
        console.log(`Skipped: ${dripResult.skipped}`);
        console.log(`Failed: ${dripResult.failed}`);

        if (dripResult.details.length > 0) {
          console.log('\nDetails:');
          for (const detail of dripResult.details) {
            const status = detail.sent
              ? 'SENT'
              : detail.skipped
                ? 'SKIPPED'
                : 'FAILED';
            console.log(
              `  [${status}] ${detail.emailType} -> ${detail.userId}${detail.error ? ` (${detail.error})` : ''}`
            );
          }
        }

        await closeDatabase();
        process.exit(0);
      } catch (error) {
        console.error('Onboarding drip failed:', error);
        await closeDatabase();
        process.exit(1);
      }
      break;
    }

    case 'health': {
      const ok = await checkHealth();
      process.exit(ok ? 0 : 1);
    }

    case 'watchdog': {
      console.log('Running pipeline watchdog check...\n');

      try {
        const result = await checkPipelineFreshness({
          maxAgeHours: options.maxAgeHours,
          alertOnFailure: true,
        });

        console.log('='.repeat(60));
        console.log('  PIPELINE WATCHDOG');
        console.log('='.repeat(60));
        console.log(`Healthy: ${result.healthy}`);
        console.log(`Reason: ${result.reason}`);
        console.log(`Checked at: ${result.checkedAt}`);
        console.log(`Threshold: ${result.maxAgeHours}h`);
        console.log(`Latest success age: ${result.ageHours ?? 'none'}h`);
        console.log(`Latest successful run: ${result.latestSuccessfulRunId || 'none'}`);
        console.log(`Latest run: ${result.latestRunId || 'none'} (${result.latestRunStatus || 'unknown'})`);

        await closeDatabase();
        process.exit(result.healthy ? 0 : 1);
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Watchdog check failed'
        );
        await closeDatabase();
        process.exit(1);
      }
      break;
    }

    case 'help':
    default:
      printHelp();
      break;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
