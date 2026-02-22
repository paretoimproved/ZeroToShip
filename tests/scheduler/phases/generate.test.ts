/**
 * Integration tests for the Generate Phase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGeneratePhase } from '../../../src/scheduler/phases/generate';
import type { PipelineConfig } from '../../../src/scheduler/types';
import type { ProblemCluster, ScoredProblem } from '../../../src/analysis';
import type { GapAnalysis } from '../../../src/analysis/gap-analyzer';
import { makeGenerationBrief } from '../../fixtures';

// Mock generation
vi.mock('../../../src/generation/brief-generator', () => ({
  generateAllBriefs: vi.fn(),
  validateBriefQuality: vi.fn().mockReturnValue({ valid: true, reasons: [] }),
}));

// Mock config
vi.mock('../../../src/config/models', () => ({
  getPipelineBriefModel: vi.fn().mockReturnValue('claude-sonnet-4-5-20250929'),
}));

// Mock similarity (used for deduplication)
vi.mock('../../../src/analysis/similarity', () => ({
  cosineSimilarity: vi.fn().mockReturnValue(0),
}));

// Mock database client
vi.mock('../../../src/api/db/client', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
  ideas: {},
}));

function makeConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    hoursBack: 24,
    scrapers: { reddit: true, hn: true, twitter: true, github: true },
    clusteringThreshold: 0.85,
    minFrequencyForGap: 2,
    maxBriefs: 10,
    minPriorityScore: 0.5,
    dryRun: false,
    verbose: false,
    ...overrides,
  };
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: `post_${Math.random().toString(36).slice(2, 8)}`,
    source: 'reddit' as const,
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

function makeCluster(overrides: Partial<ProblemCluster> = {}): ProblemCluster {
  return {
    id: `cluster_${Math.random().toString(36).slice(2, 8)}`,
    representativePost: makePost(),
    relatedPosts: [],
    frequency: 5,
    totalScore: 500,
    embedding: [],
    problemStatement: 'Users need a better testing tool',
    sources: ['reddit'],
    ...overrides,
  };
}

function makeScoredProblem(overrides: Partial<ScoredProblem> = {}): ScoredProblem {
  return {
    ...makeCluster(),
    scores: {
      frequency: 7,
      severity: 8,
      marketSize: 6,
      technicalComplexity: 5,
      timeToMvp: 4,
      engagement: 5,
      impact: 56,
      effort: 20,
      priority: 18,
    },
    reasoning: {
      severity: 'High severity',
      marketSize: 'Large market',
      technicalComplexity: 'Moderate complexity',
    },
    ...overrides,
  };
}

function makeGap(problemId: string): GapAnalysis {
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

describe('Generate Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('happy path', () => {
    it('should generate briefs from scored problems', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');

      const scoredProblems = [makeScoredProblem({ id: 'sp1' })];
      const gapAnalyses = new Map<string, GapAnalysis>([['sp1', makeGap('sp1')]]);
      const briefs = [makeGenerationBrief({ name: 'TestApp' })];

      vi.mocked(generateAllBriefs).mockResolvedValue(briefs);

      const result = await runGeneratePhase('test-run-1', makeConfig(), scoredProblems, gapAnalyses);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('generate');
      expect(result.data).not.toBeNull();
      expect(result.data!.briefCount).toBe(1);
      expect(result.data!.briefs).toHaveLength(1);
      expect(result.data!.briefs[0].name).toBe('TestApp');
      expect(result.data!.generationMode).toBe('legacy');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should report graph mode when graph mode is requested', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');

      const scoredProblems = [makeScoredProblem({ id: 'sp-graph' })];
      const gapAnalyses = new Map<string, GapAnalysis>([['sp-graph', makeGap('sp-graph')]]);

      vi.mocked(generateAllBriefs).mockResolvedValue([makeGenerationBrief({ name: 'GraphFallback' })]);

      const result = await runGeneratePhase(
        'test-run-graph-fallback',
        makeConfig(),
        scoredProblems,
        gapAnalyses,
        'graph'
      );

      expect(result.success).toBe(true);
      expect(result.data?.generationMode).toBe('graph');
      expect(generateAllBriefs).toHaveBeenCalledTimes(1);
    });

    it('should pass gap analyses and model config to generateAllBriefs', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');

      const scoredProblems = [makeScoredProblem({ id: 'sp2' })];
      const gapAnalyses = new Map<string, GapAnalysis>([['sp2', makeGap('sp2')]]);

      vi.mocked(generateAllBriefs).mockResolvedValue([makeGenerationBrief()]);

      await runGeneratePhase('test-run-config', makeConfig(), scoredProblems, gapAnalyses);

      expect(generateAllBriefs).toHaveBeenCalledWith(
        expect.any(Array),
        gapAnalyses,
        expect.not.objectContaining({ model: expect.anything() })
      );
    });

    it('should persist briefs to database', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');
      const { db } = await import('../../../src/api/db/client');

      const briefs = [makeGenerationBrief()];
      vi.mocked(generateAllBriefs).mockResolvedValue(briefs);

      await runGeneratePhase(
        'test-run-db',
        makeConfig(),
        [makeScoredProblem()],
        new Map()
      );

      expect(db.insert).toHaveBeenCalled();
    });

    it('truncates category to fit ideas.category varchar(100)', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');
      const { db } = await import('../../../src/api/db/client');

      const longCategory = 'x'.repeat(150);
      vi.mocked(generateAllBriefs).mockResolvedValue([
        makeGenerationBrief({ keyFeatures: [longCategory] }),
      ]);

      await runGeneratePhase(
        'test-run-category-truncate',
        makeConfig({ maxBriefs: 1 }),
        [makeScoredProblem({ id: 'sp-cat' })],
        new Map([['sp-cat', makeGap('sp-cat')]])
      );

      expect(db.insert).toHaveBeenCalled();
      const insertReturn = vi.mocked(db.insert).mock.results[0]?.value as any;
      expect(insertReturn?.values).toBeDefined();

      const valuesFn = insertReturn.values as ReturnType<typeof vi.fn>;
      expect(valuesFn).toHaveBeenCalledTimes(1);

      const rows = valuesFn.mock.calls[0][0] as Array<{ category: string | null }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].category).toBe('x'.repeat(100));
    });

    it('queues briefs for review when publish gate threshold is not met', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');
      const { db } = await import('../../../src/api/db/client');

      vi.mocked(generateAllBriefs).mockResolvedValue([makeGenerationBrief({ name: 'NeedsReview' })]);

      const result = await runGeneratePhase(
        'test-run-publish-gate',
        makeConfig({ publishGate: { enabled: true, confidenceThreshold: 0.95 } }),
        [makeScoredProblem({ id: 'sp-gate' })],
        new Map([['sp-gate', makeGap('sp-gate')]])
      );

      expect(result.success).toBe(true);
      expect(result.data?.briefs?.[0]?.generationMeta?.publishDecision).toBe('review');
      expect(result.data?.diagnostics?.publishGate?.enabled).toBe(true);
      expect(result.data?.diagnostics?.publishGate?.needsReviewCount).toBe(1);

      const insertReturn = vi.mocked(db.insert).mock.results[0]?.value as any;
      const rows = insertReturn.values.mock.calls[0][0] as Array<{ isPublished: boolean }>;
      expect(rows[0].isPublished).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should return failure when generateAllBriefs throws', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');

      vi.mocked(generateAllBriefs).mockRejectedValue(new Error('Token limit exceeded'));

      const result = await runGeneratePhase(
        'test-run-gen-err',
        makeConfig(),
        [makeScoredProblem()],
        new Map()
      );

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('Token limit exceeded');
      expect(result.phase).toBe('generate');
    });

    it('should succeed even when database persistence fails (non-fatal)', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');
      const { db } = await import('../../../src/api/db/client');

      vi.mocked(generateAllBriefs).mockResolvedValue([makeGenerationBrief()]);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockRejectedValue(new Error('DB connection lost')),
        }),
      } as ReturnType<typeof db.insert>);

      const result = await runGeneratePhase(
        'test-run-db-err',
        makeConfig(),
        [makeScoredProblem()],
        new Map()
      );

      // Should still succeed because DB persistence failure is non-fatal
      expect(result.success).toBe(true);
      expect(result.data!.briefCount).toBe(1);
    });
  });

  describe('priority score filtering', () => {
    it('should filter out problems below minimum priority score', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');

      const lowPriority = makeScoredProblem({
        scores: {
          frequency: 1, severity: 1, marketSize: 1,
          technicalComplexity: 1, timeToMvp: 1, engagement: 1,
          impact: 1, effort: 1, priority: 0.1,
        },
      });

      const config = makeConfig({ minPriorityScore: 5 });
      const result = await runGeneratePhase('test-run-low-prio', config, [lowPriority], new Map());

      expect(result.success).toBe(false);
      expect(result.error).toBe('No problems met the minimum priority threshold');
      expect(generateAllBriefs).not.toHaveBeenCalled();
    });

    it('should only pass eligible problems to brief generation', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');

      const highPriority = makeScoredProblem({
        id: 'high',
        scores: {
          frequency: 9, severity: 9, marketSize: 9,
          technicalComplexity: 3, timeToMvp: 3, engagement: 8,
          impact: 80, effort: 15, priority: 20,
        },
      });
      const lowPriority = makeScoredProblem({
        id: 'low',
        scores: {
          frequency: 1, severity: 1, marketSize: 1,
          technicalComplexity: 1, timeToMvp: 1, engagement: 1,
          impact: 1, effort: 1, priority: 0.1,
        },
      });

      vi.mocked(generateAllBriefs).mockResolvedValue([makeGenerationBrief()]);

      const config = makeConfig({ minPriorityScore: 5 });
      await runGeneratePhase('test-run-filter', config, [highPriority, lowPriority], new Map());

      // Only the high-priority problem should be passed
      const calledWith = vi.mocked(generateAllBriefs).mock.calls[0][0];
      expect(calledWith).toHaveLength(1);
      expect(calledWith[0].id).toBe('high');
    });
  });

  describe('max briefs limit', () => {
    it('should respect maxBriefs config limit', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');

      // Create more problems than the max
      const problems = Array.from({ length: 20 }, (_, i) =>
        makeScoredProblem({
          id: `sp_${i}`,
          scores: {
            frequency: 7, severity: 8, marketSize: 6,
            technicalComplexity: 5, timeToMvp: 4, engagement: 5,
            impact: 56, effort: 20, priority: 18 - i * 0.1,
          },
        })
      );

      vi.mocked(generateAllBriefs).mockResolvedValue([makeGenerationBrief()]);

      const config = makeConfig({ maxBriefs: 3 });
      await runGeneratePhase('test-run-limit', config, problems, new Map());

      // Should only pass maxBriefs (3) problems
      const calledWith = vi.mocked(generateAllBriefs).mock.calls[0][0];
      expect(calledWith.length).toBeLessThanOrEqual(3);
    });
  });

  describe('edge cases', () => {
    it('should return failure when scored problems array is empty', async () => {
      const result = await runGeneratePhase(
        'test-run-no-problems',
        makeConfig(),
        [],
        new Map()
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No problems met the minimum priority threshold');
    });

    it('should handle generateAllBriefs returning empty array', async () => {
      const { generateAllBriefs } = await import('../../../src/generation/brief-generator');

      vi.mocked(generateAllBriefs).mockResolvedValue([]);

      const result = await runGeneratePhase(
        'test-run-no-briefs',
        makeConfig(),
        [makeScoredProblem()],
        new Map()
      );

      expect(result.success).toBe(true);
      expect(result.data!.briefCount).toBe(0);
      expect(result.data!.briefs).toHaveLength(0);
    });
  });

  describe('diagnostics', () => {
    it('should emit quality and fallback diagnostics with taxonomy counts', async () => {
      const { generateAllBriefs, validateBriefQuality } = await import('../../../src/generation/brief-generator');

      const primaryBrief = makeGenerationBrief({
        name: 'PrimaryBrief',
        generationMeta: { isFallback: false },
      });
      const fallbackBrief = makeGenerationBrief({
        name: 'FallbackBrief',
        generationMeta: { isFallback: true, fallbackReason: 'missing_api_key' },
      });

      vi.mocked(generateAllBriefs).mockResolvedValue([primaryBrief, fallbackBrief]);
      vi.mocked(validateBriefQuality).mockImplementation((brief) => {
        if (brief.name === 'FallbackBrief') {
          return { valid: false, reasons: ['name too short (< 2 chars)'] };
        }
        return { valid: true, reasons: [] };
      });

      const result = await runGeneratePhase(
        'test-run-diagnostics',
        makeConfig(),
        [makeScoredProblem({ id: 'sp_diag' })],
        new Map()
      );

      expect(result.success).toBe(true);
      expect(result.data?.diagnostics).toMatchObject({
        taxonomyVersion: 'v1',
        generatedBriefCount: 2,
        qualityPassCount: 1,
        qualityFailCount: 1,
        qualityPassRate: 0.5,
        fallbackCount: 1,
        fallbackRate: 0.5,
      });
      expect(result.data?.diagnostics?.fallbackReasonCounts.missing_api_key).toBe(1);
      expect(result.data?.diagnostics?.qualityFailureReasonCounts.length_too_short).toBe(1);
    });
  });
});
