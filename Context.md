# Context - Working Memory

> **Purpose**: Current state of ZeroToShip. Read this at session start, update it at session end.

**Last Updated**: 2026-02-15

---

## Current Focus

**Ready for soft launch.** Full smoke test passed (auth, dashboard, archive, billing, email, mobile, admin). Production migrations applied (0006–0008). Pipeline runs daily in graph mode. 2 friends dogfooding. Remaining items are ops hardening (Redis, Sentry, Resend webhooks) — not blockers for early users.

## What's Done

All core modules are built, tested, deployed, and running in production:

- **Scrapers**: Reddit (28 subreddits), HN (Algolia API), GitHub (Octokit, 10+ star repos). Twitter removed from UI (non-functional, no API key, all Nitter instances dead).
- **Analysis**: Deduplicator (Union-Find clustering, O(n^2)), Scorer (AI + heuristic + 48hr score cache), Gap Analyzer (SerpAPI with Brave fallback)
- **Generation**: Two providers available:
  - **Legacy**: Single Claude call per brief (default, stable)
  - **Graph**: Multi-node pipeline with model cascade (Claude 4.5 snapshots), section-aware retries, synthesis, budget controls, trace visualization. Selectable via `GENERATION_MODE=graph` env var.
- **Delivery**: Email (Resend, redesigned daily digest, unsubscribe flow), Web Dashboard (Next.js 15)
- **API**: Fastify with Supabase auth, SHA-256 hashed API keys, DB-backed isAdmin, Redis rate limiting (in-memory fallback), tier gating, usage tracking
- **Payments**: Stripe integration (checkout, webhooks, billing portal). Production flow hardened (Feb 14).
- **Scheduler**: Cron orchestrator with DB-only persistence, resume, retries, metrics, pipeline lock (Redis-backed)
- **Database**: Supabase PostgreSQL, Drizzle ORM, 12 migration files, seed data
- **Deployment**: Railway (API + scheduler with keepalive HTTP), Vercel (web, auto-deploy gated on CI), Docker configs
- **Auth**: Email/password + Google OAuth (Identity Services popup + backend code exchange for mobile) + GitHub OAuth via Supabase
- **Content**: Landing page (11 sections), launch posts (HN, Twitter, IH, PH), email onboarding drip (welcome + day 1/3/7)
- **CI/CD**: GitHub Actions (build + type check + tests on push/PR to main), Vercel deploy gated on CI
- **Frontend**: ProtectedLayout, AuthForm (shared), icon components, normalizeIdeas, infinite scroll archive, grid layout with modal expansion, dark mode (next-themes), bookmark/save feature, sorting (newest/top scored/lowest effort/A-Z)
- **Analytics**: PostHog (8 events across 7 pages)
- **Email Logs**: Per-recipient delivery tracking, Resend webhook (open/bounce/complaint), admin UI with run filtering
- **Admin Console**: Pipeline control (trigger/config), run history with trace view (Mermaid diagrams), user management, email logs, tier switcher, generation diagnostics
- **SEO**: Dynamic sitemap, robots.txt, JSON-LD structured data, OG images (root + per-idea), public /explore page, blog scaffold
- **Brand**: Cohesive identity across web + email, favicon, webmanifest, Logo component
- **Security**: IDOR patches, SHA-256 API key hashing, tier gate enforcement, content filtering pipeline
- **Plan Review (Feb 7)**: All 16 issues resolved — see `reviews/plan-review-2026-02-07.md`

## What's Left (Pre-Launch)

