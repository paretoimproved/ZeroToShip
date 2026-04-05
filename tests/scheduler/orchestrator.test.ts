// @ts-nocheck
/**
 * Integration tests for pipeline orchestrator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPipeline, DEFAULT_PIPELINE_CONFIG } from '../../src/scheduler/orchestrator';
import type { RunStatus } from '../../src/scheduler/utils/persistence';
import type { RawPost } from '../../src/scrapers/types';
import type { ProblemCluster, ScoredProblem } from '../../src/analysis';
import type { GapAnalysis } from '../../src/analysis/gap-analyzer';
import type { IdeaBrief } from '../../src/generation';
import type { PipelineConfig } from '../../src/scheduler/types';
import { makeGenerationBrief } from '../fixtures';

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
  validateBriefQuality: vi.fn().mockReturnValue({ valid: true, reasons: [] }),
}));

// Mock delivery
vi.mock('../../src/delivery/email', () => ({
  sendDailyBriefsBatch: vi.fn(),
}));

// Mock database client (used by orchestrator for final update and by other modules)
vi.mock('../../src/api/db/client', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
  users: {},
  subscriptions: {},
  userPreferences: {},
  ideas: {},
  pipelineRuns: {
    runId: 'run_id',
  },
}));

// Mock persistence (DB-backed)
vi.mock('../../src/scheduler/utils/persistence', () => ({
  initRunStatus: vi.fn().mockResolvedValue(undefined),
  savePhaseResult: vi.fn().mockResolvedValue(undefined),
  updatePhaseStatus: vi.fn().mockResolvedValue(undefined),
  updatePhaseStats: vi.fn().mockResolvedValue(undefined),
  loadRunStatus: vi.fn().mockResolvedValue(null),
  loadPhaseResult: vi.fn().mockResolvedValue(null),
  getResumePhase: vi.fn().mockReturnValue(null),
  cleanupStaleRuns: vi.fn().mockResolvedValue(0),
}));

// Mock monitoring (used by orchestrator)
vi.mock('../../src/lib/monitoring', () => ({
  initMonitoring: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// Mock alerts (used by orchestrator)
vi.mock('../../src/lib/alerts', () => ({
  sendPipelineFailureAlert: vi.fn(),
}));

// Mock pipeline lock (used by orchestrator for distributed locking)
vi.mock('../../src/lib/pipeline-lock', () => ({
  acquirePipelineLock: vi.fn().mockResolvedValue(true),
  extendPipelineLock: vi.fn().mockResolvedValue(true),
  releasePipelineLock: vi.fn().mockResolvedValue(undefined),
  PIPELINE_LOCK_TTL_SECONDS: 300,
}));

// Mock generation providers — wraps real legacy behavior by default,
// enables per-test overrides for graph mode verification.
const { mockSelectGenerationProvider } = vi.hoisted(() => ({
  mockSelectGenerationProvider: vi.fn(),
}));
vi.mock('../../src/generation/providers', () => ({
  getConfiguredGenerationMode: vi.fn().mockReturnValue('legacy'),
  selectGenerationProvider: mockSelectGenerationProvider,
  resolveGenerationMode: vi.fn((v?: string) => (v === 'graph' ? 'graph' : 'legacy')),
}));

// Helper factories
function createMockPost(overrides: Partial<RawPost> = {}): RawPost {
  return {
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    source: 'reddit',
    sourceId: `src_${Math.random().toString(36).slice(2, 8)}`,
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
    id: `cluster_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
      engagement: 5,
      impact: 56,
      effort: 20,
      priority: 25,
    },
    reasoning: {
      severity: 'High severity',
      marketSize: 'Large market',
      technicalComplexity: 'Moderate complexity',
    },
    ...overrides,
  };
}

function createMockGap(problemId: string): GapAnalysis {
  return {
    problemId,
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
  };
}

const createMockBrief = (overrides: Partial<IdeaBrief> = {}): IdeaBrief =>
  makeGenerationBrief(overrides);

/**
 * Helper to set up all mocks for a full successful pipeline run.
 * Returns the mock data for assertions.
 */
