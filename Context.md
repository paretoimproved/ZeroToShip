# Context - Working Memory

> **Purpose**: Shared state for multi-agent coordination. Update this when claiming tasks or completing work.

**Last Updated**: 2026-01-31 (Web Dashboard Complete)

---

## Current Focus
**Building ZeroToShip** - A SaaS that scrapes the web daily for pain points and delivers prioritized business ideas with technical specs.

**This sprint**: Build the core pipeline (scrapers → analysis → generation → delivery)

## Product Vision
```
Every morning at 8 AM:
1. Scrape Reddit, HN, Twitter, GitHub for pain points
2. Cluster, score, and validate ideas using AI
3. Generate business briefs with technical specs
4. Deliver via email (free tier: 3 ideas, pro: 10 ideas)

User wakes up → checks email → knows what to build today
```

## Monetization
| Tier | Price | Offering |
|------|-------|----------|
| Free | $0 | Top 3 ideas (problem + solution only) |
| Pro | $19/mo | Full daily report (10 ideas + briefs) |
| Enterprise | $99/mo | API + custom filters + history |
| Validation | $49 one-time | Deep-dive on 1 idea |

**Revenue target**: 1,000 free → 50 Pro = $950/mo MRR

---

## Module Status

### Phase 1: Scrapers (Can Run in Parallel)
| Module | Agent | Status | Notes |
|--------|-------|--------|-------|
| Reddit Scraper | Agent | ✅ Complete | 8 subreddits, 50+ signal patterns, rate limiting |
| HN Scraper | Agent | ✅ Complete | Algolia API, Ask HN, Show HN comments, front page |
| Twitter Scraper | Agent | ✅ Complete | API v2 + Nitter fallback, 50+ tweets/run |
| GitHub Scraper | Agent | ✅ Complete | Octokit, 5 queries, stars >500, rate limiting |

### Phase 2: Analysis (After Scrapers)
| Module | Agent | Status | Dependencies |
|--------|-------|--------|--------------|
| Deduplicator | Agent 5 | ✅ Complete (Verified) | Embeddings, clustering, AI summaries |
| Scorer | Agent 6 | ✅ Complete | AI scoring, priority formula, quick wins |
| Gap Analyzer | Agent 7 | ✅ Complete | Web search, competitor analysis, market gaps |
| Brief Generator | Agent 8 | ✅ Complete | GPT-4 briefs, tech stacks, markdown export |

### Phase 3: Delivery (After Analysis)
| Module | Agent | Status | Dependencies |
|--------|-------|--------|--------------|
| Email Delivery | Agent 9 | ✅ Complete | Resend API, tier-based content, HTML + plain text |
| Web Dashboard | Agent 10 | ✅ Complete | Next.js, 5 pages, 4 components, full brief view |

---

## Code Review Status

**Reviewed**: 2026-01-31 by Code Review Agent
**Overall Quality**: 8.7/10
**Production Ready**: Yes

| Module | Quality | Issues | Status |
|--------|---------|--------|--------|
| Scrapers | 8/10 | 4 (2 medium, 2 low) | ✅ Reviewed |
| Analysis | 9/10 | 4 (all low) | ✅ Reviewed |
| Generation | 9/10 | 4 (all low) | ✅ Reviewed |

### Key Findings
- ✅ No `any` types - excellent TypeScript usage
- ✅ All 516 tests passing
- ✅ Good error handling with fallbacks
- ✅ No security issues (no hardcoded secrets)
- ⚠️ Duplicate `detectSignals()` function (types.ts + signals.ts)
- ⚠️ Console logging instead of structured logger

### Review Files
- `reviews/scrapers-review.md` - Detailed scraper module review
- `reviews/analysis-review.md` - Detailed analysis module review
- `reviews/generation-review.md` - Detailed generation module review
- `reviews/SUMMARY.md` - Executive summary

### Recommended Before Phase 3
1. Consolidate signal detection code (remove duplication)
2. Replace console.* with structured logging (pino)

