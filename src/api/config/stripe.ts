/**
 * Stripe Configuration for IdeaForge API
 *
 * Handles Stripe client initialization and price ID mappings
 */

import Stripe from 'stripe';

/**
 * Stripe client instance
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
  typescript: true,
});

/**
 * Stripe price IDs from environment
 */
export const STRIPE_PRICES = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY!,
  enterprise_monthly: process.env.STRIPE_PRICE_ENT_MONTHLY!,
  enterprise_yearly: process.env.STRIPE_PRICE_ENT_YEARLY!,
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
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * Frontend URLs for checkout redirects
 */
export const CHECKOUT_SUCCESS_URL =
  process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:3000/account?session_id={CHECKOUT_SESSION_ID}';
export const CHECKOUT_CANCEL_URL =
  process.env.CHECKOUT_CANCEL_URL || 'http://localhost:3000/pricing';
export const BILLING_PORTAL_RETURN_URL =
  process.env.BILLING_PORTAL_RETURN_URL || 'http://localhost:3000/account';

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