- [x] Run remaining Drizzle migrations in production (0006 email_logs, 0007 hash_api_keys, 0008 drop_users_tier) — applied 2026-02-15
- [x] Backfill `keyHash` for existing API keys in production — done 2026-02-15
- [x] Set `isAdmin=true` for admin users in production DB — already set
- [x] Full manual smoke test (signup → email confirm → dashboard → brief → archive → billing → mobile) — passed 2026-02-15
- [ ] Refresh 3 email snapshot tests (template copy changed, snapshots stale)
- [ ] Provision Redis on Railway and set `REDIS_URL` env var (in-memory fallback works at small scale)
- [ ] Configure Resend webhook in dashboard → `/api/webhooks/resend`, set `RESEND_WEBHOOK_SECRET`
- [ ] Set up monitoring (UptimeRobot + Sentry)
- [ ] Write Show HN post, finalize Product Hunt listing
- [ ] **Soft launch** → share in communities, gather feedback
- [ ] **Big launch** → Show HN + Product Hunt

## Active Decisions

| Decision | Status | Choice |
|----------|--------|--------|
| Database | Decided | Supabase (auth + pgvector) |
| AI Provider | Decided | Anthropic Claude (text), OpenAI (embeddings only) |
| Deployment | Decided | Vercel (web) + Railway (API/scheduler) + Supabase (DB) |
| Twitter/X | Decided | Removed from UI. Non-functional (no bearer token, Nitter dead). Replace post-launch with Bluesky/dev.to/Lobsters. |
| Generation mode | Decided | Legacy provider is default. Graph provider available via `GENERATION_MODE=graph`. Cron path fixed (was silently falling back to legacy due to shallow config merge). |
| Tier naming | Decided | Free / Builder ($19/mo) / Enterprise ($99/mo). Internal identifiers remain `'pro'`. |

## Cost Profile

- **Pipeline cost**: ~$0.05-0.07/run (legacy mode), higher with graph mode
- **Monthly at daily runs**: ~$1.50-2.10/mo (legacy)
- **Model tiers**: Free=Haiku, Builder=Sonnet, Enterprise=Opus

## Monetization

| Tier | Price | Offering |
|------|-------|----------|
| Free | $0 | Top 3 ideas (problem + solution only) |
| Builder | $19/mo | Full daily report (10 ideas + briefs) |
| Enterprise | $99/mo | API + custom filters + history |

**Target**: 1,000 free → 50 Builder = $950/mo MRR

## Tech Stack

- **Backend**: TypeScript, Fastify, Drizzle ORM, Zod
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Database**: PostgreSQL (Supabase)
- **Cache/Rate Limiting**: Redis (ioredis) with in-memory fallback
- **AI**: Anthropic Claude (scoring, briefs), OpenAI (embeddings)
- **Email**: Resend
- **Payments**: Stripe
- **Hosting**: Railway (API/scheduler), Vercel (web)
- **CI**: GitHub Actions
- **Analytics**: PostHog

## Known Issues

- 3 email snapshot tests failing (stale after template copy updates — need `npx vitest run -u tests/delivery/email.test.ts`)
- Twitter scraper non-functional (removed from UI, still in codebase)
- Redis not yet provisioned in Railway — rate limiting falls back to in-memory
- Pre-existing test timeouts in gap-analyzer.test.ts (2 tests), orchestrator.test.ts (1 test), hackernews.test.ts (2 tests)
- ~~Duplicate `detectSignals()` function~~ — resolved (consolidated to signals.ts)
- ~~OAuth issues (PKCE, mobile, SSR)~~ — resolved with Google Identity Services + backend code exchange
- ~~5 pre-existing failures in `oauth.test.ts`~~ — resolved (10 tests passing)

## Key Files

| File | Purpose |
|------|---------|
| `Feature-Plan.md` | Architecture overview + future enhancements roadmap |
| `Strategy-Analysis.md` | Competitive landscape, market sizing, 90-day plan |
| `reviews/plan-review-2026-02-07.md` | Plan review — 16/16 issues complete |
| `src/config/env.ts` | Centralized config with Zod validation |
| `src/scheduler/cli.ts` | Pipeline entry point |
| `src/scheduler/orchestrator.ts` | Pipeline orchestration with DB persistence |
| `src/api/server.ts` | API server entry point |
| `src/api/db/schema.ts` | Database schema (Drizzle) |
| `src/generation/providers/selector.ts` | Generation mode selection (legacy vs graph) |
| `web/app/` | Frontend pages |

