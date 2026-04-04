/**
 * Tests for cross-run deduplication in the Generate Phase.
 *
 * Validates that deduplicateAgainstExisting() correctly filters problems
 * that match already-published briefs in the database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deduplicateAgainstExisting } from '../../../src/scheduler/phases/generate';
import { cosineSimilarity } from '../../../src/analysis/similarity';
import type { ScoredProblem } from '../../../src/analysis/scorer';
import type { ProblemCluster } from '../../../src/analysis/deduplicator';

// Mock database client — return empty array by default
const mockWhere = vi.fn().mockResolvedValue([]);
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock('../../../src/api/db/client', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
  ideas: {
    embedding: 'embedding',
    isPublished: 'isPublished',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
  isNotNull: vi.fn((col: unknown) => ({ type: 'isNotNull', col })),
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
}));

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

/**
 * Helper: create a normalized unit vector of a given dimension.
 * The vector has value 1/sqrt(dim) in all components (magnitude = 1).
 */
function makeUnitVector(dim: number): number[] {
  const val = 1 / Math.sqrt(dim);
  return new Array(dim).fill(val);
}

/**
 * Helper: create a vector that is orthogonal to the unit vector.
 * First component is positive, second is negative, rest are zero.
 * Cosine similarity with the unit vector will be ~0.
 */
function makeOrthogonalVector(dim: number): number[] {
  const vec = new Array(dim).fill(0);
  vec[0] = 1 / Math.sqrt(2);
  vec[1] = -1 / Math.sqrt(2);
  return vec;
}

describe('deduplicateAgainstExisting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockResolvedValue([]);
  });

  it('returns all problems when no existing briefs in DB', async () => {
    mockWhere.mockResolvedValue([]);

    const problems = [
      makeScoredProblem({ id: 'p1', embedding: makeUnitVector(3) }),
      makeScoredProblem({ id: 'p2', embedding: makeOrthogonalVector(3) }),
    ];

    const result = await deduplicateAgainstExisting(problems);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('p1');
    expect(result[1].id).toBe('p2');
  });

  it('removes problems with embeddings similar to existing published briefs', async () => {
    const existingEmbedding = makeUnitVector(3);
    mockWhere.mockResolvedValue([{ embedding: existingEmbedding }]);

    // This problem's embedding is identical to the existing one (similarity = 1.0)
    const duplicate = makeScoredProblem({
      id: 'dup',
      embedding: [...existingEmbedding],
    });
    // This problem's embedding is orthogonal (similarity ~ 0)
    const unique = makeScoredProblem({
      id: 'unique',
      embedding: makeOrthogonalVector(3),
    });

    const result = await deduplicateAgainstExisting([duplicate, unique]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('unique');
  });

  it('returns all problems when existing briefs have dissimilar embeddings', async () => {
    mockWhere.mockResolvedValue([{ embedding: makeOrthogonalVector(3) }]);

    const problems = [
      makeScoredProblem({ id: 'p1', embedding: makeUnitVector(3) }),
    ];

    const result = await deduplicateAgainstExisting(problems);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('returns all problems on DB query failure (graceful fallback)', async () => {
    mockWhere.mockRejectedValue(new Error('connection refused'));

    const problems = [
      makeScoredProblem({ id: 'p1', embedding: makeUnitVector(3) }),
    ];

    const result = await deduplicateAgainstExisting(problems);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('includes problems with empty embedding (skips comparison)', async () => {
    const existingEmbedding = makeUnitVector(3);
    mockWhere.mockResolvedValue([{ embedding: existingEmbedding }]);

    const noEmbedding = makeScoredProblem({ id: 'no-emb', embedding: [] });
    const withEmbedding = makeScoredProblem({
      id: 'with-emb',
      embedding: [...existingEmbedding],
    });

    const result = await deduplicateAgainstExisting([noEmbedding, withEmbedding]);

    // noEmbedding should be included (skipped), withEmbedding should be removed (duplicate)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('no-emb');
  });

  it('skips existing briefs with null embedding in comparisons', async () => {
    mockWhere.mockResolvedValue([
      { embedding: null },
      { embedding: [] },
      { embedding: makeOrthogonalVector(3) },
    ]);

    const problems = [
      makeScoredProblem({ id: 'p1', embedding: makeUnitVector(3) }),
    ];

    // Only the orthogonal vector is a valid existing embedding,
    // and it's dissimilar to the unit vector, so p1 should pass through
    const result = await deduplicateAgainstExisting(problems);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('removes problems at exact threshold (0.85)', async () => {
    // Create two vectors whose cosine similarity is exactly 0.85
    // v1 = [1, 0], v2 = [cos(theta), sin(theta)] where cos(theta) = 0.85
    const theta = Math.acos(0.85);
    const existingEmbedding = [1, 0];
    const borderlineEmbedding = [Math.cos(theta), Math.sin(theta)];

    // Verify the similarity is at the threshold
    const sim = cosineSimilarity(borderlineEmbedding, existingEmbedding);
    expect(sim).toBeCloseTo(0.85, 10);

    mockWhere.mockResolvedValue([{ embedding: existingEmbedding }]);

    const problem = makeScoredProblem({
      id: 'borderline',
      embedding: borderlineEmbedding,
    });

    const result = await deduplicateAgainstExisting([problem]);

    // Similarity >= 0.85 should be removed
    expect(result).toHaveLength(0);
  });

  it('includes problems just below threshold (0.84)', async () => {
    // Create two vectors whose cosine similarity is 0.84 (just below 0.85)
    const theta = Math.acos(0.84);
    const existingEmbedding = [1, 0];
    const belowThresholdEmbedding = [Math.cos(theta), Math.sin(theta)];

    // Verify the similarity is below threshold
    const sim = cosineSimilarity(belowThresholdEmbedding, existingEmbedding);
    expect(sim).toBeCloseTo(0.84, 10);

    mockWhere.mockResolvedValue([{ embedding: existingEmbedding }]);

    const problem = makeScoredProblem({
      id: 'below-threshold',
      embedding: belowThresholdEmbedding,
    });

    const result = await deduplicateAgainstExisting([problem]);

    // Similarity < 0.85 should be included
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('below-threshold');
  });
});
