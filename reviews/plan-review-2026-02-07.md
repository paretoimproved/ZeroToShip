# ZeroToShip Plan Review — 2026-02-07

Comprehensive 4-section review (Architecture, Code Quality, Tests, Performance) with 16 issues identified and user-approved decisions.

## Implementation Priority Order

Work through tiers in order. Within each tier, issues are sequenced by dependency.

### Tier 1 — Foundations (do first, other things depend on these)

- [ ] **Issue 1**: Centralized Config Module
- [ ] **Issue 6**: Typed Error Classes
- [ ] **Issue 7**: Named Constants

### Tier 2 — Core Architecture

- [ ] **Issue 5**: Scraper DRY Refactor
- [ ] **Issue 13**: Parallel Scrapers
- [ ] **Issue 2**: Pipeline Intermediate Persistence
- [ ] **Issue 15**: Scraper Result Limits

### Tier 3 — API & Frontend

- [ ] **Issue 8**: Thin Controllers (ideas.ts, billing.ts)
- [ ] **Issue 16**: API Pagination
- [ ] **Issue 4**: Shared Types + npm Workspaces
- [ ] **Issue 3**: Auth Audit + Integration Tests

### Tier 4 — Testing (do after refactoring)

- [ ] **Issue 11**: Pipeline Integration Tests
- [ ] **Issue 10**: Stronger API Test Assertions
- [ ] **Issue 9**: Delivery Module Tests
- [ ] **Issue 14**: Pipeline-Level Dedup
- [ ] **Issue 12**: Frontend web/lib/ Unit Tests

---

## Section 1: Architecture

### Issue 1 — Centralized Config Module with Zod Validation

**Decision**: Option A — Create `src/config/env.ts`

**Problem**: Critical configuration is scattered as hardcoded literals with no startup validation.
- `src/api/server.ts:31` — Port defaults to `3001` inline
- `src/scheduler/index.ts:8-9` — Cron schedule hardcoded (`'0 6 * * *'`)
- `src/api/middleware/rateLimit.ts` — Rate limit windows as magic numbers
- No validation that required env vars are present — app crashes at runtime when first used

**Implementation**:
1. Create `src/config/env.ts` with Zod schema for all env vars
2. Validate at startup in `server.ts` and `scheduler/index.ts`
3. Export typed config object — all modules import from it
4. Replace all `process.env.X` references throughout codebase

**Effort**: Medium (1-2 days)

---

### Issue 2 — Pipeline Intermediate Persistence

**Decision**: Option A — Persist phase results between pipeline phases

**Problem**: Orchestrator (`src/scheduler/orchestrator.ts`) passes data between phases entirely in-memory. If phase 3 fails, phases 1-2 results are lost. Can't re-run individual phases.

**Implementation**:
1. After each phase completes, persist results to DB or disk
2. On failure, allow resuming from last completed phase
3. Keep sequential execution (no event bus needed)
4. Add phase status tracking to know where to resume

**Effort**: Medium (2-3 days)

---

### Issue 3 — Auth Audit + Integration Tests

**Decision**: Option A+B — Audit all routes AND add auth integration tests

**Problem**: Auth boundary between frontend and API is underspecified. No consistent `requireAuth`/`requireTier` pattern. Easy to accidentally add unprotected routes.

**Implementation**:
1. Audit every route in `src/api/routes/` for proper auth guards
2. Add explicit `requireAuth` / `requireTier` decorators
3. Write integration tests that verify unauthenticated requests are rejected on every protected route
4. Document the auth architecture

**Effort**: Medium (1-2 days)

---

### Issue 4 — Shared Types Package + npm Workspaces

**Decision**: Option A — Create `packages/shared/` with API types

**Problem**: No shared types between backend and frontend. API response shapes may drift. `web/package-lock.json` and root `package-lock.json` are separate with unclear workspace relationship.

**Implementation**:
1. Create `packages/shared/` with API request/response types
2. Configure npm workspaces in root `package.json`
3. Add TypeScript project references
4. Replace duplicated types in both `src/` and `web/` with imports from shared

**Effort**: Medium (1-2 days)

---

## Section 2: Code Quality

### Issue 5 — Scraper DRY Refactor (BaseScraper + Shared Utils)

**Decision**: Option A — Centralize shared scraper logic

**Problem**: All 4 scrapers (`src/scrapers/reddit.ts`, `hn.ts`, `twitter.ts`, `github.ts`) reimplement the same patterns: keyword lists, signal detection, error handling, date filtering, text cleaning.

