/**
 * Tests for the Web Search Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WebSearchClient,
  generateSearchQueries,
  type SearchResult,
  type SearchResponse,
} from '../../src/analysis/web-search';
import { _resetConfigForTesting } from '../../src/config/env';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('generateSearchQueries', () => {
  it('generates multiple queries from problem statement', () => {
    const queries = generateSearchQueries('Users need a better way to track expenses');

    expect(queries.length).toBeGreaterThanOrEqual(2);
    expect(queries.length).toBeLessThanOrEqual(3);
  });

  it('includes solution/tool keywords in first query', () => {
    const queries = generateSearchQueries('Need a tool for project management');

    expect(queries[0]).toMatch(/tool|solution|app/i);
  });

  it('includes alternatives keyword in second query', () => {
    const queries = generateSearchQueries('Looking for expense tracking software');

    expect(queries[1]).toMatch(/alternatives|software/i);
  });

  it('generates third query for longer statements', () => {
    const longStatement = 'This is a very long problem statement that describes a complex issue with many details about what users need';
    const queries = generateSearchQueries(longStatement);

    expect(queries.length).toBe(3);
    expect(queries[2]).toContain('product');
  });

  it('does not generate third query for short statements', () => {
    const shortStatement = 'Short problem';
    const queries = generateSearchQueries(shortStatement);

    expect(queries.length).toBe(2);
  });

  it('removes single quotes from problem statement in first queries', () => {
    const queries = generateSearchQueries("Users say 'this is broken' and need help");

    // First two queries should have quotes stripped
    expect(queries[0]).not.toContain("'");
    expect(queries[1]).not.toContain("'");
    // Third query intentionally includes quoted substring for exact match
  });

  it('normalizes whitespace', () => {
    const queries = generateSearchQueries('Need   better    expense    tracking');

    queries.forEach(q => {
      expect(q).not.toMatch(/\s{2,}/);
    });
  });

  it('handles empty string', () => {
    const queries = generateSearchQueries('');

    expect(queries.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts key terms (words > 3 chars)', () => {
    const queries = generateSearchQueries('I am the best at doing things');

    // "I", "am", "the", "at" should be filtered out (<=3 chars)
    expect(queries[0]).toContain('best');
    expect(queries[0]).toContain('doing');
    expect(queries[0]).toContain('things');
  });
});

describe('WebSearchClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    global.fetch = mockFetch;
    WebSearchClient.resetForTesting();
    // Clear environment variables for test isolation
    delete process.env.SERPAPI_KEY;
    delete process.env.BRAVE_API_KEY;
    _resetConfigForTesting();
  });

  afterEach(() => {
    WebSearchClient.resetForTesting();
    vi.useRealTimers();
  });

  describe('constructor and provider selection', () => {
    it('uses mock provider when no API keys', () => {
      const client = new WebSearchClient();
      expect(client.getActiveProvider()).toBe('mock');
    });

    it('uses serpapi when SERPAPI_KEY is set', () => {
      process.env.SERPAPI_KEY = 'test-serp-key';
      _resetConfigForTesting();
      const client = new WebSearchClient();
      expect(client.getActiveProvider()).toBe('serpapi');
    });

    it('uses brave when BRAVE_API_KEY is set', () => {
      process.env.BRAVE_API_KEY = 'test-brave-key';
      _resetConfigForTesting();
      const client = new WebSearchClient();
      expect(client.getActiveProvider()).toBe('brave');
    });

    it('prefers serpapi over brave when both available', () => {
      process.env.SERPAPI_KEY = 'test-serp-key';
      process.env.BRAVE_API_KEY = 'test-brave-key';
      _resetConfigForTesting();
      const client = new WebSearchClient();
      expect(client.getActiveProvider()).toBe('serpapi');
    });

    it('uses explicitly specified provider', () => {
      const client = new WebSearchClient({
        provider: 'brave',
        braveApiKey: 'test-key',
      });
      expect(client.getActiveProvider()).toBe('brave');
    });

    it('falls back to mock when specified provider lacks key', () => {
      const client = new WebSearchClient({
        provider: 'serpapi',
        // No serpApiKey provided
      });
      expect(client.getActiveProvider()).toBe('mock');
    });

    it('accepts config options', () => {
      const client = new WebSearchClient({
        maxResults: 20,
        rateLimitDelay: 2000,
        serpApiKey: 'test-key',
      });
      expect(client.getActiveProvider()).toBe('serpapi');
    });
  });

  describe('search - mock provider', () => {
    it('returns mock results', async () => {
      const client = new WebSearchClient();

      const resultPromise = client.search('test query');
      await vi.advanceTimersByTimeAsync(200);
      const result = await resultPromise;

      expect(result.provider).toBe('mock');
      expect(result.query).toBe('test query');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.searchedAt).toBeInstanceOf(Date);
    });

    it('mock results have correct structure', async () => {
      const client = new WebSearchClient({ maxResults: 5 });

      const resultPromise = client.search('expense tracking');
      await vi.advanceTimersByTimeAsync(200);
      const result = await resultPromise;

      expect(result.results.length).toBeLessThanOrEqual(5);

      result.results.forEach((r, i) => {
        expect(r.title).toBeDefined();
        expect(r.url).toMatch(/^https:\/\//);
        expect(r.snippet).toBeDefined();
        expect(r.position).toBe(i + 1);
        expect(r.domain).toBeDefined();
      });
    });

    it('mock results include query terms in title', async () => {
      const client = new WebSearchClient();

      const resultPromise = client.search('expense tracking tool');
      await vi.advanceTimersByTimeAsync(200);
      const result = await resultPromise;

      // At least one result should contain query terms
      const titlesContainTerms = result.results.some(r =>
        r.title.toLowerCase().includes('expense') ||
        r.title.toLowerCase().includes('tracking')
      );
      expect(titlesContainTerms).toBe(true);
    });
  });

  describe('search - SerpAPI provider', () => {
    const mockSerpResponse = {
      organic_results: [
        {
          title: 'Best Expense Tracker',
          link: 'https://example.com/tracker',
          snippet: 'Track your expenses easily',
          position: 1,
        },
        {
          title: 'Free Budget App',
          link: 'https://budget.app/home',
          snippet: 'Manage your budget',
          position: 2,
        },
      ],
      search_information: { total_results: 1000 },
    };

    it('calls SerpAPI with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSerpResponse,
      });

      const client = new WebSearchClient({
        serpApiKey: 'test-serp-key',
        maxResults: 10,
      });

      await client.search('test query');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('serpapi.com/search');
      expect(url).toContain('api_key=test-serp-key');
      expect(url).toContain('q=test+query');
      expect(url).toContain('num=10');
    });

    it('parses SerpAPI response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSerpResponse,
      });

      const client = new WebSearchClient({ serpApiKey: 'key' });
      const result = await client.search('query');

      expect(result.provider).toBe('serpapi');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe('Best Expense Tracker');
      expect(result.results[0].url).toBe('https://example.com/tracker');
      expect(result.results[0].domain).toBe('example.com');
      expect(result.totalResults).toBe(1000);
    });

    it('handles SerpAPI error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const client = new WebSearchClient({ serpApiKey: 'bad-key' });

      await expect(client.search('query')).rejects.toThrow('SerpAPI error: 401');
    });

    it('handles empty SerpAPI results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ organic_results: [] }),
      });

      const client = new WebSearchClient({ serpApiKey: 'key' });
      const result = await client.search('very obscure query');

      expect(result.results).toEqual([]);
      expect(result.totalResults).toBe(0);
    });
  });

  describe('search - Brave provider', () => {
    const mockBraveResponse = {
      web: {
        results: [
          {
            title: 'Brave Result 1',
            url: 'https://brave1.com/page',
            description: 'First brave result',
          },
          {
            title: 'Brave Result 2',
            url: 'https://brave2.com/page',
            description: 'Second brave result',
          },
        ],
        total_results: 500,
      },
    };

    it('calls Brave API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBraveResponse,
      });

      const client = new WebSearchClient({
        braveApiKey: 'test-brave-key',
        maxResults: 15,
      });

      await client.search('test query');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('api.search.brave.com');
      expect(url).toContain('q=test+query');
      expect(url).toContain('count=15');
      expect(options.headers['X-Subscription-Token']).toBe('test-brave-key');
    });

    it('parses Brave response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBraveResponse,
      });

      const client = new WebSearchClient({ braveApiKey: 'key' });
      const result = await client.search('query');

      expect(result.provider).toBe('brave');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe('Brave Result 1');
      expect(result.results[0].snippet).toBe('First brave result');
      expect(result.results[0].domain).toBe('brave1.com');
      expect(result.totalResults).toBe(500);
    });

    it('handles Brave API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const client = new WebSearchClient({ braveApiKey: 'bad-key' });

      await expect(client.search('query')).rejects.toThrow('Brave Search error: 403');
    });
  });

  describe('rate limiting', () => {
    it('delays subsequent requests', async () => {
      const client = new WebSearchClient({ rateLimitDelay: 1000 });

      // First request
      const promise1 = client.search('query 1');
      await vi.advanceTimersByTimeAsync(200);
      await promise1;

      const startTime = Date.now();

      // Second request should be delayed
      const promise2 = client.search('query 2');

      // Advance time to complete rate limit delay
      await vi.advanceTimersByTimeAsync(1000);
      await promise2;

      // The rate limiter should have enforced delay
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(800);
    });
  });

  describe('cache and retry behavior', () => {
    it('reuses cached responses for repeated queries', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          web: {
            results: [
              {
                title: 'Cached result',
                url: 'https://cached.example/result',
                description: 'cached',
              },
            ],
          },
        }),
      });

      const client = new WebSearchClient({
        braveApiKey: 'test-key',
        rateLimitDelay: 0,
      });

      const first = await client.search('same query');
      const second = await client.search('same query');

      expect(first.results[0].url).toBe('https://cached.example/result');
      expect(second.results[0].url).toBe('https://cached.example/result');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('deduplicates in-flight identical requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          web: {
            results: [
              {
                title: 'One',
                url: 'https://parallel.example',
                description: 'first',
              },
            ],
          },
        }),
      });

      const client = new WebSearchClient({
        braveApiKey: 'test-key',
        rateLimitDelay: 0,
      });

      const firstPromise = client.search('parallel query');
      const secondPromise = client.search('parallel query');

      const [first, second] = await Promise.all([firstPromise, secondPromise]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(first.results[0].url).toBe('https://parallel.example');
      expect(second.results[0].url).toBe('https://parallel.example');
    });

    it('retries on 429 using retry-after/backoff', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            get: () => '1',
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            web: {
              results: [
                {
                  title: 'Retry success',
                  url: 'https://retry.example',
                  description: 'success',
                },
              ],
            },
          }),
        });

      const client = new WebSearchClient({
        braveApiKey: 'test-key',
        rateLimitDelay: 0,
        maxRetries: 1,
        retryBaseDelayMs: 100,
      });

      const searchPromise = client.search('retry query');
      await vi.advanceTimersByTimeAsync(1000);
      const result = await searchPromise;

      expect(result.results[0].url).toBe('https://retry.example');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('searchForProblem', () => {
    it('expands to additional queries when unique results are sparse', async () => {
      const client = new WebSearchClient({
        minUniqueResultsBeforeExpansion: 100,
      });

      const promise = client.searchForProblem('Need better expense tracking');

      // Advance timers for all mock searches
      await vi.advanceTimersByTimeAsync(5000);
      const results = await promise;

      // Should run through all available query variants
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('stops early when first query returns enough unique results', async () => {
      const client = new WebSearchClient({
        minUniqueResultsBeforeExpansion: 2,
      });

      const searchSpy = vi.spyOn(client, 'search');
      searchSpy.mockResolvedValueOnce({
        query: 'q1',
        provider: 'mock',
        searchedAt: new Date(),
        totalResults: 2,
        results: [
          { title: 'A', url: 'https://example.com/a', snippet: 'a', position: 1, domain: 'example.com' },
          { title: 'B', url: 'https://example.com/b', snippet: 'b', position: 2, domain: 'example.com' },
        ],
      });

      const results = await client.searchForProblem('Need better expense tracking');

      expect(results).toHaveLength(1);
      expect(searchSpy).toHaveBeenCalledTimes(1);
    });

    it('continues on individual query failure', async () => {
      // Use real timers for this test since it involves actual async behavior
      vi.useRealTimers();

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            organic_results: [{ title: 'Result', link: 'https://example.com', snippet: 'test' }],
          }),
        });

      const client = new WebSearchClient({
        serpApiKey: 'key',
        rateLimitDelay: 10,
        minUniqueResultsBeforeExpansion: 100,
      });

      const results = await client.searchForProblem('test problem');

      // Should have at least one result (from successful query)
      expect(results.length).toBeGreaterThanOrEqual(1);

      // Restore fake timers for other tests
      vi.useFakeTimers();
    }, 10000);
  });

  describe('deduplicateResults', () => {
    it('removes duplicate URLs', () => {
      const responses: SearchResponse[] = [
        {
          query: 'query 1',
          results: [
            { title: 'Result A', url: 'https://example.com/page', snippet: 'a', position: 1, domain: 'example.com' },
            { title: 'Result B', url: 'https://other.com/page', snippet: 'b', position: 2, domain: 'other.com' },
          ],
          totalResults: 2,
          searchedAt: new Date(),
          provider: 'mock',
        },
        {
          query: 'query 2',
          results: [
            { title: 'Duplicate A', url: 'https://example.com/page', snippet: 'dup', position: 1, domain: 'example.com' },
            { title: 'Result C', url: 'https://third.com/page', snippet: 'c', position: 2, domain: 'third.com' },
          ],
          totalResults: 2,
          searchedAt: new Date(),
          provider: 'mock',
        },
      ];

      const unique = WebSearchClient.deduplicateResults(responses);

      expect(unique).toHaveLength(3);
      const urls = unique.map(r => r.url);
      expect(new Set(urls).size).toBe(3);
    });

    it('normalizes URLs (removes trailing slash)', () => {
      const responses: SearchResponse[] = [
        {
          query: 'q1',
          results: [
            { title: 'A', url: 'https://example.com/page/', snippet: '', position: 1, domain: 'example.com' },
          ],
          totalResults: 1,
          searchedAt: new Date(),
          provider: 'mock',
        },
        {
          query: 'q2',
          results: [
            { title: 'B', url: 'https://example.com/page', snippet: '', position: 1, domain: 'example.com' },
          ],
          totalResults: 1,
          searchedAt: new Date(),
          provider: 'mock',
        },
      ];

      const unique = WebSearchClient.deduplicateResults(responses);
      expect(unique).toHaveLength(1);
    });

    it('is case-insensitive for URL comparison', () => {
      const responses: SearchResponse[] = [
        {
          query: 'q1',
          results: [
            { title: 'A', url: 'https://Example.COM/Page', snippet: '', position: 1, domain: 'example.com' },
          ],
          totalResults: 1,
          searchedAt: new Date(),
          provider: 'mock',
        },
        {
          query: 'q2',
          results: [
            { title: 'B', url: 'https://example.com/page', snippet: '', position: 1, domain: 'example.com' },
          ],
          totalResults: 1,
          searchedAt: new Date(),
          provider: 'mock',
        },
      ];

      const unique = WebSearchClient.deduplicateResults(responses);
      expect(unique).toHaveLength(1);
    });

    it('handles empty responses array', () => {
      const unique = WebSearchClient.deduplicateResults([]);
      expect(unique).toEqual([]);
    });

    it('handles responses with empty results', () => {
      const responses: SearchResponse[] = [
        { query: 'q', results: [], totalResults: 0, searchedAt: new Date(), provider: 'mock' },
      ];

      const unique = WebSearchClient.deduplicateResults(responses);
      expect(unique).toEqual([]);
    });

    it('preserves first occurrence when duplicates exist', () => {
      const responses: SearchResponse[] = [
        {
          query: 'q1',
          results: [
            { title: 'First Title', url: 'https://example.com', snippet: 'first', position: 1, domain: 'example.com' },
          ],
          totalResults: 1,
          searchedAt: new Date(),
          provider: 'mock',
        },
        {
          query: 'q2',
          results: [
            { title: 'Second Title', url: 'https://example.com', snippet: 'second', position: 1, domain: 'example.com' },
          ],
          totalResults: 1,
          searchedAt: new Date(),
          provider: 'mock',
        },
      ];

      const unique = WebSearchClient.deduplicateResults(responses);
      expect(unique[0].title).toBe('First Title');
    });
  });
});

describe('Domain Extraction', () => {
  it('extracts domain from search results correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          { title: 'Test', link: 'https://www.example.com/path', snippet: 'test', position: 1 },
          { title: 'Test2', link: 'https://sub.domain.org/page', snippet: 'test', position: 2 },
        ],
      }),
    });
    global.fetch = mockFetch;

    const client = new WebSearchClient({ serpApiKey: 'key' });
    const result = await client.search('test');

    // www. should be stripped
    expect(result.results[0].domain).toBe('example.com');
    expect(result.results[1].domain).toBe('sub.domain.org');
  });
});
