import { test, expect } from '@playwright/test';

test.describe('Pricing Page (/pricing)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('should load successfully', async ({ page }) => {
    await expect(page).toHaveURL('/pricing');
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Pricing/);
  });

  test('should display pricing heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Simple Pricing, Serious Value' }),
    ).toBeVisible();
  });

  test('should display subtitle', async ({ page }) => {
    await expect(
      page.getByText("Start free. Upgrade when you're ready to ship faster."),
    ).toBeVisible();
  });

  test('should display three plan cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible();
  });

  test('should show correct monthly prices', async ({ page }) => {
    await expect(page.getByText('$0')).toBeVisible();
    await expect(page.getByText('$19')).toBeVisible();
    await expect(page.getByText('$99')).toBeVisible();
  });

  test('should highlight Pro as Most Popular', async ({ page }) => {
    await expect(page.getByText('Most Popular')).toBeVisible();
  });

  test('should toggle to annual billing', async ({ page }) => {
    await page.getByRole('radio', { name: /Annual/i }).click();
    await page.waitForTimeout(200);
    await expect(page.getByText('$15.83')).toBeVisible();
    await expect(page.getByText('$82.50')).toBeVisible();
  });

  test('should show annual savings badges', async ({ page }) => {
    await page.getByRole('radio', { name: /Annual/i }).click();
    await page.waitForTimeout(200);
    await expect(page.getByText('Save 2 months').first()).toBeVisible();
  });

  test('should show billing subtext on annual', async ({ page }) => {
    await page.getByRole('radio', { name: /Annual/i }).click();
    await page.waitForTimeout(200);
    await expect(page.getByText('billed at $190/year')).toBeVisible();
    await expect(page.getByText('billed at $990/year')).toBeVisible();
  });

  test('Get Started Free navigates to /signup', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started Free' }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should show 14-day guarantee text', async ({ page }) => {
    await expect(
      page.getByText('14-day money-back guarantee'),
    ).toBeVisible();
  });

  test('nav should show ZeroToShip logo', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'ZeroToShip' })).toBeVisible();
  });

  test('nav should have Sign In link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });

  test('nav should have Get Started Free link', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: 'Get Started Free' }),
    ).toBeVisible();
  });

  test('footer should show copyright', async ({ page }) => {
    await expect(page.getByText('ZeroToShip. All rights reserved')).toBeVisible();
  });

  test('should be responsive at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Toggle navigation' }),
    ).toBeVisible();
  });
});
