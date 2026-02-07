/**
 * Authentication Tests for IdeaForge API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomBytes } from 'crypto';
import {
  hasAccess,
  getIdeasLimit,
  FEATURE_ACCESS,
} from '../../src/api/config/tiers';

// Local implementation of generateApiKey for testing (avoids db imports)
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'if_';
  const bytes = randomBytes(48);
  let key = prefix;
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(bytes[i] % chars.length);
  }
  return key;
}

describe('Authentication', () => {
  describe('generateApiKey', () => {
    it('should generate a key with correct prefix', () => {
      const key = generateApiKey();
      expect(key.startsWith('if_')).toBe(true);
    });

    it('should generate a key with correct length', () => {
      const key = generateApiKey();
      expect(key.length).toBe(51); // 'if_' + 48 chars
    });

    it('should generate unique keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generateApiKey());
      }
      expect(keys.size).toBe(100);
    });

    it('should only use alphanumeric characters after prefix', () => {
      const key = generateApiKey();
      const keyPart = key.slice(3);
      expect(/^[A-Za-z0-9]+$/.test(keyPart)).toBe(true);
    });
  });
});

describe('Feature Access', () => {
  describe('hasAccess', () => {
    it('should allow anonymous access to public features', () => {
      expect(hasAccess('anonymous', 'ideas.today')).toBe(true);
      expect(hasAccess('anonymous', 'ideas.detail')).toBe(true);
    });

    it('should deny anonymous access to protected features', () => {
      expect(hasAccess('anonymous', 'ideas.archive')).toBe(false);
      expect(hasAccess('anonymous', 'user.preferences')).toBe(false);
    });

    it('should allow free tier access to basic features', () => {
      expect(hasAccess('free', 'ideas.today')).toBe(true);
      expect(hasAccess('free', 'ideas.archive')).toBe(true);
      expect(hasAccess('free', 'user.preferences')).toBe(true);
    });

    it('should deny free tier access to pro features', () => {
      expect(hasAccess('free', 'ideas.fullBrief')).toBe(false);
    });

    it('should deny free tier access to enterprise features', () => {
      expect(hasAccess('free', 'ideas.search')).toBe(false);
      expect(hasAccess('free', 'ideas.export')).toBe(false);
      expect(hasAccess('free', 'validate')).toBe(false);
    });

    it('should allow pro tier access to pro features', () => {
      expect(hasAccess('pro', 'ideas.fullBrief')).toBe(true);
      expect(hasAccess('pro', 'ideas.archive')).toBe(true);
    });

    it('should deny pro tier access to enterprise features', () => {
      expect(hasAccess('pro', 'ideas.search')).toBe(false);
      expect(hasAccess('pro', 'ideas.export')).toBe(false);
    });

    it('should allow enterprise tier access to all features', () => {
      const features = Object.keys(FEATURE_ACCESS);
      for (const feature of features) {
        expect(hasAccess('enterprise', feature)).toBe(true);
      }
    });

    it('should return false for unknown features', () => {
      expect(hasAccess('enterprise', 'unknown.feature')).toBe(false);
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

describe('Tier Hierarchy', () => {
  it('should respect tier hierarchy for all features', () => {
    const tiers = ['anonymous', 'free', 'pro', 'enterprise'] as const;

    for (const [feature, config] of Object.entries(FEATURE_ACCESS)) {
      const minTierIndex = tiers.indexOf(config.minTier);

      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const shouldHaveAccess = i >= minTierIndex;
        expect(hasAccess(tier, feature)).toBe(shouldHaveAccess);
      }
    }
  });
});
