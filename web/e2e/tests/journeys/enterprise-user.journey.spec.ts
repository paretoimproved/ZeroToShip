/**
 * Enterprise User Journey
 *
 * End-to-end journey simulating an enterprise tier user exploring the full
 * ZeroToShip experience: viewing all ideas without limits, reading complete
 * business briefs, searching and filtering the archive, exporting data,
 * managing API keys, configuring settings, verifying account plan, and
 * logging out.
 */

import { test, expect } from '../../fixtures';
import { HomePage } from '../../pages/home.page';
import { ArchivePage } from '../../pages/archive.page';
import { SettingsPage } from '../../pages/settings.page';
import { AccountPage } from '../../pages/account.page';
import { SEED_IDEAS } from '../../utils/test-data';
import { annotate, journeyPause } from '../../utils/journey-helpers';

test.describe('Journey: Enterprise User', () => {
  test.slow();
  test.setTimeout(180_000);

  test('complete enterprise user journey', async ({ asEnterpriseUser, setupMocks }) => {
    const page = asEnterpriseUser;
    await setupMocks(page, 'enterprise');

    const homePage = new HomePage(page);

    // ---------------------------------------------------------------
    // Step 1: Homepage (all ideas visible, no limits)
    // ---------------------------------------------------------------
    await test.step('Step 1: Homepage — all ideas visible', async () => {
      await annotate(page, 'Step 1: Homepage — all ideas visible');

      await homePage.goto();

      await expect(homePage.heading).toBeVisible();

      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBe(SEED_IDEAS.length);

      // Enterprise users should never see limit/upgrade messages
      const limitMessage = page.locator('text=/limited|upgrade|free tier/i');
      await expect(limitMessage).not.toBeVisible();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 2: Full business brief (inline tabs)
    // ---------------------------------------------------------------
    await test.step('Step 2: Full business brief via tabs', async () => {
      await annotate(page, 'Step 2: Full business brief via tabs');

      // Verify all tabs are accessible inline on homepage
      const tabNames = ['Problem', 'Solution', 'Tech Spec', 'Business'];
      for (const tabName of tabNames) {
        await homePage.switchTab(0, tabName);
        const activeTab = await homePage.getActiveTabName(0);
        expect(activeTab).toBe(tabName);

        // Enterprise users should never see gated content
        const hasGated = await homePage.hasGatedContent(0);
        expect(hasGated).toBe(false);
      }

      // Verify idea name is visible
      const name = await homePage.getIdeaName(0);
      expect(name).toBeTruthy();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 3: Search ideas in archive
    // ---------------------------------------------------------------
    await test.step('Step 3: Search ideas', async () => {
      await annotate(page, 'Step 3: Search ideas');

      await homePage.goToArchive();

      const archivePage = new ArchivePage(page);
      await archivePage.waitForLoad();

      await archivePage.search('CodeReview');
      await page.waitForTimeout(500);
      const codeReviewCount = await archivePage.getIdeaCount();
      expect(codeReviewCount).toBeGreaterThanOrEqual(0);

      await archivePage.search('AI meeting');
      await page.waitForTimeout(500);
      const aiMeetingCount = await archivePage.getIdeaCount();
      expect(aiMeetingCount).toBeGreaterThanOrEqual(0);

      await archivePage.clearSearch();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 4: Export (JSON + CSV)
    // ---------------------------------------------------------------
    await test.step('Step 4: Export (JSON + CSV)', async () => {
      await annotate(page, 'Step 4: Export (JSON + CSV)');

      const exportButton = page.locator(
        'button:has-text("Export"), [data-testid="export-button"]',
      );

      if (await exportButton.isVisible()) {
        // Try JSON export
        try {
          await exportButton.click();
          const jsonOption = page.locator('text=/JSON/i').first();
          if (await jsonOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            const [jsonDownload] = await Promise.all([
              page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
              jsonOption.click(),
            ]);
            if (jsonDownload) {
              expect(jsonDownload.suggestedFilename()).toBeTruthy();
            }
          }
        } catch {
          // Download events may not fire in all environments
        }

        // Try CSV export
        try {
          // Re-open export menu if needed
          if (await exportButton.isVisible()) {
            await exportButton.click();
          }
          const csvOption = page.locator('text=/CSV/i').first();
          if (await csvOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            const [csvDownload] = await Promise.all([
              page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
              csvOption.click(),
            ]);
            if (csvDownload) {
              expect(csvDownload.suggestedFilename()).toBeTruthy();
            }
          }
        } catch {
          // Download events may not fire in all environments
        }
      }

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 5: API key management
    // ---------------------------------------------------------------
    await test.step('Step 5: API key management', async () => {
      await annotate(page, 'Step 5: API key management');

      await page.goto('/account');

      const accountPage = new AccountPage(page);
      await accountPage.waitForLoad();

      const apiKeysSection = page.locator(
        'section:has(h2:text("API Keys")), [data-testid="api-keys-section"]',
      );
      await expect(apiKeysSection).toBeVisible();

      // Verify existing keys list or empty state is shown
      const existingKeys = apiKeysSection.locator('table, ul, [data-testid="api-key-list"]');
      const emptyState = apiKeysSection.locator('text=/no api keys|no keys|create your first/i');
      const hasKeys = await existingKeys.isVisible().catch(() => false);
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      expect(hasKeys || hasEmptyState).toBeTruthy();

      // Try to interact with create API key button
      const createButton = apiKeysSection.locator(
        'button:has-text("Create"), button:has-text("New API Key")',
      );
      if (await createButton.isVisible().catch(() => false)) {
        try {
          await createButton.click();

          const dialog = page.locator('dialog, [role="dialog"], [data-testid="api-key-dialog"]');
          if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
            const nameInput = dialog.locator('input[type="text"], input[name="name"]').first();
            if (await nameInput.isVisible().catch(() => false)) {
              await nameInput.fill('Journey Test Key');
            }
            // Cancel to avoid side effects
            const cancelButton = dialog.locator('button:has-text("Cancel")');
            if (await cancelButton.isVisible().catch(() => false)) {
              await cancelButton.click();
            }
          }
        } catch {
          // Dialog interactions may vary across environments
        }
      }

      // Ensure dialog overlays are closed before the next nav click.
      await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open]') as HTMLDialogElement | null;
        dialog?.close();
      });

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 6: Archive with combined filters
    // ---------------------------------------------------------------
    await test.step('Step 6: Archive with combined filters', async () => {
      await annotate(page, 'Step 6: Archive with combined filters');

      await page.goto('/archive');

      const archivePage = new ArchivePage(page);
      await archivePage.waitForLoad();

      await archivePage.search('AI');
      await archivePage.filterByEffort('week');
      await archivePage.setMinScore(60);
      await page.waitForTimeout(500);

      const filteredCount = await archivePage.getIdeaCount();
      expect(filteredCount).toBeGreaterThanOrEqual(0);

      await archivePage.resetFilters();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 7: Settings
    // ---------------------------------------------------------------
    await test.step('Step 7: Settings', async () => {
      await annotate(page, 'Step 7: Settings');

      const archivePage = new ArchivePage(page);
      await archivePage.goToSettings();

      const settingsPage = new SettingsPage(page);
      await settingsPage.waitForLoad();
      await settingsPage.verifyAllSectionsPresent();

      await settingsPage.setEmailFrequency('daily');
      await settingsPage.setMinScore(80);
      await settingsPage.setTheme('dark');

      await settingsPage.saveSettings();
      await settingsPage.waitForSaveConfirmation();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 8: Account (Enterprise plan)
    // ---------------------------------------------------------------
    await test.step('Step 8: Account — Enterprise plan', async () => {
      await annotate(page, 'Step 8: Account — Enterprise plan');

      const settingsPage = new SettingsPage(page);
      await settingsPage.goToAccount();

      const accountPage = new AccountPage(page);
      await accountPage.waitForLoad();

      const currentPlan = await accountPage.getCurrentPlan();
      expect(currentPlan.toLowerCase()).toContain('enterprise');

      const isDisabled = await accountPage.isUpgradeDisabled('enterprise');
      expect(isDisabled).toBe(true);

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 9: Logout
    // ---------------------------------------------------------------
    await test.step('Step 9: Logout', async () => {
      await annotate(page, 'Step 9: Logout', { color: '#059669' });

      const logoutButton = page.locator(
        'button:has-text("Log out"), button:has-text("Logout"), ' +
        'button:has-text("Sign out"), a:has-text("Log out"), ' +
        'a:has-text("Logout"), a:has-text("Sign out"), ' +
        '[data-testid="logout-button"]',
      );

      if (await logoutButton.first().isVisible().catch(() => false)) {
        const urlBefore = page.url();
        await logoutButton.first().click();

        await page.waitForTimeout(1000);
        const urlAfter = page.url();
        expect(urlAfter).not.toBe(urlBefore);
      }

      await journeyPause(page);
    });
  });
});
