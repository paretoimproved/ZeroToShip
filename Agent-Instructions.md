# Agent Instructions - Building IdeaForge

> **Purpose**: Copy-paste these prompts to spin up parallel agents. Each agent builds a specific module of IdeaForge.

---

## Quick Reference: Module Assignments

| Agent | Module | Dependencies | Parallel With | Effort |
|-------|--------|--------------|---------------|--------|
| 1-4 | Scrapers | None | Each other | ✅ COMPLETE |
| 5 | Deduplicator | Phase 1 done | T, R | ✅ COMPLETE |
| 6 | Scorer | Deduplicator done | **7, T, R** | ✅ COMPLETE |
| 7 | Gap Analyzer | Deduplicator done | **6, T, R** | ✅ COMPLETE |
| 8 | Brief Generator | 6 + 7 done | T, R | ✅ COMPLETE |
| 9 | Email Delivery | 8 done | 10, T, R | ✅ COMPLETE |
| 10 | Web Dashboard | 8 done | 9, T, R | ✅ COMPLETE |
| 11 | REST API | 8 done | 12, T, R | 🔜 READY |
| 12 | Scheduler | All modules done | T, R | 🔜 READY |
| T | Testing Agent | Any module done | All | Ongoing |
| R | Review Agent | Any module done | All | Ongoing |

### Execution Order

```
Phase 1: [1, 2, 3, 4] ─────────────────────────────────── ✅ COMPLETE
              │
Phase 2:     [5] ──┬──→ [6] ──┬──→ [8] ────────────────── ✅ COMPLETE
              ✅   │    ✅    │    ✅
                   └──→ [7] ──┘
                        ✅

Phase 3:                      └──→ [9, 10] ────────────── ✅ COMPLETE
                                    ✅  ✅

Phase 4:                           └──→ [11, 12] ──────── 🔜 READY
                                        (API + Scheduler)

Support:    [T, R] ─────────────────────────────────────→ (always available)
```

---

## ✅ Phase 1 Complete: Scraper Layer

Phase 1 scrapers are complete and tested. All 106 tests pass.

### Available Imports for Phase 2+

```typescript
// Types (from src/scrapers/types.ts)
import type {
  RawPost,
  HNPost,
  Tweet,
  GitHubIssue,
  TwitterConfig,
  GitHubSearchQuery,
  RateLimitInfo,
  ScrapeResult
} from '../scrapers/types';

// Signal detection (from src/scrapers/signals.ts)
import {
  detectSignals,
  detectSignalsWithCategory,
  hasSignals,
  calculateSignalStrength,
  extractSignalContext,
  SIGNAL_PATTERNS,
  ALL_SIGNALS
} from '../scrapers/signals';

// Pain point signals constant (from types.ts)
import { PAIN_POINT_SIGNALS } from '../scrapers/types';

// Scrapers
import { scrapeReddit } from '../scrapers/reddit';
import { scrapeHackerNews } from '../scrapers/hackernews';
import { scrapeTwitter } from '../scrapers/twitter';
import { scrapeGitHub } from '../scrapers/github';
```

### Source Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/scrapers/types.ts` | 144 | Shared TypeScript interfaces |
| `src/scrapers/signals.ts` | 231 | Pain point detection (50+ patterns, 6 categories) |
| `src/scrapers/reddit.ts` | 385 | Reddit JSON API scraper |
| `src/scrapers/hackernews.ts` | 379 | HN Algolia API scraper |
| `src/scrapers/twitter.ts` | 429 | Twitter API + Nitter fallback |
| `src/scrapers/github.ts` | 202 | GitHub Octokit scraper |

---

## ✅ Agent 5 Complete: Deduplicator

Agent 5 (Deduplicator/Clustering) is complete and verified. Ready for Agents 6 + 7.

### Available Imports from Analysis Module

```typescript
// Main clustering function (from src/analysis/deduplicator.ts)
import {
  clusterPosts,
  mergeIntoClusters,
  exportClusters,
  getClusterStats,
  type ProblemCluster,
  type ClusteringOptions,
} from '../analysis/deduplicator';

// Or use the barrel export:
import {
  clusterPosts,
  type ProblemCluster,
  EmbeddingClient,
  cosineSimilarity,
} from '../analysis';
```

