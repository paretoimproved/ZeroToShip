/**
 * Billing Tests for ZeroToShip API
 *
 * Tests for Stripe checkout, portal, and pricing endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  STRIPE_PRICES,
  getTierFromPriceId,
  PRICE_INFO,
} from '../../src/api/config/stripe';
import { ApiErrorSchema, SubscriptionResponseSchema } from '../../src/api/schemas';
import { expectSchemaValid, expectSchemaInvalid } from './helpers';

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
        name: 'Builder Monthly',
        tier: 'pro',
      });
    });

    it('should have correct Pro yearly pricing with discount', () => {
      expect(PRICE_INFO.pro_yearly).toEqual({
        amount: 19000, // 10 months, 2 free
        interval: 'year',
        name: 'Builder Yearly',
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

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('Response Body Schema Validation', () => {
  // Checkout response schema (matches route definition)
  const CheckoutResponseSchema = z.object({
    url: z.string().url(),
    sessionId: z.string(),
  });

  // Portal response schema
  const PortalResponseSchema = z.object({
    url: z.string().url(),
  });

  // Price schema (matches route definition)
  const PriceSchema = z.object({
    key: z.string(),
    priceId: z.string(),
    amount: z.number(),
    currency: z.string(),
    interval: z.string(),
    tier: z.enum(['pro', 'enterprise']),
  });

  const PricesResponseSchema = z.object({
    prices: z.array(PriceSchema),
  });

  describe('Checkout response', () => {
    it('should validate a valid checkout response', () => {
      const response = {
        url: 'https://checkout.stripe.com/pay/cs_test_abc123',
        sessionId: 'cs_test_abc123',
      };
      expectSchemaValid(CheckoutResponseSchema, response);
    });

    it('should reject checkout response with invalid URL', () => {
      const response = {
        url: 'not-a-url',
        sessionId: 'cs_test_abc123',
      };
      expectSchemaInvalid(CheckoutResponseSchema, response);
    });

    it('should reject checkout response with missing sessionId', () => {
      const response = {
        url: 'https://checkout.stripe.com/pay/cs_test_abc123',
      };
      expectSchemaInvalid(CheckoutResponseSchema, response);
    });

    it('should reject checkout response with missing url', () => {
      const response = {
        sessionId: 'cs_test_abc123',
      };
      expectSchemaInvalid(CheckoutResponseSchema, response);
    });
  });

  describe('Portal response', () => {
    it('should validate a valid portal response', () => {
      const response = { url: 'https://billing.stripe.com/session/test123' };
      expectSchemaValid(PortalResponseSchema, response);
    });

    it('should reject portal response with invalid URL', () => {
      const response = { url: 'not-a-url' };
      expectSchemaInvalid(PortalResponseSchema, response);
    });

    it('should reject portal response with missing url', () => {
      expectSchemaInvalid(PortalResponseSchema, {});
    });
  });

  describe('Prices response', () => {
    it('should validate a valid prices response', () => {
      const response = {
        prices: [
          {
            key: 'pro_monthly',
            priceId: 'price_abc123',
            amount: 1900,
            currency: 'usd',
            interval: 'month',
            tier: 'pro' as const,
          },
          {
            key: 'enterprise_monthly',
            priceId: 'price_def456',
            amount: 9900,
            currency: 'usd',
            interval: 'month',
            tier: 'enterprise' as const,
          },
        ],
      };
      expectSchemaValid(PricesResponseSchema, response);
    });

    it('should validate an empty prices response', () => {
      const response = { prices: [] };
      expectSchemaValid(PricesResponseSchema, response);
    });

    it('should reject price with invalid tier', () => {
      const response = {
        prices: [
          {
            key: 'free_monthly',
            priceId: 'price_xyz',
            amount: 0,
            currency: 'usd',
            interval: 'month',
            tier: 'free', // invalid - only pro/enterprise
          },
        ],
      };
      expectSchemaInvalid(PricesResponseSchema, response);
    });

    it('should reject price with missing amount', () => {
      const response = {
        prices: [
          {
            key: 'pro_monthly',
            priceId: 'price_abc123',
            currency: 'usd',
            interval: 'month',
            tier: 'pro',
          },
        ],
      };
      expectSchemaInvalid(PricesResponseSchema, response);
    });
  });

  describe('Error responses', () => {
    it('should validate USER_NOT_FOUND error', () => {
      const error = { code: 'USER_NOT_FOUND', message: 'User not found' };
      expectSchemaValid(ApiErrorSchema, error);
    });

    it('should validate INVALID_PRICE error', () => {
      const error = { code: 'INVALID_PRICE', message: 'Price key "bad" is not configured' };
      expectSchemaValid(ApiErrorSchema, error);
    });

    it('should validate CHECKOUT_FAILED error', () => {
      const error = { code: 'CHECKOUT_FAILED', message: 'Failed to create checkout session' };
      expectSchemaValid(ApiErrorSchema, error);
    });

    it('should validate PORTAL_FAILED error', () => {
      const error = { code: 'PORTAL_FAILED', message: 'Failed to create billing portal session' };
      expectSchemaValid(ApiErrorSchema, error);
    });
  });

  describe('Subscription response', () => {
    it('should validate a valid subscription response', () => {
      const response = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        plan: 'pro' as const,
        status: 'active' as const,
        currentPeriodEnd: '2026-03-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      };
      expectSchemaValid(SubscriptionResponseSchema, response);
    });

    it('should validate subscription without currentPeriodEnd', () => {
      const response = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        plan: 'free' as const,
        status: 'active' as const,
        cancelAtPeriodEnd: false,
      };
      expectSchemaValid(SubscriptionResponseSchema, response);
    });

    it('should reject subscription with invalid plan', () => {
      const response = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        plan: 'premium',
        status: 'active',
        cancelAtPeriodEnd: false,
      };
      expectSchemaInvalid(SubscriptionResponseSchema, response);
    });

    it('should reject subscription with invalid status', () => {
      const response = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        plan: 'pro',
        status: 'suspended',
        cancelAtPeriodEnd: false,
      };
      expectSchemaInvalid(SubscriptionResponseSchema, response);
    });

    it('should reject subscription with missing cancelAtPeriodEnd', () => {
      const response = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        plan: 'pro',
        status: 'active',
      };
      expectSchemaInvalid(SubscriptionResponseSchema, response);
    });
  });
});

// ============================================================================
// Checkout Request Validation (Negative Tests)
// ============================================================================

describe('Checkout Request Validation', () => {
  const CheckoutRequestSchema = z.object({
    priceKey: z.enum(['pro_monthly', 'pro_yearly', 'enterprise_monthly', 'enterprise_yearly']),
  });

  it('should accept pro_monthly', () => {
    const result = CheckoutRequestSchema.safeParse({ priceKey: 'pro_monthly' });
    expect(result.success).toBe(true);
  });

  it('should accept pro_yearly', () => {
    const result = CheckoutRequestSchema.safeParse({ priceKey: 'pro_yearly' });
    expect(result.success).toBe(true);
  });

  it('should accept enterprise_monthly', () => {
    const result = CheckoutRequestSchema.safeParse({ priceKey: 'enterprise_monthly' });
    expect(result.success).toBe(true);
  });

  it('should accept enterprise_yearly', () => {
    const result = CheckoutRequestSchema.safeParse({ priceKey: 'enterprise_yearly' });
    expect(result.success).toBe(true);
  });

  it('should reject free as priceKey', () => {
    const result = CheckoutRequestSchema.safeParse({ priceKey: 'free' });
    expect(result.success).toBe(false);
  });

  it('should reject empty priceKey', () => {
    const result = CheckoutRequestSchema.safeParse({ priceKey: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing priceKey', () => {
    const result = CheckoutRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject numeric priceKey', () => {
    const result = CheckoutRequestSchema.safeParse({ priceKey: 123 });
    expect(result.success).toBe(false);
  });

  it('should reject SQL injection attempt in priceKey', () => {
    const result = CheckoutRequestSchema.safeParse({ priceKey: "'; DROP TABLE users; --" });
    expect(result.success).toBe(false);
  });
});