---

## Technical Decisions Made

1. **Language**: TypeScript (Node.js)
2. **AI**: OpenAI GPT-4 for analysis, text-embedding-3-small for clustering
3. **Database**: PostgreSQL (Supabase or Railway)
4. **Email**: Resend
5. **Web**: Next.js
6. **Hosting**: Vercel (web) + Railway (cron/scrapers)

---

## Key Files

| File | Purpose |
|------|---------|
| [zerotoship.md](zerotoship.md) | Product overview, architecture, monetization |
| [Feature-Plan.md](Feature-Plan.md) | Technical implementation details per module |
| [Agent-Instructions.md](Agent-Instructions.md) | Copy-paste prompts for each agent |
| [Decisions.md](Decisions.md) | Architecture decision records |

### Source Code
| File | Purpose |
|------|---------|
| [src/scrapers/types.ts](src/scrapers/types.ts) | Shared types (RawPost, HNPost, Tweet, etc.) |
| [src/scrapers/hn-api.ts](src/scrapers/hn-api.ts) | HN Algolia API client wrapper |
| [src/scrapers/hackernews.ts](src/scrapers/hackernews.ts) | Main HN scraper implementation |
| [src/scrapers/twitter.ts](src/scrapers/twitter.ts) | Main Twitter scraper orchestrator |
| [src/scrapers/twitter-api.ts](src/scrapers/twitter-api.ts) | Twitter API v2 client |
| [src/scrapers/twitter-nitter.ts](src/scrapers/twitter-nitter.ts) | Nitter fallback scraper |
| [tests/scrapers/hackernews.test.ts](tests/scrapers/hackernews.test.ts) | HN scraper test suite |
| [tests/scrapers/twitter.test.ts](tests/scrapers/twitter.test.ts) | Twitter scraper test suite |
| [src/scrapers/reddit.ts](src/scrapers/reddit.ts) | Main Reddit scraper implementation |
| [src/scrapers/signals.ts](src/scrapers/signals.ts) | Pain point signal detection (50+ patterns) |
| [tests/scrapers/reddit.test.ts](tests/scrapers/reddit.test.ts) | Reddit scraper test suite |
| [src/scrapers/github.ts](src/scrapers/github.ts) | Main GitHub scraper implementation |
| [src/scrapers/github-api.ts](src/scrapers/github-api.ts) | Octokit API wrapper with rate limiting |
| [tests/scrapers/github.test.ts](tests/scrapers/github.test.ts) | GitHub scraper test suite |
| [src/analysis/deduplicator.ts](src/analysis/deduplicator.ts) | Main clustering logic |
| [src/analysis/embeddings.ts](src/analysis/embeddings.ts) | OpenAI embedding client with caching |
| [src/analysis/similarity.ts](src/analysis/similarity.ts) | Cosine similarity and clustering algorithms |
| [src/analysis/index.ts](src/analysis/index.ts) | Analysis module exports |
| [src/analysis/scorer.ts](src/analysis/scorer.ts) | Problem scoring with AI |
| [src/analysis/score-prompts.ts](src/analysis/score-prompts.ts) | AI prompt templates for scoring |
| [tests/analysis/scorer.test.ts](tests/analysis/scorer.test.ts) | Scorer test suite |
| [src/analysis/gap-analyzer.ts](src/analysis/gap-analyzer.ts) | Main gap analysis logic |
| [src/analysis/web-search.ts](src/analysis/web-search.ts) | Web search API client (SerpAPI, Brave, mock) |
| [src/analysis/competitor.ts](src/analysis/competitor.ts) | Competitor analysis with AI |
| [tests/analysis/gap-analyzer.test.ts](tests/analysis/gap-analyzer.test.ts) | Gap analyzer test suite (46 tests) |
| [tests/analysis/embeddings.test.ts](tests/analysis/embeddings.test.ts) | Embedding client test suite (35 tests) |
| [tests/analysis/web-search.test.ts](tests/analysis/web-search.test.ts) | Web search client test suite (36 tests) |
| [tests/analysis/competitor.test.ts](tests/analysis/competitor.test.ts) | Competitor analysis test suite (35 tests) |
| [src/generation/brief-generator.ts](src/generation/brief-generator.ts) | Main brief generation logic |
| [src/generation/templates.ts](src/generation/templates.ts) | GPT-4 prompt templates |
| [src/generation/tech-stacks.ts](src/generation/tech-stacks.ts) | Tech stack recommendations |
| [src/generation/index.ts](src/generation/index.ts) | Generation module exports |
| [tests/generation/brief-generator.test.ts](tests/generation/brief-generator.test.ts) | Brief generator test suite (46 tests) |
| [tests/generation/templates.test.ts](tests/generation/templates.test.ts) | Templates test suite (53 tests) |
| [tests/generation/tech-stacks.test.ts](tests/generation/tech-stacks.test.ts) | Tech stacks test suite (50 tests) |
| [src/delivery/email.ts](src/delivery/email.ts) | Email send logic (Resend API, batch delivery) |
| [src/delivery/email-builder.ts](src/delivery/email-builder.ts) | HTML email generation (tier-based content) |
| [src/delivery/templates/daily.html](src/delivery/templates/daily.html) | Email template reference |
| [tests/delivery/email.test.ts](tests/delivery/email.test.ts) | Email delivery test suite (35 tests) |

