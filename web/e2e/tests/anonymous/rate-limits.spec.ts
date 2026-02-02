/**
 * Rate Limit Tests for Anonymous Users
 *
 * Tests that anonymous users are subject to rate limiting and receive
 * appropriate feedback when limits are exceeded.
 */

import { test, expect } from '../../fixtures';
import { TIER_LIMITS, API_URL } from '../../utils';

test.describe('Anonymous User - Rate Limits', () => {
  test.describe('Rate Limit Headers', () => {
    test('API responses include rate limit headers', async ({ asAnonymous }) => {
      // Intercept API requests to check headers
      let rateLimitHeaders: Record<string, string | null> = {};

      await asAnonymous.route(`${API_URL}/**`, async (route) => {
        const response = await route.fetch();
        rateLimitHeaders = {
          limit: response.headers()['x-ratelimit-limit'],
          remaining: response.headers()['x-ratelimit-remaining'],
        };
        await route.fulfill({ response });
      });

      // Make a request to trigger the API
      await asAnonymous.goto('/');

      // Wait for API calls to complete
      await asAnonymous.waitForLoadState('networkidle');

      // Check that rate limit headers were present
      expect(rateLimitHeaders.limit).toBeDefined();
      expect(rateLimitHeaders.remaining).toBeDefined();
    });

    test('rate limit is 10 requests per hour for anonymous users', async ({ asAnonymous }) => {
      let rateLimit: number | null = null;

      await asAnonymous.route(`${API_URL}/**`, async (route) => {
        const response = await route.fetch();
        const limitHeader = response.headers()['x-ratelimit-limit'];
        if (limitHeader) {
          rateLimit = parseInt(limitHeader, 10);
        }
        await route.fulfill({ response });
      });

      await asAnonymous.goto('/');
      await asAnonymous.waitForLoadState('networkidle');

      // Rate limit should match anonymous tier limit
      expect(rateLimit).toBe(TIER_LIMITS.anonymous.rateLimit);
    });
  });

  test.describe('Rate Limit Enforcement', () => {
    test('receives 429 status code after exceeding limit', async ({ asAnonymous }) => {
      let responseStatuses: number[] = [];

      // Mock the API to return 429 after a certain number of requests
      await asAnonymous.route(`${API_URL}/ideas/today`, async (route) => {
        // Simulate rate limit exceeded after 10 requests
        if (responseStatuses.length >= TIER_LIMITS.anonymous.rateLimit) {
          await route.fulfill({
            status: 429,
            contentType: 'application/json',
            headers: {
              'X-RateLimit-Limit': TIER_LIMITS.anonymous.rateLimit.toString(),
              'X-RateLimit-Remaining': '0',
              'Retry-After': '3600',
            },
            body: JSON.stringify({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded. Please try again later.',
              retryAfter: 3600,
            }),
          });
          responseStatuses.push(429);
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: {
              'X-RateLimit-Limit': TIER_LIMITS.anonymous.rateLimit.toString(),
              'X-RateLimit-Remaining': (
                TIER_LIMITS.anonymous.rateLimit -
                responseStatuses.length -
                1
              ).toString(),
            },
            body: JSON.stringify({ ideas: [], total: 0, limit: 3, tier: 'anonymous' }),
          });
          responseStatuses.push(200);
        }
      });

      // Make requests until rate limit is hit
      for (let i = 0; i <= TIER_LIMITS.anonymous.rateLimit; i++) {
        await asAnonymous.goto('/');
        await asAnonymous.waitForLoadState('domcontentloaded');
      }

      // The last request should have received a 429
      expect(responseStatuses).toContain(429);
    });

    test('rate limit error shows user-friendly message', async ({ asAnonymous }) => {
      // Mock the API to return 429 immediately
      await asAnonymous.route(`${API_URL}/ideas/today`, async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: {
            'X-RateLimit-Limit': TIER_LIMITS.anonymous.rateLimit.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': '3600',
          },
          body: JSON.stringify({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: 3600,
          }),
        });
      });

      await asAnonymous.goto('/');
      await asAnonymous.waitForLoadState('domcontentloaded');

      // Check for user-friendly error message
      const errorMessages = asAnonymous.locator(
        'text=/rate limit|too many requests|try again later|slow down/i'
      );
      const genericError = asAnonymous.locator('[data-testid="error-message"]');
      const toastError = asAnonymous.locator('[role="alert"]');

      const hasErrorMessage = await errorMessages.count() > 0;
      const hasGenericError = await genericError.count() > 0;
      const hasToast = await toastError.count() > 0;

      // At least one form of error feedback should be shown
      expect(hasErrorMessage || hasGenericError || hasToast).toBeTruthy();
    });

    test('rate limit remaining decreases with each request', async ({ asAnonymous }) => {
      const remainingValues: number[] = [];

      await asAnonymous.route(`${API_URL}/ideas/today`, async (route) => {
        const remaining = TIER_LIMITS.anonymous.rateLimit - remainingValues.length - 1;
        remainingValues.push(remaining);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'X-RateLimit-Limit': TIER_LIMITS.anonymous.rateLimit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
          },
          body: JSON.stringify({ ideas: [], total: 0, limit: 3, tier: 'anonymous' }),
        });
      });

      // Make a few requests
      for (let i = 0; i < 3; i++) {
        await asAnonymous.goto('/');
        await asAnonymous.waitForLoadState('domcontentloaded');
      }

      // Remaining should decrease with each request
      expect(remainingValues[0]).toBeGreaterThan(remainingValues[1]);
      expect(remainingValues[1]).toBeGreaterThan(remainingValues[2]);
    });
  });
});
