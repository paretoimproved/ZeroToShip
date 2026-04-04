# Test Plan: Email Delivery Fix (Missing Migration 0010)

**Date:** 2026-03-07
**Feature:** Daily email delivery pipeline
**Root Cause:** Migration `0010_add_unsubscribe_token.sql` not applied to production. The `getActiveSubscribers()` query in `src/scheduler/phases/deliver.ts:33` references `user_preferences.unsubscribe_token`, which did not exist in the production database.
**Fix Applied:** Ran migration 0010 against production (ALTER TABLE, CREATE INDEX, UPDATE 5 rows backfilled).

---

## Executive Summary

- Email delivery has failed on every pipeline run since 2026-03-01
- Root cause: schema-code mismatch (column referenced in code, missing from DB)
- Fix: applied the pending migration to add the `unsubscribe_token` column
- Risk: low (migration is additive, no destructive changes)

---

## Test Scope

**In Scope:**
- Subscriber query (`getActiveSubscribers`) with real schema shape
- Unsubscribe token propagation through delivery flow
- End-to-end pipeline delivery phase (dry run)
- Email log persistence after delivery
- Onboarding drip (runs after delivery, should not regress)

**Out of Scope:**
- Resend API availability (external dependency)
- Email HTML rendering / client compatibility
- Scrape, analyze, generate phases (unrelated to this fix)
- Stripe subscription webhooks

---

## Entry Criteria

- [x] Migration 0010 applied to production
- [x] Column `unsubscribe_token` exists on `user_preferences`
- [x] 5 existing rows backfilled with random tokens
- [ ] `npm run build && npm test` passes locally

## Exit Criteria

- [ ] All P0 test cases pass
- [ ] Dry-run pipeline execution completes with `deliver: [OK]`
- [ ] No regressions in existing delivery tests (1406 test baseline)

---

## Test Cases

### TC-001: Verify migration applied correctly

**Priority:** P0 (Critical)
**Type:** Database validation

#### Steps
1. Connect to production database
2. Run: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'unsubscribe_token';`
   **Expected:** Row returned with `varchar`, `YES` (nullable)
3. Run: `SELECT COUNT(*) FROM user_preferences WHERE unsubscribe_token IS NOT NULL;`
   **Expected:** Count >= 5 (backfilled rows)
4. Run: `SELECT COUNT(*) FROM user_preferences WHERE unsubscribe_token IS NULL;`
   **Expected:** 0 (all rows backfilled)
5. Run: `SELECT indexname FROM pg_indexes WHERE tablename = 'user_preferences' AND indexname = 'user_prefs_unsub_token_idx';`
   **Expected:** Index exists

---

### TC-002: getActiveSubscribers query succeeds

**Priority:** P0 (Critical)
**Type:** Integration
**Command:** `npm run scheduler run --dry-run`

#### Steps
1. Run `npm run scheduler run --dry-run`
   **Expected:** Pipeline completes, `deliver: [OK]` in phase summary
2. Check output for subscriber count
   **Expected:** `subscriberCount` > 0 (matches active subscriptions)
3. Check output for `sent: 0` (dry run skips actual sending)
   **Expected:** `sent: 0`, `dryRun: true`

#### Notes
- Dry run exercises the full `getActiveSubscribers()` query against the live DB
- If the column were still missing, this would fail with a SQL error

---

### TC-003: Unsubscribe token flows through to email

**Priority:** P1 (High)
**Type:** Functional
**File:** `src/delivery/email.ts:110-117`

#### Preconditions
- At least one subscriber has a non-null `unsubscribe_token`

#### Steps
1. Verify `getActiveSubscribers()` returns `unsubscribeToken` field for subscribers with tokens
   **Expected:** `subscriber.unsubscribeToken` is a 64-char hex string
2. Verify `buildUnsubscribeUrl()` constructs URL: `https://zerotoship.dev/unsubscribe?token=<token>`
   **Expected:** URL contains the subscriber's token, properly URI-encoded
3. Verify the email HTML contains a personalized unsubscribe link (not the generic fallback)
   **Expected:** `<a href="https://zerotoship.dev/unsubscribe?token=...">Unsubscribe</a>`

---

### TC-004: Email log persistence after delivery

**Priority:** P1 (High)
**Type:** Integration
**File:** `src/scheduler/phases/deliver.ts:118-141`

#### Steps
1. After a successful pipeline run (non-dry-run), query `email_logs`:
   ```sql
   SELECT * FROM email_logs WHERE run_id = '<latest_run_id>' ORDER BY sent_at DESC;
   ```
   **Expected:** One row per subscriber with `status = 'sent'` or `status = 'failed'`
