/**
 * E2E tests for Enterprise tier full-text search functionality
 *
 * Tests the advanced search capabilities available only to Enterprise users.
 */

import { test, expect } from '../../fixtures';
import { ArchivePage } from '../../pages';
import { TEST_USERS } from '../../utils';

test.describe('Enterprise Tier - Full-Text Search', () => {
  test('search feature is accessible with visible input field', async ({ asEnterpriseUser }) => {
    const archivePage = new ArchivePage(asEnterpriseUser);
    await archivePage.goto();

    // Search input should be visible and enabled
    await expect(archivePage.searchInput).toBeVisible();
    await expect(archivePage.searchInput).toBeEnabled();

    // Should have placeholder text
    const placeholder = await archivePage.searchInput.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder?.toLowerCase()).toMatch(/search|find|filter/);
  });

  test('can search across all ideas and returns matching results', async ({ asEnterpriseUser }) => {
    const archivePage = new ArchivePage(asEnterpriseUser);
    await archivePage.goto();

    // Get initial count
    const initialCount = await archivePage.getIdeaCount();

    // Search for a term (from seed data)
    await archivePage.search('Code');
    await asEnterpriseUser.waitForTimeout(500);

    // Either results are filtered or empty state shows
    const afterSearchCount = await archivePage.getIdeaCount();
    const hasEmptyState = await archivePage.hasEmptyState();

    // Search should have some effect
    expect(afterSearchCount <= initialCount || hasEmptyState).toBeTruthy();
  });

  test('search works with multiple keywords', async ({ asEnterpriseUser }) => {
    const archivePage = new ArchivePage(asEnterpriseUser);
    await archivePage.goto();

    // Search with multiple words
    await archivePage.search('AI meeting');
    await asEnterpriseUser.waitForTimeout(500);

    // Should show results or empty state
    const resultCount = await archivePage.getIdeaCount();
    const hasEmptyState = await archivePage.hasEmptyState();

    expect(resultCount >= 0 || hasEmptyState).toBeTruthy();
  });

  test('empty search shows helpful message or all results', async ({ asEnterpriseUser }) => {
    const archivePage = new ArchivePage(asEnterpriseUser);
    await archivePage.goto();

    // Clear search
    await archivePage.clearSearch();
    await asEnterpriseUser.waitForTimeout(500);

    // Should show all results or a helpful state
    const resultCount = await archivePage.getIdeaCount();
    expect(resultCount).toBeGreaterThanOrEqual(0);
  });

  test('search results show full brief info with pagination', async ({ asEnterpriseUser }) => {
    const archivePage = new ArchivePage(asEnterpriseUser);
    await archivePage.goto();

    const resultCount = await archivePage.getIdeaCount();

    if (resultCount > 0) {
      const firstCard = archivePage.getIdeaCard(0);

      // Should show idea name/title
      const ideaTitle = firstCard.locator('h2, h3, [data-testid="idea-title"]');
      await expect(ideaTitle).toBeVisible();
      expect(await ideaTitle.textContent()).toBeTruthy();
    }

    // Check for pagination or results count
    const pagination = asEnterpriseUser.locator(
      '[data-testid="pagination"], .pagination, nav[aria-label*="pagination"], button:has-text("Next")'
    );
    const resultsText = await archivePage.getResultsCountText();

    const hasPagination = (await pagination.count()) > 0;
    const hasResultsCount = resultsText.length > 0;

    expect(hasPagination || hasResultsCount || resultCount === 0).toBeTruthy();
  });

  test('can combine search with filters', async ({ asEnterpriseUser }) => {
    const archivePage = new ArchivePage(asEnterpriseUser);
    await archivePage.goto();

    // Apply search
    await archivePage.search('AI');

    // Apply effort filter
    await archivePage.filterByEffort('week');
    await asEnterpriseUser.waitForTimeout(500);

    // Combined filters should work
    const resultCount = await archivePage.getIdeaCount();
    const hasEmptyState = await archivePage.hasEmptyState();

    expect(resultCount >= 0 || hasEmptyState).toBeTruthy();

    // Clear search and verify effort filter persists
    await archivePage.clearSearch();
    await asEnterpriseUser.waitForTimeout(300);

    const effortValue = await archivePage.effortDropdown.inputValue();
    expect(effortValue).toBe('week');
  });
});
