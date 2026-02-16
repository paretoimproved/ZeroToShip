/**
 * Public access tests for anonymous visitors.
 *
 * Current product behavior:
 * - `/` is a public marketing landing page.
 * - `/explore` is publicly accessible.
 * - `/idea/:id` is publicly accessible with gated tabs.
 */

import { test, expect } from '../../fixtures';

test.describe('Anonymous User - Public Access', () => {
  test('landing page loads without authentication', async ({ asAnonymous }) => {
    await asAnonymous.goto('/');
    await expect(asAnonymous).toHaveTitle(/ZeroToShip/i);
    await expect(
      asAnonymous.getByRole('heading', { name: /The Internet Complains/i })
    ).toBeVisible();
  });

  test('explore page is publicly accessible', async ({ asAnonymous }) => {
    await asAnonymous.goto('/explore');
    await expect(
      asAnonymous.getByRole('heading', { name: /Startup Ideas Worth Building/i })
    ).toBeVisible();

    const cards = asAnonymous.locator('article');
    const emptyState = asAnonymous.locator('text=/No ideas available right now/i');
    const hasCards = (await cards.count()) > 0;
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    expect(hasCards || hasEmptyState).toBeTruthy();
  });

  test('idea detail shows basic info and gated tabs for anonymous users', async ({
    asAnonymous,
  }) => {
    await asAnonymous.goto('/idea/mock-1');

    await expect(asAnonymous.locator('article h3.font-mono').first()).toBeVisible();
    await expect(asAnonymous.locator('article p').first()).toBeVisible();

    await asAnonymous.getByRole('tab', { name: 'Solution' }).click();
    const gatedContent = asAnonymous.locator('[data-testid="gated-content"]');
    await expect(gatedContent).toBeVisible();
    await expect(gatedContent.getByRole('link', { name: 'Sign Up' })).toBeVisible();
  });
});
