/**
 * Integration tests for pipeline orchestrator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPipeline, DEFAULT_PIPELINE_CONFIG } from '../../src/scheduler/orchestrator';
import type { RawPost } from '../../src/scrapers/types';
import type { ProblemCluster, ScoredProblem } from '../../src/analysis';
import type { GapAnalysis } from '../../src/analysis/gap-analyzer';
import type { IdeaBrief } from '../../src/generation';

// Mock all scrapers
vi.mock('../../src/scrapers/reddit', () => ({
  scrapeReddit: vi.fn(),
  DEFAULT_SUBREDDITS: ['test'],
}));

vi.mock('../../src/scrapers/hackernews', () => ({
  scrapeHackerNews: vi.fn(),
}));

vi.mock('../../src/scrapers/twitter', () => ({
  twitterScraper: {
    scrapeAll: vi.fn(),
  },
}));

vi.mock('../../src/scrapers/github', () => ({
  scrapeGitHub: vi.fn(),
}));

// Mock analysis functions
vi.mock('../../src/analysis/deduplicator', () => ({
  clusterPosts: vi.fn(),
}));

vi.mock('../../src/analysis/scorer', () => ({
  scoreAll: vi.fn(),
}));

vi.mock('../../src/analysis/gap-analyzer', () => ({
  analyzeAllGaps: vi.fn(),
}));

// Mock generation
vi.mock('../../src/generation/brief-generator', () => ({
  generateAllBriefs: vi.fn(),
}));

// Mock delivery
vi.mock('../../src/delivery/email', () => ({
  sendDailyBriefsBatch: vi.fn(),
}));

// Helper factories
function createMockPost(overrides: Partial<RawPost> = {}): RawPost {
  return {
    id: `post_${Date.now()}`,
    source: 'reddit',
    sourceId: 'abc123',
    title: 'Test post',
    body: 'Test body',
    url: 'https://example.com',
    author: 'testuser',
    score: 100,
    commentCount: 50,
    createdAt: new Date(),
    scrapedAt: new Date(),
    signals: ['wish there was'],
    ...overrides,
  };
}

function createMockCluster(overrides: Partial<ProblemCluster> = {}): ProblemCluster {
  return {
    id: `cluster_${Date.now()}`,
    representativePost: createMockPost(),
    relatedPosts: [],
    frequency: 5,
    totalScore: 500,
    embedding: [],
    problemStatement: 'Users need a better testing tool',
    sources: ['reddit'],
    ...overrides,
  };
}

function createMockScoredProblem(overrides: Partial<ScoredProblem> = {}): ScoredProblem {
  return {
    ...createMockCluster(),
    scores: {
      frequency: 7,
      severity: 8,
      marketSize: 6,
      technicalComplexity: 5,
      timeToMvp: 4,
      impact: 56,
      effort: 20,
      priority: 2.8,
    },
    reasoning: {
      severity: 'High severity',
      marketSize: 'Large market',
      technicalComplexity: 'Moderate complexity',
    },
    ...overrides,
  };
}

function createMockBrief(overrides: Partial<IdeaBrief> = {}): IdeaBrief {
  return {
    id: `brief_${Date.now()}`,
    name: 'TestApp',
    tagline: 'Test tagline',
    priorityScore: 2.8,
    effortEstimate: 'week',
    revenueEstimate: '$10K MRR',
    problemStatement: 'Test problem',
    targetAudience: 'Developers',
    marketSize: 'Large',
    existingSolutions: 'None',
    gaps: 'Many gaps',
    proposedSolution: 'Our solution',
    keyFeatures: ['Feature 1'],
    mvpScope: 'Basic MVP',
    technicalSpec: {
      stack: ['TypeScript'],
      architecture: 'Monolith',
      estimatedEffort: '1 week',
    },
    businessModel: {
      pricing: '$10/mo',
      revenueProjection: '$10K',
      monetizationPath: 'SaaS',
    },
    goToMarket: {
      launchStrategy: 'Product Hunt',
      channels: ['Twitter'],
      firstCustomers: 'Indie hackers',
    },
    risks: ['Competition'],
    generatedAt: new Date(),
    ...overrides,
  };
}

describe('Pipeline Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct default config', () => {
    expect(DEFAULT_PIPELINE_CONFIG).toMatchObject({
      hoursBack: 24,
      scrapers: {
        reddit: true,
        hn: true,
        twitter: true,
        github: true,
      },
      maxBriefs: 10,
      dryRun: false,
    });
  });

  it('should run full pipeline successfully', async () => {
    const { scrapeReddit } = await import('../../src/scrapers/reddit');
    const { scrapeHackerNews } = await import('../../src/scrapers/hackernews');
    const { twitterScraper } = await import('../../src/scrapers/twitter');
    const { scrapeGitHub } = await import('../../src/scrapers/github');
    const { clusterPosts } = await import('../../src/analysis/deduplicator');
    const { scoreAll } = await import('../../src/analysis/scorer');
    const { analyzeAllGaps } = await import('../../src/analysis/gap-analyzer');
    const { generateAllBriefs } = await import('../../src/generation/brief-generator');
    const { sendDailyBriefsBatch } = await import('../../src/delivery/email');

    const mockPosts = [createMockPost(), createMockPost({ sourceId: 'def456' })];
    const mockClusters = [createMockCluster()];
    const mockScored = [createMockScoredProblem()];
    const mockGaps: GapAnalysis[] = [
      {
        problemId: mockClusters[0].id,
        problemStatement: 'Test problem',
        searchQueries: [],
        existingSolutions: [],
        gaps: ['Gap 1'],
        marketOpportunity: 'high',
        differentiationAngles: [],
        recommendation: 'Go for it',
        competitionScore: 3,
        analysisNotes: '',
        analyzedAt: new Date(),
      },
    ];
    const mockBriefs = [createMockBrief()];

    vi.mocked(scrapeReddit).mockResolvedValue(mockPosts);
    vi.mocked(scrapeHackerNews).mockResolvedValue([]);
    vi.mocked(twitterScraper.scrapeAll).mockResolvedValue({ tweets: [], method: 'nitter', totalFound: 0, errors: [], duration: 0, queriesUsed: [] });
    vi.mocked(scrapeGitHub).mockResolvedValue([]);
    vi.mocked(clusterPosts).mockResolvedValue(mockClusters);
    vi.mocked(scoreAll).mockResolvedValue(mockScored);
    vi.mocked(analyzeAllGaps).mockResolvedValue(mockGaps);
    vi.mocked(generateAllBriefs).mockResolvedValue(mockBriefs);
    vi.mocked(sendDailyBriefsBatch).mockResolvedValue({
      total: 0,
      sent: 0,
      failed: 0,
      deliveries: [],
    });

    const result = await runPipeline({ dryRun: true });

    expect(result.success).toBe(true);
    expect(result.runId).toMatch(/^run_\d{8}_[a-z0-9]+$/);
    expect(result.phases.scrape.success).toBe(true);
    expect(result.phases.analyze.success).toBe(true);
    expect(result.phases.generate.success).toBe(true);
    expect(result.phases.deliver.success).toBe(true);
    expect(result.stats.postsScraped).toBe(2);
    expect(result.stats.ideasGenerated).toBe(1);
  });

  it('should handle scrape phase failure gracefully', async () => {
    const { scrapeReddit } = await import('../../src/scrapers/reddit');
    const { scrapeHackerNews } = await import('../../src/scrapers/hackernews');
    const { twitterScraper } = await import('../../src/scrapers/twitter');
    const { scrapeGitHub } = await import('../../src/scrapers/github');

    // All scrapers fail
    vi.mocked(scrapeReddit).mockRejectedValue(new Error('Reddit down'));
    vi.mocked(scrapeHackerNews).mockRejectedValue(new Error('HN down'));
    vi.mocked(twitterScraper.scrapeAll).mockRejectedValue(new Error('Twitter down'));
    vi.mocked(scrapeGitHub).mockRejectedValue(new Error('GitHub down'));

    const result = await runPipeline();

    expect(result.success).toBe(false);
    expect(result.phases.scrape.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].phase).toBe('scrape');
  });

  it('should continue with partial scraper success', async () => {
    const { scrapeReddit } = await import('../../src/scrapers/reddit');
    const { scrapeHackerNews } = await import('../../src/scrapers/hackernews');
    const { twitterScraper } = await import('../../src/scrapers/twitter');
    const { scrapeGitHub } = await import('../../src/scrapers/github');
    const { clusterPosts } = await import('../../src/analysis/deduplicator');
    const { scoreAll } = await import('../../src/analysis/scorer');
    const { analyzeAllGaps } = await import('../../src/analysis/gap-analyzer');
    const { generateAllBriefs } = await import('../../src/generation/brief-generator');
    const { sendDailyBriefsBatch } = await import('../../src/delivery/email');

    const mockPosts = [createMockPost()];

    // Only Reddit succeeds
    vi.mocked(scrapeReddit).mockResolvedValue(mockPosts);
    vi.mocked(scrapeHackerNews).mockRejectedValue(new Error('HN down'));
    vi.mocked(twitterScraper.scrapeAll).mockRejectedValue(new Error('Twitter down'));
    vi.mocked(scrapeGitHub).mockRejectedValue(new Error('GitHub down'));

    vi.mocked(clusterPosts).mockResolvedValue([createMockCluster()]);
    vi.mocked(scoreAll).mockResolvedValue([createMockScoredProblem()]);
    vi.mocked(analyzeAllGaps).mockResolvedValue([]);
    vi.mocked(generateAllBriefs).mockResolvedValue([createMockBrief()]);
    vi.mocked(sendDailyBriefsBatch).mockResolvedValue({
      total: 0,
      sent: 0,
      failed: 0,
      deliveries: [],
    });

    const result = await runPipeline({ dryRun: true });

    // Should still succeed because we got some posts
    expect(result.success).toBe(true);
    expect(result.stats.postsScraped).toBe(1);
  });

  it('should respect config overrides', async () => {
    const { scrapeReddit } = await import('../../src/scrapers/reddit');
    const { scrapeHackerNews } = await import('../../src/scrapers/hackernews');
    const { twitterScraper } = await import('../../src/scrapers/twitter');
    const { scrapeGitHub } = await import('../../src/scrapers/github');

    vi.mocked(scrapeReddit).mockResolvedValue([createMockPost()]);
    vi.mocked(scrapeHackerNews).mockResolvedValue([]);
    vi.mocked(twitterScraper.scrapeAll).mockResolvedValue({ tweets: [], method: 'nitter', totalFound: 0, errors: [], duration: 0, queriesUsed: [] });
    vi.mocked(scrapeGitHub).mockResolvedValue([]);

    await runPipeline({
      hoursBack: 48,
      scrapers: { reddit: true, hn: false, twitter: false, github: false },
    });

    expect(scrapeReddit).toHaveBeenCalledWith(expect.any(Array), 48);
    expect(scrapeHackerNews).not.toHaveBeenCalled();
  });
});
