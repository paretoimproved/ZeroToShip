/**
 * Base page object class providing common functionality
 */

import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;

  // Common navigation elements
  readonly navBar: Locator;
  readonly logo: Locator;
  readonly todayLink: Locator;
  readonly archiveLink: Locator;
  readonly settingsLink: Locator;
  readonly accountLink: Locator;

  // Main content area
  readonly mainContent: Locator;
  readonly pageTitle: Locator;

  constructor(page: Page) {
    this.page = page;

    // NavBar locators (based on NavBar.tsx)
    this.navBar = page.locator('nav');
    this.logo = page.locator('a:has-text("ZeroToShip")');
    this.todayLink = page.locator('nav a:has-text("Today")');
    this.archiveLink = page.locator('nav a:has-text("Archive")');
    this.settingsLink = page.locator('nav a:has-text("Settings")');
    this.accountLink = page.locator('nav a:has-text("Account")');

    // Main content locators
    this.mainContent = page.locator('main');
    this.pageTitle = page.locator('h1').first();
  }

  /**
   * Navigate to this page
   */
  abstract goto(): Promise<void>;

  /**
   * Wait for the page to be fully loaded
   */
  abstract waitForLoad(): Promise<void>;

  /**
   * Navigate to the home/today page
   */
  async goToToday(): Promise<void> {
    await this.todayLink.click();
    await this.page.waitForURL('/');
  }

  /**
   * Navigate to the archive page
   */
  async goToArchive(): Promise<void> {
    await this.archiveLink.click();
    await this.page.waitForURL('/archive');
  }

  /**
   * Navigate to the settings page
   */
  async goToSettings(): Promise<void> {
    await this.settingsLink.click();
    await this.page.waitForURL('/settings');
  }

  /**
   * Navigate to the account page
   */
  async goToAccount(): Promise<void> {
    await this.accountLink.click();
    await this.page.waitForURL('/account');
  }

  /**
   * Click the logo to go home
   */
  async clickLogo(): Promise<void> {
    await this.logo.click();
    await this.page.waitForURL('/');
  }

  /**
   * Check if a navigation link is active
   */
  async isNavLinkActive(link: Locator): Promise<boolean> {
    const className = await link.getAttribute('class');
    return className?.includes('bg-primary-100') || className?.includes('bg-primary-900') || false;
  }

  /**
   * Get the current page title
   */
  async getTitle(): Promise<string> {
    return await this.pageTitle.textContent() || '';
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `./e2e/test-results/screenshots/${name}.png` });
  }

  /**
   * Scroll to the bottom of the page
   */
  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  /**
   * Scroll to the top of the page
   */
  async scrollToTop(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  /**
   * Check if element is visible
   */
  async isVisible(locator: Locator): Promise<boolean> {
    return await locator.isVisible();
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(locator: Locator, timeout?: number): Promise<void> {
    await expect(locator).toBeVisible({ timeout });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForHidden(locator: Locator, timeout?: number): Promise<void> {
    await expect(locator).toBeHidden({ timeout });
  }
}
