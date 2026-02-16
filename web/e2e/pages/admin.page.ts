/**
 * Admin page objects for E2E tests
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class AdminDashboardPage extends BasePage {
  readonly heading: Locator;
  readonly sidebar: Locator;
  readonly dashboardLink: Locator;
  readonly pipelineLink: Locator;
  readonly usersLink: Locator;
  readonly statCards: Locator;
  readonly pipelineStatusCard: Locator;
  readonly runPipelineButton: Locator;

  constructor(page: Page) {
    super(page);

    this.heading = page.locator('h1:has-text("Admin Dashboard")');
    this.sidebar = page.locator('aside');
    this.dashboardLink = page.locator('aside a:has-text("Dashboard")');
    this.pipelineLink = page.locator('aside a:has-text("Pipeline")');
    this.usersLink = page.locator('aside a:has-text("Users")');
    this.statCards = page.locator('main .bg-white, main .dark\\:bg-gray-800').filter({
      has: page.locator('p.text-2xl, p.text-sm'),
    });
    this.pipelineStatusCard = page.locator('text="Pipeline Status"').locator('..');
    this.runPipelineButton = page.locator('a:has-text("Run Pipeline")');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin');
    await this.waitForLoad();
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await Promise.race([
      this.heading.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      this.page.locator('text="Access Denied"').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    ]);
  }

  async hasSidebar(): Promise<boolean> {
    return await this.sidebar.isVisible();
  }

  async getStatCardValues(): Promise<string[]> {
    const cards = this.page.locator('p.text-2xl');
    const count = await cards.count();
    const values: string[] = [];
    for (let i = 0; i < count; i++) {
      values.push(await cards.nth(i).textContent() || '');
    }
    return values;
  }

  async goToPipeline(): Promise<void> {
    await this.pipelineLink.click();
    await this.page.waitForURL('/admin/pipeline');
  }

  async goToUsers(): Promise<void> {
    await this.usersLink.click();
    await this.page.waitForURL('/admin/users');
  }
}

export class AdminPipelinePage extends BasePage {
  readonly heading: Locator;
  readonly runButton: Locator;
  readonly dryRunCheckbox: Locator;
  readonly skipDeliveryCheckbox: Locator;
  readonly hoursBackInput: Locator;
  readonly maxBriefsInput: Locator;
  readonly statusPanel: Locator;
  readonly phaseBadges: Locator;

  constructor(page: Page) {
    super(page);

    this.heading = page.locator('h1:has-text("Pipeline Control")');
    this.runButton = page.locator('button:has-text("Run Pipeline")');
    this.dryRunCheckbox = page.locator('label:has-text("Dry Run") input[type="checkbox"]');
    this.skipDeliveryCheckbox = page.locator('label:has-text("Skip Delivery") input[type="checkbox"]');
    this.hoursBackInput = page.locator('input[placeholder="48"], input[placeholder="24"]').first();
    this.maxBriefsInput = page.locator('input[placeholder="10"]');
    this.statusPanel = page.locator('h2:has-text("Latest Run Status")').locator('..');
    this.phaseBadges = page
      .locator('h2:has-text("Pipeline Progress")')
      .locator('..')
      .locator('span.text-xs.font-medium');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/pipeline');
    await this.waitForLoad();
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.heading.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }

  async setDryRun(checked: boolean): Promise<void> {
    if (checked) {
      await this.dryRunCheckbox.check();
    } else {
      await this.dryRunCheckbox.uncheck();
    }
  }

  async setSkipDelivery(checked: boolean): Promise<void> {
    if (checked) {
      await this.skipDeliveryCheckbox.check();
    } else {
      await this.skipDeliveryCheckbox.uncheck();
    }
  }

  async setHoursBack(hours: string): Promise<void> {
    await this.hoursBackInput.fill(hours);
  }

  async setMaxBriefs(max: string): Promise<void> {
    await this.maxBriefsInput.fill(max);
  }

  async triggerPipeline(): Promise<void> {
    await this.runButton.click();
  }

  async getPhaseBadgeTexts(): Promise<string[]> {
    const labels = ['Scrape', 'Analyze', 'Generate', 'Deliver'] as const;
    const texts: string[] = [];

    for (const label of labels) {
      const badge = this.page.getByText(new RegExp(`^${label}$`)).first();
      if (await badge.isVisible().catch(() => false)) {
        texts.push(label.toLowerCase());
      }
    }

    return texts;
  }
}

export class AdminUsersPage extends BasePage {
  readonly heading: Locator;
  readonly usersTable: Locator;
  readonly tableRows: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);

    this.heading = page.locator('h1:has-text("Users")');
    this.usersTable = page.locator('table');
    this.tableRows = page.locator('tbody tr');
    this.emptyState = page.locator('text="No users found"');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/users');
    await this.waitForLoad();
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await Promise.race([
      this.usersTable.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      this.emptyState.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    ]);
  }

  async getUserCount(): Promise<number> {
    const isEmpty = await this.emptyState.isVisible();
    if (isEmpty) return 0;
    return await this.tableRows.count();
  }

  async getUserEmails(): Promise<string[]> {
    const count = await this.tableRows.count();
    const emails: string[] = [];
    for (let i = 0; i < count; i++) {
      const email = await this.tableRows.nth(i).locator('td').first().textContent();
      emails.push(email || '');
    }
    return emails;
  }

  async hasTableHeaders(): Promise<boolean> {
    const headers = ['Email', 'Name', 'Tier', 'Created'];
    for (const header of headers) {
      const th = this.page.locator(`th:has-text("${header}")`);
      if (!(await th.isVisible())) return false;
    }
    return true;
  }
}