## Recent Changes

| Date | Change |
|------|--------|
| 2026-02-15 | Launch prep: production migrations 0007+0008 applied, key_prefix backfilled, smoke test passed all flows |
| 2026-02-15 | Feat: email unsubscribe flow (public API endpoint + /unsubscribe page), sets email_frequency to 'never' |
| 2026-02-15 | Fix: admin tier switcher persists through refresh (/auth/me + /user/subscription now respect X-Tier-Override, synthetic subscription for free users) |
| 2026-02-15 | Fix: email rate limiting (concurrency 5→2, delay 100→600ms) to stay under Resend free-tier 2 req/s |
| 2026-02-15 | Fix: graph mode now works on Railway cron (deep-merge pipelineConfig in startScheduler, add --generation-mode CLI flag, 24 new tests) |
| 2026-02-15 | Graph generation: budget controls, concurrency limits, trace timeline (Mermaid), aggregate run view, diagnostics for budget stops |
| 2026-02-15 | Handoff system: phase 4 gap enrichment hook with n8n client + mock provider |
| 2026-02-15 | Ops fixes: graph-mode scheduling, fresh ideas/today query, Resend sender config, timezone handling |
| 2026-02-15 | Admin: email log errors + run filter, running pipeline status indicator, run detail polling |
| 2026-02-15 | UX: revenue pill truncation, humanized build time/revenue in emails, expanded metric acronyms, signup email confirmation handling |
| 2026-02-14 | Generation overhaul: graph model cascade with Claude 4.5 snapshots, section-aware retries + synthesis, provider seam with mode selection |
| 2026-02-14 | Billing: hardened Stripe production flow, checkout UX improvements, Stripe config validation tests, webhook idempotency tests |
| 2026-02-14 | Pipeline: phase 0 generation diagnostics + admin visibility, Anthropic retries + hardened idea persistence |
| 2026-02-14 | Admin: run trace view for graph runs, dark-mode contrast fix for generated briefs |
| 2026-02-14 | Misc: email unsubscribe toggle, landing nav root anchors, dashboard types self-contained for Vercel build, e2e scroll stabilization |
| 2026-02-13 | SEO: public /explore page, dynamic sitemap, robots.txt, JSON-LD structured data, OG images, blog scaffold |
| 2026-02-13 | Email: redesigned daily digest for engagement + conversion, full briefs shown for free tier (archive filters locked instead) |
| 2026-02-13 | Refactor: derive tier from subscriptions (dropped users.tier column), extract JSON parser, fix N+1 onboarding query, pipeline lock |
| 2026-02-13 | OAuth: Google Identity Services popup, backend code exchange for mobile, dynamic import for SSR safety, multiple mobile fixes |
| 2026-02-13 | User feedback: sorting/pricing/naming/UI polish fixes (issues 3-10), platform SVG icons on archive |
| 2026-02-12 | Plan review complete: IDOR patches, shared Anthropic wrapper (8→1 calls), Union-Find clustering (O(n^3)→O(n^2)), 52 billing tests |
| 2026-02-12 | Features: bookmarks, PostHog analytics, onboarding email drip, content filter, brand identity, email logs with Resend webhooks |
| 2026-02-12 | Infra: GitHub Actions CI, Vercel auto-deploy gated on CI, Railway keepalive HTTP, per-service Railway config |
| 2026-02-11 | Rename Pro → Builder across 19 files. Fix Google OAuth (PKCE exchange). Admin email logs. Dark mode. Settings cleanup. GitHub scraper fix. |
| 2026-02-10 | Plan review 16 issues resolved. Security (SHA-256 keys, isAdmin, tier gate). Architecture (DB persistence, Redis rate limiting). CI. 51 new tests. |
| 2026-02-09 | Deployed to Railway + Vercel. Rebrand IdeaForge → ZeroToShip (145 files). Landing page redesign. Strategic analysis. OAuth. Admin console. |
