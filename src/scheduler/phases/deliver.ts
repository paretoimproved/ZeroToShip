/**
 * Deliver Phase Runner
 *
 * Sends daily brief emails to subscribers.
 */

import {
  sendDailyBriefsBatch,
  type Subscriber,
} from '../../delivery/email';
import type { IdeaBrief } from '../../generation/brief-generator';
import { createPhaseLogger } from '../utils/logger';
import type {
  PhaseResult,
  DeliverPhaseOutput,
  PipelineConfig,
} from '../types';

/**
 * Get active subscribers from database
 * TODO: Implement with actual database query
 */
async function getActiveSubscribers(): Promise<Subscriber[]> {
  // Placeholder - return empty array for now
  // Real implementation would query the database
  return [];
}

/**
 * Run the deliver phase
 */
export async function runDeliverPhase(
  runId: string,
  config: PipelineConfig,
  briefs: IdeaBrief[]
): Promise<PhaseResult<DeliverPhaseOutput>> {
  const logger = createPhaseLogger(runId, 'deliver');
  const startTime = Date.now();

  logger.info(
    { briefCount: briefs.length, dryRun: config.dryRun },
    'Starting deliver phase'
  );

  try {
    if (config.dryRun) {
      logger.info('Dry run mode - skipping actual email delivery');

      // In dry run, just log what would be sent
      const subscribers = await getActiveSubscribers();

      return {
        success: true,
        data: {
          subscriberCount: subscribers.length,
          sent: 0,
          failed: 0,
          dryRun: true,
        },
        duration: Date.now() - startTime,
        phase: 'deliver',
        timestamp: new Date(),
      };
    }

    // Get subscribers
    const subscribers = await getActiveSubscribers();

    if (subscribers.length === 0) {
      logger.warn('No active subscribers found');
      return {
        success: true, // Not a failure, just nothing to do
        data: {
          subscriberCount: 0,
          sent: 0,
          failed: 0,
          dryRun: false,
        },
        duration: Date.now() - startTime,
        phase: 'deliver',
        timestamp: new Date(),
      };
    }

    // Send emails
    const result = await sendDailyBriefsBatch(
      subscribers,
      briefs,
      {}, // Use default config
      {
        concurrency: 5,
        delayMs: 100,
        onProgress: (completed, total) => {
          logger.debug({ completed, total }, 'Delivery progress');
        },
      }
    );

    const duration = Date.now() - startTime;

    logger.info(
      {
        subscriberCount: subscribers.length,
        sent: result.sent,
        failed: result.failed,
        duration,
      },
      'Deliver phase complete'
    );

    return {
      success: result.failed === 0 || result.sent > 0,
      data: {
        subscriberCount: subscribers.length,
        sent: result.sent,
        failed: result.failed,
        dryRun: false,
      },
      duration,
      phase: 'deliver',
      timestamp: new Date(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    logger.error({ error: errorMessage }, 'Deliver phase failed');

    return {
      success: false,
      data: null,
      error: errorMessage,
      duration,
      phase: 'deliver',
      timestamp: new Date(),
    };
  }
}
