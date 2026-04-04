/**
 * E2E test fixtures - barrel export
 *
 * This file merges all fixtures into a single test object that can be imported
 * by test files to access all fixtures at once.
 */

import { mergeTests } from '@playwright/test';
import { test as authTest, type AuthFixtures } from './auth.fixture';
import { test as testDataTest, type TestDataFixtures } from './test-data.fixture';

// Merge all fixtures into a single test object
export const test = mergeTests(authTest, testDataTest);

// Re-export expect for convenience
export { expect } from '@playwright/test';

// Re-export fixture types
export type { AuthFixtures, TestDataFixtures };
