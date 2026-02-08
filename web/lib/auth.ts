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

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Handle the OAuth callback by extracting the session from the URL hash.
 * Called by AuthProvider on mount to detect OAuth redirects.
 * Returns the access token if an OAuth session was found, null otherwise.
 */
export async function handleOAuthCallback(): Promise<string | null> {
  // Supabase puts tokens in the URL hash after OAuth redirect
  if (typeof window === "undefined") return null;

  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get("access_token");

  if (!accessToken) return null;

  // Store the token
  setToken(accessToken);

  // Clean the URL hash
  window.history.replaceState(null, "", window.location.pathname + window.location.search);

  return accessToken;
}
