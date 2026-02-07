/**
 * Typed Error Classes for IdeaForge
 *
 * Domain-specific error classes with fatal vs. degraded semantics.
 * - fatal: stops the pipeline
 * - degraded: logs and continues with partial results
 */

import type { PhaseName } from '../scheduler/types';

export type ErrorSeverity = 'fatal' | 'degraded';

/**
 * Base error class for all IdeaForge errors.
 * Carries severity, phase, and context metadata.
 */
export class IdeaForgeError extends Error {
  readonly severity: ErrorSeverity;
  readonly phase: PhaseName;
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      severity: ErrorSeverity;
      phase: PhaseName;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'IdeaForgeError';
    this.severity = options.severity;
    this.phase = options.phase;
    this.context = options.context ?? {};
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Error from scraper operations (network, rate limit, parse errors).
 */
export class ScraperError extends IdeaForgeError {
  constructor(
    message: string,
    options: {
      severity?: ErrorSeverity;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      severity: options.severity ?? 'degraded',
      phase: 'scrape',
      context: options.context,
      cause: options.cause,
    });
    this.name = 'ScraperError';
  }
}

/**
 * Error from analysis operations (clustering, scoring, gap analysis).
 */
export class AnalysisError extends IdeaForgeError {
  constructor(
    message: string,
    options: {
      severity?: ErrorSeverity;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      severity: options.severity ?? 'fatal',
      phase: 'analyze',
      context: options.context,
      cause: options.cause,
    });
    this.name = 'AnalysisError';
  }
}

/**
 * Error from delivery operations (email send failures).
 */
export class DeliveryError extends IdeaForgeError {
  constructor(
    message: string,
    options: {
      severity?: ErrorSeverity;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      severity: options.severity ?? 'degraded',
      phase: 'deliver',
      context: options.context,
      cause: options.cause,
    });
    this.name = 'DeliveryError';
  }
}

/**
 * Error from API route/service operations.
 */
export class ApiError extends IdeaForgeError {
  readonly statusCode: number;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      severity?: ErrorSeverity;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      severity: options.severity ?? 'degraded',
      // API errors don't map to a pipeline phase; use 'deliver' as closest
      phase: 'deliver',
      context: options.context,
      cause: options.cause,
    });
    this.name = 'ApiError';
    this.statusCode = options.statusCode ?? 500;
  }
}

/**
 * Type guard: check if an error is an IdeaForgeError
 */
export function isIdeaForgeError(error: unknown): error is IdeaForgeError {
  return error instanceof IdeaForgeError;
}

/**
 * Type guard: check if an error has fatal severity
 */
export function isFatalError(error: unknown): boolean {
  return isIdeaForgeError(error) && error.severity === 'fatal';
}

/**
 * Wrap an unknown error into the appropriate IdeaForge error type.
 * Preserves existing IdeaForge errors as-is.
 */
export function wrapError(
  error: unknown,
  ErrorClass: typeof ScraperError | typeof AnalysisError | typeof DeliveryError,
  context?: Record<string, unknown>
): IdeaForgeError {
  if (error instanceof IdeaForgeError) {
    return error;
  }

  const cause = error instanceof Error ? error : new Error(String(error));
  return new ErrorClass(cause.message, { cause, context });
}