### ProblemCluster Interface (for Agents 6 + 7)

```typescript
interface ProblemCluster {
  id: string;
  representativePost: RawPost;
  relatedPosts: RawPost[];
  frequency: number;           // Number of similar posts
  totalScore: number;          // Sum of all post scores
  embedding: number[];         // Cluster centroid
  problemStatement: string;    // AI-generated summary
  sources: ('reddit' | 'hn' | 'twitter' | 'github')[];
}
```

### Source Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/analysis/deduplicator.ts` | 387 | Main clustering logic |
| `src/analysis/embeddings.ts` | 252 | OpenAI embedding client with caching |
| `src/analysis/similarity.ts` | 284 | Cosine similarity & clustering algorithms |
| `src/analysis/index.ts` | 35 | Module exports |
| `tests/analysis/deduplicator.test.ts` | 447 | Comprehensive test suite |

---

## Phase 2: Analysis Pipeline

> **Parallel Strategy**: After Agent 5 (Deduplicator) completes, Agents 6 and 7 can run in parallel.

---

### Agent 5: Deduplicator / Clustering

~~~text
You are building the deduplication and clustering module for IdeaForge.

## Context
IdeaForge scrapes 300+ posts daily from Reddit, HN, Twitter, GitHub. Many posts describe the same problem in different words. Your job is to cluster similar problems together.

**Project location**: c:\Users\brand\Projects\ideaforge\

Read the existing code first:
- src/scrapers/types.ts (RawPost interface)
- src/scrapers/signals.ts (signal detection utilities)
- docs/Feature-Plan.md (Module 2A details)

## Your Task
Build a system that:
1. Takes all raw posts from scrapers
2. Generates embeddings using OpenAI
3. Clusters similar posts together
4. Outputs deduplicated problem statements

### Requirements

1. **Embedding Generation**:
   - Use OpenAI text-embedding-3-small
   - Embed: title + first 500 chars of body
   - Cache embeddings to reduce API calls

2. **Clustering Algorithm**:
   - Compute cosine similarity between all pairs
   - If similarity > 0.85, cluster together
   - Use hierarchical clustering or DBSCAN
   - Each cluster = one unique problem

3. **Output**:
   - Select representative post per cluster (highest score)
   - Generate AI summary of the problem
   - Aggregate metrics (total upvotes, frequency)

### Deliverables

src/analysis/
├── deduplicator.ts    # Main clustering logic
├── embeddings.ts      # OpenAI embedding client
└── similarity.ts      # Cosine similarity utils
tests/analysis/
└── deduplicator.test.ts

### Interface to Implement

```typescript
import type { RawPost } from '../scrapers/types';

interface ProblemCluster {
  id: string;
  representativePost: RawPost;
  relatedPosts: RawPost[];
  frequency: number;
  totalScore: number;
  embedding: number[];
  problemStatement: string;  // AI-generated
  sources: ('reddit' | 'hn' | 'twitter' | 'github')[];
}

async function clusterPosts(posts: RawPost[]): Promise<ProblemCluster[]>
```

### Success Criteria
- Reduces 300 posts to 30-50 unique problems
- Similar problems consistently grouped
- AI summaries are concise and accurate
- Processing completes in <2 minutes

When done, update docs/Context.md with your progress.
~~~

---

### Agent 6: Scorer (Can run parallel with Agent 7)

~~~text
You are building the scoring module for IdeaForge.

## Context
After deduplication, we have 30-50 unique problems. Your job is to score each problem on impact and effort to calculate priority.

**Project location**: c:\Users\brand\Projects\ideaforge\

**IMPORTANT**: This agent can run in PARALLEL with Agent 7 (Gap Analyzer). You both consume ProblemCluster output from Agent 5.

Read the existing code first:
- src/scrapers/types.ts (base types)
- src/analysis/deduplicator.ts (ProblemCluster interface - when available)
- docs/Feature-Plan.md (Module 2B)

## Your Task
Score each problem cluster on:
- **Frequency**: How often mentioned (from cluster data)
- **Severity**: How painful (AI assessment)
- **Market Size**: Potential customer base (AI assessment)
- **Technical Complexity**: How hard to build (AI assessment)
- **Time to MVP**: Weekend/Week/Month/Quarter (AI assessment)

