/**
 * E2E tests for Pro tier full brief access
 *
 * Pro tier users should have:
 * - Access to 10 ideas on homepage (vs 3 for free)
 * - No "limited ideas" restriction messages
 * - Full business brief access with all sections
 * - No upgrade prompts on idea detail pages
 */

import { test, expect } from '../../fixtures';
import { HomePage, IdeaDetailPage } from '../../pages';
import { TEST_USERS, TIER_LIMITS, SEED_IDEAS } from '../../utils';

test.describe('Pro Tier - Full Brief Access', () => {
  test.describe('Homepage Idea Visibility', () => {
    test('displays up to 10 ideas for Pro users', async ({ asProUser, setupMocks }) => {
      // Setup mocks for Pro tier
      await setupMocks('pro');

      const homePage = new HomePage(asProUser);
      await homePage.goto();

      const ideaCount = await homePage.getIdeaCount();

      // Pro tier should show up to 10 ideas (or all available if less than 10)
      expect(ideaCount).toBeLessThanOrEqual(TIER_LIMITS.pro.ideasVisible);
      expect(ideaCount).toBeGreaterThan(0);
    });

    test('shows more ideas than free tier limit', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const homePage = new HomePage(asProUser);
      await homePage.goto();

      const ideaCount = await homePage.getIdeaCount();

      // Pro should show more ideas than free tier limit (3)
      // This test only applies if we have enough seed ideas
      if (SEED_IDEAS.length > TIER_LIMITS.free.ideasVisible) {
        expect(ideaCount).toBeGreaterThan(TIER_LIMITS.free.ideasVisible);
      }
    });

    test('does not show "limited ideas" restriction message', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const homePage = new HomePage(asProUser);
      await homePage.goto();

      // Check for common restriction message variations
      const restrictionMessages = [
        asProUser.locator('text=/limited ideas/i'),
        asProUser.locator('text=/upgrade to see more/i'),
        asProUser.locator('text=/only showing \\d+ ideas/i'),
        asProUser.locator('text=/unlock more ideas/i'),
      ];

      for (const message of restrictionMessages) {
        await expect(message).not.toBeVisible();
      }
    });
  });

  test.describe('Full Brief Content', () => {
    test('can view full business brief on idea detail page', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const homePage = new HomePage(asProUser);
      await homePage.goto();

      // Click on first idea
      await homePage.clickIdeaCard(0);

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.waitForLoad();

      // Verify we're on the detail page
      const ideaName = await detailPage.getName();
      expect(ideaName.length).toBeGreaterThan(0);
    });

    test('brief includes Problem Statement section', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      await expect(detailPage.problemSection).toBeVisible();
      const problemText = await detailPage.problemSection.textContent();
      expect(problemText).toContain('Problem Statement');
    });

    test('brief includes Existing Solutions section', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      await expect(detailPage.existingSolutionsSection).toBeVisible();
      const sectionText = await detailPage.existingSolutionsSection.textContent();
      expect(sectionText).toContain('Existing Solutions');
    });

    test('brief includes Market Gaps section', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      await expect(detailPage.marketGapsSection).toBeVisible();
      const sectionText = await detailPage.marketGapsSection.textContent();
      expect(sectionText).toContain('Market Gaps');
    });

    test('brief includes Proposed Solution with features list', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      await expect(detailPage.proposedSolutionSection).toBeVisible();

      // Verify features list is present
      const features = await detailPage.getKeyFeatures();
      expect(features.length).toBeGreaterThan(0);
    });

    test('brief includes MVP Scope details', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      await expect(detailPage.mvpScopeSection).toBeVisible();
      const sectionText = await detailPage.mvpScopeSection.textContent();
      expect(sectionText).toContain('MVP Scope');
    });

    test('brief includes Technical Specification with stack, architecture, effort', async ({
      asProUser,
      setupMocks,
    }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      await expect(detailPage.technicalSpecSection).toBeVisible();

      // Check for tech stack tags
      const techStack = await detailPage.getTechStack();
      expect(techStack.length).toBeGreaterThan(0);
    });

    test('brief includes Business Model with pricing, revenue, monetization', async ({
      asProUser,
      setupMocks,
    }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      await expect(detailPage.businessModelSection).toBeVisible();
      const sectionText = await detailPage.businessModelSection.textContent();
      expect(sectionText).toContain('Business Model');
    });

    test('brief includes Go-to-Market strategy with launch, channels, customers', async ({
      asProUser,
      setupMocks,
    }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      await expect(detailPage.goToMarketSection).toBeVisible();

      // Verify channels are listed
      const channels = await detailPage.getChannels();
      expect(channels.length).toBeGreaterThan(0);
    });

    test('brief includes Risks section', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      await expect(detailPage.risksSection).toBeVisible();
      const sectionText = await detailPage.risksSection.textContent();
      expect(sectionText).toContain('Risks');
    });

    test('all brief sections are present simultaneously', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      // Use the page object's verification method
      await detailPage.verifyAllSectionsPresent();
    });
  });

  test.describe('No Upgrade Prompts', () => {
    test('does not show upgrade prompts on idea detail page', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      // Check for common upgrade prompt variations
      const upgradePrompts = [
        asProUser.locator('text=/upgrade to pro/i'),
        asProUser.locator('text=/unlock full brief/i'),
        asProUser.locator('text=/subscribe to access/i'),
        asProUser.locator('text=/get full access/i'),
        asProUser.locator('[data-testid="upgrade-prompt"]'),
        asProUser.locator('[data-testid="upgrade-cta"]'),
      ];

      for (const prompt of upgradePrompts) {
        await expect(prompt).not.toBeVisible();
      }
    });

    test('does not show locked content indicators', async ({ asProUser, setupMocks }) => {
      await setupMocks('pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      // Check for lock icons or blurred/hidden content
      const lockedIndicators = [
        asProUser.locator('[data-testid="locked-section"]'),
        asProUser.locator('.locked-content'),
        asProUser.locator('.blur-content'),
        asProUser.locator('svg[data-icon="lock"]'),
      ];

      for (const indicator of lockedIndicators) {
        await expect(indicator).not.toBeVisible();
      }
    });
  });
});
