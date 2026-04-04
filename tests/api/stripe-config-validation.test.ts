import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWarn, mockConfig } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
  mockConfig: { value: {} as Record<string, unknown> },
}));

vi.mock('../../src/lib/logger', () => ({
  default: {
    warn: (...args: unknown[]) => mockWarn(...args),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/config/env', () => ({
  config: new Proxy(
    {},
    {
      get(_target, prop) {
        return mockConfig.value[prop as string];
      },
    }
  ),
}));

// Mock Stripe to prevent initialization errors
vi.mock('stripe', () => {
  const StripeMock = vi.fn(() => ({}));
  return { default: StripeMock };
});

// Import after mocks
import { validateStripeConfig } from '../../src/api/config/stripe';

describe('validateStripeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: production config with all values set properly
    mockConfig.value = {
      isProduction: true,
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: 'sk_live_xxxxxxxxxxxx',
      STRIPE_WEBHOOK_SECRET: 'whsec_xxxxxxxxxxxx',
      CHECKOUT_SUCCESS_URL: 'https://zerotoship.dev/account?session_id={CHECKOUT_SESSION_ID}',
      CHECKOUT_CANCEL_URL: 'https://zerotoship.dev/pricing',
      BILLING_PORTAL_RETURN_URL: 'https://zerotoship.dev/account',
      STRIPE_PRICE_PRO_MONTHLY: 'price_xxx',
      STRIPE_PRICE_PRO_YEARLY: 'price_xxx',
      STRIPE_PRICE_ENT_MONTHLY: 'price_xxx',
      STRIPE_PRICE_ENT_YEARLY: 'price_xxx',
    };
  });

  it('logs warning for sk_test_ key in production', () => {
    mockConfig.value.STRIPE_SECRET_KEY = 'sk_test_xxxxxxxxxxxx';
    validateStripeConfig();
    expect(mockWarn).toHaveBeenCalledWith(
      { component: 'stripe' },
      'PRODUCTION: STRIPE_SECRET_KEY is a test key'
    );
  });

  it('logs warning for localhost URLs in production', () => {
    mockConfig.value.CHECKOUT_SUCCESS_URL = 'http://localhost:3000/account';
    validateStripeConfig();
    expect(mockWarn).toHaveBeenCalledWith(
      { component: 'stripe' },
      'PRODUCTION: CHECKOUT_SUCCESS_URL contains localhost'
    );
  });

  it('does not warn for non-production environments', () => {
    mockConfig.value.isProduction = false;
    mockConfig.value.STRIPE_SECRET_KEY = 'sk_test_xxxxxxxxxxxx';
    validateStripeConfig();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('does not warn when all config is properly set', () => {
    validateStripeConfig();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('warns when webhook secret is missing', () => {
    mockConfig.value.STRIPE_WEBHOOK_SECRET = '';
    validateStripeConfig();
    expect(mockWarn).toHaveBeenCalledWith(
      { component: 'stripe' },
      'PRODUCTION: STRIPE_WEBHOOK_SECRET is not set'
    );
  });

  it('warns when price IDs are missing', () => {
    mockConfig.value.STRIPE_PRICE_PRO_MONTHLY = '';
    validateStripeConfig();
    expect(mockWarn).toHaveBeenCalledWith(
      { component: 'stripe' },
      'PRODUCTION: STRIPE_PRICE_PRO_MONTHLY is not set'
    );
  });
});
