/**
 * Anonymous Visitor Journey
 *
 * End-to-end journey simulating a first-time anonymous visitor exploring
 * ZeroToShip: landing on the homepage, browsing tier-limited ideas,
 * viewing a gated idea detail page, hitting auth gates on protected
 * routes, and discovering the landing/pricing page.
 */

import { test, expect } from '../../fixtures';
import { HomePage } from '../../pages/home.page';
import { IdeaDetailPage } from '../../pages/idea-detail.page';
import { TIER_LIMITS } from '../../utils/test-data';
import { annotate, journeyPause } from '../../utils/journey-helpers';

test.describe('Journey: Anonymous Visitor', () => {
  test.slow();

  test('complete anonymous visitor journey', async ({ asAnonymous, setupMocks }) => {
    const page = asAnonymous;
    await setupMocks(page, 'anonymous');
    const homePage = new HomePage(page);

    // ---------------------------------------------------------------
    // Step 1: Land on homepage
    // ---------------------------------------------------------------
    await test.step('Step 1: Land on homepage', async () => {
      await annotate(page, 'Step 1: Land on homepage');

      await homePage.goto();

      await expect(page).toHaveTitle(/ZeroToShip/i);
      await expect(homePage.heading).toBeVisible();
      await expect(homePage.dateDisplay).toBeVisible();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 2: Browse ideas (3-idea limit)
    // ---------------------------------------------------------------
    await test.step('Step 2: Browse ideas (3-idea limit)', async () => {
      await annotate(page, 'Step 2: Browse ideas (3-idea limit)');

      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBe(TIER_LIMITS.anonymous.ideasVisible);

      for (let i = 0; i < ideaCount; i++) {
        const name = await homePage.getIdeaName(i);
        expect(name.trim().length).toBeGreaterThan(0);

        const score = await homePage.getIdeaScore(i);
        expect(score.trim().length).toBeGreaterThan(0);
      }

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 3: Click idea detail (gated content)
    // ---------------------------------------------------------------
    await test.step('Step 3: Click idea detail (gated content)', async () => {
      await annotate(page, 'Step 3: Click idea detail (gated content)');

      await homePage.clickIdeaCard(0);

      const detailPage = new IdeaDetailPage(page);

      await expect(detailPage.ideaName).toBeVisible();
      await expect(detailPage.scoreBadge).toBeVisible();

      // Check for upgrade/login prompts or gated content indicators
      const upgradePrompt = page.locator(
        'text=/upgrade|sign up|login to view|unlock|premium/i',
      );
      const gatedContent = page.locator('[data-testid="gated-content"]');

      const hasUpgradePrompt = (await upgradePrompt.count()) > 0;
      const hasGatedContent = (await gatedContent.count()) > 0;

      // At least one gating mechanism should be present for anonymous users
      expect(hasUpgradePrompt || hasGatedContent).toBeTruthy();

      await detailPage.goBack();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 4: Try /settings (auth gate)
    // ---------------------------------------------------------------
    await test.step('Step 4: Try /settings (auth gate)', async () => {
      await annotate(page, 'Step 4: Try /settings (auth gate)', {
        color: '#dc2626',
      });

      await page.goto('/settings');

      const currentUrl = page.url();
      const isRedirected =
        currentUrl.includes('/login') ||
        currentUrl.includes('/auth') ||
        currentUrl.includes('/signin');

      const authPrompt = page.locator(
        'text=/sign in|log in|create account|sign up to access/i',
      );
      const hasAuthPrompt = (await authPrompt.count()) > 0;

      expect(isRedirected || hasAuthPrompt).toBeTruthy();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 5: Try /account (auth gate)
    // ---------------------------------------------------------------
    await test.step('Step 5: Try /account (auth gate)', async () => {
      await annotate(page, 'Step 5: Try /account (auth gate)', {
        color: '#dc2626',
      });

      await page.goto('/account');

      const currentUrl = page.url();
      const isRedirected =
        currentUrl.includes('/login') ||
        currentUrl.includes('/auth') ||
        currentUrl.includes('/signin');

      const authPrompt = page.locator(
        'text=/sign in|log in|create account|sign up to access/i',
      );
      const hasAuthPrompt = (await authPrompt.count()) > 0;

      expect(isRedirected || hasAuthPrompt).toBeTruthy();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 6: Visit /landing (pricing + CTA)
    // ---------------------------------------------------------------
    await test.step('Step 6: Visit /landing (pricing + CTA)', async () => {
      await annotate(page, 'Step 6: Visit /landing (pricing + CTA)');

      await page.goto('/landing');

      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();

      const pageHeading = page.locator('h1');
      await expect(pageHeading).toBeVisible();

      // Look for "Get Started" or "Sign Up" CTA buttons
      const ctaButtons = page.locator(
        'a:has-text("Get Started"), a:has-text("Sign Up"), ' +
        'button:has-text("Get Started"), button:has-text("Sign Up")',
      );
      const ctaCount = await ctaButtons.count();
      expect(ctaCount).toBeGreaterThan(0);

      await journeyPause(page);
    });
  });
});