### Scoring Formula

```
IMPACT = frequency × severity × marketSize (each 1-10)
EFFORT = technicalComplexity × timeToMvp (each 1-10)
PRIORITY = IMPACT / EFFORT
```

### AI Prompt Template
Use GPT-4 to assess severity, market size, complexity:

```
Analyze this problem and provide scores:

Problem: "{problemStatement}"
Mentioned {frequency} times across {sources}
Sample posts: {samplePosts}

Score (1-10) with reasoning:
1. Severity: How painful is this for users?
2. Market Size: How many people have this problem?
3. Technical Complexity: How hard to build a solution?
4. Time to MVP: 1=weekend, 3=week, 7=month, 10=quarter

Respond as JSON.
```

### Deliverables

src/analysis/
├── scorer.ts          # Main scoring logic
└── score-prompts.ts   # AI prompt templates
tests/analysis/
└── scorer.test.ts

### Interface

```typescript
interface ScoredProblem extends ProblemCluster {
  scores: {
    frequency: number;
    severity: number;
    marketSize: number;
    technicalComplexity: number;
    timeToMvp: number;
    impact: number;
    effort: number;
    priority: number;
  };
  reasoning: {
    severity: string;
    marketSize: string;
    technicalComplexity: string;
  };
}

async function scoreProblem(cluster: ProblemCluster): Promise<ScoredProblem>
async function scoreAll(clusters: ProblemCluster[]): Promise<ScoredProblem[]>
```

When done, update docs/Context.md with your progress.
~~~

---

### Agent 7: Gap Analyzer (Can run parallel with Agent 6)

~~~text
You are building the gap analysis module for IdeaForge.

## Context
For each problem cluster, we need to find existing solutions and identify gaps in the market.

**Project location**: c:\Users\brand\Projects\ideaforge\

**IMPORTANT**: This agent can run in PARALLEL with Agent 6 (Scorer). You both consume ProblemCluster output from Agent 5. You do NOT need ScoredProblem - you only need the problemStatement to search for competitors.

Read the existing code first:
- src/analysis/deduplicator.ts (ProblemCluster interface - when available)
- docs/Feature-Plan.md (Module 2C)

## Your Task
For each problem:
1. Search the web for existing solutions
2. Analyze competitor strengths/weaknesses
3. Identify market gaps and opportunities
4. Determine if a new solution is viable

### Requirements

1. **Web Search**:
   - Use SerpAPI, Brave Search API, or similar
   - Generate 2-3 search queries per problem
   - Fetch top 10 results

2. **AI Analysis**:
   - Analyze search results to identify competitors
   - Assess each competitor's strengths/weaknesses
   - Identify gaps (features missing, audiences underserved)
   - Recommend differentiation angles

### Deliverables

src/analysis/
├── gap-analyzer.ts    # Main analysis logic
├── web-search.ts      # Search API client
└── competitor.ts      # Competitor analysis
tests/analysis/
└── gap-analyzer.test.ts

### Interface

```typescript
interface GapAnalysis {
  problemId: string;
  problemStatement: string;
  searchQueries: string[];
  existingSolutions: Competitor[];
  gaps: string[];
  marketOpportunity: 'high' | 'medium' | 'low' | 'saturated';
  differentiationAngles: string[];
  recommendation: string;
}

interface Competitor {
  name: string;
  url: string;
  description: string;
  pricing: string;
  strengths: string[];
  weaknesses: string[];
}

// Takes ProblemCluster, not ScoredProblem - enables parallel execution with Scorer
async function analyzeGaps(problem: ProblemCluster): Promise<GapAnalysis>
async function analyzeAllGaps(problems: ProblemCluster[]): Promise<GapAnalysis[]>
```

When done, update docs/Context.md with your progress.
~~~

---

### Agent 8: Brief Generator

~~~text
You are building the business brief generator for IdeaForge.

## Context
This is the core output of IdeaForge - the daily business briefs that users receive.

**Project location**: c:\Users\brand\Projects\ideaforge\

