/**
 * Usage Limits Tests for ZeroToShip API
 *
 * Tests the tier-based daily usage limits for AI generation features.
 * These limits protect against API abuse and control costs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TIER_USAGE_LIMITS,
  type TierUsageLimits,
  type UserTier,
} from '../../src/api/config/tiers';

describe('Usage Limits Configuration', () => {
  describe('TIER_USAGE_LIMITS configuration', () => {
    it('should have correct limits for anonymous tier', () => {
      const limits = TIER_USAGE_LIMITS.anonymous;
      expect(limits.requestsPerHour).toBe(10);
      expect(limits.freshBriefsPerDay).toBe(0); // No fresh briefs for anonymous
      expect(limits.validationRequestsPerDay).toBe(0);
      expect(limits.overagePricePerBrief).toBeNull();
    });

    it('should have correct limits for free tier', () => {
      const limits = TIER_USAGE_LIMITS.free;
      expect(limits.requestsPerHour).toBe(100);
      expect(limits.freshBriefsPerDay).toBe(0); // No fresh briefs for free
      expect(limits.validationRequestsPerDay).toBe(0);
      expect(limits.overagePricePerBrief).toBeNull();
    });

    it('should have correct limits for pro tier', () => {
      const limits = TIER_USAGE_LIMITS.pro;
      expect(limits.requestsPerHour).toBe(1000);
      expect(limits.freshBriefsPerDay).toBe(10); // Matches daily batch
      expect(limits.validationRequestsPerDay).toBe(2);
      expect(limits.overagePricePerBrief).toBeNull(); // No overage for Pro
    });

    it('should have correct limits for enterprise tier', () => {
      const limits = TIER_USAGE_LIMITS.enterprise;
      expect(limits.requestsPerHour).toBe(10000);
      expect(limits.freshBriefsPerDay).toBe(50); // Generous but bounded
      expect(limits.validationRequestsPerDay).toBe(10);
      expect(limits.overagePricePerBrief).toBe(0.15); // $0.15 per additional
    });

    it('should have increasing brief limits as tier increases', () => {
      expect(TIER_USAGE_LIMITS.anonymous.freshBriefsPerDay).toBeLessThanOrEqual(
        TIER_USAGE_LIMITS.free.freshBriefsPerDay
      );
      expect(TIER_USAGE_LIMITS.free.freshBriefsPerDay).toBeLessThan(
        TIER_USAGE_LIMITS.pro.freshBriefsPerDay
      );
      expect(TIER_USAGE_LIMITS.pro.freshBriefsPerDay).toBeLessThan(
        TIER_USAGE_LIMITS.enterprise.freshBriefsPerDay
      );
    });
  });

  describe('Overage pricing', () => {
    it('should only allow overage for enterprise tier', () => {
      expect(TIER_USAGE_LIMITS.anonymous.overagePricePerBrief).toBeNull();
      expect(TIER_USAGE_LIMITS.free.overagePricePerBrief).toBeNull();
      expect(TIER_USAGE_LIMITS.pro.overagePricePerBrief).toBeNull();
      expect(TIER_USAGE_LIMITS.enterprise.overagePricePerBrief).not.toBeNull();
    });

    it('should have correct overage price in cents', () => {
      const overagePrice = TIER_USAGE_LIMITS.enterprise.overagePricePerBrief;
      expect(overagePrice).toBe(0.15);
      // Convert to cents
      const overageCents = Math.round(overagePrice! * 100);
      expect(overageCents).toBe(15);
    });
  });
});

describe('Usage Limit Business Logic', () => {
  /**
   * Mock usage status calculator (mimics getUsageStatus logic)
   */
  function calculateUsageStatus(
    used: number,
    tier: UserTier
  ): {
    remaining: number;
    canRequest: boolean;
    wouldIncurOverage: boolean;
  } {
    const limits = TIER_USAGE_LIMITS[tier];
    const remaining = Math.max(0, limits.freshBriefsPerDay - used);
    const canRequest = remaining > 0 || limits.overagePricePerBrief !== null;
    const wouldIncurOverage = remaining === 0 && limits.overagePricePerBrief !== null;

    return { remaining, canRequest, wouldIncurOverage };
  }

  describe('Free tier behavior', () => {
    it('should never allow fresh brief requests', () => {
      const status = calculateUsageStatus(0, 'free');
      expect(status.canRequest).toBe(false);
      expect(status.remaining).toBe(0);
    });
  });

  describe('Pro tier behavior', () => {
    it('should allow requests within limit', () => {
      const status = calculateUsageStatus(5, 'pro');
      expect(status.canRequest).toBe(true);
      expect(status.remaining).toBe(5);
      expect(status.wouldIncurOverage).toBe(false);
    });

    it('should block requests at limit', () => {
      const status = calculateUsageStatus(10, 'pro');
      expect(status.canRequest).toBe(false);
      expect(status.remaining).toBe(0);
      expect(status.wouldIncurOverage).toBe(false);
    });

    it('should block requests over limit', () => {
      const status = calculateUsageStatus(15, 'pro');
      expect(status.canRequest).toBe(false);
      expect(status.remaining).toBe(0);
    });
  });

  describe('Enterprise tier behavior', () => {
    it('should allow requests within limit', () => {
      const status = calculateUsageStatus(25, 'enterprise');
      expect(status.canRequest).toBe(true);
      expect(status.remaining).toBe(25);
      expect(status.wouldIncurOverage).toBe(false);
    });

    it('should allow requests at limit with overage warning', () => {
      const status = calculateUsageStatus(50, 'enterprise');
      expect(status.canRequest).toBe(true);
      expect(status.remaining).toBe(0);
      expect(status.wouldIncurOverage).toBe(true);
    });

    it('should allow requests over limit with overage', () => {
      const status = calculateUsageStatus(100, 'enterprise');
      expect(status.canRequest).toBe(true);
      expect(status.remaining).toBe(0);
      expect(status.wouldIncurOverage).toBe(true);
    });
  });
});

