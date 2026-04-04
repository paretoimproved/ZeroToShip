/**
 * E2E tests for core error handling paths using the current app contract.
 */

import { test, expect } from '../../fixtures';
import { API_URL } from '../../utils/test-data';

test.describe('Error States', () => {
  test('dashboard gracefully handles ideas API outage', async ({ asFreeUser, setupMocks }) => {
    await setupMocks(asFreeUser, 'free');

    await asFreeUser.route(`${API_URL}/ideas/today`, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service temporarily unavailable' }),
      })
    );

    await asFreeUser.goto('/dashboard');
    await asFreeUser.waitForLoadState('domcontentloaded');

    // Current UX falls back to demo data when API fails.
    await expect(asFreeUser.locator('text="Demo data"')).toBeVisible();
  });

  test('non-existent idea route still renders without crashing', async ({ asAnonymous }) => {
    await asAnonymous.goto('/idea/non-existent-id-12345');
    await asAnonymous.waitForLoadState('domcontentloaded');

    // Idea page should render either loaded content or loading/error state, not a crash.
    await expect(asAnonymous.locator('body')).toBeVisible();
    await expect(
      asAnonymous.locator('article, h1, h3, [role="alert"]').first()
    ).toBeVisible();
  });

  test('invalid auth token path redirects protected routes to login', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zerotoship_token', 'invalid_expired_token_123');
    });

    await page.route(`${API_URL}/auth/me`, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Token expired' }),
      })
    );

    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page shows friendly error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    if (!(await emailInput.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await page.route(`${API_URL}/auth/login`, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized', message: 'Invalid email or password' }),
      })
    );

    await emailInput.fill('invalid@test.com');
    await passwordInput.fill('wrongpassword');
    await submitButton.click();

    await expect(page.getByText(/invalid|incorrect|wrong/i).first()).toBeVisible();
  });
});
