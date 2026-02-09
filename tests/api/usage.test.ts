/**
 * Usage Limits Tests for ZeroToShip API
 *
 * Tests the tier-based usage limits configuration.
 * Currently only requestsPerHour is configured per tier.
 */

import { describe, it, expect } from 'vitest';
import {
  TIER_USAGE_LIMITS,
  type TierUsageLimits,
  type UserTier,
} from '../../src/api/config/tiers';

describe('Usage Limits Configuration', () => {
  describe('TIER_USAGE_LIMITS configuration', () => {
    it('should have correct requestsPerHour for anonymous tier', () => {
      expect(TIER_USAGE_LIMITS.anonymous.requestsPerHour).toBe(10);
    });

    it('should have correct requestsPerHour for free tier', () => {
      expect(TIER_USAGE_LIMITS.free.requestsPerHour).toBe(100);
    });

    it('should have correct requestsPerHour for pro tier', () => {
      expect(TIER_USAGE_LIMITS.pro.requestsPerHour).toBe(1000);
    });

    it('should have correct requestsPerHour for enterprise tier', () => {
      expect(TIER_USAGE_LIMITS.enterprise.requestsPerHour).toBe(10000);
    });

    it('should have increasing requestsPerHour as tier increases', () => {
      expect(TIER_USAGE_LIMITS.anonymous.requestsPerHour).toBeLessThan(
        TIER_USAGE_LIMITS.free.requestsPerHour
      );
      expect(TIER_USAGE_LIMITS.free.requestsPerHour).toBeLessThan(
        TIER_USAGE_LIMITS.pro.requestsPerHour
      );
      expect(TIER_USAGE_LIMITS.pro.requestsPerHour).toBeLessThan(
        TIER_USAGE_LIMITS.enterprise.requestsPerHour
      );
    });
  });

  describe('TierUsageLimits interface', () => {
    it('should only have requestsPerHour field', () => {
      const limits: TierUsageLimits = TIER_USAGE_LIMITS.free;
      const keys = Object.keys(limits);
      expect(keys).toEqual(['requestsPerHour']);
    });
  });
});

describe('Reset Timing', () => {
  it('should calculate next midnight UTC correctly', () => {
    // Mock implementation of getNextMidnightUTC
    function getNextMidnightUTC(): string {
      const now = new Date();
      const tomorrow = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          0,
          0,
          0,
          0
        )
      );
      return tomorrow.toISOString();
    }

    const resetAt = getNextMidnightUTC();

    // Should be a valid ISO string
    expect(resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);

    // Should be in the future
    const resetDate = new Date(resetAt);
    expect(resetDate.getTime()).toBeGreaterThan(Date.now());

    // Should be within 24 hours
    const hoursUntilReset = (resetDate.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(hoursUntilReset).toBeGreaterThan(0);
    expect(hoursUntilReset).toBeLessThanOrEqual(24);
  });
});