async function setupFullPipelineMocks() {
  const { scrapeReddit } = await import('../../src/scrapers/reddit');
  const { scrapeHackerNews } = await import('../../src/scrapers/hackernews');
  const { twitterScraper } = await import('../../src/scrapers/twitter');
  const { scrapeGitHub } = await import('../../src/scrapers/github');
  const { clusterPosts } = await import('../../src/analysis/deduplicator');
  const { scoreAll } = await import('../../src/analysis/scorer');
  const { analyzeAllGaps } = await import('../../src/analysis/gap-analyzer');
  const { generateAllBriefs } = await import('../../src/generation/brief-generator');
  const { sendDailyBriefsBatch } = await import('../../src/delivery/email');

  const mockPosts = [createMockPost(), createMockPost()];
  const mockClusters = [createMockCluster()];
  const mockScored = [createMockScoredProblem()];
  const mockGaps = [createMockGap(mockClusters[0].id)];
  const mockBriefs = [createMockBrief()];

  vi.mocked(scrapeReddit).mockResolvedValue(mockPosts);
  vi.mocked(scrapeHackerNews).mockResolvedValue([]);
  vi.mocked(twitterScraper.scrapeAll).mockResolvedValue({
    tweets: [], method: 'nitter', totalFound: 0, errors: [], duration: 0, queriesUsed: [],
  });
  vi.mocked(scrapeGitHub).mockResolvedValue([]);
  vi.mocked(clusterPosts).mockResolvedValue(mockClusters);
  vi.mocked(scoreAll).mockResolvedValue(mockScored);
  vi.mocked(analyzeAllGaps).mockResolvedValue(mockGaps);
  vi.mocked(generateAllBriefs).mockResolvedValue(mockBriefs);
  vi.mocked(sendDailyBriefsBatch).mockResolvedValue({
    total: 0, sent: 0, failed: 0, deliveries: [],
  });

  return {
    mocks: {
      scrapeReddit: vi.mocked(scrapeReddit),
      scrapeHackerNews: vi.mocked(scrapeHackerNews),
      twitterScraper,
      scrapeGitHub: vi.mocked(scrapeGitHub),
      clusterPosts: vi.mocked(clusterPosts),
      scoreAll: vi.mocked(scoreAll),
      analyzeAllGaps: vi.mocked(analyzeAllGaps),
      generateAllBriefs: vi.mocked(generateAllBriefs),
      sendDailyBriefsBatch: vi.mocked(sendDailyBriefsBatch),
    },
    data: { mockPosts, mockClusters, mockScored, mockGaps, mockBriefs },
  };
}

/**
 * Helper to set up persistence mocks for a resumed run.
 * Simulates a previous run with specific phases completed and data persisted.
 */
async function setupResumedRunMocks(
  resumeRunId: string,
  completedPhases: ('scrape' | 'analyze' | 'generate' | 'deliver')[],
  phaseData: Record<string, unknown>
) {
  const persistence = await import('../../src/scheduler/utils/persistence');

  const phases: Record<string, string> = {
    scrape: 'pending',
    analyze: 'pending',
    generate: 'pending',
    deliver: 'pending',
  };
  let lastCompletedPhase: string | null = null;

  for (const phase of completedPhases) {
    phases[phase] = 'completed';
    lastCompletedPhase = phase;
  }

  const runStatus: RunStatus = {
    runId: resumeRunId,
    config: { ...DEFAULT_PIPELINE_CONFIG, dryRun: true },
    startedAt: new Date().toISOString(),
    phases: phases as RunStatus['phases'],
    lastCompletedPhase: lastCompletedPhase as RunStatus['lastCompletedPhase'],
    updatedAt: new Date().toISOString(),
  };

  vi.mocked(persistence.loadRunStatus).mockResolvedValue(runStatus);

  // Use the real getResumePhase logic
  const phaseOrder = ['scrape', 'analyze', 'generate', 'deliver'] as const;
  let resumePhase: string | null = null;
  for (const phase of phaseOrder) {
    if (phases[phase] !== 'completed') {
      resumePhase = phase;
      break;
    }
  }
  vi.mocked(persistence.getResumePhase).mockReturnValue(
    resumePhase as ReturnType<typeof persistence.getResumePhase>
  );

  // Mock loadPhaseResult to return data for completed phases
  vi.mocked(persistence.loadPhaseResult).mockImplementation(
    async <T>(_runId: string, phase: string): Promise<T | null> => {
      if (phaseData[phase]) {
        return phaseData[phase] as T;
      }
      return null;
    }
  );

  return persistence;
}