### Web Dashboard (zerotoship-web/)
| File | Purpose |
|------|---------|
| [app/page.tsx](../zerotoship-web/app/page.tsx) | Home page - today's ranked ideas |
| [app/idea/[id]/page.tsx](../zerotoship-web/app/idea/[id]/page.tsx) | Full brief view for single idea |
| [app/archive/page.tsx](../zerotoship-web/app/archive/page.tsx) | Historical ideas browser with filters |
| [app/settings/page.tsx](../zerotoship-web/app/settings/page.tsx) | User preferences (categories, effort, notifications) |
| [app/account/page.tsx](../zerotoship-web/app/account/page.tsx) | Subscription management and billing |
| [components/IdeaCard.tsx](../zerotoship-web/components/IdeaCard.tsx) | Idea card component with ranking |
| [components/BriefView.tsx](../zerotoship-web/components/BriefView.tsx) | Full brief display component |
| [components/ScoreBadge.tsx](../zerotoship-web/components/ScoreBadge.tsx) | Score and effort badges |
| [components/NavBar.tsx](../zerotoship-web/components/NavBar.tsx) | Navigation component |
| [lib/api.ts](../zerotoship-web/lib/api.ts) | Backend API client |
| [lib/auth.ts](../zerotoship-web/lib/auth.ts) | Authentication utilities |
| [lib/types.ts](../zerotoship-web/lib/types.ts) | TypeScript types (IdeaBrief, User, Subscription) |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    DAILY PIPELINE                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  06:00  [Scrapers]                                       │
│         Reddit → HN → Twitter → GitHub                   │
│         Output: 300+ raw posts/day                       │
│                    │                                     │
│  07:00  [Analysis] ▼                                     │
│         Dedup → Score → Gap Analysis                     │
│         Output: 30-50 scored problems                    │
│                    │                                     │
│  07:30  [Generation] ▼                                   │
│         Brief Generator                                  │
│         Output: 10 full business briefs                  │
│                    │                                     │
│  08:00  [Delivery] ▼                                     │
│         Email (all users) + Dashboard (pro users)        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Agent Communication Log

