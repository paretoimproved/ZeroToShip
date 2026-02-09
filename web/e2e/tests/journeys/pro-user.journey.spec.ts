/**
 * Pro User Journey
 *
 * End-to-end journey simulating an authenticated Pro tier user exploring
 * ZeroToShip: viewing up to 10 ideas on the homepage, reading a full
 * business brief with all 9 sections, using archive search/filter/pagination,
 * configuring settings, verifying the Pro plan on the account page,
 * and logging out.
 */

import { test, expect } from '../../fixtures';
import { HomePage } from '../../pages/home.page';
import { ArchivePage } from '../../pages/archive.page';
import { SettingsPage } from '../../pages/settings.page';
import { AccountPage } from '../../pages/account.page';
import { TIER_LIMITS } from '../../utils/test-data';
import { annotate, journeyPause } from '../../utils/journey-helpers';

test.describe('Journey: Pro User', () => {
  test.slow();

  test('complete pro user journey', async ({ asProUser, setupMocks }) => {
    const page = asProUser;
    await setupMocks(page, 'pro');

    const homePage = new HomePage(page);

    // ---------------------------------------------------------------
    // Step 1: Homepage (up to 10 ideas)
    // ---------------------------------------------------------------
    await test.step('Step 1: Homepage (up to 10 ideas)', async () => {
      await annotate(page, 'Step 1: Homepage (up to 10 ideas)');

      await homePage.goto();

      await expect(homePage.heading).toBeVisible();

      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBeLessThanOrEqual(TIER_LIMITS.pro.ideasVisible);
      expect(ideaCount).toBeGreaterThan(TIER_LIMITS.free.ideasVisible);

      // No restriction message should be visible for pro users
      const restrictionMessage = page.locator('text=/limited ideas|upgrade to see more/i');
      await expect(restrictionMessage).not.toBeVisible();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 2: Full business brief (all tabs accessible)
    // ---------------------------------------------------------------
    await test.step('Step 2: Full business brief via tabs', async () => {
      await annotate(page, 'Step 2: Full business brief via tabs');

      // Verify all tabs are accessible inline — no gating for Pro
      const tabNames = ['Problem', 'Solution', 'Tech Spec', 'Business'];
      for (const tabName of tabNames) {
        await homePage.switchTab(0, tabName);
        const activeTab = await homePage.getActiveTabName(0);
        expect(activeTab).toBe(tabName);

        // Pro users should never see gated content
        const hasGated = await homePage.hasGatedContent(0);
        expect(hasGated).toBe(false);
      }

      // No upgrade prompts should be visible for pro users
      const upgradePrompt = page.locator('text=/upgrade to pro|unlock full brief/i');
      await expect(upgradePrompt).not.toBeVisible();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 3: Archive (search, filter, paginate)
    // ---------------------------------------------------------------
    await test.step('Step 3: Archive (search, filter, paginate)', async () => {
      await annotate(page, 'Step 3: Archive (search, filter, paginate)');

      await homePage.goToArchive();

      const archivePage = new ArchivePage(page);
      await archivePage.waitForLoad();

      await archivePage.verifyFiltersExist();

      await archivePage.search('Code');
      await page.waitForTimeout(300);
      await archivePage.clearSearch();

      await archivePage.filterByEffort('month');
      await archivePage.setMinScore(70);

      // Check for pagination and click Next if available
      const nextButton = page.locator('button:has-text("Next"):not(:disabled)');
      if (await nextButton.isVisible()) {
        await nextButton.click();
      }

      await archivePage.resetFilters();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 4: Settings (full config)
    // ---------------------------------------------------------------
    await test.step('Step 4: Settings (full config)', async () => {
      await annotate(page, 'Step 4: Settings (full config)');

      const archivePage = new ArchivePage(page);
      await archivePage.goToSettings();

      const settingsPage = new SettingsPage(page);
      await settingsPage.waitForLoad();

      await settingsPage.verifyAllSectionsPresent();

      await settingsPage.setEmailFrequency('daily');
      const emailFrequency = await settingsPage.getEmailFrequency();
      expect(emailFrequency).toBe('daily');

      // Toggle up to 2 categories if available
      const categoryCount = await settingsPage.categoryButtons.count();
      if (categoryCount >= 2) {
        const firstCategoryText = await settingsPage.categoryButtons.nth(0).textContent();
        const secondCategoryText = await settingsPage.categoryButtons.nth(1).textContent();
        if (firstCategoryText) await settingsPage.toggleCategory(firstCategoryText.trim());
        if (secondCategoryText) await settingsPage.toggleCategory(secondCategoryText.trim());
      }

      await settingsPage.setMinScore(75);
      const minScore = await settingsPage.getMinScore();
      expect(minScore).toBe(75);

      await settingsPage.saveSettings();
      await settingsPage.waitForSaveConfirmation();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 5: Account (Pro plan, manage subscription)
    // ---------------------------------------------------------------
    await test.step('Step 5: Account (Pro plan, manage subscription)', async () => {
      await annotate(page, 'Step 5: Account (Pro plan, manage subscription)');

      const settingsPage = new SettingsPage(page);
      await settingsPage.goToAccount();

      const accountPage = new AccountPage(page);
      await accountPage.waitForLoad();

      const currentPlan = await accountPage.getCurrentPlan();
      expect(currentPlan.toLowerCase()).toContain('pro');

      const isUpgradeDisabled = await accountPage.isUpgradeDisabled('pro');
      expect(isUpgradeDisabled).toBe(true);

      const isManageVisible = await accountPage.isManageSubscriptionVisible();
      expect(isManageVisible).toBe(true);

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 6: Logout
    // ---------------------------------------------------------------
    await test.step('Step 6: Logout', async () => {
      await annotate(page, 'Step 6: Logout', { color: '#059669' });

      const logoutButton = page.locator('button, a').filter({
        hasText: /Log Out|Logout|Sign Out/i,
      });

      if (await logoutButton.first().isVisible()) {
        await logoutButton.first().click();

        await expect(page).not.toHaveURL(/\/account/);
      }

      await journeyPause(page);
    });
  });
});
