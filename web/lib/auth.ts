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
): Promise<User> {
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

  const { token, user } = await response.json();
  setToken(token);
  return user;
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
 * Redirects the browser to the provider's OAuth consent screen.
 */
export async function loginWithOAuth(provider: OAuthProvider): Promise<void> {
  const { supabase } = await import("./supabase");

  // Redirect back to /login (not /dashboard) so the OAuth callback
  // lands on a page WITHOUT ProtectedLayout. AuthProvider processes
  // the token, then the login page redirects to /dashboard.
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
 * Handle the OAuth callback after Supabase redirects back to our app.
 * Called by AuthProvider on mount to detect OAuth redirects.
 *
 * The Supabase client automatically detects PKCE `?code=` params and
 * implicit `#access_token=` fragments during initialization and exchanges
 * them for a session internally. We just need to call getSession() which
 * waits for that initialization to complete, then grab the access token.
 *
 * Returns the access token if an OAuth session was found, null otherwise.
 */
export async function handleOAuthCallback(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  // Only run when OAuth callback indicators are present in the URL
  const hasCode = window.location.search.includes("code=");
  const hasHashToken = window.location.hash.includes("access_token");

  if (!hasCode && !hasHashToken) return null;

  const { supabase } = await import("./supabase");

  let session;

  if (hasCode) {
    // PKCE flow: exchange the authorization code for a session
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return null;
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

  return accessToken;
}