**Implementation**:
1. Create `src/scrapers/shared.ts` with:
   - Shared pain-point keyword list
   - `containsPainPoint()` / signal detection
   - Text/HTML cleaning utilities
   - Date filtering helpers
   - Error handling wrapper (using Issue 6's typed errors)
2. Each scraper implements only source-specific fetch + parse logic
3. Consider a `BaseScraper` abstract class or composition pattern

**Effort**: Medium (1-2 days). Depends on Issue 6 (typed errors).

---

### Issue 6 — Typed Error Classes

**Decision**: Option A — Domain-specific error classes with fatal vs. degraded semantics

**Problem**: Inconsistent error handling. Some paths swallow errors silently:
- `src/scrapers/twitter.ts` — catch returns empty array, masking failures
- `src/analysis/scoring.ts` — Bad API response defaults to score 0
- `src/delivery/email.ts` — Send failures caught and logged, users silently don't get emails
- `src/api/routes/ideas.ts` — Generic 500s lose error context

**Implementation**:
1. Create `src/lib/errors.ts` with: `ScraperError`, `AnalysisError`, `DeliveryError`, `ApiError`
2. Each error class carries severity (fatal vs. degraded)
3. Pipeline orchestrator inspects severity to decide: stop or continue
4. Existing retry utility (`src/scheduler/utils/retry.ts`) serves as the pattern to follow

**Effort**: Medium (1-2 days)

---

### Issue 7 — Named Constants

**Decision**: Option A — Extract magic numbers to named constants

**Problem**: Numeric literals throughout with no named constants:
- `src/analysis/clustering.ts` — Similarity thresholds `0.85`, `0.7`
- `src/scrapers/reddit.ts` — `25` posts per page, `3600000` ms
- `src/generation/briefGenerator.ts` — Token limits `4096`, temperature `0.7`
- `src/scheduler/utils/retry.ts` — Retry counts `3`, backoff `2`, max delay `30000`

**Implementation**:
1. Each module gets constants at the top or in a `constants.ts` file
2. Names like `SIMILARITY_THRESHOLD`, `MAX_RETRY_ATTEMPTS`, `ANTHROPIC_MAX_TOKENS`
3. Configurable values should go into Issue 1's centralized config
4. Non-configurable values stay as module-level named constants

**Effort**: Low-medium (half day - 1 day). Builds on Issue 1.

---

### Issue 8 — Thin Controllers (ideas.ts + billing.ts)

**Decision**: Option B — Refactor the two fattest route handlers only

**Problem**: Route handlers in `src/api/routes/ideas.ts` and `billing.ts` contain business logic (filtering, sorting, transformation, Stripe logic) instead of delegating to services.

**Implementation**:
1. Move business logic from `ideas.ts` route handlers into `src/api/services/ideas.ts`
2. Move Stripe logic from `billing.ts` into `src/api/services/billing.ts`
3. Route handlers become: parse request -> call service -> format response
4. Sets the pattern for future routes

**Effort**: Low (half day)

---

## Section 3: Test Coverage

### Issue 9 — Comprehensive Delivery Module Tests

**Decision**: Option A — Template snapshots + Resend mock + error handling tests

**Problem**: `src/delivery/` has zero unit tests. Email is what users actually see.

**Implementation**:
1. Create `tests/delivery/email.test.ts`
2. Snapshot tests for HTML email template rendering
3. Mock Resend SDK, test send happy path + failure paths
4. Test data assembly and formatting logic
5. Test error handling for failed sends (ties into Issue 6)

**Effort**: Medium (1-2 days)

---

### Issue 10 — Stronger API Test Assertions + Negative Cases

**Decision**: Option A — Body assertions + negative test cases

**Problem**: API tests only check status codes, not response body structure or edge cases.
- `tests/api/ideas.test.ts` — checks `200` but not body shape
- Missing: 404 for nonexistent ideas, 400 for bad params, 422 for validation, DB error handling

**Implementation**:
1. Create test helper that auto-validates responses against Zod schemas
2. Add response body assertions to all existing API tests
3. Add negative test cases: invalid input, missing resources, auth failures
4. Add DB error simulation tests

**Effort**: Medium (1-2 days). Best done after Issue 8 (thin controllers).

---

### Issue 11 — Pipeline Integration Tests with Mocked Phases

**Decision**: Option A — Test full pipeline flow including failure modes

**Problem**: `runPipeline()` in `src/scheduler/orchestrator.ts` is the core product function but has no test. Phase interactions and error propagation are untested.

**Implementation**:
1. Create `tests/scheduler/orchestrator.test.ts`
2. Mock each phase to return controlled data
3. Test cases:
   - Happy path (all phases succeed)
   - Phase returns empty results
   - Phase fails (verify short-circuit behavior)
   - Partial results handling
   - Pipeline metrics/logging integration
4. After Issue 2 (persistence): add resume-from-phase tests

**Effort**: Medium (1-2 days). Best done after Issue 2.

---

### Issue 12 — Frontend web/lib/ Unit Tests

**Decision**: Option B — Test utilities only, no component tests

**Problem**: Frontend has 34 Playwright e2e tests but zero unit tests. `web/lib/api-client.ts` (auth tokens, request formatting, error handling) is the most critical untested code.

**Implementation**:
1. Add Vitest config for `web/` (or extend root config)
2. Create `web/lib/__tests__/api-client.test.ts`
3. Test: auth token handling, request formatting, error mapping
4. Test any other utility functions in `web/lib/`

**Effort**: Low (half day)

---

## Section 4: Performance

### Issue 13 — Parallel Scrapers with Promise.allSettled()

**Decision**: Option A — Run all 4 scrapers concurrently

**Problem**: Scrapers run sequentially in the pipeline's scrape phase. Each involves network I/O. 4 sequential scrapers = 2-4 minutes of I/O wait. They're completely independent.

**Implementation**:
1. In the scrape phase, replace sequential calls with `Promise.allSettled()`
2. Collect results: successes go forward, failures get logged (ties into Issue 6)
3. Aggregate results into the same format the analyze phase expects

**Effort**: Low (few hours). Depends on Issue 6 (error aggregation).

---

### Issue 14 — Pipeline-Level Dedup for API Responses

**Decision**: Option B — Check if post was recently scored by ID/URL, skip re-scoring

**Problem**: Anthropic API calls for scoring/generation are expensive. No dedup — re-running the pipeline re-scores everything. Same post across consecutive days gets re-scored.

**Implementation**:
1. Before scoring, check DB for recent scores by post ID or URL
2. If scored within last 24-48 hours, reuse the existing score
3. Skip re-scoring, pass through to next phase
4. Naturally builds on Issue 2 (intermediate persistence)

**Effort**: Low-medium (half day - 1 day). Best done after Issue 2.

---

### Issue 15 — Scraper Result Limits

**Decision**: Option B — Cap each scraper's output

**Problem**: No limits on scraper output. A viral thread could flood the pipeline with thousands of posts, causing OOM and massive Anthropic API costs. Clustering is O(n^2) space.

**Implementation**:
1. Add `MAX_POSTS_PER_SOURCE` constant (e.g., 500) — ties into Issue 7
2. Each scraper truncates results after the limit
3. Sort by signal strength before truncating (keep the best)

**Effort**: Low (few hours)

---

### Issue 16 — Simple Limit/Offset API Pagination

**Decision**: Option B — Add limit/offset to list endpoints

**Problem**: API routes fetch all matching records without pagination. Response sizes grow unboundedly as users accumulate ideas.

**Implementation**:
1. Add `limit` (default 50, max 100) and `offset` query params with Zod validation
2. Apply `.limit()` and `.offset()` to Drizzle queries
3. Include total count in response for frontend pagination UI
4. Apply to `/api/v1/ideas` and other list endpoints

**Effort**: Low (half day)

---

## Dependency Graph

```
Issue 1 (Config) ──> Issue 7 (Constants)
Issue 6 (Errors) ──> Issue 5 (Scraper DRY)
                 ──> Issue 13 (Parallel Scrapers)
Issue 2 (Pipeline Persistence) ──> Issue 11 (Pipeline Tests)
                               ──> Issue 14 (Pipeline Dedup)
Issue 8 (Thin Controllers) ──> Issue 10 (API Tests)
```

## Total Estimated Effort

| Tier | Issues | Effort |
|------|--------|--------|
| Tier 1 (Foundations) | 1, 6, 7 | 3-5 days |
| Tier 2 (Core Architecture) | 5, 13, 2, 15 | 4-7 days |
| Tier 3 (API & Frontend) | 8, 16, 4, 3 | 3-5 days |
| Tier 4 (Testing) | 11, 10, 9, 14, 12 | 4-7 days |
| **Total** | **16 issues** | **~14-24 days** |
