/**
 * E2E tests for Pro tier preference management
 *
 * Pro tier users should have:
 * - Email notification frequency settings
 * - Category preferences selection
 * - Effort level preferences
 * - Minimum priority score threshold
 * - Theme toggle (system, light, dark)
 * - Preferences persistence across page reloads
 */

import { test, expect } from '../../fixtures';
import { SettingsPage, HomePage } from '../../pages';
import { TEST_USERS, TIER_LIMITS } from '../../utils';

test.describe('Pro Tier - Preference Management', () => {
  test.describe('Email Notification Preferences', () => {
    test('can set email notification frequency to daily', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setEmailFrequency('daily');

      const currentFrequency = await settingsPage.getEmailFrequency();
      expect(currentFrequency).toBe('daily');
    });

    test('can set email notification frequency to weekly', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setEmailFrequency('weekly');

      const currentFrequency = await settingsPage.getEmailFrequency();
      expect(currentFrequency).toBe('weekly');
    });

    test('email frequency options are accessible', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await expect(settingsPage.dailyEmailRadio).toBeVisible();
      await expect(settingsPage.weeklyEmailRadio).toBeVisible();
      await expect(settingsPage.noEmailsRadio).toBeVisible();
    });
  });

  test.describe('Category Preferences', () => {
    test('can select category preferences', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      // Verify categories section is visible
      await expect(settingsPage.categoriesSection).toBeVisible();

      // Get category buttons count
      const categoryCount = await settingsPage.categoryButtons.count();
      expect(categoryCount).toBeGreaterThan(0);
    });

    test('can toggle category on and off', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      // Get first category button text
      const firstCategory = settingsPage.categoryButtons.first();
      const categoryName = (await firstCategory.textContent()) || '';

      // Get initial state
      const initiallySelected = await settingsPage.isCategorySelected(categoryName);

      // Toggle the category
      await settingsPage.toggleCategory(categoryName);

      // State should change
      const afterToggle = await settingsPage.isCategorySelected(categoryName);
      expect(afterToggle).toBe(!initiallySelected);
    });

    test('can select multiple categories', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      // Toggle multiple categories to selected state
      const categoryCount = await settingsPage.categoryButtons.count();
      const categoriesToSelect: string[] = [];

      for (let i = 0; i < Math.min(3, categoryCount); i++) {
        const categoryName = (await settingsPage.categoryButtons.nth(i).textContent()) || '';
        if (categoryName) {
          categoriesToSelect.push(categoryName.trim());
        }
      }

      // Select each category
      for (const category of categoriesToSelect) {
        if (!(await settingsPage.isCategorySelected(category))) {
          await settingsPage.toggleCategory(category);
        }
      }

      // Verify all are selected
      const selectedCategories = await settingsPage.getSelectedCategories();
      for (const category of categoriesToSelect) {
        expect(selectedCategories).toContain(category);
      }
    });
  });

  test.describe('Effort Level Preferences', () => {
    test('can access effort preferences section', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await expect(settingsPage.effortSection).toBeVisible();
      await expect(settingsPage.effortCheckboxes.first()).toBeVisible();
    });

    test('can toggle effort level preferences', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      // Check initial state of "Weekend" effort level
      const initialWeekend = await settingsPage.isEffortSelected('Weekend');

      // Toggle it
      await settingsPage.toggleEffort('Weekend');

      // Verify state changed
      const afterToggle = await settingsPage.isEffortSelected('Weekend');
      expect(afterToggle).toBe(!initialWeekend);
    });
  });

  test.describe('Quality Threshold', () => {
    test('can set minimum priority score threshold using slider', async ({
      asProUser,
      setupMocks,
    }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      // Set a specific score
      await settingsPage.setMinScore(75);

      // Verify the value
      const currentScore = await settingsPage.getMinScore();
      expect(currentScore).toBe(75);
    });

    test('score slider is visible and interactive', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await expect(settingsPage.minScoreSlider).toBeVisible();
      await expect(settingsPage.minScoreSlider).toBeEnabled();
    });

    test('score display updates when slider changes', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      // Set different values and verify display updates
      await settingsPage.setMinScore(50);
      let displayedScore = await settingsPage.getMinScore();
      expect(displayedScore).toBe(50);

      await settingsPage.setMinScore(80);
      displayedScore = await settingsPage.getMinScore();
      expect(displayedScore).toBe(80);
    });
  });

  test.describe('Theme Preferences', () => {
    test('can toggle theme to system', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setTheme('system');

      const currentTheme = await settingsPage.getCurrentTheme();
      expect(currentTheme).toBe('system');
    });

    test('can toggle theme to light', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setTheme('light');

      const currentTheme = await settingsPage.getCurrentTheme();
      expect(currentTheme).toBe('light');
    });

    test('can toggle theme to dark', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setTheme('dark');

      const currentTheme = await settingsPage.getCurrentTheme();
      expect(currentTheme).toBe('dark');
    });

    test('all theme options are accessible', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await expect(settingsPage.systemThemeButton).toBeVisible();
      await expect(settingsPage.lightThemeButton).toBeVisible();
      await expect(settingsPage.darkThemeButton).toBeVisible();
    });
  });

  test.describe('Save & Persistence', () => {
    test('save button shows success feedback', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      // Make a change
      await settingsPage.setMinScore(65);

      // Save settings
      await settingsPage.saveSettings();

      // Wait for confirmation
      await settingsPage.waitForSaveConfirmation();
      expect(await settingsPage.isSaveConfirmationVisible()).toBeTruthy();
    });

    test('preferences persist after page reload', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      // Set specific preferences
      await settingsPage.setMinScore(70);
      await settingsPage.setTheme('dark');
      await settingsPage.setEmailFrequency('weekly');

      // Save settings
      await settingsPage.saveSettings();
      await settingsPage.waitForSaveConfirmation();

      // Reload the page
      await asProUser.reload();
      await settingsPage.waitForLoad();

      // Verify settings persisted
      const savedScore = await settingsPage.getMinScore();
      const savedTheme = await settingsPage.getCurrentTheme();
      const savedFrequency = await settingsPage.getEmailFrequency();

      expect(savedScore).toBe(70);
      expect(savedTheme).toBe('dark');
      expect(savedFrequency).toBe('weekly');
    });

    test('all settings sections are present', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.verifyAllSectionsPresent();
    });
  });

  test.describe('Preferences Apply to Filtering', () => {
    test('preferences apply correctly to idea filtering', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      // First set preferences on settings page
      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      // Set a minimum score threshold
      await settingsPage.setMinScore(80);
      await settingsPage.saveSettings();
      await settingsPage.waitForSaveConfirmation();

      // Navigate to home page
      const homePage = new HomePage(asProUser);
      await homePage.goto();

      // Verify that ideas shown respect the preference
      const ideaCount = await homePage.getIdeaCount();

      if (ideaCount > 0) {
        // Check each visible idea score is above threshold
        // Note: This assumes the preference filtering is applied server-side
        // The test verifies the integration works end-to-end
        for (let i = 0; i < ideaCount; i++) {
          const scoreText = await homePage.getIdeaScore(i);
          // Extract numeric score from text like "92.50"
          const scoreMatch = scoreText.match(/[\d.]+/);
          if (scoreMatch) {
            const score = parseFloat(scoreMatch[0]);
            expect(score).toBeGreaterThanOrEqual(80);
          }
        }
      }
    });
  });
});
