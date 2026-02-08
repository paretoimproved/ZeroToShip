/**
 * Monitoring Module for ZeroToShip
 *
 * Wraps Sentry for error tracking with graceful degradation
 * when SENTRY_DSN is not configured.
 */

import * as Sentry from '@sentry/node';

let initialized = false;

/**
 * Initialize Sentry monitoring
 */
export function initMonitoring(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('[Monitoring] SENTRY_DSN not set - error tracking disabled');
    return;
  }

  if (initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });

  initialized = true;
}

/**
 * Capture an exception with optional context
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): void {
  if (!initialized) {
    console.error('[Monitoring] Exception (Sentry not initialized):', error.message);
    return;
  }

  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  if (!initialized) {
    console.log(`[Monitoring] ${level}: ${message}`);
    return;
  }

  Sentry.captureMessage(message, level);
}
