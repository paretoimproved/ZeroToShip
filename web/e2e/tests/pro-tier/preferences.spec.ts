/**
 * E2E tests for current Pro tier preference management.
 *
 * Current Settings surface supports:
 * - Email notification frequency
 * - Theme preference
 * - Saving preferences
 */

import { test, expect } from '../../fixtures';
import { SettingsPage, HomePage } from '../../pages';

test.describe('Pro Tier - Preference Management', () => {
  test.describe('Email Notification Preferences', () => {
    test('can set email notification frequency to daily', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');
      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setEmailFrequency('daily');
      expect(await settingsPage.getEmailFrequency()).toBe('daily');
    });

    test('can set email notification frequency to weekly', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');
      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setEmailFrequency('weekly');
      expect(await settingsPage.getEmailFrequency()).toBe('weekly');
    });

    test('can disable email notifications', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');
      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setEmailFrequency('never');
      expect(await settingsPage.getEmailFrequency()).toBe('never');
    });
  });

  test.describe('Theme Preferences', () => {
    test('can toggle theme to system', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');
      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setTheme('system');
      expect(await settingsPage.getCurrentTheme()).toBe('system');
    });

    test('can toggle theme to light', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');
      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setTheme('light');
      expect(await settingsPage.getCurrentTheme()).toBe('light');
    });

    test('can toggle theme to dark', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');
      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setTheme('dark');
      expect(await settingsPage.getCurrentTheme()).toBe('dark');
    });
  });

  test.describe('Save & Persistence', () => {
    test('save button shows success feedback', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');
      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setEmailFrequency('weekly');
      await settingsPage.saveSettings();
      await settingsPage.waitForSaveConfirmation();
      expect(await settingsPage.isSaveConfirmationVisible()).toBeTruthy();
    });

    test('preferences persist after page reload', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');
      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await settingsPage.setEmailFrequency('weekly');
      await settingsPage.saveSettings();
      await settingsPage.waitForSaveConfirmation();

      await asProUser.reload();
      await settingsPage.waitForLoad();
      expect(await settingsPage.getEmailFrequency()).toBe('weekly');
    });

    test('current settings sections are present', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');
      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();

      await expect(settingsPage.emailSection).toBeVisible();
      await expect(settingsPage.themeSection).toBeVisible();
      await expect(settingsPage.saveButton).toBeVisible();
    });
  });

  test.describe('Post-save App Flow', () => {
    test('user can save settings and continue to dashboard', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const settingsPage = new SettingsPage(asProUser);
      await settingsPage.goto();
      await settingsPage.setEmailFrequency('daily');
      await settingsPage.saveSettings();
      await settingsPage.waitForSaveConfirmation();

      const homePage = new HomePage(asProUser);
      await homePage.goto();
      await expect(homePage.heading).toBeVisible();
    });
  });
});
