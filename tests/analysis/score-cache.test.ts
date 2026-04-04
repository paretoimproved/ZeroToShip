/**
 * Tests for the Score Cache (Pipeline-Level Dedup)
 *
 * Verifies that recently scored problems are cached and reused,
 * avoiding redundant Anthropic API calls across pipeline runs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ScoreCache, getCacheKey } from '../../src/analysis/score-cache';
import type { ScoredProblem } from '../../src/analysis/scorer';
import type { RawPost } from '../../src/scrapers/types';

// Use a temp directory for tests to avoid polluting real data
const TEST_CACHE_DIR = path.join(process.cwd(), 'data', 'test-score-cache');

function cleanTestDir(): void {
  if (fs.existsSync(TEST_CACHE_DIR)) {
    fs.rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
  }
}

function createMockPost(overrides: Partial<RawPost> = {}): RawPost {
  return {
    id: 'post_abc',
    source: 'reddit',
    sourceId: 'abc123',
    title: 'Test post',
    body: 'Test body',
    url: 'https://reddit.com/r/test/123',
    author: 'testuser',
    score: 100,
    commentCount: 25,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    scrapedAt: new Date('2026-01-15T01:00:00Z'),
    signals: ['frustrated'],
    ...overrides,
  };
}

function createMockScoredProblem(overrides: Partial<ScoredProblem> = {}): ScoredProblem {
  return {
    id: 'cluster_test',
    representativePost: createMockPost(),
    relatedPosts: [createMockPost({ id: 'post_related' })],
    frequency: 5,
    totalScore: 250,
    embedding: [0.1, 0.2, 0.3],
    problemStatement: 'Users struggle with managing API keys',
    sources: ['reddit', 'hn'],
    scores: {
      frequency: 5,
      severity: 7,
      marketSize: 6,
      technicalComplexity: 4,
      timeToMvp: 3,
      engagement: 5,
      impact: 210,
      effort: 12,
      priority: 17.5,
    },
    reasoning: {
      severity: 'Moderate pain point',
      marketSize: 'Common developer issue',
      technicalComplexity: 'Standard CRUD app',
    },
    ...overrides,
  };
}

describe('Score Cache', () => {
  beforeEach(() => {
    cleanTestDir();
  });

  afterEach(() => {
    cleanTestDir();
  });

  describe('getCacheKey', () => {
    it('generates a key from URL when provided', () => {
      const key = getCacheKey('https://reddit.com/r/test/123', 'problem statement');
      expect(key).toHaveLength(16);
      expect(typeof key).toBe('string');
    });

    it('generates a key from problem statement when no URL', () => {
      const key = getCacheKey(undefined, 'Users struggle with API keys');
      expect(key).toHaveLength(16);
    });

    it('generates consistent keys for the same URL', () => {
      const key1 = getCacheKey('https://example.com/post/1', 'statement');
      const key2 = getCacheKey('https://example.com/post/1', 'different statement');
      expect(key1).toBe(key2);
    });

    it('generates different keys for different URLs', () => {
      const key1 = getCacheKey('https://example.com/post/1', 'statement');
      const key2 = getCacheKey('https://example.com/post/2', 'statement');
      expect(key1).not.toBe(key2);
    });

    it('normalizes URL casing', () => {
      const key1 = getCacheKey('https://Example.COM/Post/1', 'statement');
      const key2 = getCacheKey('https://example.com/post/1', 'statement');
      expect(key1).toBe(key2);
    });

    it('generates consistent keys for the same problem statement', () => {
      const key1 = getCacheKey(undefined, 'Users struggle with API keys');
      const key2 = getCacheKey(undefined, 'Users struggle with API keys');
      expect(key1).toBe(key2);
    });

    it('generates different keys for different problem statements', () => {
      const key1 = getCacheKey(undefined, 'Problem A');
      const key2 = getCacheKey(undefined, 'Problem B');
      expect(key1).not.toBe(key2);
    });
  });

  describe('ScoreCache', () => {
    it('creates a new empty cache', () => {
      const cache = new ScoreCache({ cacheDir: TEST_CACHE_DIR });
      const stats = cache.stats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.validEntries).toBe(0);
    });

    it('stores and retrieves a scored problem', () => {
      const cache = new ScoreCache({ cacheDir: TEST_CACHE_DIR });
      const scored = createMockScoredProblem();

      cache.set(scored);
      const retrieved = cache.get(scored.representativePost.url, scored.problemStatement);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('cluster_test');
      expect(retrieved!.scores.priority).toBe(17.5);
    });

    it('returns null for cache miss', () => {
      const cache = new ScoreCache({ cacheDir: TEST_CACHE_DIR });

      const result = cache.get('https://nonexistent.com', 'No such problem');

      expect(result).toBeNull();
    });

    it('persists cache to disk and reloads it', () => {
      // Write
      const cache1 = new ScoreCache({ cacheDir: TEST_CACHE_DIR });
      cache1.set(createMockScoredProblem());
      cache1.save();

      // Reload
      const cache2 = new ScoreCache({ cacheDir: TEST_CACHE_DIR });
      const retrieved = cache2.get(
        'https://reddit.com/r/test/123',
        'Users struggle with managing API keys'
      );

      expect(retrieved).not.toBeNull();
      expect(retrieved!.scores.priority).toBe(17.5);
    });

    it('restores Date objects from deserialized cache', () => {
      const cache1 = new ScoreCache({ cacheDir: TEST_CACHE_DIR });
      cache1.set(createMockScoredProblem());
      cache1.save();

      const cache2 = new ScoreCache({ cacheDir: TEST_CACHE_DIR });
      const retrieved = cache2.get(
        'https://reddit.com/r/test/123',
        'Users struggle with managing API keys'
      );

      expect(retrieved!.representativePost.createdAt).toBeInstanceOf(Date);
      expect(retrieved!.representativePost.scrapedAt).toBeInstanceOf(Date);
      expect(retrieved!.relatedPosts[0].createdAt).toBeInstanceOf(Date);
    });

    it('returns null for expired entries', () => {
      const cache = new ScoreCache({
        cacheDir: TEST_CACHE_DIR,
        ttlMs: 1, // 1ms TTL — will expire immediately
      });

      cache.set(createMockScoredProblem());

      // Wait a few ms to ensure expiration
      const start = Date.now();
      while (Date.now() - start < 5) { /* spin */ }

      const result = cache.get(
        'https://reddit.com/r/test/123',
        'Users struggle with managing API keys'
      );

      expect(result).toBeNull();
    });

    it('reports correct stats', () => {
      const cache = new ScoreCache({ cacheDir: TEST_CACHE_DIR });

      cache.set(createMockScoredProblem({ id: 'c1' }));
      cache.set(
        createMockScoredProblem({
          id: 'c2',
          representativePost: createMockPost({ url: 'https://example.com/2' }),
          problemStatement: 'Different problem',
        })
      );

      const stats = cache.stats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.validEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
    });

    it('prunes expired entries', () => {
      const cache = new ScoreCache({
        cacheDir: TEST_CACHE_DIR,
        ttlMs: 1,
      });

      cache.set(createMockScoredProblem());

      // Wait for expiry
      const start = Date.now();
      while (Date.now() - start < 5) { /* spin */ }

      cache.pruneExpired();
      const stats = cache.stats();
      expect(stats.totalEntries).toBe(0);
    });

    it('clears all entries', () => {
      const cache = new ScoreCache({ cacheDir: TEST_CACHE_DIR });
      cache.set(createMockScoredProblem());
      cache.set(
        createMockScoredProblem({
          id: 'c2',
          representativePost: createMockPost({ url: 'https://example.com/2' }),
        })
      );

      cache.clear();

      expect(cache.stats().totalEntries).toBe(0);
    });

    it('handles corrupted cache file gracefully', () => {
      // Write garbage to the cache file
      fs.mkdirSync(TEST_CACHE_DIR, { recursive: true });
      fs.writeFileSync(path.join(TEST_CACHE_DIR, 'scores.json'), 'not valid json', 'utf-8');

      // Should not throw, returns empty cache
      const cache = new ScoreCache({ cacheDir: TEST_CACHE_DIR });
      expect(cache.stats().totalEntries).toBe(0);
    });

    it('handles invalid cache format gracefully', () => {
      fs.mkdirSync(TEST_CACHE_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(TEST_CACHE_DIR, 'scores.json'),
        JSON.stringify({ version: 99, entries: 'not an object' }),
        'utf-8'
      );

      const cache = new ScoreCache({ cacheDir: TEST_CACHE_DIR });
      expect(cache.stats().totalEntries).toBe(0);
    });

    it('does nothing when disabled', () => {
      const cache = new ScoreCache({ disabled: true, cacheDir: TEST_CACHE_DIR });

      cache.set(createMockScoredProblem());
      const result = cache.get('https://reddit.com/r/test/123', 'problem');

      expect(result).toBeNull();
      expect(cache.stats().totalEntries).toBe(0);
    });

    it('save does nothing when disabled', () => {
      const cache = new ScoreCache({ disabled: true, cacheDir: TEST_CACHE_DIR });
      cache.save();

      // Cache file should not be created
      expect(fs.existsSync(path.join(TEST_CACHE_DIR, 'scores.json'))).toBe(false);
    });

    it('uses problem statement hash as fallback when no URL', () => {
      const cache = new ScoreCache({ cacheDir: TEST_CACHE_DIR });
      const scored = createMockScoredProblem({
        representativePost: createMockPost({ url: '' }),
        problemStatement: 'Unique problem statement here',
      });

      cache.set(scored);
      const retrieved = cache.get('', 'Unique problem statement here');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.problemStatement).toBe('Unique problem statement here');
    });

    it('overwrites existing entry for same URL', () => {
      const cache = new ScoreCache({ cacheDir: TEST_CACHE_DIR });

      const scored1 = createMockScoredProblem({ id: 'v1' });
      const scored2 = createMockScoredProblem({ id: 'v2' });

      cache.set(scored1);
      cache.set(scored2);

      const retrieved = cache.get(
        'https://reddit.com/r/test/123',
        'Users struggle with managing API keys'
      );

      expect(retrieved!.id).toBe('v2');
      expect(cache.stats().totalEntries).toBe(1);
    });

    it('stores multiple entries with different URLs', () => {
      const cache = new ScoreCache({ cacheDir: TEST_CACHE_DIR });

      cache.set(createMockScoredProblem({
        id: 'c1',
        representativePost: createMockPost({ url: 'https://example.com/1' }),
      }));
      cache.set(createMockScoredProblem({
        id: 'c2',
        representativePost: createMockPost({ url: 'https://example.com/2' }),
      }));
      cache.set(createMockScoredProblem({
        id: 'c3',
        representativePost: createMockPost({ url: 'https://example.com/3' }),
      }));

      expect(cache.stats().totalEntries).toBe(3);
    });

    it('creates cache directory if it does not exist', () => {
      const nestedDir = path.join(TEST_CACHE_DIR, 'nested', 'deep');
      const cache = new ScoreCache({ cacheDir: nestedDir });
      cache.set(createMockScoredProblem());
      cache.save();

      expect(fs.existsSync(path.join(nestedDir, 'scores.json'))).toBe(true);
    });
  });
});
