/**
 * Tests for backfill-evidence script
 *
 * Tests the pure computation function (computeEvidenceFromSources) thoroughly,
 * and verifies the backfillEvidence orchestrator with a mocked DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB client module before importing anything that depends on it
vi.mock('../../src/api/db/client', () => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockUpdateWhere = vi.fn();

  // Chainable select → from → where
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockResolvedValue([]);

  // Chainable update → set → where
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockResolvedValue(undefined);

  return {
    db: {
      select: mockSelect,
      update: mockUpdate,
    },
    ideas: {
      id: 'id',
      name: 'name',
      sources: 'sources',
      evidenceStrength: 'evidence_strength',
      briefType: 'brief_type',
      sourceCount: 'source_count',
      totalEngagement: 'total_engagement',
      platformCount: 'platform_count',
    },
    closeDatabase: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val, op: 'eq' })),
  isNotNull: vi.fn((col) => ({ col, op: 'isNotNull' })),
}));

import {
  computeEvidenceFromSources,
  backfillEvidence,
  type EvidenceFromSources,
} from '../../scripts/backfill-evidence';
import { db } from '../../src/api/db/client';

/** Helper to build a source entry */
function makeSource(overrides: {
  platform?: string;
  score?: number;
  commentCount?: number;
} = {}) {
  return {
    platform: overrides.platform ?? 'reddit',
    title: 'Test post',
    url: 'https://example.com/post',
    score: overrides.score ?? 10,
    commentCount: overrides.commentCount ?? 5,
    postedAt: '2026-01-15T00:00:00Z',
  };
}

// ─── computeEvidenceFromSources (pure function) ─────────────────────────────

describe('computeEvidenceFromSources', () => {
  describe('strong tier', () => {
    it('multi-platform + high engagement (>=100) = strong', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 80, commentCount: 30 }),
        makeSource({ platform: 'hn', score: 10, commentCount: 5 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.tier).toBe('strong');
      expect(result.sourceCount).toBe(2);
      expect(result.platformCount).toBe(2);
      expect(result.totalEngagement).toBe(125); // 80+30+10+5
    });

    it('multi-platform + sourceCount >= 3 = strong', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 5, commentCount: 2 }),
        makeSource({ platform: 'hn', score: 3, commentCount: 1 }),
        makeSource({ platform: 'reddit', score: 4, commentCount: 0 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.tier).toBe('strong');
      expect(result.sourceCount).toBe(3);
      expect(result.platformCount).toBe(2);
    });

    it('multi-platform + both conditions = strong', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 50, commentCount: 20 }),
        makeSource({ platform: 'hn', score: 30, commentCount: 10 }),
        makeSource({ platform: 'github', score: 20, commentCount: 5 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.tier).toBe('strong');
      expect(result.platformCount).toBe(3);
      expect(result.totalEngagement).toBe(135);
    });
  });

  describe('moderate tier', () => {
    it('single platform + high engagement (>=50) = moderate', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 40, commentCount: 15 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.tier).toBe('moderate');
      expect(result.totalEngagement).toBe(55);
    });

    it('sourceCount >= 2 (single platform, low engagement) = moderate', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 5, commentCount: 2 }),
        makeSource({ platform: 'reddit', score: 3, commentCount: 1 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.tier).toBe('moderate');
      expect(result.sourceCount).toBe(2);
      expect(result.platformCount).toBe(1);
    });

    it('multi-platform + low engagement + sourceCount < 3 = moderate', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 5, commentCount: 2 }),
        makeSource({ platform: 'hn', score: 3, commentCount: 1 }),
      ];
      const result = computeEvidenceFromSources(sources);
      // platformCount >= 2 but totalEngagement < 100 and sourceCount < 3
      // Still moderate via platformCount >= 2 in the moderate check
      expect(result.tier).toBe('moderate');
    });
  });

  describe('weak tier', () => {
    it('single source, single platform, low engagement = weak', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 10, commentCount: 5 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.tier).toBe('weak');
      expect(result.sourceCount).toBe(1);
      expect(result.platformCount).toBe(1);
      expect(result.totalEngagement).toBe(15);
    });

    it('single source, engagement just below 50 = weak', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 30, commentCount: 19 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.tier).toBe('weak');
      expect(result.totalEngagement).toBe(49);
    });

    it('empty sources array = weak with all zeros', () => {
      const result = computeEvidenceFromSources([]);
      expect(result.tier).toBe('weak');
      expect(result.sourceCount).toBe(0);
      expect(result.totalEngagement).toBe(0);
      expect(result.platformCount).toBe(0);
    });
  });

  describe('boundary conditions', () => {
    it('totalEngagement exactly 100 + multi-platform = strong', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 60, commentCount: 30 }),
        makeSource({ platform: 'hn', score: 5, commentCount: 5 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.totalEngagement).toBe(100);
      expect(result.tier).toBe('strong');
    });

    it('totalEngagement 99 + multi-platform + sourceCount < 3 = moderate', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 59, commentCount: 30 }),
        makeSource({ platform: 'hn', score: 5, commentCount: 5 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.totalEngagement).toBe(99);
      expect(result.tier).toBe('moderate');
    });

    it('totalEngagement exactly 50 + single platform + 1 source = moderate', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 30, commentCount: 20 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.totalEngagement).toBe(50);
      expect(result.tier).toBe('moderate');
    });

    it('totalEngagement 49 + single platform + 1 source = weak', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 29, commentCount: 20 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.totalEngagement).toBe(49);
      expect(result.tier).toBe('weak');
    });

    it('sourceCount exactly 3 + single platform = moderate (not strong)', () => {
      const sources = [
        makeSource({ platform: 'reddit', score: 2, commentCount: 1 }),
        makeSource({ platform: 'reddit', score: 2, commentCount: 1 }),
        makeSource({ platform: 'reddit', score: 2, commentCount: 1 }),
      ];
      const result = computeEvidenceFromSources(sources);
      // sourceCount >= 3 but platformCount < 2 → not strong
      // sourceCount >= 2 → moderate
      expect(result.tier).toBe('moderate');
    });
  });

  describe('engagement calculation', () => {
    it('sums score + commentCount across all sources', () => {
      const sources = [
        makeSource({ score: 10, commentCount: 5 }),
        makeSource({ score: 20, commentCount: 15 }),
        makeSource({ score: 0, commentCount: 0 }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.totalEngagement).toBe(50); // 10+5+20+15+0+0
    });

    it('counts unique platforms correctly with duplicates', () => {
      const sources = [
        makeSource({ platform: 'reddit' }),
        makeSource({ platform: 'reddit' }),
        makeSource({ platform: 'hn' }),
        makeSource({ platform: 'hn' }),
        makeSource({ platform: 'github' }),
      ];
      const result = computeEvidenceFromSources(sources);
      expect(result.platformCount).toBe(3);
      expect(result.sourceCount).toBe(5);
    });
  });
});

