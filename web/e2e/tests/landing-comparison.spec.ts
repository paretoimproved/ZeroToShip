import { test, expect } from '@playwright/test';

test.describe('Landing Page — Comparison Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('heading', { name: /ZeroToShip vs/i })
      .scrollIntoViewIfNeeded();
  });

  test('should display comparison heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /ZeroToShip vs\. Doing It Yourself/i }),
    ).toBeVisible();
  });

  test('should display subtitle', async ({ page }) => {
    await expect(
      page.getByText('See how much time and effort you save.'),
    ).toBeVisible();
  });

  test('desktop: should show column headers', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'ZeroToShip' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Manual Research' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'ChatGPT / AI Tools' })).toBeVisible();
  });

  test('should show ZeroToShip price', async ({ page }) => {
    // The en dash (–) between "Free" and "$19/mo" — scope to table to avoid mobile duplicate
    const table = page.locator('table');
    await expect(table.getByText('Free \u2013 $19/mo')).toBeVisible();
  });

  test('should show time comparison', async ({ page }) => {
    const table = page.locator('table');
    await expect(table.getByText('5 min/day')).toBeVisible();
    await expect(table.getByText('2-3 hours/day')).toBeVisible();
  });

  test('should show feature rows', async ({ page }) => {
    await expect(page.getByRole('rowheader', { name: 'Daily fresh ideas' })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: 'Multi-source scraping' })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: 'AI scoring & ranking' })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: 'Full business brief' })).toBeVisible();
  });

  test('mobile: should show card layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page
      .getByRole('heading', { name: /ZeroToShip vs/i })
      .scrollIntoViewIfNeeded();
    // Desktop table is hidden via CSS (hidden md:block)
    await expect(page.locator('table')).not.toBeVisible();
    // Mobile cards use h3 headings for feature names
    await expect(page.getByRole('heading', { name: 'Daily fresh ideas' })).toBeVisible();
  });
});