**Dependencies**: Requires BOTH Agent 6 (Scorer) and Agent 7 (Gap Analyzer) to be complete.

Read the existing code first:
- src/analysis/scorer.ts (ScoredProblem interface)
- src/analysis/gap-analyzer.ts (GapAnalysis interface)
- docs/Feature-Plan.md (Module 2D)

## Your Task
Generate comprehensive business briefs that include:
1. Problem statement
2. Target audience
3. Existing solutions & gaps
4. Proposed solution with features
5. Technical implementation spec
6. Business model & pricing
7. Go-to-market strategy
8. Risks & mitigations

### Requirements

1. **Use GPT-4** for generation
2. **Input**: ScoredProblem + GapAnalysis
3. **Output**: Markdown brief ready for delivery
4. **Include**: Realistic monetization paths
5. **Include**: Specific tech stack recommendations
6. **Include**: Launch strategy (where to post, how to get first users)

### Deliverables

src/generation/
├── brief-generator.ts   # Main generator
├── templates.ts         # Prompt templates
└── tech-stacks.ts       # Tech stack recommendations
tests/generation/
└── brief-generator.test.ts

### Interface

```typescript
interface IdeaBrief {
  id: string;
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: 'weekend' | 'week' | 'month' | 'quarter';
  revenueEstimate: string;

  problemStatement: string;
  targetAudience: string;
  marketSize: string;

  existingSolutions: string;
  gaps: string;

  proposedSolution: string;
  keyFeatures: string[];
  mvpScope: string;

  technicalSpec: {
    stack: string[];
    architecture: string;
    estimatedEffort: string;
  };

  businessModel: {
    pricing: string;
    revenueProjection: string;
    monetizationPath: string;
  };

  goToMarket: {
    launchStrategy: string;
    channels: string[];
    firstCustomers: string;
  };

  risks: string[];
  generatedAt: Date;
}

async function generateBrief(problem: ScoredProblem, gaps: GapAnalysis): Promise<IdeaBrief>
async function generateAllBriefs(
  scoredProblems: ScoredProblem[],
  gapAnalyses: Map<string, GapAnalysis>
): Promise<IdeaBrief[]>
```

When done, update docs/Context.md with your progress.
~~~

---

## Phase 3: Delivery

> Agents 9 and 10 can run in parallel after Brief Generator completes.

---

### Agent 9: Email Delivery

~~~text
You are building the email delivery system for IdeaForge.

## Context
Every day at 8 AM, we send the daily brief email to all subscribers.

**Project location**: c:\Users\brand\Projects\ideaforge\

Read the existing code first:
- src/generation/brief-generator.ts (IdeaBrief interface)
- docs/Feature-Plan.md (Module 3A)

## Your Task
Build the email delivery system:
1. Generate HTML email from daily briefs
2. Send via Resend (or SendGrid)
3. Handle subscriber tiers (free=3 ideas, pro=10 ideas)
4. Track delivery status

### Email Structure
- Subject: "🔥 Today's Top Startup Idea: {#1 idea name}"
- Hero section: Top idea with full brief
- List section: Ideas 2-10 (titles + scores)
- CTA: Upgrade for full access
- Footer: Unsubscribe link

### Deliverables

src/delivery/
├── email.ts              # Send logic
├── email-builder.ts      # HTML generation
└── templates/
    └── daily.html        # Email template
tests/delivery/
└── email.test.ts

When done, update docs/Context.md with your progress.
~~~

---

### Agent 10: Web Dashboard

~~~text
You are building the web dashboard for IdeaForge.

## Context
Pro users access the full dashboard to browse ideas, view historical briefs, and manage their account.

**Project location**: c:\Users\brand\Projects\ideaforge-web\ (separate repo)

Read the existing code first:
- ../ideaforge/src/generation/brief-generator.ts (IdeaBrief interface)
- ../ideaforge/docs/Feature-Plan.md (Module 3B)

## Your Task
Build a Next.js dashboard with:
1. Today's ideas (ranked list)
2. Full brief view for each idea
3. Historical archive
4. User settings
5. Subscription management

### Pages
- / - Today's top ideas
- /idea/[id] - Full brief view
- /archive - Browse past ideas
- /settings - Preferences
- /account - Subscription/billing

