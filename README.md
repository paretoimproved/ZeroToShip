# ZeroToShip

Automated SaaS that scrapes the web for technical pain points and generates prioritized business briefs for aspiring founders. Pipeline runs daily, delivers ideas by email, and serves a tier-gated web dashboard.

**Live**: [zerotoship.dev](https://zerotoship.dev)

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  DAILY PIPELINE (cron, 5 AM PT)                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Scrape (Parallel)         Analyze (Parallel)      Deliver   │
│  ┌─────────────────┐       ┌───────────────┐      ┌────────┐│
│  │ Reddit Scraper   │──┐    │ Deduplicator  │──┐   │ Email  ││
│  ├─────────────────┤  │    ├───────────────┤  │   │Delivery││
│  │ HN Scraper       │──┼──▶│ Scorer        │──┼──▶├────────┤│
│  ├─────────────────┤  │    ├───────────────┤  │   │  Web   ││
│  │ GitHub Scraper   │──┘    │ Gap Analyzer  │──┤   │Dashboard││
│  └─────────────────┘       ├───────────────┤  │   ├────────┤│
│                             │Brief Generator│──┘   │  API   ││
│                             └───────────────┘      └────────┘│
└───────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | TypeScript, Fastify, Drizzle ORM, Zod |
| **Frontend** | Next.js 15 (App Router), React 19, Tailwind CSS |
| **Database** | PostgreSQL (Supabase) |
| **AI** | Anthropic Claude (scoring + briefs), OpenAI (embeddings) |
| **Email** | Resend |
| **Payments** | Stripe (checkout, webhooks, billing portal) |
| **Hosting** | Railway (API + scheduler), Vercel (web) |
| **Cache** | Redis (ioredis) with in-memory fallback |
| **CI/CD** | GitHub Actions → Vercel auto-deploy |
| **Analytics** | PostHog |
| **Monitoring** | Sentry, pipeline watchdog, alerting (Slack/SMS/PagerDuty) |

## Monorepo Structure

```
src/
  scrapers/       Data collection (Reddit, HN, GitHub)
  analysis/       Clustering, scoring, gap analysis, embeddings
  generation/     AI brief generation (legacy + graph providers)
  delivery/       Email sending, onboarding drip
  api/            Fastify REST API, middleware, services
  api/db/         Drizzle schema and database client
  scheduler/      Pipeline orchestration, cron, watchdog
  config/         Environment, models, Redis
  lib/            Logger, Anthropic client, semaphore, errors
packages/shared/  Types shared between backend and frontend
web/              Next.js frontend (separate workspace)
tests/            Mirrors src/ structure
drizzle/          SQL migrations
scripts/          DB seed, Stripe setup, utilities
```

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.

# Run database migrations
npm run db:push

# Start API server
npm run dev:api

# Start web frontend (separate terminal)
npm run web:dev

# Run pipeline once
npm run scheduler:run

# Start cron scheduler
npm run scheduler:start
```

## Key Commands

```bash
# Backend
npm run build              # Compile TypeScript
npm test                   # Run backend tests (Vitest)
npm run dev:api            # Start Fastify API server

# Frontend
npm run web:dev            # Next.js dev server
npm run web:build          # Production build
npm run web:test           # Frontend unit tests
npm run web:test:e2e       # Playwright E2E tests

# Scheduler
npm run scheduler:run      # Run pipeline once
npm run scheduler:dry-run  # Dry run (no emails)
npm run scheduler:start    # Start cron scheduler
npm run scheduler:health   # Check environment
npm run scheduler:watchdog # Monitor pipeline health

# Database
npm run db:generate        # Generate Drizzle migrations
npm run db:push            # Push schema to DB
npm run db:studio          # Open Drizzle Studio
npm run db:seed            # Seed with sample data

# Validation
npm run validate-costs     # Validate AI cost estimates
npx tsc --noEmit           # Type check
```

## Pipeline

The scheduler runs four phases daily:

1. **Scrape** — Collects posts from Reddit (28 subreddits), Hacker News (Algolia API), and GitHub (issues from 500+ star repos). 50+ pain point signal patterns.
2. **Analyze** — Deduplicates via OpenAI embeddings (cosine similarity 0.85), scores with AI + heuristic hybrid, runs gap analysis (SerpAPI/Brave + AI competitor research).
3. **Generate** — Produces structured business briefs via Claude. Two modes:
   - **Legacy**: Single Claude call per brief (default)
   - **Graph**: Multi-node pipeline with model cascade, section-aware retries, synthesis, budget controls. Enable with `GENERATION_MODE=graph`.
4. **Deliver** — Sends tier-based email digests via Resend and persists briefs to the database for the web dashboard.

## Generation Modes

| Mode | Model | Description |
|------|-------|-------------|
| **Legacy** | Sonnet 4.6 | Single-pass brief generation. Stable default. |
| **Graph** | Cascade (configurable) | Multi-attempt with critic evaluation, section retries, synthesis node, budget caps, trace visualization. |

Graph mode is controlled by environment variables:
- `GENERATION_MODE=graph` — Enable graph provider
- `GRAPH_MAX_ATTEMPTS` — Max retry attempts per brief (default: 2)
- `GRAPH_MAX_SECTION_RETRIES` — Per-section retry cap (default: 1)
- `GRAPH_MAX_CONCURRENT_BRIEFS` — Concurrent brief generation (default: 5)
- `GRAPH_RUN_BUDGET_USD` / `GRAPH_RUN_BUDGET_TOKENS` — Run-level budget caps
- `BRIEF_GENERATION_TIMEOUT_MS` — API call timeout (default: 180000)

## Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 3 ideas/day, problem + solution summary |
| **Builder** | $19/mo | 10 ideas/day, full briefs, archive, priority delivery |
| **Enterprise** | $99/mo | Unlimited, API access, custom filters, export, history |

## Configuration

See `.env.example` for all environment variables. Key categories:

- **AI**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- **Database**: `DATABASE_URL` or `SUPABASE_DB_URL`
- **Auth**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Google OAuth
- **Email**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- **Payments**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs
- **Scheduler**: `SCHEDULER_CRON`, `SCHEDULER_TIMEZONE`, `GENERATION_MODE`
- **Monitoring**: `SENTRY_DSN`, `ALERT_EMAIL`, `ALERT_SLACK_WEBHOOK`

## Testing

```bash
npm test                   # 1395+ backend tests across 55 files
npm run web:test           # Frontend unit tests
npm run web:test:e2e       # Playwright E2E (journeys, accessibility, edge cases)
```

Tests mock all external APIs. No real API calls in tests.

## Documentation

| Document | Purpose |
|----------|---------|
| `Context.md` | Current project state and working memory |
| `Feature-Plan.md` | Architecture, roadmap, competitive analysis |
| `Strategy-Analysis.md` | Market sizing, competitive landscape, 90-day plan |
| `docs/architecture/` | C4 architecture diagrams (context, container, component, deployment) |
| `docs/planning/` | LangGraph migration roadmap, decision log, KPIs |
| `reviews/` | Code reviews, plan review (16/16 complete) |
| `reviews/career/` | Interview-ready project evidence |

## Career Demo Docs

For interview-ready project evidence:

1. `reviews/career/README.md`
2. `reviews/career/impact-scoreboard.md`
3. `reviews/career/experiment-log.md`
4. `reviews/career/decision-log.md`
5. `reviews/career/weekly-build-log.md`
6. `demos/README.md`

## License

MIT
