/**
 * Test data fixtures for seeding and cleanup
 */

import { test as base, Page } from '@playwright/test';
import {
  SEED_IDEAS,
  TIER_LIMITS,
  UserTier,
  SeedIdea,
  TierLimits,
} from '../utils/test-data';
import { generateMockIdeas, MockIdea, setupAllApiMocks } from '../utils/api-mock.utils';

export interface TestDataFixtures {
  /**
   * Access to seed ideas data
   */
  seedIdeas: SeedIdea[];

  /**
   * Access to tier limits configuration
   */
  tierLimits: Record<UserTier, TierLimits>;

  /**
   * Generate mock ideas for testing
   */
  generateIdeas: (count?: number) => MockIdea[];

  /**
   * Setup API mocks for a given tier on a specific page
   */
  setupMocks: (page: Page, tier?: UserTier) => Promise<void>;
}

/**
 * Extended test with test data fixtures
 */
export const test = base.extend<TestDataFixtures>({
  seedIdeas: async ({}, use) => {
    await use(SEED_IDEAS);
  },

  tierLimits: async ({}, use) => {
    await use(TIER_LIMITS);
  },

  generateIdeas: async ({}, use) => {
    await use(generateMockIdeas);
  },

  setupMocks: async ({}, use) => {
    const setup = async (page: Page, tier: UserTier = 'anonymous') => {
      await setupAllApiMocks(page, tier);
    };

    await use(setup);
  },
});

export { expect } from '@playwright/test';
