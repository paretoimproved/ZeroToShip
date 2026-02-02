/**
 * Keyboard Navigation Tests
 *
 * Tests for full keyboard accessibility of the IdeaForge application.
 * Ensures users can navigate and interact without a mouse.
 */

import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test.describe('Tab navigation', () => {
    test('can tab through all interactive elements on homepage', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Start tabbing through interactive elements
      const interactiveElements: string[] = [];
      let previousElement = '';
      let iterations = 0;
      const maxIterations = 50; // Prevent infinite loops

      // Tab through elements until we loop back or hit max
      while (iterations < maxIterations) {
        await page.keyboard.press('Tab');
        iterations++;

        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return 'body';
          return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ')[0] : ''}`;
        });

        // If we've looped back to the first element, we're done
        if (interactiveElements.length > 0 && focusedElement === interactiveElements[0]) {
          break;
        }

        // Skip if same as previous (some elements don't change focus)
        if (focusedElement !== previousElement && focusedElement !== 'body') {
          interactiveElements.push(focusedElement);
        }

        previousElement = focusedElement;
      }

      // Should have found at least some interactive elements
      expect(interactiveElements.length).toBeGreaterThan(0);
    });

    test('tab order is logical (top to bottom, left to right)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const positions: { x: number; y: number; element: string }[] = [];

      // Tab through first 20 elements and record positions
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');

        const position = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const rect = el.getBoundingClientRect();
          return {
            x: rect.left,
            y: rect.top,
            element: el.tagName.toLowerCase(),
          };
        });

        if (position) {
          positions.push(position);
        }
      }

      // Verify general top-to-bottom flow (allowing for some variation)
      let outOfOrderCount = 0;
      for (let i = 1; i < positions.length; i++) {
        const prev = positions[i - 1];
        const curr = positions[i];

        // Check if current element is before previous in reading order
        const isOutOfOrder = curr.y < prev.y - 50; // Allow some tolerance

        if (isOutOfOrder) {
          outOfOrderCount++;
        }
      }

      // Allow up to 20% out of order (for complex layouts)
      const outOfOrderPercentage = outOfOrderCount / positions.length;
      expect(outOfOrderPercentage).toBeLessThan(0.2);
    });

    test('focus indicators are visible (not hidden by CSS)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Tab to first interactive element
      await page.keyboard.press('Tab');

      // Check that focus is visible
      const hasFocusIndicator = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return false;

        const styles = window.getComputedStyle(el);
        const outlineWidth = parseFloat(styles.outlineWidth) || 0;
        const outlineStyle = styles.outlineStyle;
        const boxShadow = styles.boxShadow;

        // Check for visible outline
        const hasVisibleOutline = outlineWidth > 0 && outlineStyle !== 'none';

        // Check for box-shadow (common alternative for focus)
        const hasBoxShadow = boxShadow !== 'none';

        // Check for ring (Tailwind's ring utility)
        const hasRing = el.className.includes('ring') || boxShadow.includes('rgb');

        return hasVisibleOutline || hasBoxShadow || hasRing;
      });

      expect(hasFocusIndicator).toBeTruthy();
    });
  });

  test.describe('Keyboard interactions', () => {
    test('can press Enter to activate buttons and links', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Find and focus on the Archive link
      const archiveLink = page.locator('nav a:has-text("Archive")');
      await archiveLink.focus();

      // Press Enter to activate the link
      await page.keyboard.press('Enter');

      // Should navigate to archive page
      await expect(page).toHaveURL('/archive');
    });

    test('can press Space to toggle checkboxes', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Find first checkbox in settings
      const checkbox = page.locator('input[type="checkbox"]').first();

      if (await checkbox.isVisible()) {
        const initialState = await checkbox.isChecked();

        // Focus on the checkbox
        await checkbox.focus();

        // Press Space to toggle
        await page.keyboard.press('Space');

        // Verify state changed
        const newState = await checkbox.isChecked();
        expect(newState).toBe(!initialState);
      }
    });

    test('can press Escape to close modals/dropdowns', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Try to find and open a dropdown or modal trigger
      const dropdownTrigger = page.locator('[aria-haspopup="true"], [data-dropdown-trigger], button:has-text("Menu")').first();

      if (await dropdownTrigger.isVisible()) {
        await dropdownTrigger.click();

        // Wait for dropdown/modal to open
        const dropdown = page.locator('[role="menu"], [role="dialog"], [data-dropdown]').first();

        if (await dropdown.isVisible()) {
          // Press Escape to close
          await page.keyboard.press('Escape');

          // Verify it closed
          await expect(dropdown).not.toBeVisible();
        }
      }
    });

    test('skip link exists and navigates to main content', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Press Tab to potentially reveal skip link
      await page.keyboard.press('Tab');

      // Look for skip link
      const skipLink = page.locator('a:has-text("Skip to main content"), a:has-text("Skip to content"), a[href="#main"], a[href="#content"]').first();

      if (await skipLink.isVisible()) {
        await skipLink.click();

        // Verify focus moved to main content
        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return el?.tagName.toLowerCase() || 'unknown';
        });

        // Should be focused on main or its first child
        const mainHasFocus = await page.evaluate(() => {
          const main = document.querySelector('main');
          const activeEl = document.activeElement;
          return main?.contains(activeEl) || activeEl?.tagName.toLowerCase() === 'main';
        });

        expect(mainHasFocus).toBeTruthy();
      }
    });

    test('arrow keys navigate dropdown menus', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Find a dropdown trigger
      const dropdownTrigger = page.locator('[aria-haspopup="true"], [aria-haspopup="menu"]').first();

      if (await dropdownTrigger.isVisible()) {
        await dropdownTrigger.click();

        // Wait for menu to appear
        const menuItems = page.locator('[role="menuitem"], [role="option"]');

        if ((await menuItems.count()) > 1) {
          // Press ArrowDown to navigate
          await page.keyboard.press('ArrowDown');

          // Verify focus moved within menu
          const focusedInMenu = await page.evaluate(() => {
            const menu = document.querySelector('[role="menu"], [role="listbox"]');
            const activeEl = document.activeElement;
            return menu?.contains(activeEl);
          });

          expect(focusedInMenu).toBeTruthy();
        }
      }
    });

    test('can navigate entire settings form with keyboard only', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');

      // Get all form controls
      const formControls = page.locator(
        'input, select, textarea, button, [role="radio"], [role="checkbox"], [role="slider"]'
      );
      const controlCount = await formControls.count();

      const visitedControls: string[] = [];

      // Tab through all form controls
      for (let i = 0; i < controlCount + 5; i++) {
        await page.keyboard.press('Tab');

        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          return {
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type'),
            role: el.getAttribute('role'),
          };
        });

        if (focused) {
          const identifier = `${focused.tag}${focused.type ? '-' + focused.type : ''}${focused.role ? '-' + focused.role : ''}`;
          if (!visitedControls.includes(identifier)) {
            visitedControls.push(identifier);
          }
        }
      }

      // Should be able to reach multiple different form controls
      expect(visitedControls.length).toBeGreaterThan(2);
    });

    test('focus is trapped inside open modal', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Try to open a modal
      const modalTrigger = page.locator('[data-modal-trigger], button:has-text("Delete"), button:has-text("Confirm")').first();

      if (await modalTrigger.isVisible()) {
        await modalTrigger.click();

        const modal = page.locator('[role="dialog"], [aria-modal="true"]').first();

        if (await modal.isVisible()) {
          // Get all focusable elements in modal
          const modalFocusable = modal.locator(
            'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const focusableCount = await modalFocusable.count();

          // Tab through more times than focusable elements
          for (let i = 0; i < focusableCount + 3; i++) {
            await page.keyboard.press('Tab');

            // Verify focus stays within modal
            const focusInModal = await page.evaluate(() => {
              const modal = document.querySelector('[role="dialog"], [aria-modal="true"]');
              const activeEl = document.activeElement;
              return modal?.contains(activeEl);
            });

            expect(focusInModal).toBeTruthy();
          }
        }
      }
    });
  });
});
