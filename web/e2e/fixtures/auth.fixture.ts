/**
 * Authentication fixtures for different user tiers
 */

import { test as base, Page, BrowserContext } from '@playwright/test';
import { AUTH_STATE_PATHS } from '../utils/test-data';
import { clearAuth } from '../utils/auth.utils';
import path from 'path';

// Resolve auth paths relative to e2e directory
const e2eDir = path.dirname(__dirname);
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function buildMockUser(tier: 'free' | 'pro' | 'enterprise') {
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  return {
    id: `${tier}-user-123`,
    email: `${tier}@test.zerotoship.dev`,
    name: `${label} User`,
    tier,
    isAdmin: tier === 'enterprise',
    preferences: {
      emailFrequency: 'daily',
    },
  };
}

async function attachAuthenticatedRoutes(
  page: Page,
  tier: 'free' | 'pro' | 'enterprise'
): Promise<void> {
  let emailFrequency: 'daily' | 'weekly' | 'never' = 'daily';

  await page.route(`${API_URL}/auth/me`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...buildMockUser(tier),
        preferences: { emailFrequency },
      }),
    });
  });

  await page.route(`${API_URL}/user/preferences`, async (route) => {
    if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
      const payload = route.request().postDataJSON() as
        | { emailFrequency?: 'daily' | 'weekly' | 'never' }
        | undefined;
      if (payload?.emailFrequency) {
        emailFrequency = payload.emailFrequency;
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...buildMockUser(tier),
        preferences: { emailFrequency },
      }),
    });
  });

  await page.route(`${API_URL}/ideas/saved`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route(`${API_URL}/user/subscription`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: `sub_${tier}_123`,
        userId: `${tier}-user-123`,
        plan: tier,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
      }),
    });
  });
}

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

    await context.addInitScript((tier: string) => {
      localStorage.setItem('zerotoship_token', `fake-${tier}-token`);
    }, 'free');

    const page = await context.newPage();
    await attachAuthenticatedRoutes(page, 'free');

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

    await context.addInitScript((tier: string) => {
      localStorage.setItem('zerotoship_token', `fake-${tier}-token`);
    }, 'pro');

    const page = await context.newPage();
    await attachAuthenticatedRoutes(page, 'pro');

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

    await context.addInitScript((tier: string) => {
      localStorage.setItem('zerotoship_token', `fake-${tier}-token`);
    }, 'enterprise');

    const page = await context.newPage();
    await attachAuthenticatedRoutes(page, 'enterprise');

    await use(page);

    await context.close();
  },
});

export { expect } from '@playwright/test';
