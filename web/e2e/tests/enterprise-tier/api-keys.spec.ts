/**
 * Enterprise API key UI contract tests.
 *
 * These tests cover the currently shipped account-page API key flow.
 */

import { test, expect } from '../../fixtures';

test.describe('Enterprise Tier - API Key Management', () => {
  test('API keys section is visible with either list or empty state', async ({ asEnterpriseUser }) => {
    await asEnterpriseUser.goto('/account');
    await asEnterpriseUser.waitForLoadState('domcontentloaded');

    const section = asEnterpriseUser.locator('[data-testid="api-keys-section"]');
    await expect(section).toBeVisible();

    const list = asEnterpriseUser.locator('[data-testid="api-key-list"]');
    const emptyState = asEnterpriseUser.getByText(/no api keys|create your first/i);
    const hasList = await list.isVisible().catch(() => false);
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);

    expect(hasList || hasEmpty).toBeTruthy();
  });

  test('create button opens dialog with editable name field', async ({ asEnterpriseUser }) => {
    await asEnterpriseUser.goto('/account');

    const createButton = asEnterpriseUser.getByRole('button', { name: /create api key/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    const dialog = asEnterpriseUser.locator('[data-testid="api-key-dialog"]');
    await expect(dialog).toBeVisible();

    const nameInput = dialog.locator('input[name="name"]').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Enterprise Integration Key');
    await expect(nameInput).toHaveValue('Enterprise Integration Key');
  });

  test('dialog can be cancelled and closes cleanly', async ({ asEnterpriseUser }) => {
    await asEnterpriseUser.goto('/account');

    await asEnterpriseUser.getByRole('button', { name: /create api key/i }).click();
    const dialog = asEnterpriseUser.locator('[data-testid="api-key-dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
  });

  test('successful create request closes dialog and keeps page stable', async ({ asEnterpriseUser }) => {
    await asEnterpriseUser.route('**/user/api-keys', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          key: 'sk_test_enterprise_123',
        }),
      });
    });

    await asEnterpriseUser.goto('/account');
    await asEnterpriseUser.getByRole('button', { name: /create api key/i }).click();

    const dialog = asEnterpriseUser.locator('[data-testid="api-key-dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.locator('input[name="name"]').fill('E2E Created Key');

    const alertPromise = asEnterpriseUser.waitForEvent('dialog');
    await dialog.getByRole('button', { name: /^create$/i }).click();
    const alert = await alertPromise;
    await alert.dismiss();

    await expect(dialog).toBeHidden();
    await expect(asEnterpriseUser.getByRole('heading', { name: 'Account' })).toBeVisible();
  });
});

