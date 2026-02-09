import { test, expect } from '@playwright/test';

test.describe('Landing Page — FAQ Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#faq').scrollIntoViewIfNeeded();
  });

  test('should display FAQ heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Frequently Asked Questions' }),
    ).toBeVisible();
  });

  test('should display all 8 FAQ questions', async ({ page }) => {
    const details = page.locator('#faq details');
    await expect(details).toHaveCount(8);
  });

  test('all FAQ items should be collapsed initially', async ({ page }) => {
    const openDetails = page.locator('#faq details[open]');
    await expect(openDetails).toHaveCount(0);
  });

  test('clicking a question should expand its answer', async ({ page }) => {
    const firstQuestion = page.locator('#faq details').first();
    await firstQuestion.locator('summary').click();
    await expect(firstQuestion).toHaveAttribute('open', '');
  });

  test('clicking again should collapse the answer', async ({ page }) => {
    const firstQuestion = page.locator('#faq details').first();
    await firstQuestion.locator('summary').click();
    await expect(firstQuestion).toHaveAttribute('open', '');
    await firstQuestion.locator('summary').click();
    await expect(firstQuestion).not.toHaveAttribute('open', '');
  });

  test('should display the browsing comparison question', async ({ page }) => {
    await expect(
      page.getByText('How is this different from browsing Reddit/HN myself?'),
    ).toBeVisible();
  });

  test('should display the sources question', async ({ page }) => {
    await expect(page.getByText('What sources do you scrape?')).toBeVisible();
  });

  test('should display the full brief question', async ({ page }) => {
    await expect(
      page.getByText("What's included in the full brief?"),
    ).toBeVisible();
  });

  test('full brief answer mentions key contents', async ({ page }) => {
    const briefQuestion = page.locator('#faq details', {
      hasText: "What's included in the full brief?",
    });
    await briefQuestion.locator('summary').click();
    await expect(briefQuestion.getByText('Problem statement')).toBeVisible();
    await expect(briefQuestion.getByText('go-to-market')).toBeVisible();
  });

  test('should show refund policy question', async ({ page }) => {
    await expect(
      page.getByText('Is there a refund policy?'),
    ).toBeVisible();
  });
});
