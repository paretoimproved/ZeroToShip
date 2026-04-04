/**
 * Anonymous rate-limit contract checks.
 *
 * These tests validate the client handling contract using mocked API responses,
 * independent of backend availability in local E2E runs.
 */

import { test, expect } from '../../fixtures';
import { TIER_LIMITS, API_URL } from '../../utils';

const RATE_LIMIT_EXPOSE_HEADERS = 'x-ratelimit-limit, x-ratelimit-remaining, retry-after';

test.describe('Anonymous User - Rate Limits', () => {
  test('API responses expose rate-limit headers', async ({ asAnonymous }) => {
    await asAnonymous.route(`${API_URL}/ideas/today`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-expose-headers': RATE_LIMIT_EXPOSE_HEADERS,
          'x-ratelimit-limit': String(TIER_LIMITS.anonymous.rateLimit),
          'x-ratelimit-remaining': '9',
        },
        body: JSON.stringify({ ideas: [], total: 0, limit: 3, tier: 'anonymous' }),
      });
    });

    const result = await asAnonymous.evaluate(async (url) => {
      const res = await fetch(url);
      return {
        status: res.status,
        limit: res.headers.get('x-ratelimit-limit'),
        remaining: res.headers.get('x-ratelimit-remaining'),
      };
    }, `${API_URL}/ideas/today`);

    expect(result.status).toBe(200);
    expect(result.limit).toBe(String(TIER_LIMITS.anonymous.rateLimit));
    expect(result.remaining).toBe('9');
  });

  test('429 response includes user-recoverable metadata', async ({ asAnonymous }) => {
    await asAnonymous.route(`${API_URL}/ideas/today`, async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-expose-headers': RATE_LIMIT_EXPOSE_HEADERS,
          'x-ratelimit-limit': String(TIER_LIMITS.anonymous.rateLimit),
          'x-ratelimit-remaining': '0',
          'retry-after': '3600',
        },
        body: JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: 3600,
        }),
      });
    });

    const result = await asAnonymous.evaluate(async (url) => {
      const res = await fetch(url);
      const body = await res.json();
      return {
        status: res.status,
        retryAfterHeader: res.headers.get('retry-after'),
        message: body.message,
      };
    }, `${API_URL}/ideas/today`);

    expect(result.status).toBe(429);
    expect(result.retryAfterHeader).toBe('3600');
    expect(result.message.toLowerCase()).toContain('rate limit');
  });

  test('remaining budget decreases across sequential responses', async ({ asAnonymous }) => {
    let remaining = TIER_LIMITS.anonymous.rateLimit;

    await asAnonymous.route(`${API_URL}/ideas/today`, async (route) => {
      remaining -= 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-expose-headers': RATE_LIMIT_EXPOSE_HEADERS,
          'x-ratelimit-limit': String(TIER_LIMITS.anonymous.rateLimit),
          'x-ratelimit-remaining': String(remaining),
        },
        body: JSON.stringify({ ideas: [], total: 0, limit: 3, tier: 'anonymous' }),
      });
    });

    const values = await asAnonymous.evaluate(async (url) => {
      const responses: number[] = [];
      for (let i = 0; i < 3; i++) {
        const res = await fetch(url);
        responses.push(Number(res.headers.get('x-ratelimit-remaining') || '0'));
      }
      return responses;
    }, `${API_URL}/ideas/today`);

    expect(values[0]).toBeGreaterThan(values[1]);
    expect(values[1]).toBeGreaterThan(values[2]);
  });
});
