/**
 * PostHog analytics client configuration for ZeroToShip.
 *
 * Initializes the PostHog client using environment variables.
 * Disabled in development unless NEXT_PUBLIC_POSTHOG_KEY is explicitly set.
 */

import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * Whether PostHog analytics is enabled.
 * Requires NEXT_PUBLIC_POSTHOG_KEY to be set. This prevents initialization
 * in local development without a key, avoiding console errors.
 */
export const isPostHogEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  return posthogKey.length > 0;
};

/**
 * Initialize PostHog. Should be called once on app mount (client-side only).
 * No-ops if the key is not configured.
 */
export function initPostHog(): void {
  if (!isPostHogEnabled()) return;

  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: true,
    capture_pageview: false, // We handle pageviews manually for Next.js App Router
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
}

export { posthog };
