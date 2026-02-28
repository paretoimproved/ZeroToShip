# Handoff: Stripe Production Payments — Sandbox to Live

## Session Metadata
- Created: 2026-02-12 18:13:27
- Project: /Users/brandonqueener/Desktop/github/Projects/IdeaForge
- Branch: main
- Session duration: ~45 minutes

### Recent Commits (for context)
  - 1054f3a Fix Google OAuth on mobile: handle redirect flow in handleOAuthCallback
  - a443960 Fix user test feedback issues 3–10: sorting, pricing, naming, and UI polish
  - ee8e5e8 Fix Google button missing on mobile: dynamic import for SSR safety
  - e9bd1dc Use backend code exchange for Google OAuth to fix mobile
  - 3458723 Fix login crash: fall back to redirect when Google Client ID missing

> Note: The Stripe hardening changes from this session have NOT been committed yet.

## Handoff Chain

- **Continues from**: None (fresh start)
- **Supersedes**: None

## Current State Summary

Implemented all code changes for Stripe production hardening: webhook idempotency, structured logging, config validation, checkout success UX, and setup script safety. Build passes, 1323/1326 tests pass (3 pre-existing email snapshot failures, unrelated). The `db:push` command was attempted but hit an interactive prompt about an unrelated `key_prefix` column in `api_keys` — needs to be run manually in a terminal. No changes have been committed yet. The remaining work is purely operational (Stripe Dashboard config, env vars, deploy).

## Codebase Understanding

### Architecture Overview

ZeroToShip is a monorepo SaaS app: Fastify API backend + Next.js frontend + Drizzle ORM on Supabase PostgreSQL. Stripe integration handles subscriptions with 3 tiers (free/pro/enterprise). Webhooks verify signatures via raw body parsing. Pino logger is the standard (CLAUDE.md forbids console.log in new code). Config is centralized in `src/config/env.ts` with Zod validation.

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `src/api/db/schema.ts` | Drizzle schema — all tables | Added `webhookEvents` table after `subscriptions` |
| `src/api/services/billing.ts` | Stripe checkout, portal, webhook handlers | Core of all webhook hardening changes |
| `src/api/routes/webhooks.ts` | Fastify route for POST /api/webhooks/stripe | Signature verification + event dispatch |
| `src/api/config/stripe.ts` | Stripe client, price mappings, config constants | Added `validateStripeConfig()` |
| `src/api/server.ts` | Fastify server setup, route registration | Calls `validateStripeConfig()` after routes |
| `web/app/account/page.tsx` | Account/subscription management page | Added success banner + polling |
| `scripts/stripe-setup.ts` | Creates Stripe products/prices | Added live mode safety prompt |
| `src/config/env.ts` | Centralized env config with Zod | Source of all Stripe env vars |
| `src/lib/logger.ts` | Pino logger instance | Used by all structured logging |

### Key Patterns Discovered

- **Mock pattern for billing tests**: Uses `vi.hoisted()` for mock functions, then `vi.mock()` factory callbacks. The idempotency check queries `webhookEvents` table while handlers query `subscriptions` — test mock uses a dispatcher that routes based on the select argument (`wh_id` vs `userId`) to keep existing tests working.
- **Fastify request logging**: Use `request.log.error()` inside route handlers (not imported logger) for request-scoped context.
- **Config access**: Always via `config` object from `src/config/env.ts`, never `process.env` directly in business logic.
- **Stripe proxy pattern**: `stripe` export is a Proxy over lazy `getStripe()` for backwards compat.

## Work Completed

### Tasks Finished

- [x] 1A: Added `webhookEvents` table to schema
- [x] 1B: Added idempotency guard (`isEventAlreadyProcessed` + `recordProcessedEvent`) to `handleWebhookEvent`
- [x] 1C: Replaced all 14 `console.log`/`console.error` calls with structured pino logger in billing.ts and webhooks.ts
- [x] 1D: Added `validateStripeConfig()` to stripe.ts, wired into server.ts
- [x] 1E: Created tests for idempotency (4 tests) and config validation (6 tests)
- [x] 2A: Added success banner + subscription polling + Suspense wrapper to account page
- [x] 2B: Created account success test file (4 tests)
- [x] 3A: Added live mode safety confirmation to stripe-setup.ts
- [x] 3B: Updated .env.example with production guidance
- [x] Fixed existing billing tests (52 tests) to work with idempotency layer

### Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| `src/api/db/schema.ts` | Added `webhookEvents` pgTable after line 223 | Idempotency tracking for Stripe webhook events |
| `src/api/services/billing.ts` | Added `webhookEvents` + `logger` imports, added `isEventAlreadyProcessed()` + `recordProcessedEvent()` helpers, rewrote `handleWebhookEvent` with idempotency guard + try/catch, replaced all 14 console calls with logger | Prevent duplicate webhook processing, structured logging |
| `src/api/routes/webhooks.ts` | Replaced `console.error` on line 58 with `request.log.error` | Structured logging with request context |
| `src/api/config/stripe.ts` | Added `import logger`, added `validateStripeConfig()` function | Warn on test keys, localhost URLs, missing config in production |
| `src/api/server.ts` | Added `import { validateStripeConfig }`, call after route registration | Run validation on server startup |
| `web/app/account/page.tsx` | Added `Suspense` + `useSearchParams` imports, renamed to `AccountPageContent`, added success state/polling effect/banner JSX, added Suspense wrapper default export | Checkout success UX with webhook race condition handling |
| `scripts/stripe-setup.ts` | Added `sk_live_` detection + readline confirmation in `main()` | Prevent accidental live product creation |
| `.env.example` | Updated Stripe section with webhook events, setup script reference, production URL examples | Production guidance |
| `tests/api/services/billing.test.ts` | Added `mockDbInsert` to hoisted mocks, added `webhookEvents` + `insert` + `logger` to db client mock, added smart select dispatcher for idempotency | Existing 52 tests work with new idempotency layer |
| `tests/api/webhook-idempotency.test.ts` | New file: 4 tests | Idempotency: skip duplicates, process new, record errors, log unhandled |
| `tests/api/stripe-config-validation.test.ts` | New file: 6 tests | Config validation: test key, localhost, non-prod, clean, missing secret, missing prices |
| `web/components/__tests__/account-success.test.tsx` | New file: 4 tests | Success banner: show/hide, dismiss, polling |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Use ES import for logger in stripe.ts | `require()` (lazy) vs ES `import` | `require()` with relative paths isn't intercepted by vitest mocks; ES import works cleanly |
| Smart select dispatcher in billing tests | Fix every test individually vs dispatcher | Dispatcher routes idempotency queries (by `wh_id` arg) to empty results automatically — avoids touching 20+ test setups |
| `onConflictDoNothing` for event recording | Upsert vs conflict-ignore | Race condition safe: two concurrent handlers for same event won't clash |

## Pending Work

## Immediate Next Steps

1. **Run `npm run db:push` in terminal** — interactive prompt needs human input (asks about `key_prefix` column in `api_keys` — select "create column"). This creates the `webhook_events` table.
2. **Create live Stripe products**: `STRIPE_SECRET_KEY=sk_live_... npx ts-node scripts/stripe-setup.ts` — copy the 4 price IDs
3. **Create webhook endpoint in Stripe Dashboard**: URL `https://zerotoship.dev/api/webhooks/stripe`, events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` — copy signing secret
4. **Set production env vars**: live secret key, webhook secret, 4 price IDs, production URLs (see .env.example for full list)
5. **Deploy** and verify no `PRODUCTION:` warnings in startup logs
6. **Commit all changes** — nothing has been committed yet

### Blockers/Open Questions

- [ ] `db:push` requires manual terminal run due to interactive prompt about `key_prefix` column
- [ ] User needs Stripe Dashboard access for webhook endpoint creation
- [ ] User needs deployment platform access for production env vars

### Deferred Items

- 3 pre-existing email snapshot test failures in `tests/delivery/email.test.ts` (template title changes, unrelated to Stripe)
- Additional hardening opportunities identified during exploration: DB indexes on Stripe IDs, transaction boundaries, subscription state machine validation

## Context for Resuming Agent

## Important Context

- **Nothing is committed.** All changes are in the working tree. A `git diff` will show everything.
- **Build passes.** `npm run build` succeeds.
- **Tests: 1323 pass, 3 fail.** The 3 failures are pre-existing email snapshot mismatches — not caused by this session's changes.
- **The `db:push` prompt** is about a `key_prefix` column in `api_keys` that was added to the schema in a previous session but never pushed. Select "create column" (not rename).
- **CLAUDE.md rules**: Never use `console.log` in new code (use pino logger). Never modify schema without migration. Tests required for new features.

### Assumptions Made

- The 3 email snapshot failures existed before this session (not caused by our changes)
- Production domain is `zerotoship.dev`
- Stripe API version `2025-01-27.acacia` is compatible with the live environment
- The `key_prefix` column prompt in `db:push` should use "create column" (not rename from existing)

### Potential Gotchas

- The billing test mock uses `webhookEvents.id = 'wh_id'` as a sentinel to distinguish idempotency queries from handler queries in the select dispatcher. If someone changes this value, existing tests will break.
- `validateStripeConfig()` runs synchronously at server startup — if logger isn't initialized yet, it could fail. Currently works because logger is a module-level singleton.
- The account page's `useSearchParams` requires the `Suspense` wrapper — removing it causes a Next.js hydration error.

## Environment State

### Tools/Services Used

- Vitest for testing
- Drizzle ORM + drizzle-kit for schema management
- Pino for structured logging
- Stripe SDK v20.3.0

### Active Processes

- None running

### Environment Variables

Required for going live (names only):
- `STRIPE_SECRET_KEY` (needs `sk_live_*`)
- `STRIPE_WEBHOOK_SECRET` (from Stripe Dashboard)
- `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_ENT_MONTHLY`, `STRIPE_PRICE_ENT_YEARLY`
- `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL`, `BILLING_PORTAL_RETURN_URL`

## Related Resources

- Plan file: `~/.claude/plans/glowing-wondering-penguin.md`
- Stripe docs: https://docs.stripe.com/webhooks
- Project guidelines: `CLAUDE.md`
- Context doc: `Context.md`

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
