/**
 * Web Search Client for Gap Analysis
 *
 * Supports multiple search providers: SerpAPI, Brave Search, and fallback mock.
 * Generates search queries from problem statements and fetches results.
 */

import { config as envConfig } from '../config/env';
import logger from '../lib/logger';

/**
 * A single search result from any provider
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  domain: string;
}

/**
 * Response from a search query
 */
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchedAt: Date;
  provider: 'serpapi' | 'brave' | 'mock';
}

/**
 * Configuration for web search client
 */
export interface WebSearchConfig {
  provider?: 'serpapi' | 'brave' | 'auto';
  serpApiKey?: string;
  braveApiKey?: string;
  maxResults?: number;
  rateLimitDelay?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  cacheTtlMs?: number;
  minUniqueResultsBeforeExpansion?: number;
  maxQueriesPerProblem?: number;
}

const DEFAULT_CONFIG: Required<WebSearchConfig> = {
  provider: 'auto',
  serpApiKey: '',
  braveApiKey: '',
  maxResults: 10,
  rateLimitDelay: 1000,
  maxRetries: 2,
  retryBaseDelayMs: 1200,
  cacheTtlMs: 30 * 60 * 1000,
  minUniqueResultsBeforeExpansion: 8,
  maxQueriesPerProblem: 3,
};

/** Maximum backoff delay for retry attempts */
const MAX_RETRY_BACKOFF_MS = 12_000;

interface CacheEntry {
  response: SearchResponse;
  expiresAt: number;
}