```
[2026-01-31 10:00] System: Project structure created
[2026-01-31 10:00] System: Ready for Phase 1 agents (Scrapers)
[2026-01-31] HN Agent: ✅ HN Scraper complete
  - Created src/scrapers/types.ts (shared types)
  - Created src/scrapers/hn-api.ts (Algolia API wrapper)
  - Created src/scrapers/hackernews.ts (main scraper)
  - Created tests/scrapers/hackernews.test.ts (test suite)
  - Features: Ask HN, Show HN comments, front page, 10 pain point queries
  - Exports: scrapeHackerNews(), scrapeHackerNewsQuick()

[2026-01-31] Reddit Agent: ✅ Reddit Scraper complete
  - Created src/scrapers/signals.ts (50+ pain point patterns in 6 categories)
  - Created src/scrapers/reddit.ts (main scraper with rate limiting)
  - Created tests/scrapers/reddit.test.ts (comprehensive test suite)
  - Features: 8 subreddits, JSON API, pagination, deduplication
  - Signal categories: wishful, frustration, seeking, willingness, requests, problems
  - Exports: scrapeReddit(), detectSignals(), getScrapeStats(), sortBySignalStrength()

[2026-01-31] Twitter Agent: ✅ Twitter Scraper complete
  - Created src/scrapers/twitter.ts (main orchestrator with fallback)
  - Created src/scrapers/twitter-api.ts (Twitter API v2 client)
  - Created src/scrapers/twitter-nitter.ts (Nitter fallback scraper)
  - Created tests/scrapers/twitter.test.ts (comprehensive test suite)
  - Added Tweet, TwitterConfig interfaces to types.ts
  - Features:
    - Twitter API v2 with pagination and rate limiting (450 req/15 min)
    - Nitter fallback (auto-switches between 5 instances)
    - 8 default search queries for developer pain points
    - Hashtag scraping (#buildinpublic, #indiehacker, #devtools)
    - Spam filtering and relevance scoring
    - CLI entry point for standalone testing
  - Exports: scrapeTwitter(), TwitterScraper, twitterScraper

[2026-01-31] GitHub Agent: ✅ GitHub Scraper complete
  - Created src/scrapers/github-api.ts (Octokit wrapper with rate limiting)
  - Created src/scrapers/github.ts (main scraper)
  - Created tests/scrapers/github.test.ts (test suite)
  - Updated types.ts with GitHubIssue interface
  - Features:
    - Octokit REST API with authentication
    - 5 default search queries (help wanted, feature request, enhancement, pain points)
    - Targets repos with >500 stars (configurable)
    - Pagination (up to 3 pages per query)
    - Rate limit handling with auto-wait
    - Repository star count caching
    - Pain point signal detection
    - Results sorted by reactions + comments + repo popularity
  - Exports: scrapeGitHub(), GitHubScraper, DEFAULT_GITHUB_QUERIES

[2026-01-31] Deduplicator Agent: ✅ Deduplication & Clustering complete
  - Created src/analysis/deduplicator.ts (main clustering logic)
  - Created src/analysis/embeddings.ts (OpenAI embedding client with caching)
  - Created src/analysis/similarity.ts (cosine similarity and clustering algorithms)
  - Created src/analysis/index.ts (module exports)
  - Features:
    - OpenAI text-embedding-3-small for embeddings
    - Hierarchical clustering (cosine similarity > 0.85)
    - Embedding cache to reduce API calls
    - Batch processing (100 embeddings per batch)
    - AI-generated problem summaries
    - Incremental updates with mergeIntoClusters()
  - Exports: clusterPosts(), getClusterStats(), mergeIntoClusters()

[2026-01-31] Verification Agent: ✅ Agent 5 (Deduplicator) VERIFIED
  - All required files present:
    - src/analysis/deduplicator.ts (387 lines)
    - src/analysis/embeddings.ts (252 lines)
    - src/analysis/similarity.ts (284 lines)
    - src/analysis/index.ts (35 lines)
    - tests/analysis/deduplicator.test.ts (447 lines)
  - ProblemCluster interface matches spec ✅
  - clusterPosts() function implemented ✅
  - Success criteria review:
    - ✅ Reduces 300→30-50 problems (hierarchical clustering with 0.85 threshold)
    - ✅ Similar problems grouped (cosine similarity)
    - ✅ AI summaries (GPT-4o-mini for problem statements)
    - ✅ Processing <2 min (batch embeddings, caching)
  - TypeScript compiles clean ✅
  - Ready for Agents 6 + 7 to consume ProblemCluster output

[2026-01-31] Scorer Agent: ✅ Scorer complete
  - Created src/analysis/scorer.ts (main scoring logic)
  - Created src/analysis/score-prompts.ts (AI prompt templates)
  - Created tests/analysis/scorer.test.ts (37 tests, all passing)
  - Updated src/analysis/index.ts (new exports)
  - Scoring formula:
    - IMPACT = frequency × severity × marketSize
    - EFFORT = technicalComplexity × timeToMvp
    - PRIORITY = IMPACT / EFFORT
  - Features:
    - AI scoring via GPT-4o-mini (severity, market size, complexity, time to MVP)
    - Fallback heuristic scoring when AI unavailable
    - Batch processing with rate limiting
    - Quick wins filter (low effort, high priority)
    - Weekend projects filter (timeToMvp ≤ 2, complexity ≤ 4)
  - Exports: scoreProblem(), scoreAll(), getScoringStats(), exportScoredProblems()
  - Ready for Agent 8 (Brief Generator) to consume ScoredProblem output

[2026-01-31] Gap Analyzer Agent: ✅ Gap Analysis complete
  - Created src/analysis/gap-analyzer.ts (main gap analysis logic)
  - Created src/analysis/web-search.ts (multi-provider search client)
  - Created src/analysis/competitor.ts (AI competitor analysis)
  - Created tests/analysis/gap-analyzer.test.ts (46 tests, all passing)
  - Updated src/analysis/index.ts (new exports)
  - Features:
    - Multi-provider web search (SerpAPI, Brave Search, mock fallback)
    - Auto-generated search queries from problem statements
    - AI competitor analysis (strengths, weaknesses, pricing)
    - Market gap identification
    - Market opportunity scoring (high/medium/low/saturated)
    - Differentiation angle suggestions
    - Competition score (0-100)
    - Markdown and JSON export formats
  - Interface: GapAnalysis, Competitor
  - Exports: analyzeGaps(), analyzeAllGaps(), filterByOpportunity(), sortByOpportunity()
  - Takes ProblemCluster as input (runs PARALLEL with Scorer)
  - Ready for Agent 8 (Brief Generator) to combine ScoredProblem + GapAnalysis

[2026-01-31 13:35] Verification: ✅ Phase 2 VERIFIED & COMMITTED
  - Fixed bug in computeSimilarityMatrix (matrix row initialization)
  - Fixed test noise level for hierarchical clustering test
  - All 226 tests passing (7 test files)
    - Phase 1: 106 scraper tests
    - Phase 2: 120 analysis tests (deduplicator, scorer, gap-analyzer)
  - Commit: aad52c3 "feat: complete Phase 2 analysis pipeline (Agents 5, 6, 7)"
  - Pushed to origin/main
  - Ready for Agent 8 (Brief Generator)

[2026-01-31] Testing Agent: ✅ Comprehensive test coverage added
  - Created tests/analysis/embeddings.test.ts (35 tests)
  - Created tests/analysis/web-search.test.ts (36 tests)
  - Created tests/analysis/competitor.test.ts (35 tests)
  - Created tests/generation/templates.test.ts (53 tests)
  - Created tests/generation/tech-stacks.test.ts (50 tests)
  - Total: 516 tests passing (14 test files)
  - Coverage expanded:
    - EmbeddingClient: constructor, embed, embedBatch, caching, persistence
    - WebSearchClient: provider selection, rate limiting, search execution
    - Competitor analysis: filtering, fallback analysis, scoring, summarization
    - Templates: prompt building, JSON parsing, effort mapping
    - Tech stacks: category detection, stack recommendations, formatting

[2026-01-31] Brief Generator Agent: ✅ Brief Generator complete
  - Created src/generation/brief-generator.ts (main generation logic)
  - Created src/generation/templates.ts (GPT-4 prompt templates)
  - Created src/generation/tech-stacks.ts (tech stack recommendations)
  - Created src/generation/index.ts (module exports)
  - Created tests/generation/brief-generator.test.ts (46 tests, all passing)
  - Features:
    - GPT-4 powered brief generation with structured JSON output
    - Fallback briefs when API unavailable
    - Effort estimation (weekend/week/month/quarter) from scores
    - Tech stack recommendations by effort level and problem category
    - Category detection (developer-tools, ai-ml, saas, marketplace, etc.)
    - Comprehensive IdeaBrief interface with all required fields
    - Markdown and JSON export formats
    - Quick wins filter (weekend/week projects sorted by priority)
    - Batch processing with rate limiting
  - Interface: IdeaBrief, BriefGeneratorConfig
  - Exports: generateBrief(), generateAllBriefs(), formatBriefMarkdown(), getQuickWins()
  - Takes ScoredProblem + GapAnalysis as input
  - Ready for Phase 3 (Email Delivery + Web Dashboard)

[2026-01-31] Code Review Agent: ✅ Full codebase review complete
  - Reviewed all 23 source files across 3 modules (~4,000 LOC)
  - Created reviews/scrapers-review.md
  - Created reviews/analysis-review.md
  - Created reviews/generation-review.md
  - Created reviews/SUMMARY.md
  - Overall quality: 8.7/10
  - Key findings:
    - Excellent TypeScript usage (no `any` types)
    - All 226 tests passing
    - Good error handling with fallbacks
    - No security issues
  - Issues found:
    - Medium: Duplicate detectSignals() across files
    - Medium: Duplicate PAIN_POINT_SIGNALS constants
    - Low: Console logging (should use pino/winston)
    - Low: Import position in deduplicator.ts
  - Recommendation: Production-ready, proceed to Phase 3

[2026-01-31] Email Delivery Agent: ✅ Email Delivery complete
  - Created src/delivery/email-builder.ts (HTML email generation)
  - Created src/delivery/email.ts (Resend send logic, batch delivery)
  - Created src/delivery/templates/daily.html (email template reference)
  - Created tests/delivery/email.test.ts (35 tests, all passing)
  - Features:
    - Tier-based content (free=3 ideas, pro=10 ideas)
    - HTML email with modern responsive design
    - Plain text fallback version
    - Hero section for #1 idea with full brief
    - Secondary ideas list with scores
    - Locked content indicators for free tier
    - Upgrade CTA for free tier users
    - Personalized unsubscribe links
    - Resend API integration with batch sending
    - Progress callbacks and delivery tracking
    - Configurable concurrency and rate limiting
  - Interface: EmailContent, Subscriber, DeliveryStatus, BatchDeliveryResult
  - Exports: sendDailyBrief(), sendDailyBriefsBatch(), buildDailyEmail(), previewDailyBrief()
  - Subject format: "Today's Top Startup Idea: {#1 idea name}"
  - Ready for scheduler integration (Module 4B)

[2026-01-31] Web Dashboard Agent: ✅ Web Dashboard complete
  - Created zerotoship-web/ Next.js project (separate repo)
  - Created app/page.tsx (today's top ideas with ranking)
  - Created app/idea/[id]/page.tsx (full brief view)
  - Created app/archive/page.tsx (historical browser with filters)
  - Created app/settings/page.tsx (user preferences)
  - Created app/account/page.tsx (subscription management)
  - Created components/IdeaCard.tsx (idea card with score badge)
  - Created components/BriefView.tsx (full brief display)
  - Created components/ScoreBadge.tsx (score + effort badges)
  - Created components/NavBar.tsx (navigation)
  - Created lib/api.ts (backend API client)
  - Created lib/auth.ts (authentication utilities)
  - Created lib/types.ts (TypeScript types matching IdeaBrief)
  - Features:
    - Today's ranked ideas with priority scores
    - Full brief view with all sections (problem, solution, tech spec, business model, GTM)
    - Archive with search, effort filter, and score filter
    - Settings for categories, effort preferences, email frequency
    - Account page with plan comparison and billing history
    - Dark mode support throughout
    - Responsive design with Tailwind CSS
  - Tech stack: Next.js 15, React 19, TypeScript, Tailwind CSS
  - Ready for API integration (uses mock data for development)

-- Agents: Post your status updates below --

```

