/**
 * Archive page object
 *
 * Updated for grid layout with compact cards and modal expansion.
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ArchivePage extends BasePage {
  // Page-specific locators
  readonly heading: Locator;
  readonly description: Locator;

  // Filter controls (based on app/archive/page.tsx)
  readonly searchInput: Locator;
  readonly effortDropdown: Locator;
  readonly minScoreSlider: Locator;
  readonly minScoreLabel: Locator;

  // Results (compact grid cards)
  readonly ideaCards: Locator;
  readonly emptyState: Locator;
  readonly resultsCount: Locator;

  // Modal
  readonly modal: Locator;
  readonly modalCard: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.heading = page.locator('h1:has-text("Idea Archive")');
    this.description = page.locator('text="Browse past ideas and find hidden gems"');

    // Filter controls
    this.searchInput = page.locator('#search');
    this.effortDropdown = page.locator('#effort');
    this.minScoreSlider = page.locator('#score');
    this.minScoreLabel = page.locator('text=/Min Score:/');

    // Results
    this.ideaCards = page.locator('article');
    this.emptyState = page.locator('text="No matching ideas"');
    this.resultsCount = page.locator('text=/Showing \\d+ of \\d+ ideas/');

    // Modal
    this.modal = page.locator('[data-testid="idea-modal"]');
    this.modalCard = this.modal.locator('article');
  }

  /**
   * Navigate to the archive page
   */
  async goto(): Promise<void> {
    await this.page.goto('/archive');
    await this.waitForLoad();
  }

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.heading).toBeVisible({ timeout: 10000 });
    await Promise.race([
      this.ideaCards.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      this.emptyState.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    ]);
  }

  /**
   * Search for ideas by text
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Wait for results to update
    await this.page.waitForTimeout(300);
  }

  /**
   * Clear the search input
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(300);
  }

  /**
   * Filter by effort level
   */
  async filterByEffort(effort: 'all' | 'weekend' | 'week' | 'month' | 'quarter'): Promise<void> {
    await this.effortDropdown.selectOption(effort);
    await this.page.waitForTimeout(300);
  }

  /**
   * Set minimum score filter
   */
  async setMinScore(score: number): Promise<void> {
    // Use native setter so React-controlled range inputs update reliably.
    await this.minScoreSlider.evaluate((el: HTMLInputElement, value: number) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, String(value));
      } else {
        el.value = String(value);
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, score);
    await this.page.waitForTimeout(300);
  }

  /**
   * Get the current minimum score value
   */
  async getMinScore(): Promise<number> {
    const value = await this.minScoreSlider.inputValue();
    return parseInt(value, 10);
  }

  /**
   * Get the number of visible idea cards
   */
  async getIdeaCount(): Promise<number> {
    return await this.ideaCards.count();
  }

  /**
   * Get an idea card by index
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
   * Open an idea by clicking its compact card (opens modal)
   */
  async openIdea(index: number): Promise<void> {
    await this.ideaCards.nth(index).click();
    await expect(this.modal).toBeVisible({ timeout: 5000 });
  }

  /**
   * Close the modal (via Escape key)
   */
  async closeModal(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.modal).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Switch to a specific tab within the modal card
   */
  async switchTab(tabName: string): Promise<void> {
    const tab = this.modalCard.locator(`[role="tab"]:has-text("${tabName}")`);
    await tab.click();
  }

  /**
   * Get the active tab name in the modal
   */
  async getActiveTabName(): Promise<string> {
    const activeTab = this.modalCard.locator('[role="tab"][aria-selected="true"]');
    return await activeTab.textContent() || '';
  }

  /**
   * Check if empty state is shown
   */
  async hasEmptyState(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  /**
   * Get the results count text
   */
  async getResultsCountText(): Promise<string> {
    if (await this.resultsCount.isVisible()) {
      return await this.resultsCount.textContent() || '';
    }
    return '';
  }

  /**
   * Parse the results count from the display text
   */
  async getResultsCounts(): Promise<{ showing: number; total: number }> {
    const text = await this.getResultsCountText();
    const match = text.match(/Showing (\d+) of (\d+) ideas/);
    if (match) {
      return {
        showing: parseInt(match[1], 10),
        total: parseInt(match[2], 10),
      };
    }
    return { showing: 0, total: 0 };
  }

  /**
   * Reset all filters to default
   */
  async resetFilters(): Promise<void> {
    await this.clearSearch();
    await this.filterByEffort('all');
    await this.setMinScore(0);
  }

  /**
   * Get all visible idea names
   */
  async getAllIdeaNames(): Promise<string[]> {
    const count = await this.getIdeaCount();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      const card = this.ideaCards.nth(i);
      const name = await card.locator('h3.font-mono').textContent();
      if (name) names.push(name.trim());
    }

    return names;
  }

  /**
   * Verify ideas are displayed
   */
  async verifyIdeasDisplayed(minCount: number = 1): Promise<void> {
    const count = await this.getIdeaCount();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  /**
   * Verify filters are functional
   */
  async verifyFiltersExist(): Promise<void> {
    await expect(this.searchInput).toBeVisible();
    await expect(this.effortDropdown).toBeVisible();
    await expect(this.minScoreSlider).toBeVisible();
  }

  /**
   * Check if gated content is shown in the modal
   */
  async hasGatedContent(): Promise<boolean> {
    const gated = this.modalCard.locator('[data-testid="gated-content"]');
    return await gated.isVisible();
  }
}
