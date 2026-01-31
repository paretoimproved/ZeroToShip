/**
 * OpenAI Embedding Client for IdeaForge
 *
 * Generates text embeddings using OpenAI's text-embedding-3-small model.
 * Includes caching to minimize API calls for repeated content.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface EmbeddingResult {
  embedding: number[];
  cached: boolean;
}

export interface EmbeddingCache {
  [hash: string]: number[];
}

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_INPUT_CHARS = 8000; // Safe limit for the model

/**
 * Creates a hash of the input text for cache lookup
 */
function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Prepares text for embedding by combining title and body
 */
export function prepareTextForEmbedding(title: string, body: string, maxBodyChars: number = 500): string {
  const truncatedBody = body.slice(0, maxBodyChars);
  const combined = `${title}\n\n${truncatedBody}`.trim();
  return combined.slice(0, MAX_INPUT_CHARS);
}

/**
 * OpenAI Embedding Client with caching support
 */
export class EmbeddingClient {
  private apiKey: string;
  private cache: EmbeddingCache = {};
  private cacheFile: string | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(apiKey?: string, cacheDir?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    if (cacheDir) {
      this.cacheFile = path.join(cacheDir, 'embeddings-cache.json');
      this.loadCache();
    }
  }

  /**
   * Load cache from disk if available
   */
  private loadCache(): void {
    if (!this.cacheFile) return;

    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        this.cache = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load embedding cache:', error);
      this.cache = {};
    }
  }

  /**
   * Save cache to disk
   */
  private saveCache(): void {
    if (!this.cacheFile) return;

    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache), 'utf-8');
    } catch (error) {
      console.warn('Failed to save embedding cache:', error);
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const hash = hashText(text);

    // Check cache
    if (this.cache[hash]) {
      this.cacheHits++;
      return { embedding: this.cache[hash], cached: true };
    }

    this.cacheMisses++;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
    };

    const embedding = data.data[0].embedding;

    // Update cache
    this.cache[hash] = embedding;
    this.saveCache();

    return { embedding, cached: false };
  }

  /**
   * Generate embeddings for multiple texts in batch
   * OpenAI supports up to 2048 inputs per request
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = new Array(texts.length);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const hash = hashText(texts[i]);
      if (this.cache[hash]) {
        this.cacheHits++;
        results[i] = { embedding: this.cache[hash], cached: true };
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(texts[i]);
      }
    }

    // Fetch uncached embeddings in batches
    if (uncachedTexts.length > 0) {
      const BATCH_SIZE = 100; // Conservative batch size

      for (let batchStart = 0; batchStart < uncachedTexts.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, uncachedTexts.length);
        const batchTexts = uncachedTexts.slice(batchStart, batchEnd);
        const batchOriginalIndices = uncachedIndices.slice(batchStart, batchEnd);

        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: batchTexts,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as {
          data: Array<{ embedding: number[]; index: number }>;
        };

        // Map embeddings back to original indices
        for (const item of data.data) {
          const originalIndex = batchOriginalIndices[item.index];
          const embedding = item.embedding;
          const text = texts[originalIndex];
          const hash = hashText(text);

          this.cache[hash] = embedding;
          this.cacheMisses++;
          results[originalIndex] = { embedding, cached: false };
        }
      }

      this.saveCache();
    }

    return results;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { hits: number; misses: number; size: number } {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: Object.keys(this.cache).length,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache = {};
    this.cacheHits = 0;
    this.cacheMisses = 0;

    if (this.cacheFile && fs.existsSync(this.cacheFile)) {
      fs.unlinkSync(this.cacheFile);
    }
  }
}

/**
 * Create a zero vector for testing purposes
 */
export function createZeroEmbedding(): number[] {
  return new Array(EMBEDDING_DIMENSIONS).fill(0);
}

/**
 * Create a random unit vector for testing purposes
 */
export function createRandomEmbedding(): number[] {
  const vec = new Array(EMBEDDING_DIMENSIONS).fill(0).map(() => Math.random() * 2 - 1);
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map(v => v / magnitude);
}
