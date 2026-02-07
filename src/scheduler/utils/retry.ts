/**
 * Retry Utility with Exponential Backoff
 *
 * Provides retry functionality for unreliable operations.
 */

import { createLogger } from './logger';

/** Default number of retry attempts before giving up */
const DEFAULT_MAX_ATTEMPTS = 3;

/** Default base delay for exponential backoff (ms) */
const DEFAULT_BASE_DELAY_MS = 1000;

/** Default maximum delay cap for exponential backoff (ms) */
const DEFAULT_MAX_DELAY_MS = 30_000;

/** Maximum random jitter added to backoff delay (ms) */
const BACKOFF_JITTER_MS = 1000;

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  baseDelayMs: DEFAULT_BASE_DELAY_MS,
  maxDelayMs: DEFAULT_MAX_DELAY_MS,
};

/**
 * Execute function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context?: string
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const logger = createLogger({ context: context || 'retry' });

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) {
        logger.error(
          { attempt, error: lastError.message },
          'All retry attempts exhausted'
        );
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * BACKOFF_JITTER_MS,
        opts.maxDelayMs
      );

      logger.warn(
        {
          attempt,
          maxAttempts: opts.maxAttempts,
          delayMs: Math.round(delay),
          error: lastError.message,
        },
        'Retry attempt failed, waiting before next attempt'
      );

      opts.onRetry?.(attempt, lastError);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Wrap a function with retry behavior
 */
export function retryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options?: Partial<RetryOptions>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    return withRetry(() => fn(...args), options);
  };
}
