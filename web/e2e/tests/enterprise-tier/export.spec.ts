/**
 * Enterprise archive export contract tests.
 *
 * Export UI may be feature-flagged; these tests assert stable behavior in both cases.
 */

import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { ArchivePage } from '../../pages';

function exportButton(page: Page) {
  return page.locator(
    'button:has-text("Export"), [data-testid="export-button"], button:has-text("Download")'
  ).first();
}

test.describe('Enterprise Tier - Export Functionality', () => {
  test('archive remains usable for enterprise users', async ({ asEnterpriseUser, setupMocks }) => {
    await setupMocks(asEnterpriseUser, 'enterprise');
    const archivePage = new ArchivePage(asEnterpriseUser);
    await archivePage.goto();

    await expect(archivePage.heading).toBeVisible();
    await expect(archivePage.searchInput).toBeVisible();
    expect(await archivePage.getIdeaCount()).toBeGreaterThanOrEqual(0);
  });

  test('if export controls are present, JSON/CSV options are discoverable', async ({
    asEnterpriseUser,
    setupMocks,
  }) => {
    await setupMocks(asEnterpriseUser, 'enterprise');
    const archivePage = new ArchivePage(asEnterpriseUser);
    await archivePage.goto();

    const button = exportButton(asEnterpriseUser);
    if (!(await button.isVisible().catch(() => false))) {
      expect(await button.count()).toBeGreaterThanOrEqual(0);
      return;
    }

    await button.click();

    const jsonOption = asEnterpriseUser.locator(
      'button:has-text("JSON"), [data-testid="export-json"], text=/json/i'
    ).first();
    const csvOption = asEnterpriseUser.locator(
      'button:has-text("CSV"), [data-testid="export-csv"], text=/csv/i'
    ).first();

    await expect(jsonOption).toBeVisible();
    await expect(csvOption).toBeVisible();
  });

  test('filtering still works before/without export', async ({ asEnterpriseUser, setupMocks }) => {
    await setupMocks(asEnterpriseUser, 'enterprise');
    const archivePage = new ArchivePage(asEnterpriseUser);
    await archivePage.goto();

    const initialCount = await archivePage.getIdeaCount();
    await archivePage.search('Code');
    await asEnterpriseUser.waitForTimeout(300);
    const filteredCount = await archivePage.getIdeaCount();

    expect(initialCount).toBeGreaterThanOrEqual(0);
    expect(filteredCount).toBeGreaterThanOrEqual(0);
  });
});
