/**
 * Public Access Tests for Anonymous Users
 *
 * Tests that anonymous users can access public pages and see the correct
 * tier-limited content without authentication.
 */

import { test, expect } from '../../fixtures';
import { HomePage, IdeaDetailPage } from '../../pages';
import { TIER_LIMITS } from '../../utils';

test.describe('Anonymous User - Public Access', () => {
  test.describe('Homepage', () => {
    test('homepage loads without authentication', async ({ asAnonymous, setupMocks }) => {
      await setupMocks(asAnonymous, 'anonymous');
      const homePage = new HomePage(asAnonymous);

      await homePage.goto();

      await expect(asAnonymous).toHaveTitle(/ZeroToShip/i);
      await expect(homePage.heading).toBeVisible();
    });

    test('homepage shows exactly 3 ideas (anonymous tier limit)', async ({
      asAnonymous,
      setupMocks,
      tierLimits,
    }) => {
      await setupMocks(asAnonymous, 'anonymous');
      const homePage = new HomePage(asAnonymous);

      await homePage.goto();

      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBe(tierLimits.anonymous.ideasVisible);
      expect(ideaCount).toBe(TIER_LIMITS.anonymous.ideasVisible);
    });

    test('each idea card shows name, tagline, score badge, and effort badge', async ({
      asAnonymous,
      setupMocks,
    }) => {
      await setupMocks(asAnonymous, 'anonymous');
      const homePage = new HomePage(asAnonymous);

      await homePage.goto();

      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBeGreaterThan(0);

      // Check each visible idea card has required elements
      for (let i = 0; i < ideaCount; i++) {
        const card = homePage.getIdeaCard(i);

        // Name (h3.font-mono element in tabbed card)
        const nameElement = card.locator('h3.font-mono');
        await expect(nameElement).toBeVisible();
        const name = await nameElement.textContent();
        expect(name).toBeTruthy();

        // Tagline (italic paragraph)
        const taglineElement = card.locator('p.italic');
        await expect(taglineElement).toBeVisible();

        // Score badge (colored background)
        const scoreBadge = card.locator(
          '[class*="bg-green-"], [class*="bg-yellow-"], [class*="bg-red-"]'
        ).first();
        await expect(scoreBadge).toBeVisible();

        // Effort badge (weekend/week/month/quarter text)
        const effortBadge = card.locator('text=/weekend|week|month|quarter/i');
        await expect(effortBadge).toBeVisible();
      }
    });

    test('idea cards have tabbed interface for inline browsing', async ({
      asAnonymous,
      setupMocks,
    }) => {
      await setupMocks(asAnonymous, 'anonymous');
      const homePage = new HomePage(asAnonymous);

      await homePage.goto();
      await homePage.verifyIdeaCardsDisplayed(1);

      // Default tab should be Problem
      const activeTab = await homePage.getActiveTabName(0);
      expect(activeTab).toBe('Problem');

      // Can switch tabs
      await homePage.switchTab(0, 'Solution');
      const newTab = await homePage.getActiveTabName(0);
      expect(newTab).toBe('Solution');
    });
  });

  test.describe('Idea Detail Page', () => {
    test('idea detail page shows basic info (name, tagline, score, effort)', async ({
      asAnonymous,
      setupMocks,
    }) => {
      await setupMocks(asAnonymous, 'anonymous');

      // Navigate directly to detail page
      const detailPage = new IdeaDetailPage(asAnonymous);
      await detailPage.goto('mock-1');

      // Verify basic info is visible
      await expect(detailPage.ideaName).toBeVisible();
      const name = await detailPage.getName();
      expect(name.length).toBeGreaterThan(0);

      await expect(detailPage.tagline).toBeVisible();
      const tagline = await detailPage.getTagline();
      expect(tagline.length).toBeGreaterThan(0);

      await expect(detailPage.scoreBadge).toBeVisible();
      const score = await detailPage.getScore();
      expect(score.length).toBeGreaterThan(0);

      await expect(detailPage.effortBadge).toBeVisible();
      const effort = await detailPage.getEffort();
      expect(effort).toMatch(/weekend|week|month|quarter/i);
    });

    test('gated tabs show locked content for anonymous users', async ({
      asAnonymous,
      setupMocks,
    }) => {
      await setupMocks(asAnonymous, 'anonymous');

      const homePage = new HomePage(asAnonymous);
      await homePage.goto();
      await homePage.verifyIdeaCardsDisplayed(1);

      // Switch to a gated tab
      await homePage.switchTab(0, 'Solution');

      // Check for gated content indicator
      const gatedSection = asAnonymous.locator('[data-testid="gated-content"]');
      await expect(gatedSection).toBeVisible();

      // Sign up CTA should be visible
      const signUpCta = gatedSection.locator('a:has-text("Sign Up")');
      await expect(signUpCta).toBeVisible();
    });
  });

  test.describe('Landing Page', () => {
    test('landing page loads correctly', async ({ asAnonymous }) => {
      await asAnonymous.goto('/landing');

      await expect(asAnonymous).toHaveURL('/landing');

      // Landing page should have some content
      const mainContent = asAnonymous.locator('main');
      await expect(mainContent).toBeVisible();

      // Should have CTA or sign up options
      const ctaButtons = asAnonymous.locator(
        'a:has-text("Get Started"), a:has-text("Sign Up"), button:has-text("Get Started"), button:has-text("Sign Up")'
      );
      const hasCtaButtons = await ctaButtons.count() > 0;

      // Landing page should have marketing content or redirect to home
      const pageTitle = asAnonymous.locator('h1');
      await expect(pageTitle).toBeVisible();
    });
  });
});
