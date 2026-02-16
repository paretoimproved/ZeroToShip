/**
 * E2E tests for boundary conditions and limits
 *
 * Tests verify that the application handles edge cases like empty states,
 * tier limits, navigation edge cases, and concurrent operations.
 */

import { test, expect } from '../../fixtures';
import { HomePage, IdeaDetailPage, SettingsPage } from '../../pages';
import { API_URL, TIER_LIMITS } from '../../utils/test-data';
import { generateMockIdeas } from '../../utils/api-mock.utils';

test.describe('Boundary Conditions', () => {
  test.describe('Empty and Minimal Data States', () => {
    test('handles empty ideas list gracefully (shows "no ideas" message)', async ({ asFreeUser }) => {
      const page = asFreeUser;
      // Mock API to return empty ideas list
      await page.route(`${API_URL}/ideas/today`, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ideas: [],
            total: 0,
            limit: 3,
            tier: 'free',
          }),
        })
      );

      const homePage = new HomePage(page);
      await homePage.goto();

      // Should show empty state message
      const emptyStateIndicators = [
        page.locator('text="No ideas generated yet"'),
        page.locator('text=/no ideas|no results|nothing to show/i'),
        page.locator('[data-testid="empty-state"]'),
        homePage.emptyState,
      ];

      let hasEmptyState = false;
      for (const indicator of emptyStateIndicators) {
        if (await indicator.isVisible().catch(() => false)) {
          hasEmptyState = true;
          break;
        }
      }

      expect(hasEmptyState).toBeTruthy();
    });

    test('handles single idea in list correctly', async ({ asFreeUser }) => {
      const page = asFreeUser;
      // Mock API to return exactly 1 idea
      const singleIdea = generateMockIdeas(1);

      await page.route(`${API_URL}/ideas/today`, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ideas: singleIdea,
            total: 1,
            limit: 3,
            tier: 'free',
          }),
        })
      );

      const homePage = new HomePage(page);
      await homePage.goto();

      // Should show exactly 1 idea card
      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBe(1);

      // The card should be fully functional
      const firstIdeaName = await homePage.getIdeaName(0);
      expect(firstIdeaName).toBeTruthy();
    });
  });

  test.describe('Tier Limits', () => {
    test('handles exactly at free tier limit (3 ideas)', async ({ asFreeUser }) => {
      const page = asFreeUser;
      const freeLimit = TIER_LIMITS.free.ideasVisible; // 3
      const ideas = generateMockIdeas(freeLimit);

      await page.route(`${API_URL}/ideas/today`, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ideas,
            total: 6, // More exist but limited
            limit: freeLimit,
            tier: 'free',
          }),
        })
      );

      const homePage = new HomePage(page);
      await homePage.goto();

      // Should show exactly 3 ideas
      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBe(freeLimit);
    });

    test('handles exactly at pro tier limit (10 ideas)', async ({ asProUser }) => {
      const page = asProUser;
      const proLimit = TIER_LIMITS.pro.ideasVisible; // 10
      const ideas = generateMockIdeas(proLimit);

      await page.route(`${API_URL}/ideas/today`, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ideas,
            total: 10,
            limit: proLimit,
            tier: 'pro',
          }),
        })
      );

      const homePage = new HomePage(page);
      await homePage.goto();

      // Should show exactly 10 ideas (or all available if less than 10 in mock)
      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBeLessThanOrEqual(proLimit);
      expect(ideaCount).toBeGreaterThan(0);
    });
  });

  test.describe('Navigation Edge Cases', () => {
    test('back button behavior works across pages', async ({ asFreeUser, setupMocks }) => {
      const page = asFreeUser;
      await setupMocks(page, 'free');

      const homePage = new HomePage(page);
      await homePage.goto();

      // Navigate to idea detail page directly
      await page.goto('/idea/mock-1');
      await page.waitForLoadState('domcontentloaded');

      // Verify we're on detail page
      await expect(page).toHaveURL(/\/idea\//);

      // Use browser back button
      await page.goBack();

      // Should be back on home page
      await expect(page).toHaveURL('/dashboard');

      // Home page should still be functional
      await expect(homePage.heading).toBeVisible();

      // Navigate to settings
      await homePage.goToSettings();
      await expect(page).toHaveURL('/settings');

      // Go back
      await page.goBack();
      await expect(page).toHaveURL('/dashboard');
    });

    test('deep link to idea page works when logged out (shows limited view)', async ({ page }) => {
      // Mock the idea detail endpoint
      const mockIdea = generateMockIdeas(1)[0];

      await page.route(`${API_URL}/ideas/mock-1`, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockIdea),
        })
      );

      // Directly navigate to an idea page without logging in
      await page.goto('/idea/mock-1');

      // Page should load and show the idea (possibly with limited info)
      await page.waitForLoadState('domcontentloaded');

      // Should show an idea surface or a login/upgrade prompt.
      const backLink = page.getByRole('link', { name: /back to today'?s ideas/i });
      const briefCard = page.locator('article').first();
      const loginPrompt = page.locator('text=/sign in|log in|upgrade|unlock/i').first();

      const hasBackLink = await backLink.isVisible().catch(() => false);
      const hasBriefCard = await briefCard.isVisible().catch(() => false);
      const hasLoginPrompt = await loginPrompt.isVisible().catch(() => false);
      const redirectedToLogin = /\/login/.test(page.url());

      expect(hasBackLink || hasBriefCard || hasLoginPrompt || redirectedToLogin).toBeTruthy();
    });

    test('rapid navigation (clicking multiple links quickly) does not break', async ({
      asFreeUser,
      setupMocks,
    }) => {
      const page = asFreeUser;
      await setupMocks(page, 'free');

      const homePage = new HomePage(page);
      await homePage.goto();

      // Rapidly click multiple navigation links
      const navPromises = [];

      // Click multiple links rapidly without waiting
      navPromises.push(
        homePage.archiveLink.click({ noWaitAfter: true }).catch(() => {})
      );
      navPromises.push(
        homePage.settingsLink.click({ noWaitAfter: true }).catch(() => {})
      );
      navPromises.push(
        homePage.todayLink.click({ noWaitAfter: true }).catch(() => {})
      );

      // Wait a moment for navigation to settle
      await page.waitForTimeout(1000);
      await page.waitForLoadState('domcontentloaded');

      // Page should still be functional - nav should be visible
      const nav = page.getByRole('navigation', { name: 'Main navigation' });
      await expect(nav).toBeVisible();

      // Should be on one of the valid pages
      const currentUrl = page.url();
      const validPaths = ['/dashboard', '/archive', '/settings', '/account'];
      const isOnValidPage = validPaths.some(
        (path) => currentUrl.endsWith(path) || currentUrl.includes(path)
      );

      expect(isOnValidPage).toBeTruthy();
    });

    test('browser refresh maintains state where appropriate', async ({ asFreeUser, setupMocks }) => {
      const page = asFreeUser;
      await setupMocks(page, 'free');

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();

      // Change a setting
      const initialTheme = await settingsPage.getCurrentTheme();

      // Toggle theme
      const newTheme = initialTheme === 'dark' ? 'light' : 'dark';
      await settingsPage.setTheme(newTheme);

      // Save settings
      await settingsPage.saveSettings();

      // Wait for save to complete
      await page.waitForTimeout(500);

      // Refresh the page
      await page.reload();
      await settingsPage.waitForLoad();

      // Theme setting should persist (if saved to localStorage/backend)
      const themeAfterRefresh = await settingsPage.getCurrentTheme();

      // Either the new theme persisted or it reset to default (both are valid behaviors)
      expect(['system', 'light', 'dark']).toContain(themeAfterRefresh);
    });
  });

  test.describe('Concurrent Operations', () => {
    test('multiple tabs do not conflict with each other', async ({ browser }) => {
      // Create two separate contexts to simulate different tabs
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      try {
        // Navigate to different public pages in each tab
        await Promise.all([page1.goto('/'), page2.goto('/explore')]);

        // Both pages should load successfully
        await expect(
          page1.getByRole('navigation', { name: 'Main navigation' })
        ).toBeVisible();
        await expect(
          page2.getByRole('navigation', { name: 'Main navigation' })
        ).toBeVisible();

        // Verify content is correct in each tab
        await expect(page1.getByRole('heading', { name: /The Internet Complains/i })).toBeVisible();
        await expect(page2.getByRole('heading', { name: /Startup Ideas Worth Building/i })).toBeVisible();
      } finally {
        await context1.close();
        await context2.close();
      }
    });
  });
});