---

## Next Steps

1. ✅ **Complete**: Phase 1 (4 scrapers) - All verified, 106 tests
2. ✅ **Complete**: Phase 2 (Analysis) - Deduplicator, Scorer, Gap Analyzer, Brief Generator
3. ✅ **Complete**: Phase 3 (Delivery) - Email + Web Dashboard
4. 🔜 **Immediate**: Decide on database provider (Supabase vs Railway) - blocks Agent 11
5. 🔜 **Ready**: Agent 11 (REST API) - Build API endpoints for dashboard
6. 🔜 **Ready**: Agent 12 (Scheduler/Orchestrator) - Wire up daily pipeline
7. **Then**: Database schema migrations + deployment (Vercel + Railway)
8. **Then**: Beta launch to 100 users

---

## Questions / Blockers

- [ ] Do we have Twitter API access? (fallback: Nitter)
- [x] Which search API for gap analysis? → Supports both SerpAPI + Brave (auto-detects via env vars)
- [ ] Supabase vs Railway for Postgres?
- [x] **Test Runner Issue**: RESOLVED - All 516 tests passing. Was a configuration issue.

---

## Pending Architectural Decisions

### Decision 1: Database Provider
**Status**: ⏳ Pending
**Blocking**: Agent 11 (REST API)

| Option | Pros | Cons |
|--------|------|------|
| **Supabase** | Built-in auth, realtime subscriptions, generous free tier, pgvector for embeddings | Vendor lock-in, less control over Postgres config |
| **Railway** | Full Postgres control, simple pricing, easy CI/CD integration | Need to implement auth separately, no built-in realtime |

