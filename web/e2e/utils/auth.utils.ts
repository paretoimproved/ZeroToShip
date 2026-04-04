/**
 * Authentication utilities for E2E tests
 */

import { Page, BrowserContext } from '@playwright/test';
import { API_URL, TEST_USERS, AUTH_STATE_PATHS, UserTier } from './test-data';

/**
 * Authenticate a user and save the storage state
 */
export async function authenticateUser(
  page: Page,
  context: BrowserContext,
  tier: Exclude<UserTier, 'anonymous'>
): Promise<void> {
  const user = TEST_USERS[tier];

  if (!user.email || !user.password) {
    throw new Error(`User ${tier} does not have credentials`);
  }

  // Try API-based authentication first
  try {
    const response = await page.request.post(`${API_URL}/auth/login`, {
      data: {
        email: user.email,
        password: user.password,
      },
    });

    if (response.ok()) {
      const data = await response.json();
      // Store token in localStorage or cookies depending on your auth implementation
      await page.goto('/');
      await page.evaluate((token) => {
        localStorage.setItem('auth_token', token);
      }, data.token);

      // Save storage state
      await context.storageState({ path: AUTH_STATE_PATHS[tier] });
      return;
    }
  } catch {
    // API auth failed, fall back to UI login
    console.log(`API auth failed for ${tier}, falling back to UI login`);
  }

  // UI-based authentication fallback
  await page.goto('/login');

  // Wait for login form and fill credentials
  await page.fill('input[name="email"], input[type="email"]', user.email);
  await page.fill('input[name="password"], input[type="password"]', user.password);
  await page.click('button[type="submit"]');

  // Wait for successful navigation after login
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10000,
  });

  // Save storage state
  await context.storageState({ path: AUTH_STATE_PATHS[tier] });
}

/**
 * Clear authentication state
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Clear cookies
  const context = page.context();
  await context.clearCookies();
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => {
    return localStorage.getItem('auth_token');
  });

  return !!token;
}

/**
 * Get the current user's tier from the page
 */
export async function getCurrentUserTier(page: Page): Promise<UserTier | null> {
  try {
    const response = await page.request.get(`${API_URL}/auth/me`);
    if (response.ok()) {
      const data = await response.json();
      return data.tier as UserTier;
    }
  } catch {
    // Not authenticated
  }

  return null;
}
