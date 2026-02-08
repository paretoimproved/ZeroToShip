/**
 * Score Cache for ZeroToShip
 *
 * Caches scored problem results to disk so that clusters seen in recent
 * pipeline runs (within a configurable TTL) are not re-scored via the
 * Anthropic API. This avoids redundant API calls when the same posts
 * appear across consecutive daily runs.
 *
 * Cache keys are derived from the representative post URL (primary)
 * or the cluster's problem statement hash (fallback).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import logger from '../lib/logger';
import type { ScoredProblem } from './scorer';

/** Default TTL: 48 hours in milliseconds */
const DEFAULT_TTL_MS = 48 * 60 * 60 * 1000;

/** Cache directory, relative to project root */
const CACHE_DIR = path.join(process.cwd(), 'data', 'score-cache');

/**
 * A single cached score entry
 */
interface CacheEntry {
  scoredProblem: ScoredProblem;
  cachedAt: string; // ISO timestamp
}

/**
 * The full cache file structure
 */
interface CacheFile {
  version: 2;
  entries: Record<string, CacheEntry>;
}

/**
 * Options for the score cache
 */
export interface ScoreCacheOptions {
  /** Time-to-live in milliseconds (default: 48 hours) */
  ttlMs?: number;
  /** Custom cache directory (default: data/score-cache) */
  cacheDir?: string;
  /** Disable the cache entirely (default: false) */
  disabled?: boolean;
}

/**
 * Generate a cache key from a post URL.
 * Falls back to a hash of the problem statement if no URL.
 */
export function getCacheKey(url: string | undefined, problemStatement: string): string {
  if (url) {
    // Normalize the URL to avoid duplicates from trailing slashes, etc.
    return crypto.createHash('sha256').update(url.trim().toLowerCase()).digest('hex').slice(0, 16);
  }
  return crypto.createHash('sha256').update(problemStatement.trim()).digest('hex').slice(0, 16);
}

/**
 * Get the cache file path
 */
function getCacheFilePath(cacheDir: string): string {
  return path.join(cacheDir, 'scores.json');
}

/**
 * Load the cache from disk. Returns empty cache if not found or corrupted.
 */
function loadCache(cacheDir: string): CacheFile {
  const filePath = getCacheFilePath(cacheDir);
  try {
    if (!fs.existsSync(filePath)) {
      return { version: 2, entries: {} };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as CacheFile;
    if (data.version !== 2 || typeof data.entries !== 'object') {
      logger.warn('Score cache file has invalid format, resetting');
      return { version: 2, entries: {} };
    }
    return data;
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to load score cache, starting fresh'
    );
    return { version: 2, entries: {} };
  }
}

/**
 * Save the cache to disk
 */
function saveCache(cacheDir: string, cache: CacheFile): void {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    const filePath = getCacheFilePath(cacheDir);
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to save score cache'
    );
  }
}

/**
 * Check if a cache entry is still valid (within TTL)
 */
function isEntryValid(entry: CacheEntry, ttlMs: number): boolean {
  const cachedAt = new Date(entry.cachedAt).getTime();
  return Date.now() - cachedAt < ttlMs;
}

/**
 * Score Cache class
 *
 * Provides lookup and storage of scored problems keyed by post URL
 * or problem statement hash.
 */
export class ScoreCache {
  private cache: CacheFile;
  private cacheDir: string;
  private ttlMs: number;
  private disabled: boolean;

  constructor(options: ScoreCacheOptions = {}) {
    this.cacheDir = options.cacheDir || CACHE_DIR;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.disabled = options.disabled ?? false;
    this.cache = this.disabled ? { version: 2, entries: {} } : loadCache(this.cacheDir);
  }

  /**
   * Look up a cached score by post URL or problem statement.
   * Returns the ScoredProblem if found and still within TTL, otherwise null.
   */
  get(url: string | undefined, problemStatement: string): ScoredProblem | null {
    if (this.disabled) return null;

    const key = getCacheKey(url, problemStatement);
    const entry = this.cache.entries[key];

    if (!entry) return null;
    if (!isEntryValid(entry, this.ttlMs)) {
      delete this.cache.entries[key];
      return null;
    }

    // Restore Date objects that were serialized
    const sp = entry.scoredProblem;
    sp.representativePost.createdAt = new Date(sp.representativePost.createdAt);
    sp.representativePost.scrapedAt = new Date(sp.representativePost.scrapedAt);
    for (const post of sp.relatedPosts) {
      post.createdAt = new Date(post.createdAt);
      post.scrapedAt = new Date(post.scrapedAt);
    }

    return sp;
  }

  /**
   * Store a scored problem in the cache.
   */
  set(scoredProblem: ScoredProblem): void {
    if (this.disabled) return;

    const url = scoredProblem.representativePost.url;
    const key = getCacheKey(url, scoredProblem.problemStatement);

    this.cache.entries[key] = {
      scoredProblem,
      cachedAt: new Date().toISOString(),
    };
  }

  /**
   * Persist the cache to disk. Call after a scoring run completes.
   */
  save(): void {
    if (this.disabled) return;
    this.pruneExpired();
    saveCache(this.cacheDir, this.cache);
  }

  /**
   * Remove expired entries from the cache
   */
  pruneExpired(): void {
    for (const [key, entry] of Object.entries(this.cache.entries)) {
      if (!isEntryValid(entry, this.ttlMs)) {
        delete this.cache.entries[key];
      }
    }
  }

  /**
   * Get statistics about the cache
   */
  stats(): { totalEntries: number; validEntries: number; expiredEntries: number } {
    let valid = 0;
    let expired = 0;
    for (const entry of Object.values(this.cache.entries)) {
      if (isEntryValid(entry, this.ttlMs)) {
        valid++;
      } else {
        expired++;
      }
    }
    return { totalEntries: valid + expired, validEntries: valid, expiredEntries: expired };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.entries = {};
  }
}
