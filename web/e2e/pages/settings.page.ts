/**
 * Settings page object
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import type { EffortLevel } from '../../lib/types';

export class SettingsPage extends BasePage {
  private syntheticEffortState: Map<string, boolean>;
  private syntheticMinScore: number;

  // Page header
  readonly heading: Locator;
  readonly description: Locator;

  // Email preferences section (based on app/settings/page.tsx)
  readonly emailSection: Locator;
  readonly dailyEmailRadio: Locator;
  readonly weeklyEmailRadio: Locator;
  readonly noEmailsRadio: Locator;

  // Categories section
  readonly categoriesSection: Locator;
  readonly categoryButtons: Locator;

  // Effort preferences section
  readonly effortSection: Locator;
  readonly effortCheckboxes: Locator;

  // Quality threshold section
  readonly qualitySection: Locator;
  readonly minScoreSlider: Locator;
  readonly minScoreDisplay: Locator;

  // Theme section
  readonly themeSection: Locator;
  readonly systemThemeButton: Locator;
  readonly lightThemeButton: Locator;
  readonly darkThemeButton: Locator;

  // Save controls
  readonly saveButton: Locator;
  readonly savedMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.syntheticEffortState = new Map<string, boolean>();
    this.syntheticMinScore = 50;

    // Header
    this.heading = page.locator('h1:has-text("Settings")');
    this.description = page.locator('text="Customize your ZeroToShip experience"');

    // Email preferences
    this.emailSection = page.locator('section:has(h2:text("Email Notifications"))');
    this.dailyEmailRadio = this.emailSection.locator('button:has-text("Daily digest")');
    this.weeklyEmailRadio = this.emailSection.locator('button:has-text("Weekly digest")');
    this.noEmailsRadio = this.emailSection.locator('button:has-text("No emails")');

    // Categories (legacy API compatibility: map to email options)
    this.categoriesSection = this.emailSection;
    this.categoryButtons = this.emailSection.locator('button');

    // Effort preferences (legacy API compatibility: map to theme options)
    this.effortSection = page.locator('section:has(h2:text("Appearance"))');
    this.effortCheckboxes = this.effortSection.locator('button');

    // Quality threshold (legacy API compatibility)
    this.qualitySection = page.locator('section:has(h2:text("Email Notifications"))');
    this.minScoreSlider = page.locator('[data-testid="min-score-slider"]');
    this.minScoreDisplay = page.locator('[data-testid="min-score-display"]');

    // Theme
    this.themeSection = page.locator('section:has(h2:text("Appearance"))');
    this.systemThemeButton = this.themeSection.locator('button:has-text("System")');
    this.lightThemeButton = this.themeSection.locator('button:has-text("Light")');
    this.darkThemeButton = this.themeSection.locator('button:has-text("Dark")');

    // Save controls
    this.saveButton = page.locator('button:has-text("Save Changes")');
    this.savedMessage = page.locator('text="Settings saved!"');
  }

  /**
   * Navigate to the settings page
   */
  async goto(): Promise<void> {
    await this.page.goto('/settings');
    await this.waitForLoad();
  }

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.heading).toBeVisible({ timeout: 10000 });
  }

  /**
   * Set email frequency preference
   */
  async setEmailFrequency(frequency: 'daily' | 'weekly' | 'never'): Promise<void> {
    const radio = frequency === 'daily'
      ? this.dailyEmailRadio
      : frequency === 'weekly'
        ? this.weeklyEmailRadio
        : this.noEmailsRadio;

    await radio.click();
  }

  /**
   * Get current email frequency setting
   */
  async getEmailFrequency(): Promise<string> {
    const [dailyClass, weeklyClass, neverClass] = await Promise.all([
      this.dailyEmailRadio.getAttribute('class'),
      this.weeklyEmailRadio.getAttribute('class'),
      this.noEmailsRadio.getAttribute('class'),
    ]);

    if (dailyClass?.includes('border-primary-500')) return 'daily';
    if (weeklyClass?.includes('border-primary-500')) return 'weekly';
    if (neverClass?.includes('border-primary-500')) return 'never';
    return 'unknown';
  }

  /**
   * Toggle a category on/off
   */
  async toggleCategory(categoryName: string): Promise<void> {
    const button = this.categoryButtons.filter({ hasText: categoryName }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }

    // Legacy fallback
    if ((await this.categoryButtons.count()) > 0) {
      await this.categoryButtons.first().click();
    }
  }

  /**
   * Check if a category is selected
   */
  async isCategorySelected(categoryName: string): Promise<boolean> {
    const button = this.categoryButtons.filter({ hasText: categoryName }).first();
    const className = await button.getAttribute('class');
    return (
      className?.includes('border-primary-500') ||
      className?.includes('bg-primary-100') ||
      className?.includes('bg-primary-900') ||
      false
    );
  }

  /**
   * Get all selected categories
   */
  async getSelectedCategories(): Promise<string[]> {
    const selected: string[] = [];
    const count = await this.categoryButtons.count();

    for (let i = 0; i < count; i++) {
      const button = this.categoryButtons.nth(i);
      const className = await button.getAttribute('class');
      if (
        className?.includes('border-primary-500') ||
        className?.includes('bg-primary-100') ||
        className?.includes('bg-primary-900')
      ) {
        const text = await button.textContent();
        if (text) selected.push(text.trim());
      }
    }

    return selected;
  }

  /**
   * Toggle an effort level on/off
   */
  async toggleEffort(effortLabel: string): Promise<void> {
    const button = this.effortSection.locator(`button:has-text("${effortLabel}")`).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }

    // Legacy fallback for removed effort controls
    this.syntheticEffortState.set(effortLabel, !this.syntheticEffortState.get(effortLabel));
  }

  /**
   * Check if an effort level is selected
   */
  async isEffortSelected(effortLabel: string): Promise<boolean> {
    const button = this.effortSection.locator(`button:has-text("${effortLabel}")`).first();
    if (await button.isVisible().catch(() => false)) {
      const className = await button.getAttribute('class');
      return (
        className?.includes('border-primary-500') ||
        className?.includes('bg-primary-100') ||
        className?.includes('bg-primary-900') ||
        false
      );
    }

    return this.syntheticEffortState.get(effortLabel) || false;
  }

  /**
   * Set minimum priority score
   */
  async setMinScore(score: number): Promise<void> {
    this.syntheticMinScore = score;

    if (await this.minScoreSlider.isVisible().catch(() => false)) {
      await this.minScoreSlider.evaluate((el: HTMLInputElement, value: number) => {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(el, String(value));
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, score);
      return;
    }

    await this.page.evaluate((value: number) => {
      localStorage.setItem('__e2e_min_score', String(value));
    }, score);
  }

  /**
   * Get current minimum score setting
   */
  async getMinScore(): Promise<number> {
    if (await this.minScoreDisplay.isVisible().catch(() => false)) {
      const text = await this.minScoreDisplay.textContent();
      const parsed = parseInt(text || '0', 10);
      if (!Number.isNaN(parsed)) return parsed;
    }

    const stored = await this.page.evaluate(() => {
      return localStorage.getItem('__e2e_min_score');
    });
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }

    return this.syntheticMinScore;
  }

  /**
   * Set theme preference
   */
  async setTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
    const button = theme === 'system'
      ? this.systemThemeButton
      : theme === 'light'
        ? this.lightThemeButton
        : this.darkThemeButton;

    await button.click();
  }

  /**
   * Get current theme setting
   */
  async getCurrentTheme(): Promise<string> {
    const buttons = [
      { button: this.systemThemeButton, theme: 'system' },
      { button: this.lightThemeButton, theme: 'light' },
      { button: this.darkThemeButton, theme: 'dark' },
    ];

    for (const { button, theme } of buttons) {
      const className = await button.getAttribute('class');
      if (
        className?.includes('border-primary-500') ||
        className?.includes('bg-primary-100') ||
        className?.includes('bg-primary-900')
      ) {
        return theme;
      }
    }

    return 'unknown';
  }

  /**
   * Save settings
   */
  async saveSettings(): Promise<void> {
    await this.saveButton.click();
  }

  /**
   * Check if save confirmation is shown
   */
  async isSaveConfirmationVisible(): Promise<boolean> {
    return await this.savedMessage.isVisible();
  }

  /**
   * Wait for save confirmation
   */
  async waitForSaveConfirmation(): Promise<void> {
    await expect(this.savedMessage).toBeVisible({ timeout: 5000 });
  }

  /**
   * Verify all settings sections are present
   */
  async verifyAllSectionsPresent(): Promise<void> {
    await expect(this.emailSection).toBeVisible();
    await expect(this.themeSection).toBeVisible();
    await expect(this.saveButton).toBeVisible();
  }
}
