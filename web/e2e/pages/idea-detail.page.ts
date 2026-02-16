/**
 * Idea detail page object
 *
 * Updated for IdeaBriefCard with tabbed interface.
 * Content is now organized in tabs instead of collapsible sections.
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class IdeaDetailPage extends BasePage {
  // Navigation
  readonly backLink: Locator;

  // Card (the single IdeaBriefCard on the detail page)
  readonly ideaCard: Locator;

  // Header section (inside the card)
  readonly ideaName: Locator;
  readonly tagline: Locator;
  readonly scoreBadge: Locator;
  readonly effortBadge: Locator;

  // Tab bar
  readonly tabBar: Locator;
  readonly tabs: Locator;

  // Gated content
  readonly gatedContent: Locator;

  constructor(page: Page) {
    super(page);

    // Navigation
    this.backLink = page.locator('a:has-text("Back to Today\'s Ideas")');

    // Card
    this.ideaCard = page.locator('article');

    // Header (inside card)
    this.ideaName = page.locator('article h3.font-mono');
    this.tagline = page.locator('article h3.font-mono + p');
    this.scoreBadge = page.locator('article [class*="bg-green-"], article [class*="bg-yellow-"], article [class*="bg-red-"]').first();
    this.effortBadge = page.locator('article').locator('text=/weekend|week|month|quarter/i').first();

    // Tabs
    this.tabBar = page.locator('[role="tablist"]');
    this.tabs = page.locator('[role="tab"]');

    // Gated content
    this.gatedContent = page.locator('[data-testid="gated-content"]');
  }

  /**
   * Navigate to a specific idea detail page
   */
  async goto(ideaId: string = '1'): Promise<void> {
    await this.page.goto(`/idea/${ideaId}`);
    await this.waitForLoad();
  }

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.tabBar).toBeVisible({ timeout: 10000 });
  }

  /**
   * Go back to the home page using the back link
   */
  async goBack(): Promise<void> {
    await this.backLink.click();
    await this.page.waitForURL('/dashboard');
  }

  /**
   * Get the idea name
   */
  async getName(): Promise<string> {
    return await this.ideaName.textContent() || '';
  }

  /**
   * Get the tagline
   */
  async getTagline(): Promise<string> {
    return await this.tagline.textContent() || '';
  }

  /**
   * Get the priority score
   */
  async getScore(): Promise<string> {
    return await this.scoreBadge.textContent() || '';
  }

  /**
   * Get the effort estimate
   */
  async getEffort(): Promise<string> {
    return await this.effortBadge.textContent() || '';
  }

  /**
   * Switch to a specific tab by label
   */
  async switchTab(tabName: string): Promise<void> {
    const tab = this.page.locator(`[role="tab"]:has-text("${tabName}")`);
    await tab.click();
  }

  /**
   * Get the active tab name
   */
  async getActiveTabName(): Promise<string> {
    const activeTab = this.page.locator('[role="tab"][aria-selected="true"]');
    return await activeTab.textContent() || '';
  }

  /**
   * Get the current tab panel content
   */
  async getTabPanelContent(): Promise<string> {
    const panel = this.page.locator('[role="tabpanel"]');
    return await panel.textContent() || '';
  }

  /**
   * Check if gated content overlay is visible
   */
  async hasGatedContent(): Promise<boolean> {
    return await this.gatedContent.isVisible();
  }

  /**
   * Get all key features (from Solution tab)
   */
  async getKeyFeatures(): Promise<string[]> {
    await this.switchTab('Solution');
    const panel = this.page.locator('[role="tabpanel"]');
    const pills = panel.locator('.bg-primary-100, .bg-primary-900\\/50');
    const count = await pills.count();
    const features: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await pills.nth(i).textContent();
      if (text) features.push(text.trim());
    }
    return features;
  }

  /**
   * Get all tech stack items (from Tech Spec tab)
   */
  async getTechStack(): Promise<string[]> {
    await this.switchTab('Tech Spec');
    const panel = this.page.locator('[role="tabpanel"]');
    const pills = panel.locator('.font-mono.bg-gray-100, .font-mono.bg-gray-800');
    const count = await pills.count();
    const stack: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await pills.nth(i).textContent();
      if (text) stack.push(text.trim());
    }
    return stack;
  }

  /**
   * Get all go-to-market channels (from Business tab)
   */
  async getChannels(): Promise<string[]> {
    await this.switchTab('Business');
    const panel = this.page.locator('[role="tabpanel"]');
    const pills = panel.locator('.bg-primary-100, .bg-primary-900\\/50');
    const count = await pills.count();
    const channels: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await pills.nth(i).textContent();
      if (text) channels.push(text.trim());
    }
    return channels;
  }

  /**
   * Verify all tab sections are accessible (for authenticated users)
   */
  async verifyAllTabsAccessible(): Promise<void> {
    const tabNames = ['Problem', 'Solution', 'Tech Spec', 'Business'];
    for (const tabName of tabNames) {
      await this.switchTab(tabName);
      const activeTab = await this.getActiveTabName();
      expect(activeTab).toBe(tabName);
      // Verify no gated content
      const isGated = await this.hasGatedContent();
      expect(isGated).toBe(false);
    }
  }
}