### Deliverables

app/
├── page.tsx              # Home/today
├── idea/[id]/page.tsx    # Brief view
├── archive/page.tsx      # Historical
├── settings/page.tsx     # User prefs
└── account/page.tsx      # Billing
components/
├── IdeaCard.tsx
├── BriefView.tsx
├── ScoreBadge.tsx
└── NavBar.tsx
lib/
├── api.ts                # Backend API client
└── auth.ts               # Authentication

When done, update ../ideaforge/docs/Context.md with your progress.
~~~

---

## Phase 4: Infrastructure

> Agents 11 and 12 can run in parallel. Agent 11 builds the API that powers the web dashboard. Agent 12 wires up the daily pipeline.

---

### Agent 11: REST API

~~~text
You are building the REST API for IdeaForge.

## Context
The web dashboard (ideaforge-web) needs a backend API to serve real data instead of mocks. This API will also be available to Enterprise tier customers for programmatic access.

**Project location**: c:\Users\brand\Projects\ideaforge\

Read the existing code first:
- src/generation/brief-generator.ts (IdeaBrief interface)
- src/delivery/email.ts (subscriber and delivery types)
- ideaforge-web/lib/types.ts (frontend TypeScript types to match)
- docs/Feature-Plan.md (Module 3C)

## Your Task
Build a REST API with:
1. Public endpoints for today's ideas and idea details
2. Protected endpoints for user-specific data
3. API key authentication for Enterprise tier
4. Rate limiting per tier

### Endpoints

```
Public (auth optional, affects tier limits):
GET  /api/v1/ideas/today         - Today's ranked ideas (free: 3, pro: 10, enterprise: all)
GET  /api/v1/ideas/:id           - Single idea with full brief (pro+ only for full brief)
GET  /api/v1/ideas/archive       - Historical ideas with pagination + filters

Protected (requires auth):
GET  /api/v1/user/preferences    - User's category/effort preferences
PUT  /api/v1/user/preferences    - Update preferences
GET  /api/v1/user/subscription   - Current subscription status
GET  /api/v1/user/history        - User's viewed/saved ideas

Enterprise (requires API key):
GET  /api/v1/ideas/search        - Full-text search across all ideas
POST /api/v1/validate            - Request deep validation for an idea
GET  /api/v1/export              - Export ideas as JSON/CSV
```

### Rate Limits

| Tier | Requests/hour | Ideas returned |
|------|--------------|----------------|
| Anonymous | 10 | 3 (preview only) |
| Free | 100 | 3 ideas |
| Pro | 1000 | 10 ideas |
| Enterprise | 10000 | All + API access |

### Tech Stack
- **Framework**: Express.js or Fastify (your choice, justify in Context.md)
- **Auth**: JWT tokens for web users, API keys for Enterprise
- **Database**: PostgreSQL with Prisma or Drizzle ORM
- **Validation**: Zod for request/response schemas

### Deliverables

```
src/api/
├── server.ts              # Express/Fastify app setup
├── routes/
│   ├── ideas.ts           # /api/v1/ideas/* endpoints
│   ├── user.ts            # /api/v1/user/* endpoints
│   └── enterprise.ts      # Enterprise-only endpoints
├── middleware/
│   ├── auth.ts            # JWT + API key authentication
│   ├── rateLimit.ts       # Tier-based rate limiting
│   └── tierGate.ts        # Enforce tier restrictions
├── services/
│   ├── ideas.ts           # Business logic for ideas
│   └── users.ts           # User management
└── db/
    ├── schema.ts          # Database schema (Prisma/Drizzle)
    └── client.ts          # Database client
tests/api/
├── ideas.test.ts
├── auth.test.ts
└── rateLimit.test.ts
```

### Interface

```typescript
// Response types (match frontend lib/types.ts)
interface IdeaListResponse {
  ideas: IdeaSummary[];
  total: number;
  page: number;
  pageSize: number;
  tier: 'anonymous' | 'free' | 'pro' | 'enterprise';
}

interface IdeaSummary {
  id: string;
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: 'weekend' | 'week' | 'month' | 'quarter';
  category: string;
  generatedAt: string;
  // Full brief fields only included for pro+ tiers
  brief?: IdeaBrief;
}

interface UserPreferences {
  categories: string[];      // Filter by category
  maxEffort: 'weekend' | 'week' | 'month' | 'quarter';
  emailFrequency: 'daily' | 'weekly' | 'never';
  savedIdeas: string[];      // Bookmarked idea IDs
}
```

