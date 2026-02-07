#!/usr/bin/env node

/**
 * IdeaForge Scheduler CLI
 *
 * Command-line interface for running and managing the pipeline.
 */

import { runPipeline } from './orchestrator';
import { startScheduler, stopScheduler } from './index';
import { logger } from './utils/logger';
import type { PipelineConfig } from './types';

interface CliOptions {
  command: 'run' | 'schedule' | 'health' | 'help';
  dryRun: boolean;
  hoursBack: number;
  verbose: boolean;
  maxBriefs: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    command: 'help',
    dryRun: false,
    hoursBack: 24,
    verbose: false,
    maxBriefs: 10,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === 'run') options.command = 'run';
    else if (arg === 'schedule') options.command = 'schedule';
    else if (arg === 'health') options.command = 'health';
    else if (arg === 'help' || arg === '--help' || arg === '-h')
      options.command = 'help';
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--verbose' || arg === '-v') options.verbose = true;
    else if (arg === '--hours' && args[i + 1]) {
      options.hoursBack = parseInt(args[++i], 10);
    } else if (arg === '--max-briefs' && args[i + 1]) {
      options.maxBriefs = parseInt(args[++i], 10);
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
IdeaForge Scheduler CLI

USAGE:
  npx ts-node src/scheduler/cli.ts <command> [options]
  npm run scheduler <command> [options]

COMMANDS:
  run        Run the pipeline once
  schedule   Start the scheduler (runs continuously)
  health     Check environment and configuration
  help       Show this help message

OPTIONS:
  --dry-run         Skip actual email delivery
  --hours <n>       Look back N hours (default: 24)
  --max-briefs <n>  Maximum briefs to generate (default: 10)
  --verbose, -v     Enable verbose output

EXAMPLES:
  npm run scheduler run --dry-run
  npm run scheduler run --hours 48 --max-briefs 5
  npm run scheduler schedule
  npm run scheduler health
`);
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.verbose) {
    process.env.LOG_LEVEL = 'debug';
  }

  switch (options.command) {
    case 'run': {
      console.log('Running IdeaForge pipeline...\n');

      const pipelineConfig: Partial<PipelineConfig> = {
        hoursBack: options.hoursBack,
        dryRun: options.dryRun,
        maxBriefs: options.maxBriefs,
        verbose: options.verbose,
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
          process.exit(1);
        }
      } catch (error) {
        console.error('Pipeline failed:', error);
        process.exit(1);
      }
      break;
    }

    case 'schedule': {
      console.log('Starting IdeaForge scheduler...\n');

      startScheduler({
        pipelineConfig: {
          dryRun: options.dryRun,
          hoursBack: options.hoursBack,
          maxBriefs: options.maxBriefs,
          verbose: options.verbose,
        },
      });

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\nShutting down scheduler...');
        stopScheduler();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        console.log('\nShutting down scheduler...');
        stopScheduler();
        process.exit(0);
      });

      // Keep process running
      console.log('Scheduler is running. Press Ctrl+C to stop.\n');
      break;
    }

    case 'health': {
      const ok = await checkHealth();
      process.exit(ok ? 0 : 1);
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
