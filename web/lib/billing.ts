/**
 * Billing utilities for ZeroToShip frontend
 *
 * Provides easy-to-use functions for Stripe checkout and billing portal
 */

import { api } from "./api";

export type PriceKey =
  | "pro_monthly"
  | "pro_yearly"
  | "enterprise_monthly"
  | "enterprise_yearly";

export interface PriceInfo {
  key: PriceKey;
  priceId: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  tier: "pro" | "enterprise";
}

/**
 * Create a Stripe checkout session and redirect to checkout
 */
export async function createCheckoutSession(priceKey: PriceKey): Promise<void> {
  const { url } = await api.createCheckoutSession(priceKey);
  window.location.href = url;
}

/**
 * Open the Stripe billing portal for subscription management
 */
export async function openBillingPortal(): Promise<void> {
  const { url } = await api.createBillingPortalSession();
  window.location.href = url;
}

/**
 * Get available subscription prices
 */
export async function getBillingPrices(): Promise<PriceInfo[]> {
  const { prices } = await api.getBillingPrices();
  return prices as PriceInfo[];
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Price display info (static fallback)
 */
export const PRICE_DISPLAY = {
  pro_monthly: {
    amount: 1900,
    interval: "month" as const,
    name: "Pro",
    description: "Perfect for indie hackers",
  },
  pro_yearly: {
    amount: 19000,
    interval: "year" as const,
    name: "Pro",
    description: "2 months free",
  },
  enterprise_monthly: {
    amount: 9900,
    interval: "month" as const,
    name: "Enterprise",
    description: "For teams and agencies",
  },
  enterprise_yearly: {
    amount: 99000,
    interval: "year" as const,
    name: "Enterprise",
    description: "2 months free",
  },
};
