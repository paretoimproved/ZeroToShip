/**
 * Ideas Endpoint Tests for ZeroToShip API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  canAccessFullBrief,
  canAccessArchive,
  canSearch,
  canExport,
  getUpgradePrompt,
} from '../../src/api/config/tiers';
import {
  filterIdeaForTier,
  filterIdeasForTier,
} from '../../src/api/config/filters';
import type { IdeaBrief } from '../../src/api/config/filters';
import {
  IdeaSummarySchema,
  IdeaListResponseSchema,
  IdeaBriefSchema,
  ArchiveQuerySchema,
  ApiErrorSchema,
} from '../../src/api/schemas';
import { expectSchemaValid, expectSchemaInvalid } from './helpers';
import { mockIdea, makeIdeaBrief } from '../fixtures';

describe('Tier Filtering', () => {
  describe('filterIdeaForTier', () => {
    it('should return summary without brief for anonymous tier', () => {
      const result = filterIdeaForTier(mockIdea, 'anonymous');

      expect(result.id).toBe(mockIdea.id);
      expect(result.name).toBe(mockIdea.name);
      expect(result.tagline).toBe(mockIdea.tagline);
      expect(result.priorityScore).toBe(mockIdea.priorityScore);
      expect(result.effortEstimate).toBe(mockIdea.effortEstimate);
      expect(result.brief).toBeUndefined();
    });

    it('should include full brief for free tier', () => {
      const result = filterIdeaForTier(mockIdea, 'free');

      expect(result.brief).toBeDefined();
      expect(result.brief?.problemStatement).toBe(mockIdea.problemStatement);
    });

    it('should include full brief for pro tier', () => {
      const result = filterIdeaForTier(mockIdea, 'pro');

      expect(result.brief).toBeDefined();
      expect(result.brief?.technicalSpec).toBeDefined();
      expect(result.brief?.businessModel).toBeDefined();
    });

    it('should include full brief for enterprise tier', () => {
      const result = filterIdeaForTier(mockIdea, 'enterprise');

      expect(result.brief).toBeDefined();
      expect(result.brief?.technicalSpec).toBeDefined();
    });
  });

  describe('filterIdeasForTier', () => {
    const mockIdeas = Array.from({ length: 20 }, (_, i) => ({
      ...mockIdea,
      id: `${i}`,
      name: `Idea ${i}`,
      priorityScore: 100 - i,
    }));

    it('should limit anonymous tier to 3 ideas', () => {
      const result = filterIdeasForTier(mockIdeas, 'anonymous');

      expect(result.ideas.length).toBe(3);
      expect(result.total).toBe(20);
      expect(result.limited).toBe(true);
    });

    it('should limit free tier to 3 ideas', () => {
      const result = filterIdeasForTier(mockIdeas, 'free');

      expect(result.ideas.length).toBe(3);
      expect(result.limited).toBe(true);
    });

    it('should limit pro tier to 10 ideas', () => {
      const result = filterIdeasForTier(mockIdeas, 'pro');

      expect(result.ideas.length).toBe(10);
      expect(result.limited).toBe(true);
    });

    it('should not limit enterprise tier', () => {
      const result = filterIdeasForTier(mockIdeas, 'enterprise');

      expect(result.ideas.length).toBe(20);
      expect(result.limited).toBe(false);
    });

    it('should not limit when fewer ideas than limit', () => {
      const fewIdeas = mockIdeas.slice(0, 2);
      const result = filterIdeasForTier(fewIdeas, 'anonymous');

      expect(result.ideas.length).toBe(2);
      expect(result.limited).toBe(false);
    });

    it('should preserve idea order', () => {
      const result = filterIdeasForTier(mockIdeas, 'pro');

      expect(result.ideas[0].name).toBe('Idea 0');
      expect(result.ideas[9].name).toBe('Idea 9');
    });
  });
});

describe('Access Control Functions', () => {
  describe('canAccessFullBrief', () => {
    it('should return false for anonymous', () => {
      expect(canAccessFullBrief('anonymous')).toBe(false);
    });

    it('should return true for free', () => {
      expect(canAccessFullBrief('free')).toBe(true);
    });

    it('should return true for pro', () => {
      expect(canAccessFullBrief('pro')).toBe(true);
    });

    it('should return true for enterprise', () => {
      expect(canAccessFullBrief('enterprise')).toBe(true);
    });
  });

  describe('canAccessArchive', () => {
    it('should return true for all tiers (preview mode for lower tiers)', () => {
      expect(canAccessArchive('anonymous')).toBe(true);
      expect(canAccessArchive('free')).toBe(true);
      expect(canAccessArchive('pro')).toBe(true);
      expect(canAccessArchive('enterprise')).toBe(true);
    });
  });

  describe('canSearch', () => {
    it('should be available for pro and above', () => {
      expect(canSearch('anonymous')).toBe(false);
      expect(canSearch('free')).toBe(false);
      expect(canSearch('pro')).toBe(true);
      expect(canSearch('enterprise')).toBe(true);
    });
  });

  describe('canExport', () => {
    it('should only be available for enterprise', () => {
      expect(canExport('anonymous')).toBe(false);
      expect(canExport('free')).toBe(false);
      expect(canExport('pro')).toBe(false);
      expect(canExport('enterprise')).toBe(true);
    });
  });
});

describe('Upgrade Prompts', () => {
  describe('getUpgradePrompt', () => {
    it('should return correct prompt for fullBrief feature', () => {
      const prompt = getUpgradePrompt('ideas.fullBrief');

      expect(prompt.requiredTier).toBe('free');
      expect(prompt.message).toContain('Free');
      expect(prompt.upgradeUrl).toBe('https://zerotoship.dev/pricing');
    });

    it('should return correct prompt for search feature', () => {
      const prompt = getUpgradePrompt('ideas.search');

      expect(prompt.requiredTier).toBe('pro');
      expect(prompt.message).toContain('Builder');
    });

    it('should return default prompt for unknown feature', () => {
      const prompt = getUpgradePrompt('unknown.feature');

      expect(prompt.requiredTier).toBe('pro');
      expect(prompt.upgradeUrl).toBe('https://zerotoship.dev/pricing');
    });
  });
});

describe('Idea Summary Fields', () => {
  it('should include all required summary fields', () => {
    const result = filterIdeaForTier(mockIdea, 'free');

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('tagline');
    expect(result).toHaveProperty('priorityScore');
    expect(result).toHaveProperty('effortEstimate');
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('generatedAt');
  });

  it('should have correct types for summary fields', () => {
    const result = filterIdeaForTier(mockIdea, 'free');

    expect(typeof result.id).toBe('string');
    expect(typeof result.name).toBe('string');
    expect(typeof result.tagline).toBe('string');
    expect(typeof result.priorityScore).toBe('number');
    expect(typeof result.effortEstimate).toBe('string');
    expect(typeof result.generatedAt).toBe('string');
  });
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('Schema Validation', () => {
  describe('IdeaSummarySchema', () => {
    it('should validate a free-tier summary (no brief)', () => {
      const result = filterIdeaForTier(mockIdea, 'free');
      expectSchemaValid(IdeaSummarySchema, result);
    });

    it('should validate a pro-tier summary (with brief)', () => {
      const result = filterIdeaForTier(mockIdea, 'pro');
      expectSchemaValid(IdeaSummarySchema, result);
    });

    it('should validate an enterprise-tier summary (with brief)', () => {
      const result = filterIdeaForTier(mockIdea, 'enterprise');
      expectSchemaValid(IdeaSummarySchema, result);
    });

    it('should validate summary with minimal fields', () => {
      const minimalIdea: IdeaBrief = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Minimal',
        tagline: 'Minimal idea',
        priorityScore: 50,
        effortEstimate: 'weekend',
        problemStatement: 'A problem',
        generatedAt: '2026-01-31T00:00:00.000Z',
      };
      const result = filterIdeaForTier(minimalIdea, 'free');
      expectSchemaValid(IdeaSummarySchema, result);
    });
  });

  describe('IdeaBriefSchema', () => {
    it('should validate the full mock idea brief', () => {
      expectSchemaValid(IdeaBriefSchema, mockIdea);
    });

    it('should validate a minimal idea brief', () => {
      const minimal = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Minimal',
        tagline: 'A minimal idea',
        priorityScore: 50,
        effortEstimate: 'weekend',
        problemStatement: 'A real problem',
        generatedAt: '2026-01-31T00:00:00.000Z',
      };
      expectSchemaValid(IdeaBriefSchema, minimal);
    });

    it('should reject idea brief with missing required fields', () => {
      const invalid = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Missing Fields',
        // missing tagline, priorityScore, effortEstimate, problemStatement, generatedAt
      };
      expectSchemaInvalid(IdeaBriefSchema, invalid);
    });

    it('should reject idea brief with invalid UUID', () => {
      const invalid = {
        ...mockIdea,
        id: 'not-a-uuid',
      };
      expectSchemaInvalid(IdeaBriefSchema, invalid);
    });

    it('should reject idea brief with invalid effortEstimate', () => {
      const invalid = {
        ...mockIdea,
        effortEstimate: 'decade', // not in enum
      };
      expectSchemaInvalid(IdeaBriefSchema, invalid);
    });

    it('should reject idea brief with wrong priorityScore type', () => {
      const invalid = {
        ...mockIdea,
        priorityScore: 'high', // should be number
      };
      expectSchemaInvalid(IdeaBriefSchema, invalid);
    });
  });

  describe('IdeaListResponseSchema', () => {
    it('should validate a well-formed ideas list response', () => {
      const ideas = Array.from({ length: 3 }, (_, i) => ({
        ...mockIdea,
        id: `123e4567-e89b-12d3-a456-42661417400${i}`,
        name: `Idea ${i}`,
      }));
      const { ideas: filtered, total } = filterIdeasForTier(ideas, 'free');

      const response = {
        ideas: filtered,
        total,
        page: 1,
        pageSize: filtered.length,
        tier: 'free' as const,
      };

      expectSchemaValid(IdeaListResponseSchema, response);
    });

    it('should validate an empty ideas list response', () => {
      const response = {
        ideas: [],
        total: 0,
        page: 1,
        pageSize: 0,
        tier: 'anonymous' as const,
      };

      expectSchemaValid(IdeaListResponseSchema, response);
    });

    it('should reject response with invalid tier', () => {
      const response = {
        ideas: [],
        total: 0,
        page: 1,
        pageSize: 0,
        tier: 'premium', // invalid
      };

      expectSchemaInvalid(IdeaListResponseSchema, response);
    });

    it('should reject response with missing total', () => {
      const response = {
        ideas: [],
        page: 1,
        pageSize: 0,
        tier: 'free',
      };

      expectSchemaInvalid(IdeaListResponseSchema, response);
    });
  });

  describe('ApiErrorSchema', () => {
    it('should validate a standard error response', () => {
      const error = {
        code: 'NOT_FOUND',
        message: 'Idea not found',
      };
      expectSchemaValid(ApiErrorSchema, error);
    });

    it('should validate an error response with details', () => {
      const error = {
        code: 'TIER_RESTRICTED',
        message: 'This feature requires pro tier or above',
        details: {
          feature: 'ideas.fullBrief',
          requiredTier: 'pro',
          currentTier: 'free',
          upgradeUrl: 'https://zerotoship.dev/pricing',
        },
      };
      expectSchemaValid(ApiErrorSchema, error);
    });

    it('should reject error response with missing code', () => {
      const error = {
        message: 'Something went wrong',
      };
      expectSchemaInvalid(ApiErrorSchema, error);
    });

    it('should reject error response with missing message', () => {
      const error = {
        code: 'INTERNAL_ERROR',
      };
      expectSchemaInvalid(ApiErrorSchema, error);
    });
  });
});

// ============================================================================
// Request Validation (Negative Tests)
// ============================================================================

describe('Request Validation', () => {
  describe('ArchiveQuerySchema', () => {
    it('should accept valid archive query with defaults', () => {
      const result = ArchiveQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(10);
      }
    });

    it('should accept valid archive query with all params', () => {
      const result = ArchiveQuerySchema.safeParse({
        page: 2,
        pageSize: 25,
        category: 'developer-tools',
        effort: 'week',
        minScore: 80,
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-02-01T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject page less than 1', () => {
      const result = ArchiveQuerySchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative page', () => {
      const result = ArchiveQuerySchema.safeParse({ page: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject pageSize over 100', () => {
      const result = ArchiveQuerySchema.safeParse({ pageSize: 101 });
      expect(result.success).toBe(false);
    });

    it('should reject pageSize of 0', () => {
      const result = ArchiveQuerySchema.safeParse({ pageSize: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject invalid effort level', () => {
      const result = ArchiveQuerySchema.safeParse({ effort: 'decade' });
      expect(result.success).toBe(false);
    });

    it('should reject minScore over 100', () => {
      const result = ArchiveQuerySchema.safeParse({ minScore: 150 });
      expect(result.success).toBe(false);
    });

    it('should reject negative minScore', () => {
      const result = ArchiveQuerySchema.safeParse({ minScore: -10 });
      expect(result.success).toBe(false);
    });

    it('should reject invalid from date format', () => {
      const result = ArchiveQuerySchema.safeParse({ from: 'not-a-date' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid to date format', () => {
      const result = ArchiveQuerySchema.safeParse({ to: '2026-13-01' });
      expect(result.success).toBe(false);
    });

    it('should coerce string numbers for page and pageSize', () => {
      const result = ArchiveQuerySchema.safeParse({ page: '3', pageSize: '20' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.pageSize).toBe(20);
      }
    });
  });
});

describe('Edge Cases', () => {
  it('should handle empty ideas array', () => {
    const result = filterIdeasForTier([], 'pro');

    expect(result.ideas).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.limited).toBe(false);
  });

  it('should handle idea with minimal fields', () => {
    const minimalIdea: IdeaBrief = {
      id: 'min-1',
      name: 'Minimal',
      tagline: 'Minimal idea',
      priorityScore: 50,
      effortEstimate: 'weekend',
      problemStatement: 'A problem',
      generatedAt: '2026-01-31T00:00:00.000Z',
    };

    const result = filterIdeaForTier(minimalIdea, 'enterprise');

    expect(result.id).toBe('min-1');
    expect(result.brief).toBeDefined();
  });

  it('should handle exactly limit number of ideas', () => {
    const threeIdeas = Array.from({ length: 3 }, (_, i) => ({
      ...mockIdea,
      id: `${i}`,
    }));

    const result = filterIdeasForTier(threeIdeas, 'free');

    expect(result.ideas.length).toBe(3);
    expect(result.limited).toBe(false);
  });
});
