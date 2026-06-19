"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { posthog, initPostHog, isPostHogEnabled } from "@/lib/posthog";
import { useAuth } from "@/components/AuthProvider";

/**
 * Tracks client-side page views for Next.js App Router.
 *
 * PostHog's autocapture does not fire $pageview on client-side navigations
 * in the App Router. This component listens for route changes via
 * usePathname/useSearchParams and manually captures pageview events.
 */
function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isPostHogEnabled()) return;

    const url = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Identifies the authenticated user with PostHog and sets user properties.
 * Resets identity on logout.
 */
function PostHogIdentifier() {
  const { user, isAuthenticated } = useAuth();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isPostHogEnabled()) return;

    if (isAuthenticated && user) {
      // Only identify if the user changed (avoid redundant calls)
      if (previousUserId.current !== user.id) {
        // Promote first-touch acquisition attribution to person properties with
        // $set_once so a user's originating channel (e.g. chatgpt.com) survives
        // identify and is queryable in funnels. PostHog records the $initial_*
        // values automatically; we copy them to stable, named person props.
        const getInitial = (key: string): string | undefined =>
          (posthog.get_property?.(key) as string | undefined) ?? undefined;
        posthog.identify(
          user.id,
          {
            email: user.email,
            tier: user.tier,
            created_at: user.createdAt,
          },
          {
            initial_referring_domain: getInitial("$initial_referring_domain"),
            initial_utm_source: getInitial("$initial_utm_source"),
            initial_utm_medium: getInitial("$initial_utm_medium"),
            initial_utm_campaign: getInitial("$initial_utm_campaign"),
          }
        );
        previousUserId.current = user.id;
      }
    } else if (previousUserId.current !== null) {
      // User logged out — reset PostHog identity
      posthog.reset();
      previousUserId.current = null;
    }
  }, [isAuthenticated, user]);

  return null;
}

/**
 * Top-level PostHog provider that wraps the app.
 *
 * Handles:
 * - PostHog client initialization
 * - Automatic pageview tracking for App Router
 * - User identification on auth state changes
 *
 * When NEXT_PUBLIC_POSTHOG_KEY is not set, renders children without
 * any PostHog functionality (safe for local development).
 */
export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initPostHog();
      initialized.current = true;
    }
  }, []);

  if (!isPostHogEnabled()) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      <PostHogIdentifier />
      {children}
    </PHProvider>
  );
}
