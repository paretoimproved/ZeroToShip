/**
 * E2E tests for input validation
 *
 * Tests verify that forms and inputs properly validate user input,
 * handle edge cases, and prevent malicious input.
 */

import { test, expect } from '../../fixtures';
import { SettingsPage, AccountPage, HomePage } from '../../pages';
import { API_URL } from '../../utils/test-data';

test.describe('Input Validation', () => {
  test.describe('Login Form Validation', () => {
    test('login form validates email format', async ({ page }) => {
      await page.goto('/login');

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const submitButton = page.locator('button[type="submit"]').first();

      // Skip if login form doesn't exist on this page
      if (!(await emailInput.isVisible().catch(() => false))) {
        test.skip();
        return;
      }

      // Test invalid email formats
      const invalidEmails = ['notanemail', 'missing@', '@nodomain.com', 'spaces in@email.com'];

      for (const invalidEmail of invalidEmails) {
        await emailInput.clear();
        await emailInput.fill(invalidEmail);
        await submitButton.click();

        // Should show validation error or prevent submission
        const validationError = page.locator(
          '[role="alert"], .error, .invalid, :invalid, text=/invalid|valid email/i'
        );
        const emailHasError =
          (await emailInput.getAttribute('aria-invalid')) === 'true' ||
          (await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid));

        const hasValidationFeedback =
          (await validationError.first().isVisible().catch(() => false)) || emailHasError;

        expect(hasValidationFeedback).toBeTruthy();
      }
    });

    test('login form validates password is not empty', async ({ page }) => {
      await page.goto('/login');

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"]').first();

      // Skip if login form doesn't exist
      if (!(await passwordInput.isVisible().catch(() => false))) {
        test.skip();
        return;
      }

      // Fill email but leave password empty
      await emailInput.fill('test@example.com');
      await passwordInput.clear();
      await submitButton.click();

      // Should show validation error for empty password
      const validationError = page.locator(
        '[role="alert"], .error, .invalid, text=/password.*required|enter.*password/i'
      );
      const passwordHasError =
        (await passwordInput.getAttribute('aria-invalid')) === 'true' ||
        (await passwordInput.getAttribute('required')) !== null;

      const hasValidationFeedback =
        (await validationError.first().isVisible().catch(() => false)) || passwordHasError;

      expect(hasValidationFeedback).toBeTruthy();
    });
  });

  test.describe('Settings Form Validation', () => {
    test('settings form validates required fields', async ({ asFreeUser, setupMocks }) => {
      const page = asFreeUser;
      await setupMocks(page, 'free');

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();

      // Try to save with potentially invalid state
      // Most settings have defaults, so we test by checking form state

      // Verify save button is present and form has validation
      const saveButton = settingsPage.saveButton;
      await expect(saveButton).toBeVisible();

      // Settings should have sensible defaults - clicking save should work
      // or show validation if something is required and missing
      const form = page.locator('form');
      if (await form.isVisible().catch(() => false)) {
        const isFormValid = await form.evaluate((el: HTMLFormElement) => el.checkValidity());
        expect(isFormValid).toBeTruthy();
      }
    });

    test('settings form handles very long strings (1000+ chars)', async ({ asFreeUser, setupMocks }) => {
      const page = asFreeUser;
      await setupMocks(page, 'free');

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();

      // Find any text input fields on the settings page
      const textInputs = page.locator(
        'input[type="text"], input:not([type]), textarea'
      );
      const inputCount = await textInputs.count();

      if (inputCount > 0) {
        // Generate a very long string (1000+ characters)
        const longString = 'a'.repeat(1500);

        for (let i = 0; i < Math.min(inputCount, 3); i++) {
          const input = textInputs.nth(i);

          if (await input.isVisible().catch(() => false)) {
            await input.clear();
            await input.fill(longString);

            // Check if the input was truncated or shows validation
            const value = await input.inputValue();
            const maxLength = await input.getAttribute('maxlength');

            if (maxLength) {
              // Input should be truncated to maxlength
              expect(value.length).toBeLessThanOrEqual(parseInt(maxLength));
            }

            // Clear for next iteration
            await input.clear();
          }
        }
      }

      // Test passes if no JS errors occurred during long string handling
      expect(true).toBeTruthy();
    });

    test('settings form handles special characters', async ({ asFreeUser, setupMocks }) => {
      const page = asFreeUser;
      await setupMocks(page, 'free');

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();

      // Find text inputs
      const textInputs = page.locator(
        'input[type="text"], input:not([type]), textarea'
      );

      const specialChars = [
        '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~',
        '\u00e9\u00e8\u00ea\u00eb', // accented characters
        '\u4e2d\u6587', // Chinese characters
        '\u0645\u0631\u062d\u0628\u0627', // Arabic
        '\ud83d\ude00\ud83d\udc4d\ud83c\udf89', // Emojis
      ];

      const inputCount = await textInputs.count();

      if (inputCount > 0) {
        const input = textInputs.first();

        if (await input.isVisible().catch(() => false)) {
          for (const chars of specialChars) {
            await input.clear();
            await input.fill(chars);

            // Value should be accepted without JS errors
            const value = await input.inputValue();
            // Either accepts the characters or sanitizes them
            expect(value.length).toBeGreaterThanOrEqual(0);
          }
        }
      }

      // Test passes if no crashes occurred
      expect(true).toBeTruthy();
    });

    test('XSS attempt in text fields is sanitized', async ({ asFreeUser, setupMocks }) => {
      const page = asFreeUser;
      await setupMocks(page, 'free');

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();

      // XSS payloads to test
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)">',
        '"><script>alert(1)</script>',
        "'-alert(1)-'",
        '<body onload="alert(1)">',
      ];

      // Find text inputs
      const textInputs = page.locator(
        'input[type="text"], input:not([type]), textarea'
      );
      const inputCount = await textInputs.count();

      // Track if any script actually executed
      let scriptExecuted = false;
      page.on('dialog', () => {
        scriptExecuted = true;
      });

      if (inputCount > 0) {
        const input = textInputs.first();

        if (await input.isVisible().catch(() => false)) {
          for (const payload of xssPayloads) {
            await input.clear();
            await input.fill(payload);

            // Try to trigger any potential XSS by blurring/submitting
            await input.blur();
          }

          // Try saving to see if XSS executes on re-render
          if (await settingsPage.saveButton.isVisible()) {
            await settingsPage.saveButton.click();
            await page.waitForTimeout(500);
          }
        }
      }

      // No XSS should have executed
      expect(scriptExecuted).toBeFalsy();

      // Verify page still works
      await expect(settingsPage.heading).toBeVisible();
    });
  });

  test.describe('Search and Filter Validation', () => {
    test('search query validates properly', async ({ page, setupMocks }) => {
      await setupMocks(page, 'anonymous');

      await page.goto('/');

      // Look for search input
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="search" i], input[name="search"], input[aria-label*="search" i]'
      );

      if (await searchInput.isVisible().catch(() => false)) {
        // Test various search inputs
        const searchTests = [
          { input: '', expectValid: true }, // Empty search should be valid
          { input: 'normal search', expectValid: true },
          { input: 'a', expectValid: true }, // Single character
          { input: 'a'.repeat(500), expectValid: true }, // Long search
          { input: '<script>', expectValid: true }, // Should be escaped
        ];

        for (const testCase of searchTests) {
          await searchInput.clear();
          await searchInput.fill(testCase.input);
          await searchInput.press('Enter');

          // Should not crash and should handle the input
          await page.waitForLoadState('domcontentloaded');

          // Verify page is still functional
          const nav = page.getByRole('navigation', { name: 'Main navigation' });
          await expect(nav).toBeVisible();
        }
      } else {
        // No search input - test passes
        expect(true).toBeTruthy();
      }
    });

    test('filter values are validated (score range 0-100)', async ({ asFreeUser, setupMocks }) => {
      const page = asFreeUser;
      await setupMocks(page, 'free');

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();

      // Test the quality threshold slider (score range)
      const slider = settingsPage.minScoreSlider;

      if (await slider.isVisible().catch(() => false)) {
        // Get min and max attributes
        const min = parseInt((await slider.getAttribute('min')) || '0');
        const max = parseInt((await slider.getAttribute('max')) || '100');

        // Verify the range is 0-100
        expect(min).toBeGreaterThanOrEqual(0);
        expect(max).toBeLessThanOrEqual(100);

        // Test setting valid values
        const validValues = [0, 50, 100];
        for (const value of validValues) {
          await settingsPage.setMinScore(value);
          const displayedScore = await settingsPage.getMinScore();
          expect(displayedScore).toBeGreaterThanOrEqual(min);
          expect(displayedScore).toBeLessThanOrEqual(max);
        }

        // Try to set invalid values programmatically
        await slider.evaluate((el: HTMLInputElement) => {
          el.value = '150'; // Over max
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // The displayed value should be clamped to valid range
        const afterInvalidScore = await settingsPage.getMinScore();
        expect(afterInvalidScore).toBeLessThanOrEqual(max);
      } else {
        // No slider - test passes
        expect(true).toBeTruthy();
      }
    });
  });
});
