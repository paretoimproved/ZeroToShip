/**
 * Deliver Phase Runner
 *
 * Sends daily brief emails to subscribers.
 */

import {
  sendDailyBriefsBatch,
  type Subscriber,
} from '../../delivery/email';
import { processOnboardingDrip } from '../../delivery/onboarding';
import type { IdeaBrief } from '../../generation/brief-generator';
import { createPhaseLogger } from '../utils/logger';
import { DeliveryError, wrapError } from '../../lib/errors';
import type {
  PhaseResult,
  DeliverPhaseOutput,
  PipelineConfig,
} from '../types';
import { db, users, subscriptions, userPreferences, emailLogs } from '../../api/db/client';
import { eq } from 'drizzle-orm';

/**
 * Get active subscribers from database
 */
async function getActiveSubscribers(): Promise<Subscriber[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      tier: subscriptions.plan,
      emailFrequency: userPreferences.emailFrequency,
    })
    .from(users)
    .innerJoin(subscriptions, eq(subscriptions.userId, users.id))
    .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
    .where(eq(subscriptions.status, 'active'));

  return rows
    .filter((row) => row.emailFrequency !== 'never')
    .map((row) => ({
      id: row.id,
      email: row.email,
      tier: row.tier as Subscriber['tier'],
    }));
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

    // Persist delivery statuses to email_logs
    try {
      const emailLogRows = result.deliveries
        .filter((d) => d.status === 'sent' || d.status === 'failed')
        .map((delivery) => ({
          runId,
          userId: delivery.subscriberId,
          recipientEmail: delivery.email,
          subject: `Your Daily Startup Ideas — ${new Date().toLocaleDateString()}`,
          messageId: delivery.messageId,
          status: delivery.status as string,
          error: delivery.error || null,
          sentAt: delivery.sentAt,
        }));

      if (emailLogRows.length > 0) {
        await db.insert(emailLogs).values(emailLogRows);
      }
    } catch (logError) {
      logger.warn(
        { error: logError instanceof Error ? logError.message : String(logError) },
        'Failed to persist email delivery logs (non-fatal)'
      );
    }

    const duration = Date.now() - startTime;

    // Process onboarding drip emails after daily digest
    try {
      const dripResult = await processOnboardingDrip();
      logger.info(
        {
          onboardingSent: dripResult.sent,
          onboardingSkipped: dripResult.skipped,
          onboardingFailed: dripResult.failed,
        },
        'Onboarding drip processing complete'
      );
    } catch (dripError) {
      // Onboarding drip failures should not fail the deliver phase
      logger.warn(
        { error: dripError instanceof Error ? dripError.message : String(dripError) },
        'Onboarding drip processing failed (non-fatal)'
      );
    }

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
    const deliveryError = wrapError(error, DeliveryError);
    const errorMessage = deliveryError.message;

    logger.error({ error: errorMessage, severity: deliveryError.severity }, 'Deliver phase failed');

    return {
      success: false,
      data: null,
      error: errorMessage,
      severity: deliveryError.severity,
      duration,
      phase: 'deliver',
      timestamp: new Date(),
    };
  }
}
