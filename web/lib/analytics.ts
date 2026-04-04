/**
 * Product analytics event helpers for ZeroToShip.
 *
 * Thin wrappers around posthog.capture() that enforce a consistent
 * event naming convention and typed properties.
 *
 * All functions are safe to call when PostHog is not initialized
 * (e.g. in local development without the env var set).
 */

import { posthog, isPostHogEnabled } from "./posthog";
import type { OAuthProvider } from "./auth";

// ─── Auth Events ─────────────────────────────────────────────────────────────

export function trackSignupCompleted(provider: OAuthProvider | "email"): void {
  if (!isPostHogEnabled()) return;
  posthog.capture("signup_completed", { provider });
}

export function trackLoginCompleted(provider: OAuthProvider | "email"): void {
  if (!isPostHogEnabled()) return;
  posthog.capture("login_completed", { provider });
}

// ─── Idea Events ─────────────────────────────────────────────────────────────

export function trackIdeaViewed(properties: {
  ideaId: string;
  source?: string;
  score?: number;
}): void {
  if (!isPostHogEnabled()) return;
  posthog.capture("idea_viewed", properties);
}

export function trackIdeaSaved(ideaId: string): void {
  if (!isPostHogEnabled()) return;
  posthog.capture("idea_saved", { ideaId });
}

// ─── Upgrade / Billing Events ────────────────────────────────────────────────

export function trackUpgradeClicked(properties: {
  from_tier: string;
  to_tier: string;
  location: string;
}): void {
  if (!isPostHogEnabled()) return;
  posthog.capture("upgrade_clicked", properties);
}

// ─── Archive Events ──────────────────────────────────────────────────────────

export function trackArchiveFiltered(properties: {
  filter_type: string;
  filter_value: string;
}): void {
  if (!isPostHogEnabled()) return;
  posthog.capture("archive_filtered", properties);
}

// ─── Settings Events ─────────────────────────────────────────────────────────

export function trackEmailSettingsChanged(properties: {
  frequency: string;
  categories: string[];
}): void {
  if (!isPostHogEnabled()) return;
  posthog.capture("email_settings_changed", properties);
}

// ─── Onboarding Events ──────────────────────────────────────────────────────

export function trackOnboardingStep(stepName: string): void {
  if (!isPostHogEnabled()) return;
  posthog.capture("onboarding_step", { step_name: stepName });
}
