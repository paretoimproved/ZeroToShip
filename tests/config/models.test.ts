/**
 * Tests for AI Model Configuration
 */

import { describe, it, expect } from 'vitest';
import {
  CLAUDE_MODELS,
  getBatchModel,
  getBriefModel,
  getModelDisplayName,
  MODEL_PRICING,
  type UserTier,
  type ClaudeModel,
} from '../../src/config/models';

describe('Model Configuration', () => {
  describe('CLAUDE_MODELS constants', () => {
    it('should define Haiku model', () => {
      expect(CLAUDE_MODELS.HAIKU).toBe('claude-3-5-haiku-latest');
    });

    it('should define Sonnet model', () => {
      expect(CLAUDE_MODELS.SONNET).toBe('claude-sonnet-4-20250514');
    });

    it('should define Opus model', () => {
      expect(CLAUDE_MODELS.OPUS).toBe('claude-opus-4-5-20251101');
    });
  });

  describe('getBatchModel', () => {
    it('should always return Haiku for batch operations', () => {
      expect(getBatchModel()).toBe(CLAUDE_MODELS.HAIKU);
    });

    it('should return a consistent value', () => {
      const first = getBatchModel();
      const second = getBatchModel();
      expect(first).toBe(second);
    });
  });

  describe('getBriefModel', () => {
    it('should return Haiku for free tier', () => {
      expect(getBriefModel('free')).toBe(CLAUDE_MODELS.HAIKU);
    });

    it('should return Sonnet for pro tier', () => {
      expect(getBriefModel('pro')).toBe(CLAUDE_MODELS.SONNET);
    });

    it('should return Opus for enterprise tier', () => {
      expect(getBriefModel('enterprise')).toBe(CLAUDE_MODELS.OPUS);
    });

    it('should default to Haiku for unknown tier', () => {
      // TypeScript would catch this, but testing runtime behavior
      expect(getBriefModel('unknown' as UserTier)).toBe(CLAUDE_MODELS.HAIKU);
    });
  });

  describe('getModelDisplayName', () => {
    it('should return display name for Haiku', () => {
      const name = getModelDisplayName(CLAUDE_MODELS.HAIKU);
      expect(name).toContain('Haiku');
      expect(name).toContain('4.5');
    });

    it('should return display name for Sonnet', () => {
      const name = getModelDisplayName(CLAUDE_MODELS.SONNET);
      expect(name).toContain('Sonnet');
      expect(name).toContain('4.5');
    });

    it('should return display name for Opus', () => {
      const name = getModelDisplayName(CLAUDE_MODELS.OPUS);
      expect(name).toContain('Opus');
      expect(name).toContain('Premium');
    });

    it('should return fallback for unknown model', () => {
      const name = getModelDisplayName('unknown-model' as ClaudeModel);
      expect(name).toBe('Claude');
    });
  });

  describe('MODEL_PRICING', () => {
    it('should have pricing for Haiku', () => {
      const pricing = MODEL_PRICING[CLAUDE_MODELS.HAIKU];
      expect(pricing).toBeDefined();
      expect(pricing.input).toBe(1.0);
      expect(pricing.output).toBe(5.0);
    });

    it('should have pricing for Sonnet', () => {
      const pricing = MODEL_PRICING[CLAUDE_MODELS.SONNET];
      expect(pricing).toBeDefined();
      expect(pricing.input).toBe(3.0);
      expect(pricing.output).toBe(15.0);
    });

    it('should have pricing for Opus', () => {
      const pricing = MODEL_PRICING[CLAUDE_MODELS.OPUS];
      expect(pricing).toBeDefined();
      expect(pricing.input).toBe(15.0);
      expect(pricing.output).toBe(75.0);
    });

    it('should have Haiku as cheapest model', () => {
      const haikuPrice = MODEL_PRICING[CLAUDE_MODELS.HAIKU];
      const sonnetPrice = MODEL_PRICING[CLAUDE_MODELS.SONNET];
      const opusPrice = MODEL_PRICING[CLAUDE_MODELS.OPUS];

      expect(haikuPrice.input).toBeLessThan(sonnetPrice.input);
      expect(haikuPrice.output).toBeLessThan(sonnetPrice.output);
      expect(sonnetPrice.input).toBeLessThan(opusPrice.input);
      expect(sonnetPrice.output).toBeLessThan(opusPrice.output);
    });
  });

  describe('Tier-based model selection logic', () => {
    it('should select increasingly capable models for higher tiers', () => {
      const tiers: UserTier[] = ['free', 'pro', 'enterprise'];
      const models = tiers.map(getBriefModel);

      // Free gets cheapest (Haiku)
      expect(models[0]).toBe(CLAUDE_MODELS.HAIKU);
      // Pro gets mid-tier (Sonnet)
      expect(models[1]).toBe(CLAUDE_MODELS.SONNET);
      // Enterprise gets best (Opus)
      expect(models[2]).toBe(CLAUDE_MODELS.OPUS);
    });

    it('should have all batch operations use Haiku regardless of tier', () => {
      // Batch model is always Haiku for cost efficiency
      const batchModel = getBatchModel();
      expect(batchModel).toBe(CLAUDE_MODELS.HAIKU);
    });
  });
});
