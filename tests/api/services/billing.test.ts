/**
 * Billing Service Unit Tests for ZeroToShip API
 *
 * Tests every exported function in src/api/services/billing.ts:
 * - handleWebhookEvent (event dispatcher)
 * - handleCheckoutCompleted
 * - handleSubscriptionUpdated
 * - handleSubscriptionDeleted
 * - handlePaymentFailed
 * - syncSubscription (via handleSubscriptionUpdated)
 * - getOrCreateStripeCustomer
 * - createCheckoutSession
 * - createBillingPortalSession
 * - getStripeSubscription
 * - constructWebhookEvent
 * - getAvailablePrices
 * - getAvailablePricesWithFallback
 * - initiateCheckout
 * - initiateBillingPortal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

// ---------------------------------------------------------------------------
// vi.hoisted — ensures these mock functions are available when vi.mock
// factory callbacks run (vitest hoists vi.mock to the top of the file).
// ---------------------------------------------------------------------------
const {
  mockCustomersCreate,
  mockCheckoutSessionsCreate,
  mockBillingPortalSessionsCreate,
  mockSubscriptionsRetrieve,
  mockPricesRetrieve,
  mockWebhooksConstructEvent,
  mockDbSelect,
  mockDbUpdate,
  mockUpdateSubscription,
  mockUpdateUserTier,
  mockGetUserById,
} = vi.hoisted(() => ({
  mockCustomersCreate: vi.fn(),
  mockCheckoutSessionsCreate: vi.fn(),
  mockBillingPortalSessionsCreate: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockPricesRetrieve: vi.fn(),
  mockWebhooksConstructEvent: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockUpdateSubscription: vi.fn(),
  mockUpdateUserTier: vi.fn(),
  mockGetUserById: vi.fn(),
}));

// ---------------------------------------------------------------------------
// vi.mock -- Stripe
// ---------------------------------------------------------------------------
vi.mock('stripe', () => {
  const StripeMock = vi.fn(() => ({
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
    prices: { retrieve: mockPricesRetrieve },
    webhooks: { constructEvent: mockWebhooksConstructEvent },
  }));
  return { default: StripeMock };
});

// ---------------------------------------------------------------------------
// vi.mock -- Stripe config (re-export constants and provide mock stripe)
// ---------------------------------------------------------------------------
vi.mock('../../../src/api/config/stripe', () => {
  const mockStripeInstance = {
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
    prices: { retrieve: mockPricesRetrieve },
    webhooks: { constructEvent: mockWebhooksConstructEvent },
  };

  const STRIPE_PRICES = {
    pro_monthly: 'price_pro_monthly',
    pro_yearly: 'price_pro_yearly',
    enterprise_monthly: 'price_ent_monthly',
    enterprise_yearly: 'price_ent_yearly',
  };

  const PRICE_INFO: Record<
    string,
    { amount: number; interval: string; name: string; tier: 'pro' | 'enterprise' }
  > = {
    pro_monthly: { amount: 1900, interval: 'month', name: 'Pro Monthly', tier: 'pro' },
    pro_yearly: { amount: 19000, interval: 'year', name: 'Pro Yearly', tier: 'pro' },
    enterprise_monthly: {
      amount: 9900,
      interval: 'month',
      name: 'Enterprise Monthly',
      tier: 'enterprise',
    },
    enterprise_yearly: {
      amount: 99000,
      interval: 'year',
      name: 'Enterprise Yearly',
      tier: 'enterprise',
    },
  };

  function getTierFromPriceId(priceId: string): 'pro' | 'enterprise' | null {
    const mapping: Record<string, 'pro' | 'enterprise'> = {
      price_pro_monthly: 'pro',
      price_pro_yearly: 'pro',
      price_ent_monthly: 'enterprise',
      price_ent_yearly: 'enterprise',
    };
    return mapping[priceId] || null;
  }

  return {
    stripe: mockStripeInstance,
    getStripe: () => mockStripeInstance,
    STRIPE_PRICES,
    PRICE_INFO,
    getTierFromPriceId,
    CHECKOUT_SUCCESS_URL: 'http://localhost:3000/account?session_id={CHECKOUT_SESSION_ID}',
    CHECKOUT_CANCEL_URL: 'http://localhost:3000/pricing',
    BILLING_PORTAL_RETURN_URL: 'http://localhost:3000/account',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  };
});

// ---------------------------------------------------------------------------
// vi.mock -- Database client
// ---------------------------------------------------------------------------
vi.mock('../../../src/api/db/client', () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    set: vi.fn().mockReturnThis(),
  };

  return {
    db: {
      select: mockDbSelect.mockReturnValue(chain),
      update: mockDbUpdate.mockReturnValue(chain),
    },
    subscriptions: {
      userId: 'userId',
      stripeCustomerId: 'stripeCustomerId',
    },
    users: {
      id: 'id',
      email: 'email',
    },
  };
});

// ---------------------------------------------------------------------------
// vi.mock -- User services
// ---------------------------------------------------------------------------
vi.mock('../../../src/api/services/users', () => ({
  updateSubscription: (...args: unknown[]) => mockUpdateSubscription(...args),
  updateUserTier: (...args: unknown[]) => mockUpdateUserTier(...args),
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
}));

// ---------------------------------------------------------------------------
// Suppress console.log / console.error from the billing service during tests
// ---------------------------------------------------------------------------
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ---------------------------------------------------------------------------
// Helpers -- mock Stripe objects
// ---------------------------------------------------------------------------
const NOW_SECONDS = Math.floor(Date.now() / 1000);
const THIRTY_DAYS = 30 * 24 * 60 * 60;

function mockStripeSubscription(
  overrides: Record<string, unknown> = {}
): Stripe.Subscription {
  return {
    id: 'sub_test123',
    object: 'subscription',
    customer: 'cus_test123',
    status: 'active',
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test1',
          object: 'subscription_item',
          price: { id: 'price_pro_monthly', object: 'price' } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
    } as Stripe.ApiList<Stripe.SubscriptionItem>,
    current_period_start: NOW_SECONDS,
    current_period_end: NOW_SECONDS + THIRTY_DAYS,
    cancel_at_period_end: false,
    metadata: { userId: 'user_abc123' },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function mockCheckoutSession(
  overrides: Record<string, unknown> = {}
): Stripe.Checkout.Session {
  return {
    id: 'cs_test123',
    object: 'checkout.session',
    customer: 'cus_test123',
    subscription: 'sub_test123',
    metadata: { userId: 'user_abc123' },
    mode: 'subscription',
    payment_status: 'paid',
    status: 'complete',
    ...overrides,
  } as Stripe.Checkout.Session;
}

function mockInvoice(overrides: Record<string, unknown> = {}): Stripe.Invoice {
  return {
    id: 'in_test123',
    object: 'invoice',
    customer: 'cus_test123',
    subscription: 'sub_test123',
    status: 'open',
    amount_due: 1900,
    ...overrides,
  } as unknown as Stripe.Invoice;
}

function stripeEvent(type: string, data: unknown): Stripe.Event {
  return {
    id: `evt_${type.replace(/\./g, '_')}`,
    object: 'event',
    type,
    data: { object: data },
    api_version: '2025-01-27.acacia',
    created: NOW_SECONDS,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are in place
// ---------------------------------------------------------------------------
import {
  handleWebhookEvent,
  constructWebhookEvent,
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createBillingPortalSession,
  getStripeSubscription,
  getAvailablePrices,
  getAvailablePricesWithFallback,
  initiateCheckout,
  initiateBillingPortal,
} from '../../../src/api/services/billing';

// ---------------------------------------------------------------------------
// Reset all mocks before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();

  // Default: DB select returns empty
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  });

  // Default: DB update returns chain
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });

  // Default: user service calls succeed
  mockUpdateSubscription.mockResolvedValue(true);
  mockUpdateUserTier.mockResolvedValue(true);
});

// ============================================================================
// handleWebhookEvent -- event dispatcher
// ============================================================================
describe('handleWebhookEvent', () => {
  it('should route checkout.session.completed to handleCheckoutCompleted', async () => {
    const session = mockCheckoutSession();
    const sub = mockStripeSubscription();
    mockSubscriptionsRetrieve.mockResolvedValue(sub);

    const event = stripeEvent('checkout.session.completed', session);
    await handleWebhookEvent(event);

    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_test123');
    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ plan: 'pro' })
    );
  });

  it('should route customer.subscription.updated to handleSubscriptionUpdated', async () => {
    const sub = mockStripeSubscription();
    const event = stripeEvent('customer.subscription.updated', sub);

    await handleWebhookEvent(event);

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ stripeSubscriptionId: 'sub_test123' })
    );
  });

  it('should route customer.subscription.deleted to handleSubscriptionDeleted', async () => {
    const sub = mockStripeSubscription();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ userId: 'user_abc123' }]),
        }),
      }),
    });

    const event = stripeEvent('customer.subscription.deleted', sub);
    await handleWebhookEvent(event);

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ plan: 'free', status: 'active' })
    );
  });

  it('should route invoice.payment_failed to handlePaymentFailed', async () => {
    const invoice = mockInvoice();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ userId: 'user_abc123' }]),
        }),
      }),
    });

    const event = stripeEvent('invoice.payment_failed', invoice);
    await handleWebhookEvent(event);

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ status: 'past_due' })
    );
  });

  it('should ignore unknown event types without throwing', async () => {
    const event = stripeEvent('customer.created', { id: 'cus_xxx' });
    await expect(handleWebhookEvent(event)).resolves.toBeUndefined();
    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });
});

// ============================================================================
// handleCheckoutCompleted (via handleWebhookEvent)
// ============================================================================
describe('handleCheckoutCompleted', () => {
  it('should upgrade user tier when valid price ID maps to a tier', async () => {
    const session = mockCheckoutSession();
    const sub = mockStripeSubscription();
    mockSubscriptionsRetrieve.mockResolvedValue(sub);

    await handleWebhookEvent(stripeEvent('checkout.session.completed', session));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test123',
        plan: 'pro',
        status: 'active',
        cancelAtPeriodEnd: false,
      })
    );
  });

  it('should silently return when session has no subscription', async () => {
    const session = mockCheckoutSession({ subscription: null });

    await handleWebhookEvent(stripeEvent('checkout.session.completed', session));

    expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });

  it('should silently return when price ID does not map to any tier', async () => {
    const session = mockCheckoutSession();
    const sub = mockStripeSubscription();
    (sub.items.data[0].price as { id: string }).id = 'price_unknown_xyz';
    mockSubscriptionsRetrieve.mockResolvedValue(sub);

    await handleWebhookEvent(stripeEvent('checkout.session.completed', session));

    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });

  it('should handle missing metadata.userId gracefully', async () => {
    const session = mockCheckoutSession({ metadata: {} });

    await handleWebhookEvent(stripeEvent('checkout.session.completed', session));

    expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });

  it('should set status to past_due when Stripe subscription is not active', async () => {
    const session = mockCheckoutSession();
    const sub = mockStripeSubscription({ status: 'past_due' });
    mockSubscriptionsRetrieve.mockResolvedValue(sub);

    await handleWebhookEvent(stripeEvent('checkout.session.completed', session));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ status: 'past_due' })
    );
  });

  it('should pass correct period timestamps from Stripe subscription', async () => {
    const session = mockCheckoutSession();
    const sub = mockStripeSubscription();
    mockSubscriptionsRetrieve.mockResolvedValue(sub);

    await handleWebhookEvent(stripeEvent('checkout.session.completed', session));

    const call = mockUpdateSubscription.mock.calls[0][1] as Record<string, unknown>;
    expect(call.currentPeriodStart).toBeInstanceOf(Date);
    expect(call.currentPeriodEnd).toBeInstanceOf(Date);
    expect((call.currentPeriodEnd as Date).getTime()).toBeGreaterThan(
      (call.currentPeriodStart as Date).getTime()
    );
  });

  it('should map enterprise price to enterprise tier', async () => {
    const session = mockCheckoutSession();
    const sub = mockStripeSubscription();
    (sub.items.data[0].price as { id: string }).id = 'price_ent_monthly';
    mockSubscriptionsRetrieve.mockResolvedValue(sub);

    await handleWebhookEvent(stripeEvent('checkout.session.completed', session));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ plan: 'enterprise' })
    );
  });
});

// ============================================================================
// handleSubscriptionUpdated (via handleWebhookEvent)
// ============================================================================
describe('handleSubscriptionUpdated', () => {
  it('should sync subscription status from Stripe using metadata.userId', async () => {
    const sub = mockStripeSubscription();

    await handleWebhookEvent(stripeEvent('customer.subscription.updated', sub));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
      })
    );
  });

  it('should fall back to customer ID lookup when metadata.userId is missing', async () => {
    const sub = mockStripeSubscription({ metadata: {} });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ userId: 'user_from_db' }]),
        }),
      }),
    });

    await handleWebhookEvent(stripeEvent('customer.subscription.updated', sub));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_from_db',
      expect.objectContaining({ stripeSubscriptionId: 'sub_test123' })
    );
  });

  it('should handle user-not-found gracefully when metadata missing and DB lookup fails', async () => {
    const sub = mockStripeSubscription({ metadata: {} });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await expect(
      handleWebhookEvent(stripeEvent('customer.subscription.updated', sub))
    ).resolves.toBeUndefined();

    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });
});

// ============================================================================
// syncSubscription status mapping (tested via handleSubscriptionUpdated)
// ============================================================================
describe('syncSubscription status mapping', () => {
  it('should map Stripe active status to active', async () => {
    const sub = mockStripeSubscription({ status: 'active' });
    await handleWebhookEvent(stripeEvent('customer.subscription.updated', sub));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ status: 'active' })
    );
  });

  it('should map Stripe past_due status to past_due', async () => {
    const sub = mockStripeSubscription({ status: 'past_due' });
    await handleWebhookEvent(stripeEvent('customer.subscription.updated', sub));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ status: 'past_due' })
    );
  });

  it('should map Stripe canceled status to canceled', async () => {
    const sub = mockStripeSubscription({ status: 'canceled' });
    await handleWebhookEvent(stripeEvent('customer.subscription.updated', sub));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ status: 'canceled' })
    );
  });

  it('should map Stripe incomplete_expired to canceled', async () => {
    const sub = mockStripeSubscription({ status: 'incomplete_expired' });
    await handleWebhookEvent(stripeEvent('customer.subscription.updated', sub));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ status: 'canceled' })
    );
  });

  it('should map Stripe unpaid to past_due', async () => {
    const sub = mockStripeSubscription({ status: 'unpaid' });
    await handleWebhookEvent(stripeEvent('customer.subscription.updated', sub));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ status: 'past_due' })
    );
  });

  it('should default to free tier when price ID is missing', async () => {
    const sub = mockStripeSubscription();
    sub.items.data = [];
    await handleWebhookEvent(stripeEvent('customer.subscription.updated', sub));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({ plan: 'free' })
    );
  });
});

// ============================================================================
// handleSubscriptionDeleted (via handleWebhookEvent)
// ============================================================================
describe('handleSubscriptionDeleted', () => {
  it('should downgrade user to free tier on cancellation', async () => {
    const sub = mockStripeSubscription({ status: 'canceled' });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ userId: 'user_abc123' }]),
        }),
      }),
    });

    await handleWebhookEvent(stripeEvent('customer.subscription.deleted', sub));

    expect(mockUpdateSubscription).toHaveBeenCalledWith(
      'user_abc123',
      expect.objectContaining({
        plan: 'free',
        status: 'active',
        stripeSubscriptionId: undefined,
        currentPeriodStart: undefined,
        currentPeriodEnd: undefined,
        cancelAtPeriodEnd: false,
      })
    );
  });

  it('should handle missing user gracefully', async () => {
    const sub = mockStripeSubscription({ status: 'canceled' });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await expect(
      handleWebhookEvent(stripeEvent('customer.subscription.deleted', sub))
    ).resolves.toBeUndefined();

    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });
});

// ============================================================================
// handlePaymentFailed (via handleWebhookEvent)
// ============================================================================
describe('handlePaymentFailed', () => {
  it('should mark subscription as past_due', async () => {
    const invoice = mockInvoice();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ userId: 'user_abc123' }]),
        }),
      }),
    });

    await handleWebhookEvent(stripeEvent('invoice.payment_failed', invoice));

    expect(mockUpdateSubscription).toHaveBeenCalledWith('user_abc123', {
      status: 'past_due',
    });
  });

  it('should silently return when no user found', async () => {
    const invoice = mockInvoice();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await expect(
      handleWebhookEvent(stripeEvent('invoice.payment_failed', invoice))
    ).resolves.toBeUndefined();

    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });

  it('should silently return when invoice has no subscription', async () => {
    const invoice = mockInvoice({ subscription: null });

    await handleWebhookEvent(stripeEvent('invoice.payment_failed', invoice));

    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });
});

// ============================================================================
// getOrCreateStripeCustomer
// ============================================================================
describe('getOrCreateStripeCustomer', () => {
  it('should return existing customer ID from database', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ stripeCustomerId: 'cus_existing' }]),
        }),
      }),
    });

    const customerId = await getOrCreateStripeCustomer('user_1', 'test@example.com');

    expect(customerId).toBe('cus_existing');
    expect(mockCustomersCreate).not.toHaveBeenCalled();
  });

  it('should create new Stripe customer if user does not have one', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockCustomersCreate.mockResolvedValue({ id: 'cus_new123' });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const customerId = await getOrCreateStripeCustomer('user_1', 'test@example.com');

    expect(customerId).toBe('cus_new123');
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'test@example.com',
      metadata: { userId: 'user_1' },
    });
  });

  it('should save new customer ID to database', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockCustomersCreate.mockResolvedValue({ id: 'cus_new456' });

    const mockSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockDbUpdate.mockReturnValue({ set: mockSet });

    await getOrCreateStripeCustomer('user_2', 'user2@example.com');

    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ stripeCustomerId: 'cus_new456' })
    );
  });

  it('should return existing ID when DB row has stripeCustomerId set', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ stripeCustomerId: 'cus_already' }]),
        }),
      }),
    });

    const result = await getOrCreateStripeCustomer('user_x', 'x@test.com');
    expect(result).toBe('cus_already');
    expect(mockCustomersCreate).not.toHaveBeenCalled();
  });
});

// ============================================================================
// createCheckoutSession
// ============================================================================
describe('createCheckoutSession', () => {
  beforeEach(() => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ stripeCustomerId: 'cus_test' }]),
        }),
      }),
    });
  });

  it('should create Stripe checkout session with correct params', async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_new',
      url: 'https://checkout.stripe.com/pay/cs_new',
    });

    const result = await createCheckoutSession('user_1', 'test@example.com', 'pro_monthly');

    expect(result).toEqual({
      url: 'https://checkout.stripe.com/pay/cs_new',
      sessionId: 'cs_new',
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_test',
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
        metadata: { userId: 'user_1' },
        allow_promotion_codes: true,
      })
    );
  });

  it('should throw for invalid price key', async () => {
    await expect(
      createCheckoutSession('user_1', 'test@example.com', 'invalid_key' as 'pro_monthly')
    ).rejects.toThrow('Invalid price key');
  });

  it('should throw when Stripe returns no URL', async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_no_url',
      url: null,
    });

    await expect(
      createCheckoutSession('user_1', 'test@example.com', 'pro_monthly')
    ).rejects.toThrow('Failed to create checkout session URL');
  });
});

// ============================================================================
// createBillingPortalSession
// ============================================================================
describe('createBillingPortalSession', () => {
  it('should create portal session and return URL', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ stripeCustomerId: 'cus_portal' }]),
        }),
      }),
    });
    mockBillingPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/session/portal_123',
    });

    const result = await createBillingPortalSession('user_1', 'test@example.com');

    expect(result).toEqual({
      url: 'https://billing.stripe.com/session/portal_123',
    });
    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_portal',
        return_url: 'http://localhost:3000/account',
      })
    );
  });
});

// ============================================================================
// getStripeSubscription
// ============================================================================
describe('getStripeSubscription', () => {
  it('should retrieve subscription from Stripe by ID', async () => {
    const sub = mockStripeSubscription();
    mockSubscriptionsRetrieve.mockResolvedValue(sub);

    const result = await getStripeSubscription('sub_test123');

    expect(result).toEqual(sub);
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_test123');
  });
});

// ============================================================================
// constructWebhookEvent
// ============================================================================
describe('constructWebhookEvent', () => {
  it('should delegate to stripe.webhooks.constructEvent', () => {
    const fakeEvent = stripeEvent('test.event', {});
    mockWebhooksConstructEvent.mockReturnValue(fakeEvent);

    const payload = Buffer.from('{"test": true}');
    const signature = 'test_sig_v1';

    const result = constructWebhookEvent(payload, signature);

    expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
      payload,
      signature,
      'whsec_test_secret'
    );
    expect(result).toEqual(fakeEvent);
  });
});

// ============================================================================
// getAvailablePrices
// ============================================================================
describe('getAvailablePrices', () => {
  it('should return live Stripe prices when API succeeds', async () => {
    mockPricesRetrieve.mockResolvedValue({
      id: 'price_pro_monthly',
      unit_amount: 1900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    const prices = await getAvailablePrices();

    expect(mockPricesRetrieve).toHaveBeenCalled();
    expect(prices.length).toBeGreaterThan(0);
    expect(prices[0]).toEqual(
      expect.objectContaining({
        amount: 1900,
        currency: 'usd',
        interval: 'month',
      })
    );
  });

  it('should skip prices that fail to retrieve from Stripe', async () => {
    let callCount = 0;
    mockPricesRetrieve.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          id: 'price_pro_monthly',
          unit_amount: 1900,
          currency: 'usd',
          recurring: { interval: 'month' },
        });
      }
      return Promise.reject(new Error('Stripe API error'));
    });

    const prices = await getAvailablePrices();

    expect(prices.length).toBe(1);
  });

  it('should skip prices with no unit_amount', async () => {
    mockPricesRetrieve.mockResolvedValue({
      id: 'price_pro_monthly',
      unit_amount: null,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    const prices = await getAvailablePrices();
    expect(prices.length).toBe(0);
  });
});

// ============================================================================
// getAvailablePricesWithFallback
// ============================================================================
describe('getAvailablePricesWithFallback', () => {
  it('should return live Stripe prices when API succeeds', async () => {
    mockPricesRetrieve.mockResolvedValue({
      id: 'price_pro_monthly',
      unit_amount: 1900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    const prices = await getAvailablePricesWithFallback();
    expect(prices.length).toBeGreaterThan(0);
  });

  it('should return empty array when all individual price fetches fail', async () => {
    // getAvailablePrices catches errors per-price, so individual failures
    // result in an empty array rather than triggering the fallback path.
    mockPricesRetrieve.mockRejectedValue(new Error('Network failure'));

    const prices = await getAvailablePricesWithFallback();

    expect(prices).toEqual([]);
  });
});

// ============================================================================
// initiateCheckout
// ============================================================================
describe('initiateCheckout', () => {
  it('should create checkout session with correct params for valid user', async () => {
    mockGetUserById.mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test',
      tier: 'free',
      isAdmin: false,
    });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ stripeCustomerId: 'cus_init' }]),
        }),
      }),
    });

    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_checkout',
      url: 'https://checkout.stripe.com/pay/cs_checkout',
    });

    const result = await initiateCheckout('user_1', 'pro_monthly');

    expect(result).toEqual({
      url: 'https://checkout.stripe.com/pay/cs_checkout',
      sessionId: 'cs_checkout',
    });
  });

  it('should return USER_NOT_FOUND error when user does not exist', async () => {
    mockGetUserById.mockResolvedValue(null);

    const result = await initiateCheckout('nonexistent_user', 'pro_monthly');

    expect(result).toEqual({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        status: 404,
      },
    });
  });

  it('should return INVALID_PRICE error for unconfigured price key', async () => {
    mockGetUserById.mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test',
      tier: 'free',
      isAdmin: false,
    });

    const result = await initiateCheckout('user_1', 'invalid_plan');

    expect(result).toEqual({
      error: {
        code: 'INVALID_PRICE',
        message: 'Price key "invalid_plan" is not configured',
        status: 400,
      },
    });
  });

  it('should return CHECKOUT_FAILED when Stripe throws an error', async () => {
    mockGetUserById.mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test',
      tier: 'free',
      isAdmin: false,
    });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ stripeCustomerId: 'cus_fail' }]),
        }),
      }),
    });

    mockCheckoutSessionsCreate.mockRejectedValue(new Error('Stripe API down'));

    const result = await initiateCheckout('user_1', 'pro_monthly');

    expect(result).toEqual({
      error: {
        code: 'CHECKOUT_FAILED',
        message: 'Failed to create checkout session',
        status: 400,
      },
    });
  });

  it('should create Stripe customer if user does not have one', async () => {
    mockGetUserById.mockResolvedValue({
      id: 'user_new',
      email: 'new@example.com',
      name: 'New',
      tier: 'free',
      isAdmin: false,
    });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockCustomersCreate.mockResolvedValue({ id: 'cus_brand_new' });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_new_cust',
      url: 'https://checkout.stripe.com/pay/cs_new_cust',
    });

    const result = await initiateCheckout('user_new', 'pro_monthly');

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'new@example.com',
      metadata: { userId: 'user_new' },
    });
    expect(result).toEqual({
      url: 'https://checkout.stripe.com/pay/cs_new_cust',
      sessionId: 'cs_new_cust',
    });
  });
});

// ============================================================================
// initiateBillingPortal
// ============================================================================
describe('initiateBillingPortal', () => {
  it('should create billing portal session for valid user', async () => {
    mockGetUserById.mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test',
      tier: 'pro',
      isAdmin: false,
    });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ stripeCustomerId: 'cus_portal_user' }]),
        }),
      }),
    });

    mockBillingPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/session/bp_123',
    });

    const result = await initiateBillingPortal('user_1');

    expect(result).toEqual({
      url: 'https://billing.stripe.com/session/bp_123',
    });
  });

  it('should return USER_NOT_FOUND error when user does not exist', async () => {
    mockGetUserById.mockResolvedValue(null);

    const result = await initiateBillingPortal('ghost_user');

    expect(result).toEqual({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        status: 404,
      },
    });
  });

  it('should return PORTAL_FAILED when Stripe throws an error', async () => {
    mockGetUserById.mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test',
      tier: 'pro',
      isAdmin: false,
    });

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ stripeCustomerId: 'cus_portal_err' }]),
        }),
      }),
    });

    mockBillingPortalSessionsCreate.mockRejectedValue(new Error('Portal API error'));

    const result = await initiateBillingPortal('user_1');

    expect(result).toEqual({
      error: {
        code: 'PORTAL_FAILED',
        message: 'Failed to create billing portal session',
        status: 400,
      },
    });
  });
});

// ============================================================================
// Edge cases -- Stripe API failures, missing fields
// ============================================================================
describe('Edge cases', () => {
  it('should handle Stripe subscriptions.retrieve throwing during checkout', async () => {
    const session = mockCheckoutSession();
    mockSubscriptionsRetrieve.mockRejectedValue(new Error('Network timeout'));

    await expect(
      handleWebhookEvent(stripeEvent('checkout.session.completed', session))
    ).rejects.toThrow('Network timeout');
  });

  it('should handle subscription with empty items.data array in checkout', async () => {
    const session = mockCheckoutSession();
    const sub = mockStripeSubscription();
    sub.items.data = [];
    mockSubscriptionsRetrieve.mockResolvedValue(sub);

    await handleWebhookEvent(stripeEvent('checkout.session.completed', session));

    // No tier can be determined from empty items, so updateSubscription should NOT be called
    expect(mockUpdateSubscription).not.toHaveBeenCalled();
  });

  it('should handle DB query failure in getOrCreateStripeCustomer', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('DB connection lost')),
        }),
      }),
    });

    await expect(
      getOrCreateStripeCustomer('user_1', 'test@example.com')
    ).rejects.toThrow('DB connection lost');
  });
});
