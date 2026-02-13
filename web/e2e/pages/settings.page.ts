/**
 * Settings page object
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import type { EffortLevel } from '../../lib/types';

export class SettingsPage extends BasePage {
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

    // Header
    this.heading = page.locator('h1:has-text("Settings")');
    this.description = page.locator('text="Customize your ZeroToShip experience"');

    // Email preferences
    this.emailSection = page.locator('section:has(h2:text("Email Notifications"))');
    this.dailyEmailRadio = page.locator('input[name="emailFrequency"][value="daily"]');
    this.weeklyEmailRadio = page.locator('input[name="emailFrequency"][value="weekly"]');
    this.noEmailsRadio = page.locator('input[name="emailFrequency"][value="never"]');

    // Categories
    this.categoriesSection = page.locator('section:has(h2:text("Preferred Categories"))');
    this.categoryButtons = this.categoriesSection.locator('button');

    // Effort preferences
    this.effortSection = page.locator('section:has(h2:text("Effort Preferences"))');
    this.effortCheckboxes = this.effortSection.locator('input[type="checkbox"]');

    // Quality threshold
    this.qualitySection = page.locator('section:has(h2:text("Quality Threshold"))');
    this.minScoreSlider = page.locator('input[type="range"]').last();
    this.minScoreDisplay = this.qualitySection.locator('span.font-semibold');

    // Theme
    this.themeSection = page.locator('section:has(h2:text("Appearance"))');
    this.systemThemeButton = this.themeSection.locator('button:has-text("system")');
    this.lightThemeButton = this.themeSection.locator('button:has-text("light")');
    this.darkThemeButton = this.themeSection.locator('button:has-text("dark")');

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
    if (await this.dailyEmailRadio.isChecked()) return 'daily';
    if (await this.weeklyEmailRadio.isChecked()) return 'weekly';
    if (await this.noEmailsRadio.isChecked()) return 'never';
    return 'unknown';
  }

  /**
   * Toggle a category on/off
   */
  async toggleCategory(categoryName: string): Promise<void> {
    const button = this.categoryButtons.filter({ hasText: categoryName });
    await button.click();
  }

  /**
   * Check if a category is selected
   */
  async isCategorySelected(categoryName: string): Promise<boolean> {
    const button = this.categoryButtons.filter({ hasText: categoryName });
    const className = await button.getAttribute('class');
    return className?.includes('bg-primary-100') || className?.includes('bg-primary-900') || false;
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
      if (className?.includes('bg-primary-100') || className?.includes('bg-primary-900')) {
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
    const label = this.effortSection.locator(`label:has-text("${effortLabel}")`);
    const checkbox = label.locator('input[type="checkbox"]');
    await checkbox.click();
  }

  /**
   * Check if an effort level is selected
   */
  async isEffortSelected(effortLabel: string): Promise<boolean> {
    const label = this.effortSection.locator(`label:has-text("${effortLabel}")`);
    const checkbox = label.locator('input[type="checkbox"]');
    return await checkbox.isChecked();
  }

  /**
   * Set minimum priority score
   */
  async setMinScore(score: number): Promise<void> {
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
  }

  /**
   * Get current minimum score setting
   */
  async getMinScore(): Promise<number> {
    const text = await this.minScoreDisplay.textContent();
    return parseInt(text || '0', 10);
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
      if (className?.includes('bg-primary-100') || className?.includes('bg-primary-900')) {
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
    await expect(this.categoriesSection).toBeVisible();
    await expect(this.effortSection).toBeVisible();
    await expect(this.qualitySection).toBeVisible();
    await expect(this.themeSection).toBeVisible();
  }
}
