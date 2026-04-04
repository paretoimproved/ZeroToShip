/**
 * Tier gate tests for anonymous users.
 */

import { test, expect } from '../../fixtures';

test.describe('Anonymous User - Tier Gates', () => {
  test.describe('Protected Routes', () => {
    test('navigating to /settings redirects to login', async ({ asAnonymous }) => {
      await asAnonymous.goto('/settings');
      await expect(asAnonymous).toHaveURL(/\/login/);
    });

    test('navigating to /account redirects to login', async ({ asAnonymous }) => {
      await asAnonymous.goto('/account');
      await expect(asAnonymous).toHaveURL(/\/login/);
    });
  });

  test.describe('Idea Detail Gating', () => {
    test('Solution tab shows gated content with Sign Up CTA', async ({ asAnonymous }) => {
      await asAnonymous.goto('/idea/mock-1');
      await asAnonymous.getByRole('tab', { name: 'Solution' }).click();

      const gated = asAnonymous.locator('[data-testid="gated-content"]');
      await expect(gated).toBeVisible();
      await expect(gated.getByRole('link', { name: 'Sign Up' })).toBeVisible();
    });

    test('Tech Spec tab is gated for anonymous users', async ({ asAnonymous }) => {
      await asAnonymous.goto('/idea/mock-1');
      await asAnonymous.getByRole('tab', { name: 'Tech Spec' }).click();
      await expect(asAnonymous.locator('[data-testid="gated-content"]')).toBeVisible();
    });

    test('Business tab is gated for anonymous users', async ({ asAnonymous }) => {
      await asAnonymous.goto('/idea/mock-1');
      await asAnonymous.getByRole('tab', { name: 'Business' }).click();
      await expect(asAnonymous.locator('[data-testid="gated-content"]')).toBeVisible();
    });
  });

  test.describe('Public Navigation', () => {
    test('landing nav exposes Sign In and Get Started Free', async ({ asAnonymous }) => {
      await asAnonymous.goto('/');
      const nav = asAnonymous.getByRole('navigation', { name: 'Main navigation' });
      await expect(nav.getByRole('link', { name: 'Sign In' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Get Started Free' })).toBeVisible();
    });
  });
});