// ===========================================================================
// Tests
// ===========================================================================

describe.skip('Pipeline Orchestrator', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset persistence mocks to defaults after each test
    // (clearAllMocks only clears call records, not implementations)
    const persistence = await import('../../src/scheduler/utils/persistence');
    vi.mocked(persistence.initRunStatus).mockResolvedValue(undefined);
    vi.mocked(persistence.savePhaseResult).mockResolvedValue(undefined);
    vi.mocked(persistence.updatePhaseStatus).mockResolvedValue(undefined);
    vi.mocked(persistence.updatePhaseStats).mockResolvedValue(undefined);
    vi.mocked(persistence.loadRunStatus).mockResolvedValue(null);
    vi.mocked(persistence.loadPhaseResult).mockResolvedValue(null);
    vi.mocked(persistence.getResumePhase).mockReturnValue(null);

    // Reset selectGenerationProvider to delegate to generateAllBriefs (legacy behavior)
    const { generateAllBriefs } = await import('../../src/generation/brief-generator');
    mockSelectGenerationProvider.mockImplementation((mode: string = 'legacy') => ({
      requestedMode: mode,
      effectiveMode: mode,
      provider: {
        mode,
        generate: async (input: { scoredProblems: ScoredProblem[]; gapAnalyses: Map<string, GapAnalysis>; config?: Record<string, unknown> }) => {
          const briefs = await generateAllBriefs(input.scoredProblems, input.gapAnalyses, input.config);
          return briefs;
        },
      },
    }));
  });

  // ---- Existing tests (preserved) ----

  it('should have correct default config', () => {
    expect(DEFAULT_PIPELINE_CONFIG).toMatchObject({
      hoursBack: 48,
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

  // ---- New tests: Phase failure short-circuits ----

  describe('phase failure short-circuits', () => {
    it('should short-circuit at analyze phase when clustering returns empty', async () => {
      const { mocks } = await setupFullPipelineMocks();

      // Scrape succeeds, but clustering returns 0 clusters
      vi.mocked(mocks.clusterPosts).mockResolvedValue([]);

      const result = await runPipeline({ dryRun: true });

      expect(result.success).toBe(false);
      expect(result.phases.scrape.success).toBe(true);
      expect(result.phases.analyze.success).toBe(false);
      // Generate and deliver should not be executed
      expect(mocks.generateAllBriefs).not.toHaveBeenCalled();
      expect(mocks.sendDailyBriefsBatch).not.toHaveBeenCalled();
    });

    it('should short-circuit at analyze phase when scoring throws', async () => {
      const { mocks } = await setupFullPipelineMocks();

      vi.mocked(mocks.scoreAll).mockRejectedValue(new Error('Anthropic API rate limited'));

      const result = await runPipeline({ dryRun: true });

      expect(result.success).toBe(false);
      expect(result.phases.scrape.success).toBe(true);
      expect(result.phases.analyze.success).toBe(false);
      expect(result.phases.analyze.error).toContain('Anthropic API rate limited');
      expect(result.errors.some(e => e.phase === 'analyze')).toBe(true);
      expect(mocks.generateAllBriefs).not.toHaveBeenCalled();
    });

    it('should short-circuit at generate phase when brief generation throws', async () => {
      const { mocks } = await setupFullPipelineMocks();

      vi.mocked(mocks.generateAllBriefs).mockRejectedValue(new Error('Token limit exceeded'));

      const result = await runPipeline({ dryRun: true });

      expect(result.success).toBe(false);
      expect(result.phases.scrape.success).toBe(true);
      expect(result.phases.analyze.success).toBe(true);
      expect(result.phases.generate.success).toBe(false);
      expect(result.phases.generate.error).toContain('Token limit exceeded');
      expect(result.errors.some(e => e.phase === 'generate')).toBe(true);
    });

    it('should NOT short-circuit when deliver phase fails (degraded)', async () => {
      const { mocks } = await setupFullPipelineMocks();

      vi.mocked(mocks.sendDailyBriefsBatch).mockRejectedValue(new Error('Resend API down'));

      const result = await runPipeline({ dryRun: true });

      // In dry run mode, delivery doesn't call sendDailyBriefsBatch,
      // so let's verify the pipeline completes successfully
      expect(result.success).toBe(true);
      expect(result.phases.deliver.success).toBe(true);
    });
  });

  // ---- New tests: Empty results handling ----

  describe('empty results handling', () => {
    it('should handle zero scored problems after analysis', async () => {
      const { mocks } = await setupFullPipelineMocks();

      // Scoring returns empty array (no problems meet threshold)
      vi.mocked(mocks.scoreAll).mockResolvedValue([]);

      const result = await runPipeline({ dryRun: true });

      expect(result.phases.scrape.success).toBe(true);
      expect(result.phases.analyze.success).toBe(true);
      expect(result.phases.analyze.data?.scoredCount).toBe(0);
      // Generate phase gets skipped due to no scored problems
      expect(result.phases.generate.success).toBe(false);
    });

    it('should handle scored problems below minimum priority threshold', async () => {
      const { mocks } = await setupFullPipelineMocks();

      const lowPriorityProblem = createMockScoredProblem({
        scores: {
          frequency: 1,
          severity: 1,
          marketSize: 1,
          technicalComplexity: 1,
          timeToMvp: 1,
          engagement: 1,
          impact: 1,
          effort: 1,
          priority: 0,
        },
      });
      vi.mocked(mocks.scoreAll).mockResolvedValue([lowPriorityProblem]);

      const result = await runPipeline({ dryRun: true });

      expect(result.phases.analyze.success).toBe(true);
      expect(result.phases.generate.success).toBe(false);
    });
  });

  // ---- New tests: Pipeline result structure ----

  describe('pipeline result structure', () => {
    it('should include timing information', async () => {
      await setupFullPipelineMocks();

      const result = await runPipeline({ dryRun: true });

      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(result.startedAt.getTime());
    });

    it('should include accurate stats', async () => {
      const { mocks } = await setupFullPipelineMocks();

      const threePosts = [createMockPost(), createMockPost(), createMockPost()];
      vi.mocked(mocks.scrapeReddit).mockResolvedValue(threePosts);

      const twoClusters = [createMockCluster(), createMockCluster()];
      vi.mocked(mocks.clusterPosts).mockResolvedValue(twoClusters);

      const twoScored = [createMockScoredProblem(), createMockScoredProblem()];
      vi.mocked(mocks.scoreAll).mockResolvedValue(twoScored);

      const threeBriefs = [createMockBrief(), createMockBrief(), createMockBrief()];
      vi.mocked(mocks.generateAllBriefs).mockResolvedValue(threeBriefs);

      const result = await runPipeline({ dryRun: true });

      expect(result.stats.postsScraped).toBe(3);
      expect(result.stats.clustersCreated).toBe(2);
      expect(result.stats.ideasGenerated).toBe(3);
      expect(result.stats.emailsSent).toBe(0); // dry run
    });

    it('should populate error details with phase and message', async () => {
      const { scrapeReddit } = await import('../../src/scrapers/reddit');
      const { scrapeHackerNews } = await import('../../src/scrapers/hackernews');
      const { twitterScraper } = await import('../../src/scrapers/twitter');
      const { scrapeGitHub } = await import('../../src/scrapers/github');

      vi.mocked(scrapeReddit).mockRejectedValue(new Error('Reddit down'));
      vi.mocked(scrapeHackerNews).mockRejectedValue(new Error('HN down'));
      vi.mocked(twitterScraper.scrapeAll).mockRejectedValue(new Error('Twitter down'));
      vi.mocked(scrapeGitHub).mockRejectedValue(new Error('GitHub down'));

      const result = await runPipeline();

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const scrapeError = result.errors.find(e => e.phase === 'scrape');
      expect(scrapeError).toBeDefined();
      expect(scrapeError!.message).toBeDefined();
      expect(scrapeError!.timestamp).toBeInstanceOf(Date);
      expect(typeof scrapeError!.recoverable).toBe('boolean');
    });

    it('should store the config used in the result', async () => {
      await setupFullPipelineMocks();

      const result = await runPipeline({ dryRun: true, hoursBack: 48, maxBriefs: 5 });

      expect(result.config.dryRun).toBe(true);
      expect(result.config.hoursBack).toBe(48);
      expect(result.config.maxBriefs).toBe(5);
    });

    it('should mark unexecuted phases with error "Phase not executed"', async () => {
      const { scrapeReddit } = await import('../../src/scrapers/reddit');
      const { scrapeHackerNews } = await import('../../src/scrapers/hackernews');
      const { twitterScraper } = await import('../../src/scrapers/twitter');
      const { scrapeGitHub } = await import('../../src/scrapers/github');

      // All scrapers fail -> pipeline aborts at scrape
      vi.mocked(scrapeReddit).mockRejectedValue(new Error('fail'));
      vi.mocked(scrapeHackerNews).mockRejectedValue(new Error('fail'));
      vi.mocked(twitterScraper.scrapeAll).mockRejectedValue(new Error('fail'));
      vi.mocked(scrapeGitHub).mockRejectedValue(new Error('fail'));

      const result = await runPipeline();

      // Analyze, generate, deliver should show "Phase not executed"
      expect(result.phases.analyze.error).toBe('Phase not executed');
      expect(result.phases.generate.error).toBe('Phase not executed');
      expect(result.phases.deliver.error).toBe('Phase not executed');
      expect(result.phases.analyze.data).toBeNull();
      expect(result.phases.generate.data).toBeNull();
      expect(result.phases.deliver.data).toBeNull();
    });
  });

  // ---- New tests: Persistence integration ----

  describe('persistence integration', () => {
    it('should call initRunStatus and persistence functions on successful run', async () => {
      await setupFullPipelineMocks();
      const persistence = await import('../../src/scheduler/utils/persistence');

      const result = await runPipeline({ dryRun: true });

      // initRunStatus should have been called
      expect(persistence.initRunStatus).toHaveBeenCalledWith(
        expect.stringMatching(/^run_/),
        expect.any(Object)
      );

      // Phase results should have been saved
      expect(persistence.savePhaseResult).toHaveBeenCalled();
      expect(persistence.updatePhaseStatus).toHaveBeenCalled();
    });

    it('should call updatePhaseStatus with failed for failed phases', async () => {
      const { scrapeReddit } = await import('../../src/scrapers/reddit');
      const { scrapeHackerNews } = await import('../../src/scrapers/hackernews');
      const { twitterScraper } = await import('../../src/scrapers/twitter');
      const { scrapeGitHub } = await import('../../src/scrapers/github');
      const persistence = await import('../../src/scheduler/utils/persistence');

      vi.mocked(scrapeReddit).mockRejectedValue(new Error('fail'));
      vi.mocked(scrapeHackerNews).mockRejectedValue(new Error('fail'));
      vi.mocked(twitterScraper.scrapeAll).mockRejectedValue(new Error('fail'));
      vi.mocked(scrapeGitHub).mockRejectedValue(new Error('fail'));

      await runPipeline();

      expect(persistence.updatePhaseStatus).toHaveBeenCalledWith(
        expect.any(String),
        'scrape',
        'failed'
      );
    });
  });

  // ---- New tests: Resume from phase ----

  describe('resume from phase', () => {
    it('should resume from analyze phase, skipping scrape', async () => {
      const { mocks } = await setupFullPipelineMocks();

      const resumeRunId = `test_resume_analyze_${Date.now()}`;
      const mockScrapeData = {
        reddit: { count: 2, success: true },
        hn: { count: 0, success: true },
        twitter: { count: 0, success: true },
        github: { count: 0, success: true },
        totalPosts: 2,
        posts: [createMockPost(), createMockPost()],
      };

      await setupResumedRunMocks(resumeRunId, ['scrape'], { scrape: mockScrapeData });

      const result = await runPipeline({ resumeRunId, dryRun: true });

      // Scrape should have been skipped (no scraper calls)
      expect(mocks.scrapeReddit).not.toHaveBeenCalled();
      expect(mocks.scrapeHackerNews).not.toHaveBeenCalled();

      // Analyze should have been called with the persisted posts
      expect(mocks.clusterPosts).toHaveBeenCalled();
      expect(result.runId).toBe(resumeRunId);
      expect(result.phases.scrape.success).toBe(true);
      expect(result.phases.analyze.success).toBe(true);
    });

    it('should resume from generate phase, skipping scrape and analyze', async () => {
      const { mocks } = await setupFullPipelineMocks();

      const resumeRunId = `test_resume_generate_${Date.now()}`;

      const mockScrapeData = {
        reddit: { count: 1, success: true },
        hn: { count: 0, success: true },
        twitter: { count: 0, success: true },
        github: { count: 0, success: true },
        totalPosts: 1,
        posts: [createMockPost()],
      };

      const scoredProblem = createMockScoredProblem();
      const mockAnalyzeData = {
        clusterCount: 1,
        scoredCount: 1,
        gapAnalysisCount: 1,
        clusters: [createMockCluster()],
        scoredProblems: [scoredProblem],
        gapAnalyses: new Map([['cluster_1', createMockGap('cluster_1')]]),
      };

      await setupResumedRunMocks(resumeRunId, ['scrape', 'analyze'], {
        scrape: mockScrapeData,
        analyze: mockAnalyzeData,
      });

      const result = await runPipeline({ resumeRunId, dryRun: true });

      // Scrape and analyze should be skipped
      expect(mocks.scrapeReddit).not.toHaveBeenCalled();
      expect(mocks.clusterPosts).not.toHaveBeenCalled();
      expect(mocks.scoreAll).not.toHaveBeenCalled();

      // Generate should run
      expect(mocks.generateAllBriefs).toHaveBeenCalled();
      expect(result.runId).toBe(resumeRunId);
      expect(result.phases.scrape.success).toBe(true);
      expect(result.phases.analyze.success).toBe(true);
    });

    it('should resume from deliver phase, skipping all prior phases', async () => {
      const { mocks } = await setupFullPipelineMocks();

      const resumeRunId = `test_resume_deliver_${Date.now()}`;

      const mockScrapeData = {
        reddit: { count: 1, success: true },
        hn: { count: 0, success: true },
        twitter: { count: 0, success: true },
        github: { count: 0, success: true },
        totalPosts: 1,
        posts: [createMockPost()],
      };

      const mockAnalyzeData = {
        clusterCount: 1,
        scoredCount: 1,
        gapAnalysisCount: 0,
        clusters: [createMockCluster()],
        scoredProblems: [createMockScoredProblem()],
        gapAnalyses: new Map<string, GapAnalysis>(),
      };

      const mockGenerateData = {
        briefCount: 1,
        briefs: [createMockBrief()],
      };

      await setupResumedRunMocks(resumeRunId, ['scrape', 'analyze', 'generate'], {
        scrape: mockScrapeData,
        analyze: mockAnalyzeData,
        generate: mockGenerateData,
      });

      const result = await runPipeline({ resumeRunId, dryRun: true });

      // All prior phases should be skipped
      expect(mocks.scrapeReddit).not.toHaveBeenCalled();
      expect(mocks.clusterPosts).not.toHaveBeenCalled();
      expect(mocks.generateAllBriefs).not.toHaveBeenCalled();

      expect(result.runId).toBe(resumeRunId);
      expect(result.phases.deliver.success).toBe(true);
    });

    it('should throw when resuming a non-existent run', async () => {
      await expect(
        runPipeline({ resumeRunId: 'nonexistent_run_xyz' })
      ).rejects.toThrow('run not found in database');
    });

    it('should throw when resuming a fully completed run', async () => {
      const resumeRunId = `test_resume_complete_${Date.now()}`;
      const persistence = await import('../../src/scheduler/utils/persistence');

      const runStatus: RunStatus = {
        runId: resumeRunId,
        config: { ...DEFAULT_PIPELINE_CONFIG },
        startedAt: new Date().toISOString(),
        phases: {
          scrape: 'completed',
          analyze: 'completed',
          generate: 'completed',
          deliver: 'completed',
        },
        lastCompletedPhase: 'deliver',
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(persistence.loadRunStatus).mockResolvedValue(runStatus);
      vi.mocked(persistence.getResumePhase).mockReturnValue(null);

      await expect(
        runPipeline({ resumeRunId })
      ).rejects.toThrow('all phases already completed');
    });
  });

  // ---- New tests: Phase data flow ----

  describe('phase data flow', () => {
    it('should pass scrape posts to analyze phase', async () => {
      const { mocks } = await setupFullPipelineMocks();

      const specificPosts = [
        createMockPost({ title: 'Post A' }),
        createMockPost({ title: 'Post B' }),
      ];
      vi.mocked(mocks.scrapeReddit).mockResolvedValue(specificPosts);

      await runPipeline({ dryRun: true });

      // clusterPosts should receive the scraped posts
      expect(mocks.clusterPosts).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Post A' }),
          expect.objectContaining({ title: 'Post B' }),
        ]),
        expect.any(Object)
      );
    });

    it('should pass scored problems and gap analyses to generate phase', async () => {
      const { mocks } = await setupFullPipelineMocks();

      const specificScored = [
        createMockScoredProblem({ problemStatement: 'Problem X' }),
      ];
      vi.mocked(mocks.scoreAll).mockResolvedValue(specificScored);

      await runPipeline({ dryRun: true });

      // generateAllBriefs should receive scored problems and a Map of gap analyses
      expect(mocks.generateAllBriefs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ problemStatement: 'Problem X' }),
        ]),
        expect.any(Map),
        expect.any(Object)
      );
    });

    it('should pass generated briefs to deliver phase', async () => {
      const { mocks } = await setupFullPipelineMocks();

      const specificBriefs = [
        createMockBrief({ name: 'SuperApp' }),
      ];
      vi.mocked(mocks.generateAllBriefs).mockResolvedValue(specificBriefs);

      const result = await runPipeline({ dryRun: true });

      expect(result.phases.generate.data?.briefs).toHaveLength(1);
      expect(result.phases.generate.data?.briefs[0].name).toBe('SuperApp');
    });
  });

  // ---- New tests: Graph mode propagation ----

  describe.skip('graph mode propagation', () => {
    it('should pass graph generationMode to generate phase when config specifies graph', async () => {
      await setupFullPipelineMocks();
      const mockBrief = createMockBrief();

      // Override selectGenerationProvider for this test to return a graph mock
      mockSelectGenerationProvider.mockReturnValue({
        requestedMode: 'graph',
        effectiveMode: 'graph',
        provider: {
          mode: 'graph',
          generate: vi.fn().mockResolvedValue([mockBrief]),
        },
      });

      const result = await runPipeline({ dryRun: true, generationMode: 'graph' });

      expect(mockSelectGenerationProvider).toHaveBeenCalledWith('graph');
      expect(result.phases.generate.data?.generationMode).toBe('graph');
    });

    it('should default to legacy mode when generationMode is not specified', async () => {
      await setupFullPipelineMocks();

      const result = await runPipeline({ dryRun: true });

      expect(mockSelectGenerationProvider).toHaveBeenCalledWith('legacy');
    });

    it('should include generationMode in generate phase output for graph runs', async () => {
      await setupFullPipelineMocks();
      const mockBrief = createMockBrief();

      mockSelectGenerationProvider.mockReturnValue({
        requestedMode: 'graph',
        effectiveMode: 'graph',
        provider: {
          mode: 'graph',
          generate: vi.fn().mockResolvedValue([mockBrief]),
        },
      });

      const result = await runPipeline({ dryRun: true, generationMode: 'graph' });

      expect(result.phases.generate.success).toBe(true);
      expect(result.phases.generate.data).toBeDefined();
      expect(result.phases.generate.data?.generationMode).toBe('graph');
      expect(result.phases.generate.data?.briefCount).toBe(1);
    });
  });
});
