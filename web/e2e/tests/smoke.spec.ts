/**
 * Smoke tests to verify E2E infrastructure is working
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ZeroToShip/i);
  });

  test('navigation bar is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('a:has-text("ZeroToShip")')).toBeVisible();
  });

  test('can navigate to archive page', async ({ page }) => {
    await page.goto('/');
    await page.click('nav a:has-text("Archive")');
    await expect(page).toHaveURL('/archive');
    await expect(page.locator('h1:has-text("Idea Archive")')).toBeVisible();
  });

  test('can navigate to settings page', async ({ page }) => {
    await page.goto('/');
    await page.click('nav a:has-text("Settings")');
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('can navigate to account page', async ({ page }) => {
    await page.goto('/');
    await page.click('nav a:has-text("Account")');
    await expect(page).toHaveURL('/account');
    await expect(page.locator('h1:has-text("Account")')).toBeVisible();
  });

  test('home page shows idea cards or empty state', async ({ page }) => {
    await page.goto('/');

    // Either idea cards are visible or the empty state message is shown
    const ideaCards = page.locator('article');
    const emptyState = page.locator('text="No ideas generated yet"');

    const hasIdeas = await ideaCards.count() > 0;
    const hasEmptyState = await emptyState.isVisible();

    expect(hasIdeas || hasEmptyState).toBeTruthy();
  });
});
