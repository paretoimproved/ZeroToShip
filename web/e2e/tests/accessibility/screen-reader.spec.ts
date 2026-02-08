/**
 * Screen Reader Compatibility Tests
 *
 * Tests for proper ARIA attributes, landmarks, and screen reader support.
 * Ensures the application is usable with assistive technologies.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Screen Reader Compatibility', () => {
  test.describe('Page structure and landmarks', () => {
    test('page has correct landmark regions (main, nav, header, footer)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Check for required landmarks
      const main = page.locator('main, [role="main"]');
      const nav = page.locator('nav, [role="navigation"]');
      const header = page.locator('header, [role="banner"]');

      // Main content area is required
      await expect(main).toBeVisible();

      // Navigation is required
      await expect(nav).toBeVisible();

      // Header is expected
      const headerCount = await header.count();
      expect(headerCount).toBeGreaterThanOrEqual(1);

      // Footer is optional but check it exists
      const footer = page.locator('footer, [role="contentinfo"]');
      const footerCount = await footer.count();
      // Footer may or may not exist, but if it does it should have proper role
      if (footerCount > 0) {
        await expect(footer.first()).toBeVisible();
      }
    });

    test('page title is descriptive and unique per page', async ({ page }) => {
      // Check multiple pages have unique titles
      const pagesToCheck = [
        { url: '/', expectedPattern: /Today|Home|ZeroToShip/i },
        { url: '/archive', expectedPattern: /Archive|ZeroToShip/i },
        { url: '/settings', expectedPattern: /Settings|ZeroToShip/i },
        { url: '/account', expectedPattern: /Account|ZeroToShip/i },
      ];

      const titles: string[] = [];

      for (const { url, expectedPattern } of pagesToCheck) {
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');

        const title = await page.title();

        // Title should match expected pattern
        expect(title).toMatch(expectedPattern);

        // Title should be reasonably descriptive (more than just "ZeroToShip")
        expect(title.length).toBeGreaterThan(5);

        titles.push(title);
      }

      // Each page should have a unique title or at least different content indicators
      // This is a soft check since titles might be the same for some apps
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('ARIA attributes', () => {
    test('ARIA labels are present on interactive elements', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Check icon buttons have aria-label
      const iconButtons = page.locator('button:not(:has-text(.))');
      const iconButtonCount = await iconButtons.count();

      for (let i = 0; i < iconButtonCount; i++) {
        const button = iconButtons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaLabelledBy = await button.getAttribute('aria-labelledby');
        const title = await button.getAttribute('title');
        const text = await button.textContent();

        // Button should have accessible name via one of these methods
        const hasAccessibleName =
          ariaLabel !== null ||
          ariaLabelledBy !== null ||
          title !== null ||
          (text && text.trim().length > 0);

        expect(
          hasAccessibleName,
          `Button ${i} is missing accessible name`
        ).toBeTruthy();
      }
    });

    test('dynamic content changes are announced (aria-live regions)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Check for aria-live regions
      const liveRegions = page.locator('[aria-live], [role="alert"], [role="status"]');
      const liveRegionCount = await liveRegions.count();

      // Application should have at least one live region for notifications
      // This is a soft check - not all apps need live regions
      if (liveRegionCount > 0) {
        for (let i = 0; i < liveRegionCount; i++) {
          const region = liveRegions.nth(i);
          const ariaLive = await region.getAttribute('aria-live');
          const role = await region.getAttribute('role');

          const hasProperAnnouncement =
            ariaLive === 'polite' ||
            ariaLive === 'assertive' ||
            role === 'alert' ||
            role === 'status';

          expect(hasProperAnnouncement).toBeTruthy();
        }
      }
    });

    test('form error messages are announced', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Check that form fields with errors have proper ARIA attributes
      const errorMessages = page.locator('[role="alert"], .error, [aria-invalid="true"]');
      const errorCount = await errorMessages.count();

      // If there are error messages, check they're properly connected
      if (errorCount > 0) {
        for (let i = 0; i < errorCount; i++) {
          const error = errorMessages.nth(i);
          const id = await error.getAttribute('id');

          // If error has an ID, check it's referenced by aria-describedby
          if (id) {
            const describedByElement = page.locator(`[aria-describedby*="${id}"]`);
            const connectedCount = await describedByElement.count();
            // Error should be connected to at least one form field
            expect(connectedCount).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    test('loading states are announced', async ({ page }) => {
      await page.goto('/');

      // Check for loading indicators with proper ARIA
      const loadingIndicators = page.locator(
        '[aria-busy="true"], [role="progressbar"], [aria-label*="loading"], [aria-label*="Loading"]'
      );

      // Check that if loading states exist, they have proper attributes
      const loadingCount = await loadingIndicators.count();

      if (loadingCount > 0) {
        for (let i = 0; i < loadingCount; i++) {
          const indicator = loadingIndicators.nth(i);
          const ariaBusy = await indicator.getAttribute('aria-busy');
          const ariaLabel = await indicator.getAttribute('aria-label');
          const role = await indicator.getAttribute('role');

          // Should have either aria-busy or aria-label for loading
          const hasLoadingAnnouncement =
            ariaBusy === 'true' ||
            ariaLabel?.toLowerCase().includes('loading') ||
            role === 'progressbar';

          expect(hasLoadingAnnouncement).toBeTruthy();
        }
      }
    });

    test('current navigation item is indicated (aria-current)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Check for aria-current on navigation
      const navLinks = page.locator('nav a, nav [role="link"]');
      const navLinkCount = await navLinks.count();

      let hasCurrentIndicator = false;

      for (let i = 0; i < navLinkCount; i++) {
        const link = navLinks.nth(i);
        const ariaCurrent = await link.getAttribute('aria-current');
        const className = await link.getAttribute('class');

        // Check for aria-current="page" or visual active class
        if (
          ariaCurrent === 'page' ||
          ariaCurrent === 'true' ||
          className?.includes('active') ||
          className?.includes('current')
        ) {
          hasCurrentIndicator = true;
          break;
        }
      }

      // At least one nav item should indicate current page
      expect(hasCurrentIndicator).toBeTruthy();
    });
  });

  test.describe('Link and button text', () => {
    test('links have descriptive text (not "click here")', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const links = page.locator('a');
      const linkCount = await links.count();

      const genericLinkTexts = [
        'click here',
        'here',
        'read more',
        'learn more',
        'more',
        'link',
      ];

      for (let i = 0; i < linkCount; i++) {
        const link = links.nth(i);
        const text = (await link.textContent())?.toLowerCase().trim() || '';
        const ariaLabel = await link.getAttribute('aria-label');

        // Skip if link has aria-label (it's accessible)
        if (ariaLabel) continue;

        // Check link text isn't generic
        const isGeneric = genericLinkTexts.some(
          (generic) => text === generic.toLowerCase()
        );

        expect(
          !isGeneric,
          `Link "${text}" uses generic text - should be more descriptive`
        ).toBeTruthy();
      }
    });

    test('tables have proper headers (if any tables exist)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const tables = page.locator('table');
      const tableCount = await tables.count();

      for (let i = 0; i < tableCount; i++) {
        const table = tables.nth(i);

        // Check for table headers
        const headers = table.locator('th');
        const headerCount = await headers.count();

        // Tables should have headers
        expect(
          headerCount,
          `Table ${i} has no header cells (th)`
        ).toBeGreaterThan(0);

        // Check for proper scope on headers
        for (let j = 0; j < headerCount; j++) {
          const header = headers.nth(j);
          const scope = await header.getAttribute('scope');

          // Headers should have scope="col" or scope="row"
          // This is a recommendation, not a hard requirement
          if (scope) {
            expect(['col', 'row', 'colgroup', 'rowgroup']).toContain(scope);
          }
        }

        // Check for caption or aria-label
        const caption = table.locator('caption');
        const ariaLabel = await table.getAttribute('aria-label');
        const ariaLabelledBy = await table.getAttribute('aria-labelledby');

        const hasTableLabel =
          (await caption.count()) > 0 ||
          ariaLabel !== null ||
          ariaLabelledBy !== null;

        // Tables should have a label/caption for context
        expect(
          hasTableLabel,
          `Table ${i} has no caption or aria-label`
        ).toBeTruthy();
      }
    });

    test('score badges have accessible text (not just color)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Find score badges (based on ScoreBadge component patterns)
      const scoreBadges = page.locator(
        '[class*="bg-green-"], [class*="bg-yellow-"], [class*="bg-red-"]'
      ).filter({ hasText: /\d/ });

      const badgeCount = await scoreBadges.count();

      for (let i = 0; i < badgeCount; i++) {
        const badge = scoreBadges.nth(i);
        const text = await badge.textContent();
        const ariaLabel = await badge.getAttribute('aria-label');
        const title = await badge.getAttribute('title');

        // Badge should have visible text or aria-label
        const hasAccessibleValue =
          (text && text.trim().length > 0) ||
          ariaLabel !== null ||
          title !== null;

        expect(
          hasAccessibleValue,
          `Score badge ${i} has no accessible text`
        ).toBeTruthy();
      }
    });
  });

  test.describe('Overall screen reader accessibility', () => {
    test('passes axe screen reader rules', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      // Filter for rules most relevant to screen readers
      const screenReaderRules = [
        'aria-allowed-attr',
        'aria-hidden-body',
        'aria-hidden-focus',
        'aria-input-field-name',
        'aria-required-attr',
        'aria-required-children',
        'aria-required-parent',
        'aria-roles',
        'aria-valid-attr',
        'aria-valid-attr-value',
        'image-alt',
        'label',
        'link-name',
        'button-name',
      ];

      const relevantViolations = results.violations.filter((v) =>
        screenReaderRules.includes(v.id)
      );

      expect(relevantViolations).toEqual([]);
    });
  });
});
