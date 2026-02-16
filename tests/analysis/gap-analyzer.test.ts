/**
 * Tests for the Gap Analysis Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Safety net: prevent any real HTTP calls to Anthropic API
// The competitor module (called by gap-analyzer) uses fetch() to call Anthropic
const mockFetch = vi.fn().mockRejectedValue(new Error('Real fetch called — test is missing a mock'));
vi.stubGlobal('fetch', mockFetch);

import { _resetConfigForTesting } from '../../src/config/env';
import type { RawPost } from '../../src/scrapers/types';
import type { ProblemCluster } from '../../src/analysis/deduplicator';
import {
  generateSearchQueries,
  WebSearchClient,
  type SearchResult,
  type SearchResponse,
} from '../../src/analysis/web-search';
import {
  filterProductResults,
  createFallbackAnalysis,
  calculateCompetitionScore,
  summarizeAnalysis,
  type Competitor,
  type CompetitorAnalysis,
} from '../../src/analysis/competitor';
import {
  analyzeGaps,
  analyzeAllGaps,
  filterByOpportunity,
  sortByOpportunity,
  getGapAnalysisStats,
  exportGapAnalyses,
  formatGapAnalysisMarkdown,
  type GapAnalysis,
} from '../../src/analysis/gap-analyzer';

const initialSerpApiKey = process.env.SERPAPI_KEY;
const initialBraveApiKey = process.env.BRAVE_API_KEY;

beforeEach(() => {
  mockFetch.mockClear();
  delete process.env.SERPAPI_KEY;
  delete process.env.BRAVE_API_KEY;
  _resetConfigForTesting();
  WebSearchClient.resetForTesting();
});

afterEach(() => {
  if (initialSerpApiKey !== undefined) {
    process.env.SERPAPI_KEY = initialSerpApiKey;
  } else {
    delete process.env.SERPAPI_KEY;
  }

  if (initialBraveApiKey !== undefined) {
    process.env.BRAVE_API_KEY = initialBraveApiKey;
  } else {
    delete process.env.BRAVE_API_KEY;
  }

  _resetConfigForTesting();
  WebSearchClient.resetForTesting();
});

// Helper to create mock posts
function createMockPost(overrides: Partial<RawPost> = {}): RawPost {
  return {
    id: `post_${Math.random().toString(36).slice(2, 8)}`,
    source: 'reddit',
    sourceId: 'abc123',
    title: 'Test post title',
    body: 'Test post body content',
    url: 'https://reddit.com/r/test/123',
    author: 'testuser',
    score: 100,
    commentCount: 25,
    createdAt: new Date(),
    scrapedAt: new Date(),
    signals: [],
    ...overrides,
  };
}

// Helper to create mock problem clusters
function createMockCluster(overrides: Partial<ProblemCluster> = {}): ProblemCluster {
  return {
    id: `cluster_${Math.random().toString(36).slice(2, 8)}`,
    representativePost: createMockPost(),
    relatedPosts: [],
    frequency: 5,
    totalScore: 500,
    embedding: [],
    problemStatement: 'Users need a better way to manage their time and tasks',
    sources: ['reddit', 'hn'],
    ...overrides,
  };
}

// Helper to create mock search results
function createMockSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    title: 'Test Product - Best Solution',
    url: 'https://example.com/product',
    snippet: 'A great solution for managing tasks and productivity...',
    position: 1,
    domain: 'example.com',
    ...overrides,
  };
}

// Helper to create mock competitor
function createMockCompetitor(overrides: Partial<Competitor> = {}): Competitor {
  return {
    name: 'TestProduct',
    url: 'https://testproduct.com',
    description: 'A product for testing',
    pricing: 'freemium',
    strengths: ['Easy to use', 'Good integrations'],
    weaknesses: ['Limited features', 'No mobile app'],
    ...overrides,
  };
}

// Helper to create mock gap analysis
function createMockGapAnalysis(overrides: Partial<GapAnalysis> = {}): GapAnalysis {
  return {
    problemId: 'cluster_123',
    problemStatement: 'Users need better task management',
    searchQueries: ['task management tool'],
    existingSolutions: [createMockCompetitor()],
    gaps: ['No AI integration', 'Poor mobile experience'],
    marketOpportunity: 'medium',
    differentiationAngles: ['Focus on AI', 'Better UX'],
    recommendation: 'VIABLE WITH DIFFERENTIATION',
    competitionScore: 45,
    analysisNotes: 'Market has room for differentiation',
    analyzedAt: new Date(),
    ...overrides,
  };
}

describe('Web Search Module', () => {
  describe('generateSearchQueries', () => {
    it('generates 2-3 queries from problem statement', () => {
      const queries = generateSearchQueries('Users need a better way to manage time');
      expect(queries.length).toBeGreaterThanOrEqual(2);
      expect(queries.length).toBeLessThanOrEqual(3);
    });

    it('includes solution/tool keywords in first query', () => {
      const queries = generateSearchQueries('Need to track expenses easily');
      expect(queries[0]).toMatch(/tool|solution|app/i);
    });

    it('includes alternatives keyword in second query', () => {
      const queries = generateSearchQueries('Need to track expenses easily');
      expect(queries[1]).toMatch(/alternative/i);
    });

    it('handles short problem statements', () => {
      const queries = generateSearchQueries('Track time');
      expect(queries.length).toBeGreaterThanOrEqual(2);
    });

    it('handles long problem statements', () => {
      const longStatement = 'Users are frustrated with the lack of integration between their calendar and task management tools and wish there was a unified solution that could sync everything automatically';
      const queries = generateSearchQueries(longStatement);
      expect(queries.length).toBe(3);
    });
  });

  describe('WebSearchClient', () => {
    let origSerpKey: string | undefined;
    let origBraveKey: string | undefined;

    beforeEach(() => {
      origSerpKey = process.env.SERPAPI_KEY;
      origBraveKey = process.env.BRAVE_API_KEY;
      delete process.env.SERPAPI_KEY;
      delete process.env.BRAVE_API_KEY;
      _resetConfigForTesting();
    });

    afterEach(() => {
      if (origSerpKey !== undefined) process.env.SERPAPI_KEY = origSerpKey;
      if (origBraveKey !== undefined) process.env.BRAVE_API_KEY = origBraveKey;
      _resetConfigForTesting();
    });

    it('defaults to mock provider without API keys', () => {
      const client = new WebSearchClient();
      expect(client.getActiveProvider()).toBe('mock');
    });

    it('uses serpapi when key is provided', () => {
      const client = new WebSearchClient({ serpApiKey: 'test-key', provider: 'serpapi' });
      expect(client.getActiveProvider()).toBe('serpapi');
    });

    it('uses brave when key is provided', () => {
      const client = new WebSearchClient({ braveApiKey: 'test-key', provider: 'brave' });
      expect(client.getActiveProvider()).toBe('brave');
    });

    it('returns mock results', async () => {
      const client = new WebSearchClient();
      const response = await client.search('task management');

      expect(response.query).toBe('task management');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.provider).toBe('mock');
    });

    it('deduplicates results from multiple searches', () => {
      const responses: SearchResponse[] = [
        {
          query: 'query1',
          results: [
            createMockSearchResult({ url: 'https://example.com/a' }),
            createMockSearchResult({ url: 'https://example.com/b' }),
          ],
          totalResults: 2,
          searchedAt: new Date(),
          provider: 'mock',
        },
        {
          query: 'query2',
          results: [
            createMockSearchResult({ url: 'https://example.com/a' }), // duplicate
            createMockSearchResult({ url: 'https://example.com/c' }),
          ],
          totalResults: 2,
          searchedAt: new Date(),
          provider: 'mock',
        },
      ];

      const unique = WebSearchClient.deduplicateResults(responses);
      expect(unique.length).toBe(3); // a, b, c
    });

    it('handles URL variations in deduplication', () => {
      const responses: SearchResponse[] = [
        {
          query: 'query1',
          results: [
            createMockSearchResult({ url: 'https://example.com/page/' }),
            createMockSearchResult({ url: 'https://EXAMPLE.com/page' }), // same, different case
          ],
          totalResults: 2,
          searchedAt: new Date(),
          provider: 'mock',
        },
      ];

      const unique = WebSearchClient.deduplicateResults(responses);
      expect(unique.length).toBe(1);
    });
  });
});

describe('Competitor Analysis Module', () => {
  describe('filterProductResults', () => {
    it('keeps results from product listing sites', () => {
      const results = [
        createMockSearchResult({ domain: 'producthunt.com' }),
        createMockSearchResult({ domain: 'capterra.com' }),
        createMockSearchResult({ domain: 'g2.com' }),
      ];

      const filtered = filterProductResults(results);
      expect(filtered.length).toBe(3);
    });

    it('excludes social and discussion sites', () => {
      const results = [
        createMockSearchResult({ domain: 'reddit.com' }),
        createMockSearchResult({ domain: 'stackoverflow.com' }),
        createMockSearchResult({ domain: 'twitter.com' }),
        createMockSearchResult({ domain: 'producthunt.com' }),
      ];

      const filtered = filterProductResults(results);
      expect(filtered.length).toBe(1);
      expect(filtered[0].domain).toBe('producthunt.com');
    });

    it('includes results with product indicators', () => {
      const results = [
        createMockSearchResult({
          domain: 'someapp.com',
          title: 'SomeApp - Pricing and Features',
        }),
        createMockSearchResult({
          domain: 'random.com',
          title: 'Random Blog Post',
          snippet: 'Just a blog post',
        }),
      ];

      const filtered = filterProductResults(results);
      expect(filtered.length).toBe(1);
      expect(filtered[0].domain).toBe('someapp.com');
    });
  });

  describe('createFallbackAnalysis', () => {
    it('extracts competitors from results', () => {
      const results = [
        createMockSearchResult({ title: 'Asana - Project Management', domain: 'asana.com' }),
        createMockSearchResult({ title: 'Trello - Visual Boards', domain: 'trello.com' }),
      ];

      const analysis = createFallbackAnalysis(results);
      expect(analysis.competitors.length).toBe(2);
    });

    it('sets high opportunity for few results', () => {
      const results = [createMockSearchResult()];
      const analysis = createFallbackAnalysis(results);
      expect(analysis.marketOpportunity).toBe('high');
    });

    it('sets medium opportunity for moderate results', () => {
      const results = Array(4).fill(null).map(() =>
        createMockSearchResult({ domain: 'producthunt.com' })
      );
      const analysis = createFallbackAnalysis(results);
      expect(analysis.marketOpportunity).toBe('medium');
    });

    it('sets saturated for many results', () => {
      const results = Array(10).fill(null).map(() =>
        createMockSearchResult({ domain: 'producthunt.com' })
      );
      const analysis = createFallbackAnalysis(results);
      expect(analysis.marketOpportunity).toBe('saturated');
    });
  });

  describe('calculateCompetitionScore', () => {
    it('returns 0 for no competitors and high opportunity', () => {
      const analysis: CompetitorAnalysis = {
        competitors: [],
        gaps: [],
        marketOpportunity: 'high',
        differentiationAngles: [],
        analysisNotes: '',
      };
      expect(calculateCompetitionScore(analysis)).toBe(0);
    });

    it('increases score with more competitors', () => {
      const base: CompetitorAnalysis = {
        competitors: [createMockCompetitor()],
        gaps: [],
        marketOpportunity: 'high',
        differentiationAngles: [],
        analysisNotes: '',
      };

      const moreCompetitors: CompetitorAnalysis = {
        ...base,
        competitors: [
          createMockCompetitor(),
          createMockCompetitor(),
          createMockCompetitor(),
        ],
      };

      const baseScore = calculateCompetitionScore(base);
      const moreScore = calculateCompetitionScore(moreCompetitors);
      expect(moreScore).toBeGreaterThan(baseScore);
    });

    it('increases score for saturated market', () => {
      const highOpp: CompetitorAnalysis = {
        competitors: [createMockCompetitor()],
        gaps: [],
        marketOpportunity: 'high',
        differentiationAngles: [],
        analysisNotes: '',
      };

      const saturated: CompetitorAnalysis = {
        ...highOpp,
        marketOpportunity: 'saturated',
      };

      expect(calculateCompetitionScore(saturated)).toBeGreaterThan(
        calculateCompetitionScore(highOpp)
      );
    });

    it('caps at 100', () => {
      const analysis: CompetitorAnalysis = {
        competitors: Array(10).fill(null).map(() => createMockCompetitor()),
        gaps: [],
        marketOpportunity: 'saturated',
        differentiationAngles: [],
        analysisNotes: '',
      };
      expect(calculateCompetitionScore(analysis)).toBe(100);
    });
  });

  describe('summarizeAnalysis', () => {
    it('includes market opportunity', () => {
      const analysis: CompetitorAnalysis = {
        competitors: [createMockCompetitor()],
        gaps: ['Gap 1'],
        marketOpportunity: 'high',
        differentiationAngles: ['Angle 1'],
        analysisNotes: 'Notes',
      };

      const summary = summarizeAnalysis(analysis);
      expect(summary).toContain('HIGH');
    });

    it('lists competitors', () => {
      const analysis: CompetitorAnalysis = {
        competitors: [createMockCompetitor({ name: 'TestApp' })],
        gaps: [],
        marketOpportunity: 'medium',
        differentiationAngles: [],
        analysisNotes: '',
      };

      const summary = summarizeAnalysis(analysis);
      expect(summary).toContain('TestApp');
    });

    it('lists gaps', () => {
      const analysis: CompetitorAnalysis = {
        competitors: [],
        gaps: ['Missing feature X', 'Poor mobile support'],
        marketOpportunity: 'medium',
        differentiationAngles: [],
        analysisNotes: '',
      };

      const summary = summarizeAnalysis(analysis);
      expect(summary).toContain('Missing feature X');
    });
  });
});

describe('Gap Analyzer Module', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('analyzeGaps', () => {
    it('skips analysis for low frequency problems', async () => {
      const cluster = createMockCluster({ frequency: 1 });

      const result = await analyzeGaps(cluster, {
        skipSearchForLowFrequency: true,
        minFrequencyForSearch: 2,
      });

      expect(result.recommendation).toContain('SKIPPED');
      expect(result.searchQueries.length).toBe(0);
    });

    it('analyzes problems above frequency threshold', async () => {
      const cluster = createMockCluster({ frequency: 5 });

      const result = await analyzeGaps(cluster, {
        skipSearchForLowFrequency: true,
        minFrequencyForSearch: 2,
      });

      expect(result.recommendation).not.toContain('SKIPPED');
      expect(result.problemId).toBe(cluster.id);
      expect(result.problemStatement).toBe(cluster.problemStatement);
    });

    it('returns complete GapAnalysis structure', async () => {
      const cluster = createMockCluster();
      const result = await analyzeGaps(cluster);

      expect(result).toHaveProperty('problemId');
      expect(result).toHaveProperty('problemStatement');
      expect(result).toHaveProperty('searchQueries');
      expect(result).toHaveProperty('existingSolutions');
      expect(result).toHaveProperty('gaps');
      expect(result).toHaveProperty('marketOpportunity');
      expect(result).toHaveProperty('differentiationAngles');
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('competitionScore');
      expect(result).toHaveProperty('analyzedAt');
    });
  });

  describe('analyzeAllGaps', () => {
    it('processes all clusters', async () => {
      const clusters = [
        createMockCluster({ id: 'cluster1', frequency: 5 }),
        createMockCluster({ id: 'cluster2', frequency: 3 }),
      ];

      const results = await analyzeAllGaps(clusters);

      expect(results.length).toBe(2);
      expect(results[0].problemId).toBe('cluster1');
      expect(results[1].problemId).toBe('cluster2');
    });

    it('handles errors gracefully', async () => {
      const clusters = [
        createMockCluster({ id: 'cluster1' }),
      ];

      // Should not throw, even with mock provider
      const results = await analyzeAllGaps(clusters);
      expect(results.length).toBe(1);
    });
  });

  describe('filterByOpportunity', () => {
    it('filters by high opportunity', () => {
      const analyses = [
        createMockGapAnalysis({ marketOpportunity: 'high' }),
        createMockGapAnalysis({ marketOpportunity: 'medium' }),
        createMockGapAnalysis({ marketOpportunity: 'low' }),
        createMockGapAnalysis({ marketOpportunity: 'saturated' }),
      ];

      const filtered = filterByOpportunity(analyses, 'high');
      expect(filtered.length).toBe(1);
      expect(filtered[0].marketOpportunity).toBe('high');
    });

    it('filters by medium and above', () => {
      const analyses = [
        createMockGapAnalysis({ marketOpportunity: 'high' }),
        createMockGapAnalysis({ marketOpportunity: 'medium' }),
        createMockGapAnalysis({ marketOpportunity: 'low' }),
        createMockGapAnalysis({ marketOpportunity: 'saturated' }),
      ];

      const filtered = filterByOpportunity(analyses, 'medium');
      expect(filtered.length).toBe(2);
    });

    it('returns all for saturated filter', () => {
      const analyses = [
        createMockGapAnalysis({ marketOpportunity: 'high' }),
        createMockGapAnalysis({ marketOpportunity: 'saturated' }),
      ];

      const filtered = filterByOpportunity(analyses, 'saturated');
      expect(filtered.length).toBe(2);
    });
  });

  describe('sortByOpportunity', () => {
    it('sorts by market opportunity descending', () => {
      const analyses = [
        createMockGapAnalysis({ problemId: 'low', marketOpportunity: 'low' }),
        createMockGapAnalysis({ problemId: 'high', marketOpportunity: 'high' }),
        createMockGapAnalysis({ problemId: 'medium', marketOpportunity: 'medium' }),
      ];

      const sorted = sortByOpportunity(analyses);
      expect(sorted[0].problemId).toBe('high');
      expect(sorted[1].problemId).toBe('medium');
      expect(sorted[2].problemId).toBe('low');
    });

    it('uses competition score as tiebreaker', () => {
      const analyses = [
        createMockGapAnalysis({ problemId: 'a', marketOpportunity: 'high', competitionScore: 50 }),
        createMockGapAnalysis({ problemId: 'b', marketOpportunity: 'high', competitionScore: 30 }),
        createMockGapAnalysis({ problemId: 'c', marketOpportunity: 'high', competitionScore: 40 }),
      ];

      const sorted = sortByOpportunity(analyses);
      expect(sorted[0].problemId).toBe('b'); // lowest competition
      expect(sorted[1].problemId).toBe('c');
      expect(sorted[2].problemId).toBe('a'); // highest competition
    });
  });

  describe('getGapAnalysisStats', () => {
    it('calculates statistics correctly', () => {
      const analyses = [
        createMockGapAnalysis({ marketOpportunity: 'high', competitionScore: 20 }),
        createMockGapAnalysis({ marketOpportunity: 'high', competitionScore: 30 }),
        createMockGapAnalysis({ marketOpportunity: 'medium', competitionScore: 50 }),
      ];

      const stats = getGapAnalysisStats(analyses);

      expect(stats.total).toBe(3);
      expect(stats.byOpportunity.high).toBe(2);
      expect(stats.byOpportunity.medium).toBe(1);
      expect(stats.byOpportunity.low).toBe(0);
      expect(stats.averageCompetitionScore).toBeCloseTo(33.33, 1);
    });

    it('returns top opportunities', () => {
      const analyses = [
        createMockGapAnalysis({ problemId: 'a', marketOpportunity: 'low' }),
        createMockGapAnalysis({ problemId: 'b', marketOpportunity: 'high' }),
        createMockGapAnalysis({ problemId: 'c', marketOpportunity: 'medium' }),
      ];

      const stats = getGapAnalysisStats(analyses);
      expect(stats.topOpportunities[0].id).toBe('b');
    });

    it('handles empty input', () => {
      const stats = getGapAnalysisStats([]);
      expect(stats.total).toBe(0);
      expect(stats.averageCompetitionScore).toBe(0);
    });
  });

  describe('exportGapAnalyses', () => {
    it('exports to valid JSON', () => {
      const analyses = [createMockGapAnalysis()];
      const json = exportGapAnalyses(analyses);
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty('problemId');
      expect(parsed[0]).toHaveProperty('marketOpportunity');
      expect(parsed[0]).toHaveProperty('competitionScore');
    });

    it('includes analysis metadata', () => {
      const analyses = [
        createMockGapAnalysis({
          existingSolutions: [createMockCompetitor(), createMockCompetitor()],
          gaps: ['gap1', 'gap2', 'gap3'],
        }),
      ];

      const json = exportGapAnalyses(analyses);
      const parsed = JSON.parse(json);

      expect(parsed[0].competitorCount).toBe(2);
      expect(parsed[0].gapCount).toBe(3);
    });
  });

  describe('formatGapAnalysisMarkdown', () => {
    it('includes problem statement as header', () => {
      const analysis = createMockGapAnalysis({
        problemStatement: 'Need better testing tools',
      });

      const md = formatGapAnalysisMarkdown(analysis);
      expect(md).toContain('## Need better testing tools');
    });

    it('includes market opportunity', () => {
      const analysis = createMockGapAnalysis({ marketOpportunity: 'high' });
      const md = formatGapAnalysisMarkdown(analysis);
      expect(md).toContain('HIGH');
    });

    it('lists competitors', () => {
      const analysis = createMockGapAnalysis({
        existingSolutions: [createMockCompetitor({ name: 'AwesomeTool' })],
      });

      const md = formatGapAnalysisMarkdown(analysis);
      expect(md).toContain('AwesomeTool');
    });

    it('lists gaps', () => {
      const analysis = createMockGapAnalysis({
        gaps: ['Missing AI features', 'No API'],
      });

      const md = formatGapAnalysisMarkdown(analysis);
      expect(md).toContain('Missing AI features');
      expect(md).toContain('No API');
    });

    it('includes recommendation', () => {
      const analysis = createMockGapAnalysis({
        recommendation: 'STRONG OPPORTUNITY: Build it now!',
      });

      const md = formatGapAnalysisMarkdown(analysis);
      expect(md).toContain('STRONG OPPORTUNITY');
    });
  });
});

describe('Batch Processing', () => {
  it('analyzeAllGaps uses batch competitor analysis', async () => {
    // Create multiple clusters
    const clusters = Array(5).fill(null).map((_, i) =>
      createMockCluster({
        id: `cluster_${i}`,
        problemStatement: `Problem ${i}`,
        frequency: 5, // Above threshold
      })
    );

    const results = await analyzeAllGaps(clusters, {
      skipSearchForLowFrequency: true,
      minFrequencyForSearch: 2,
      webSearch: { rateLimitDelay: 0 }, // Speed up tests
    });

    // All should be analyzed
    expect(results.length).toBe(5);
    expect(results.every(r => r.problemId.startsWith('cluster_'))).toBe(true);
  }, 30000); // Increased timeout

  it('skips low-frequency problems in batch processing', async () => {
    const clusters = [
      createMockCluster({ id: 'high_freq', frequency: 10 }),
      createMockCluster({ id: 'low_freq', frequency: 1 }),
    ];

    const results = await analyzeAllGaps(clusters, {
      skipSearchForLowFrequency: true,
      minFrequencyForSearch: 5,
    });

    expect(results.length).toBe(2);

    const highFreq = results.find(r => r.problemId === 'high_freq');
    const lowFreq = results.find(r => r.problemId === 'low_freq');

    expect(highFreq?.recommendation).not.toContain('SKIPPED');
    expect(lowFreq?.recommendation).toContain('SKIPPED');
  });

  it('handles mixed frequency clusters correctly', async () => {
    const clusters = [
      createMockCluster({ id: 'c1', frequency: 10 }),
      createMockCluster({ id: 'c2', frequency: 1 }),
      createMockCluster({ id: 'c3', frequency: 8 }),
      createMockCluster({ id: 'c4', frequency: 2 }),
    ];

    const results = await analyzeAllGaps(clusters, {
      skipSearchForLowFrequency: true,
      minFrequencyForSearch: 3,
    });

    expect(results.length).toBe(4);

    // c1 and c3 should be analyzed (freq >= 3)
    const analyzed = results.filter(r => !r.recommendation.includes('SKIPPED'));
    const skipped = results.filter(r => r.recommendation.includes('SKIPPED'));

    expect(analyzed.length).toBe(2);
    expect(skipped.length).toBe(2);
  });
});

describe('Integration', () => {
  it('full pipeline: cluster -> gap analysis -> stats', async () => {
    const clusters = [
      createMockCluster({
        id: 'cluster1',
        problemStatement: 'Need better project management for remote teams',
        frequency: 10,
      }),
      createMockCluster({
        id: 'cluster2',
        problemStatement: 'Looking for a simple invoice generator',
        frequency: 5,
      }),
    ];

    // Analyze all gaps
    const analyses = await analyzeAllGaps(clusters);
    expect(analyses.length).toBe(2);

    // Get statistics
    const stats = getGapAnalysisStats(analyses);
    expect(stats.total).toBe(2);

    // Sort by opportunity
    const sorted = sortByOpportunity(analyses);
    expect(sorted.length).toBe(2);

    // Export to JSON
    const json = exportGapAnalyses(analyses);
    expect(() => JSON.parse(json)).not.toThrow();

    // Format markdown
    const md = formatGapAnalysisMarkdown(analyses[0]);
    expect(md).toContain(analyses[0].problemStatement);
  });
});
