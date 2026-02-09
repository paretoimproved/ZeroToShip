/**
 * E2E tests for Pro tier full brief access
 *
 * Pro tier users should have:
 * - Access to 10 ideas on homepage (vs 3 for free)
 * - No "limited ideas" restriction messages
 * - Full brief access with all tab content ungated
 * - No upgrade prompts or locked content
 *
 * Updated for inline tabbed IdeaBriefCard components.
 */

import { test, expect } from '../../fixtures';
import { HomePage, IdeaDetailPage } from '../../pages';
import { TEST_USERS, TIER_LIMITS, SEED_IDEAS } from '../../utils';

test.describe('Pro Tier - Full Brief Access', () => {
  test.describe('Homepage Idea Visibility', () => {
    test('displays up to 10 ideas for Pro users', async ({ asProUser, setupMocks }) => {
      // Setup mocks for Pro tier
      await setupMocks(asProUser, 'pro');

      const homePage = new HomePage(asProUser);
      await homePage.goto();

      const ideaCount = await homePage.getIdeaCount();

      // Pro tier should show up to 10 ideas (or all available if less than 10)
      expect(ideaCount).toBeLessThanOrEqual(TIER_LIMITS.pro.ideasVisible);
      expect(ideaCount).toBeGreaterThan(0);
    });

    test('shows more ideas than free tier limit', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

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
      await setupMocks(asProUser, 'pro');

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

  test.describe('Full Brief Content via Tabs', () => {
    test('Problem tab shows content without gating', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const homePage = new HomePage(asProUser);
      await homePage.goto();

      // Default tab should be Problem
      const activeTab = await homePage.getActiveTabName(0);
      expect(activeTab).toBe('Problem');

      // Should not show gated content
      const hasGated = await homePage.hasGatedContent(0);
      expect(hasGated).toBe(false);
    });

    test('Solution tab is accessible (not gated) for Pro users', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const homePage = new HomePage(asProUser);
      await homePage.goto();

      await homePage.switchTab(0, 'Solution');
      const hasGated = await homePage.hasGatedContent(0);
      expect(hasGated).toBe(false);
    });

    test('Tech Spec tab is accessible (not gated) for Pro users', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const homePage = new HomePage(asProUser);
      await homePage.goto();

      await homePage.switchTab(0, 'Tech Spec');
      const hasGated = await homePage.hasGatedContent(0);
      expect(hasGated).toBe(false);
    });

    test('Business tab is accessible (not gated) for Pro users', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const homePage = new HomePage(asProUser);
      await homePage.goto();

      await homePage.switchTab(0, 'Business');
      const hasGated = await homePage.hasGatedContent(0);
      expect(hasGated).toBe(false);
    });

    test('can view full brief on idea detail page via tabs', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      // Verify we can see the idea name
      const ideaName = await detailPage.getName();
      expect(ideaName.length).toBeGreaterThan(0);

      // Verify all tabs are accessible
      await detailPage.verifyAllTabsAccessible();
    });

    test('Solution tab includes key features', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      const features = await detailPage.getKeyFeatures();
      expect(features.length).toBeGreaterThan(0);
    });

    test('Tech Spec tab includes stack items', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      const techStack = await detailPage.getTechStack();
      expect(techStack.length).toBeGreaterThan(0);
    });

    test('Business tab includes channels', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      const channels = await detailPage.getChannels();
      expect(channels.length).toBeGreaterThan(0);
    });
  });

  test.describe('No Upgrade Prompts', () => {
    test('does not show upgrade prompts on any tab', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const homePage = new HomePage(asProUser);
      await homePage.goto();

      // Check all gated tabs for upgrade prompts
      const gatedTabNames = ['Solution', 'Tech Spec', 'Business'];
      for (const tabName of gatedTabNames) {
        await homePage.switchTab(0, tabName);

        const upgradePrompts = [
          asProUser.locator('text=/upgrade to pro/i'),
          asProUser.locator('text=/unlock full brief/i'),
          asProUser.locator('text=/subscribe to access/i'),
          asProUser.locator('text=/get full access/i'),
          asProUser.locator('[data-testid="gated-content"]'),
        ];

        for (const prompt of upgradePrompts) {
          await expect(prompt).not.toBeVisible();
        }
      }
    });

    test('does not show locked content indicators', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const detailPage = new IdeaDetailPage(asProUser);
      await detailPage.goto('mock-1');

      // Check for lock icons or gated content
      const lockedIndicators = [
        asProUser.locator('[data-testid="gated-content"]'),
        asProUser.locator('.locked-content'),
        asProUser.locator('.blur-content'),
      ];

      for (const indicator of lockedIndicators) {
        await expect(indicator).not.toBeVisible();
      }
    });
  });
});
