# ZeroToShip Business Analysis

**Document Version**: 1.0
**Date**: February 8, 2026
**Classification**: Internal / Strategic

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Audit](#2-product-audit)
3. [Product-Market Gap Analysis](#3-product-market-gap-analysis)
4. [Unit Economics & Financial Model](#4-unit-economics--financial-model)
5. [Risk Register & Mitigation](#5-risk-register--mitigation)
6. [90-Day Strategic Action Plan](#6-90-day-strategic-action-plan)

---

## 1. Executive Summary

### What ZeroToShip Is

ZeroToShip is a production-ready SaaS platform that scrapes four major online communities (Reddit, Hacker News, Twitter/X, and GitHub), identifies recurring pain points using AI-powered analysis, and delivers actionable business briefs to founders daily. The platform operates an automated pipeline: scrape (6 AM UTC), analyze (7 AM), deliver (8 AM) -- converting raw social signal data into structured startup ideas complete with problem statements, market sizing, competitive gap analysis, technical specifications, and go-to-market strategies.

### Current State

The product is in its **pre-launch infrastructure phase** with the core pipeline fully operational. The codebase comprises 18,819 lines of TypeScript across a Fastify API backend, Next.js 15 frontend, and shared type package. The system includes 9 database tables (Drizzle ORM / Supabase), 20+ API endpoints, 1,051 tests, and complete Stripe billing integration with three tiers ($0 / $19 / $99). Remaining work is limited to scheduler finalization, production deployment configuration, and monitoring/alerting setup -- estimated at 1-2 weeks of engineering effort.

### Market Opportunity

The market timing is exceptionally favorable. GummySearch, the closest comparable product with approximately 135,000 users and $29-199/month pricing, has been discontinued, creating a significant vacuum in the social signal intelligence space. No single competitor offers ZeroToShip's combination of multi-source scraping (4 platforms), AI-powered brief generation (Claude-powered structured output), competitive gap analysis, and email-first delivery at its price point. The broader market (Exploding Topics at $39-249/month, SparkToro at $38-112/month, Glimpse at $99/month+) is fragmented, overpriced for indie founders, and focused on trend data rather than actionable startup ideas.

### Key Strengths

- **Multi-source intelligence**: 4 platforms with 50+ signal patterns, providing broader coverage than any single-source competitor
- **Full AI pipeline**: Deduplication (OpenAI embeddings, 0.85 cosine threshold), scoring (AI + heuristic fallback), gap analysis (SerpAPI/Brave + AI), and brief generation (Claude-powered, structured output)
- **Extreme cost efficiency**: Operational cost of ~$0.15-0.25/day ($4.50-7.50/month) enabling 99.5%+ gross margins at scale
- **Comprehensive briefs**: Each idea includes problem statement, market size, competitive gaps, technical spec, business model, and go-to-market strategy -- far beyond what competitors deliver
- **Competitive pricing**: $19/month Pro tier undercuts every direct competitor by 2-10x
- **Strong technical foundation**: Zero `any` types, 1,051 tests, shared Zod-validated type system, AI fallbacks on every call

### Key Risks

- **Solo founder**: Single point of failure for operations, development, and support
- **Unproven market demand**: No paying users yet; conversion assumptions are theoretical
- **Competitive response**: Incumbents (Exploding Topics, SparkToro) could add brief generation features
- **Scraper fragility**: Platform API changes or rate limiting could disrupt data collection
- **Twitter/X dependency**: Nitter fallback instances are unreliable; official API costs may increase

### Strategic Recommendation

**Launch within 30 days.** The GummySearch vacuum is a time-limited opportunity -- emerging competitors (BigIdeasDB, Painpoint, PainOnSocial) are already entering the space. The product is functionally complete; delaying for polish yields diminishing returns while increasing the risk of losing first-mover advantage in the post-GummySearch market. Focus the launch on the **Weekend Builder persona** (25-40 year old developers, $20-50/month tool budget) through Show HN (priority channel, 200-500 expected signups), Product Hunt, and targeted Twitter/Indie Hackers outreach. Target $475 MRR by Month 1 and $950-2,395 MRR by Month 3.

---

## 2. Product Audit

### 2.1 Scrapers

#### Reddit Scraper

| Attribute | Detail |
|-----------|--------|
| **Description** | Monitors 8 subreddits via JSON API for pain point signals |
| **Status** | Complete |
| **Maturity** | High |
| **Files** | `src/scrapers/reddit.ts`, `src/scrapers/signals.ts` |
| **Strengths** | 50+ signal patterns, JSON API (no authentication required), broad subreddit coverage, well-tested pattern matching |
| **Weaknesses** | Reddit may restrict JSON API access; limited to 8 subreddits (expandable but not dynamic) |
| **Risk Factors** | Reddit API policy changes could require OAuth migration; rate limiting at scale |

#### Hacker News Scraper

| Attribute | Detail |
|-----------|--------|
| **Description** | Scrapes Ask HN and Show HN via Algolia API |
| **Status** | Complete |
| **Maturity** | High |
| **Files** | `src/scrapers/hackernews.ts`, `src/scrapers/hn-api.ts` |
| **Strengths** | Algolia API is stable and well-documented; Ask HN is a premium signal source for pain points; Show HN reveals competitive landscape |
| **Weaknesses** | Algolia API has rate limits; HN skews heavily toward developer/technical audiences |
| **Risk Factors** | Low -- Algolia HN API has been stable for years |

#### Twitter/X Scraper

| Attribute | Detail |
|-----------|--------|
| **Description** | Dual-mode scraping via Twitter API v2 (primary) and Nitter instances (fallback) |
| **Status** | Complete |
| **Maturity** | Medium |
| **Files** | `src/scrapers/twitter.ts`, `src/scrapers/twitter-api.ts`, `src/scrapers/twitter-nitter.ts` |
| **Strengths** | Dual-mode architecture provides resilience; API v2 offers structured data; 5 Nitter fallback instances |
| **Weaknesses** | Twitter API v2 costs are unpredictable; Nitter instances are community-maintained and unreliable; X platform is increasingly hostile to scraping |
| **Risk Factors** | HIGH -- Nitter shutdowns are ongoing; Twitter API pricing may increase; data quality varies between sources |

#### GitHub Scraper

| Attribute | Detail |
|-----------|--------|
| **Description** | Monitors 500+ star repositories via Octokit for issues and feature requests |
| **Status** | Complete |
| **Maturity** | High |
| **Files** | `src/scrapers/github.ts`, `src/scrapers/github-api.ts` |
| **Strengths** | Octokit is the official GitHub SDK; high-star repos provide quality signal; issue data is structured |
| **Weaknesses** | GitHub rate limits (5,000 requests/hour authenticated); signals skew toward developer tools |
| **Risk Factors** | Low -- GitHub API is stable and well-supported |

### 2.2 Analysis Pipeline

#### Deduplicator

| Attribute | Detail |
|-----------|--------|
| **Description** | Uses OpenAI embeddings with cosine similarity (threshold 0.85) to detect and merge duplicate pain points |
| **Status** | Complete |
| **Maturity** | High |
| **Files** | `src/analysis/deduplicator.ts`, `src/analysis/embeddings.ts`, `src/analysis/similarity.ts` |
| **Strengths** | Embedding-based approach catches semantic duplicates, not just exact matches; 0.85 threshold is well-calibrated; modular similarity engine |
| **Weaknesses** | OpenAI embedding API adds cost and latency; threshold may need per-category tuning |
| **Risk Factors** | OpenAI API changes or pricing increases; false positives at high volume |

#### Scorer

| Attribute | Detail |
|-----------|--------|
| **Description** | AI-powered scoring with heuristic fallback and score caching |
| **Status** | Complete |
| **Maturity** | High |
| **Files** | `src/analysis/scorer.ts`, `src/analysis/score-prompts.ts`, `src/analysis/score-cache.ts` |
| **Strengths** | AI + heuristic fallback ensures scoring never fails; caching reduces API costs; structured prompts produce consistent scores |
| **Weaknesses** | AI scoring quality depends on prompt engineering; heuristic fallback produces lower-quality scores |
| **Risk Factors** | Score drift over time if AI model behavior changes; cache invalidation strategy unclear |

#### Gap Analyzer

| Attribute | Detail |
|-----------|--------|
| **Description** | Combines web search (SerpAPI/Brave) with AI to identify competitive gaps for each idea |
| **Status** | Complete |
| **Maturity** | Medium |
| **Files** | `src/analysis/gap-analyzer.ts`, `src/analysis/web-search.ts`, `src/analysis/competitor.ts` |
| **Strengths** | Dual search provider (SerpAPI + Brave); AI-synthesized gap analysis; competitive intelligence is a key differentiator |
| **Weaknesses** | Web search adds significant cost and latency; search result quality varies; relies on third-party search APIs |
| **Risk Factors** | SerpAPI/Brave pricing changes; search result quality degradation; AI hallucination in gap analysis |

#### Brief Generator

| Attribute | Detail |
|-----------|--------|
| **Description** | Claude-powered structured brief generation with template fallback |
| **Status** | Complete |
| **Maturity** | High |
| **Files** | `src/generation/brief-generator.ts`, `src/generation/templates.ts`, `src/generation/tech-stacks.ts` |
| **Strengths** | Claude produces high-quality structured output; template system ensures consistent brief format; tech stack recommendations are context-aware; Zod-validated output schema |
| **Weaknesses** | Brief quality ceiling limited by AI model capabilities; template fallback produces generic content |
| **Risk Factors** | Anthropic API pricing changes; model deprecation requiring prompt migration |

### 2.3 Delivery

#### Email (Resend)

| Attribute | Detail |
|-----------|--------|
| **Description** | Tier-based email delivery with HTML templates via Resend |
| **Status** | Complete |
| **Maturity** | High |
| **Files** | `src/delivery/email.ts`, `src/delivery/email-builder.ts`, `src/delivery/templates/daily.html` |
| **Strengths** | Resend is modern, developer-friendly, and affordable; tier-based content filtering works correctly; HTML template is production-ready |
| **Weaknesses** | Single email template (daily only); no weekly digest option built; no plain-text fallback |
| **Risk Factors** | Email deliverability depends on domain reputation (new domain); Resend is a startup -- vendor risk |

#### Dashboard (Next.js 15)

| Attribute | Detail |
|-----------|--------|
| **Description** | Full-featured web application with idea browsing, archive, settings, and account management |
| **Status** | Complete |
| **Maturity** | Medium-High |
| **Files** | `web/app/` (dashboard, archive, idea, settings, account, admin, login, signup pages) |
| **Strengths** | Next.js 15 with modern app directory structure; complete page set (dashboard, archive, individual idea, settings, account, admin, login, signup); Vercel-optimized deployment |
| **Weaknesses** | No mobile optimization confirmed; admin panel exists but capabilities unknown; no PWA support |
| **Risk Factors** | Frontend complexity may slow iteration; Next.js version upgrades can be breaking |

#### API

| Attribute | Detail |
|-----------|--------|
| **Description** | Fastify REST API with JWT + API key authentication, rate limiting, tier gating, and usage tracking |
| **Status** | Complete |
| **Maturity** | High |
| **Files** | `src/api/routes/` (8 route files), `src/api/middleware/` (auth, rateLimit, tierGate, usageLimit), `src/api/services/` (billing, ideas, usage, users) |
| **Strengths** | Clean service/route separation; comprehensive middleware stack (auth, rate limiting, tier gating, usage limits); Stripe webhook handling; health check endpoint; schema-validated responses via Zod |
| **Weaknesses** | No GraphQL option; no WebSocket support for real-time features; API documentation not confirmed |
| **Risk Factors** | Low -- Fastify is a mature, high-performance framework |

### 2.4 Infrastructure

#### Database (Supabase / PostgreSQL)

| Attribute | Detail |
|-----------|--------|
| **Description** | 9 tables with Drizzle ORM, proper relations, indexes, and migration support |
| **Status** | Complete |
| **Maturity** | High |
| **Tables** | users, user_preferences, api_keys, ideas, saved_ideas, viewed_ideas, subscriptions, rate_limits, validation_requests, usage_tracking |
| **Strengths** | Well-normalized schema; comprehensive indexing; Drizzle ORM provides type-safe queries; cascading deletes; Supabase provides managed hosting with auth |
| **Weaknesses** | No read replicas for scale; no full-text search index on ideas; usage_tracking table may grow unbounded |
| **Risk Factors** | Supabase free tier limits; migration complexity at scale |

#### Scheduler

| Attribute | Detail |
|-----------|--------|
| **Description** | node-cron based pipeline orchestrator with phase-based execution and resume capability |
| **Status** | In Progress |
| **Maturity** | Medium |
| **Files** | `src/scheduler/orchestrator.ts`, `src/scheduler/cli.ts`, `src/scheduler/phases/` (scrape, analyze, generate, deliver), `src/scheduler/utils/` (persistence, retry, metrics, logger, token-estimator, api-metrics) |
| **Strengths** | Phase-based architecture allows resume after failure; persistence layer tracks run state; retry logic built in; token estimation for cost control; comprehensive metrics and logging utilities |
| **Weaknesses** | node-cron is in-process (not distributed); no external job queue; resume capability needs production validation |
| **Risk Factors** | MEDIUM -- scheduler is critical path; process crash loses cron state; needs production hardening |

#### Payments (Stripe)

| Attribute | Detail |
|-----------|--------|
| **Description** | Full Stripe integration with webhooks, subscription management, and tier-based access |
| **Status** | Complete |
| **Maturity** | High |
| **Files** | `src/api/config/stripe.ts`, `src/api/routes/billing.ts`, `src/api/routes/webhooks.ts`, `src/api/services/billing.ts` |
| **Products** | Pro Monthly ($19), Pro Yearly ($190), Enterprise Monthly ($99), Enterprise Yearly ($990) |
| **Strengths** | Industry-standard payment processor; webhook-driven state management; annual pricing with 2-month discount; complete billing service layer |
| **Weaknesses** | No usage-based billing for Enterprise overage; no free trial period configured; no promo code support confirmed |
| **Risk Factors** | Low -- Stripe is battle-tested; webhook reliability is excellent |

#### Deployment

| Attribute | Detail |
|-----------|--------|
| **Description** | Railway (API) + Vercel (web) with Docker configs |
| **Status** | In Progress |
| **Maturity** | Low-Medium |
| **Strengths** | Railway and Vercel are developer-friendly PaaS providers; Docker configs exist for portability |
| **Weaknesses** | Production deployment not yet validated; no CI/CD pipeline confirmed; no staging environment |
| **Risk Factors** | MEDIUM -- deployment is untested in production; Railway cold starts may affect scheduler reliability |

### 2.5 Quality & Testing

| Attribute | Detail |
|-----------|--------|
| **Description** | Comprehensive test suite with strict type safety |
| **Status** | Complete |
| **Maturity** | High |
| **Test Count** | 1,051 tests across all modules |
| **Strengths** | Tests mirror source structure; all external APIs mocked; zero `any` types in codebase; Zod validation on API boundaries; shared type package ensures frontend/backend contract consistency |
| **Weaknesses** | No end-to-end tests confirmed; no load/performance testing; no integration tests with real database |
| **Risk Factors** | Test coverage percentage unknown; mocked tests may miss real integration issues |

### 2.6 Overall Product Readiness Score

| Category | Score (1-10) | Weight | Weighted |
|----------|-------------|--------|----------|
| Scrapers | 8.5 | 20% | 1.70 |
| Analysis Pipeline | 8.0 | 20% | 1.60 |
| Delivery | 7.5 | 15% | 1.13 |
| API & Auth | 8.5 | 15% | 1.28 |
| Database & Schema | 9.0 | 10% | 0.90 |
| Scheduler | 6.0 | 10% | 0.60 |
| Deployment | 5.0 | 5% | 0.25 |
| Testing & Quality | 8.0 | 5% | 0.40 |
| **Total** | | **100%** | **7.86 / 10** |

**Rationale**: The core product (scrapers, analysis, generation, API) is production-ready with high maturity. The critical gaps are in infrastructure: the scheduler needs production validation, deployment is untested, and monitoring/alerting does not exist yet. These are addressable in 1-2 weeks, making the product launch-ready within the recommended 30-day window.

---

## 3. Product-Market Gap Analysis

### Market Expectations vs. ZeroToShip Status

| # | Market Expectation | ZeroToShip Status | Gap Level | Priority | Competitive Urgency |
|---|-------------------|------------------|-----------|----------|---------------------|
| 1 | Real-time alerts (instant notification when high-scoring idea detected) | Not available; batch processing only (daily 6-7-8 AM cycle) | HIGH | Q2 | High -- users expect real-time in 2026; competitors will offer this |
| 2 | Slack/Discord integration (delivery to team channels) | Not available | HIGH | Q1-Q2 | High -- standard expectation for team-oriented SaaS tools |
| 3 | Personalization via behavioral tracking (learned preferences from clicks, saves, dismissals) | Schema exists (user_preferences, saved_ideas, viewed_ideas) but no behavioral learning implemented | HIGH | Q1 | High -- personalization drives retention; infrastructure is ready |
| 4 | Community/social features (upvote ideas, comment, follow other users) | Not available | MEDIUM | Q3 | Medium -- differentiator but not expected at launch |
| 5 | Mobile app or PWA | Not available; web dashboard is desktop-oriented | MEDIUM | Q2 | Medium -- mobile is important for daily email users who want to tap through |
| 6 | Slack/Discord integration | Not available | HIGH | Q1-Q2 | High -- most SaaS tools offer Slack notifications |
| 7 | Vertical editions (SaaS-only, AI-only, dev tools-only idea feeds) | Architecture supports via category filtering but no vertical-specific UX or marketing | LOW | Q3-Q4 | Low at launch; becomes competitive differentiator later |
| 8 | Export to Notion/CSV/PDF | Enterprise tier only (via tier gating) | LOW | Existing | Low -- exists but gated; could offer basic export at Pro tier |
| 9 | Team collaboration (shared workspace, annotations, voting) | Planned but not built; no multi-user workspace in schema | MEDIUM | Q2-Q3 | Medium -- important for Enterprise tier value |
| 10 | API marketplace (third-party integrations, Zapier) | Not available | LOW | Q4 | Low -- nice-to-have for power users |
| 11 | Validation network (human/crowd validation of ideas) | Not available; validation_requests table exists but workflow is empty | MEDIUM | Q3 | Medium -- strategic differentiator if executed well |
| 12 | Weekly/monthly digest emails | Schema supports email_frequency (daily/weekly/never) but only daily template exists | MEDIUM | Q1 | High -- low effort to build; users want frequency control |
| 13 | Idea history and trend tracking (see how an idea evolves over time) | viewed_ideas tracks history but no trend visualization or evolution tracking | MEDIUM | Q2 | Medium -- adds depth to the product |
| 14 | Custom scraping sources (user-defined subreddits, keywords, GitHub repos) | Not available; scraping sources are hardcoded | HIGH | Q2 | High -- power users will expect customization |
| 15 | Competitor monitoring (track specific companies or products) | competitor.ts exists for gap analysis but no persistent monitoring | MEDIUM | Q2-Q3 | Medium -- natural extension of gap analysis |
| 16 | Landing page validation (AI-generated landing pages to test demand) | Not available | LOW | Q4+ | Low -- ambitious feature, not expected at this stage |
| 17 | Idea portfolio management (save, organize, tag, rate, track progress on ideas) | saved_ideas exists but no folders, tags, or progress tracking | MEDIUM | Q1-Q2 | Medium -- directly improves Pro/Enterprise value |
| 18 | RSS/webhook delivery (programmatic consumption of idea feeds) | Not available; API exists but no push mechanism | LOW | Q3 | Low -- niche but useful for developers |
| 19 | Multi-language support (scrape non-English communities) | Not available; English-only | LOW | Q4+ | Low -- expands TAM but adds significant complexity |
| 20 | Onboarding wizard (guided setup of preferences and interests) | Not available; user_preferences schema exists but no guided flow | HIGH | Q1 | High -- critical for activation; 1st-day experience determines retention |
| 21 | Source attribution and links (link back to original Reddit/HN/Twitter posts) | Brief includes problem statement but direct source links not confirmed | HIGH | Q1 | High -- users want to verify signals; builds trust |
| 22 | Idea comparison (side-by-side comparison of two or more ideas) | Not available | LOW | Q3 | Low -- useful but not expected |
| 23 | Analytics dashboard (conversion rates, open rates, user engagement) | Admin panel exists but scope unclear; no user-facing analytics | MEDIUM | Q2 | Medium -- needed for founder's own metrics and for Enterprise customers |
| 24 | Free trial for Pro tier (7-14 day trial before payment) | Not configured in Stripe products | HIGH | Q1 | High -- standard SaaS practice; removes purchase friction |
| 25 | Dark mode and UI customization | Not confirmed | LOW | Q2 | Low -- expected in modern SaaS but not critical |

### Gap Priority Summary

**Must-have for launch (Q1 -- next 30 days):**
- Onboarding wizard / guided preferences setup
- Source attribution links in briefs
- Weekly digest email template
- Behavioral personalization (v1 -- leverage existing schema)
- Free trial configuration in Stripe

**Should-have for growth (Q2 -- days 31-90):**
- Slack/Discord integration
- Mobile-responsive dashboard / PWA
- Real-time alert option (even if polling-based)
- Custom scraping sources
- Idea portfolio management
- Analytics dashboard

**Nice-to-have for scale (Q3-Q4):**
- Community features
- Vertical editions
- Competitor monitoring
- Validation network
- API marketplace
- Multi-language support

---

## 4. Unit Economics & Financial Model

### 4.1 Revenue Model

**Pricing tiers:**

| Tier | Monthly | Annual (2 mo free) | Ideas/Day | Key Features |
|------|---------|---------------------|-----------|-------------|
| Free | $0 | -- | 3 summaries | Basic idea summaries, archive, preferences |
| Pro | $19/mo | $190/yr ($15.83/mo) | 10 full briefs | Full business briefs, idea history |
| Enterprise | $99/mo | $990/yr ($82.50/mo) | Unlimited | API access, search, export, validation, API keys |

**Revenue projections:**

| Month | Total Signups | Free Users | Pro Conv. % | Pro Users | Ent. Conv. % | Ent. Users | Pro MRR | Ent. MRR | Total MRR | ARR Equiv. |
|-------|--------------|------------|-------------|-----------|--------------|------------|---------|----------|-----------|------------|
| 1 | 500 | 475 | 5.0% | 25 | 0.0% | 0 | $475 | $0 | $475 | $5,700 |
| 2 | 750 | 700 | 6.0% | 45 | 0.1% | 1 | $855 | $99 | $954 | $11,448 |
| 3 | 1,000 | 927 | 7.0% | 70 | 0.3% | 3 | $1,330 | $297 | $1,627 | $19,524 |
| 4 | 1,400 | 1,291 | 7.5% | 105 | 0.3% | 4 | $1,995 | $396 | $2,391 | $28,692 |
| 5 | 1,800 | 1,651 | 7.5% | 135 | 0.4% | 7 | $2,565 | $693 | $3,258 | $39,096 |
| 6 | 2,500 | 2,284 | 8.0% | 200 | 0.3% | 8 | $3,800 | $792 | $4,592 | $55,104 |
| 9 | 3,800 | 3,430 | 9.0% | 342 | 0.4% | 15 | $6,498 | $1,485 | $7,983 | $95,796 |
| 12 | 5,000 | 4,480 | 10.0% | 500 | 0.4% | 20 | $9,500 | $1,980 | $11,480 | $137,760 |

**Assumptions:**
- Monthly churn: 8% Free, 6% Pro, 4% Enterprise (net of re-subscriptions)
- Pro conversion ramp: 5% Month 1 to 10% Month 12 as product matures and social proof builds
- Enterprise lags Pro by 2-3 months (requires more trust, longer evaluation)
- Annual subscriptions estimated at 20% of paid users by Month 6 (reduces effective MRR but improves retention)

### 4.2 Cost Model

#### Fixed Costs (Monthly)

| Cost Item | Month 1 | Month 6 | Month 12 | Notes |
|-----------|---------|---------|----------|-------|
| Railway (API hosting) | $20 | $35 | $50 | Scales with traffic; Hobby plan sufficient initially |
| Vercel (Web hosting) | $0 | $20 | $20 | Free tier handles initial traffic; Pro at ~1K users |
| Supabase (Database) | $0 | $25 | $25 | Free tier to 500MB; Pro at ~1K users |
| Resend (Email) | $0 | $20 | $40 | Free 100 emails/day; scales to $20/mo at 5K/day |
| Domain + SSL | $15 | $15 | $15 | Annual cost amortized monthly |
| Monitoring (Sentry/UptimeRobot) | $0 | $29 | $29 | Free tiers initially; paid at scale |
| **Total Fixed** | **$35** | **$144** | **$179** |  |

#### Variable Costs (Per User Per Month)

| Cost Item | Per User/Mo | Notes |
|-----------|-------------|-------|
| OpenAI Embeddings (deduplication) | $0.002 | ~1K embeddings/day shared across all users |
| Anthropic Claude (brief generation) | $0.05 | ~10 briefs/day at $0.005/brief (cached prompts) |
| SerpAPI/Brave (gap analysis) | $0.03 | ~10 searches/day shared across all users |
| Resend (per email) | $0.001 | $0.001/email at scale pricing |
| Incremental compute | $0.02 | Marginal Railway/Vercel resource consumption |
| **Total Variable** | **~$0.10/user** |  |

**Note:** Most variable costs are shared across users (daily batch processing generates a fixed number of ideas regardless of user count). Marginal cost per additional user is primarily email delivery and dashboard compute. At 5,000 users, estimated variable cost is ~$500/month.

#### Total Cost Projections

| Month | Fixed | Variable (est.) | Total Cost | Revenue | Net Margin |
|-------|-------|-----------------|------------|---------|------------|
| 1 | $35 | $50 | $85 | $475 | $390 (82%) |
| 3 | $75 | $100 | $175 | $1,627 | $1,452 (89%) |
| 6 | $144 | $250 | $394 | $4,592 | $4,198 (91%) |
| 12 | $179 | $500 | $679 | $11,480 | $10,801 (94%) |

### 4.3 Customer Acquisition Cost (CAC)

| Channel | Cost/Signup | Est. Signups (Month 1) | Total Cost | Time Investment | Notes |
|---------|-------------|----------------------|------------|-----------------|-------|
| Show HN | $0 | 200-500 | $0 | 4-8 hours | Highest quality leads; developer audience |
| Product Hunt | $0 | 500-2,000 | $0 | 8-16 hours | Broad reach; lower intent than HN |
| Twitter/X organic | $0-5 | 100-300 | $0-$500 | 2-4 hrs/week | Build-in-public content; ongoing effort |
| Indie Hackers | $0-3 | 100-300 | $0-$300 | 2-3 hours | Highly targeted audience |
| Reddit (organic) | $0-3 | 100-200 | $0-$200 | 1-2 hours | Must follow subreddit rules |
| **Blended (organic launch)** | **$0-2** | **800-1,500** | **$0-$1,000** | | |

**Future paid channels (Month 3+):**

| Channel | Est. CAC | Quality | Scale Potential |
|---------|----------|---------|-----------------|
| Twitter/X ads | $15-25 | Medium | Medium |
| Newsletter sponsorships | $10-20 | High | Medium |
| Google Ads (branded) | $8-15 | High | Low |
| Reddit ads | $20-30 | Medium-High | Low |
| Podcast sponsorships | $15-30 | High | Medium |
| **Blended target (paid)** | **$15-25** | | |

### 4.4 Lifetime Value (LTV) Analysis

| Tier | ARPU/Mo | Churn/Mo | Avg Lifespan | LTV | Gross Margin | LTV (Gross) |
|------|---------|----------|-------------|-----|--------------|-------------|
| Free | $0 | 12% | 8 months | $0 | -- | $0 |
| Pro (monthly) | $19 | 6% | 16.7 months | $317 | 99.5% | $315 |
| Pro (annual) | $15.83 | 3%* | 33 months | $522 | 99.5% | $519 |
| Enterprise (monthly) | $99 | 4% | 25 months | $2,475 | 99.0% | $2,450 |
| Enterprise (annual) | $82.50 | 2%* | 50 months | $4,125 | 99.0% | $4,084 |

*Annual churn estimated at half monthly churn due to commitment effect.*

**Blended Pro LTV** (80% monthly / 20% annual): $356
**Blended Enterprise LTV** (80% monthly / 20% annual): $2,805

### 4.5 LTV:CAC Ratios

| Tier | LTV | Blended CAC (Organic) | LTV:CAC | Blended CAC (Paid) | LTV:CAC |
|------|-----|----------------------|---------|--------------------|---------|
| Pro | $356 | $2 | 178:1 | $20 | 18:1 |
| Enterprise | $2,805 | $5 | 561:1 | $30 | 94:1 |

**Industry benchmark**: 3:1 LTV:CAC is considered healthy; 5:1+ is excellent.

Even with fully-paid acquisition at $20-30 CAC, ZeroToShip's LTV:CAC ratios are exceptional. This is driven by the near-zero marginal cost structure (batch processing means each additional user costs almost nothing to serve).

### 4.6 Break-Even Analysis

| Metric | Value |
|--------|-------|
| Fixed costs (Month 1) | $35 |
| Fixed costs (Month 6) | $144 |
| Contribution margin (Pro user) | $18.90/mo (99.5% gross margin) |
| Contribution margin (Enterprise user) | $98.01/mo (99.0% gross margin) |
| Break-even (Month 1) | 2 Pro users |
| Break-even (Month 6) | 8 Pro users OR 2 Enterprise users |
| Break-even (Month 12) | 10 Pro users OR 2 Enterprise users |

**ZeroToShip is profitable from Month 1** with even modest conversion. At 25 Pro users ($475 MRR) against $85 total cost, the business generates $390/month in profit from day one.

### 4.7 Cash Flow Scenarios (12-Month)

#### Conservative Scenario

| Assumption | Value |
|------------|-------|
| Total signups (12 mo) | 2,500 |
| Pro conversion | 5% |
| Enterprise conversion | 0.2% |
| Month 12 MRR | $3,325 |
| Cumulative revenue | $22,000 |
| Cumulative costs | $3,200 |
| **Cumulative profit** | **$18,800** |

#### Base Scenario

| Assumption | Value |
|------------|-------|
| Total signups (12 mo) | 5,000 |
| Pro conversion | 8% (avg) |
| Enterprise conversion | 0.4% |
| Month 12 MRR | $11,480 |
| Cumulative revenue | $58,000 |
| Cumulative costs | $5,800 |
| **Cumulative profit** | **$52,200** |

#### Optimistic Scenario

| Assumption | Value |
|------------|-------|
| Total signups (12 mo) | 10,000 |
| Pro conversion | 12% |
| Enterprise conversion | 0.8% |
| Month 12 MRR | $30,720 |
| Cumulative revenue | $168,000 |
| Cumulative costs | $12,000 |
| **Cumulative profit** | **$156,000** |

**Key takeaway:** Even the conservative scenario generates meaningful profit. The batch-processing cost structure means ZeroToShip has effectively zero marginal cost up to several thousand users, creating a highly efficient economic engine.

---

## 5. Risk Register & Mitigation

### Risk Scoring Matrix

- **Probability**: LOW (1) / MEDIUM (2) / HIGH (3)
- **Impact**: LOW (1) / MEDIUM (2) / HIGH (3)
- **Score**: Probability x Impact (1-9)

| # | Risk | Category | Prob. | Impact | Score | Mitigation Strategy |
|---|------|----------|-------|--------|-------|---------------------|
| 1 | GummySearch alternatives capture market first | Competitive | HIGH (3) | HIGH (3) | **9** | Launch within 30 days; actively target GummySearch communities (r/SaaS, IH, Twitter); position as the direct replacement with lower pricing |
| 2 | Data quality issues in generated briefs | Technical | MEDIUM (2) | HIGH (3) | **6** | Human review of 50+ sample briefs before launch; implement user feedback mechanism (thumbs up/down); weekly quality audit of top-rated vs. low-rated briefs |
| 3 | Exploding Topics or SparkToro adds brief generation | Competitive | MEDIUM (2) | HIGH (3) | **6** | Differentiate on price ($19 vs. $39-249), email-first delivery, multi-source coverage, and structured briefs; build switching costs via personalization and portfolio features |
| 4 | Slow conversion from free to Pro tier | Market | MEDIUM (2) | HIGH (3) | **6** | A/B test pricing ($14/$19/$24); improve free-to-Pro upgrade flow with "brief preview" teasers; add 7-day free trial; track conversion funnel drop-off points |
| 5 | Solo founder burnout or bus factor | Operational | MEDIUM (2) | HIGH (3) | **6** | Automate pipeline end-to-end (no manual steps); document all systems; use managed services (Supabase, Railway, Vercel, Stripe, Resend) to reduce ops burden; set boundaries on support hours |
| 6 | Enterprise tier underpriced at $99/month | Financial | HIGH (3) | MEDIUM (2) | **6** | Plan price increase to $149/month at Month 3 (grandfather existing customers); validate willingness-to-pay through customer interviews; add enterprise features to justify price increase |
| 7 | Scraper breakage due to API changes | Technical | HIGH (3) | MEDIUM (2) | **6** | Multiple fallbacks per source (Twitter: API v2 + Nitter); monitoring alerts on scrape failures; degrade gracefully (reduce sources temporarily rather than fail completely); keep scraper modules decoupled for rapid replacement |
| 8 | Nitter fallback instances shut down | Technical | HIGH (3) | LOW (1) | **3** | Maintain 5+ Nitter instances; monitor instance health; plan migration to Twitter API v2 only if all Nitter fails; Twitter data is supplementary, not critical |
| 9 | AI API cost increases (Anthropic, OpenAI) | Technical | MEDIUM (2) | MEDIUM (2) | **4** | Heuristic fallbacks exist for scorer; score caching reduces repeat API calls; aggressive prompt caching; can switch embedding providers (OpenAI to open-source); Claude is used for generation which has template fallback |
| 10 | "AI fatigue" in target market reduces interest | Market | LOW (1) | MEDIUM (2) | **2** | Focus marketing on output quality and business value, not "AI" branding; position as "idea intelligence" rather than "AI tool"; let brief quality speak for itself |
| 11 | Email deliverability issues (new domain, spam filters) | Technical | MEDIUM (2) | HIGH (3) | **6** | Warm domain before launch (2 weeks of low-volume sends); set up SPF, DKIM, DMARC records; use Resend's managed deliverability; monitor bounce and spam complaint rates; provide dashboard as fallback delivery |
| 12 | Supabase service disruption or limitations | Technical | LOW (1) | HIGH (3) | **3** | Supabase uses standard PostgreSQL; migration path to self-hosted Postgres is straightforward via Drizzle; keep database schema portable; maintain pg_dump backups |
| 13 | User data/privacy compliance issues (GDPR, CCPA) | Legal | MEDIUM (2) | HIGH (3) | **6** | Implement data export/deletion endpoints before launch; add privacy policy and terms of service; minimize PII storage; Supabase is SOC 2 compliant; no scraping of private user data (only public posts) |
| 14 | Negative launch reception (HN/PH backlash) | Market | LOW (1) | MEDIUM (2) | **2** | Prepare honest, non-hype launch copy; have working demo ready; respond quickly to feedback; be transparent about solo founder status (HN respects this); avoid "AI" in headline |
| 15 | Competitor launches at lower price or free tier | Competitive | MEDIUM (2) | MEDIUM (2) | **4** | ZeroToShip already has a free tier; $19/month is aggressive pricing; compete on quality and comprehensiveness rather than price; build switching costs via personalization and portfolio features; focus on brief quality as primary moat |
| 16 | Scheduler fails in production under load | Technical | MEDIUM (2) | HIGH (3) | **6** | Load test scheduler before launch; implement circuit breakers; add dead-man's-switch monitoring (alert if daily run doesn't complete); design for idempotent re-runs; persist phase completion state |
| 17 | Key dependency vulnerability or supply chain attack | Technical | LOW (1) | HIGH (3) | **3** | Use npm audit regularly; pin dependency versions; monitor security advisories for Fastify, Next.js, Drizzle; Dependabot or similar automated scanning |
| 18 | Free users consume disproportionate resources | Financial | MEDIUM (2) | LOW (1) | **2** | Free tier is already limited (3 ideas, summaries only); batch processing means free users cost nearly nothing to serve; rate limiting is implemented; monitor and adjust limits if needed |
| 19 | Unable to scale past 10K users on current architecture | Technical | LOW (1) | MEDIUM (2) | **2** | Batch processing architecture inherently scales (daily processing is fixed-cost regardless of user count); Supabase/Postgres handles 10K+ easily; optimize email delivery with queuing at scale; plan database read replicas at 50K+ users |
| 20 | Twitter/X blocks all scraping access | Technical | MEDIUM (2) | MEDIUM (2) | **4** | Twitter is one of four sources; degrade to three sources with reduced but still viable coverage; Reddit and HN provide the strongest signals anyway; monitor X platform policy changes |

### Risk Heat Map Summary

**Critical (Score 9):** 1 risk -- competitor speed to market
**High (Score 6):** 8 risks -- brief quality, competitive features, conversion rate, solo founder, pricing, scraper breakage, email deliverability, scheduler reliability, compliance
**Medium (Score 3-4):** 6 risks -- AI costs, competitor pricing, Nitter, Supabase, dependencies, Twitter blocking
**Low (Score 1-2):** 5 risks -- AI fatigue, launch backlash, free user costs, scale limits, supply chain

**Top 3 risks requiring immediate action:**
1. Competitor speed (launch fast)
2. Scheduler production reliability (test thoroughly)
3. Email deliverability (warm domain now)

---

## 6. 90-Day Strategic Action Plan

### Phase 1: Launch & Validate (Days 1-30)

**Objective:** Complete infrastructure, launch to early adopters, validate demand.

#### Week 1: Infrastructure Completion (Days 1-7)

| Day | Action | Owner | Status |
|-----|--------|-------|--------|
| 1-2 | Finalize scheduler production configuration; test full pipeline run | Founder | Required |
| 2-3 | Deploy API to Railway production environment; validate endpoints | Founder | Required |
| 3-4 | Deploy web to Vercel production; configure custom domain | Founder | Required |
| 4-5 | Set up monitoring: UptimeRobot (uptime), Sentry (errors), scheduler dead-man's-switch | Founder | Required |
| 5-6 | Configure Resend production domain; warm with test emails; set up SPF/DKIM/DMARC | Founder | Required |
| 7 | End-to-end production validation: trigger full pipeline, verify email delivery, test Stripe checkout | Founder | Required |

**KPIs:** Production environment fully operational; daily pipeline runs successfully for 3+ consecutive days.

#### Week 2: Quick Wins & Polish (Days 8-14)

| Priority | Feature | Effort | Impact | Rationale |
|----------|---------|--------|--------|-----------|
| 1 | Source attribution links in briefs (link to original Reddit/HN/Twitter posts) | 4 hrs | High | Builds trust; users want to verify signals |
| 2 | "Why This Idea" explanation (surface the scoring rationale) | 4 hrs | High | Adds transparency; differentiator from competitors |
| 3 | Share link for individual ideas (public URL for non-logged-in viewing) | 3 hrs | Medium | Enables viral sharing; free marketing |
| 4 | Dismiss/hide idea (record in viewed_ideas, influence future scoring) | 2 hrs | Medium | First step toward behavioral personalization |
| 5 | Weekly digest email template (leverage existing email_frequency schema) | 4 hrs | Medium | Users who find daily too frequent will churn without this |
| 6 | Free trial configuration (7-day Pro trial in Stripe) | 2 hrs | High | Removes purchase friction; standard SaaS practice |
| 7 | Basic onboarding flow (category selection, effort preference, email frequency) | 6 hrs | High | Critical for activation; leverages existing user_preferences schema |

**KPIs:** All 7 quick wins shipped; internal team testing complete.

#### Week 3: Beta Launch (Days 15-21)

| Day | Channel | Action | Expected Signups |
|-----|---------|--------|------------------|
| 15 (Mon) | Pre-launch | Final quality audit of 20+ generated briefs; fix any issues found | -- |
| 16 (Tue) | Show HN | Post "Show HN: ZeroToShip -- Daily startup ideas from Reddit, HN, Twitter, and GitHub" | 200-500 |
| 17 (Wed) | Product Hunt | Coordinated launch with maker page, screenshots, demo video | 500-2,000 |
| 17-18 | Twitter/X | Thread: "I built a tool that scrapes 4 platforms for startup ideas and delivers briefs daily" | 100-300 |
| 18-19 | Indie Hackers | Product page + milestone post: "From idea to launch in 30 days" | 100-300 |
| 19-20 | Reddit | Posts in r/SaaS, r/startups, r/SideProject (following subreddit rules) | 100-200 |
| 21 | GummySearch communities | Targeted outreach: "GummySearch alternative" positioning in relevant threads | 50-100 |

**Launch copy positioning:**
- Lead with output (example briefs), not technology (AI)
- Emphasize: "The only tool that scrapes 4 platforms and delivers full business briefs for $19/month"
- Comparison: "GummySearch is gone. Here's what I built to replace it."

**KPIs:** 100+ signups; 30%+ email open rate on Day 1 email; 5+ pieces of qualitative feedback.

**Decision gate:** If <50 signups after all channels, reassess value proposition and positioning. If 50-100, continue but shift to more targeted outreach. If 100+, proceed to Phase 2 as planned.

#### Week 4: Feedback & Stabilize (Days 22-30)

| Action | Priority |
|--------|----------|
| Triage all user feedback; categorize as bug / feature request / UX issue | Critical |
| Fix any critical bugs or pipeline failures discovered during launch | Critical |
| Monitor and optimize email deliverability (check bounce rates, spam complaints) | High |
| Respond to every piece of user feedback personally (builds loyalty at this stage) | High |
| Measure KPIs: signups, email opens, dashboard visits, idea saves, conversion attempts | High |
| A/B test: move "full brief" unlock teaser higher in free tier email | Medium |
| Set up basic analytics (PostHog or Mixpanel free tier) | Medium |

**KPIs:** 100+ total signups; 30%+ email open rate; 5%+ click-through rate; 1-3 Pro conversions; NPS survey distributed.

**Resource allocation:** 80% bug fixes and stability, 20% analytics setup.

---

### Phase 2: Optimize & Grow (Days 31-60)

**Objective:** Improve conversion, add retention features, begin growth marketing.

#### Week 5: Analytics & Personalization Foundation (Days 31-37)

| Action | Effort | Impact |
|--------|--------|--------|
| Implement behavioral tracking: track idea views, saves, dismissals, click-through patterns | 8 hrs | High |
| Set up conversion funnel analytics: signup -> onboard -> first email open -> first save -> first upgrade attempt -> conversion | 6 hrs | High |
| Implement feedback widget on briefs (thumbs up/down + optional comment) | 4 hrs | High |
| Create internal dashboard: daily signups, MRR, churn, open rates, NPS | 6 hrs | Medium |

**KPIs:** Behavioral tracking live; conversion funnel instrumented; feedback collection active.

#### Week 6: Idea Portfolio & Progress Tracking (Days 38-44)

| Feature | Description | Tier |
|---------|-------------|------|
| Idea Portfolio | Save ideas to folders (e.g., "Exploring", "Building", "Parked") | Free+ |
| Progress Tracking | Mark idea status: "Interested" -> "Researching" -> "Building" -> "Launched" | Pro+ |
| Notes on ideas | Free-form notes attached to saved ideas | Pro+ |
| Portfolio analytics | Summary of saved ideas by category, effort, status | Pro+ |

**Rationale:** Portfolio features create switching costs and increase Pro tier value. Users who organize ideas in ZeroToShip are much less likely to churn.

**KPIs:** 20%+ of active users save at least one idea; 5%+ create a folder.

#### Week 7: Personalized Ranking (Days 45-51)

| Feature | Description | Mechanism |
|---------|-------------|-----------|
| Preference-based ranking | Re-rank daily ideas based on user_preferences (categories, effort, min score) | Already in schema; build ranking logic |
| Behavioral weighting | Boost ideas similar to previously saved/clicked ideas | Use embedding similarity against user's saved ideas |
| "More like this" | Button on each idea to find similar ideas from archive | Embedding search in ideas table |

**Rationale:** Personalization is the single highest-impact retention lever. Users who see relevant ideas daily stay subscribed. Users who see irrelevant ideas churn.

**KPIs:** 10%+ improvement in email click-through rate; 5%+ reduction in unsubscribe rate.

#### Week 8: GummySearch Migration & Enterprise Outreach (Days 52-60)

| Action | Channel | Target |
|--------|---------|--------|
| "GummySearch Alternative" blog post / landing page | SEO | Long-term organic traffic from GummySearch searches |
| Direct outreach to GummySearch power users (identified via Twitter/Reddit) | Direct | 50-100 targeted outreach messages |
| Enterprise-targeted content: "How to validate startup ideas at scale" | Content marketing | Enterprise prospects |
| First Enterprise prospect calls | Direct sales | 3-5 Enterprise trial users |
| Partnership outreach: startup accelerators, VCs, communities | Partnerships | 2-3 partnership conversations |

**KPIs:** 500+ total signups; $950+ MRR; 5%+ Pro conversion rate; NPS 30+; 1+ Enterprise trial.

**Decision gate:** If <3% Pro conversion after 60 days, reassess value proposition fundamentally. Consider: Is the problem real? Are briefs good enough? Is pricing right? If 3-5%, optimize conversion flow. If 5%+, proceed to Phase 3.

**Resource allocation:** 50% product development, 30% marketing/growth, 20% support and operations.

---

### Phase 3: Scale & Monetize (Days 61-90)

**Objective:** Add premium features, scale acquisition, prepare for sustained growth.

#### Week 9: Idea Deep-Dive -- Pro Upsell Feature (Days 61-67)

| Feature | Description | Impact |
|---------|-------------|--------|
| Deep-Dive Report | On-demand expanded analysis of a specific idea: detailed market research, 10+ competitors mapped, TAM/SAM/SOM estimation, customer interview questions, landing page copy draft | High upsell trigger |
| Implementation | Button on each idea: "Generate Deep-Dive ($2 or included in Pro)" | Incremental revenue |
| Technical approach | Use gap analyzer + brief generator with expanded prompts; cache results; 1-2 minute generation time | Leverage existing infrastructure |

**Rationale:** Deep-Dive creates a clear value step between free summaries and Pro briefs. It also serves as a usage-based revenue opportunity for Pro users who want more depth.

**KPIs:** 10%+ of Pro users generate at least one Deep-Dive; contributes $200+ incremental MRR.

#### Week 10: Enterprise Enhancement & Price Increase (Days 68-74)

| Action | Detail |
|--------|--------|
| Enterprise tier features | Add: team workspaces (multi-user), custom scraping keywords, priority support SLA, white-label email option |
| Price increase | New Enterprise pricing: $149/month ($1,490/year); grandfather existing Enterprise customers at $99 |
| Enterprise landing page | Dedicated page with ROI calculator, case study (from first Enterprise customer), comparison table |
| Outbound campaign | Email campaign to Pro users approaching 90 days: "Upgrade to Enterprise for team features and custom sources" |

**KPIs:** Enterprise price increase accepted by market (no cancellation spike); 2+ new Enterprise customers at $149; $2,000+ Enterprise MRR.

#### Week 11: Slack/Discord Integration Beta (Days 75-81)

| Feature | Description | Tier |
|---------|-------------|------|
| Slack integration | Daily idea digest posted to a Slack channel; /zerotoship slash command for search | Pro+ |
| Discord bot | Similar to Slack; bot posts daily ideas to designated channel | Pro+ |
| Configuration | Users choose Slack, Discord, Email, or any combination for delivery | All tiers (config), Pro+ (Slack/Discord) |

**Rationale:** Slack/Discord integration is the #1 requested feature in comparable products. It meets users where they already work, reducing friction and increasing engagement. It also makes ZeroToShip visible to teams, driving viral Enterprise adoption.

**KPIs:** 10%+ of Pro users connect Slack/Discord; integration drives 5+ organic Enterprise leads.

#### Week 12: Evaluation & Q2 Planning (Days 82-90)

| Action | Detail |
|--------|--------|
| Real-time alerts feasibility study | Evaluate: WebSocket infrastructure, push notification costs, user demand signal from feedback data |
| Q2 roadmap draft | Based on 90 days of data: which features drove conversion? which reduced churn? what do Enterprise customers need? |
| Hiring assessment | Can the founder continue solo? Evaluate: first hire priorities (support? engineering? marketing?) |
| Fundraising assessment | If MRR targets met: evaluate angel/pre-seed options; if not: assess bootstrapped trajectory |
| Community strategy | Plan community features (comments, voting) or decide against based on user behavior data |

**KPIs:** 1,000+ total signups; $2,000+ MRR; 2+ Enterprise customers; clear Q2 roadmap finalized.

**Decision gate:** If MRR target ($2,000+) hit, exit beta and scale marketing spend. If $1,000-2,000, continue optimizing before scaling. If <$1,000, fundamental pivot assessment required.

**Resource allocation:** 40% product development, 40% marketing/growth, 20% operations and planning.

---

### Phase Summary

| Phase | Days | Objective | Key Metric | Target |
|-------|------|-----------|------------|--------|
| 1: Launch & Validate | 1-30 | Ship and get first users | Signups | 100+ |
| 2: Optimize & Grow | 31-60 | Improve conversion and retention | Pro conversion rate | 5%+ |
| 3: Scale & Monetize | 61-90 | Add premium features, grow revenue | MRR | $2,000+ |

### Critical Path Items

The following items are on the critical path to launch and must not slip:

1. **Scheduler production deployment** (Week 1) -- blocks all subsequent work
2. **Email domain warming** (Week 1) -- 2-week lead time for deliverability
3. **End-to-end production validation** (Week 1) -- must run 3+ clean days before launch
4. **Show HN post** (Week 3) -- timing matters; avoid holidays and major tech news days
5. **Feedback response system** (Week 4) -- early users must feel heard to become advocates

### Success Metrics Summary

| Metric | Month 1 Target | Month 2 Target | Month 3 Target |
|--------|---------------|----------------|----------------|
| Total signups | 100-500 | 500-750 | 750-1,000 |
| Email open rate | 30%+ | 35%+ | 35%+ |
| Pro conversion | 5% | 5-6% | 7%+ |
| MRR | $475 | $954 | $1,627+ |
| NPS | Baseline | 30+ | 35+ |
| Churn (Pro) | Baseline | <8% | <6% |
| Enterprise customers | 0 | 1 | 3+ |

---

*This analysis was prepared on February 8, 2026 based on the ZeroToShip codebase (18,819 LOC), database schema (9 tables), and market intelligence as of the analysis date. Financial projections are estimates based on comparable SaaS products and should be validated against actual market response post-launch.*
