/**
 * Anonymous Visitor Journey
 *
 * Validates current anonymous flow:
 * landing -> explore -> idea detail (gated tabs) -> protected route guards.
 */

import { test, expect } from '../../fixtures';
import { annotate, journeyPause } from '../../utils/journey-helpers';

test.describe('Journey: Anonymous Visitor', () => {
  test.slow();

  test('complete anonymous visitor journey', async ({ asAnonymous }) => {
    const page = asAnonymous;

    await test.step('Step 1: Landing page experience', async () => {
      await annotate(page, 'Step 1: Landing page');

      await page.goto('/');
      await expect(page).toHaveTitle(/ZeroToShip/i);
      await expect(
        page.getByRole('heading', { name: /The Internet Complains/i })
      ).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: 'Main navigation' })
      ).toBeVisible();

      await journeyPause(page);
    });

    await test.step('Step 2: Explore page discovery', async () => {
      await annotate(page, 'Step 2: Explore page');

      await page.goto('/explore');
      await expect(page.getByRole('heading', { name: /Startup Ideas Worth Building/i })).toBeVisible();

      const cards = page.locator('article');
      const emptyState = page.locator('text=/No ideas available right now/i');
      const hasCards = (await cards.count()) > 0;
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      expect(hasCards || hasEmptyState).toBeTruthy();

      await journeyPause(page);
    });

    await test.step('Step 3: Idea detail has gated sections', async () => {
      await annotate(page, 'Step 3: Idea detail gating');

      await page.goto('/idea/mock-1');
      await expect(page.locator('article h3.font-mono').first()).toBeVisible();

      await page.getByRole('tab', { name: 'Solution' }).click();
      const gatedContent = page.locator('[data-testid="gated-content"]');
      await expect(gatedContent).toBeVisible();
      await expect(gatedContent.getByRole('link', { name: 'Sign Up' })).toBeVisible();

      await journeyPause(page);
    });

    await test.step('Step 4: Protected routes redirect to login', async () => {
      await annotate(page, 'Step 4: Protected route guards', { color: '#dc2626' });

      await page.goto('/settings');
      await expect(page).toHaveURL(/\/login/);

      await page.goto('/account');
      await expect(page).toHaveURL(/\/login/);

      await journeyPause(page);
    });
  });
});
