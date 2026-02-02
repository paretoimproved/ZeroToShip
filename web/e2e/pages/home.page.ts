/**
 * Home page (Today's Ideas) page object
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class HomePage extends BasePage {
  // Page-specific locators
  readonly heading: Locator;
  readonly dateDisplay: Locator;
  readonly dataSourceBadge: Locator;
  readonly ideaCards: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);

    // Home page specific locators (based on app/page.tsx)
    this.heading = page.locator('h1:has-text("Today\'s Top Ideas")');
    this.dateDisplay = page.locator('header p').first();
    this.dataSourceBadge = page.locator('header span.bg-yellow-100, header span.bg-green-100');
    this.ideaCards = page.locator('article');
    this.emptyState = page.locator('text="No ideas generated yet"');
  }

  /**
   * Navigate to the home page
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.waitForLoad();
  }

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for either ideas to load or empty state
    await Promise.race([
      this.ideaCards.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      this.emptyState.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    ]);
  }

  /**
   * Get the number of visible idea cards
   */
  async getIdeaCount(): Promise<number> {
    return await this.ideaCards.count();
  }

  /**
   * Get an idea card by index (0-based)
   */
  getIdeaCard(index: number): Locator {
    return this.ideaCards.nth(index);
  }

  /**
   * Get an idea card by name
   */
  getIdeaCardByName(name: string): Locator {
    return this.ideaCards.filter({ hasText: name });
  }

  /**
   * Click on an idea card to view details
   */
  async clickIdeaCard(index: number): Promise<void> {
    await this.ideaCards.nth(index).click();
    await this.page.waitForURL(/\/idea\//);
  }

  /**
   * Click on an idea card by name
   */
  async clickIdeaByName(name: string): Promise<void> {
    await this.getIdeaCardByName(name).click();
    await this.page.waitForURL(/\/idea\//);
  }

  /**
   * Get the rank number of an idea card
   */
  async getIdeaRank(index: number): Promise<string> {
    const card = this.ideaCards.nth(index);
    const rankElement = card.locator('.bg-primary-100, .bg-primary-900').first();
    return await rankElement.textContent() || '';
  }

  /**
   * Get the name of an idea from a card
   */
  async getIdeaName(index: number): Promise<string> {
    const card = this.ideaCards.nth(index);
    const nameElement = card.locator('h2');
    return await nameElement.textContent() || '';
  }

  /**
   * Get the priority score from an idea card
   */
  async getIdeaScore(index: number): Promise<string> {
    const card = this.ideaCards.nth(index);
    // Score badge based on ScoreBadge component
    const scoreElement = card.locator('[class*="bg-green-"], [class*="bg-yellow-"], [class*="bg-red-"]').first();
    return await scoreElement.textContent() || '';
  }

  /**
   * Get the effort estimate from an idea card
   */
  async getIdeaEffort(index: number): Promise<string> {
    const card = this.ideaCards.nth(index);
    // Effort badge text
    const effortElement = card.locator('text=/weekend|week|month|quarter/i').first();
    return await effortElement.textContent() || '';
  }

  /**
   * Check if showing mock data
   */
  async isUsingMockData(): Promise<boolean> {
    const mockBadge = this.page.locator('text="Using mock data"');
    return await mockBadge.isVisible();
  }

  /**
   * Check if showing live data
   */
  async isUsingLiveData(): Promise<boolean> {
    const liveBadge = this.page.locator('text="Live data"');
    return await liveBadge.isVisible();
  }

  /**
   * Check if page shows empty state
   */
  async hasEmptyState(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  /**
   * Get all idea names as an array
   */
  async getAllIdeaNames(): Promise<string[]> {
    const count = await this.getIdeaCount();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      names.push(await this.getIdeaName(i));
    }

    return names;
  }

  /**
   * Verify idea cards are displayed correctly
   */
  async verifyIdeaCardsDisplayed(minCount: number = 1): Promise<void> {
    await expect(this.ideaCards.first()).toBeVisible();
    const count = await this.getIdeaCount();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }
}
