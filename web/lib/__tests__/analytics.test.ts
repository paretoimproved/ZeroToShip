import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so these variables are available inside the hoisted vi.mock factory
const { mockCapture, mockIsEnabled } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockIsEnabled: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  posthog: {
    capture: mockCapture,
  },
  isPostHogEnabled: () => mockIsEnabled(),
}));

import {
  trackSignupCompleted,
  trackLoginCompleted,
  trackIdeaViewed,
  trackIdeaSaved,
  trackUpgradeClicked,
  trackArchiveFiltered,
  trackEmailSettingsChanged,
  trackOnboardingStep,
} from "../analytics";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Analytics event helpers", () => {
  describe("when PostHog is enabled", () => {
    beforeEach(() => {
      mockIsEnabled.mockReturnValue(true);
    });

    it("trackSignupCompleted captures signup_completed with provider", () => {
      trackSignupCompleted("google");

      expect(mockCapture).toHaveBeenCalledWith("signup_completed", {
        provider: "google",
      });
    });

    it("trackLoginCompleted captures login_completed with email provider", () => {
      trackLoginCompleted("email");

      expect(mockCapture).toHaveBeenCalledWith("login_completed", {
        provider: "email",
      });
    });

    it("trackIdeaViewed captures idea_viewed with properties", () => {
      trackIdeaViewed({
        ideaId: "idea-123",
        source: "archive_modal",
        score: 87,
      });

      expect(mockCapture).toHaveBeenCalledWith("idea_viewed", {
        ideaId: "idea-123",
        source: "archive_modal",
        score: 87,
      });
    });

    it("trackIdeaSaved captures idea_saved with ideaId", () => {
      trackIdeaSaved("idea-456");

      expect(mockCapture).toHaveBeenCalledWith("idea_saved", {
        ideaId: "idea-456",
      });
    });

    it("trackUpgradeClicked captures upgrade_clicked with tier info", () => {
      trackUpgradeClicked({
        from_tier: "free",
        to_tier: "pro",
        location: "archive_wall",
      });

      expect(mockCapture).toHaveBeenCalledWith("upgrade_clicked", {
        from_tier: "free",
        to_tier: "pro",
        location: "archive_wall",
      });
    });

    it("trackArchiveFiltered captures archive_filtered with filter details", () => {
      trackArchiveFiltered({
        filter_type: "effort",
        filter_value: "weekend",
      });

      expect(mockCapture).toHaveBeenCalledWith("archive_filtered", {
        filter_type: "effort",
        filter_value: "weekend",
      });
    });

    it("trackEmailSettingsChanged captures email_settings_changed", () => {
      trackEmailSettingsChanged({
        frequency: "daily",
        categories: ["saas", "ai"],
      });

      expect(mockCapture).toHaveBeenCalledWith("email_settings_changed", {
        frequency: "daily",
        categories: ["saas", "ai"],
      });
    });

    it("trackOnboardingStep captures onboarding_step with step name", () => {
      trackOnboardingStep("welcome");

      expect(mockCapture).toHaveBeenCalledWith("onboarding_step", {
        step_name: "welcome",
      });
    });
  });

  describe("when PostHog is disabled", () => {
    beforeEach(() => {
      mockIsEnabled.mockReturnValue(false);
    });

    it("trackSignupCompleted does not call capture", () => {
      trackSignupCompleted("github");

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("trackLoginCompleted does not call capture", () => {
      trackLoginCompleted("email");

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("trackIdeaViewed does not call capture", () => {
      trackIdeaViewed({ ideaId: "idea-123" });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("trackUpgradeClicked does not call capture", () => {
      trackUpgradeClicked({
        from_tier: "free",
        to_tier: "pro",
        location: "pricing_page",
      });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("trackArchiveFiltered does not call capture", () => {
      trackArchiveFiltered({
        filter_type: "date_range",
        filter_value: "7d",
      });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("trackEmailSettingsChanged does not call capture", () => {
      trackEmailSettingsChanged({
        frequency: "weekly",
        categories: ["developer-tools"],
      });

      expect(mockCapture).not.toHaveBeenCalled();
    });
  });
});
