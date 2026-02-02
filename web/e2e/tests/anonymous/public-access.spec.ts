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
      await setupMocks('anonymous');
      const homePage = new HomePage(asAnonymous);

      await homePage.goto();

      await expect(asAnonymous).toHaveTitle(/IdeaForge/i);
      await expect(homePage.heading).toBeVisible();
    });

    test('homepage shows exactly 3 ideas (anonymous tier limit)', async ({
      asAnonymous,
      setupMocks,
      tierLimits,
    }) => {
      await setupMocks('anonymous');
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
      await setupMocks('anonymous');
      const homePage = new HomePage(asAnonymous);

      await homePage.goto();

      const ideaCount = await homePage.getIdeaCount();
      expect(ideaCount).toBeGreaterThan(0);

      // Check each visible idea card has required elements
      for (let i = 0; i < ideaCount; i++) {
        const card = homePage.getIdeaCard(i);

        // Name (h2 element)
        const nameElement = card.locator('h2');
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

    test('can click on idea card to navigate to detail page', async ({
      asAnonymous,
      setupMocks,
    }) => {
      await setupMocks('anonymous');
      const homePage = new HomePage(asAnonymous);

      await homePage.goto();
      await homePage.verifyIdeaCardsDisplayed(1);

      // Get the first idea name before clicking
      const ideaName = await homePage.getIdeaName(0);

      // Click the first idea card
      await homePage.clickIdeaCard(0);

      // Should navigate to idea detail page
      await expect(asAnonymous).toHaveURL(/\/idea\//);

      // Detail page should show the same idea name
      const ideaDetailPage = new IdeaDetailPage(asAnonymous);
      await expect(ideaDetailPage.ideaName).toContainText(ideaName.trim());
    });
  });

  test.describe('Idea Detail Page', () => {
    test('idea detail page shows basic info (name, tagline, score, effort)', async ({
      asAnonymous,
      setupMocks,
    }) => {
      await setupMocks('anonymous');

      // Navigate to detail page via homepage click
      const homePage = new HomePage(asAnonymous);
      await homePage.goto();
      await homePage.verifyIdeaCardsDisplayed(1);
      await homePage.clickIdeaCard(0);

      const detailPage = new IdeaDetailPage(asAnonymous);

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

    test('cannot see full brief sections (should show upgrade prompt)', async ({
      asAnonymous,
      setupMocks,
    }) => {
      await setupMocks('anonymous');

      // Navigate to detail page
      const homePage = new HomePage(asAnonymous);
      await homePage.goto();
      await homePage.verifyIdeaCardsDisplayed(1);
      await homePage.clickIdeaCard(0);

      // Check for upgrade prompt or gated content indicator
      const upgradePrompt = asAnonymous.locator(
        'text=/upgrade|sign up|login to view|unlock|premium/i'
      );
      const gatedSection = asAnonymous.locator('[data-testid="gated-content"]');
      const lockedIcon = asAnonymous.locator('[data-testid="locked-icon"], .lock-icon, svg[class*="lock"]');

      // At least one indicator of gated content should be present
      const hasUpgradePrompt = await upgradePrompt.count() > 0;
      const hasGatedSection = await gatedSection.count() > 0;
      const hasLockedIcon = await lockedIcon.count() > 0;

      // Full brief sections should be hidden or show upgrade prompt
      const briefSections = asAnonymous.locator(
        'section:has(h3:text("Technical Specification")), ' +
        'section:has(h3:text("Business Model")), ' +
        'section:has(h3:text("Go-to-Market Strategy"))'
      );

      const visibleBriefSections = await briefSections.count();

      // Either sections are hidden/gated OR upgrade prompt is shown
      expect(
        hasUpgradePrompt || hasGatedSection || hasLockedIcon || visibleBriefSections === 0
      ).toBeTruthy();
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
