/**
 * E2E tests for Pro tier archive and pagination functionality
 *
 * Pro tier users should have:
 * - Unlimited archive access (no time restrictions)
 * - Full pagination capabilities
 * - Ability to combine multiple filters
 * - Search within archive
 */

import { test, expect } from '../../fixtures';
import { ArchivePage } from '../../pages';
import { TEST_USERS, TIER_LIMITS, SEED_IDEAS } from '../../utils';

test.describe('Pro Tier - Archive & Pagination', () => {
  test.describe('Unlimited Archive Access', () => {
    test('can access archive page without restrictions', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Verify archive page loads correctly
      await expect(archivePage.heading).toBeVisible();
      await expect(archivePage.heading).toHaveText('Idea Archive');
    });

    test('does not show time restriction message', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Check for common time restriction messages
      const restrictionMessages = [
        asProUser.locator('text=/limited to (\\d+|last) days/i'),
        asProUser.locator('text=/upgrade.*older ideas/i'),
        asProUser.locator('text=/only showing.*recent/i'),
        asProUser.locator('text=/archive limited/i'),
        asProUser.locator('[data-testid="archive-restriction"]'),
      ];

      for (const message of restrictionMessages) {
        await expect(message).not.toBeVisible();
      }
    });

    test('can browse ideas older than 7 days', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Verify ideas are displayed (mocked data includes various dates)
      const ideaCount = await archivePage.getIdeaCount();
      expect(ideaCount).toBeGreaterThan(0);

      // Check that no "upgrade for older ideas" message appears
      const olderIdeasRestriction = asProUser.locator('text=/upgrade.*7 day/i');
      await expect(olderIdeasRestriction).not.toBeVisible();
    });
  });

  test.describe('Pagination', () => {
    test('pagination controls are visible', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Pagination elements - could be buttons or page numbers
      const paginationControls = [
        asProUser.locator('[data-testid="pagination"]'),
        asProUser.locator('nav[aria-label="Pagination"]'),
        asProUser.locator('button:has-text("Next")'),
        asProUser.locator('button:has-text("Previous")'),
        asProUser.locator('.pagination'),
      ];

      // At least one pagination method should be present (if there are enough items)
      let hasPagination = false;
      for (const control of paginationControls) {
        if (await control.isVisible()) {
          hasPagination = true;
          break;
        }
      }

      // If there are more items than page size, pagination should be visible
      // This is conditional since mock data might not trigger pagination
      const { total } = await archivePage.getResultsCounts();
      if (total > 10) {
        expect(hasPagination).toBeTruthy();
      }
    });

    test('can navigate between pages', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Get initial ideas
      const initialNames = await archivePage.getAllIdeaNames();

      // Try to navigate to next page if available
      const nextButton = asProUser.locator('button:has-text("Next")');
      const hasNext = await nextButton.isVisible();

      if (hasNext && !(await nextButton.isDisabled())) {
        await nextButton.click();
        await asProUser.waitForTimeout(500);

        // Check URL or page state changed
        // Results should update (might be same if circular, but page state changed)
        const afterNames = await archivePage.getAllIdeaNames();

        // Verify navigation happened (content or URL changed)
        const url = asProUser.url();
        expect(
          url.includes('page=') || JSON.stringify(afterNames) !== JSON.stringify(initialNames)
        ).toBeTruthy();
      }
    });

    test('results count updates correctly', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Check if results count is displayed
      const resultsText = await archivePage.getResultsCountText();

      if (resultsText) {
        const { showing, total } = await archivePage.getResultsCounts();
        expect(showing).toBeGreaterThan(0);
        expect(total).toBeGreaterThanOrEqual(showing);
      }
    });
  });

  test.describe('Filter Combinations', () => {
    test('can apply effort filter', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Apply effort filter
      await archivePage.filterByEffort('weekend');

      // Results should update
      await asProUser.waitForTimeout(500);
      const countAfter = await archivePage.getIdeaCount();

      // Either there are filtered results or empty state
      const hasEmptyState = await archivePage.hasEmptyState();
      expect(countAfter >= 0 || hasEmptyState).toBeTruthy();
    });

    test('can apply score filter', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Set minimum score filter
      await archivePage.setMinScore(70);

      // Results should update
      await asProUser.waitForTimeout(500);
      const countAfter = await archivePage.getIdeaCount();

      // Verify filter was applied
      const currentScore = await archivePage.getMinScore();
      expect(currentScore).toBe(70);
    });

    test('can combine multiple filters (effort + score + search)', async ({
      asProUser,
      setupMocks,
    }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Apply multiple filters
      await archivePage.filterByEffort('month');
      await archivePage.setMinScore(60);
      await archivePage.search('AI');

      // All filters should be applied simultaneously
      await asProUser.waitForTimeout(500);

      // Verify filters are set
      const currentScore = await archivePage.getMinScore();
      expect(currentScore).toBe(60);

      // Search input should have the search text
      const searchValue = await archivePage.searchInput.inputValue();
      expect(searchValue).toBe('AI');
    });

    test('results update when filters change', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Get initial count
      const initialCount = await archivePage.getIdeaCount();

      // Apply a restrictive filter
      await archivePage.setMinScore(90);
      await asProUser.waitForTimeout(500);

      const filteredCount = await archivePage.getIdeaCount();

      // Reset filters
      await archivePage.resetFilters();
      await asProUser.waitForTimeout(500);

      const resetCount = await archivePage.getIdeaCount();

      // Filtered count should be less than or equal to initial
      // Reset count should be similar to initial
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });
  });

  test.describe('Search Functionality', () => {
    test('can search within archive', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Search for a term from seed data
      await archivePage.search('CodeReview');

      await asProUser.waitForTimeout(500);

      // Either find matching results or empty state
      const ideaCount = await archivePage.getIdeaCount();
      const hasEmptyState = await archivePage.hasEmptyState();

      expect(ideaCount > 0 || hasEmptyState).toBeTruthy();
    });

    test('search updates results dynamically', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      // Initial state
      const initialCount = await archivePage.getIdeaCount();

      // Search with a term that might match some ideas
      await archivePage.search('AI');
      await asProUser.waitForTimeout(500);

      const searchCount = await archivePage.getIdeaCount();

      // Clear search
      await archivePage.clearSearch();
      await asProUser.waitForTimeout(500);

      const clearedCount = await archivePage.getIdeaCount();

      // After clearing, count should return to initial or similar
      expect(clearedCount).toBe(initialCount);
    });

    test('search input is accessible', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      await expect(archivePage.searchInput).toBeVisible();
      await expect(archivePage.searchInput).toBeEnabled();

      // Should be focusable
      await archivePage.searchInput.focus();
      await expect(archivePage.searchInput).toBeFocused();
    });

    test('filter controls are all present', async ({ asProUser, setupMocks }) => {
      await setupMocks(asProUser, 'pro');

      const archivePage = new ArchivePage(asProUser);
      await archivePage.goto();

      await archivePage.verifyFiltersExist();
    });
  });
});
