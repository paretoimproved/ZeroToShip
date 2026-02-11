/**
 * Tier Configuration Tests for ZeroToShip API
 *
 * Tests feature access matrix, tier hierarchy, and helper functions.
 * These tests serve as a safety net before restructuring tier boundaries.
 */

import { describe, it, expect } from 'vitest';
import {
  FEATURE_ACCESS,
  TIER_HIERARCHY,
  hasAccess,
  canAccessArchive,
  canAccessFullBrief,
  canSearch,
  canExport,
  getUpgradePrompt,
  getIdeasLimit,
  IDEAS_LIMIT,
  TIER_USAGE_LIMITS,
  type UserTier,
} from '../../src/api/config/tiers';

describe('TIER_HIERARCHY', () => {
  it('should have 4 tiers in ascending order', () => {
    expect(TIER_HIERARCHY).toEqual(['anonymous', 'free', 'pro', 'enterprise']);
  });

  it('should have enterprise as the highest tier', () => {
    expect(TIER_HIERARCHY[TIER_HIERARCHY.length - 1]).toBe('enterprise');
  });

  it('should have anonymous as the lowest tier', () => {
    expect(TIER_HIERARCHY[0]).toBe('anonymous');
  });
});

describe('FEATURE_ACCESS', () => {
  it('should define all expected features', () => {
    const expectedFeatures = [
      'ideas.today',
      'ideas.detail',
      'ideas.archive',
      'ideas.fullBrief',
      'ideas.search',
      'ideas.export',
      'validate',
      'user.preferences',
      'user.history',
      'user.subscription',
      'api.keys',
    ];
    expect(Object.keys(FEATURE_ACCESS).sort()).toEqual(expectedFeatures.sort());
  });

  it('should have a valid minTier for every feature', () => {
    for (const [feature, config] of Object.entries(FEATURE_ACCESS)) {
      expect(TIER_HIERARCHY).toContain(config.minTier);
      expect(config.description).toBeTruthy();
    }
  });
});

describe('hasAccess', () => {
  const tiers: UserTier[] = ['anonymous', 'free', 'pro', 'enterprise'];

  describe('anonymous-tier features (ideas.today, ideas.detail)', () => {
    it('should be accessible by all tiers', () => {
      for (const tier of tiers) {
        expect(hasAccess(tier, 'ideas.today')).toBe(true);
        expect(hasAccess(tier, 'ideas.detail')).toBe(true);
      }
    });
  });

  describe('free-tier features (preferences, history, subscription)', () => {
    it('should gate user features at free tier', () => {
      for (const feature of ['user.preferences', 'user.history', 'user.subscription']) {
        expect(hasAccess('anonymous', feature)).toBe(false);
        expect(hasAccess('free', feature)).toBe(true);
        expect(hasAccess('pro', feature)).toBe(true);
        expect(hasAccess('enterprise', feature)).toBe(true);
      }
    });
  });

  describe('pro-tier features (fullBrief, search, validate)', () => {
    it('should allow archive access for all tiers (preview mode for lower tiers)', () => {
      expect(hasAccess('anonymous', 'ideas.archive')).toBe(true);
      expect(hasAccess('free', 'ideas.archive')).toBe(true);
      expect(hasAccess('pro', 'ideas.archive')).toBe(true);
      expect(hasAccess('enterprise', 'ideas.archive')).toBe(true);
    });

    it('should gate fullBrief at pro tier', () => {
      expect(hasAccess('anonymous', 'ideas.fullBrief')).toBe(false);
      expect(hasAccess('free', 'ideas.fullBrief')).toBe(false);
      expect(hasAccess('pro', 'ideas.fullBrief')).toBe(true);
      expect(hasAccess('enterprise', 'ideas.fullBrief')).toBe(true);
    });

    it('should gate search at pro tier', () => {
      expect(hasAccess('anonymous', 'ideas.search')).toBe(false);
      expect(hasAccess('free', 'ideas.search')).toBe(false);
      expect(hasAccess('pro', 'ideas.search')).toBe(true);
      expect(hasAccess('enterprise', 'ideas.search')).toBe(true);
    });

    it('should gate validation at pro tier', () => {
      expect(hasAccess('anonymous', 'validate')).toBe(false);
      expect(hasAccess('free', 'validate')).toBe(false);
      expect(hasAccess('pro', 'validate')).toBe(true);
      expect(hasAccess('enterprise', 'validate')).toBe(true);
    });
  });

  describe('enterprise-tier features (export, api.keys)', () => {
    it('should be accessible by enterprise only', () => {
      const enterpriseFeatures = ['ideas.export', 'api.keys'];
      for (const feature of enterpriseFeatures) {
        expect(hasAccess('anonymous', feature)).toBe(false);
        expect(hasAccess('free', feature)).toBe(false);
        expect(hasAccess('pro', feature)).toBe(false);
        expect(hasAccess('enterprise', feature)).toBe(true);
      }
    });
  });

  it('should return false for unknown features', () => {
    expect(hasAccess('enterprise', 'nonexistent.feature')).toBe(false);
  });
});

