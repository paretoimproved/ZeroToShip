/**
 * Idea detail page object
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class IdeaDetailPage extends BasePage {
  // Navigation
  readonly backLink: Locator;

  // Header section
  readonly ideaName: Locator;
  readonly tagline: Locator;
  readonly scoreBadge: Locator;
  readonly effortBadge: Locator;
  readonly generatedDate: Locator;

  // Quick stats
  readonly revenuePotential: Locator;
  readonly marketSize: Locator;
  readonly targetAudience: Locator;

  // Content sections (based on BriefView.tsx)
  readonly problemSection: Locator;
  readonly existingSolutionsSection: Locator;
  readonly marketGapsSection: Locator;
  readonly proposedSolutionSection: Locator;
  readonly mvpScopeSection: Locator;
  readonly technicalSpecSection: Locator;
  readonly businessModelSection: Locator;
  readonly goToMarketSection: Locator;
  readonly risksSection: Locator;

  // Features list
  readonly keyFeatures: Locator;

  // Tech stack
  readonly techStackTags: Locator;

  // Channels
  readonly channelTags: Locator;

  constructor(page: Page) {
    super(page);

    // Navigation
    this.backLink = page.locator('a:has-text("Back to Today\'s Ideas")');

    // Header (from BriefView.tsx)
    this.ideaName = page.locator('article header h1');
    this.tagline = page.locator('article header p.italic');
    this.scoreBadge = page.locator('article header [class*="bg-green-"], article header [class*="bg-yellow-"], article header [class*="bg-red-"]').first();
    this.effortBadge = page.locator('article header').locator('text=/weekend|week|month|quarter/i').first();
    this.generatedDate = page.locator('article header span.text-gray-500').first();

    // Quick stats grid
    this.revenuePotential = page.locator('text="Revenue Potential"').locator('..').locator('div.font-semibold');
    this.marketSize = page.locator('text="Market Size"').locator('..').locator('div.font-semibold');
    this.targetAudience = page.locator('text="Target Audience"').locator('..').locator('div.font-semibold');

    // Content sections
    this.problemSection = page.locator('section:has(h3:text("Problem Statement"))');
    this.existingSolutionsSection = page.locator('section:has(h3:text("Existing Solutions"))');
    this.marketGapsSection = page.locator('section:has(h3:text("Market Gaps"))');
    this.proposedSolutionSection = page.locator('section:has(h3:text("Proposed Solution"))');
    this.mvpScopeSection = page.locator('section:has(h3:text("MVP Scope"))');
    this.technicalSpecSection = page.locator('section:has(h3:text("Technical Specification"))');
    this.businessModelSection = page.locator('section:has(h3:text("Business Model"))');
    this.goToMarketSection = page.locator('section:has(h3:text("Go-to-Market Strategy"))');
    this.risksSection = page.locator('section:has(h3:text("Risks & Challenges"))');

    // Features list
    this.keyFeatures = page.locator('section:has(h3:text("Proposed Solution")) li');

    // Tech stack tags
    this.techStackTags = page.locator('section:has(h3:text("Technical Specification")) .bg-gray-100, section:has(h3:text("Technical Specification")) .bg-gray-700');

    // Channel tags
    this.channelTags = page.locator('section:has(h3:text("Go-to-Market Strategy")) .bg-primary-100, section:has(h3:text("Go-to-Market Strategy")) .bg-primary-900');
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
    await expect(this.ideaName).toBeVisible({ timeout: 10000 });
  }

  /**
   * Go back to the home page using the back link
   */
  async goBack(): Promise<void> {
    await this.backLink.click();
    await this.page.waitForURL('/');
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
   * Get the revenue potential
   */
  async getRevenuePotential(): Promise<string> {
    return await this.revenuePotential.textContent() || '';
  }

  /**
   * Get the market size
   */
  async getMarketSize(): Promise<string> {
    return await this.marketSize.textContent() || '';
  }

  /**
   * Get all key features
   */
  async getKeyFeatures(): Promise<string[]> {
    const features: string[] = [];
    const count = await this.keyFeatures.count();

    for (let i = 0; i < count; i++) {
      const text = await this.keyFeatures.nth(i).textContent();
      if (text) features.push(text.trim());
    }

    return features;
  }

  /**
   * Get all tech stack items
   */
  async getTechStack(): Promise<string[]> {
    const stack: string[] = [];
    const count = await this.techStackTags.count();

    for (let i = 0; i < count; i++) {
      const text = await this.techStackTags.nth(i).textContent();
      if (text) stack.push(text.trim());
    }

    return stack;
  }

  /**
   * Get all go-to-market channels
   */
  async getChannels(): Promise<string[]> {
    const channels: string[] = [];
    const count = await this.channelTags.count();

    for (let i = 0; i < count; i++) {
      const text = await this.channelTags.nth(i).textContent();
      if (text) channels.push(text.trim());
    }

    return channels;
  }

  /**
   * Check if a section is visible
   */
  async isSectionVisible(section: Locator): Promise<boolean> {
    return await section.isVisible();
  }

  /**
   * Verify all required sections are present
   */
  async verifyAllSectionsPresent(): Promise<void> {
    await expect(this.problemSection).toBeVisible();
    await expect(this.existingSolutionsSection).toBeVisible();
    await expect(this.marketGapsSection).toBeVisible();
    await expect(this.proposedSolutionSection).toBeVisible();
    await expect(this.mvpScopeSection).toBeVisible();
    await expect(this.technicalSpecSection).toBeVisible();
    await expect(this.businessModelSection).toBeVisible();
    await expect(this.goToMarketSection).toBeVisible();
    await expect(this.risksSection).toBeVisible();
  }
}
