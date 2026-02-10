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
}

const DEFAULT_CONFIG: Required<WebSearchConfig> = {
  provider: 'auto',
  serpApiKey: '',
  braveApiKey: '',
  maxResults: 10,
  rateLimitDelay: 1000,
};

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
 * Web Search Client
 */
export class WebSearchClient {
  private config: Required<WebSearchConfig>;
  private lastRequestTime = 0;

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
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.config.rateLimitDelay) {
      await sleep(this.config.rateLimitDelay - elapsed);
    }
    this.lastRequestTime = Date.now();
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
      throw new Error(`SerpAPI error: ${response.status} ${response.statusText}`);
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
      throw new Error(`Brave Search error: ${response.status} ${response.statusText}`);
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
   * Execute a search query with automatic fallback
   */
  async search(query: string): Promise<SearchResponse> {
    await this.rateLimit();

    const provider = this.getProvider();

    if (provider === 'serpapi') {
      try {
        return await this.searchSerpApi(query);
      } catch (error) {
        if (this.config.braveApiKey) {
          logger.warn({ err: error, query }, 'SerpAPI failed, falling back to Brave Search');
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
   * Execute multiple search queries for a problem
   */
  async searchForProblem(problemStatement: string): Promise<SearchResponse[]> {
    const queries = generateSearchQueries(problemStatement);
    const results: SearchResponse[] = [];

    for (const query of queries) {
      try {
        const response = await this.search(query);
        results.push(response);
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
}
