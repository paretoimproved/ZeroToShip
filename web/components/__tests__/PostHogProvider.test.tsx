import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Use vi.hoisted so mock variables are available inside the hoisted vi.mock factory
const { mockInit, mockCapture, mockIdentify, mockReset, mockEnabled } =
  vi.hoisted(() => ({
    mockInit: vi.fn(),
    mockCapture: vi.fn(),
    mockIdentify: vi.fn(),
    mockReset: vi.fn(),
    mockEnabled: { value: false },
  }));

vi.mock("@/lib/posthog", () => ({
  posthog: {
    init: mockInit,
    capture: mockCapture,
    identify: mockIdentify,
    reset: mockReset,
  },
  initPostHog: mockInit,
  isPostHogEnabled: () => mockEnabled.value,
}));

// Mock posthog-js/react to render children directly
vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => ({
    toString: () => "",
  }),
}));

// Mock AuthProvider
const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    current: {
      user: null as { id: string; email: string; name: string; tier: string; createdAt: string; preferences: { categories: string[]; effortFilter: string[]; emailFrequency: string; minPriorityScore: number } } | null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      loginWithOAuth: vi.fn(),
      logout: vi.fn(),
    },
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => mockAuthState.current,
}));

import PostHogProvider from "../PostHogProvider";

beforeEach(() => {
  vi.clearAllMocks();
  mockEnabled.value = false;
  mockAuthState.current = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    loginWithOAuth: vi.fn(),
    logout: vi.fn(),
  };
});

describe("PostHogProvider", () => {
  it("renders children when PostHog key is not set", () => {
    mockEnabled.value = false;

    render(
      <PostHogProvider>
        <div data-testid="child">Hello</div>
      </PostHogProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders children when PostHog key is set", () => {
    mockEnabled.value = true;

    render(
      <PostHogProvider>
        <div data-testid="child">Hello</div>
      </PostHogProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("does not crash without any PostHog configuration", () => {
    mockEnabled.value = false;

    expect(() => {
      render(
        <PostHogProvider>
          <span>No crash</span>
        </PostHogProvider>
      );
    }).not.toThrow();

    expect(screen.getByText("No crash")).toBeInTheDocument();
  });

  it("calls initPostHog on mount when enabled", () => {
    mockEnabled.value = true;

    render(
      <PostHogProvider>
        <div>Child</div>
      </PostHogProvider>
    );

    expect(mockInit).toHaveBeenCalled();
  });
});
