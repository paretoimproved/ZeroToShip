/**
 * Smoke tests to verify core routes and navigation are healthy
 */

import { test, expect } from '../fixtures';

test.describe('Smoke Tests', () => {
  test('landing page loads', async ({ asAnonymous }) => {
    await asAnonymous.goto('/');
    await expect(asAnonymous).toHaveTitle(/ZeroToShip/i);
    await expect(
      asAnonymous.getByRole('heading', { name: /The Internet Complains/i })
    ).toBeVisible();
  });

  test('landing main navigation is visible', async ({ asAnonymous }) => {
    await asAnonymous.goto('/');
    await expect(
      asAnonymous.getByRole('navigation', { name: 'Main navigation' })
    ).toBeVisible();
    await expect(
      asAnonymous.getByRole('link', { name: 'ZeroToShip' })
    ).toBeVisible();
  });

  test('authenticated user can load dashboard', async ({ asFreeUser, setupMocks }) => {
    await setupMocks(asFreeUser, 'free');
    await asFreeUser.goto('/dashboard');
    await expect(asFreeUser.getByRole('heading', { name: "Today's Top Ideas" })).toBeVisible();
  });

  test('authenticated app navigation links are visible', async ({ asFreeUser, setupMocks }) => {
    await setupMocks(asFreeUser, 'free');
    await asFreeUser.goto('/dashboard');

    const nav = asFreeUser.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Today' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Archive' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Account' })).toBeVisible();
  });

  test('authenticated user can navigate to archive/settings/account', async ({
    asFreeUser,
    setupMocks,
  }) => {
    await setupMocks(asFreeUser, 'free');
    await asFreeUser.goto('/dashboard');

    const nav = asFreeUser.getByRole('navigation', { name: 'Main navigation' });

    await nav.getByRole('link', { name: 'Archive' }).click();
    await expect(asFreeUser).toHaveURL('/archive');
    await expect(asFreeUser.getByRole('heading', { name: 'Idea Archive' })).toBeVisible();

    await nav.getByRole('link', { name: 'Settings' }).click();
    await expect(asFreeUser).toHaveURL('/settings');
    await expect(asFreeUser.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await nav.getByRole('link', { name: 'Account' }).click();
    await expect(asFreeUser).toHaveURL('/account');
    await expect(asFreeUser.getByRole('heading', { name: 'Account' })).toBeVisible();
  });
});
