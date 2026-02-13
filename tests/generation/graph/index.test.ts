import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoredProblem } from '../../../src/analysis/scorer';
import { CLAUDE_MODELS } from '../../../src/config/models';
import { runSingleBriefGraph } from '../../../src/generation/graph';
import { makeGenerationBrief } from '../../fixtures';

vi.mock('../../../src/generation/brief-generator', () => ({
  generateAllBriefs: vi.fn(),
  validateBriefQuality: vi.fn(),
}));

function makeScoredProblem(overrides: Partial<ScoredProblem> = {}): ScoredProblem {
  return {
    id: 'cluster_graph_1',
    representativePost: {
      id: 'post_1',
      source: 'reddit',
      sourceId: 'reddit_1',
      title: 'Need better tooling',
      body: 'Current options are painful',
      url: 'https://example.com/post/1',
      author: 'tester',
      score: 100,
      commentCount: 20,
      createdAt: new Date(),
      scrapedAt: new Date(),
      signals: ['need', 'pain'],
    },
    relatedPosts: [],
    frequency: 3,
    totalScore: 100,
    embedding: [],
    problemStatement: 'Need better tooling',
    sources: ['reddit'],
    scores: {
      frequency: 6,
      severity: 6,
      marketSize: 6,
      technicalComplexity: 4,
      timeToMvp: 4,
      engagement: 6,
      impact: 36,
      effort: 16,
      priority: 10,
    },
    reasoning: {
      severity: 'high',
      marketSize: 'medium',
      technicalComplexity: 'medium',
    },
    ...overrides,
  };
}

describe('runSingleBriefGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns on first pass when critic validates output', async () => {
    const { generateAllBriefs, validateBriefQuality } = await import('../../../src/generation/brief-generator');
    const brief = makeGenerationBrief({ id: 'graph_brief_1' });

    vi.mocked(generateAllBriefs).mockResolvedValue([brief]);
    vi.mocked(validateBriefQuality).mockReturnValue({ valid: true, reasons: [] });

    const result = await runSingleBriefGraph({
      problem: makeScoredProblem(),
      gapAnalyses: new Map(),
      config: {},
    });

    expect(result.brief.id).toBe('graph_brief_1');
    expect(result.attemptsUsed).toBe(1);
    expect(result.retried).toBe(false);
    expect(result.passedQuality).toBe(true);
    expect(result.modelsUsed).toEqual([CLAUDE_MODELS.HAIKU]);
    expect(result.failedSections).toEqual([]);
    expect(result.reasons).toEqual([]);
    expect(result.sectionRetryCounts.core).toBe(0);
    expect(generateAllBriefs).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Map),
      expect.objectContaining({ model: CLAUDE_MODELS.HAIKU }),
    );
  });

  it('retries once when critic fails first attempt', async () => {
    const { generateAllBriefs, validateBriefQuality } = await import('../../../src/generation/brief-generator');
    const first = makeGenerationBrief({ id: 'graph_brief_first' });
    const second = makeGenerationBrief({ id: 'graph_brief_second' });

    vi.mocked(generateAllBriefs)
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([second]);

    vi.mocked(validateBriefQuality)
      .mockReturnValueOnce({ valid: false, reasons: ['name too short (< 2 chars)'] })
      .mockReturnValueOnce({ valid: true, reasons: [] });

    const result = await runSingleBriefGraph({
      problem: makeScoredProblem(),
      gapAnalyses: new Map(),
      config: { maxAttempts: 2 },
    });

    expect(result.brief.id).toBe('graph_brief_first');
    expect(result.attemptsUsed).toBe(2);
    expect(result.retried).toBe(true);
    expect(result.passedQuality).toBe(true);
    expect(result.modelsUsed).toEqual([CLAUDE_MODELS.HAIKU, CLAUDE_MODELS.SONNET]);
    expect(result.sectionRetryCounts.core).toBe(1);
    expect(generateAllBriefs).toHaveBeenCalledTimes(2);
  });

  it('replaces only failed sections during retry synthesis', async () => {
    const { generateAllBriefs, validateBriefQuality } = await import('../../../src/generation/brief-generator');

    const first = makeGenerationBrief({
      id: 'graph_first',
      name: 'A',
      technicalSpec: {
        stack: ['TypeScript', 'Node.js'],
        architecture: 'keep-original-arch',
        estimatedEffort: 'weekend',
      },
    });

    const second = makeGenerationBrief({
      id: 'graph_second',
      name: 'Improved Name',
      technicalSpec: {
        stack: ['Rust', 'Postgres'],
        architecture: 'new-arch-should-not-replace',
        estimatedEffort: 'month',
      },
    });

    vi.mocked(generateAllBriefs)
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([second]);

    vi.mocked(validateBriefQuality)
      .mockReturnValueOnce({ valid: false, reasons: ['name too short (< 2 chars)'] })
      .mockReturnValueOnce({ valid: true, reasons: [] });

    const result = await runSingleBriefGraph({
      problem: makeScoredProblem(),
      gapAnalyses: new Map(),
      config: { maxAttempts: 2 },
    });

    expect(result.brief.name).toBe('Improved Name');
    expect(result.brief.technicalSpec.architecture).toBe('keep-original-arch');
  });

  it('uses full cascade when target model is Opus', async () => {
    const { generateAllBriefs, validateBriefQuality } = await import('../../../src/generation/brief-generator');
    const first = makeGenerationBrief({ id: 'graph_brief_1' });
    const second = makeGenerationBrief({ id: 'graph_brief_2' });
    const third = makeGenerationBrief({ id: 'graph_brief_3' });

    vi.mocked(generateAllBriefs)
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([second])
      .mockResolvedValueOnce([third]);

    vi.mocked(validateBriefQuality)
      .mockReturnValueOnce({ valid: false, reasons: ['name too short (< 2 chars)'] })
      .mockReturnValueOnce({ valid: false, reasons: ['name too short (< 2 chars)'] })
      .mockReturnValueOnce({ valid: true, reasons: [] });

    const result = await runSingleBriefGraph({
      problem: makeScoredProblem(),
      gapAnalyses: new Map(),
      config: { maxAttempts: 3, model: CLAUDE_MODELS.OPUS },
    });

    expect(result.attemptsUsed).toBe(3);
    expect(result.modelsUsed).toEqual([
      CLAUDE_MODELS.HAIKU,
      CLAUDE_MODELS.SONNET,
      CLAUDE_MODELS.OPUS,
    ]);
    expect(generateAllBriefs).toHaveBeenNthCalledWith(
      1,
      expect.any(Array),
      expect.any(Map),
      expect.objectContaining({ model: CLAUDE_MODELS.HAIKU }),
    );
    expect(generateAllBriefs).toHaveBeenNthCalledWith(
      2,
      expect.any(Array),
      expect.any(Map),
      expect.objectContaining({ model: CLAUDE_MODELS.SONNET }),
    );
    expect(generateAllBriefs).toHaveBeenNthCalledWith(
      3,
      expect.any(Array),
      expect.any(Map),
      expect.objectContaining({ model: CLAUDE_MODELS.OPUS }),
    );
  });
});
