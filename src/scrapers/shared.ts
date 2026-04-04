/**
 * Shared Scraper Utilities for ZeroToShip
 *
 * Consolidates common patterns across all scrapers:
 * - ID generation
 * - Sleep/delay for rate limiting
 * - Post deduplication
 * - HTML/text cleaning
 * - Date cutoff calculation
 * - Error wrapping with ScraperError
 */

import * as crypto from 'crypto';
import type { RawPost } from './types';
import { ScraperError } from '../lib/errors';
import logger from '../lib/logger';

// ─── Result Limits ───────────────────────────────────────────────────────────

/**
 * Maximum posts any single scraper source can return.
 * Prevents OOM from viral threads and controls downstream API costs
 * (clustering is O(n^2) space, scoring calls Anthropic per post).
 */
export const MAX_POSTS_PER_SOURCE = 500;

/**
 * Truncate a sorted array of posts to MAX_POSTS_PER_SOURCE.
 * Posts should be pre-sorted by signal strength / relevance so that
 * truncation keeps the highest-quality results.
 */
export function truncateResults<T extends RawPost>(
  posts: T[],
  limit: number = MAX_POSTS_PER_SOURCE
): T[] {
  if (posts.length <= limit) return posts;
  logger.info(
    { before: posts.length, after: limit },
    `Truncating scraper results from ${posts.length} to ${limit}`
  );
  return posts.slice(0, limit);
}

// ─── ID Generation ──────────────────────────────────────────────────────────

/**
 * Generate a UUID v4 for post IDs
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a source-prefixed ID (e.g. "hn-12345", "github-67890")
 */
export function generateSourceId(source: string, id: string | number): string {
  return `${source}-${id}`;
}

// ─── Timing Utilities ───────────────────────────────────────────────────────

/**
 * Sleep for specified milliseconds (rate limiting between requests)
 * Re-exported from src/lib/utils.ts for backwards compatibility.
 */
export { sleep } from '../lib/utils';

/**
 * Calculate a cutoff timestamp for filtering posts by age
 * @param hoursBack - Number of hours to look back
 * @returns Cutoff time in milliseconds since epoch
 */
export function getCutoffTime(hoursBack: number): number {
  return Date.now() - hoursBack * 60 * 60 * 1000;
}

/**
 * Calculate a cutoff Date for filtering posts by age
 */
export function getCutoffDate(hoursBack: number): Date {
  return new Date(getCutoffTime(hoursBack));
}

// ─── Text Cleaning ──────────────────────────────────────────────────────────

/**
 * Remove HTML tags and decode common entities
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize apostrophes (smart quotes, backticks, acute accents -> straight quote)
 */
export function normalizeApostrophes(text: string): string {
  return text.replace(/[\u2018\u2019\u0060\u00B4]/g, "'");
}

// ─── Deduplication ──────────────────────────────────────────────────────────

/**
 * Deduplicate posts by sourceId.
 * Generic version that works with any RawPost subtype.
 */
export function deduplicatePosts<T extends RawPost>(posts: T[]): T[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.sourceId)) return false;
    seen.add(post.sourceId);
    return true;
  });
}

// ─── Error Wrapping ─────────────────────────────────────────────────────────

/**
 * Wrap an unknown error into a ScraperError with source context.
 * If the error is already a ScraperError, return it as-is.
 */
export function wrapScraperError(
  error: unknown,
  source: string,
  context?: Record<string, unknown>
): ScraperError {
  if (error instanceof ScraperError) return error;

  const cause = error instanceof Error ? error : undefined;
  const message = error instanceof Error ? error.message : String(error);

  return new ScraperError(message, {
    severity: 'degraded',
    context: { source, ...context },
    cause,
  });
}

/**
 * Execute a scraper operation with standardized error logging.
 * On failure, logs the error and returns the fallback value.
 */
export async function withScraperErrorHandling<T>(
  operation: () => Promise<T>,
  opts: {
    source: string;
    operation: string;
    context?: Record<string, unknown>;
    fallback: T;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const scraperErr = wrapScraperError(error, opts.source, opts.context);
    logger.error(
      { err: scraperErr, ...opts.context },
      `${opts.operation}: ${scraperErr.message}`
    );
    return opts.fallback;
  }
}
