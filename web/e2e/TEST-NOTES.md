# E2E Test Notes

## Bugs to Fix

### 1. Settings/Account pages missing "Sign In" option
- **Pages**: `/settings`, `/account`
- **Issue**: Auth gate only shows "Sign Up" button linking to `/landing`. No "Sign In" option for returning users who already have an account.
- **Fix**: Add a "Sign In" link alongside the "Sign Up" CTA.

### 2. Idea detail page gates ALL content for anonymous users
- **Page**: `/idea/[id]`
- **Issue**: The `gated` prop on `BriefView` hides all 9 detail sections. Anonymous users see only the header + quick stats + gate card — no teaser content to motivate signup.
- **Fix**: Show some sections as teasers (e.g., Problem Statement, Existing Solutions) and gate the deeper analysis (Technical Spec, Business Model, Go-to-Market).

### 3. `setupMocks` uses wrong page for authenticated user fixtures
- **File**: `e2e/fixtures/test-data.fixture.ts:53`
- **Issue**: `setupMocks` binds `page.route()` calls to the default `page` fixture, but `asFreeUser`/`asProUser`/`asEnterpriseUser` create their own browser context with a separate page. Mocks are set up on the wrong page, so the homepage falls back to hardcoded mock data (1 idea) instead of the tier-appropriate mock response (3 ideas for free).
- **Fix**: `setupMocks` should accept a `page` parameter, or the authenticated fixtures should pass their page to `setupAllApiMocks` directly.

### 4. Auth gates block authenticated users under `SKIP_AUTH=true`
- **Pages**: `/settings`, `/account`, `/idea/[id]`
- **Issue**: With `SKIP_AUTH=true`, the global setup creates empty storage states (no `ideaforge_token` in localStorage). The new auth gates check `isAuthenticated()` which reads from localStorage, so even free/pro/enterprise users see the auth gate instead of full content.
- **Fix**: Either inject a fake auth token into storage state files for non-anonymous tiers, or have the auth fixtures set `ideaforge_token` in localStorage after creating the context.

## Test Run Results

### Anonymous Visitor Journey
- **Status**: PASS (all 6 steps)
- **Date**: 2026-02-07

### Free User Journey
- **Status**: FAIL at Step 1
- **Error**: Expected 3 ideas, got 1 (mock fallback due to bug #3)
- **Blocked by**: Bug #3 (setupMocks on wrong page), Bug #4 (auth gates block SKIP_AUTH users)
- **Date**: 2026-02-07

### Pro User Journey
- **Status**: FAIL at Step 1
- **Error**: Expected >3 ideas (up to 10 for pro), got 1 (mock fallback due to bug #3)
- **Blocked by**: Bug #3, Bug #4 (same as free user)
- **Date**: 2026-02-07

### Enterprise User Journey
- **Status**: FAIL at Step 1
- **Error**: Expected 6 ideas (all SEED_IDEAS), got 1 (mock fallback due to bug #3)
- **Blocked by**: Bug #3, Bug #4 (same as free user)
- **Date**: 2026-02-07

## Summary

- **Anonymous**: PASS — all client-side fetching + gating works with `page.route()` mocks
- **Free/Pro/Enterprise**: All FAIL at Step 1 with the same two root causes:
  1. **Bug #3**: `setupMocks` sets up `page.route()` on the default `page` fixture, not on the `asFreeUser`/`asProUser`/`asEnterpriseUser` page (different browser context)
  2. **Bug #4**: `SKIP_AUTH=true` creates empty storage states with no `ideaforge_token`, so the auth gates on settings/account/idea-detail block access for all non-anonymous tiers
