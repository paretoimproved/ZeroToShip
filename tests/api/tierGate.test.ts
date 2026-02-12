/**
 * Tier Gate Middleware Tests for ZeroToShip API
 *
 * Tests idea filtering, tier gating, and summary/brief conversion logic.
 */

import { describe, it, expect } from 'vitest';
import {
  filterIdeaForTier,
  filterIdeasForTier,
  hasAccess,
  canAccessArchive,
  canAccessFullBrief,
  canSearch,
  canExport,
  getIdeasLimit,
} from '../../src/api/middleware/tierGate';
import type { IdeaBrief, UserTier } from '../../src/api/schemas';
import { makeIdeaBrief } from '../fixtures';

describe('filterIdeaForTier', () => {
  const fullBrief = makeIdeaBrief();

  describe('anonymous tier', () => {
    it('should return summary without brief for anonymous', () => {
      const result = filterIdeaForTier(fullBrief, 'anonymous');
      expect(result.id).toBe(fullBrief.id);
      expect(result.name).toBe(fullBrief.name);
      expect(result.tagline).toBe(fullBrief.tagline);
      expect(result.priorityScore).toBe(fullBrief.priorityScore);
      expect(result.effortEstimate).toBe(fullBrief.effortEstimate);
      expect(result.category).toBe(fullBrief.category);
      expect(result.generatedAt).toBe(fullBrief.generatedAt);
      expect(result.brief).toBeUndefined();
    });
  });

  describe('free, pro, and enterprise tiers', () => {
    it('should include full brief for free', () => {
      const result = filterIdeaForTier(fullBrief, 'free');
      expect(result.brief).toBeDefined();
      expect(result.brief?.problemStatement).toBe(fullBrief.problemStatement);
    });

    it('should include full brief for pro', () => {
      const result = filterIdeaForTier(fullBrief, 'pro');
      expect(result.brief).toBeDefined();
      expect(result.brief?.problemStatement).toBe(fullBrief.problemStatement);
      expect(result.brief?.technicalSpec).toEqual(fullBrief.technicalSpec);
    });

    it('should include full brief for enterprise', () => {
      const result = filterIdeaForTier(fullBrief, 'enterprise');
      expect(result.brief).toBeDefined();
      expect(result.brief?.businessModel).toEqual(fullBrief.businessModel);
    });
  });

  it('should always include the 7 summary fields', () => {
    const tiers: UserTier[] = ['anonymous', 'free', 'pro', 'enterprise'];
    for (const tier of tiers) {
      const result = filterIdeaForTier(fullBrief, tier);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('tagline');
      expect(result).toHaveProperty('priorityScore');
      expect(result).toHaveProperty('effortEstimate');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('generatedAt');
    }
  });
});

describe('filterIdeasForTier', () => {
  const ideas = Array.from({ length: 15 }, (_, i) =>
    makeIdeaBrief({
      id: `a0000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
      name: `Idea ${i + 1}`,
    })
  );

  describe('idea count limiting', () => {
    it('should return 3 ideas for anonymous', () => {
      const result = filterIdeasForTier(ideas, 'anonymous');
      expect(result.ideas).toHaveLength(3);
      expect(result.total).toBe(15);
      expect(result.limited).toBe(true);
    });

    it('should return 3 ideas for free', () => {
      const result = filterIdeasForTier(ideas, 'free');
      expect(result.ideas).toHaveLength(3);
      expect(result.limited).toBe(true);
    });

    it('should return 10 ideas for pro', () => {
      const result = filterIdeasForTier(ideas, 'pro');
      expect(result.ideas).toHaveLength(10);
      expect(result.limited).toBe(true);
    });

    it('should return all ideas for enterprise', () => {
      const result = filterIdeasForTier(ideas, 'enterprise');
      expect(result.ideas).toHaveLength(15);
      expect(result.limited).toBe(false);
    });
  });

  describe('brief inclusion based on tier', () => {
    it('should not include briefs for anonymous tier', () => {
      const result = filterIdeasForTier(ideas, 'anonymous');
      for (const idea of result.ideas) {
        expect(idea.brief).toBeUndefined();
      }
    });

    it('should include briefs for free tier', () => {
      const result = filterIdeasForTier(ideas, 'free');
      for (const idea of result.ideas) {
        expect(idea.brief).toBeDefined();
      }
    });

    it('should include briefs for pro tier', () => {
      const result = filterIdeasForTier(ideas, 'pro');
      for (const idea of result.ideas) {
        expect(idea.brief).toBeDefined();
      }
    });
  });

  it('should not limit when ideas count equals tier limit', () => {
    const exactTen = ideas.slice(0, 10);
    const result = filterIdeasForTier(exactTen, 'pro');
    expect(result.ideas).toHaveLength(10);
    expect(result.limited).toBe(false);
  });

  it('should handle empty ideas array', () => {
    const result = filterIdeasForTier([], 'pro');
    expect(result.ideas).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.limited).toBe(false);
  });

  it('should return first N ideas (not random)', () => {
    const result = filterIdeasForTier(ideas, 'pro');
    expect(result.ideas[0].name).toBe('Idea 1');
    expect(result.ideas[9].name).toBe('Idea 10');
  });
});

describe('tierGate helper re-exports', () => {
  it('should re-export hasAccess from tiers config', () => {
    expect(typeof hasAccess).toBe('function');
    expect(hasAccess('pro', 'ideas.fullBrief')).toBe(true);
    expect(hasAccess('free', 'ideas.fullBrief')).toBe(true);
  });

  it('should re-export canAccessArchive', () => {
    expect(typeof canAccessArchive).toBe('function');
  });

  it('should re-export canAccessFullBrief', () => {
    expect(typeof canAccessFullBrief).toBe('function');
  });

  it('should re-export canSearch', () => {
    expect(typeof canSearch).toBe('function');
  });

  it('should re-export canExport', () => {
    expect(typeof canExport).toBe('function');
  });

  it('should re-export getIdeasLimit', () => {
    expect(typeof getIdeasLimit).toBe('function');
    expect(getIdeasLimit('pro')).toBe(10);
  });
});