class SearchRequestError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(
    message: string,
    status: number,
    retryAfterMs: number | null = null
  ) {
    super(message);
    this.name = 'SearchRequestError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Generate search queries from a problem statement
 * Creates 2-3 diverse queries to maximize coverage
 */
export function generateSearchQueries(problemStatement: string): string[] {
  const queries: string[] = [];

  // Clean and normalize the problem statement
  const cleaned = problemStatement
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract key terms (nouns and verbs)
  const words = cleaned.split(' ').filter(w => w.length > 3);
  const keyTerms = words.slice(0, 5).join(' ');

  // Query 1: Direct solution search
  queries.push(`${keyTerms} tool solution app`);

  // Query 2: Alternative/competitor search
  queries.push(`best ${keyTerms} software alternatives`);

  // Query 3: Specific product search if the statement is specific enough
  if (cleaned.length > 20) {
    queries.push(`"${cleaned.slice(0, 50)}" product`);
  }

  return queries;
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse Retry-After header value to milliseconds
 */
function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const retryDateMs = Date.parse(value);
  if (!Number.isNaN(retryDateMs)) {
    return Math.max(0, retryDateMs - Date.now());
  }

  return null;
}

/**
 * Web Search Client
 */
export class WebSearchClient {
  private config: Required<WebSearchConfig>;
  private static requestTurn: Promise<void> = Promise.resolve();
  private static lastRequestAt = 0;
  private static responseCache = new Map<string, CacheEntry>();
  private static inFlight = new Map<string, Promise<SearchResponse>>();

  constructor(config: WebSearchConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      serpApiKey: config.serpApiKey || envConfig.SERPAPI_KEY,
      braveApiKey: config.braveApiKey || envConfig.BRAVE_API_KEY,
    };
  }

  /**
   * Determine which provider to use
   */
  private getProvider(): 'serpapi' | 'brave' | 'mock' {
    if (this.config.provider !== 'auto') {
      if (this.config.provider === 'serpapi' && this.config.serpApiKey) {
        return 'serpapi';
      }
      if (this.config.provider === 'brave' && this.config.braveApiKey) {
        return 'brave';
      }
    }

    // Auto-detect based on available keys
    if (this.config.serpApiKey) return 'serpapi';
    if (this.config.braveApiKey) return 'brave';

    // Fallback to mock for development/testing
    return 'mock';
  }

  /**
   * Rate limit requests
   */
  private async rateLimit(): Promise<void> {
    const previousTurn = WebSearchClient.requestTurn;
    let releaseTurn: () => void = () => {};
    const currentTurn = new Promise<void>(resolve => {
      releaseTurn = resolve;
    });
    WebSearchClient.requestTurn = currentTurn;

    await previousTurn;
    try {
      const now = Date.now();
      const elapsed = now - WebSearchClient.lastRequestAt;
      if (elapsed < this.config.rateLimitDelay) {
        await sleep(this.config.rateLimitDelay - elapsed);
      }
      WebSearchClient.lastRequestAt = Date.now();
    } finally {
      releaseTurn();
    }
  }

  /**
   * Search using SerpAPI
   */
  private async searchSerpApi(query: string): Promise<SearchResponse> {
    const params = new URLSearchParams({
      api_key: this.config.serpApiKey,
      engine: 'google',
      q: query,
      num: String(this.config.maxResults),
    });

    const response = await fetch(`https://serpapi.com/search?${params}`);

    if (!response.ok) {
      throw new SearchRequestError(
        `SerpAPI error: ${response.status} ${response.statusText}`,
        response.status,
        parseRetryAfterMs(response.headers?.get('retry-after') ?? null)
      );
    }

    const data = await response.json() as {
      organic_results?: Array<{
        title: string;
        link: string;
        snippet: string;
        position: number;
      }>;
      search_information?: { total_results?: number };
    };

    const results: SearchResult[] = (data.organic_results || []).map((r, i) => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
      position: r.position || i + 1,
      domain: extractDomain(r.link || ''),
    }));

    return {
      query,
      results,
      totalResults: data.search_information?.total_results || results.length,
      searchedAt: new Date(),
      provider: 'serpapi',
    };
  }

  /**
   * Search using Brave Search API
   */
  private async searchBrave(query: string): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q: query,
      count: String(this.config.maxResults),
    });

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': this.config.braveApiKey,
      },
    });

    if (!response.ok) {
      throw new SearchRequestError(
        `Brave Search error: ${response.status} ${response.statusText}`,
        response.status,
        parseRetryAfterMs(response.headers?.get('retry-after') ?? null)
      );
    }

    const data = await response.json() as {
      web?: {
        results?: Array<{
          title: string;
          url: string;
          description: string;
        }>;
        total_results?: number;
      };
    };

    const results: SearchResult[] = (data.web?.results || []).map((r, i) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || '',
      position: i + 1,
      domain: extractDomain(r.url || ''),
    }));

    return {
      query,
      results,
      totalResults: data.web?.total_results || results.length,
      searchedAt: new Date(),
      provider: 'brave',
    };
  }

  /**
   * Mock search for development/testing
   */
  private async searchMock(query: string): Promise<SearchResponse> {
    // Simulate API latency
    await sleep(100);

    // Generate plausible mock results based on query terms
    const terms = query.toLowerCase().split(' ').filter(t => t.length > 2);
    const mockDomains = [
      'github.com', 'producthunt.com', 'capterra.com', 'g2.com',
      'alternativeto.net', 'techcrunch.com', 'medium.com', 'reddit.com',
    ];

    const results: SearchResult[] = mockDomains.slice(0, this.config.maxResults).map((domain, i) => ({
      title: `${terms.slice(0, 3).join(' ')} - Solution ${i + 1}`,
      url: `https://${domain}/example-${i + 1}`,
      snippet: `A solution for ${terms.join(' ')} with various features and capabilities...`,
      position: i + 1,
      domain,
    }));

    return {
      query,
      results,
      totalResults: results.length,
      searchedAt: new Date(),
      provider: 'mock',
    };
  }

  /**
   * Execute a search query against the configured provider with fallback
   */
  private async executeSearch(query: string): Promise<SearchResponse> {
    await this.rateLimit();

    const provider = this.getProvider();

    if (provider === 'serpapi') {
      try {
        return await this.searchSerpApi(query);
      } catch (error) {
        if (this.config.braveApiKey && !(error instanceof SearchRequestError && error.status === 429)) {
          logger.warn({ err: error, query }, 'SerpAPI failed, falling back to Brave Search');
          await this.rateLimit();
          return this.searchBrave(query);
        }
        throw error;
      }
    }

    if (provider === 'brave') {
      return this.searchBrave(query);
    }

    return this.searchMock(query);
  }

  /**
   * Retry policy for transient search failures.
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof SearchRequestError) {
      if (error.status === 429 || error.status === 408) {
        return true;
      }
      return error.status >= 500 && error.status < 600;
    }

    return error instanceof TypeError;
  }

  /**
   * Compute retry delay using Retry-After and exponential backoff.
   */
  private getRetryDelayMs(error: unknown, attempt: number): number {
    const exponentialDelay = Math.min(
      this.config.retryBaseDelayMs * Math.pow(2, attempt),
      MAX_RETRY_BACKOFF_MS
    );

    if (error instanceof SearchRequestError && error.retryAfterMs !== null) {
      return Math.max(error.retryAfterMs, exponentialDelay);
    }

    return exponentialDelay;
  }

  private getCacheKey(query: string): string {
    const provider = this.getProvider();
    return `${provider}:${this.config.maxResults}:${query.trim().toLowerCase()}`;
  }

  private getCachedResponse(cacheKey: string): SearchResponse | null {
    const cached = WebSearchClient.responseCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      WebSearchClient.responseCache.delete(cacheKey);
      return null;
    }

    return {
      ...cached.response,
      results: [...cached.response.results],
      searchedAt: new Date(cached.response.searchedAt),
    };
  }

  private setCachedResponse(cacheKey: string, response: SearchResponse): void {
    if (this.config.cacheTtlMs <= 0) {
      return;
    }

    WebSearchClient.responseCache.set(cacheKey, {
      response: {
        ...response,
        results: [...response.results],
        searchedAt: new Date(response.searchedAt),
      },
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
  }

  /**
   * Execute a search query with cache, in-flight dedupe, and retry handling.
   */
  async search(query: string): Promise<SearchResponse> {
    const trimmedQuery = query.trim();
    const cacheKey = this.getCacheKey(trimmedQuery);

    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }

    const inFlight = WebSearchClient.inFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = (async () => {
      let lastError: unknown = null;
      const maxAttempts = this.config.maxRetries + 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const response = await this.executeSearch(trimmedQuery);
          this.setCachedResponse(cacheKey, response);
          return response;
        } catch (error) {
          lastError = error;

          if (attempt === maxAttempts - 1 || !this.isRetryableError(error)) {
            throw error;
          }

          const delayMs = this.getRetryDelayMs(error, attempt);
          logger.warn(
            { err: error, query: trimmedQuery, attempt: attempt + 1, delayMs },
            'Search request failed; retrying'
          );
          await sleep(delayMs);
        }
      }

      throw lastError instanceof Error ? lastError : new Error('Search failed');
    })();

    WebSearchClient.inFlight.set(cacheKey, request);
    try {
      return await request;
    } finally {
      WebSearchClient.inFlight.delete(cacheKey);
    }
  }

  /**
   * Execute multiple search queries for a problem
   */
  async searchForProblem(problemStatement: string): Promise<SearchResponse[]> {
    const queries = generateSearchQueries(problemStatement)
      .slice(0, this.config.maxQueriesPerProblem);
    const results: SearchResponse[] = [];

    for (const query of queries) {
      try {
        const response = await this.search(query);
        results.push(response);

        const uniqueResults = WebSearchClient.deduplicateResults(results).length;
        if (uniqueResults >= this.config.minUniqueResultsBeforeExpansion) {
          break;
        }
      } catch (error) {
        logger.warn({ err: error, query }, 'Search failed for query');
        // Continue with other queries
      }
    }

    return results;
  }

  /**
   * Get unique results from multiple search responses
   * Deduplicates by URL
   */
  static deduplicateResults(responses: SearchResponse[]): SearchResult[] {
    const seen = new Set<string>();
    const unique: SearchResult[] = [];

    for (const response of responses) {
      for (const result of response.results) {
        const normalizedUrl = result.url.toLowerCase().replace(/\/$/, '');
        if (!seen.has(normalizedUrl)) {
          seen.add(normalizedUrl);
          unique.push(result);
        }
      }
    }

    return unique;
  }

  /**
   * Get the active provider
   */
  getActiveProvider(): 'serpapi' | 'brave' | 'mock' {
    return this.getProvider();
  }

  /**
   * Test-only helper to reset static shared state.
   */
  static resetForTesting(): void {
    WebSearchClient.requestTurn = Promise.resolve();
    WebSearchClient.lastRequestAt = 0;
    WebSearchClient.responseCache.clear();
    WebSearchClient.inFlight.clear();
  }
}
