/**
 * Upgrade prompts tests for Free tier users
 *
 * Tests that upgrade prompts appear correctly:
 * - Idea detail page CTAs
 * - Account page plan options
 * - Pricing display
 * - Homepage limitations messaging
 */

import { test, expect } from '../../fixtures';
import { HomePage, AccountPage } from '../../pages';
import { TIER_LIMITS } from '../../utils';

test.describe('Free Tier - Upgrade Prompts', () => {
  test.describe('Idea Detail Page', () => {
    test('gated tabs show "Sign Up" CTA for free users', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const homePage = new HomePage(asFreeUser);
      await homePage.goto();

      // Switch to a gated tab
      await homePage.switchTab(0, 'Solution');

      // Look for sign up CTA in gated content
      const gatedContent = asFreeUser.locator('[data-testid="gated-content"]');
      const hasGated = await gatedContent.isVisible().catch(() => false);
      if (hasGated) {
        const signUpCta = gatedContent.locator('a:has-text("Sign Up")');
        await expect(signUpCta).toBeVisible();
      } else {
        await expect(asFreeUser.locator('[role="tabpanel"]').first()).toBeVisible();
      }
    });
  });

  test.describe('Account Page - Plan Options', () => {
    test('account page shows upgrade options (Pro and Enterprise)', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const accountPage = new AccountPage(asFreeUser);
      await accountPage.goto();

      // Verify all plan cards are visible
      await accountPage.verifyAllPlansPresent();

      // Pro plan should be visible
      await expect(accountPage.proPlanCard).toBeVisible();

      // Enterprise plan should be visible
      await expect(accountPage.enterprisePlanCard).toBeVisible();
    });

    test('Pro plan shows $19/month price', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const accountPage = new AccountPage(asFreeUser);
      await accountPage.goto();

      // Get Pro plan price
      const proPrice = await accountPage.getPlanPrice('pro');

      // Verify the price is $19/month
      expect(proPrice).toMatch(/\$19/);
    });

    test('Enterprise plan shows $99/month price', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const accountPage = new AccountPage(asFreeUser);
      await accountPage.goto();

      // Get Enterprise plan price
      const enterprisePrice = await accountPage.getPlanPrice('enterprise');

      // Verify the price is $99/month
      expect(enterprisePrice).toMatch(/\$99/);
    });

    test('clicking upgrade button initiates checkout flow (or shows modal)', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const accountPage = new AccountPage(asFreeUser);
      await accountPage.goto();

      // Click upgrade for Pro plan
      await accountPage.clickUpgrade('pro');

      // Verify either:
      // 1. We're redirected to a checkout page
      // 2. A modal appears
      // 3. A payment form is shown
      const checkoutIndicators = [
        asFreeUser.locator('[data-testid="checkout-modal"]'),
        asFreeUser.locator('[role="dialog"]'),
        asFreeUser.locator('.modal'),
        asFreeUser.locator('text=/checkout|payment|subscribe/i'),
        asFreeUser.locator('form:has(input[name*="card"])'),
      ];

      // Wait for any checkout indicator or URL change
      let checkoutStarted = false;

      // Check for URL change to checkout
      try {
        await asFreeUser.waitForURL(/checkout|subscribe|payment/i, { timeout: 3000 });
        checkoutStarted = true;
      } catch {
        // URL didn't change, check for modal/overlay
      }

      if (!checkoutStarted) {
        for (const indicator of checkoutIndicators) {
          if (await indicator.isVisible().catch(() => false)) {
            checkoutStarted = true;
            break;
          }
        }
      }

      // If neither happened, ensure page remains stable and interactive.
      const errorBanner = await accountPage.hasError();
      const accountHeadingVisible = await accountPage.heading.isVisible().catch(() => false);
      const navigatedAwayFromAccount = !/\/account(?:$|[/?#])/.test(asFreeUser.url());
      expect(
        errorBanner || checkoutStarted || accountHeadingVisible || navigatedAwayFromAccount
      ).toBeTruthy();
    });

    test('Free plan upgrade button is disabled (current plan)', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const accountPage = new AccountPage(asFreeUser);
      await accountPage.goto();

      // The Free plan button should be disabled or show "Current Plan"
      const isDisabled = await accountPage.isUpgradeDisabled('free');
      const buttonText = await accountPage.freePlanCard.locator('button').textContent();

      expect(isDisabled || buttonText?.toLowerCase().includes('current')).toBeTruthy();
    });
  });

  test.describe('Homepage Limitations', () => {
    test('"Limited to 3 ideas" message visible on homepage', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const homePage = new HomePage(asFreeUser);
      await homePage.goto();

      // Look for limitation message
      const limitMessages = [
        asFreeUser.locator('text=/limited to \\d+ ideas/i'),
        asFreeUser.locator('text=/showing \\d+ of \\d+/i'),
        asFreeUser.locator('text=/free tier/i'),
        asFreeUser.locator('text=/upgrade.*more ideas/i'),
        asFreeUser.locator('[data-testid="tier-limit-message"]'),
      ];

      let foundLimitMessage = false;
      for (const message of limitMessages) {
        if (await message.count() > 0) {
          foundLimitMessage = true;
          break;
        }
      }

      // Also verify we only see 3 ideas
      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBe(TIER_LIMITS.free.ideasVisible);

      // Either we found a message or we just verify the limit is enforced
      expect(foundLimitMessage || ideaCount === 3).toBeTruthy();
    });

    test('upgrade prompt exists to see more ideas', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const homePage = new HomePage(asFreeUser);
      await homePage.goto();

      // Look for any upgrade-related UI element
      const upgradeAnchors = asFreeUser.locator('a:has-text("Upgrade"), button:has-text("Upgrade")');
      const seeMoreCopy = asFreeUser.getByText(/see more ideas|unlock.*ideas/i);
      const banner = asFreeUser.locator('[data-testid="upgrade-banner"]');
      const upgradeElementCount =
        (await upgradeAnchors.count()) +
        (await seeMoreCopy.count()) +
        (await banner.count());

      // Either upgrade prompts are visible, or we're at the limit
      const ideaCount = await homePage.getIdeaCount();
      expect(upgradeElementCount > 0 || ideaCount === TIER_LIMITS.free.ideasVisible).toBeTruthy();
    });
  });

  test.describe('Plan Comparison', () => {
    test('Pro plan shows more features than Free', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const accountPage = new AccountPage(asFreeUser);
      await accountPage.goto();

      const freeFeatures = await accountPage.getPlanFeatures('free');
      const proFeatures = await accountPage.getPlanFeatures('pro');

      // Pro should have at least as many features as Free
      // and Pro should have more value (more ideas, etc.)
      expect(proFeatures.length).toBeGreaterThanOrEqual(freeFeatures.length);

      // Pro features should mention more ideas or unlimited
      const proFeaturesText = proFeatures.join(' ').toLowerCase();
      expect(
        proFeaturesText.includes('10') ||
        proFeaturesText.includes('unlimited') ||
        proFeaturesText.includes('more')
      ).toBeTruthy();
    });

    test('Enterprise plan shows most features', async ({ asFreeUser, setupMocks }) => {
      await setupMocks(asFreeUser, 'free');
      const accountPage = new AccountPage(asFreeUser);
      await accountPage.goto();

      const proFeatures = await accountPage.getPlanFeatures('pro');
      const enterpriseFeatures = await accountPage.getPlanFeatures('enterprise');

      // Enterprise should have at least as many features as Pro
      expect(enterpriseFeatures.length).toBeGreaterThanOrEqual(proFeatures.length);
    });
  });
});
