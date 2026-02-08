# E2E Test Notes

## Bugs — Fixed

### 1. Settings/Account pages missing "Sign In" option — FIXED
- **Pages**: `/settings`, `/account`
- **Fix**: Added "Already have an account? Sign In" link below the Sign Up CTA.

### 2. Idea detail page gates ALL content for anonymous users — FIXED
- **Page**: `/idea/[id]` (`BriefView.tsx`)
- **Fix**: First 3 sections (Problem Statement, Existing Solutions, Market Gaps) now show as teasers. Gate card appears after them. Remaining 6 sections hidden when gated.

### 3. `setupMocks` uses wrong page for authenticated user fixtures — FIXED
- **File**: `e2e/fixtures/test-data.fixture.ts`
- **Fix**: `setupMocks` now accepts a `Page` parameter. All test call sites updated.

### 4. Auth gates block authenticated users under `SKIP_AUTH=true` — FIXED
- **File**: `e2e/fixtures/auth.fixture.ts`
- **Fix**: Authenticated fixtures now inject fake `zerotoship_token` into localStorage.

## Bugs — Open

### 5. Free User: Checkout triggers error (Step 6)
- **Test**: `free-user.journey.spec.ts` Step 6
- **Error**: `accountPage.hasError()` returns `true` — clicking "Upgrade to Pro" triggers `createCheckoutSession()` which calls a real API endpoint that isn't mocked, resulting in a network error.
- **Fix**: Add a mock for the checkout/billing API endpoint in `setupAllApiMocks`, or mock it in the test directly.

### 6. Pro User: Range slider `setMinScore(75)` reads back 50 (Step 4)
- **Test**: `pro-user.journey.spec.ts` Step 4
- **Error**: `settingsPage.setMinScore(75)` sets the range input but `getMinScore()` returns 50 (the default). Likely a Playwright interaction issue with `<input type="range">` — the `fill()` or `inputValue` method may not trigger React's `onChange`.
- **Fix**: Check `SettingsPage.setMinScore()` implementation. May need to use `page.evaluate()` to set value and dispatch an input event, or use `locator.fill()` with proper event triggering.

### 7. Enterprise User: "API Keys" section missing (Step 5)
- **Test**: `enterprise-user.journey.spec.ts` Step 5
- **Error**: Test expects `section:has(h2:text("API Keys"))` on the settings page, but this feature hasn't been built yet.
- **Fix**: Add an "API Keys" section to the settings page for enterprise users, or adjust the test to skip this check if the feature isn't implemented.

## Test Run Results

### Anonymous Visitor Journey
- **Status**: PASS (all 6 steps)
- **Date**: 2026-02-07

### Free User Journey
- **Status**: FAIL at Step 6 (Steps 1-5 pass)
- **Error**: Checkout triggers error — billing API not mocked
- **Date**: 2026-02-07

### Pro User Journey
- **Status**: FAIL at Step 4 (Steps 1-3 pass)
- **Error**: Range slider value not updating correctly
- **Date**: 2026-02-07

### Enterprise User Journey
- **Status**: FAIL at Step 5 (Steps 1-4 pass)
- **Error**: "API Keys" section not built
- **Date**: 2026-02-07

## Summary

Anonymous passes fully. All authenticated tests now get deep into their journeys after fixing the mock page binding and auth token injection. Remaining failures are:
- **Free**: Missing billing/checkout mock (infrastructure)
- **Pro**: Range slider interaction bug (test utility)
- **Enterprise**: Missing "API Keys" feature (app code)
