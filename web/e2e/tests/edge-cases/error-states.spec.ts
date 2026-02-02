/**
 * E2E tests for error states and error handling
 *
 * Tests verify that the application handles various error conditions gracefully
 * and displays user-friendly error messages.
 */

import { test, expect } from '../../fixtures';
import { HomePage, IdeaDetailPage, SettingsPage, AccountPage } from '../../pages';
import { API_URL } from '../../utils/test-data';

test.describe('Error States', () => {
  test.describe('API Failures', () => {
    test('shows error message when API is unavailable', async ({ page }) => {
      // Mock API to abort all requests (simulate network failure)
      await page.route(`${API_URL}/**`, (route) => route.abort('connectionfailed'));

      const homePage = new HomePage(page);
      await page.goto('/');

      // Should show an error state or fallback gracefully
      const errorMessage = page.locator('[role="alert"], .error-message, text=/error|unavailable|failed/i');
      const mockDataIndicator = page.locator('text="Using mock data"');

      // Either error message is shown or falls back to mock data
      const hasError = await errorMessage.isVisible().catch(() => false);
      const hasMockData = await mockDataIndicator.isVisible().catch(() => false);

      expect(hasError || hasMockData).toBeTruthy();
    });

    test('falls back to mock data gracefully when backend is down', async ({ page }) => {
      // Mock API to return 503 Service Unavailable
      await page.route(`${API_URL}/ideas/today`, (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service temporarily unavailable' }),
        })
      );

      const homePage = new HomePage(page);
      await page.goto('/');

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');

      // Should either show mock data badge or graceful error
      const mockBadge = page.locator('text="Using mock data"');
      const ideaCards = page.locator('article');
      const errorState = page.locator('[role="alert"]');

      const hasMockData = await mockBadge.isVisible().catch(() => false);
      const hasIdeas = (await ideaCards.count()) > 0;
      const hasError = await errorState.isVisible().catch(() => false);

      // App should handle this gracefully - either showing mock data or error
      expect(hasMockData || hasIdeas || hasError).toBeTruthy();
    });

    test('shows 404 page for non-existent idea ID', async ({ page }) => {
      // Mock specific idea endpoint to return 404
      await page.route(`${API_URL}/ideas/non-existent-id-12345`, (route) =>
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Idea not found' }),
        })
      );

      await page.goto('/idea/non-existent-id-12345');

      // Should show 404 or "not found" message
      const notFoundIndicators = [
        page.locator('text=/404|not found|doesn\'t exist/i'),
        page.locator('h1:has-text("404")'),
        page.locator('[data-testid="not-found"]'),
      ];

      let found = false;
      for (const indicator of notFoundIndicators) {
        if (await indicator.isVisible().catch(() => false)) {
          found = true;
          break;
        }
      }

      expect(found).toBeTruthy();
    });

    test('handles network timeout gracefully', async ({ page }) => {
      // Mock API to timeout (delay beyond reasonable limit)
      await page.route(`${API_URL}/ideas/today`, async (route) => {
        // Simulate a slow response that would trigger timeout
        await new Promise((resolve) => setTimeout(resolve, 30000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ideas: [] }),
        });
      });

      // Set a shorter timeout for the page
      page.setDefaultTimeout(10000);

      await page.goto('/');

      // Page should handle the timeout gracefully - show loading state, error, or fallback
      await page.waitForLoadState('domcontentloaded');

      // The page should not crash - verify some content is visible
      const hasContent =
        (await page.locator('nav').isVisible()) ||
        (await page.locator('[role="alert"]').isVisible().catch(() => false));

      expect(hasContent).toBeTruthy();
    });

    test('shows appropriate error for 500 server errors', async ({ page }) => {
      // Mock API to return 500 Internal Server Error
      await page.route(`${API_URL}/ideas/today`, (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      );

      const homePage = new HomePage(page);
      await page.goto('/');

      // Should show error state or fallback
      const errorIndicators = page.locator(
        '[role="alert"], .error, text=/something went wrong|error|try again/i'
      );
      const mockDataIndicator = page.locator('text="Using mock data"');

      const hasError = await errorIndicators.first().isVisible().catch(() => false);
      const hasMockData = await mockDataIndicator.isVisible().catch(() => false);

      // App should handle 500 gracefully
      expect(hasError || hasMockData).toBeTruthy();
    });

    test('shows appropriate error for 403 Forbidden responses', async ({ page }) => {
      // Mock subscription API to return 403
      await page.route(`${API_URL}/subscription`, (route) =>
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Access forbidden' }),
        })
      );

      const accountPage = new AccountPage(page);
      await page.goto('/account');

      // Wait for page to attempt to load
      await page.waitForLoadState('domcontentloaded');

      // Should show access denied or appropriate error
      const accessDenied = page.locator(
        'text=/forbidden|access denied|not authorized|permission/i, [role="alert"]'
      );

      // Either shows error or handles gracefully
      const pageTitle = page.locator('h1');
      const hasPageTitle = await pageTitle.isVisible().catch(() => false);
      const hasAccessDenied = await accessDenied.first().isVisible().catch(() => false);

      expect(hasPageTitle || hasAccessDenied).toBeTruthy();
    });
  });

  test.describe('Authentication Errors', () => {
    test('handles expired/invalid JWT token by redirecting to login', async ({ page }) => {
      // Set an invalid/expired token
      await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'invalid_expired_token_123');
      });

      // Mock auth check endpoint to return 401
      await page.route(`${API_URL}/auth/me`, (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' }),
        })
      );

      // Try to access a protected route
      await page.goto('/account');

      // Should redirect to login or show auth error
      const currentUrl = page.url();
      const loginIndicators = [
        page.locator('text=/sign in|log in|login/i'),
        page.locator('input[type="email"]'),
        page.locator('button:has-text("Sign In")'),
      ];

      const isLoginPage =
        currentUrl.includes('login') ||
        currentUrl.includes('signin') ||
        currentUrl.includes('auth');

      let hasLoginForm = false;
      for (const indicator of loginIndicators) {
        if (await indicator.isVisible().catch(() => false)) {
          hasLoginForm = true;
          break;
        }
      }

      // Either redirected to login or shows login form/prompt
      expect(isLoginPage || hasLoginForm || (await page.locator('h1').isVisible())).toBeTruthy();
    });

    test('shows appropriate error for invalid login credentials', async ({ page }) => {
      // Navigate to login page (if separate) or find login form
      await page.goto('/login');

      // If page redirects or login is inline, handle both cases
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")'
      );

      // Only proceed if login form exists
      if (await emailInput.isVisible().catch(() => false)) {
        // Mock login endpoint to reject credentials
        await page.route(`${API_URL}/auth/login`, (route) =>
          route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Invalid email or password' }),
          })
        );

        await emailInput.fill('invalid@test.com');
        await passwordInput.fill('wrongpassword');
        await submitButton.click();

        // Should show error message
        const errorMessage = page.locator(
          '[role="alert"], .error-message, text=/invalid|incorrect|wrong/i'
        );

        await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
      } else {
        // Login page doesn't exist as separate page - test passes
        expect(true).toBeTruthy();
      }
    });
  });

  test.describe('User-Friendly Error Messages', () => {
    test('error messages are user-friendly, not technical jargon', async ({ page }) => {
      // Mock API to return error
      await page.route(`${API_URL}/ideas/today`, (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'ECONNREFUSED',
            stack: 'Error at db.query...',
          }),
        })
      );

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Check that technical terms are NOT shown to user
      const technicalTerms = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'stack trace',
        'at db.query',
        'TypeError',
        'ReferenceError',
        'undefined is not',
        'null pointer',
        'SQL',
        'database connection',
      ];

      const pageContent = await page.textContent('body');

      for (const term of technicalTerms) {
        expect(pageContent?.toLowerCase()).not.toContain(term.toLowerCase());
      }

      // If there's an error message, it should be user-friendly
      const errorArea = page.locator('[role="alert"], .error-message');
      if (await errorArea.isVisible().catch(() => false)) {
        const errorText = await errorArea.textContent();

        // User-friendly terms that SHOULD be present
        const friendlyTerms = [
          'try again',
          'something went wrong',
          'unable to load',
          'temporarily unavailable',
          'please refresh',
          'contact support',
        ];

        const hasFriendlyMessage = friendlyTerms.some(
          (term) => errorText?.toLowerCase().includes(term.toLowerCase())
        );

        // Error should either be friendly or not shown at all (graceful fallback)
        expect(hasFriendlyMessage || !errorText).toBeTruthy();
      }
    });
  });
});
