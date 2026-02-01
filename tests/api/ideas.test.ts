/**
 * Ideas Endpoint Tests for IdeaForge API
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

// Mock idea for testing
const mockIdea: IdeaBrief = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Idea',
  tagline: 'A test idea for testing',
  priorityScore: 85.5,
  effortEstimate: 'week',
  revenueEstimate: '$10k-50k/mo',
  category: 'developer-tools',

  problemStatement: 'Developers waste time on repetitive tasks',
  targetAudience: 'Software developers',
  marketSize: '$5B globally',

  existingSolutions: 'Various automation tools',
  gaps: 'No integrated solution',

  proposedSolution: 'An all-in-one automation platform',
  keyFeatures: ['Feature 1', 'Feature 2', 'Feature 3'],
  mvpScope: 'Core automation features',

  technicalSpec: {
    stack: ['TypeScript', 'Node.js', 'PostgreSQL'],
    architecture: 'Microservices',
    estimatedEffort: '2-3 weeks',
  },

  businessModel: {
    pricing: 'Freemium with $19/mo Pro tier',
    revenueProjection: '$10k MRR by month 6',
    monetizationPath: 'SaaS subscriptions',
  },

  goToMarket: {
    launchStrategy: 'ProductHunt launch',
    channels: ['Twitter', 'Reddit', 'HackerNews'],
    firstCustomers: 'Indie hackers',
  },

  risks: ['Competition', 'Market timing'],
  generatedAt: '2026-01-31T10:00:00.000Z',
};

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

    it('should return summary without brief for free tier', () => {
      const result = filterIdeaForTier(mockIdea, 'free');

      expect(result.brief).toBeUndefined();
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

    it('should return false for free', () => {
      expect(canAccessFullBrief('free')).toBe(false);
    });

    it('should return true for pro', () => {
      expect(canAccessFullBrief('pro')).toBe(true);
    });

    it('should return true for enterprise', () => {
      expect(canAccessFullBrief('enterprise')).toBe(true);
    });
  });

  describe('canAccessArchive', () => {
    it('should return false for anonymous', () => {
      expect(canAccessArchive('anonymous')).toBe(false);
    });

    it('should return true for free and above', () => {
      expect(canAccessArchive('free')).toBe(true);
      expect(canAccessArchive('pro')).toBe(true);
      expect(canAccessArchive('enterprise')).toBe(true);
    });
  });

  describe('canSearch', () => {
    it('should only be available for enterprise', () => {
      expect(canSearch('anonymous')).toBe(false);
      expect(canSearch('free')).toBe(false);
      expect(canSearch('pro')).toBe(false);
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

      expect(prompt.requiredTier).toBe('pro');
      expect(prompt.message).toContain('Pro');
      expect(prompt.upgradeUrl).toBe('https://ideaforge.io/pricing');
    });

    it('should return correct prompt for search feature', () => {
      const prompt = getUpgradePrompt('ideas.search');

      expect(prompt.requiredTier).toBe('enterprise');
      expect(prompt.message).toContain('Enterprise');
    });

    it('should return default prompt for unknown feature', () => {
      const prompt = getUpgradePrompt('unknown.feature');

      expect(prompt.requiredTier).toBe('pro');
      expect(prompt.upgradeUrl).toBe('https://ideaforge.io/pricing');
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
