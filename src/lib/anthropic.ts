/**
 * Shared Anthropic API Client for ZeroToShip
 *
 * Single wrapper around Anthropic's Messages API used by all modules.
 * Handles headers, timeout via AbortController, metrics recording,
 * structured error logging, and response parsing.
 */

import logger from './logger';
import { getGlobalMetrics } from '../scheduler/utils/api-metrics';
import { estimateTokens } from '../scheduler/utils/token-estimator';
import type { ApiCallRecord } from '../scheduler/utils/api-metrics';
import { Semaphore } from './semaphore';
import { config } from '../config/env';

/** Anthropic Messages API URL */
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/** Anthropic API version header value */
const ANTHROPIC_VERSION = '2023-06-01';

/** Default timeout for API calls (ms) */
const DEFAULT_TIMEOUT_MS = 60_000;

/** Default retry attempts for transient provider failures (excludes initial attempt). */
const DEFAULT_MAX_RETRIES = 2;

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504, 529]);

/** Global API concurrency semaphore (lazy singleton). */
let _apiSemaphore: Semaphore | null = null;

function getApiSemaphore(): Semaphore {
  if (!_apiSemaphore) {
    _apiSemaphore = new Semaphore(config.MAX_CONCURRENT_API_CALLS);
    logger.info(
      { maxConcurrent: config.MAX_CONCURRENT_API_CALLS },
      'API semaphore initialised'
    );
  }
  return _apiSemaphore;
}

/** Reset the API semaphore singleton. Use in tests only. */
export function resetApiSemaphore(): void {
  _apiSemaphore = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoffMs(attempt: number): number {
  // attempt is 1-based (1 = first try). Backoff starts on attempt 2.
  const baseMs = 250;
  const maxMs = 8000;
  const exp = Math.min(6, Math.max(0, attempt - 2)); // 0,1,2...
  const jitter = 0.75 + Math.random() * 0.5; // 0.75x - 1.25x
  return Math.min(maxMs, Math.round(baseMs * (2 ** exp) * jitter));
}

/**
 * Options for a single Anthropic API call
 */
export interface AnthropicCallOptions {
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  timeoutMs?: number;

  /** Module name for metrics recording */
  module: ApiCallRecord['module'];
  /** Batch size for metrics (default 1) */
  batchSize?: number;

  /** Retries for transient failures (default 2). Set to 0 to disable retries. */
  maxRetries?: number;
}

/**
 * Successful result from an Anthropic API call
 */
export interface AnthropicCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Error thrown when the Anthropic API returns a non-200 status
 */
export class AnthropicApiError extends Error {
  readonly statusCode: number;
  readonly responseBody: string;

  constructor(statusCode: number, responseBody: string) {
    super(`Anthropic API error (${statusCode})`);
    this.name = 'AnthropicApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/**
 * Call the Anthropic Messages API.
 *
 * - Constructs auth/version headers in one place
 * - Uses AbortController for configurable timeout
 * - Always records metrics (success and failure)
 * - Logs errors via the shared Pino logger
 * - Returns parsed text + token counts
 *
 * Throws on failure so callers can handle per-site fallback logic.
 */
export async function callAnthropicApi(
  options: AnthropicCallOptions
): Promise<AnthropicCallResult> {
  const {
    apiKey,
    model,
    system,
    prompt,
    maxTokens,
    temperature,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    module: moduleName,
    batchSize = 1,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  const inputTokens = (system ? estimateTokens(system) : 0) + estimateTokens(prompt);

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) {
    body.system = system;
  }
  if (temperature !== undefined) {
    body.temperature = temperature;
  }

  const maxAttempts = Math.max(1, maxRetries + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const semaphore = getApiSemaphore();

    try {
      // Acquire a semaphore slot before the HTTP call to cap concurrency.
      await semaphore.acquire();
      let response: Response;
      try {
        response = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        semaphore.release();
      }

      if (!response.ok) {
        const errorBody = await response.text();

        getGlobalMetrics().recordCall({
          timestamp: new Date(),
          module: moduleName,
          model,
          batchSize,
          itemsProcessed: 0,
          inputTokens,
          outputTokens: 0,
          success: false,
          durationMs: Date.now() - startTime,
        });

        const canRetry = RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxAttempts;
        logger.warn(
          { status: response.status, module: moduleName, attempt, maxAttempts, canRetry },
          'Anthropic API error'
        );

        if (canRetry) {
          await sleep(computeBackoffMs(attempt));
          continue;
        }

        throw new AnthropicApiError(response.status, errorBody);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text: string }>;
      };

      const text = data.content[0]?.text;
      if (!text) {
        getGlobalMetrics().recordCall({
          timestamp: new Date(),
          module: moduleName,
          model,
          batchSize,
          itemsProcessed: 0,
          inputTokens,
          outputTokens: 0,
          success: false,
          durationMs: Date.now() - startTime,
        });

        const canRetry = attempt < maxAttempts;
        logger.warn(
          { module: moduleName, attempt, maxAttempts, canRetry },
          'No content in Anthropic response'
        );

        if (canRetry) {
          await sleep(computeBackoffMs(attempt));
          continue;
        }

        throw new Error('Anthropic API returned empty content');
      }

      const outputTokens = estimateTokens(text);

      getGlobalMetrics().recordCall({
        timestamp: new Date(),
        module: moduleName,
        model,
        batchSize,
        itemsProcessed: batchSize,
        inputTokens,
        outputTokens,
        success: true,
        durationMs: Date.now() - startTime,
      });

      return { text, inputTokens, outputTokens };
    } catch (error) {
      // Handle abort/timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        getGlobalMetrics().recordCall({
          timestamp: new Date(),
          module: moduleName,
          model,
          batchSize,
          itemsProcessed: 0,
          inputTokens,
          outputTokens: 0,
          success: false,
          durationMs: Date.now() - startTime,
        });

        const canRetry = attempt < maxAttempts;
        logger.warn(
          { module: moduleName, timeoutMs, attempt, maxAttempts, canRetry },
          'Anthropic API call timed out'
        );

        if (canRetry) {
          await sleep(computeBackoffMs(attempt));
          continue;
        }

        throw new Error(`Anthropic API call timed out after ${timeoutMs}ms`);
      }

      // Re-throw AnthropicApiError (already recorded metrics above)
      if (error instanceof AnthropicApiError) {
        throw error;
      }

      // Empty content failures are recorded above in the try block.
      if (error instanceof Error && error.message === 'Anthropic API returned empty content') {
        throw error;
      }

      // Network / unexpected errors (retryable up to maxAttempts)
      getGlobalMetrics().recordCall({
        timestamp: new Date(),
        module: moduleName,
        model,
        batchSize,
        itemsProcessed: 0,
        inputTokens,
        outputTokens: 0,
        success: false,
        durationMs: Date.now() - startTime,
      });

      const canRetry = attempt < maxAttempts;
      logger.warn(
        { err: error, module: moduleName, attempt, maxAttempts, canRetry },
        'Anthropic API call failed'
      );

      if (canRetry) {
        await sleep(computeBackoffMs(attempt));
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Should be unreachable.
  throw new Error('Anthropic API call failed after retries');
}
