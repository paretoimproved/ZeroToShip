import { test, expect } from '@playwright/test';

test.describe('Landing Page — Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show ZeroToShip logo', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'ZeroToShip' })).toBeVisible();
  });

  test('should have Features link', async ({ page }) => {
    const nav = page.getByLabel('Main navigation');
    await expect(nav.getByRole('link', { name: 'Features' })).toBeVisible();
  });

  test('should have Pricing link', async ({ page }) => {
    const nav = page.getByLabel('Main navigation');
    await expect(nav.getByRole('link', { name: 'Pricing' })).toBeVisible();
  });

  test('should have FAQ link', async ({ page }) => {
    const nav = page.getByLabel('Main navigation');
    await expect(nav.getByRole('link', { name: 'FAQ' })).toBeVisible();
  });

  test('should have Sign In link', async ({ page }) => {
    const nav = page.getByLabel('Main navigation');
    await expect(nav.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });

  test('should have Get Started Free button', async ({ page }) => {
    const nav = page.getByLabel('Main navigation');
    await expect(
      nav.getByRole('link', { name: 'Get Started Free' }),
    ).toBeVisible();
  });

  test('mobile: should show hamburger menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: 'Toggle navigation' }),
    ).toBeVisible();
  });

  test('mobile: clicking hamburger opens mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Navigation menu' }),
    ).toBeVisible();
  });

  test('mobile: Escape closes mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Navigation menu' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('dialog', { name: 'Navigation menu' }),
    ).toBeHidden();
  });

  test('mobile: menu contains Sign In and Get Started Free', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    const dialog = page.getByRole('dialog', { name: 'Navigation menu' });
    await expect(dialog.getByText('Sign In')).toBeVisible();
    await expect(dialog.getByText('Get Started Free')).toBeVisible();
  });
});