// ─── backfillEvidence (DB orchestration) ────────────────────────────────────

describe('backfillEvidence', () => {
  const mockSelect = db.select as ReturnType<typeof vi.fn>;
  const mockUpdate = db.update as ReturnType<typeof vi.fn>;

  // Access the chained mocks
  let mockWhere: ReturnType<typeof vi.fn>;
  let mockSet: ReturnType<typeof vi.fn>;
  let mockUpdateWhere: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Rebuild the chainable mock for each test
    const mockFrom = vi.fn();
    mockWhere = vi.fn();
    mockSet = vi.fn();
    mockUpdateWhere = vi.fn();

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);

    // Silence console.log during tests
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('dry-run queries ideas but makes no DB updates', async () => {
    mockWhere.mockResolvedValue([
      {
        id: 'idea-1',
        name: 'Test Idea',
        sources: [makeSource({ platform: 'reddit', score: 10, commentCount: 5 })],
      },
    ]);

    const stats = await backfillEvidence({ apply: false });

    expect(mockSelect).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(stats.total).toBe(1);
    expect(stats.updated).toBe(0);
  });

  it('apply mode queries ideas and updates each with computed evidence fields', async () => {
    mockWhere.mockResolvedValue([
      {
        id: 'idea-1',
        name: 'Strong Idea',
        sources: [
          makeSource({ platform: 'reddit', score: 80, commentCount: 30 }),
          makeSource({ platform: 'hn', score: 10, commentCount: 5 }),
        ],
      },
      {
        id: 'idea-2',
        name: 'Weak Idea',
        sources: [
          makeSource({ platform: 'reddit', score: 5, commentCount: 2 }),
        ],
      },
    ]);

    const stats = await backfillEvidence({ apply: true });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(stats.updated).toBe(2);
    expect(stats.strong).toBe(1);
    expect(stats.weak).toBe(1);

    // Check that the first update set the correct values
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceStrength: 'strong',
        briefType: 'full',
        sourceCount: 2,
        totalEngagement: 125,
        platformCount: 2,
      })
    );
  });

  it('skips ideas with null sources', async () => {
    mockWhere.mockResolvedValue([
      {
        id: 'idea-null',
        name: 'Null Sources Idea',
        sources: null,
      },
    ]);

    const stats = await backfillEvidence({ apply: true });

    expect(stats.skipped).toBe(1);
    expect(stats.updated).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('skips ideas with empty sources array', async () => {
    mockWhere.mockResolvedValue([
      {
        id: 'idea-empty',
        name: 'Empty Sources Idea',
        sources: [],
      },
    ]);

    const stats = await backfillEvidence({ apply: true });

    expect(stats.skipped).toBe(1);
    expect(stats.updated).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('reports correct tier counts in stats', async () => {
    mockWhere.mockResolvedValue([
      {
        id: 'strong-1',
        name: 'Strong Idea 1',
        sources: [
          makeSource({ platform: 'reddit', score: 80, commentCount: 30 }),
          makeSource({ platform: 'hn', score: 10, commentCount: 5 }),
        ],
      },
      {
        id: 'moderate-1',
        name: 'Moderate Idea 1',
        sources: [
          makeSource({ platform: 'reddit', score: 40, commentCount: 15 }),
        ],
      },
      {
        id: 'moderate-2',
        name: 'Moderate Idea 2',
        sources: [
          makeSource({ platform: 'reddit', score: 5, commentCount: 2 }),
          makeSource({ platform: 'reddit', score: 3, commentCount: 1 }),
        ],
      },
      {
        id: 'weak-1',
        name: 'Weak Idea 1',
        sources: [
          makeSource({ platform: 'reddit', score: 5, commentCount: 2 }),
        ],
      },
      {
        id: 'skip-1',
        name: 'Skipped Idea',
        sources: null,
      },
    ]);

    const stats = await backfillEvidence({ apply: false });

    expect(stats.total).toBe(5);
    expect(stats.strong).toBe(1);
    expect(stats.moderate).toBe(2);
    expect(stats.weak).toBe(1);
    expect(stats.skipped).toBe(1);
  });

  it('handles an empty database gracefully', async () => {
    mockWhere.mockResolvedValue([]);

    const stats = await backfillEvidence({ apply: true });

    expect(stats.total).toBe(0);
    expect(stats.strong).toBe(0);
    expect(stats.moderate).toBe(0);
    expect(stats.weak).toBe(0);
    expect(stats.skipped).toBe(0);
    expect(stats.updated).toBe(0);
  });
});