describe('Usage Increment Logic', () => {
  /**
   * Mock increment logic (mimics incrementBriefUsage behavior)
   */
  function simulateIncrement(
    currentUsed: number,
    tier: UserTier
  ): {
    allowed: boolean;
    isOverage: boolean;
    overageAmountCents: number;
  } {
    const limits = TIER_USAGE_LIMITS[tier];

    // Check if within limit
    if (currentUsed < limits.freshBriefsPerDay) {
      return { allowed: true, isOverage: false, overageAmountCents: 0 };
    }

    // At limit - check if overage allowed
    if (limits.overagePricePerBrief === null) {
      return { allowed: false, isOverage: false, overageAmountCents: 0 };
    }

    // Allow with overage
    const overageCents = Math.round(limits.overagePricePerBrief * 100);
    return { allowed: true, isOverage: true, overageAmountCents: overageCents };
  }

  describe('Pro tier increment', () => {
    it('should allow increment when under limit', () => {
      const result = simulateIncrement(5, 'pro');
      expect(result.allowed).toBe(true);
      expect(result.isOverage).toBe(false);
      expect(result.overageAmountCents).toBe(0);
    });

    it('should allow increment at one below limit', () => {
      const result = simulateIncrement(9, 'pro');
      expect(result.allowed).toBe(true);
      expect(result.isOverage).toBe(false);
    });

    it('should block increment at limit', () => {
      const result = simulateIncrement(10, 'pro');
      expect(result.allowed).toBe(false);
    });

    it('should block increment over limit', () => {
      const result = simulateIncrement(15, 'pro');
      expect(result.allowed).toBe(false);
    });
  });

  describe('Enterprise tier increment', () => {
    it('should allow increment when under limit', () => {
      const result = simulateIncrement(25, 'enterprise');
      expect(result.allowed).toBe(true);
      expect(result.isOverage).toBe(false);
      expect(result.overageAmountCents).toBe(0);
    });

    it('should allow increment at one below limit', () => {
      const result = simulateIncrement(49, 'enterprise');
      expect(result.allowed).toBe(true);
      expect(result.isOverage).toBe(false);
    });

    it('should allow increment at limit with overage', () => {
      const result = simulateIncrement(50, 'enterprise');
      expect(result.allowed).toBe(true);
      expect(result.isOverage).toBe(true);
      expect(result.overageAmountCents).toBe(15); // $0.15 = 15 cents
    });

    it('should allow increment over limit with overage', () => {
      const result = simulateIncrement(100, 'enterprise');
      expect(result.allowed).toBe(true);
      expect(result.isOverage).toBe(true);
      expect(result.overageAmountCents).toBe(15);
    });
  });
});

describe('Cost Projections', () => {
  it('should calculate max daily cost for enterprise within limit', () => {
    const maxBriefs = TIER_USAGE_LIMITS.enterprise.freshBriefsPerDay;
    // Assuming $0.05 per brief AI cost
    const costPerBrief = 0.05;
    const maxDailyCost = maxBriefs * costPerBrief;

    // Enterprise worst case: 50 briefs/day × $0.05 = $2.50/day
    expect(maxDailyCost).toBe(2.5);
  });

  it('should calculate overage revenue per additional brief', () => {
    const overagePrice = TIER_USAGE_LIMITS.enterprise.overagePricePerBrief!;
    const costPerBrief = 0.05;
    const profitPerOverageBrief = overagePrice - costPerBrief;

    // $0.15 - $0.05 = $0.10 profit per overage brief
    expect(profitPerOverageBrief).toBeCloseTo(0.10, 2);
  });

  it('should project monthly cost at max usage', () => {
    const maxBriefs = TIER_USAGE_LIMITS.enterprise.freshBriefsPerDay;
    const costPerBrief = 0.05;
    const daysPerMonth = 30;
    const maxMonthlyCost = maxBriefs * costPerBrief * daysPerMonth;

    // 50 × $0.05 × 30 = $75/month
    expect(maxMonthlyCost).toBe(75);
  });
});

describe('Validation Limits', () => {
  it('should have no validations for free/anonymous', () => {
    expect(TIER_USAGE_LIMITS.anonymous.validationRequestsPerDay).toBe(0);
    expect(TIER_USAGE_LIMITS.free.validationRequestsPerDay).toBe(0);
  });

  it('should have limited validations for pro', () => {
    expect(TIER_USAGE_LIMITS.pro.validationRequestsPerDay).toBe(2);
  });

  it('should have more validations for enterprise', () => {
    expect(TIER_USAGE_LIMITS.enterprise.validationRequestsPerDay).toBe(10);
    expect(
      TIER_USAGE_LIMITS.enterprise.validationRequestsPerDay
    ).toBeGreaterThan(TIER_USAGE_LIMITS.pro.validationRequestsPerDay);
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
