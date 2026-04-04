/**
 * Integration tests for the Analyze Phase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAnalyzePhase } from '../../../src/scheduler/phases/analyze';
import type { PipelineConfig } from '../../../src/scheduler/types';
import type { RawPost } from '../../../src/scrapers/types';
import type { ProblemCluster, ScoredProblem } from '../../../src/analysis';
import type { GapAnalysis } from '../../../src/analysis/gap-analyzer';

// Mock analysis functions
vi.mock('../../../src/analysis/deduplicator', () => ({
  clusterPosts: vi.fn(),
}));

vi.mock('../../../src/analysis/scorer', () => ({
  scoreAll: vi.fn(),
}));

vi.mock('../../../src/analysis/gap-analyzer', () => ({
  analyzeAllGaps: vi.fn(),
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

function makePost(overrides: Partial<RawPost> = {}): RawPost {
  return {
    id: `post_${Math.random().toString(36).slice(2, 8)}`,
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

describe('Analyze Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('happy path', () => {
    it('should cluster, score, and analyze gaps successfully', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');
      const { scoreAll } = await import('../../../src/analysis/scorer');
      const { analyzeAllGaps } = await import('../../../src/analysis/gap-analyzer');

      const clusters = [makeCluster({ id: 'c1' }), makeCluster({ id: 'c2' })];
      const scored = [makeScoredProblem(), makeScoredProblem()];
      const gaps = [makeGap('c1'), makeGap('c2')];

      vi.mocked(clusterPosts).mockResolvedValue(clusters);
      vi.mocked(scoreAll).mockResolvedValue(scored);
      vi.mocked(analyzeAllGaps).mockResolvedValue(gaps);

      const posts = [makePost(), makePost(), makePost()];
      const result = await runAnalyzePhase('test-run-1', makeConfig(), posts);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('analyze');
      expect(result.data).not.toBeNull();
      expect(result.data!.clusterCount).toBe(2);
      expect(result.data!.scoredCount).toBe(2);
      expect(result.data!.gapAnalysisCount).toBe(2);
      expect(result.data!.clusters).toHaveLength(2);
      expect(result.data!.scoredProblems).toHaveLength(2);
      expect(result.data!.gapAnalyses).toBeInstanceOf(Map);
      expect(result.data!.gapAnalyses.size).toBe(2);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should pass config thresholds to clustering and gap analysis', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');
      const { scoreAll } = await import('../../../src/analysis/scorer');
      const { analyzeAllGaps } = await import('../../../src/analysis/gap-analyzer');

      vi.mocked(clusterPosts).mockResolvedValue([makeCluster()]);
      vi.mocked(scoreAll).mockResolvedValue([makeScoredProblem()]);
      vi.mocked(analyzeAllGaps).mockResolvedValue([]);

      const config = makeConfig({
        clusteringThreshold: 0.9,
        minFrequencyForGap: 5,
      });

      await runAnalyzePhase('test-run-config', config, [makePost()]);

      expect(clusterPosts).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          similarityThreshold: 0.9,
          generateSummaries: true,
        })
      );

      expect(analyzeAllGaps).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          minFrequencyForSearch: 5,
        })
      );
    });

    it('should score before running gap analysis', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');
      const { scoreAll } = await import('../../../src/analysis/scorer');
      const { analyzeAllGaps } = await import('../../../src/analysis/gap-analyzer');

      const clusters = [makeCluster()];
      vi.mocked(clusterPosts).mockResolvedValue(clusters);
      vi.mocked(scoreAll).mockResolvedValue([makeScoredProblem()]);
      vi.mocked(analyzeAllGaps).mockResolvedValue([]);

      await runAnalyzePhase('test-run-ordering', makeConfig(), [makePost()]);

      expect(scoreAll).toHaveBeenCalledWith(clusters);
      expect(
        vi.mocked(scoreAll).mock.invocationCallOrder[0]
      ).toBeLessThan(
        vi.mocked(analyzeAllGaps).mock.invocationCallOrder[0]
      );
      expect(analyzeAllGaps).toHaveBeenCalledWith(
        clusters,
        expect.any(Object)
      );
    });

    it('should limit gap analysis to top scored candidates', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');
      const { scoreAll } = await import('../../../src/analysis/scorer');
      const { analyzeAllGaps } = await import('../../../src/analysis/gap-analyzer');

      const clusters = Array.from({ length: 30 }, (_, i) =>
        makeCluster({
          id: `c${i + 1}`,
          problemStatement: `Problem ${i + 1}`,
        })
      );

      // Score order is descending priority; c30 is highest, then c29, etc.
      const scored = Array.from({ length: 30 }, (_, i) =>
        makeScoredProblem({
          id: `c${30 - i}`,
        })
      );

      vi.mocked(clusterPosts).mockResolvedValue(clusters);
      vi.mocked(scoreAll).mockResolvedValue(scored);
      vi.mocked(analyzeAllGaps).mockResolvedValue([]);

      await runAnalyzePhase(
        'test-run-candidate-cap',
        makeConfig({ maxBriefs: 3 }),
        [makePost()]
      );

      const calledClusters = vi.mocked(analyzeAllGaps).mock.calls[0][0] as ProblemCluster[];
      expect(calledClusters).toHaveLength(15);
      expect(calledClusters[0].id).toBe('c30');
      expect(calledClusters[14].id).toBe('c16');
    });
  });

  describe('error handling', () => {
    it('should return failure when clustering returns empty', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');

      vi.mocked(clusterPosts).mockResolvedValue([]);

      const result = await runAnalyzePhase('test-run-empty-clusters', makeConfig(), [makePost()]);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBe('No clusters generated from posts');
      expect(result.severity).toBe('fatal');
    });

    it('should return failure when clustering throws', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');

      vi.mocked(clusterPosts).mockRejectedValue(new Error('Embedding API failed'));

      const result = await runAnalyzePhase('test-run-cluster-err', makeConfig(), [makePost()]);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('Embedding API failed');
      expect(result.phase).toBe('analyze');
    });

    it('should return failure when scoring throws', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');
      const { scoreAll } = await import('../../../src/analysis/scorer');
      const { analyzeAllGaps } = await import('../../../src/analysis/gap-analyzer');

      vi.mocked(clusterPosts).mockResolvedValue([makeCluster()]);
      vi.mocked(scoreAll).mockRejectedValue(new Error('Anthropic rate limited'));
      vi.mocked(analyzeAllGaps).mockResolvedValue([]);

      const result = await runAnalyzePhase('test-run-score-err', makeConfig(), [makePost()]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Anthropic rate limited');
    });

    it('should return failure when gap analysis throws', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');
      const { scoreAll } = await import('../../../src/analysis/scorer');
      const { analyzeAllGaps } = await import('../../../src/analysis/gap-analyzer');

      vi.mocked(clusterPosts).mockResolvedValue([makeCluster()]);
      vi.mocked(scoreAll).mockResolvedValue([makeScoredProblem()]);
      vi.mocked(analyzeAllGaps).mockRejectedValue(new Error('Search API down'));

      const result = await runAnalyzePhase('test-run-gap-err', makeConfig(), [makePost()]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search API down');
    });
  });

  describe('edge cases', () => {
    it('should handle empty posts input', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');

      vi.mocked(clusterPosts).mockResolvedValue([]);

      const result = await runAnalyzePhase('test-run-no-posts', makeConfig(), []);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No clusters generated from posts');
    });

    it('should handle scoring returning empty array', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');
      const { scoreAll } = await import('../../../src/analysis/scorer');
      const { analyzeAllGaps } = await import('../../../src/analysis/gap-analyzer');

      vi.mocked(clusterPosts).mockResolvedValue([makeCluster()]);
      vi.mocked(scoreAll).mockResolvedValue([]);
      vi.mocked(analyzeAllGaps).mockResolvedValue([]);

      const result = await runAnalyzePhase('test-run-no-scored', makeConfig(), [makePost()]);

      expect(result.success).toBe(true);
      expect(result.data!.scoredCount).toBe(0);
      expect(result.data!.gapAnalysisCount).toBe(0);
    });

    it('should build gap analyses Map keyed by problemId', async () => {
      const { clusterPosts } = await import('../../../src/analysis/deduplicator');
      const { scoreAll } = await import('../../../src/analysis/scorer');
      const { analyzeAllGaps } = await import('../../../src/analysis/gap-analyzer');

      const cluster = makeCluster({ id: 'cluster-abc' });
      vi.mocked(clusterPosts).mockResolvedValue([cluster]);
      vi.mocked(scoreAll).mockResolvedValue([makeScoredProblem()]);
      vi.mocked(analyzeAllGaps).mockResolvedValue([makeGap('cluster-abc')]);

      const result = await runAnalyzePhase('test-run-gap-map', makeConfig(), [makePost()]);

      expect(result.data!.gapAnalyses.has('cluster-abc')).toBe(true);
      expect(result.data!.gapAnalyses.get('cluster-abc')!.problemId).toBe('cluster-abc');
    });
  });
});
