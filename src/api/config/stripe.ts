/**
 * Stripe Configuration for ZeroToShip API
 *
 * Handles Stripe client initialization and price ID mappings
 */

import Stripe from 'stripe';
import { config } from '../../config/env';
import logger from '../../lib/logger';

/**
 * Stripe client instance (lazy — avoids crash when STRIPE_SECRET_KEY is not set)
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!config.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(config.STRIPE_SECRET_KEY, {
      apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return _stripe;
}

/** @deprecated Use getStripe() instead — kept for backwards compatibility */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Stripe price IDs from environment
 */
export const STRIPE_PRICES = {
  pro_monthly: config.STRIPE_PRICE_PRO_MONTHLY,
  pro_yearly: config.STRIPE_PRICE_PRO_YEARLY,
  enterprise_monthly: config.STRIPE_PRICE_ENT_MONTHLY,
  enterprise_yearly: config.STRIPE_PRICE_ENT_YEARLY,
} as const;

/**
 * Valid price ID type
 */
export type StripePriceKey = keyof typeof STRIPE_PRICES;

/**
 * Map price IDs to tier names
 */
export function getPriceIdToTier(): Record<string, 'pro' | 'enterprise'> {
  return {
    [STRIPE_PRICES.pro_monthly]: 'pro',
    [STRIPE_PRICES.pro_yearly]: 'pro',
    [STRIPE_PRICES.enterprise_monthly]: 'enterprise',
    [STRIPE_PRICES.enterprise_yearly]: 'enterprise',
  };
}

/**
 * Get tier from Stripe price ID
 */
export function getTierFromPriceId(priceId: string): 'pro' | 'enterprise' | null {
  const mapping = getPriceIdToTier();
  return mapping[priceId] || null;
}

/**
 * Webhook secret for signature verification
 */
export const STRIPE_WEBHOOK_SECRET = config.STRIPE_WEBHOOK_SECRET;

/**
 * Frontend URLs for checkout redirects
 */
export const CHECKOUT_SUCCESS_URL = config.CHECKOUT_SUCCESS_URL;
export const CHECKOUT_CANCEL_URL = config.CHECKOUT_CANCEL_URL;
export const BILLING_PORTAL_RETURN_URL = config.BILLING_PORTAL_RETURN_URL;

/**
 * Price display info for frontend
 */
export const PRICE_INFO = {
  pro_monthly: {
    amount: 1900, // cents
    interval: 'month' as const,
    name: 'Pro Monthly',
    tier: 'pro' as const,
  },
  pro_yearly: {
    amount: 19000, // cents - 2 months free
    interval: 'year' as const,
    name: 'Pro Yearly',
    tier: 'pro' as const,
  },
  enterprise_monthly: {
    amount: 9900, // cents
    interval: 'month' as const,
    name: 'Enterprise Monthly',
    tier: 'enterprise' as const,
  },
  enterprise_yearly: {
    amount: 99000, // cents - 2 months free
    interval: 'year' as const,
    name: 'Enterprise Yearly',
    tier: 'enterprise' as const,
  },
};

/**
 * Validate Stripe configuration for production readiness
 */
export function validateStripeConfig(): void {
  if (!config.isProduction) return;

  const warn = (msg: string) => {
    logger.warn({ component: 'stripe' }, `PRODUCTION: ${msg}`);
  };

  if (config.STRIPE_SECRET_KEY.startsWith('sk_test_'))
    warn('STRIPE_SECRET_KEY is a test key');
  if (!config.STRIPE_WEBHOOK_SECRET)
    warn('STRIPE_WEBHOOK_SECRET is not set');
  if (config.CHECKOUT_SUCCESS_URL.includes('localhost'))
    warn('CHECKOUT_SUCCESS_URL contains localhost');
  if (config.CHECKOUT_CANCEL_URL.includes('localhost'))
    warn('CHECKOUT_CANCEL_URL contains localhost');
  if (config.BILLING_PORTAL_RETURN_URL.includes('localhost'))
    warn('BILLING_PORTAL_RETURN_URL contains localhost');

  for (const key of ['STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_YEARLY',
                       'STRIPE_PRICE_ENT_MONTHLY', 'STRIPE_PRICE_ENT_YEARLY'] as const) {
    if (!config[key]) warn(`${key} is not set`);
  }
}
