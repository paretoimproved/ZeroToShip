/**
 * Basic features tests for Free tier users
 *
 * Tests core free tier functionality including:
 * - Login flow
 * - Homepage idea limits
 * - Inline tabbed card interaction
 * - Gated tab content for free users
 * - Settings preferences
 * - Account page display
 */

import { test, expect } from '../../fixtures';
import { HomePage, IdeaDetailPage, SettingsPage, AccountPage } from '../../pages';
import { TEST_USERS, TIER_LIMITS } from '../../utils';

test.describe('Free Tier - Basic Features', () => {
  test.describe('Authentication', () => {
    test('can login with free tier credentials', async ({ asFreeUser }) => {
      // The asFreeUser fixture handles authentication
      // Verify we are on the homepage after auth
      await asFreeUser.goto('/');

      // Check navigation shows authenticated state
      const accountLink = asFreeUser.locator('nav a:has-text("Account")');
      await expect(accountLink).toBeVisible();
    });

    test('after login, redirects to homepage', async ({ asFreeUser }) => {
      await asFreeUser.goto('/');

      // Verify we're on the homepage
      await expect(asFreeUser).toHaveURL('/');

      // Verify homepage content is visible
      const heading = asFreeUser.locator('h1:has-text("Today\'s Top Ideas")');
      await expect(heading).toBeVisible();
    });
  });

  test.describe('Homepage Idea Limits', () => {
    test('homepage shows exactly 3 ideas (free tier limit)', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const homePage = new HomePage(asFreeUser);
      await homePage.goto();

      // Free tier should see exactly 3 ideas
      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBe(TIER_LIMITS.free.ideasVisible);
    });

    test('idea cards display correctly with tabs', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const homePage = new HomePage(asFreeUser);
      await homePage.goto();

      // Verify first idea card has expected elements
      const firstCard = homePage.getIdeaCard(0);
      await expect(firstCard).toBeVisible();

      // Check for name, score, and effort
      const name = await homePage.getIdeaName(0);
      expect(name).toBeTruthy();

      const score = await homePage.getIdeaScore(0);
      expect(score).toBeTruthy();

      // Verify tab bar is present
      const activeTab = await homePage.getActiveTabName(0);
      expect(activeTab).toBe('Problem');
    });
  });

  test.describe('Inline Card Tab Interaction', () => {
    test('can switch tabs within a card', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const homePage = new HomePage(asFreeUser);
      await homePage.goto();

      // Default tab should be Problem
      const defaultTab = await homePage.getActiveTabName(0);
      expect(defaultTab).toBe('Problem');

      // Switch to Solution tab — should show gated content for free tier
      await homePage.switchTab(0, 'Solution');
      const hasGated = await homePage.hasGatedContent(0);
      expect(hasGated).toBeTruthy();
    });

    test('gated tabs show lock + sign up CTA for free users', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const homePage = new HomePage(asFreeUser);
      await homePage.goto();
      await homePage.verifyIdeaCardsDisplayed(1);

      // Switch to a gated tab
      await homePage.switchTab(0, 'Solution');

      // Gated content should be visible
      const gatedContent = homePage.getIdeaCard(0).locator('[data-testid="gated-content"]');
      await expect(gatedContent).toBeVisible();

      // Look for sign up CTA
      const signUpCta = gatedContent.locator('a:has-text("Sign Up")');
      await expect(signUpCta).toBeVisible();
    });
  });

  test.describe('Settings Page', () => {
    test('can access settings page', async ({ asFreeUser }) => {
      const settingsPage = new SettingsPage(asFreeUser);
      await settingsPage.goto();

      await expect(asFreeUser).toHaveURL('/settings');
      await expect(settingsPage.heading).toBeVisible();
    });

    test('can update preferences (categories, effort filter, email frequency)', async ({ asFreeUser }) => {
      const settingsPage = new SettingsPage(asFreeUser);
      await settingsPage.goto();

      // Test email frequency change
      await settingsPage.setEmailFrequency('weekly');
      const emailFrequency = await settingsPage.getEmailFrequency();
      expect(emailFrequency).toBe('weekly');

      // Test category toggle (if categories exist)
      const categoryCount = await settingsPage.categoryButtons.count();
      if (categoryCount > 0) {
        const firstCategory = await settingsPage.categoryButtons.first().textContent();
        if (firstCategory) {
          await settingsPage.toggleCategory(firstCategory.trim());
        }
      }

      // Test effort preferences (if checkboxes exist)
      const effortCheckboxCount = await settingsPage.effortCheckboxes.count();
      if (effortCheckboxCount > 0) {
        // Toggle the first effort preference
        const label = await settingsPage.effortSection.locator('label').first().textContent();
        if (label) {
          await settingsPage.toggleEffort(label.trim());
        }
      }

      // Save changes
      await settingsPage.saveSettings();

      // Verify save confirmation
      await settingsPage.waitForSaveConfirmation();
    });

    test('preferences persist after page reload', async ({ asFreeUser }) => {
      const settingsPage = new SettingsPage(asFreeUser);
      await settingsPage.goto();

      // Set a specific email frequency
      await settingsPage.setEmailFrequency('daily');
      await settingsPage.saveSettings();
      await settingsPage.waitForSaveConfirmation();

      // Reload the page
      await asFreeUser.reload();
      await settingsPage.waitForLoad();

      // Verify the setting persisted
      const emailFrequency = await settingsPage.getEmailFrequency();
      expect(emailFrequency).toBe('daily');
    });
  });

  test.describe('Account Page', () => {
    test('can access account page', async ({ asFreeUser }) => {
      const accountPage = new AccountPage(asFreeUser);
      await accountPage.goto();

      await expect(asFreeUser).toHaveURL('/account');
      await expect(accountPage.heading).toBeVisible();
    });

    test('account page shows "Free" as current plan', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const accountPage = new AccountPage(asFreeUser);
      await accountPage.goto();

      // Verify current plan displays as Free
      const currentPlan = await accountPage.getCurrentPlan();
      expect(currentPlan.toLowerCase()).toContain('free');
    });
  });
});
