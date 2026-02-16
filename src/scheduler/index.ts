/**
 * ZeroToShip Scheduler
 *
 * Main entry point for the scheduler module.
 * Provides cron-based scheduling and manual pipeline execution.
 */

import cron from 'node-cron';
import { config as envConfig } from '../config/env';
import { runPipeline, DEFAULT_PIPELINE_CONFIG } from './orchestrator';
import { logger } from './utils/logger';
import type { PipelineConfig, SchedulerConfig } from './types';

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  cronExpression: envConfig.SCHEDULER_CRON,
  timezone: envConfig.SCHEDULER_TIMEZONE,
  pipelineConfig: {
    generationMode: envConfig.SCHEDULER_GENERATION_MODE ?? envConfig.GENERATION_MODE,
  },
  enabled: envConfig.SCHEDULER_ENABLED,
};

let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Start the scheduler
 */
export function startScheduler(config: Partial<SchedulerConfig> = {}): void {
  const fullConfig = {
    ...DEFAULT_SCHEDULER_CONFIG,
    ...config,
    pipelineConfig: {
      ...DEFAULT_SCHEDULER_CONFIG.pipelineConfig,
      ...config.pipelineConfig,
    },
  };

  if (!fullConfig.enabled) {
    logger.info('Scheduler is disabled');
    return;
  }

  if (!cron.validate(fullConfig.cronExpression)) {
    logger.error(
      { cronExpression: fullConfig.cronExpression },
      'Invalid cron expression'
    );
    throw new Error(`Invalid cron expression: ${fullConfig.cronExpression}`);
  }

  logger.info(
    { cronExpression: fullConfig.cronExpression, timezone: fullConfig.timezone },
    'Starting scheduler'
  );

  scheduledTask = cron.schedule(
    fullConfig.cronExpression,
    async () => {
      logger.info('Scheduled pipeline run triggered');
      try {
        const result = await runPipeline(fullConfig.pipelineConfig);
        logger.info(
          {
            runId: result.runId,
            success: result.success,
            duration: result.totalDuration,
          },
          'Scheduled pipeline run completed'
        );
      } catch (error) {
        logger.error({ error }, 'Scheduled pipeline run failed');
      }
    },
    {
      timezone: fullConfig.timezone,
      scheduled: true,
    }
  );

  logger.info('Scheduler started successfully');
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Scheduler stopped');
  }
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return scheduledTask !== null;
}

// Re-export key items
export { runPipeline, DEFAULT_PIPELINE_CONFIG, generateRunId } from './orchestrator';
export { checkPipelineFreshness } from './watchdog';
export { logger, createLogger, createRunLogger, createPhaseLogger } from './utils/logger';
export { withRetry, retryable } from './utils/retry';
export { MetricsCollector } from './utils/metrics';
export type {
  PipelineConfig,
  PipelineResult,
  PhaseResult,
  SchedulerConfig,
  PhaseName,
  ScrapePhaseOutput,
  AnalyzePhaseOutput,
  GeneratePhaseOutput,
  DeliverPhaseOutput,
  PipelineError,
} from './types';