describe('Helper functions', () => {
  describe('canAccessArchive', () => {
    it('should match hasAccess for ideas.archive', () => {
      const tiers: UserTier[] = ['anonymous', 'free', 'pro', 'enterprise'];
      for (const tier of tiers) {
        expect(canAccessArchive(tier)).toBe(hasAccess(tier, 'ideas.archive'));
      }
    });
  });

  describe('canAccessFullBrief', () => {
    it('should match hasAccess for ideas.fullBrief', () => {
      const tiers: UserTier[] = ['anonymous', 'free', 'pro', 'enterprise'];
      for (const tier of tiers) {
        expect(canAccessFullBrief(tier)).toBe(hasAccess(tier, 'ideas.fullBrief'));
      }
    });
  });

  describe('canSearch', () => {
    it('should match hasAccess for ideas.search', () => {
      const tiers: UserTier[] = ['anonymous', 'free', 'pro', 'enterprise'];
      for (const tier of tiers) {
        expect(canSearch(tier)).toBe(hasAccess(tier, 'ideas.search'));
      }
    });
  });

  describe('canExport', () => {
    it('should match hasAccess for ideas.export', () => {
      const tiers: UserTier[] = ['anonymous', 'free', 'pro', 'enterprise'];
      for (const tier of tiers) {
        expect(canExport(tier)).toBe(hasAccess(tier, 'ideas.export'));
      }
    });
  });

  describe('getIdeasLimit', () => {
    it('should return correct limits for each tier', () => {
      expect(getIdeasLimit('anonymous')).toBe(3);
      expect(getIdeasLimit('free')).toBe(3);
      expect(getIdeasLimit('pro')).toBe(10);
      expect(getIdeasLimit('enterprise')).toBe(Infinity);
    });
  });
});

describe('getUpgradePrompt', () => {
  it('should return correct prompt for pro-gated features', () => {
    const prompt = getUpgradePrompt('ideas.fullBrief');
    expect(prompt.requiredTier).toBe('pro');
    expect(prompt.message).toContain('Builder');
    expect(prompt.upgradeUrl).toBeTruthy();
  });

  it('should return correct prompt for enterprise-gated features', () => {
    const prompt = getUpgradePrompt('ideas.export');
    expect(prompt.requiredTier).toBe('enterprise');
    expect(prompt.message).toContain('Enterprise');
    expect(prompt.upgradeUrl).toBeTruthy();
  });

  it('should return a default prompt for unknown features', () => {
    const prompt = getUpgradePrompt('nonexistent');
    expect(prompt.requiredTier).toBe('pro');
    expect(prompt.message).toBeTruthy();
    expect(prompt.upgradeUrl).toBeTruthy();
  });
});

describe('Tier consistency', () => {
  it('should have all tiers defined in both TIER_HIERARCHY and usage limits', () => {
    for (const tier of TIER_HIERARCHY) {
      expect(TIER_USAGE_LIMITS[tier]).toBeDefined();
      expect(IDEAS_LIMIT[tier]).toBeDefined();
    }
  });
});
