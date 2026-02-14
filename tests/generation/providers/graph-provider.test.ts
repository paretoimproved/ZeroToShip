import { describe, expect, it, vi } from 'vitest';
import type { ScoredProblem } from '../../../src/analysis/scorer';
import { CLAUDE_MODELS } from '../../../src/config/models';
import { makeGenerationBrief } from '../../fixtures';
import { GraphGenerationProvider } from '../../../src/generation/providers/graph-provider';
import { LegacyGenerationProvider } from '../../../src/generation/providers/legacy-provider';

vi.mock('../../../src/generation/graph', () => ({
  runSingleBriefGraph: vi.fn(),
}));

function makeScoredProblem(overrides: Partial<ScoredProblem> = {}): ScoredProblem {
  return {
    id: 'cluster_graph_provider_1',
    representativePost: {
      id: 'post_provider_1',
      source: 'reddit',
      sourceId: 'reddit_provider_1',
      title: 'Need better process',
      body: 'Painful current workflow',
      url: 'https://example.com/post/provider/1',
      author: 'tester',
      score: 42,
      commentCount: 8,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: ['need'],
    },
    relatedPosts: [],
    frequency: 2,
    totalScore: 42,
    embedding: [],
    problemStatement: 'Need better process',
    sources: ['reddit'],
    scores: {
      frequency: 4,
      severity: 5,
      marketSize: 4,
      technicalComplexity: 4,
      timeToMvp: 4,
      engagement: 5,
      impact: 20,
      effort: 16,
      priority: 8,
    },
    reasoning: {
      severity: 'medium',
      marketSize: 'medium',
      technicalComplexity: 'medium',
    },
    ...overrides,
  };
}

describe('GraphGenerationProvider', () => {
  it('annotates generation metadata when graph succeeds', async () => {
    const { runSingleBriefGraph } = await import('../../../src/generation/graph');

    vi.mocked(runSingleBriefGraph).mockResolvedValue({
      brief: makeGenerationBrief({ id: 'graph_success_brief' }),
      attemptsUsed: 2,
      retried: true,
      passedQuality: true,
      modelsUsed: [CLAUDE_MODELS.HAIKU, CLAUDE_MODELS.SONNET],
      failedSections: [],
      reasons: [],
      trace: [
        {
          attempt: 1,
          model: CLAUDE_MODELS.HAIKU,
          retrySections: [],
          mergedSections: [],
          passedQuality: false,
          reasons: ['name too short (< 2 chars)'],
          failedSections: ['core'],
          startedAt: '2026-02-13T00:00:00.000Z',
          finishedAt: '2026-02-13T00:00:01.000Z',
        },
        {
          attempt: 2,
          model: CLAUDE_MODELS.SONNET,
          retrySections: ['core'],
          mergedSections: ['core'],
          passedQuality: true,
          reasons: [],
          failedSections: [],
          startedAt: '2026-02-13T00:00:02.000Z',
          finishedAt: '2026-02-13T00:00:03.000Z',
        },
      ],
      sectionRetryCounts: {
        core: 1,
        problem: 0,
        audience: 0,
        market: 0,
        solution: 0,
        features: 0,
        technical: 0,
        business_model: 0,
        gtm: 0,
        risks: 0,
      },
    });

    const provider = new GraphGenerationProvider();
    const result = await provider.generate({
      scoredProblems: [makeScoredProblem()],
      gapAnalyses: new Map(),
      config: {},
    });

    expect(result[0].id).toBe('graph_success_brief');
    expect(result[0].generationMeta?.providerMode).toBe('graph');
    expect(result[0].generationMeta?.graphAttemptCount).toBe(2);
    expect(result[0].generationMeta?.graphModelsUsed).toEqual([
      CLAUDE_MODELS.HAIKU,
      CLAUDE_MODELS.SONNET,
    ]);
    expect(result[0].generationMeta?.graphRetriedSections).toContain('core');
    expect(result[0].generationMeta?.graphTrace).toHaveLength(2);
    expect(result[0].generationMeta?.graphTrace?.[0]?.model).toBe(CLAUDE_MODELS.HAIKU);
  });

  it('falls back to legacy provider when graph execution throws', async () => {
    const { runSingleBriefGraph } = await import('../../../src/generation/graph');
    const legacySpy = vi.spyOn(LegacyGenerationProvider.prototype, 'generate')
      .mockResolvedValue([makeGenerationBrief({ id: 'legacy_fallback_brief' })]);

    vi.mocked(runSingleBriefGraph).mockRejectedValue(new Error('graph failed'));

    const provider = new GraphGenerationProvider();
    const result = await provider.generate({
      scoredProblems: [makeScoredProblem()],
      gapAnalyses: new Map(),
      config: {},
    });

    expect(legacySpy).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('legacy_fallback_brief');
    expect(result[0].generationMeta?.providerMode).toBe('legacy');

    legacySpy.mockRestore();
  });
});
