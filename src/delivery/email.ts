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
import { DeliveryError } from '../lib/errors';

/** Default concurrent email sends per batch */
const DEFAULT_EMAIL_CONCURRENCY = 5;

/** Default delay between email batches (ms) */
const DEFAULT_EMAIL_DELAY_MS = 100;

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
  replyTo: envConfig.RESEND_REPLY_TO || 'hello@zerotoship.dev',
  builderConfig: {},
};

/**
 * Resend API response types
 */
interface ResendSuccessResponse {
  id: string;
}

interface ResendErrorResponse {
  statusCode: number;
  message: string;
  name: string;
}

/**
 * Send a single email via Resend API
 */
async function sendViaResend(
  apiKey: string,
  from: string,
  to: string,
  replyTo: string,
  content: EmailContent
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const isRetryableStatus = (status: number) => status === 429 || status >= 500;

  const MAX_ATTEMPTS = 3;
  const BACKOFF_BASE_MS = envConfig.isTest ? 0 : 400;
  const jitterMs = () => (envConfig.isTest ? 0 : Math.floor(Math.random() * 200));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: replyTo,
          subject: content.subject,
          html: content.html,
          text: content.text,
        }),
      });

      if (!response.ok) {
        let parsed: Partial<ResendErrorResponse> | null = null;
        let raw = '';
        try {
          if (typeof (response as unknown as { json?: unknown }).json === 'function') {
            parsed = (await (response as unknown as { json: () => Promise<unknown> }).json()) as Partial<ResendErrorResponse>;
          } else if (typeof (response as unknown as { text?: unknown }).text === 'function') {
            raw = await (response as unknown as { text: () => Promise<string> }).text();
          }
        } catch {
          // ignore parse errors; we'll fall back to an unknown message
        }

        const message = parsed?.message || raw || 'Unknown Resend API error';
        const err = new DeliveryError(
          `Resend API error (${response.status}): ${message}`,
          { context: { to, statusCode: response.status, attempt } }
        );

        if (attempt < MAX_ATTEMPTS && isRetryableStatus(response.status)) {
          const backoffMs = BACKOFF_BASE_MS * (2 ** (attempt - 1)) + jitterMs();
          await sleep(backoffMs);
          continue;
        }

        return { success: false, error: err.message };
      }

      const data = (await response.json()) as ResendSuccessResponse;
      return { success: true, messageId: data.id };
    } catch (error) {
      const err = new DeliveryError(
        error instanceof Error ? error.message : 'Unknown error',
        { context: { to, attempt }, cause: error instanceof Error ? error : undefined }
      );

      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = BACKOFF_BASE_MS * (2 ** (attempt - 1)) + jitterMs();
        await sleep(backoffMs);
        continue;
      }

      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Email send failed after retries' };
}

/**
 * Build personalized unsubscribe URL for a subscriber
 */
function buildUnsubscribeUrl(baseUrl: string, subscriber: Subscriber): string {
  const token = subscriber.unsubscribeToken || subscriber.id;
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
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
  const apiKey = opts.resendApiKey || envConfig.RESEND_API_KEY;

  const status: DeliveryStatus = {
    subscriberId: subscriber.id,
    email: subscriber.email,
    messageId: null,
    status: 'pending',
    sentAt: new Date(),
  };

  // Validate API key
  if (!apiKey) {
    status.status = 'failed';
    status.error = 'No Resend API key configured';
    return status;
  }

  // Build personalized email content
  const builderConfig: EmailBuilderConfig = {
    ...opts.builderConfig,
    unsubscribeUrl: buildUnsubscribeUrl(
      opts.builderConfig?.baseUrl || 'https://zerotoship.dev',
      subscriber
    ),
  };

  const emailContent = buildDailyEmail(briefs, subscriber.tier, builderConfig);

  // Send via Resend
  const from = `${opts.fromName} <${opts.fromEmail}>`;
  const result = await sendViaResend(
    apiKey,
    from,
    subscriber.email,
    opts.replyTo,
    emailContent
  );

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
