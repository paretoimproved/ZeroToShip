/**
 * Account page object
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class AccountPage extends BasePage {
  // Page header
  readonly heading: Locator;
  readonly description: Locator;

  // Error display
  readonly errorBanner: Locator;

  // Current plan section (based on app/account/page.tsx)
  readonly currentPlanSection: Locator;
  readonly currentPlanName: Locator;
  readonly planStatus: Locator;
  readonly renewalDate: Locator;
  readonly manageSubscriptionButton: Locator;

  // Billing cycle toggle
  readonly monthlyLabel: Locator;
  readonly yearlyLabel: Locator;
  readonly billingToggle: Locator;

  // Plan cards
  readonly planCards: Locator;
  readonly freePlanCard: Locator;
  readonly proPlanCard: Locator;
  readonly enterprisePlanCard: Locator;

  // Loading state
  readonly loadingState: Locator;

  // Billing portal section
  readonly billingSection: Locator;
  readonly openBillingPortalButton: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.heading = page.locator('h1:has-text("Account")');
    this.description = page.locator('text="Manage your subscription and billing"');

    // Error banner
    this.errorBanner = page.locator('.bg-red-50, .bg-red-900\\/20');

    // Current plan section
    this.currentPlanSection = page.locator('section:has(h2:text("Current Plan"))');
    this.currentPlanName = this.currentPlanSection.locator('.text-2xl.font-bold');
    this.planStatus = this.currentPlanSection.locator('span[class*="bg-green-"], span[class*="bg-red-"], span[class*="bg-gray-"]').first();
    this.renewalDate = this.currentPlanSection.locator('.text-sm.text-gray-600, .text-sm.text-gray-400');
    this.manageSubscriptionButton = this.currentPlanSection.locator('button:has-text("Manage Subscription")');

    // Billing cycle toggle
    this.monthlyLabel = page.locator('text="Monthly"');
    this.yearlyLabel = page.locator('text="Yearly"');
    this.billingToggle = page.locator('button:has(span.rounded-full.bg-white)');

    // Plan cards
    this.planCards = page.locator('section:has(h2:text("Available Plans")) > div > div');
    this.freePlanCard = page.locator('[class*="rounded-xl"]:has(h3:text("Free"))');
    this.proPlanCard = page.locator('[class*="rounded-xl"]:has(h3:text("Builder"))');
    this.enterprisePlanCard = page.locator('[class*="rounded-xl"]:has(h3:text("Enterprise"))');

    // Loading state
    this.loadingState = page.locator('.animate-pulse');

    // Billing portal section
    this.billingSection = page.locator('section:has(h2:text("Billing & Invoices"))');
    this.openBillingPortalButton = this.billingSection.locator('button:has-text("Open Billing Portal")');
  }

  /**
   * Navigate to the account page
   */
  async goto(): Promise<void> {
    await this.page.goto('/account');
    await this.waitForLoad();
  }

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for loading state to disappear
    await expect(this.loadingState).toBeHidden({ timeout: 10000 });
    await expect(this.heading).toBeVisible({ timeout: 10000 });
  }

  /**
   * Get current plan name
   */
  async getCurrentPlan(): Promise<string> {
    return await this.currentPlanName.textContent() || '';
  }

  /**
   * Get plan status
   */
  async getPlanStatus(): Promise<string> {
    return await this.planStatus.textContent() || '';
  }

  /**
   * Check if current plan is a specific tier
   */
  async isCurrentPlan(plan: 'free' | 'pro' | 'enterprise'): Promise<boolean> {
    const currentPlan = await this.getCurrentPlan();
    const expected = plan === 'pro' ? 'builder' : plan;
    return currentPlan.toLowerCase() === expected;
  }

  /**
   * Toggle billing cycle (monthly/yearly)
   */
  async toggleBillingCycle(): Promise<void> {
    await this.billingToggle.click();
  }

  /**
   * Check if yearly billing is selected
   */
  async isYearlyBilling(): Promise<boolean> {
    const yearlyClass = await this.yearlyLabel.getAttribute('class');
    return yearlyClass?.includes('font-medium') || false;
  }

  /**
   * Get a plan card by name
   */
  getPlanCard(plan: 'free' | 'pro' | 'enterprise'): Locator {
    switch (plan) {
      case 'free':
        return this.freePlanCard;
      case 'pro':
        return this.proPlanCard;
      case 'enterprise':
        return this.enterprisePlanCard;
    }
  }

  /**
   * Get the price displayed for a plan
   */
  async getPlanPrice(plan: 'free' | 'pro' | 'enterprise'): Promise<string> {
    const card = this.getPlanCard(plan);
    const priceElement = card.locator('.text-3xl.font-bold');
    return await priceElement.textContent() || '';
  }

  /**
   * Get features listed for a plan
   */
  async getPlanFeatures(plan: 'free' | 'pro' | 'enterprise'): Promise<string[]> {
    const card = this.getPlanCard(plan);
    const features = card.locator('li');
    const count = await features.count();
    const featureList: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await features.nth(i).textContent();
      if (text) featureList.push(text.trim());
    }

    return featureList;
  }

  /**
   * Click upgrade button for a plan
   */
  async clickUpgrade(plan: 'pro' | 'enterprise'): Promise<void> {
    const card = this.getPlanCard(plan);
    const button = card.locator('button:not(:disabled)');
    await button.click();
  }

  /**
   * Check if upgrade button is disabled (current plan)
   */
  async isUpgradeDisabled(plan: 'free' | 'pro' | 'enterprise'): Promise<boolean> {
    const card = this.getPlanCard(plan);
    const button = card.locator('button');
    return await button.isDisabled();
  }

  /**
   * Click manage subscription button
   */
  async clickManageSubscription(): Promise<void> {
    await this.manageSubscriptionButton.click();
  }

  /**
   * Check if manage subscription button is visible
   */
  async isManageSubscriptionVisible(): Promise<boolean> {
    return await this.manageSubscriptionButton.isVisible();
  }

  /**
   * Open billing portal
   */
  async openBillingPortal(): Promise<void> {
    await this.openBillingPortalButton.click();
  }

  /**
   * Check if billing portal section is visible
   */
  async isBillingPortalVisible(): Promise<boolean> {
    return await this.billingSection.isVisible();
  }

  /**
   * Check if error banner is displayed
   */
  async hasError(): Promise<boolean> {
    return await this.errorBanner.isVisible();
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    if (await this.hasError()) {
      return await this.errorBanner.textContent() || '';
    }
    return '';
  }

  /**
   * Verify all plan cards are present
   */
  async verifyAllPlansPresent(): Promise<void> {
    await expect(this.freePlanCard).toBeVisible();
    await expect(this.proPlanCard).toBeVisible();
    await expect(this.enterprisePlanCard).toBeVisible();
  }

  /**
   * Check if Builder plan is highlighted
   */
  async isProPlanHighlighted(): Promise<boolean> {
    const className = await this.proPlanCard.getAttribute('class');
    return className?.includes('border-primary-500') || false;
  }
}
