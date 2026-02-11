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

/** Anthropic Messages API URL */
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/** Anthropic API version header value */
const ANTHROPIC_VERSION = '2023-06-01';

/** Default timeout for API calls (ms) */
const DEFAULT_TIMEOUT_MS = 60_000;

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
  } = options;

  const startTime = Date.now();
  const inputTokens = (system ? estimateTokens(system) : 0) + estimateTokens(prompt);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
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

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

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

      logger.warn(
        { status: response.status, module: moduleName },
        'Anthropic API error'
      );

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

      logger.warn({ module: moduleName }, 'No content in Anthropic response');
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
    // Re-throw AnthropicApiError (already recorded metrics above)
    if (error instanceof AnthropicApiError) {
      throw error;
    }

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

      logger.warn({ module: moduleName, timeoutMs }, 'Anthropic API call timed out');
      throw new Error(`Anthropic API call timed out after ${timeoutMs}ms`);
    }

    // Handle "empty content" error (already recorded metrics above)
    if (error instanceof Error && error.message === 'Anthropic API returned empty content') {
      throw error;
    }

    // Network / unexpected errors
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

    logger.warn(
      { err: error, module: moduleName },
      'Anthropic API call failed'
    );

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
