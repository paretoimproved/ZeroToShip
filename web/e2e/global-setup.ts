/**
 * Global setup for Playwright E2E tests
 *
 * This file runs before all tests and handles:
 * - Authenticating test users
 * - Saving storage states for authenticated sessions
 */

import { chromium, FullConfig } from '@playwright/test';
import { TEST_USERS, AUTH_STATE_PATHS, API_URL, UserTier } from './utils/test-data';
import * as fs from 'fs';
import * as path from 'path';

const e2eDir = __dirname;

/**
 * Authenticate a user and save their storage state
 */
async function authenticateUser(
  tier: Exclude<UserTier, 'anonymous'>
): Promise<void> {
  const user = TEST_USERS[tier];

  if (!user.email || !user.password) {
    console.log(`Skipping ${tier} user - no credentials configured`);
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`Authenticating ${tier} user...`);

    // Try API-based authentication
    const response = await page.request.post(`${API_URL}/auth/login`, {
      data: {
        email: user.email,
        password: user.password,
      },
      failOnStatusCode: false,
    });

    if (response.ok()) {
      const data = await response.json();

      // Navigate to the app to set up storage
      await page.goto('http://localhost:3000');

      // Store authentication token
      await page.evaluate((token: string) => {
        localStorage.setItem('auth_token', token);
      }, data.token);

      // Save storage state
      const storagePath = path.join(e2eDir, AUTH_STATE_PATHS[tier]);
      await context.storageState({ path: storagePath });

      console.log(`Successfully authenticated ${tier} user`);
    } else {
      console.log(`API auth failed for ${tier} (status: ${response.status()})`);
      // Create an empty storage state file so tests can run without auth
      createEmptyStorageState(tier);
    }
  } catch (error) {
    console.log(`Failed to authenticate ${tier} user:`, error);
    // Create an empty storage state file
    createEmptyStorageState(tier);
  } finally {
    await browser.close();
  }
}

/**
 * Create an empty storage state file for unauthenticated testing
 */
function createEmptyStorageState(tier: Exclude<UserTier, 'anonymous'>): void {
  const storagePath = path.join(e2eDir, AUTH_STATE_PATHS[tier]);
  const emptyState = {
    cookies: [],
    origins: [],
  };

  // Ensure .auth directory exists
  const authDir = path.dirname(storagePath);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  fs.writeFileSync(storagePath, JSON.stringify(emptyState, null, 2));
  console.log(`Created empty storage state for ${tier} user`);
}

/**
 * Ensure .auth directory exists
 */
function ensureAuthDirectory(): void {
  const authDir = path.join(e2eDir, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log('Created .auth directory');
  }
}

/**
 * Global setup function
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n=== Playwright Global Setup ===\n');

  // Ensure auth directory exists
  ensureAuthDirectory();

  // Skip authentication in CI if no API is available
  const skipAuth = process.env.SKIP_AUTH === 'true';

  if (skipAuth) {
    console.log('Skipping authentication (SKIP_AUTH=true)');
    // Create empty storage states for all tiers
    createEmptyStorageState('free');
    createEmptyStorageState('pro');
    createEmptyStorageState('enterprise');
    return;
  }

  // Authenticate each user tier
  const tiers: Array<Exclude<UserTier, 'anonymous'>> = ['free', 'pro', 'enterprise'];

  for (const tier of tiers) {
    try {
      await authenticateUser(tier);
    } catch (error) {
      console.error(`Error setting up ${tier} user:`, error);
      createEmptyStorageState(tier);
    }
  }

  console.log('\n=== Global Setup Complete ===\n');
}

export default globalSetup;