2. Verify `message_id` is populated for sent emails
   **Expected:** Non-null Resend message ID (e.g., `re_...`)
3. Verify `user_id` matches the subscriber's UUID
   **Expected:** Valid UUID referencing `users.id`

---

### TC-005: Pipeline run completes with "completed" status

**Priority:** P0 (Critical)
**Type:** End-to-end
**Verification:** Wait for next scheduled run (5:00 AM) or trigger manually

#### Steps
1. Trigger pipeline: `npm run scheduler run` (or wait for cron)
2. Check pipeline_runs table:
   ```sql
   SELECT run_id, status, success, stats FROM pipeline_runs ORDER BY created_at DESC LIMIT 1;
   ```
   **Expected:** `status = 'completed'`, `success = true`
3. Check `stats.emailsSent > 0`
   **Expected:** At least 1 email sent (matches subscriber count)
4. Check dashboard — run should show green deliver phase dot
   **Expected:** All 4 phase dots green, status "Completed"

---

### TC-006: All sends failing returns correct status

**Priority:** P2 (Medium)
**Type:** Regression (existing test: deliver.test.ts:228)

#### Steps
1. Run `npm test -- tests/scheduler/phases/deliver.test.ts`
   **Expected:** All 8 tests pass, including "should handle all sends failing"
2. Verify the `success: false` condition: `result.failed > 0 && result.sent === 0`
   **Expected:** Already covered by existing test assertion

---

### TC-007: Subscribers with emailFrequency=never are excluded

**Priority:** P2 (Medium)
**Type:** Regression (existing test: deliver.test.ts:207)

#### Steps
1. Run `npm test -- tests/scheduler/phases/deliver.test.ts`
   **Expected:** "should filter out subscribers with emailFrequency=never" passes
2. Verify the filter: `.filter((row) => row.emailFrequency !== 'never')`
   **Expected:** Already covered by existing test assertion

---

### TC-008: Onboarding drip runs after delivery

**Priority:** P2 (Medium)
**Type:** Regression
**File:** `src/scheduler/phases/deliver.ts:146-162`

#### Steps
1. After a full pipeline run, check logs for onboarding drip processing
   **Expected:** Log line: "Onboarding drip processing complete" with sent/skipped/failed counts
2. Verify onboarding drip failures don't fail the deliver phase
   **Expected:** Deliver phase returns success even if drip fails (non-fatal)

---

## Regression Suite (Automated)

Run before marking fix complete:

```bash
# Full test suite (baseline: 1406 passing)
npm test

# Delivery-specific tests
npm test -- tests/delivery/
npm test -- tests/scheduler/phases/deliver.test.ts
npm test -- tests/lib/resend.test.ts

# Type checking
npx tsc --noEmit

# Build
npm run build
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration applied but token values invalid | Low | Medium | Backfill used `gen_random_bytes(32)` — cryptographically random |
| Unique index conflict on backfilled tokens | Very Low | High | 32-byte random tokens have negligible collision probability |
| Other pending schema diffs not applied | Medium | Medium | Used targeted SQL, not full `db:push` — no surprise changes |
| Resend API key expired (separate issue) | Low | High | Dry-run test (TC-002) validates query; real send (TC-005) validates API |

---

## Test Gaps Identified

**Gap 1: DB mock hides schema mismatches**
The existing `deliver.test.ts` mocks the entire Drizzle query chain (lines 16-31). The `mockSubscribers` helper doesn't include `unsubscribeToken` in its return shape (line 59-64). This means the test never validates that the actual SQL query matches the database schema.

**Recommendation:** Add a schema-shape assertion test that verifies the Drizzle select fields match the expected column set. Alternatively, add an integration test that runs `getActiveSubscribers()` against a test database with the real schema.

**Gap 2: No migration verification in CI**
There's no CI step that checks whether pending migrations have been applied. A `drizzle-kit check` or schema diff step in the deployment pipeline would catch this class of bug.

**Recommendation:** Add a pre-deploy check that compares the Drizzle schema against the live database and fails if there are unapplied changes.

**Gap 3: Mock subscriber shape doesn't match real query output**
The `mockSubscribers` function returns `{ id, email, tier, emailFrequency }` but the real query also returns `unsubscribeToken`. The mock should mirror the real shape.

**Recommendation:** Update `mockSubscribers` to include `unsubscribeToken` field and add a test that verifies it's passed through to the `Subscriber` object.
