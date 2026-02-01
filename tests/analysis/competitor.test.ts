/**
 * Tests for the Competitor Analysis Module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  filterProductResults,
  createFallbackAnalysis,
  analyzeCompetitors,
  analyzeCompetitorsBatch,
  calculateCompetitionScore,
  summarizeAnalysis,
  type CompetitorAnalysis,
} from '../../src/analysis/competitor';
import type { SearchResult } from '../../src/analysis/web-search';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock search results
function createMockResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    title: 'Test Result',
    url: 'https://example.com/page',
    snippet: 'This is a test snippet',
    position: 1,
    domain: 'example.com',
    ...overrides,
  };
}

describe('filterProductResults', () => {
  it('returns empty array for empty input', () => {
    expect(filterProductResults([])).toEqual([]);
  });

  it('includes results from product listing sites', () => {
    const results: SearchResult[] = [
      createMockResult({ domain: 'producthunt.com', title: 'Product A' }),
      createMockResult({ domain: 'capterra.com', title: 'Product B' }),
      createMockResult({ domain: 'g2.com', title: 'Product C' }),
      createMockResult({ domain: 'alternativeto.net', title: 'Product D' }),
    ];

    const filtered = filterProductResults(results);
    expect(filtered).toHaveLength(4);
  });

  it('excludes social media and discussion sites', () => {
    const results: SearchResult[] = [
      createMockResult({ domain: 'reddit.com', title: 'Reddit Thread' }),
      createMockResult({ domain: 'twitter.com', title: 'Tweet' }),
      createMockResult({ domain: 'stackoverflow.com', title: 'Question' }),
      createMockResult({ domain: 'quora.com', title: 'Answer' }),
      createMockResult({ domain: 'youtube.com', title: 'Video' }),
      createMockResult({ domain: 'facebook.com', title: 'Post' }),
      createMockResult({ domain: 'linkedin.com', title: 'Article' }),
      createMockResult({ domain: 'wikipedia.org', title: 'Article' }),
    ];

    const filtered = filterProductResults(results);
    expect(filtered).toHaveLength(0);
  });

  it('includes results with product indicators in title', () => {
    const results: SearchResult[] = [
      createMockResult({ domain: 'saas.app', title: 'Pricing Plans - Best Tracker' }),
      createMockResult({ domain: 'tool.io', title: 'Features - Awesome Tool' }),
      createMockResult({ domain: 'demo.com', title: 'Try Free Demo Today' }),
    ];

    const filtered = filterProductResults(results);
    expect(filtered).toHaveLength(3);
  });

  it('includes results with product indicators in snippet', () => {
    const results: SearchResult[] = [
      createMockResult({
        domain: 'startup.io',
        title: 'Generic Title',
        snippet: 'Sign up for our free trial today',
      }),
      createMockResult({
        domain: 'platform.app',
        title: 'Another Title',
        snippet: 'The best software platform for teams',
      }),
    ];

    const filtered = filterProductResults(results);
    expect(filtered).toHaveLength(2);
  });

  it('handles case-insensitive domain matching', () => {
    const results: SearchResult[] = [
      createMockResult({ domain: 'ProductHunt.com' }),
      createMockResult({ domain: 'CAPTERRA.COM' }),
    ];

    const filtered = filterProductResults(results);
    expect(filtered).toHaveLength(2);
  });

  it('handles case-insensitive indicator matching', () => {
    const results: SearchResult[] = [
      createMockResult({ domain: 'new.io', title: 'PRICING FOR ENTERPRISE' }),
      createMockResult({ domain: 'app.io', title: 'FREE TRIAL AVAILABLE' }),
    ];

    const filtered = filterProductResults(results);
    expect(filtered).toHaveLength(2);
  });

  it('excludes results without product indicators', () => {
    const results: SearchResult[] = [
      createMockResult({
        domain: 'blog.random.com',
        title: 'My Personal Blog Post',
        snippet: 'Just sharing some thoughts about life',
      }),
    ];

    const filtered = filterProductResults(results);
    expect(filtered).toHaveLength(0);
  });
});

describe('createFallbackAnalysis', () => {
  it('extracts competitors from product results', () => {
    const results: SearchResult[] = [
      createMockResult({ domain: 'producthunt.com', title: 'Acme Tool - Best Tracker', snippet: 'Track everything' }),
      createMockResult({ domain: 'g2.com', title: 'Beta App | Reviews', snippet: 'Great for teams' }),
    ];

    const analysis = createFallbackAnalysis(results);

    expect(analysis.competitors).toHaveLength(2);
    expect(analysis.competitors[0].name).toBe('Acme Tool');
    expect(analysis.competitors[1].name).toBe('Beta App');
  });

  it('limits competitors to 5', () => {
    const results: SearchResult[] = Array(10)
      .fill(null)
      .map((_, i) => createMockResult({
        domain: 'producthunt.com',
        title: `Product ${i + 1} - Description`,
      }));

    const analysis = createFallbackAnalysis(results);
    expect(analysis.competitors.length).toBeLessThanOrEqual(5);
  });

  it('sets market opportunity based on competitor count', () => {
    // 0-2 competitors = high
    const fewResults = [
      createMockResult({ domain: 'producthunt.com', title: 'Only Product' }),
    ];
    expect(createFallbackAnalysis(fewResults).marketOpportunity).toBe('high');

    // 3-5 competitors = medium
    const mediumResults = Array(4).fill(null).map((_, i) =>
      createMockResult({ domain: 'producthunt.com', title: `Product ${i}` })
    );
    expect(createFallbackAnalysis(mediumResults).marketOpportunity).toBe('medium');

    // 6-8 competitors = low
    const moreResults = Array(7).fill(null).map((_, i) =>
      createMockResult({ domain: 'producthunt.com', title: `Product ${i}` })
    );
    expect(createFallbackAnalysis(moreResults).marketOpportunity).toBe('low');

    // 9+ competitors = saturated
    const manyResults = Array(10).fill(null).map((_, i) =>
      createMockResult({ domain: 'producthunt.com', title: `Product ${i}` })
    );
    expect(createFallbackAnalysis(manyResults).marketOpportunity).toBe('saturated');
  });

  it('includes default gaps and differentiation angles', () => {
    const analysis = createFallbackAnalysis([]);

    expect(analysis.gaps).toContain('Further analysis needed - AI not available');
    expect(analysis.differentiationAngles).toContain('Requires manual competitive analysis');
  });

  it('truncates description to 200 chars', () => {
    const longSnippet = 'x'.repeat(500);
    const results = [
      createMockResult({ domain: 'producthunt.com', title: 'Test', snippet: longSnippet }),
    ];

    const analysis = createFallbackAnalysis(results);
    expect(analysis.competitors[0].description.length).toBeLessThanOrEqual(200);
  });

  it('sets pricing to unknown', () => {
    const results = [
      createMockResult({ domain: 'producthunt.com', title: 'Test Product' }),
    ];

    const analysis = createFallbackAnalysis(results);
    expect(analysis.competitors[0].pricing).toBe('unknown');
  });

  it('handles title parsing with different separators', () => {
    const results: SearchResult[] = [
      createMockResult({ domain: 'producthunt.com', title: 'Product A - Description' }),
      createMockResult({ domain: 'g2.com', title: 'Product B | Reviews' }),
      createMockResult({ domain: 'capterra.com', title: 'Product C: Features' }),
      createMockResult({ domain: 'alternativeto.net', title: 'Product D – Alternative' }),
    ];

    const analysis = createFallbackAnalysis(results);

    expect(analysis.competitors[0].name).toBe('Product A');
    expect(analysis.competitors[1].name).toBe('Product B');
    expect(analysis.competitors[2].name).toBe('Product C');
    expect(analysis.competitors[3].name).toBe('Product D');
  });
});

describe('analyzeCompetitors', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns fallback analysis when no API key', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const results: SearchResult[] = [
      createMockResult({ domain: 'producthunt.com', title: 'Test Product' }),
    ];

    const analysis = await analyzeCompetitors('test problem', results);

    expect(analysis.differentiationAngles).toContain('Requires manual competitive analysis');

    warnSpy.mockRestore();
  });

  it('calls Anthropic API with correct parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          type: 'text',
          text: JSON.stringify({
            competitors: [],
            gaps: ['Gap 1'],
            marketOpportunity: 'high',
            differentiationAngles: ['Angle 1'],
            analysisNotes: 'Test notes',
          }),
        }],
      }),
    });

    const results: SearchResult[] = [
      createMockResult({ title: 'Competitor 1' }),
    ];

    await analyzeCompetitors('test problem', results, {
      anthropicApiKey: 'test-key',
      model: 'claude-3-5-haiku-20241022',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('test-key');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('claude-3-5-haiku-20241022');
    expect(body.system).toContain('market research');
    expect(body.messages[0].content).toContain('test problem');
  });

  it('parses valid JSON response from Anthropic', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          type: 'text',
          text: JSON.stringify({
            competitors: [{
              name: 'Competitor X',
              url: 'https://x.com',
              description: 'Does things',
              pricing: 'freemium',
              strengths: ['Fast', 'Easy'],
              weaknesses: ['Limited'],
            }],
            gaps: ['Need for speed'],
            marketOpportunity: 'medium',
            differentiationAngles: ['Better UX'],
            analysisNotes: 'Good opportunity',
          }),
        }],
      }),
    });

    const analysis = await analyzeCompetitors('problem', [], { anthropicApiKey: 'key' });

    expect(analysis.competitors).toHaveLength(1);
    expect(analysis.competitors[0].name).toBe('Competitor X');
    expect(analysis.competitors[0].strengths).toContain('Fast');
    expect(analysis.gaps).toContain('Need for speed');
    expect(analysis.marketOpportunity).toBe('medium');
  });

  it('handles JSON wrapped in markdown code blocks', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          type: 'text',
          text: '```json\n{"competitors":[],"gaps":[],"marketOpportunity":"low","differentiationAngles":[],"analysisNotes":"test"}\n```',
        }],
      }),
    });

    const analysis = await analyzeCompetitors('problem', [], { anthropicApiKey: 'key' });
    expect(analysis.marketOpportunity).toBe('low');
  });

  it('returns fallback on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const analysis = await analyzeCompetitors('problem', [], { anthropicApiKey: 'key' });

    expect(analysis.differentiationAngles).toContain('Requires manual competitive analysis');

    warnSpy.mockRestore();
  });

  it('returns fallback on empty response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '' }],
      }),
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const analysis = await analyzeCompetitors('problem', [], { anthropicApiKey: 'key' });

    expect(analysis.differentiationAngles).toContain('Requires manual competitive analysis');

    warnSpy.mockRestore();
  });

  it('normalizes invalid market opportunity values', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          type: 'text',
          text: JSON.stringify({
            competitors: [],
            gaps: [],
            marketOpportunity: 'invalid-value',
            differentiationAngles: [],
            analysisNotes: '',
          }),
        }],
      }),
    });

    const analysis = await analyzeCompetitors('problem', [], { anthropicApiKey: 'key' });
    expect(analysis.marketOpportunity).toBe('medium'); // Default fallback
  });

  it('uses environment variable for API key', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          type: 'text',
          text: JSON.stringify({
            competitors: [],
            gaps: [],
            marketOpportunity: 'high',
            differentiationAngles: [],
            analysisNotes: '',
          }),
        }],
      }),
    });

    await analyzeCompetitors('problem', []);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['x-api-key']).toBe('env-key');
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

  it('adds 15 points per competitor up to 60', () => {
    const baseAnalysis: CompetitorAnalysis = {
      competitors: [],
      gaps: [],
      marketOpportunity: 'high',
      differentiationAngles: [],
      analysisNotes: '',
    };

    // 1 competitor = 15
    expect(calculateCompetitionScore({
      ...baseAnalysis,
      competitors: [{ name: 'A', url: '', description: '', pricing: '', strengths: [], weaknesses: [] }],
    })).toBe(15);

    // 2 competitors = 30
    expect(calculateCompetitionScore({
      ...baseAnalysis,
      competitors: [
        { name: 'A', url: '', description: '', pricing: '', strengths: [], weaknesses: [] },
        { name: 'B', url: '', description: '', pricing: '', strengths: [], weaknesses: [] },
      ],
    })).toBe(30);

    // 4 competitors = 60 (capped)
    expect(calculateCompetitionScore({
      ...baseAnalysis,
      competitors: Array(4).fill({ name: 'X', url: '', description: '', pricing: '', strengths: [], weaknesses: [] }),
    })).toBe(60);

    // 5 competitors = still 60 (capped)
    expect(calculateCompetitionScore({
      ...baseAnalysis,
      competitors: Array(5).fill({ name: 'X', url: '', description: '', pricing: '', strengths: [], weaknesses: [] }),
    })).toBe(60);
  });

  it('adds points based on market opportunity', () => {
    const baseAnalysis: CompetitorAnalysis = {
      competitors: [],
      gaps: [],
      marketOpportunity: 'high',
      differentiationAngles: [],
      analysisNotes: '',
    };

    expect(calculateCompetitionScore({ ...baseAnalysis, marketOpportunity: 'high' })).toBe(0);
    expect(calculateCompetitionScore({ ...baseAnalysis, marketOpportunity: 'medium' })).toBe(10);
    expect(calculateCompetitionScore({ ...baseAnalysis, marketOpportunity: 'low' })).toBe(25);
    expect(calculateCompetitionScore({ ...baseAnalysis, marketOpportunity: 'saturated' })).toBe(40);
  });

  it('combines competitor and opportunity scores', () => {
    const analysis: CompetitorAnalysis = {
      competitors: [
        { name: 'A', url: '', description: '', pricing: '', strengths: [], weaknesses: [] },
        { name: 'B', url: '', description: '', pricing: '', strengths: [], weaknesses: [] },
      ],
      gaps: [],
      marketOpportunity: 'low',
      differentiationAngles: [],
      analysisNotes: '',
    };

    // 2 competitors (30) + low (25) = 55
    expect(calculateCompetitionScore(analysis)).toBe(55);
  });

  it('caps at 100', () => {
    const analysis: CompetitorAnalysis = {
      competitors: Array(5).fill({ name: 'X', url: '', description: '', pricing: '', strengths: [], weaknesses: [] }),
      gaps: [],
      marketOpportunity: 'saturated',
      differentiationAngles: [],
      analysisNotes: '',
    };

    // 5 competitors (60 capped) + saturated (40) = 100
    expect(calculateCompetitionScore(analysis)).toBe(100);
  });
});

describe('analyzeCompetitorsBatch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns fallback for all problems when no API key', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const problems = [
      { id: 'p1', statement: 'Problem 1', results: [createMockResult({ domain: 'producthunt.com' })] },
      { id: 'p2', statement: 'Problem 2', results: [createMockResult({ domain: 'g2.com' })] },
    ];

    const results = await analyzeCompetitorsBatch(problems);

    expect(results.size).toBe(2);
    expect(results.get('p1')?.differentiationAngles).toContain('Requires manual competitive analysis');
    expect(results.get('p2')?.differentiationAngles).toContain('Requires manual competitive analysis');

    warnSpy.mockRestore();
  });

  it('batches multiple problems into single API call', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          type: 'text',
          text: JSON.stringify([
            {
              problemIndex: 0,
              competitors: [{ name: 'Comp A', url: 'https://a.com', description: 'A', pricing: 'free', strengths: [], weaknesses: [] }],
              gaps: ['Gap A1'],
              marketOpportunity: 'high',
              differentiationAngles: ['Angle A'],
              analysisNotes: 'Notes A',
            },
            {
              problemIndex: 1,
              competitors: [{ name: 'Comp B', url: 'https://b.com', description: 'B', pricing: 'paid', strengths: [], weaknesses: [] }],
              gaps: ['Gap B1'],
              marketOpportunity: 'medium',
              differentiationAngles: ['Angle B'],
              analysisNotes: 'Notes B',
            },
          ]),
        }],
      }),
    });

    const problems = [
      { id: 'p1', statement: 'Problem 1', results: [createMockResult()] },
      { id: 'p2', statement: 'Problem 2', results: [createMockResult()] },
    ];

    const results = await analyzeCompetitorsBatch(problems, { anthropicApiKey: 'test-key' });

    expect(mockFetch).toHaveBeenCalledTimes(1); // Single API call for both problems
    expect(results.size).toBe(2);
    expect(results.get('p1')?.marketOpportunity).toBe('high');
    expect(results.get('p2')?.marketOpportunity).toBe('medium');
  });

  it('makes multiple API calls when exceeding batch size', async () => {
    // Create 25 problems (should result in 2 API calls: 20 + 5)
    const problems = Array(25).fill(null).map((_, i) => ({
      id: `p${i}`,
      statement: `Problem ${i}`,
      results: [createMockResult()],
    }));

    // Mock two API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            type: 'text',
            text: JSON.stringify(
              Array(20).fill(null).map((_, i) => ({
                problemIndex: i,
                competitors: [],
                gaps: [],
                marketOpportunity: 'medium',
                differentiationAngles: [],
                analysisNotes: `Batch 1 - Problem ${i}`,
              }))
            ),
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            type: 'text',
            text: JSON.stringify(
              Array(5).fill(null).map((_, i) => ({
                problemIndex: i,
                competitors: [],
                gaps: [],
                marketOpportunity: 'high',
                differentiationAngles: [],
                analysisNotes: `Batch 2 - Problem ${i}`,
              }))
            ),
          }],
        }),
      });

    const results = await analyzeCompetitorsBatch(problems, { anthropicApiKey: 'test-key' });

    expect(mockFetch).toHaveBeenCalledTimes(2); // 2 API calls: ceil(25/20)
    expect(results.size).toBe(25);
  });

  it('returns fallbacks on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const problems = [
      { id: 'p1', statement: 'Problem 1', results: [createMockResult({ domain: 'producthunt.com' })] },
    ];

    const results = await analyzeCompetitorsBatch(problems, { anthropicApiKey: 'test-key' });

    expect(results.size).toBe(1);
    expect(results.get('p1')?.differentiationAngles).toContain('Requires manual competitive analysis');

    warnSpy.mockRestore();
  });

  it('handles missing problem indices in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          type: 'text',
          text: JSON.stringify([
            // Only returns result for problemIndex 0, missing problemIndex 1
            {
              problemIndex: 0,
              competitors: [],
              gaps: ['Gap'],
              marketOpportunity: 'high',
              differentiationAngles: [],
              analysisNotes: 'Notes',
            },
          ]),
        }],
      }),
    });

    const problems = [
      { id: 'p1', statement: 'Problem 1', results: [createMockResult({ domain: 'producthunt.com' })] },
      { id: 'p2', statement: 'Problem 2', results: [createMockResult({ domain: 'g2.com' })] },
    ];

    const results = await analyzeCompetitorsBatch(problems, { anthropicApiKey: 'test-key' });

    expect(results.size).toBe(2);
    expect(results.get('p1')?.marketOpportunity).toBe('high');
    // p2 should get fallback since it wasn't in the response
    expect(results.get('p2')?.differentiationAngles).toContain('Requires manual competitive analysis');
  });

  it('uses correct API parameters for batch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          type: 'text',
          text: '[]',
        }],
      }),
    });

    const problems = [
      { id: 'p1', statement: 'Problem 1', results: [createMockResult()] },
    ];

    await analyzeCompetitorsBatch(problems, {
      anthropicApiKey: 'batch-test-key',
      model: 'claude-3-5-haiku-20241022',
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('batch-test-key');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('claude-3-5-haiku-20241022');
    expect(body.max_tokens).toBe(6000); // Larger for batch
    expect(body.messages[0].content).toContain('Problem 1');
  });
});

describe('summarizeAnalysis', () => {
  it('includes market opportunity', () => {
    const analysis: CompetitorAnalysis = {
      competitors: [],
      gaps: [],
      marketOpportunity: 'high',
      differentiationAngles: [],
      analysisNotes: '',
    };

    const summary = summarizeAnalysis(analysis);
    expect(summary).toContain('Market Opportunity: HIGH');
  });

  it('includes competitor count', () => {
    const analysis: CompetitorAnalysis = {
      competitors: [
        { name: 'A', url: '', description: 'Desc A', pricing: '', strengths: [], weaknesses: [] },
        { name: 'B', url: '', description: 'Desc B', pricing: '', strengths: [], weaknesses: [] },
      ],
      gaps: [],
      marketOpportunity: 'medium',
      differentiationAngles: [],
      analysisNotes: '',
    };

    const summary = summarizeAnalysis(analysis);
    expect(summary).toContain('Found 2 competitor(s)');
  });

  it('lists top 3 competitors', () => {
    const analysis: CompetitorAnalysis = {
      competitors: [
        { name: 'Alpha', url: '', description: 'Alpha description', pricing: '', strengths: [], weaknesses: [] },
        { name: 'Beta', url: '', description: 'Beta description', pricing: '', strengths: [], weaknesses: [] },
        { name: 'Gamma', url: '', description: 'Gamma description', pricing: '', strengths: [], weaknesses: [] },
        { name: 'Delta', url: '', description: 'Delta description', pricing: '', strengths: [], weaknesses: [] },
      ],
      gaps: [],
      marketOpportunity: 'medium',
      differentiationAngles: [],
      analysisNotes: '',
    };

    const summary = summarizeAnalysis(analysis);
    expect(summary).toContain('Top Competitors:');
    expect(summary).toContain('1. Alpha');
    expect(summary).toContain('2. Beta');
    expect(summary).toContain('3. Gamma');
    expect(summary).not.toContain('4. Delta');
  });

  it('lists top 3 gaps', () => {
    const analysis: CompetitorAnalysis = {
      competitors: [],
      gaps: ['Gap 1', 'Gap 2', 'Gap 3', 'Gap 4'],
      marketOpportunity: 'high',
      differentiationAngles: [],
      analysisNotes: '',
    };

    const summary = summarizeAnalysis(analysis);
    expect(summary).toContain('Key Gaps:');
    expect(summary).toContain('- Gap 1');
    expect(summary).toContain('- Gap 2');
    expect(summary).toContain('- Gap 3');
    expect(summary).not.toContain('- Gap 4');
  });

  it('lists top 3 differentiation angles', () => {
    const analysis: CompetitorAnalysis = {
      competitors: [],
      gaps: [],
      marketOpportunity: 'high',
      differentiationAngles: ['Angle 1', 'Angle 2', 'Angle 3', 'Angle 4'],
      analysisNotes: '',
    };

    const summary = summarizeAnalysis(analysis);
    expect(summary).toContain('Differentiation Opportunities:');
    expect(summary).toContain('- Angle 1');
    expect(summary).toContain('- Angle 2');
    expect(summary).toContain('- Angle 3');
    expect(summary).not.toContain('- Angle 4');
  });

  it('omits sections with no data', () => {
    const analysis: CompetitorAnalysis = {
      competitors: [],
      gaps: [],
      marketOpportunity: 'high',
      differentiationAngles: [],
      analysisNotes: '',
    };

    const summary = summarizeAnalysis(analysis);
    expect(summary).not.toContain('Top Competitors:');
    expect(summary).not.toContain('Key Gaps:');
    expect(summary).not.toContain('Differentiation Opportunities:');
  });

  it('truncates long descriptions', () => {
    const longDesc = 'x'.repeat(200);
    const analysis: CompetitorAnalysis = {
      competitors: [
        { name: 'Test', url: '', description: longDesc, pricing: '', strengths: [], weaknesses: [] },
      ],
      gaps: [],
      marketOpportunity: 'medium',
      differentiationAngles: [],
      analysisNotes: '',
    };

    const summary = summarizeAnalysis(analysis);
    // Description should be truncated to 100 chars
    expect(summary.length).toBeLessThan(300);
  });
});
