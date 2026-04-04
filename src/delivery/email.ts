/**
 * Email Delivery Service for ZeroToShip
 *
 * Sends daily brief emails to subscribers via Resend.
 * Handles subscriber tiers and tracks delivery status.
 */

import type { IdeaBrief } from '../generation/brief-generator';
import { config as envConfig } from '../config/env';
import {
  buildDailyEmail,
  type SubscriberTier,
  type EmailContent,
  type EmailBuilderConfig,
} from './email-builder';
import { sendEmailWithRetry } from '../lib/resend';

/** Send one email at a time — Resend free tier allows only 2 req/s and concurrent
 *  sends + retries easily blow past that. Sequential is the only safe approach. */
const DEFAULT_EMAIL_CONCURRENCY = 1;

/** Delay between each email (ms) — 1 second keeps us well under the 2 req/s limit
 *  even when a retry fires within the same window. */
const DEFAULT_EMAIL_DELAY_MS = 1_000;

/**
 * Subscriber information
 */
export interface Subscriber {
  id: string;
  email: string;
  tier: SubscriberTier;
  unsubscribeToken?: string;
}

/**
 * Delivery status for tracking
 */
export interface DeliveryStatus {
  subscriberId: string;
  email: string;
  messageId: string | null;
  status: 'sent' | 'failed' | 'bounced' | 'pending';
  error?: string;
  sentAt: Date;
}

/**
 * Batch delivery result
 */
export interface BatchDeliveryResult {
  total: number;
  sent: number;
  failed: number;
  deliveries: DeliveryStatus[];
}

/**
 * Email service configuration
 */
export interface EmailServiceConfig {
  resendApiKey?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  builderConfig?: EmailBuilderConfig;
}

const DEFAULT_CONFIG: Required<Omit<EmailServiceConfig, 'builderConfig'>> & {
  builderConfig: EmailBuilderConfig;
} = {
  resendApiKey: '',
  fromEmail: envConfig.RESEND_FROM_EMAIL || 'briefs@zerotoship.dev',
  fromName: envConfig.RESEND_FROM_NAME || 'ZeroToShip',
  replyTo: 'hello@zerotoship.dev',
  builderConfig: {},
};

// sendViaResend is now centralized in src/lib/resend.ts as sendEmailWithRetry

/**
 * Build personalized unsubscribe URL for a subscriber
 */
function buildUnsubscribeUrl(baseUrl: string, subscriber: Subscriber): string | undefined {
  if (!subscriber.unsubscribeToken) {
    return undefined;
  }
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken)}`;
}

/**
 * Send daily brief email to a single subscriber
 */
export async function sendDailyBrief(
  subscriber: Subscriber,
  briefs: IdeaBrief[],
  config: EmailServiceConfig = {}
): Promise<DeliveryStatus> {
  const opts = { ...DEFAULT_CONFIG, ...config };

  const status: DeliveryStatus = {
    subscriberId: subscriber.id,
    email: subscriber.email,
    messageId: null,
    status: 'pending',
    sentAt: new Date(),
  };

  // Build personalized email content
  const tokenUrl = buildUnsubscribeUrl(
    opts.builderConfig?.baseUrl || 'https://zerotoship.dev',
    subscriber
  );
  const builderConfig: EmailBuilderConfig = {
    ...opts.builderConfig,
    ...(tokenUrl ? { unsubscribeUrl: tokenUrl } : {}),
  };

  const emailContent = buildDailyEmail(briefs, subscriber.tier, builderConfig);

  // Send via centralized Resend client (with 3x retry)
  const from = `${opts.fromName} <${opts.fromEmail}>`;
  const result = await sendEmailWithRetry({
    to: subscriber.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    from,
    replyTo: opts.replyTo,
  });

  if (result.success) {
    status.status = 'sent';
    status.messageId = result.messageId || null;
  } else {
    status.status = 'failed';
    status.error = result.error;
  }

  return status;
}

/**
 * Send daily briefs to multiple subscribers
 */
export async function sendDailyBriefsBatch(
  subscribers: Subscriber[],
  briefs: IdeaBrief[],
  config: EmailServiceConfig = {},
  options: {
    concurrency?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<BatchDeliveryResult> {
  const { concurrency = DEFAULT_EMAIL_CONCURRENCY, delayMs = DEFAULT_EMAIL_DELAY_MS, onProgress } = options;

  const result: BatchDeliveryResult = {
    total: subscribers.length,
    sent: 0,
    failed: 0,
    deliveries: [],
  };

  if (subscribers.length === 0) {
    return result;
  }

  // Process in batches
  for (let i = 0; i < subscribers.length; i += concurrency) {
    const batch = subscribers.slice(i, i + concurrency);

    const batchPromises = batch.map(subscriber =>
      sendDailyBrief(subscriber, briefs, config)
    );

    const batchResults = await Promise.all(batchPromises);

    for (const delivery of batchResults) {
      result.deliveries.push(delivery);
      if (delivery.status === 'sent') {
        result.sent++;
      } else {
        result.failed++;
      }
    }

    // Progress callback
    if (onProgress) {
      const completed = Math.min(i + concurrency, subscribers.length);
      onProgress(completed, subscribers.length);
    }

    // Rate limiting delay between batches
    if (i + concurrency < subscribers.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return result;
}

/**
 * Preview email without sending (for testing)
 */
export function previewDailyBrief(
  tier: SubscriberTier,
  briefs: IdeaBrief[],
  config: EmailBuilderConfig = {}
): EmailContent {
  return buildDailyEmail(briefs, tier, config);
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Filter failed deliveries for retry
 */
export function getFailedDeliveries(result: BatchDeliveryResult): DeliveryStatus[] {
  return result.deliveries.filter(d => d.status === 'failed');
}

/**
 * Get delivery statistics
 */
export function getDeliveryStats(result: BatchDeliveryResult): {
  successRate: number;
  failureRate: number;
  averagePerSecond: number;
} {
  const successRate = result.total > 0 ? (result.sent / result.total) * 100 : 0;
  const failureRate = result.total > 0 ? (result.failed / result.total) * 100 : 0;

  // Estimate delivery rate (concurrency * 1000 / delayMs)
  const ESTIMATED_EMAILS_PER_SECOND = DEFAULT_EMAIL_CONCURRENCY * (1000 / DEFAULT_EMAIL_DELAY_MS);
  const averagePerSecond = result.total > 0 ? ESTIMATED_EMAILS_PER_SECOND : 0;

  return {
    successRate,
    failureRate,
    averagePerSecond,
  };
}

/**
 * Create a test subscriber for development
 */
export function createTestSubscriber(
  email: string,
  tier: SubscriberTier = 'free'
): Subscriber {
  return {
    id: `test_${Date.now()}`,
    email,
    tier,
    unsubscribeToken: `unsub_${Date.now()}`,
  };
}