**Recommendation**: Supabase for MVP speed (built-in auth saves Agent 11 significant work). Can migrate to Railway later if needed.

**To decide**: Owner should update this section with choice + reasoning.

---

### Decision 2: Twitter API Access
**Status**: ⏳ Pending
**Impact**: Low (Nitter fallback works)

| Option | Pros | Cons |
|--------|------|------|
| **Twitter API v2** | Official, reliable, better data | $100/mo basic tier, rate limits |
| **Nitter fallback** | Free, already implemented | Less reliable, may break, fewer tweets |

**Current state**: Twitter scraper uses Nitter fallback automatically when no API key is set. Works for MVP but may miss some content.

**To decide**: Is Twitter data important enough to justify $100/mo? For MVP, Nitter is likely sufficient.

---

### Decision 3: Deployment Strategy
**Status**: ⏳ Pending
**Blocking**: Agent 12 (Scheduler)

| Component | Option A | Option B |
|-----------|----------|----------|
| **Web Dashboard** | Vercel (free tier) | Railway |
| **API Server** | Railway | Vercel serverless |
| **Scheduler/Cron** | Railway (always-on) | GitHub Actions cron |
| **Database** | Supabase | Railway Postgres |

**Recommendation**:
- Vercel for web (free, optimized for Next.js)
- Railway for API + scheduler (needs persistent process for cron)
- Supabase for DB (or Railway Postgres if Decision 1 goes that way)

**To decide**: Confirm deployment stack before Agent 12 finalizes scheduler implementation.

---

## Links

- [[zerotoship]] - Product overview
- [[Feature-Plan]] - Technical plan
- [[Agent-Instructions]] - Agent prompts
- [[START-HERE]] - Onboarding guide
- [[Decisions]] - ADRs
- [[Daily/]] - Work logs