### Database Decisions Pending
**IMPORTANT**: Before starting, check docs/Context.md for the database decision:
- Option A: **Supabase** - Hosted Postgres + built-in auth + realtime
- Option B: **Railway** - Simpler Postgres + more control

If not decided, propose a recommendation with trade-offs in Context.md and wait for approval.

### Success Criteria
- All endpoints return correct data shapes
- Rate limiting enforced per tier
- Auth works for both JWT (web) and API keys (enterprise)
- <100ms response time for cached endpoints
- Tests cover happy path + auth + rate limits

When done, update docs/Context.md with your progress.
~~~

---

### Agent 12: Scheduler / Orchestrator

~~~text
You are building the scheduler and orchestrator for IdeaForge.

## Context
IdeaForge needs to run a daily pipeline that scrapes, analyzes, generates briefs, and delivers emails. This module wires everything together and runs on a schedule.

**Project location**: c:\Users\brand\Projects\ideaforge\

Read the existing code first:
- src/scrapers/*.ts (all scraper exports)
- src/analysis/*.ts (clusterPosts, scoreAll, analyzeAllGaps)
- src/generation/*.ts (generateAllBriefs)
- src/delivery/*.ts (sendDailyBriefsBatch)
- docs/Feature-Plan.md (Module 4B)

## Your Task
Build a scheduler that:
1. Runs the full pipeline daily at 6 AM
2. Orchestrates all modules in the correct order
3. Handles failures gracefully with retries
4. Provides logging and monitoring
5. Can be triggered manually for testing

### Daily Pipeline

```
06:00 UTC - SCRAPE PHASE
├── scrapeReddit()      ─┐
├── scrapeHackerNews()   │ (parallel)
├── scrapeTwitter()      │
└── scrapeGitHub()      ─┘
    │
    ▼ Combine all RawPost[]

07:00 UTC - ANALYSIS PHASE
├── clusterPosts(allPosts)          → ProblemCluster[]
├── scoreAll(clusters)              ─┐
└── analyzeAllGaps(clusters)        ─┘ (parallel)
    │
    ▼ Merge ScoredProblem[] + GapAnalysis[]

07:30 UTC - GENERATION PHASE
└── generateAllBriefs(scored, gaps) → IdeaBrief[]
    │
    ▼ Store in database

08:00 UTC - DELIVERY PHASE
├── sendDailyBriefsBatch(briefs, subscribers)
└── Update dashboard data
```

### Requirements

1. **Scheduling**:
   - Use node-cron or similar
   - Support timezone configuration
   - Allow manual trigger via CLI: `npm run pipeline`

2. **Orchestration**:
   - Run scrapers in parallel
   - Run scorer + gap analyzer in parallel
   - Handle partial failures (if one scraper fails, continue with others)
   - Retry failed steps up to 3 times

3. **Logging**:
   - Structured logging with timestamps
   - Log each phase start/end
   - Log post counts, idea counts, email counts
   - Write daily log to file + console

4. **Monitoring**:
   - Track pipeline duration
   - Track success/failure rates
   - Expose health check endpoint
   - Alert on failures (optional: webhook/email)

5. **Database Integration**:
   - Store raw posts (with dedup)
   - Store generated ideas
   - Update daily_runs table with stats

### Deliverables

```
src/scheduler/
├── index.ts           # Main entry point, cron setup
├── orchestrator.ts    # Pipeline coordination logic
├── phases/
│   ├── scrape.ts      # Scrape phase runner
│   ├── analyze.ts     # Analysis phase runner
│   ├── generate.ts    # Generation phase runner
│   └── deliver.ts     # Delivery phase runner
├── utils/
│   ├── logger.ts      # Structured logging (use pino)
│   ├── retry.ts       # Retry with exponential backoff
│   └── metrics.ts     # Pipeline metrics collection
└── cli.ts             # Manual trigger CLI
tests/scheduler/
├── orchestrator.test.ts
└── retry.test.ts
```

### Interface

```typescript
interface PipelineConfig {
  timezone: string;           // e.g., 'America/New_York'
  scrapeHours: number;        // Hours of content to scrape (default: 24)
  maxIdeas: number;           // Max ideas to generate (default: 10)
  dryRun: boolean;            // Skip email delivery
  verbose: boolean;           // Detailed logging
}

interface PipelineResult {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  duration: number;           // milliseconds
  phases: {
    scrape: PhaseResult;
    analyze: PhaseResult;
    generate: PhaseResult;
    deliver: PhaseResult;
  };
  stats: {
    postsScraped: number;
    clustersCreated: number;
    ideasGenerated: number;
    emailsSent: number;
  };
  errors: PipelineError[];
}

interface PhaseResult {
  name: string;
  status: 'success' | 'partial' | 'failed';
  startedAt: Date;
  completedAt: Date;
  duration: number;
  retries: number;
  error?: string;
}

// Main functions
async function runPipeline(config?: Partial<PipelineConfig>): Promise<PipelineResult>
function startScheduler(config?: Partial<PipelineConfig>): void
function stopScheduler(): void
```

### CLI Commands

```bash
# Run full pipeline manually
npm run pipeline

# Run with options
npm run pipeline -- --dry-run          # Skip email delivery
npm run pipeline -- --hours 48         # Scrape 48 hours of content
npm run pipeline -- --verbose          # Detailed logging

# Run individual phases (for debugging)
npm run pipeline:scrape
npm run pipeline:analyze
npm run pipeline:generate
npm run pipeline:deliver
```

### Logging Format (pino)

```json
{
  "level": "info",
  "time": "2026-01-31T06:00:00.000Z",
  "runId": "run_abc123",
  "phase": "scrape",
  "msg": "Starting Reddit scraper",
  "source": "reddit"
}
```

### Database Schema (for tracking runs)

```sql
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(20),      -- 'running', 'success', 'partial', 'failed'
  posts_scraped INTEGER,
  clusters_created INTEGER,
  ideas_generated INTEGER,
  emails_sent INTEGER,
  errors JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Success Criteria
- Pipeline completes end-to-end in <30 minutes
- Graceful handling of partial failures
- Structured logs queryable by phase/runId
- Manual trigger works via CLI
- Cron job runs reliably at 6 AM UTC

### Tech Debt to Address
This agent should also address the code review findings:
1. Replace console.log/console.error with pino logger
2. Export logger from scheduler/utils for use across codebase

When done, update docs/Context.md with your progress.
~~~

---

## Support Agents (Run Anytime in Parallel)

---

### Agent T: Testing Agent

~~~text
You are the Testing Agent for IdeaForge. Your job is to write comprehensive tests for modules as they are completed.

## Context
**Project location**: c:\Users\brand\Projects\ideaforge\

You can run in PARALLEL with any other agent. As modules are completed, you write and run tests to ensure quality.

## Test Framework
- **Runner**: Vitest
- **Run tests**: `npm test` (watch mode) or `npm run test:run` (once)
- **Existing tests**: tests/scrapers/*.test.ts (106 tests, all passing)

## Your Tasks

### For Each New Module:
1. Read the module's source code
2. Write comprehensive unit tests
3. Write integration tests if applicable
4. Ensure edge cases are covered
5. Run tests and fix any failures
6. Report coverage gaps

### Test Categories to Cover:
- **Unit tests**: Individual functions
- **Integration tests**: Module interactions
- **Error handling**: API failures, rate limits, malformed data
- **Edge cases**: Empty inputs, large inputs, Unicode, etc.

### Test File Naming
```
tests/
├── scrapers/          # ✅ Phase 1 complete
│   ├── reddit.test.ts
│   ├── hackernews.test.ts
│   ├── twitter.test.ts
│   └── github.test.ts
├── analysis/          # Phase 2
│   ├── deduplicator.test.ts
│   ├── scorer.test.ts
│   └── gap-analyzer.test.ts
├── generation/        # Phase 2
│   └── brief-generator.test.ts
└── delivery/          # Phase 3
    └── email.test.ts
```

### Test Template
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { functionToTest } from '../../src/module/file';

describe('ModuleName', () => {
  describe('functionToTest', () => {
    it('should handle normal input', () => {
      // Arrange
      const input = ...;
      // Act
      const result = functionToTest(input);
      // Assert
      expect(result).toBe(...);
    });

    it('should handle edge case', () => { ... });
    it('should throw on invalid input', () => { ... });
  });
});
```

### Success Criteria
- All new modules have >80% test coverage
- Tests are fast (<10s total)
- Tests are deterministic (no flaky tests)
- Mocks are used for external APIs

When done with a module's tests, update docs/Context.md with test status.
~~~

---

### Agent R: Code Review Agent

~~~text
You are the Code Review Agent for IdeaForge. Your job is to review code quality, architecture consistency, and identify issues.

## Context
**Project location**: c:\Users\brand\Projects\ideaforge\

You can run in PARALLEL with any other agent. As modules are completed, you review them for quality and consistency.

## Your Tasks

### For Each New Module:
1. **Read the source code** thoroughly
2. **Check TypeScript quality**:
   - Proper types (no `any`)
   - Consistent interfaces
   - Good error handling
3. **Check code patterns**:
   - Consistent with existing code style
   - Follows project conventions
   - No code duplication
4. **Check architecture**:
   - Proper separation of concerns
   - Correct module boundaries
   - Consistent exports
5. **Security review**:
   - No hardcoded secrets
   - Proper input validation
   - Safe API usage
6. **Performance review**:
   - No obvious bottlenecks
   - Efficient algorithms
   - Proper async handling

### Review Checklist

```markdown
## Code Review: [Module Name]

### TypeScript Quality
- [ ] No `any` types (use `unknown` if needed)
- [ ] Interfaces match documentation
- [ ] Proper error types

### Code Style
- [ ] Consistent naming conventions
- [ ] Proper JSDoc comments
- [ ] No console.log in production code (use proper logging)

### Architecture
- [ ] Follows existing patterns
- [ ] Correct imports from other modules
- [ ] Exports match interface documentation

### Error Handling
- [ ] All async functions have try/catch
- [ ] Errors are properly typed
- [ ] Graceful degradation

### Security
- [ ] No secrets in code
- [ ] Input validation present
- [ ] Rate limiting considered

### Performance
- [ ] No N+1 query patterns
- [ ] Proper caching where needed
- [ ] Efficient data structures

### Issues Found
1. [Issue description] - [Severity: High/Medium/Low]
2. ...

### Recommendations
1. [Improvement suggestion]
2. ...
```

### Output
Create review files at: `reviews/[module-name]-review.md`

When done, update docs/Context.md with review status and any blocking issues.
~~~

---

## Coordination Rules

1. **Before starting**:
   - Read docs/Context.md to see current state
   - Claim your module by updating Context.md
   - Check if dependencies are complete

2. **During work**:
   - Commit frequently with descriptive messages
   - Update Context.md with progress
   - Use existing types from `src/scrapers/types.ts`

3. **If blocked**:
   - Post blocker in docs/Context.md under "Blockers" section
   - Tag the blocking agent/module

4. **When done**:
   - Mark module complete in Context.md
   - List any follow-up tasks or known issues
   - Notify downstream agents they can start

5. **Parallel execution**:
   - Agents 6 + 7 should coordinate on shared ProblemCluster interface
   - Agents T + R can start as soon as any module is complete
   - Agents 9 + 10 can run in parallel after Agent 8

---

## Environment Setup

```bash
# Install dependencies
npm install

# Run tests
npm test          # Watch mode
npm run test:run  # Single run

# Build
npm run build

# Run CLI
npm run dev reddit --hours 24
```

### Required Environment Variables

```bash
# .env file
OPENAI_API_KEY=sk-...        # For embeddings and AI analysis
GITHUB_TOKEN=ghp_...         # For GitHub API (higher rate limits)
TWITTER_BEARER_TOKEN=...     # Optional: for Twitter API
SERP_API_KEY=...             # For gap analysis web search
RESEND_API_KEY=...           # For email delivery
```
