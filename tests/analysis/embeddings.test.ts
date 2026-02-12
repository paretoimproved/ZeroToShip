/**
 * Tests for the Embeddings Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  EmbeddingClient,
  prepareTextForEmbedding,
  createZeroEmbedding,
  createRandomEmbedding,
} from '../../src/analysis/embeddings';
import { _resetConfigForTesting } from '../../src/config/env';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test constants
const EMBEDDING_DIMENSIONS = 1536;
const TEST_API_KEY = 'test-api-key-12345';
const TEST_CACHE_DIR = './test-cache-temp';

describe('Embedding Utils', () => {
  describe('prepareTextForEmbedding', () => {
    it('combines title and body with newlines', () => {
      const result = prepareTextForEmbedding('My Title', 'My body content');
      expect(result).toBe('My Title\n\nMy body content');
    });

    it('truncates body to default max chars (500)', () => {
      const longBody = 'x'.repeat(1000);
      const result = prepareTextForEmbedding('Title', longBody);
      // Default maxBodyChars is 500
      expect(result).toBe('Title\n\n' + 'x'.repeat(500));
    });

    it('truncates body to custom max chars', () => {
      const longBody = 'a'.repeat(200);
      const result = prepareTextForEmbedding('Title', longBody, 100);
      expect(result).toBe('Title\n\n' + 'a'.repeat(100));
    });

    it('handles empty body by trimming', () => {
      const result = prepareTextForEmbedding('Title', '');
      expect(result).toBe('Title');
    });

    it('handles empty title', () => {
      const result = prepareTextForEmbedding('', 'Body content');
      expect(result).toBe('Body content');
    });

    it('handles both empty', () => {
      const result = prepareTextForEmbedding('', '');
      expect(result).toBe('');
    });

    it('truncates overall text to 8000 chars max', () => {
      const longTitle = 't'.repeat(5000);
      const longBody = 'b'.repeat(5000);
      const result = prepareTextForEmbedding(longTitle, longBody, 5000);
      expect(result.length).toBeLessThanOrEqual(8000);
    });

    it('preserves whitespace in content', () => {
      const result = prepareTextForEmbedding('Title', 'Line 1\nLine 2\nLine 3');
      expect(result).toBe('Title\n\nLine 1\nLine 2\nLine 3');
    });

    it('handles unicode characters', () => {
      const result = prepareTextForEmbedding('Title: 日本語', 'Body: 中文 + emoji 🚀');
      expect(result).toContain('日本語');
      expect(result).toContain('🚀');
    });
  });

  describe('createZeroEmbedding', () => {
    it('creates 1536-dimensional vector', () => {
      const embedding = createZeroEmbedding();
      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS);
    });

    it('all values are zero', () => {
      const embedding = createZeroEmbedding();
      expect(embedding.every(v => v === 0)).toBe(true);
    });

    it('creates new array each time (no mutation)', () => {
      const e1 = createZeroEmbedding();
      const e2 = createZeroEmbedding();
      e1[0] = 999;
      expect(e2[0]).toBe(0);
    });
  });

  describe('createRandomEmbedding', () => {
    it('creates 1536-dimensional vector', () => {
      const embedding = createRandomEmbedding();
      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS);
    });

    it('creates unit vector (magnitude ~= 1)', () => {
      const embedding = createRandomEmbedding();
      const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1.0, 5);
    });

    it('creates different vectors each time', () => {
      const e1 = createRandomEmbedding();
      const e2 = createRandomEmbedding();
      // Compare first few elements - should be different
      const same = e1.slice(0, 10).every((v, i) => v === e2[i]);
      expect(same).toBe(false);
    });

    it('contains values between -1 and 1', () => {
      const embedding = createRandomEmbedding();
      expect(embedding.every(v => v >= -1 && v <= 1)).toBe(true);
    });
  });
});

describe('EmbeddingClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Clean up test cache directory if exists
    if (fs.existsSync(TEST_CACHE_DIR)) {
      fs.rmSync(TEST_CACHE_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(TEST_CACHE_DIR)) {
      fs.rmSync(TEST_CACHE_DIR, { recursive: true });
    }
  });

  describe('constructor', () => {
    it('throws error when no API key provided', () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      _resetConfigForTesting();

      expect(() => new EmbeddingClient()).toThrow('OpenAI API key is required');

      process.env.OPENAI_API_KEY = originalEnv;
      _resetConfigForTesting();
    });

    it('accepts API key from constructor', () => {
      const client = new EmbeddingClient(TEST_API_KEY);
      expect(client).toBeDefined();
    });

    it('uses environment variable for API key', () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-api-key';
      _resetConfigForTesting();

      const client = new EmbeddingClient();
      expect(client).toBeDefined();

      process.env.OPENAI_API_KEY = originalEnv;
      _resetConfigForTesting();
    });

    it('creates cache directory if cacheDir provided', () => {
      const client = new EmbeddingClient(TEST_API_KEY, TEST_CACHE_DIR);
      // Client should be created, cache file created on first save
      expect(client).toBeDefined();
    });

    it('loads existing cache from file', () => {
      // Create cache file first
      fs.mkdirSync(TEST_CACHE_DIR, { recursive: true });
      const cacheContent = JSON.stringify({ 'testhash1234567': [0.1, 0.2, 0.3] });
      fs.writeFileSync(path.join(TEST_CACHE_DIR, 'embeddings-cache.json'), cacheContent);

      const client = new EmbeddingClient(TEST_API_KEY, TEST_CACHE_DIR);
      const stats = client.getCacheStats();
      expect(stats.size).toBe(1);
    });
  });

  describe('embed', () => {
    it('calls OpenAI API and returns embedding', async () => {
      const mockEmbedding = new Array(EMBEDDING_DIMENSIONS).fill(0.1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      const client = new EmbeddingClient(TEST_API_KEY);
      const result = await client.embed('test text');

      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns cached result on second call with same text', async () => {
      const mockEmbedding = new Array(EMBEDDING_DIMENSIONS).fill(0.2);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      const client = new EmbeddingClient(TEST_API_KEY);

      // First call - API
      const result1 = await client.embed('same text');
      expect(result1.cached).toBe(false);

      // Second call - cached
      const result2 = await client.embed('same text');
      expect(result2.cached).toBe(true);
      expect(result2.embedding).toEqual(mockEmbedding);

      // API should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const client = new EmbeddingClient(TEST_API_KEY);

      await expect(client.embed('test')).rejects.toThrow('OpenAI API error: 401');
    });

    it('uses correct API endpoint and headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(EMBEDDING_DIMENSIONS).fill(0) }],
        }),
      });

      const client = new EmbeddingClient(TEST_API_KEY);
      await client.embed('test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TEST_API_KEY}`,
          }),
        })
      );
    });
  });

  describe('embedBatch', () => {
    it('handles fully cached batch', async () => {
      // Pre-populate cache via single embeds
      const mockEmbedding1 = new Array(EMBEDDING_DIMENSIONS).fill(0.1);
      const mockEmbedding2 = new Array(EMBEDDING_DIMENSIONS).fill(0.2);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ embedding: mockEmbedding1 }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ embedding: mockEmbedding2 }] }),
        });

      const client = new EmbeddingClient(TEST_API_KEY);

      // Cache the texts
      await client.embed('text 1');
      await client.embed('text 2');

      vi.resetAllMocks();

      // Batch should return cached
      const results = await client.embedBatch(['text 1', 'text 2']);

      expect(results).toHaveLength(2);
      expect(results[0].cached).toBe(true);
      expect(results[1].cached).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles mixed cached and uncached texts', async () => {
      const mockEmbedding1 = new Array(EMBEDDING_DIMENSIONS).fill(0.1);
      const mockEmbedding3 = new Array(EMBEDDING_DIMENSIONS).fill(0.3);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ embedding: mockEmbedding1 }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ embedding: mockEmbedding3, index: 0 }]
          }),
        });

      const client = new EmbeddingClient(TEST_API_KEY);

      // Cache one text
      await client.embed('text 1');

      // Batch with mixed cached/uncached
      const results = await client.embedBatch(['text 1', 'text 3']);

      expect(results).toHaveLength(2);
      expect(results[0].cached).toBe(true);
      expect(results[1].cached).toBe(false);
    });

    it('handles empty batch', async () => {
      const client = new EmbeddingClient(TEST_API_KEY);
      const results = await client.embedBatch([]);

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws on API error during batch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const client = new EmbeddingClient(TEST_API_KEY);

      await expect(client.embedBatch(['text'])).rejects.toThrow('OpenAI API error: 500');
    });
  });

  describe('getCacheStats', () => {
    it('returns initial stats', () => {
      const client = new EmbeddingClient(TEST_API_KEY);
      const stats = client.getCacheStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('tracks cache hits and misses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(EMBEDDING_DIMENSIONS).fill(0) }],
        }),
      });

      const client = new EmbeddingClient(TEST_API_KEY);

      // Miss
      await client.embed('text 1');
      // Miss
      await client.embed('text 2');
      // Hit
      await client.embed('text 1');
      // Hit
      await client.embed('text 2');

      const stats = client.getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.size).toBe(2);
    });
  });

  describe('clearCache', () => {
    it('clears in-memory cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(EMBEDDING_DIMENSIONS).fill(0) }],
        }),
      });

      const client = new EmbeddingClient(TEST_API_KEY);
      await client.embed('text');

      let stats = client.getCacheStats();
      expect(stats.size).toBe(1);

      client.clearCache();

      stats = client.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('deletes cache file when cacheDir set', async () => {
      fs.mkdirSync(TEST_CACHE_DIR, { recursive: true });
      const cacheFile = path.join(TEST_CACHE_DIR, 'embeddings-cache.json');
      fs.writeFileSync(cacheFile, '{}');

      const client = new EmbeddingClient(TEST_API_KEY, TEST_CACHE_DIR);

      expect(fs.existsSync(cacheFile)).toBe(true);

      client.clearCache();

      expect(fs.existsSync(cacheFile)).toBe(false);
    });
  });

  describe('cache persistence', () => {
    it('saves cache to file after flush', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(EMBEDDING_DIMENSIONS).fill(0.5) }],
        }),
      });

      const client = new EmbeddingClient(TEST_API_KEY, TEST_CACHE_DIR);
      await client.embed('test text');

      // embed() no longer auto-saves; must call flush() explicitly
      client.flush();

      const cacheFile = path.join(TEST_CACHE_DIR, 'embeddings-cache.json');
      expect(fs.existsSync(cacheFile)).toBe(true);

      const cacheContent = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      expect(Object.keys(cacheContent).length).toBe(1);
    });

    it('loads cache on new client instance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(EMBEDDING_DIMENSIONS).fill(0.7) }],
        }),
      });

      // First client - cache the embedding and flush to disk
      const client1 = new EmbeddingClient(TEST_API_KEY, TEST_CACHE_DIR);
      await client1.embed('persistent text');
      client1.flush();

      // Second client - should load from cache
      const client2 = new EmbeddingClient(TEST_API_KEY, TEST_CACHE_DIR);
      const result = await client2.embed('persistent text');

      expect(result.cached).toBe(true);
      // Only one API call total
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
