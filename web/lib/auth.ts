/**
 * Authentication utilities for ZeroToShip
 */

import { api } from "./api";
import type { User } from "./types";

const TOKEN_KEY = "zerotoship_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  api.setToken(token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  api.setToken(null);
}

export function initAuth(): void {
  const token = getToken();
  if (token) {
    api.setToken(token);
  }
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Login failed" }));
    throw new Error(error.message);
  }

  const { token, user } = await response.json();
  setToken(token);
  return user;
}

export async function signup(
  email: string,
  password: string,
  name: string
): Promise<{ user: User; needsEmailConfirmation: boolean }> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/auth/signup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Signup failed" }));
    throw new Error(error.message);
  }

  const { token, user, needsEmailConfirmation } = await response.json();
  if (token) {
    setToken(token);
  } else {
    // Ensure we don't persist an empty token in localStorage.
    clearToken();
  }
  return { user, needsEmailConfirmation: Boolean(needsEmailConfirmation) };
}

export function logout(): void {
  clearToken();
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export type OAuthProvider = "google" | "github";

/**
 * Initiate OAuth login/signup with a social provider.
 * Used for GitHub (redirect flow). Google uses loginWithGoogleToken() instead.
 */
export async function loginWithOAuth(provider: OAuthProvider): Promise<void> {
  const { supabase } = await import("./supabase");

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/login`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Complete Google sign-in by sending a credential (ID token) or authorization code to the backend.
 * The backend verifies the token with Supabase and returns a session.
 */
export async function loginWithGoogleCode(codeOrCredential: string, type: "credential" | "code" = "credential"): Promise<OAuthCallbackResult> {
  const body = type === "credential"
    ? { credential: codeOrCredential }
    : { code: codeOrCredential, redirect_uri: `${window.location.origin}/login` };
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/auth/google`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Google sign-in failed" }));
    throw new Error(error.message);
  }

  const { token, user } = await response.json();
  setToken(token);
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || "",
      tier: user.tier || "free",
      preferences: { emailFrequency: "daily" },
      createdAt: new Date().toISOString(),
    },
  };
}

/** Result of a successful OAuth callback */
export interface OAuthCallbackResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    tier: "free" | "pro" | "enterprise";
    preferences: { emailFrequency: "daily" };
    createdAt: string;
  };
}

/**
 * Handle the OAuth callback after Supabase redirects back to our app.
 * Called by AuthProvider on mount to detect OAuth redirects.
 *
 * Returns the access token and a minimal user object from the Supabase
 * session so the UI can redirect immediately without waiting for /auth/me.
 */
export async function handleOAuthCallback(): Promise<OAuthCallbackResult | null> {
  if (typeof window === "undefined") return null;

  // Only run when OAuth callback indicators are present in the URL
  const hasCode = window.location.search.includes("code=");
  const hasHashToken = window.location.hash.includes("access_token");

  if (!hasCode && !hasHashToken) return null;

  const { supabase } = await import("./supabase");

  let session;

  if (hasCode) {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return null;

    // Google OAuth redirects include a "scope" param; Supabase PKCE does not.
    // On mobile, useGoogleLogin falls back to a redirect flow, so the Google
    // auth code lands here. Route it to our backend instead of Supabase.
    if (params.has("scope")) {
      const result = await loginWithGoogleCode(code, "code");
      window.history.replaceState(null, "", window.location.pathname);
      return result;
    }

    // Supabase PKCE flow: exchange the authorization code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) return null;
    session = data.session;
  } else {
    // Implicit flow: session is extracted from the URL hash automatically
    const { data: { session: existing }, error } = await supabase.auth.getSession();
    if (error || !existing) return null;
    session = existing;
  }

  const accessToken = session.access_token;
  setToken(accessToken);

  // Clean OAuth params from URL
  window.history.replaceState(null, "", window.location.pathname);

  // Extract minimal user from Supabase session for instant redirect.
  // The full profile (tier, isAdmin) is fetched in the background by AuthProvider.
  const meta = session.user.user_metadata || {};
  return {
    token: accessToken,
    user: {
      id: session.user.id,
      email: session.user.email || "",
      name: meta.full_name || meta.name || meta.user_name || "",
      tier: "free",
      preferences: { emailFrequency: "daily" },
      createdAt: session.user.created_at || new Date().toISOString(),
    },
  };
}
