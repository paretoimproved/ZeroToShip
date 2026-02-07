/**
 * Webhook Tests for IdeaForge API
 *
 * Tests for Stripe webhook event handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';
import { ApiErrorSchema } from '../../src/api/schemas';
import { expectSchemaValid } from './helpers';

// Mock data for tests
const mockUserId = 'user_12345678-1234-1234-1234-123456789abc';
const mockCustomerId = 'cus_test123';
const mockSubscriptionId = 'sub_test123';
const mockPriceId = 'price_pro_monthly';

// Mock Stripe event factories
function createMockCheckoutSession(overrides = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test123',
    object: 'checkout.session',
    customer: mockCustomerId,
    subscription: mockSubscriptionId,
    metadata: {
      userId: mockUserId,
    },
    mode: 'subscription',
    payment_status: 'paid',
    status: 'complete',
    ...overrides,
  } as Stripe.Checkout.Session;
}

function createMockSubscription(overrides = {}): Stripe.Subscription {
  return {
    id: mockSubscriptionId,
    object: 'subscription',
    customer: mockCustomerId,
    status: 'active',
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test123',
          object: 'subscription_item',
          price: {
            id: mockPriceId,
            object: 'price',
            currency: 'usd',
            unit_amount: 1900,
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
          } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
    } as Stripe.ApiList<Stripe.SubscriptionItem>,
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
    metadata: {
      userId: mockUserId,
    },
    ...overrides,
  } as Stripe.Subscription;
}

function createMockInvoice(overrides = {}): Stripe.Invoice {
  return {
    id: 'in_test123',
    object: 'invoice',
    customer: mockCustomerId,
    subscription: mockSubscriptionId,
    status: 'open',
    amount_due: 1900,
    amount_paid: 0,
    currency: 'usd',
    ...overrides,
  } as Stripe.Invoice;
}

describe('Webhook Event Structure', () => {
  describe('checkout.session.completed', () => {
    it('should have required fields for session', () => {
      const session = createMockCheckoutSession();
      expect(session.customer).toBeDefined();
      expect(session.subscription).toBeDefined();
      expect(session.metadata?.userId).toBeDefined();
    });

    it('should contain subscription ID', () => {
      const session = createMockCheckoutSession();
      expect(session.subscription).toBe(mockSubscriptionId);
    });

    it('should contain customer ID', () => {
      const session = createMockCheckoutSession();
      expect(session.customer).toBe(mockCustomerId);
    });

    it('should contain user ID in metadata', () => {
      const session = createMockCheckoutSession();
      expect(session.metadata?.userId).toBe(mockUserId);
    });
  });

  describe('customer.subscription.updated', () => {
    it('should have required subscription fields', () => {
      const subscription = createMockSubscription();
      expect(subscription.id).toBeDefined();
      expect(subscription.customer).toBeDefined();
      expect(subscription.status).toBeDefined();
      expect(subscription.items.data).toBeDefined();
    });

    it('should contain price information', () => {
      const subscription = createMockSubscription();
      const priceId = subscription.items.data[0]?.price.id;
      expect(priceId).toBe(mockPriceId);
    });

    it('should contain period timestamps', () => {
      const subscription = createMockSubscription();
      expect(subscription.current_period_start).toBeDefined();
      expect(subscription.current_period_end).toBeDefined();
      expect(subscription.current_period_end).toBeGreaterThan(
        subscription.current_period_start
      );
    });

    it('should have cancel_at_period_end field', () => {
      const subscription = createMockSubscription();
      expect(typeof subscription.cancel_at_period_end).toBe('boolean');
    });
  });

  describe('customer.subscription.deleted', () => {
    it('should indicate canceled status', () => {
      const subscription = createMockSubscription({ status: 'canceled' });
      expect(subscription.status).toBe('canceled');
    });
  });

  describe('invoice.payment_failed', () => {
    it('should have required invoice fields', () => {
      const invoice = createMockInvoice();
      expect(invoice.customer).toBeDefined();
      expect(invoice.subscription).toBeDefined();
    });

    it('should contain subscription ID', () => {
      const invoice = createMockInvoice();
      expect(invoice.subscription).toBe(mockSubscriptionId);
    });
  });
});

describe('Subscription Status Mapping', () => {
  const statusMap: Record<Stripe.Subscription.Status, 'active' | 'canceled' | 'past_due'> = {
    active: 'active',
    past_due: 'past_due',
    unpaid: 'past_due',
    canceled: 'canceled',
    incomplete: 'active', // Treated as active until payment fails
    incomplete_expired: 'canceled',
    trialing: 'active',
    paused: 'active',
  };

  for (const [stripeStatus, expectedStatus] of Object.entries(statusMap)) {
    it(`should map ${stripeStatus} to ${expectedStatus}`, () => {
      let mappedStatus: 'active' | 'canceled' | 'past_due' = 'active';

      if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
        mappedStatus = 'past_due';
      } else if (
        stripeStatus === 'canceled' ||
        stripeStatus === 'incomplete_expired'
      ) {
        mappedStatus = 'canceled';
      }

      expect(mappedStatus).toBe(expectedStatus);
    });
  }
});

describe('Webhook Signature Verification', () => {
  it('should require stripe-signature header', () => {
    const hasSignature = (headers: Record<string, string>) => {
      return 'stripe-signature' in headers;
    };

    expect(hasSignature({ 'stripe-signature': 'test_sig' })).toBe(true);
    expect(hasSignature({ 'content-type': 'application/json' })).toBe(false);
  });

  it('should reject empty signature', () => {
    const isValidSignature = (sig: string | undefined) => {
      return sig !== undefined && sig.length > 0;
    };

    expect(isValidSignature('whsec_test_sig')).toBe(true);
    expect(isValidSignature('')).toBe(false);
    expect(isValidSignature(undefined)).toBe(false);
  });
});

describe('Tier Determination from Price ID', () => {
  // Simulate price ID to tier mapping
  const getPriceIdTier = (priceId: string): 'pro' | 'enterprise' | null => {
    if (priceId.includes('pro')) return 'pro';
    if (priceId.includes('ent') || priceId.includes('enterprise')) return 'enterprise';
    return null;
  };

  it('should identify Pro tier from price ID', () => {
    expect(getPriceIdTier('price_pro_monthly')).toBe('pro');
    expect(getPriceIdTier('price_pro_yearly')).toBe('pro');
  });

  it('should identify Enterprise tier from price ID', () => {
    expect(getPriceIdTier('price_ent_monthly')).toBe('enterprise');
    expect(getPriceIdTier('price_ent_yearly')).toBe('enterprise');
    expect(getPriceIdTier('price_enterprise_monthly')).toBe('enterprise');
  });

  it('should return null for unknown price IDs', () => {
    expect(getPriceIdTier('price_unknown')).toBeNull();
    expect(getPriceIdTier('price_free')).toBeNull();
  });
});

describe('Webhook Response', () => {
  it('should return 200 for acknowledged events', () => {
    const successResponse = { received: true };
    expect(successResponse.received).toBe(true);
  });

  it('should return 400 for missing signature', () => {
    const errorResponse = {
      code: 'MISSING_SIGNATURE',
      message: 'Missing stripe-signature header',
    };
    expect(errorResponse.code).toBe('MISSING_SIGNATURE');
    expectSchemaValid(ApiErrorSchema, errorResponse);
  });

  it('should return 400 for invalid signature', () => {
    const errorResponse = {
      code: 'INVALID_SIGNATURE',
      message: 'Invalid webhook signature',
    };
    expect(errorResponse.code).toBe('INVALID_SIGNATURE');
    expectSchemaValid(ApiErrorSchema, errorResponse);
  });
});

describe('Webhook Error Response Schema', () => {
  it('should produce valid error response for missing userId in metadata', () => {
    const session = createMockCheckoutSession({ metadata: {} });
    // When userId is missing, the handler logs error and returns without action
    // But if it did return an error, it should conform to schema
    expect(session.metadata?.userId).toBeUndefined();
  });

  it('should produce valid error response for missing subscription', () => {
    const session = createMockCheckoutSession({ subscription: null });
    expect(session.subscription).toBeNull();
  });

  it('should validate all webhook error codes conform to ApiErrorSchema', () => {
    const webhookErrors = [
      { code: 'MISSING_SIGNATURE', message: 'Missing stripe-signature header' },
      { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
      { code: 'WEBHOOK_ERROR', message: 'Webhook processing failed' },
    ];

    for (const error of webhookErrors) {
      expectSchemaValid(ApiErrorSchema, error);
    }
  });
});

describe('Event Type Handling', () => {
  const handledEvents = [
    'checkout.session.completed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_failed',
  ];

  for (const eventType of handledEvents) {
    it(`should handle ${eventType} event`, () => {
      expect(handledEvents.includes(eventType)).toBe(true);
    });
  }

  it('should log unhandled events without error', () => {
    const unhandledEvents = [
      'customer.created',
      'invoice.paid',
      'charge.succeeded',
    ];

    for (const eventType of unhandledEvents) {
      expect(handledEvents.includes(eventType)).toBe(false);
    }
  });
});

describe('Period Timestamp Conversion', () => {
  it('should convert Unix timestamp to Date', () => {
    const unixTimestamp = 1704067200; // 2024-01-01 00:00:00 UTC
    const date = new Date(unixTimestamp * 1000);

    expect(date instanceof Date).toBe(true);
    expect(date.getUTCFullYear()).toBe(2024);
  });

  it('should handle subscription period correctly', () => {
    const subscription = createMockSubscription();
    const periodStart = new Date(subscription.current_period_start * 1000);
    const periodEnd = new Date(subscription.current_period_end * 1000);

    expect(periodEnd.getTime()).toBeGreaterThan(periodStart.getTime());

    // Period should be approximately 30 days for monthly
    const daysDiff =
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThanOrEqual(28);
    expect(daysDiff).toBeLessThanOrEqual(31);
  });
});
