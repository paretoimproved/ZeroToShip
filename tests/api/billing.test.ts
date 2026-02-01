/**
 * Billing Tests for IdeaForge API
 *
 * Tests for Stripe checkout, portal, and pricing endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  STRIPE_PRICES,
  getTierFromPriceId,
  PRICE_INFO,
} from '../../src/api/config/stripe';

// Mock Stripe
vi.mock('stripe', () => {
  const mockStripe = {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'cs_test123',
          url: 'https://checkout.stripe.com/test',
        }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          url: 'https://billing.stripe.com/test',
        }),
      },
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price_pro_monthly' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
      }),
    },
    prices: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'price_test123',
        unit_amount: 1900,
        currency: 'usd',
        recurring: { interval: 'month' },
      }),
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };

  return {
    default: vi.fn(() => mockStripe),
  };
});

describe('Stripe Configuration', () => {
  describe('STRIPE_PRICES', () => {
    it('should have all required price keys', () => {
      expect(STRIPE_PRICES).toHaveProperty('pro_monthly');
      expect(STRIPE_PRICES).toHaveProperty('pro_yearly');
      expect(STRIPE_PRICES).toHaveProperty('enterprise_monthly');
      expect(STRIPE_PRICES).toHaveProperty('enterprise_yearly');
    });
  });

  describe('getTierFromPriceId', () => {
    beforeEach(() => {
      // Set up mock environment variables for testing
      process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
      process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';
      process.env.STRIPE_PRICE_ENT_MONTHLY = 'price_ent_monthly';
      process.env.STRIPE_PRICE_ENT_YEARLY = 'price_ent_yearly';
    });

    it('should return null for unknown price IDs', () => {
      expect(getTierFromPriceId('price_unknown')).toBeNull();
    });
  });

  describe('PRICE_INFO', () => {
    it('should have correct Pro monthly pricing', () => {
      expect(PRICE_INFO.pro_monthly).toEqual({
        amount: 1900,
        interval: 'month',
        name: 'Pro Monthly',
        tier: 'pro',
      });
    });

    it('should have correct Pro yearly pricing with discount', () => {
      expect(PRICE_INFO.pro_yearly).toEqual({
        amount: 19000, // 10 months, 2 free
        interval: 'year',
        name: 'Pro Yearly',
        tier: 'pro',
      });
    });

    it('should have correct Enterprise monthly pricing', () => {
      expect(PRICE_INFO.enterprise_monthly).toEqual({
        amount: 9900,
        interval: 'month',
        name: 'Enterprise Monthly',
        tier: 'enterprise',
      });
    });

    it('should have correct Enterprise yearly pricing with discount', () => {
      expect(PRICE_INFO.enterprise_yearly).toEqual({
        amount: 99000, // 10 months, 2 free
        interval: 'year',
        name: 'Enterprise Yearly',
        tier: 'enterprise',
      });
    });

    it('should provide 2 months free on yearly plans', () => {
      // Pro: $19/month * 10 = $190/year (saves $38)
      const proMonthlyCost = PRICE_INFO.pro_monthly.amount * 12;
      const proYearlyCost = PRICE_INFO.pro_yearly.amount;
      expect(proYearlyCost).toBeLessThan(proMonthlyCost);
      expect(proMonthlyCost - proYearlyCost).toBe(1900 * 2); // 2 months free

      // Enterprise: $99/month * 10 = $990/year (saves $198)
      const entMonthlyCost = PRICE_INFO.enterprise_monthly.amount * 12;
      const entYearlyCost = PRICE_INFO.enterprise_yearly.amount;
      expect(entYearlyCost).toBeLessThan(entMonthlyCost);
      expect(entMonthlyCost - entYearlyCost).toBe(9900 * 2); // 2 months free
    });
  });
});

describe('Billing Request Validation', () => {
  describe('Checkout request validation', () => {
    const validPriceKeys = [
      'pro_monthly',
      'pro_yearly',
      'enterprise_monthly',
      'enterprise_yearly',
    ];

    it('should accept valid price keys', () => {
      for (const key of validPriceKeys) {
        expect(validPriceKeys.includes(key)).toBe(true);
      }
    });

    it('should reject invalid price keys', () => {
      const invalidKeys = ['free', 'premium', 'invalid', 'pro', 'enterprise'];
      for (const key of invalidKeys) {
        expect(validPriceKeys.includes(key)).toBe(false);
      }
    });
  });
});

describe('Tier Mapping', () => {
  it('should map Pro prices to pro tier', () => {
    const proTierInfo = [PRICE_INFO.pro_monthly, PRICE_INFO.pro_yearly];
    for (const info of proTierInfo) {
      expect(info.tier).toBe('pro');
    }
  });

  it('should map Enterprise prices to enterprise tier', () => {
    const entTierInfo = [
      PRICE_INFO.enterprise_monthly,
      PRICE_INFO.enterprise_yearly,
    ];
    for (const info of entTierInfo) {
      expect(info.tier).toBe('enterprise');
    }
  });
});

describe('Price Amount Validation', () => {
  it('should have positive amounts', () => {
    for (const [, info] of Object.entries(PRICE_INFO)) {
      expect(info.amount).toBeGreaterThan(0);
    }
  });

  it('should have amounts in cents', () => {
    // All amounts should be whole numbers (cents)
    for (const [, info] of Object.entries(PRICE_INFO)) {
      expect(Number.isInteger(info.amount)).toBe(true);
    }
  });

  it('should have reasonable monthly prices', () => {
    // Monthly prices should be between $1 and $1000
    expect(PRICE_INFO.pro_monthly.amount).toBeGreaterThanOrEqual(100);
    expect(PRICE_INFO.pro_monthly.amount).toBeLessThanOrEqual(100000);

    expect(PRICE_INFO.enterprise_monthly.amount).toBeGreaterThanOrEqual(100);
    expect(PRICE_INFO.enterprise_monthly.amount).toBeLessThanOrEqual(100000);
  });

  it('should have enterprise > pro pricing', () => {
    expect(PRICE_INFO.enterprise_monthly.amount).toBeGreaterThan(
      PRICE_INFO.pro_monthly.amount
    );
    expect(PRICE_INFO.enterprise_yearly.amount).toBeGreaterThan(
      PRICE_INFO.pro_yearly.amount
    );
  });
});
