/**
 * Authentication fixtures for different user tiers
 */

import { test as base, Page, BrowserContext } from '@playwright/test';
import { AUTH_STATE_PATHS } from '../utils/test-data';
import { clearAuth } from '../utils/auth.utils';
import path from 'path';

// Resolve auth paths relative to e2e directory
const e2eDir = path.dirname(__dirname);

export interface AuthFixtures {
  /**
   * Page context for anonymous users (no authentication)
   */
  asAnonymous: Page;

  /**
   * Page context with free tier user authentication
   */
  asFreeUser: Page;

  /**
   * Page context with pro tier user authentication
   */
  asProUser: Page;

  /**
   * Page context with enterprise tier user authentication
   */
  asEnterpriseUser: Page;
}

/**
 * Extended test with authentication fixtures
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Anonymous user - clears any existing auth state
   */
  asAnonymous: async ({ page }, use) => {
    // Navigate first so localStorage is accessible
    await page.goto('/');

    // Clear any existing authentication
    await clearAuth(page);

    await use(page);
  },

  /**
   * Free tier user - loads storage state from file
   */
  asFreeUser: async ({ browser }, use) => {
    const storagePath = path.join(e2eDir, AUTH_STATE_PATHS.free);

    let context: BrowserContext;
    try {
      // Try to use existing storage state
      context = await browser.newContext({
        storageState: storagePath,
      });
    } catch {
      // If storage state doesn't exist, create a new context
      console.warn(`Storage state not found at ${storagePath}, using fresh context`);
      context = await browser.newContext();
    }

    const page = await context.newPage();
    await use(page);

    await context.close();
  },

  /**
   * Pro tier user - loads storage state from file
   */
  asProUser: async ({ browser }, use) => {
    const storagePath = path.join(e2eDir, AUTH_STATE_PATHS.pro);

    let context: BrowserContext;
    try {
      context = await browser.newContext({
        storageState: storagePath,
      });
    } catch {
      console.warn(`Storage state not found at ${storagePath}, using fresh context`);
      context = await browser.newContext();
    }

    const page = await context.newPage();
    await use(page);

    await context.close();
  },

  /**
   * Enterprise tier user - loads storage state from file
   */
  asEnterpriseUser: async ({ browser }, use) => {
    const storagePath = path.join(e2eDir, AUTH_STATE_PATHS.enterprise);

    let context: BrowserContext;
    try {
      context = await browser.newContext({
        storageState: storagePath,
      });
    } catch {
      console.warn(`Storage state not found at ${storagePath}, using fresh context`);
      context = await browser.newContext();
    }

    const page = await context.newPage();
    await use(page);

    await context.close();
  },
});

export { expect } from '@playwright/test';
