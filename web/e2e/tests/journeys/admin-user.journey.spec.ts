/**
 * Admin User Journey
 *
 * End-to-end journey simulating an admin user exploring the admin console:
 * viewing the admin dashboard with stats, navigating admin sidebar,
 * inspecting pipeline status and triggering a run, viewing the users table,
 * using the tier switcher to simulate different personas, verifying the
 * Admin nav link and tier override badge in the NavBar.
 */

import { test, expect } from '../../fixtures';
import { AdminDashboardPage, AdminPipelinePage, AdminUsersPage } from '../../pages/admin.page';
import { setupAdminApiMocks } from '../../utils/api-mock.utils';
import { annotate, journeyPause } from '../../utils/journey-helpers';

test.describe('Journey: Admin User', () => {
  test.slow();
  test.setTimeout(120_000);

  test('complete admin user journey', async ({ asEnterpriseUser, setupMocks }) => {
    const page = asEnterpriseUser;

    // Set up standard mocks for the app + admin-specific mocks
    await setupMocks(page, 'enterprise');
    await setupAdminApiMocks(page);

    // ---------------------------------------------------------------
    // Step 1: Navigate to admin dashboard
    // ---------------------------------------------------------------
    await test.step('Step 1: Admin Dashboard — stats overview', async () => {
      await annotate(page, 'Step 1: Admin Dashboard — stats overview', { color: '#d97706' });

      await page.goto('/admin');
      await page.waitForLoadState('domcontentloaded');

      const dashboardPage = new AdminDashboardPage(page);

      // Should see the Admin Dashboard heading
      await expect(dashboardPage.heading).toBeVisible({ timeout: 10000 });

      // Should see sidebar navigation
      const hasSidebar = await dashboardPage.hasSidebar();
      expect(hasSidebar).toBe(true);

      // Sidebar should have all admin nav links
      await expect(dashboardPage.dashboardLink).toBeVisible();
      await expect(dashboardPage.pipelineLink).toBeVisible();
      await expect(dashboardPage.usersLink).toBeVisible();

      // Should see stat cards with values
      const statValues = await dashboardPage.getStatCardValues();
      expect(statValues.length).toBeGreaterThanOrEqual(4);

      // Verify mock data appears
      expect(statValues).toContain('142');  // totalUsers
      expect(statValues).toContain('38');   // activeSubscribers
      expect(statValues).toContain('7');    // ideasToday

      // Should see pipeline status section
      const pipelineSection = page.locator('text="Pipeline Status"');
      await expect(pipelineSection).toBeVisible();

      // Should have a Run Pipeline link
      await expect(dashboardPage.runPipelineButton).toBeVisible();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 2: Admin NavBar link visible
    // ---------------------------------------------------------------
    await test.step('Step 2: Admin link visible in NavBar', async () => {
      await annotate(page, 'Step 2: Admin link in NavBar', { color: '#d97706' });

      const adminNavLink = page.locator('nav a:has-text("Admin")');
      await expect(adminNavLink).toBeVisible();

      // Should have amber styling
      const className = await adminNavLink.getAttribute('class');
      expect(className).toContain('amber');

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 3: Navigate to Pipeline page
    // ---------------------------------------------------------------
    await test.step('Step 3: Pipeline control page', async () => {
      await annotate(page, 'Step 3: Pipeline control page', { color: '#d97706' });

      const dashboardPage = new AdminDashboardPage(page);
      await dashboardPage.goToPipeline();

      const pipelinePage = new AdminPipelinePage(page);
      await expect(pipelinePage.heading).toBeVisible({ timeout: 10000 });

      // Should see trigger form controls
      await expect(pipelinePage.dryRunCheckbox).toBeVisible();
      await expect(pipelinePage.skipDeliveryCheckbox).toBeVisible();
      await expect(pipelinePage.hoursBackInput).toBeVisible();
      await expect(pipelinePage.maxBriefsInput).toBeVisible();
      await expect(pipelinePage.runButton).toBeVisible();

      // Should see status panel with phase badges
      const phaseBadges = await pipelinePage.getPhaseBadgeTexts();
      expect(phaseBadges.length).toBeGreaterThanOrEqual(4);
      expect(phaseBadges).toContain('scrape');
      expect(phaseBadges).toContain('analyze');
      expect(phaseBadges).toContain('generate');
      expect(phaseBadges).toContain('deliver');

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 4: Configure and trigger a pipeline run
    // ---------------------------------------------------------------
    await test.step('Step 4: Trigger pipeline run', async () => {
      await annotate(page, 'Step 4: Trigger pipeline run', { color: '#d97706' });

      const pipelinePage = new AdminPipelinePage(page);

      // Configure options
      await pipelinePage.setDryRun(true);
      await pipelinePage.setSkipDelivery(true);
      await pipelinePage.setHoursBack('12');
      await pipelinePage.setMaxBriefs('5');

      // Trigger the pipeline
      await pipelinePage.triggerPipeline();

      // Should see status message
      const statusMessage = page.locator('text="Pipeline run started"');
      await expect(statusMessage).toBeVisible({ timeout: 5000 });

      // Button should show "Running..." state
      const runningButton = page.locator('button:has-text("Running...")');
      await expect(runningButton).toBeVisible();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 5: Navigate to Users page
    // ---------------------------------------------------------------
    await test.step('Step 5: Users page', async () => {
      await annotate(page, 'Step 5: Users page', { color: '#d97706' });

      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      const usersPage = new AdminUsersPage(page);
      await expect(usersPage.heading).toBeVisible({ timeout: 10000 });

      // Should have table headers
      const hasHeaders = await usersPage.hasTableHeaders();
      expect(hasHeaders).toBe(true);

      // Should show mock users
      const userCount = await usersPage.getUserCount();
      expect(userCount).toBe(3);

      // Should show correct user emails
      const emails = await usersPage.getUserEmails();
      expect(emails).toContain('admin@ideaforge.io');
      expect(emails).toContain('pro@example.com');
      expect(emails).toContain('free@example.com');

      // Should show tier badges
      const tierBadges = page.locator('span.rounded-full');
      const badgeCount = await tierBadges.count();
      expect(badgeCount).toBe(3);

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 6: Tier Switcher — open and select override
    // ---------------------------------------------------------------
    await test.step('Step 6: Tier Switcher widget', async () => {
      await annotate(page, 'Step 6: Tier Switcher widget', { color: '#d97706' });

      // The tier switcher is a fixed-position button at bottom-right
      const tierSwitcherButton = page.locator('button:has-text("Tier Switcher")');
      await expect(tierSwitcherButton).toBeVisible();

      // Click to open dropdown
      await tierSwitcherButton.click();

      // Should show tier options
      const freeOption = page.locator('button:has-text("Free")');
      const proOption = page.locator('button:has-text("Pro")');
      const enterpriseOption = page.locator('button:has-text("Enterprise")');
      const anonymousOption = page.locator('button:has-text("Anonymous")');

      await expect(freeOption).toBeVisible();
      await expect(proOption).toBeVisible();
      await expect(enterpriseOption).toBeVisible();
      await expect(anonymousOption).toBeVisible();

      // Select "Free" tier override
      await freeOption.click();

      // Button should now show override is active with amber color
      const overrideButton = page.locator('button:has-text("Viewing as: Free")');
      await expect(overrideButton).toBeVisible();

      // NavBar should show tier override badge
      const tierBadge = page.locator('nav span:has-text("free")');
      await expect(tierBadge).toBeVisible();

      // Verify sessionStorage was set
      const storedTier = await page.evaluate(() => {
        return sessionStorage.getItem('ideaforge_tier_override');
      });
      expect(storedTier).toBe('free');

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 7: Clear tier override
    // ---------------------------------------------------------------
    await test.step('Step 7: Clear tier override', async () => {
      await annotate(page, 'Step 7: Clear tier override', { color: '#d97706' });

      // Click tier switcher button (now showing override)
      const overrideButton = page.locator('button:has-text("Viewing as:")');
      await overrideButton.click();

      // Select "Real (Admin)" to clear override
      const realOption = page.locator('button:has-text("Real (Admin)")');
      await expect(realOption).toBeVisible();
      await realOption.click();

      // Button should revert to default label
      const defaultButton = page.locator('button:has-text("Tier Switcher")');
      await expect(defaultButton).toBeVisible();

      // sessionStorage should be cleared
      const storedTier = await page.evaluate(() => {
        return sessionStorage.getItem('ideaforge_tier_override');
      });
      expect(storedTier).toBeNull();

      // Tier badge in nav should be gone
      const tierBadge = page.locator('nav span:has-text("free")');
      await expect(tierBadge).not.toBeVisible();

      await journeyPause(page);
    });

    // ---------------------------------------------------------------
    // Step 8: Non-admin access denied
    // ---------------------------------------------------------------
    await test.step('Step 8: Non-admin sees Access Denied', async () => {
      await annotate(page, 'Step 8: Non-admin Access Denied check', { color: '#059669' });

      // Override the auth/me mock to return a non-admin user
      await page.route('**/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'regular-user-123',
            email: 'regular@example.com',
            name: 'Regular User',
            tier: 'free',
            isAdmin: false,
          }),
        });
      });

      // Navigate to admin — should reload with new auth state
      await page.goto('/admin');
      await page.waitForLoadState('domcontentloaded');

      // Should see Access Denied
      const accessDenied = page.locator('text="Access Denied"');
      await expect(accessDenied).toBeVisible({ timeout: 10000 });

      // Should have a link to go back to dashboard
      const dashboardLink = page.locator('a:has-text("Go to Dashboard")');
      await expect(dashboardLink).toBeVisible();

      await journeyPause(page);
    });
  });
});
