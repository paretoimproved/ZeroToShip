/**
 * Centralized Resend Email Client for ZeroToShip
 *
 * Single implementation of the Resend API with:
 * - Consistent error handling and response parsing
 * - Optional retry with exponential backoff
 * - Typed request/response interfaces
 *
 * All email-sending code should use this module instead of
 * making direct fetch calls to api.resend.com.
 */

import { config } from '../config/env';
import logger from './logger';

/** Parameters for sending an email via Resend */
export interface ResendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/** Result of a Resend send attempt */
export interface ResendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}

/** Configuration for retry behavior */
export interface ResendRetryConfig {
  /** Max number of attempts (default: 1 = no retry) */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  backoffBaseMs?: number;
}

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'ZeroToShip <briefs@zerotoship.dev>';
const DEFAULT_REPLY_TO = 'hello@zerotoship.dev';

/**
 * Send an email via the Resend API.
 *
 * Handles authentication, error parsing, and optional retry with backoff.
 * All callers get consistent error handling and typed results.
 */
export async function sendEmail(
  params: ResendEmailParams,
  retryConfig: ResendRetryConfig = {}
): Promise<ResendResult> {
  const apiKey = config.RESEND_API_KEY;

  if (!apiKey) {
    return { success: false, error: 'No Resend API key configured' };
  }

  const { maxAttempts = 1, backoffBaseMs = config.isTest ? 0 : 1_000 } = retryConfig;
  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const from = params.from ?? DEFAULT_FROM;
  const replyTo = params.replyTo ?? DEFAULT_REPLY_TO;

  const isRetryableStatus = (status: number) => status === 429 || status >= 500;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const jitterMs = () => (config.isTest ? 0 : Math.floor(Math.random() * 300));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: recipients,
          reply_to: replyTo,
          subject: params.subject,
          html: params.html,
          ...(params.text ? { text: params.text } : {}),
        }),
      });

      if (!response.ok) {
        let errorMessage = `Resend API error (${response.status})`;
        try {
          const body = (await response.json()) as { message?: string };
          if (body.message) errorMessage = `${errorMessage}: ${body.message}`;
        } catch {
          // Body wasn't JSON — keep the status-only message
        }

        if (attempt < maxAttempts && isRetryableStatus(response.status)) {
          const delay = backoffBaseMs * (2 ** (attempt - 1)) + jitterMs();
          await sleep(delay);
          continue;
        }

        return { success: false, error: errorMessage, statusCode: response.status };
      }

      const data = (await response.json()) as { id: string };
      return { success: true, messageId: data.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (attempt < maxAttempts) {
        const delay = backoffBaseMs * (2 ** (attempt - 1)) + jitterMs();
        await sleep(delay);
        continue;
      }

      return { success: false, error: errorMessage };
    }
  }

  return { success: false, error: 'Email send failed after retries' };
}

/**
 * Send an email via Resend with standard retry (3 attempts).
 * Convenience wrapper for transactional emails that should retry on failure.
 */
export async function sendEmailWithRetry(params: ResendEmailParams): Promise<ResendResult> {
  return sendEmail(params, { maxAttempts: 3 });
}

/**
 * Send an internal alert email (no retry, alerts-specific from address).
 */
export async function sendAlertEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<ResendResult> {
  return sendEmail({
    to,
    subject,
    html,
    text,
    from: 'ZeroToShip Alerts <alerts@zerotoship.dev>',
    replyTo: undefined,
  });
}
