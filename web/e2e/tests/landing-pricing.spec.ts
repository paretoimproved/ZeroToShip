import { test, expect } from '@playwright/test';

test.describe('Landing Page — Pricing Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing').waitFor({ state: 'visible' });
    await page.evaluate(() => {
      document.querySelector('#pricing')?.scrollIntoView({ block: 'start' });
    });
  });

  test('should display three plan cards', async ({ page }) => {
    const section = page.locator('#pricing');
    await expect(section.getByRole('heading', { name: 'Free' })).toBeVisible();
    await expect(section.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
    await expect(section.getByRole('heading', { name: 'Enterprise' })).toBeVisible();
  });

  test('should show section heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Simple Pricing, Serious Value' }),
    ).toBeVisible();
  });

  test('should show $0 for Free monthly', async ({ page }) => {
    const section = page.locator('#pricing');
    await expect(section.getByText('$0')).toBeVisible();
  });

  test('should show $19 for Pro monthly', async ({ page }) => {
    const section = page.locator('#pricing');
    await expect(section.getByText('$19')).toBeVisible();
  });

  test('should show $99 for Enterprise monthly', async ({ page }) => {
    const section = page.locator('#pricing');
    await expect(section.getByText('$99')).toBeVisible();
  });

  test('should highlight Pro as Most Popular', async ({ page }) => {
    await expect(page.getByText('Most Popular')).toBeVisible();
  });

  test('should toggle to annual pricing', async ({ page }) => {
    const section = page.locator('#pricing');
    await section.getByRole('radio', { name: /Annual/i }).click();
    await page.waitForTimeout(200);
    await expect(section.getByText('$15.83')).toBeVisible();
    await expect(section.getByText('$82.50')).toBeVisible();
  });

  test('should show savings badges on annual toggle', async ({ page }) => {
    const section = page.locator('#pricing');
    await section.getByRole('radio', { name: /Annual/i }).click();
    await page.waitForTimeout(200);
    await expect(section.getByText('Save 2 months').first()).toBeVisible();
  });

  test('should show annual billing subtext', async ({ page }) => {
    const section = page.locator('#pricing');
    await section.getByRole('radio', { name: /Annual/i }).click();
    await page.waitForTimeout(200);
    await expect(section.getByText('billed at $190/year')).toBeVisible();
    await expect(section.getByText('billed at $990/year')).toBeVisible();
  });

  test('Free plan should list featured brief as included', async ({ page }) => {
    await expect(page.getByText('1 featured brief per email')).toBeVisible();
  });

  test('Free plan should list full briefs as not included', async ({ page }) => {
    await expect(page.getByText('Full briefs for all ideas')).toBeVisible();
  });

  test('Pro should list archive access as included', async ({ page }) => {
    await expect(page.getByText('Full archive access')).toBeVisible();
  });

  test('Pro should list CSV export', async ({ page }) => {
    await expect(page.getByText('CSV export', { exact: true })).toBeVisible();
  });

  test('Get Started Free button navigates to /signup', async ({ page }) => {
    const section = page.locator('#pricing');
    const btn = section.getByRole('button', { name: 'Get Started Free' });
    await btn.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('Start Building button navigates to /signup?plan=pro', async ({ page }) => {
    const section = page.locator('#pricing');
    const btn = section.getByRole('button', { name: 'Start Building' });
    await btn.click();
    await expect(page).toHaveURL(/\/signup\?plan=pro/);
  });
});
