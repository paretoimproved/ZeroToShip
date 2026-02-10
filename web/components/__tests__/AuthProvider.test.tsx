import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "../AuthProvider";
import type { User } from "@/lib/types";

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  initAuth: vi.fn(),
  getToken: vi.fn(),
  handleOAuthCallback: vi.fn(),
  loginWithOAuth: vi.fn(),
}));

// Import the mocked functions for test control
import {
  login as authLogin,
  signup as authSignup,
  logout as authLogout,
  initAuth,
  getToken,
  handleOAuthCallback,
  loginWithOAuth,
} from "@/lib/auth";

const mockUser: User = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  tier: "free",
  preferences: {
    categories: [],
    effortFilter: [],
    emailFrequency: "weekly",
    minPriorityScore: 0,
  },
  createdAt: "2026-01-01T00:00:00Z",
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(handleOAuthCallback).mockResolvedValue(null);
  vi.mocked(getToken).mockReturnValue(null);
  // Mock global fetch
  vi.stubGlobal("fetch", vi.fn());
});

describe("AuthProvider", () => {
  it("provides default unauthenticated state", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for loading to finish (useEffect restoreAuth)
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("isLoading is true during session restoration", () => {
    // Make handleOAuthCallback hang so loading stays true
    vi.mocked(handleOAuthCallback).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it("restores session when token exists", async () => {
    vi.mocked(getToken).mockReturnValue("existing-token");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({
        headers: { Authorization: "Bearer existing-token" },
      }),
    );
  });

  it("login calls API and updates context", async () => {
    vi.mocked(authLogin).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      const user = await result.current.login("test@example.com", "password");
      expect(user).toEqual(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(authLogin).toHaveBeenCalledWith("test@example.com", "password");
  });

  it("logout clears state", async () => {
    vi.mocked(authLogin).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Login first
    await act(async () => {
      await result.current.login("test@example.com", "password");
    });
    expect(result.current.isAuthenticated).toBe(true);

    // Now logout
    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(authLogout).toHaveBeenCalled();
  });

  it("handles OAuth callback when token is in URL", async () => {
    vi.mocked(handleOAuthCallback).mockResolvedValue("oauth-token");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({
        headers: { Authorization: "Bearer oauth-token" },
      }),
    );
  });
});

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");

    spy.mockRestore();
  });
});
