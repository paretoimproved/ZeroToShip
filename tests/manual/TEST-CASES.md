# ZeroToShip Manual Test Cases

**Version:** 1.0
**Date:** 2026-02-01
**Author:** QA Test Planner

---

## Table of Contents

1. [Authentication & Auth](#1-authentication--auth)
2. [Billing & Subscriptions](#2-billing--subscriptions)
3. [Ideas & Briefs](#3-ideas--briefs)
4. [User Settings](#4-user-settings)

---

## 1. Authentication & Auth

### TC-AUTH-001: JWT Login with Valid Credentials

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify users can authenticate via Supabase JWT tokens

#### Preconditions
- Valid Supabase user account exists
- API server running
- Valid JWT token obtained from Supabase Auth

#### Test Steps
1. Send GET request to `/api/v1/user/preferences` with header `Authorization: Bearer <valid_jwt>`
   **Expected:** 200 OK with user preferences JSON

2. Verify response includes user-specific data
   **Expected:** Response contains `emailFrequency`, `categories`, `effortFilter` fields

3. Check that `userTier` is set correctly based on subscription
   **Expected:** Tier matches user's subscription (free/pro/enterprise)

#### Test Data
- Valid JWT: Obtain from Supabase Auth login
- Test user: test@example.com

---

### TC-AUTH-002: JWT Login with Invalid Token

**Priority:** P0 (Critical)
**Type:** Security
**Estimated Time:** 2 minutes

#### Objective
Verify invalid JWT tokens are rejected

#### Preconditions
- API server running

#### Test Steps
1. Send GET request to `/api/v1/user/preferences` with header `Authorization: Bearer invalid_token_123`
   **Expected:** 401 Unauthorized

2. Verify error response format
   **Expected:**
   ```json
   {
     "code": "UNAUTHORIZED",
     "message": "Authentication required"
   }
   ```

3. Send request with malformed Authorization header `Authorization: invalid`
   **Expected:** 401 Unauthorized

---

### TC-AUTH-003: JWT Login with Expired Token

**Priority:** P1 (High)
**Type:** Security
**Estimated Time:** 2 minutes

#### Objective
Verify expired JWT tokens are rejected

#### Preconditions
- Expired JWT token (from a previous session)

#### Test Steps
1. Send GET request with expired JWT token
   **Expected:** 401 Unauthorized

2. Verify user cannot access protected endpoints
   **Expected:** All authenticated endpoints return 401

---

### TC-AUTH-004: API Key Authentication (Enterprise)

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify Enterprise users can authenticate via API key

#### Preconditions
- Enterprise tier user account
- Valid API key created (format: `if_<48 alphanumeric chars>`)

#### Test Steps
1. Send GET request to `/api/v1/ideas/today` with header `X-API-Key: <valid_api_key>`
   **Expected:** 200 OK with ideas list

2. Verify Enterprise tier features are accessible
   **Expected:** Full list of ideas returned (not limited to 3)

3. Check that `lastUsedAt` timestamp is updated on API key
   **Expected:** API key record shows recent timestamp

---

### TC-AUTH-005: API Key Authentication - Invalid Key

**Priority:** P0 (Critical)
**Type:** Security
**Estimated Time:** 2 minutes

#### Objective
Verify invalid API keys are rejected

#### Preconditions
- API server running

#### Test Steps
1. Send request with invalid API key `X-API-Key: if_invalidkey123`
   **Expected:** Request treated as anonymous (userTier: anonymous)

2. Verify limited access (anonymous tier limits apply)
   **Expected:** Only 3 ideas returned from `/api/v1/ideas/today`

---

### TC-AUTH-006: API Key Authentication - Expired Key

**Priority:** P1 (High)
**Type:** Security
**Estimated Time:** 2 minutes

#### Objective
Verify expired API keys are rejected

#### Preconditions
- API key with `expiresAt` in the past

#### Test Steps
1. Send request with expired API key
   **Expected:** Request treated as anonymous

2. Verify `isActive` check is enforced
   **Expected:** Deactivated keys also fail authentication

---

### TC-AUTH-007: API Key Authentication - Deactivated Key

**Priority:** P1 (High)
**Type:** Security
**Estimated Time:** 2 minutes

#### Objective
Verify deactivated API keys cannot authenticate

#### Preconditions
- API key that has been deactivated via `/api/v1/user/api-keys/:id/deactivate`

#### Test Steps
1. Attempt to use deactivated API key
   **Expected:** Request treated as anonymous

2. Verify key is still in database but marked inactive
   **Expected:** Key exists with `isActive: false`

---

### TC-AUTH-008: Anonymous Access

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify unauthenticated users have limited anonymous access

#### Preconditions
- API server running
- No authentication headers

#### Test Steps
1. Send GET request to `/api/v1/ideas/today` without auth headers
   **Expected:** 200 OK with limited ideas (max 3)

2. Attempt to access authenticated endpoint `/api/v1/user/preferences`
   **Expected:** 401 Unauthorized

3. Verify rate limits apply (10 requests/hour for anonymous)
   **Expected:** 429 Too Many Requests after 10 requests

---

### TC-AUTH-009: Tier Hierarchy Enforcement

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 5 minutes

#### Objective
Verify tier-based access controls work correctly

#### Preconditions
- Users with free, pro, and enterprise tiers available

#### Test Steps

| Endpoint | Anonymous | Free | Pro | Enterprise |
|----------|-----------|------|-----|------------|
| GET /ideas/today | 3 ideas | 3 ideas | 10 ideas | Unlimited |
| GET /ideas/archive | 403 | 200 | 200 | 200 |
| GET /ideas/:id (full brief) | Truncated | Truncated | Full | Full |
| GET /user/api-keys | 401 | 403 | 403 | 200 |
| POST /api/v1/billing/checkout | 401 | 200 | 200 | 200 |

**Expected:** Each cell matches expected behavior

---

### TC-AUTH-010: Enterprise-Only Endpoints

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify Enterprise-only endpoints reject lower tiers

#### Preconditions
- Pro tier user account

#### Test Steps
1. As Pro user, attempt GET `/api/v1/user/api-keys`
   **Expected:** 403 Forbidden with message "This endpoint requires an Enterprise subscription"

2. As Pro user, attempt POST `/api/v1/user/api-keys`
   **Expected:** 403 Forbidden

3. As Enterprise user, attempt same endpoints
   **Expected:** 200 OK / 201 Created

---

## 2. Billing & Subscriptions

### TC-BILL-001: View Available Prices (Public)

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify prices endpoint returns subscription options

#### Preconditions
- API server running
- Stripe prices configured

#### Test Steps
1. Send GET request to `/api/v1/billing/prices` (no auth required)
   **Expected:** 200 OK with prices array

2. Verify price structure
   **Expected:**
   ```json
   {
     "prices": [
       { "key": "pro_monthly", "amount": 1900, "currency": "usd", "interval": "month", "tier": "pro" },
       { "key": "pro_yearly", "amount": 19000, "currency": "usd", "interval": "year", "tier": "pro" },
       { "key": "enterprise_monthly", "amount": 9900, "currency": "usd", "interval": "month", "tier": "enterprise" },
       { "key": "enterprise_yearly", "amount": 99000, "currency": "usd", "interval": "year", "tier": "enterprise" }
     ]
   }
   ```

---

### TC-BILL-002: Create Checkout Session (Pro Monthly)

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 5 minutes

#### Objective
Verify users can initiate Stripe checkout for Pro subscription

#### Preconditions
- Authenticated free tier user
- Stripe test mode enabled

#### Test Steps
1. Send POST to `/api/v1/billing/checkout` with body:
   ```json
   { "priceKey": "pro_monthly" }
   ```
   **Expected:** 200 OK with checkout URL and session ID

2. Verify response format
   **Expected:**
   ```json
   {
     "url": "https://checkout.stripe.com/...",
     "sessionId": "cs_test_..."
   }
   ```

3. Navigate to checkout URL
   **Expected:** Stripe checkout page loads with Pro plan details

4. Complete test payment with card `4242 4242 4242 4242`
   **Expected:** Success redirect to app

---

### TC-BILL-003: Create Checkout Session (Pro Yearly)

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify yearly billing option works

#### Preconditions
- Authenticated free tier user

#### Test Steps
1. Send POST to `/api/v1/billing/checkout` with `priceKey: "pro_yearly"`
   **Expected:** 200 OK with checkout URL

2. Verify yearly price displayed on checkout page
   **Expected:** Shows $190/year (not $19/month)

---

### TC-BILL-004: Create Checkout Session (Enterprise)

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify Enterprise checkout works

#### Preconditions
- Authenticated user (free or pro)

#### Test Steps
1. Send POST with `priceKey: "enterprise_monthly"`
   **Expected:** 200 OK with checkout URL

2. Verify Enterprise pricing on checkout
   **Expected:** Shows $99/month

---

### TC-BILL-005: Create Checkout - Invalid Price Key

**Priority:** P2 (Medium)
**Type:** Negative
**Estimated Time:** 2 minutes

#### Objective
Verify invalid price keys are rejected

#### Preconditions
- Authenticated user

#### Test Steps
1. Send POST with `priceKey: "invalid_plan"`
   **Expected:** 400 Bad Request (Zod validation fails)

2. Send POST with `priceKey: "free_monthly"`
   **Expected:** 400 Bad Request (not in enum)

---

### TC-BILL-006: Create Checkout - Unauthenticated

**Priority:** P1 (High)
**Type:** Security
**Estimated Time:** 1 minute

#### Objective
Verify checkout requires authentication

#### Preconditions
- No auth headers

#### Test Steps
1. Send POST to `/api/v1/billing/checkout` without auth
   **Expected:** 401 Unauthorized

---

### TC-BILL-007: Access Billing Portal (Paid User)

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify paid users can access Stripe billing portal

#### Preconditions
- User with active Pro or Enterprise subscription
- Stripe customer ID linked

#### Test Steps
1. Send POST to `/api/v1/billing/portal`
   **Expected:** 200 OK with portal URL

2. Navigate to portal URL
   **Expected:** Stripe portal loads with:
   - Current subscription details
   - Payment method management
   - Invoice history
   - Cancellation option

---

### TC-BILL-008: Access Billing Portal (Free User)

**Priority:** P2 (Medium)
**Type:** Negative
**Estimated Time:** 2 minutes

#### Objective
Verify free users can access portal (may be empty)

#### Preconditions
- Free tier user with no Stripe customer record

#### Test Steps
1. Send POST to `/api/v1/billing/portal`
   **Expected:** 400 Bad Request or creates new customer

---

### TC-BILL-009: Get Subscription Status

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify subscription status endpoint returns correct data

#### Preconditions
- User with active subscription

#### Test Steps
1. Send GET to `/api/v1/user/subscription`
   **Expected:** 200 OK with subscription details

2. Verify response fields
   **Expected:**
   ```json
   {
     "id": "sub_...",
     "plan": "pro",
     "status": "active",
     "currentPeriodEnd": "2026-03-01T00:00:00Z",
     "cancelAtPeriodEnd": false
   }
   ```

---

### TC-BILL-010: Subscription Status - Canceled

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify canceled subscription displays correctly

#### Preconditions
- User with subscription set to cancel at period end

#### Test Steps
1. Get subscription status
   **Expected:** `cancelAtPeriodEnd: true` and `status: "active"`

2. Verify access remains until period end
   **Expected:** Pro features still accessible

---

### TC-BILL-011: Subscription Status - Past Due

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify past due subscriptions are handled

#### Preconditions
- User with failed payment (past_due status)

#### Test Steps
1. Get subscription status
   **Expected:** `status: "past_due"`

2. Verify tier access during grace period
   **Expected:** Pro features may be limited (implementation-dependent)

---

### TC-BILL-012: Usage Tracking

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify usage limits are tracked correctly

#### Preconditions
- Pro tier user

#### Test Steps
1. Send GET to `/api/v1/user/usage`
   **Expected:** 200 OK with usage stats

2. Verify response structure
   **Expected:**
   ```json
   {
     "freshBriefsUsed": 2,
     "freshBriefsLimit": 10,
     "freshBriefsRemaining": 8,
     "validationRequestsUsed": 0,
     "validationRequestsLimit": 2,
     "validationRequestsRemaining": 2,
     "overageBriefs": 0,
     "overageAmountCents": 0,
     "canRequestFreshBrief": true,
     "canRequestValidation": true,
     "wouldIncurOverage": false,
     "resetAt": "2026-02-02T00:00:00Z",
     "tier": "pro"
   }
   ```

---

### TC-BILL-013: Usage Limits - Enterprise Overage

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify Enterprise overage pricing works

#### Preconditions
- Enterprise user who has exceeded 50 fresh briefs/day

#### Test Steps
1. Check usage status after exceeding limit
   **Expected:** `wouldIncurOverage: true`, `overagePricePerBrief: 0.15`

2. Request additional brief
   **Expected:** Brief generated, overage tracked

3. Verify overage amount
   **Expected:** `overageAmountCents` incremented by 15

---

## 3. Ideas & Briefs

### TC-IDEAS-001: Get Today's Ideas (Anonymous)

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify anonymous users can view limited today's ideas

#### Preconditions
- API server running
- Ideas generated for today

#### Test Steps
1. Send GET to `/api/v1/ideas/today` without auth
   **Expected:** 200 OK with max 3 ideas

2. Verify response structure
   **Expected:**
   ```json
   {
     "ideas": [...],
     "total": 10,
     "page": 1,
     "pageSize": 3,
     "tier": "anonymous"
   }
   ```

3. Verify briefs are truncated for anonymous users
   **Expected:** `brief` field contains summary only, not full content

---

### TC-IDEAS-002: Get Today's Ideas (Pro)

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify Pro users see all 10 daily ideas

#### Preconditions
- Pro tier authenticated user

#### Test Steps
1. Send GET to `/api/v1/ideas/today` with Pro JWT
   **Expected:** 200 OK with 10 ideas

2. Verify tier in response
   **Expected:** `tier: "pro"`

---

### TC-IDEAS-003: Get Today's Ideas (Enterprise)

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify Enterprise users have unlimited access

#### Preconditions
- Enterprise tier user

#### Test Steps
1. Send GET to `/api/v1/ideas/today`
   **Expected:** All available ideas returned (no limit)

---

### TC-IDEAS-004: Get Single Idea (Anonymous)

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify single idea detail with truncated brief

#### Preconditions
- Valid idea ID exists

#### Test Steps
1. Send GET to `/api/v1/ideas/:id` without auth
   **Expected:** 200 OK with idea details

2. Verify brief is truncated
   **Expected:** Brief summary only, plus upgrade prompt:
   ```json
   {
     "_upgrade": {
       "message": "Upgrade to Pro to see the full business brief",
       "url": "https://zerotoship.dev/pricing"
     }
   }
   ```

---

### TC-IDEAS-005: Get Single Idea (Pro - Full Brief)

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify Pro users see full business briefs

#### Preconditions
- Pro tier user
- Valid idea ID

#### Test Steps
1. Send GET to `/api/v1/ideas/:id` with Pro auth
   **Expected:** 200 OK with full brief content

2. Verify no upgrade prompt
   **Expected:** No `_upgrade` field in response

3. Verify brief includes all sections
   **Expected:** Full brief with problem, solution, market, competition, monetization, etc.

---

### TC-IDEAS-006: Get Idea - Not Found

**Priority:** P2 (Medium)
**Type:** Negative
**Estimated Time:** 1 minute

#### Objective
Verify proper error for non-existent idea

#### Preconditions
- None

#### Test Steps
1. Send GET to `/api/v1/ideas/00000000-0000-0000-0000-000000000000`
   **Expected:** 404 Not Found with:
   ```json
   {
     "code": "NOT_FOUND",
     "message": "Idea not found"
   }
   ```

---

### TC-IDEAS-007: Get Idea - Invalid UUID

**Priority:** P2 (Medium)
**Type:** Validation
**Estimated Time:** 1 minute

#### Objective
Verify UUID validation

#### Preconditions
- None

#### Test Steps
1. Send GET to `/api/v1/ideas/not-a-uuid`
   **Expected:** 400 Bad Request (Zod validation)

---

### TC-IDEAS-008: View Tracking

**Priority:** P2 (Medium)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify idea views are tracked for authenticated users

#### Preconditions
- Authenticated user

#### Test Steps
1. Send GET to `/api/v1/ideas/:id`
   **Expected:** 200 OK

2. Send GET to `/api/v1/user/history`
   **Expected:** Viewed idea appears in history

---

### TC-IDEAS-009: Access Archive (Free)

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify Free users can access archive

#### Preconditions
- Free tier authenticated user

#### Test Steps
1. Send GET to `/api/v1/ideas/archive`
   **Expected:** 200 OK with archived ideas

2. Verify pagination works
   **Expected:** Response includes `page`, `pageSize`, `hasMore`

---

### TC-IDEAS-010: Access Archive (Anonymous)

**Priority:** P1 (High)
**Type:** Negative
**Estimated Time:** 1 minute

#### Objective
Verify anonymous users cannot access archive

#### Preconditions
- No auth

#### Test Steps
1. Send GET to `/api/v1/ideas/archive` without auth
   **Expected:** 403 Forbidden or tier gate error

---

### TC-IDEAS-011: Archive Pagination

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify archive pagination works correctly

#### Preconditions
- Free+ tier user
- 25+ ideas in archive

#### Test Steps
1. Send GET to `/api/v1/ideas/archive?page=1&pageSize=10`
   **Expected:** First 10 ideas, `hasMore: true`

2. Send GET to `/api/v1/ideas/archive?page=2&pageSize=10`
   **Expected:** Next 10 ideas

3. Send GET to `/api/v1/ideas/archive?page=100&pageSize=10`
   **Expected:** Empty array, `hasMore: false`

---

### TC-IDEAS-012: Archive Filtering

**Priority:** P2 (Medium)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify archive filters work

#### Preconditions
- Ideas with various categories and dates

#### Test Steps
1. Filter by category: `/api/v1/ideas/archive?category=developer-tools`
   **Expected:** Only developer-tools ideas returned

2. Filter by date range: `/api/v1/ideas/archive?startDate=2026-01-01&endDate=2026-01-31`
   **Expected:** Only January 2026 ideas

3. Filter by effort: `/api/v1/ideas/archive?effort=weekend`
   **Expected:** Only weekend projects

---

### TC-IDEAS-013: Save Idea (Bookmark)

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify users can save ideas

#### Preconditions
- Authenticated user
- Valid idea ID

#### Test Steps
1. Send POST to `/api/v1/ideas/:id/save`
   **Expected:** 200 OK with `success: true`

2. Save same idea again
   **Expected:** 200 OK with `message: "Already saved"`

3. Verify in history
   **Expected:** Idea appears in saved list

---

### TC-IDEAS-014: Unsave Idea

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify users can unsave ideas

#### Preconditions
- Authenticated user
- Previously saved idea

#### Test Steps
1. Send DELETE to `/api/v1/ideas/:id/save`
   **Expected:** 200 OK with `success: true`

2. Unsave again
   **Expected:** 200 OK with `message: "Was not saved"`

---

### TC-IDEAS-015: Save Idea - Unauthenticated

**Priority:** P1 (High)
**Type:** Security
**Estimated Time:** 1 minute

#### Objective
Verify saving requires authentication

#### Preconditions
- None

#### Test Steps
1. Send POST to `/api/v1/ideas/:id/save` without auth
   **Expected:** 401 Unauthorized

---

### TC-IDEAS-016: Get Categories

**Priority:** P2 (Medium)
**Type:** Functional
**Estimated Time:** 1 minute

#### Objective
Verify categories endpoint works

#### Preconditions
- Ideas with categories exist

#### Test Steps
1. Send GET to `/api/v1/ideas/categories`
   **Expected:** 200 OK with categories array

---

### TC-IDEAS-017: Rate Limiting

**Priority:** P1 (High)
**Type:** Non-Functional
**Estimated Time:** 5 minutes

#### Objective
Verify rate limits are enforced per tier

#### Preconditions
- Test accounts for each tier

#### Test Steps

| Tier | Limit | Test |
|------|-------|------|
| Anonymous | 10/hour | Make 11 requests |
| Free | 100/hour | Make 101 requests |
| Pro | 1000/hour | Make burst of requests |
| Enterprise | 10000/hour | Verify high limit |

**Expected:** 429 Too Many Requests when limit exceeded

---

## 4. User Settings

### TC-SET-001: Get User Preferences

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify preferences are returned correctly

#### Preconditions
- Authenticated user

#### Test Steps
1. Send GET to `/api/v1/user/preferences`
   **Expected:** 200 OK with preferences object

2. Verify default values for new user
   **Expected:**
   ```json
   {
     "emailFrequency": "daily",
     "categories": ["developer-tools", "saas", "ai"],
     "effortFilter": ["weekend", "week"],
     "minPriorityScore": 50
   }
   ```

---

### TC-SET-002: Update Email Frequency

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify email frequency can be updated

#### Preconditions
- Authenticated user

#### Test Steps
1. Send PUT to `/api/v1/user/preferences` with:
   ```json
   { "emailFrequency": "weekly" }
   ```
   **Expected:** 200 OK with updated preferences

2. Verify change persisted
   **Expected:** GET returns `emailFrequency: "weekly"`

3. Test all valid values: daily, weekly, never
   **Expected:** All accepted

---

### TC-SET-003: Update Categories

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify category preferences can be updated

#### Preconditions
- Authenticated user

#### Test Steps
1. Send PUT with:
   ```json
   { "categories": ["fintech", "health"] }
   ```
   **Expected:** 200 OK

2. Verify GET returns updated categories
   **Expected:** `categories: ["fintech", "health"]`

---

### TC-SET-004: Update Effort Filter

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify effort filter can be updated

#### Preconditions
- Authenticated user

#### Test Steps
1. Send PUT with:
   ```json
   { "effortFilter": ["month", "quarter"] }
   ```
   **Expected:** 200 OK

2. Verify valid effort levels: weekend, week, month, quarter
   **Expected:** All accepted

---

### TC-SET-005: Update Minimum Score

**Priority:** P2 (Medium)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify score threshold can be updated

#### Preconditions
- Authenticated user

#### Test Steps
1. Send PUT with:
   ```json
   { "minPriorityScore": 75 }
   ```
   **Expected:** 200 OK

2. Test boundary values: 0, 50, 100
   **Expected:** All accepted

3. Test invalid: -1, 101
   **Expected:** 400 Bad Request (if validated)

---

### TC-SET-006: Get User History

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify history endpoint returns viewed and saved ideas

#### Preconditions
- User with view and save history

#### Test Steps
1. Send GET to `/api/v1/user/history`
   **Expected:** 200 OK with history object

2. Verify structure
   **Expected:** Contains viewed ideas and saved ideas lists

---

### TC-SET-007: List API Keys (Enterprise)

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify Enterprise users can list API keys

#### Preconditions
- Enterprise tier user
- At least one API key created

#### Test Steps
1. Send GET to `/api/v1/user/api-keys`
   **Expected:** 200 OK with keys array

2. Verify key structure (key value NOT returned)
   **Expected:**
   ```json
   {
     "keys": [{
       "id": "uuid",
       "name": "Production Key",
       "lastUsedAt": "2026-02-01T12:00:00Z",
       "expiresAt": null,
       "isActive": true,
       "createdAt": "2026-01-15T00:00:00Z"
     }]
   }
   ```

---

### TC-SET-008: Create API Key (Enterprise)

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify Enterprise users can create API keys

#### Preconditions
- Enterprise tier user

#### Test Steps
1. Send POST to `/api/v1/user/api-keys` with:
   ```json
   { "name": "Test Key" }
   ```
   **Expected:** 201 Created with key value

2. Verify response includes warning
   **Expected:** `message: "API key created. Store it securely - it will not be shown again."`

3. Verify key format
   **Expected:** Key starts with `if_` and is 51 chars total

---

### TC-SET-009: Create API Key with Expiration

**Priority:** P2 (Medium)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify API key expiration can be set

#### Preconditions
- Enterprise tier user

#### Test Steps
1. Send POST with:
   ```json
   { "name": "Temporary Key", "expiresInDays": 30 }
   ```
   **Expected:** 201 Created

2. Verify expiration date is set
   **Expected:** `expiresAt` is 30 days from now

---

### TC-SET-010: Delete API Key

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify API keys can be deleted

#### Preconditions
- Enterprise user with existing API key

#### Test Steps
1. Send DELETE to `/api/v1/user/api-keys/:id`
   **Expected:** 200 OK with `success: true`

2. Verify key no longer works
   **Expected:** Requests with deleted key treated as anonymous

3. Delete non-existent key
   **Expected:** 404 Not Found

---

### TC-SET-011: Deactivate API Key

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify API keys can be deactivated without deletion

#### Preconditions
- Enterprise user with existing API key

#### Test Steps
1. Send POST to `/api/v1/user/api-keys/:id/deactivate`
   **Expected:** 200 OK with `success: true`

2. Verify key no longer authenticates
   **Expected:** Requests fail

3. Verify key still in list
   **Expected:** `isActive: false`

---

### TC-SET-012: Preferences - Unauthenticated

**Priority:** P1 (High)
**Type:** Security
**Estimated Time:** 1 minute

#### Objective
Verify preferences require authentication

#### Preconditions
- None

#### Test Steps
1. Send GET to `/api/v1/user/preferences` without auth
   **Expected:** 401 Unauthorized

2. Send PUT without auth
   **Expected:** 401 Unauthorized

---

### TC-SET-013: API Keys - Non-Enterprise

**Priority:** P1 (High)
**Type:** Security
**Estimated Time:** 2 minutes

#### Objective
Verify non-Enterprise users cannot access API key endpoints

#### Preconditions
- Pro tier user

#### Test Steps
1. Send GET to `/api/v1/user/api-keys`
   **Expected:** 403 Forbidden with "Enterprise subscription" message

2. Send POST to `/api/v1/user/api-keys`
   **Expected:** 403 Forbidden

---

## Web UI Test Cases

### TC-UI-001: Settings Page - Email Preferences

**Priority:** P1 (High)
**Type:** UI
**Estimated Time:** 3 minutes

#### Objective
Verify email settings UI works correctly

#### Preconditions
- Logged in user
- Navigate to /settings

#### Test Steps
1. Verify radio buttons for Daily, Weekly, No emails
   **Expected:** Current selection highlighted

2. Select different option
   **Expected:** Radio updates, saved indicator hidden

3. Click Save Changes
   **Expected:** "Settings saved!" message appears

---

### TC-UI-002: Settings Page - Category Selection

**Priority:** P1 (High)
**Type:** UI
**Estimated Time:** 3 minutes

#### Objective
Verify category toggle UI works

#### Preconditions
- Navigate to /settings

#### Test Steps
1. Verify all category chips displayed
   **Expected:** 8 categories shown

2. Click unselected category
   **Expected:** Category highlighted, added to selection

3. Click selected category
   **Expected:** Category unhighlighted, removed from selection

---

### TC-UI-003: Settings Page - Effort Filter

**Priority:** P1 (High)
**Type:** UI
**Estimated Time:** 2 minutes

#### Objective
Verify effort filter checkboxes work

#### Preconditions
- Navigate to /settings

#### Test Steps
1. Verify checkbox for each effort level
   **Expected:** Weekend Projects, 1-Week Builds, Month-long, Quarter+ shown

2. Toggle checkboxes
   **Expected:** Selection updates

---

### TC-UI-004: Settings Page - Quality Threshold Slider

**Priority:** P2 (Medium)
**Type:** UI
**Estimated Time:** 2 minutes

#### Objective
Verify score threshold slider works

#### Preconditions
- Navigate to /settings

#### Test Steps
1. Verify slider range 0-100
   **Expected:** Current value displayed

2. Drag slider
   **Expected:** Value updates in real-time

---

### TC-UI-005: Settings Page - Theme Toggle

**Priority:** P2 (Medium)
**Type:** UI
**Estimated Time:** 2 minutes

#### Objective
Verify theme selection works

#### Preconditions
- Navigate to /settings

#### Test Steps
1. Verify System, Light, Dark buttons
   **Expected:** Current selection highlighted

2. Click Dark
   **Expected:** Theme changes to dark mode

3. Click Light
   **Expected:** Theme changes to light mode

---

### TC-UI-006: Account Page - Current Plan Display

**Priority:** P0 (Critical)
**Type:** UI
**Estimated Time:** 2 minutes

#### Objective
Verify current subscription displays correctly

#### Preconditions
- Navigate to /account

#### Test Steps
1. Verify plan name displayed (Free/Pro/Enterprise)
   **Expected:** Matches actual subscription

2. Verify status badge (active/canceled/past_due)
   **Expected:** Green for active, red for past_due

3. Verify renewal/cancellation date shown for paid plans
   **Expected:** Date formatted correctly

---

### TC-UI-007: Account Page - Plan Cards

**Priority:** P1 (High)
**Type:** UI
**Estimated Time:** 3 minutes

#### Objective
Verify plan comparison cards display correctly

#### Preconditions
- Navigate to /account

#### Test Steps
1. Verify 3 plan cards (Free, Pro, Enterprise)
   **Expected:** All displayed with features list

2. Verify "Most Popular" badge on Pro
   **Expected:** Badge visible

3. Verify current plan button disabled
   **Expected:** Shows "Current Plan" as disabled

4. Verify upgrade buttons enabled for higher tiers
   **Expected:** Can click to upgrade

---

### TC-UI-008: Account Page - Billing Cycle Toggle

**Priority:** P1 (High)
**Type:** UI
**Estimated Time:** 2 minutes

#### Objective
Verify monthly/yearly toggle works

#### Preconditions
- Navigate to /account

#### Test Steps
1. Verify toggle shows Monthly/Yearly
   **Expected:** Toggle present with discount note

2. Switch to Yearly
   **Expected:** Prices update to yearly amounts

3. Verify "Save 2 months" message
   **Expected:** Shown for yearly plans

---

### TC-UI-009: Account Page - Upgrade Flow

**Priority:** P0 (Critical)
**Type:** E2E
**Estimated Time:** 5 minutes

#### Objective
Verify upgrade initiates Stripe checkout

#### Preconditions
- Free tier user on /account

#### Test Steps
1. Click "Upgrade to Pro" button
   **Expected:** Loading spinner appears

2. Wait for redirect
   **Expected:** Redirected to Stripe checkout

3. Verify checkout shows correct plan
   **Expected:** Pro plan with correct price

---

### TC-UI-010: Account Page - Manage Subscription

**Priority:** P1 (High)
**Type:** UI
**Estimated Time:** 3 minutes

#### Objective
Verify billing portal access for paid users

#### Preconditions
- Pro tier user on /account

#### Test Steps
1. Verify "Manage Subscription" button visible
   **Expected:** Button shown in Current Plan section

2. Click "Manage Subscription"
   **Expected:** Redirected to Stripe portal

3. Verify "Open Billing Portal" in Billing section
   **Expected:** Alternative button available

---

### TC-UI-011: Account Page - Error Handling

**Priority:** P2 (Medium)
**Type:** UI
**Estimated Time:** 2 minutes

#### Objective
Verify errors display properly

#### Preconditions
- Force error (e.g., network failure)

#### Test Steps
1. Trigger checkout failure
   **Expected:** Red error banner with message

2. Verify error is dismissible or auto-clears
   **Expected:** Error handling doesn't block UI

---

### TC-UI-012: Account Page - Loading State

**Priority:** P2 (Medium)
**Type:** UI
**Estimated Time:** 1 minute

#### Objective
Verify loading skeleton displays

#### Preconditions
- Slow network or fresh page load

#### Test Steps
1. Observe initial page load
   **Expected:** Skeleton placeholders animate

2. Wait for data load
   **Expected:** Skeleton replaced with content

---

## Regression Test Suite

### Smoke Tests (15-30 min)

Run before every release:

| Test ID | Description | Priority |
|---------|-------------|----------|
| TC-AUTH-001 | JWT Login Valid | P0 |
| TC-AUTH-002 | JWT Login Invalid | P0 |
| TC-AUTH-004 | API Key Auth | P0 |
| TC-BILL-002 | Create Checkout | P0 |
| TC-IDEAS-001 | Today's Ideas | P0 |
| TC-IDEAS-005 | Full Brief Access | P0 |
| TC-UI-006 | Account Page Display | P0 |
| TC-UI-009 | Upgrade Flow | P0 |

### Full Regression (2-4 hours)

All P0 and P1 test cases.

---

## Test Data Requirements

### Users
- Anonymous (no account)
- Free tier: `free@test.zerotoship.dev`
- Pro tier: `pro@test.zerotoship.dev`
- Enterprise tier: `enterprise@test.zerotoship.dev`
- Canceled subscription: `canceled@test.zerotoship.dev`
- Past due: `pastdue@test.zerotoship.dev`

### API Keys
- Valid Enterprise key: `if_test_enterprise_key_...`
- Expired key: `if_test_expired_key_...`
- Deactivated key: `if_test_deactivated_key_...`

### Ideas
- At least 10 ideas for "today"
- 50+ ideas in archive across categories
- Ideas with all effort levels
- Ideas with varying scores (0-100)

### Stripe Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

---

## Environment Requirements

- **API Server:** Running on `localhost:3000` or staging URL
- **Database:** PostgreSQL with seed data
- **Supabase:** Test project configured
- **Stripe:** Test mode with webhook forwarding

---

## Exit Criteria

- [ ] All P0 tests pass
- [ ] 95%+ P1 tests pass
- [ ] All critical bugs fixed
- [ ] No security vulnerabilities
- [ ] Rate limiting verified
