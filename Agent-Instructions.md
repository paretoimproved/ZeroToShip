# Agent Instructions - Building IdeaForge

> **Purpose**: Copy-paste these prompts to spin up parallel agents. Each agent builds a specific module of IdeaForge.

---

## Quick Reference: Module Assignments

| Agent | Module | Dependencies | Effort |
|-------|--------|--------------|--------|
| 1 | Reddit Scraper | None | 1-2 days |
| 2 | HN Scraper | None | 1-2 days |
| 3 | Twitter Scraper | None | 2-3 days |
| 4 | GitHub Scraper | None | 1-2 days |
| 5 | Deduplicator | Scrapers done | 2-3 days |
| 6 | Scorer | Deduplicator done | 2-3 days |
| 7 | Gap Analyzer | Scorer done | 2-3 days |
| 8 | Brief Generator | Gap Analyzer done | 2-3 days |
| 9 | Email Delivery | Brief Generator done | 1-2 days |
| 10 | Web Dashboard | Brief Generator done | 3-5 days |

**Phase 1** (Agents 1-4) can run in parallel.
**Phase 2** (Agents 5-8) can mostly run in parallel after Phase 1.
**Phase 3** (Agents 9-10) run after Phase 2.

---

## Phase 1: Scrapers (Run in Parallel)

---

### Agent 1: Reddit Scraper

~~~text
You are building the Reddit scraper module for IdeaForge.

## Context
IdeaForge is a SaaS that scrapes the web daily for technical pain points and generates prioritized entrepreneurial ideas with business plans.

Read this first for full context:
- c:\Users\brand\DevVault\01-Projects\ideaforge\ideaforge.md
- c:\Users\brand\DevVault\01-Projects\ideaforge\Feature-Plan.md

## Your Task
Build a Reddit scraper that collects posts containing pain points and product ideas.

### Requirements

1. **Target Subreddits**:
   - r/SideProject, r/startups, r/Entrepreneur
   - r/webdev, r/programming, r/devops
   - r/selfhosted, r/software

2. **Data to Extract**:
   - Post title, body, URL
   - Upvotes, comment count
   - Author, timestamp
   - Subreddit name

3. **Signal Detection**:
   Filter for posts containing:
   - "I wish", "wish there was"
   - "frustrated", "annoying"
   - "why isn't there", "why doesn't"
   - "I'd pay for", "would pay"
   - "looking for a tool/app"

4. **Technical Approach**:
   - Use Reddit JSON API (append .json to any URL)
   - OR use snoowrap library
   - Handle rate limiting (60 requests/min)
   - Paginate through results (last 24 hours)

### Deliverables
Create source code at: c:\Users\brand\DevVault\01-Projects\ideaforge\

src/
├── scrapers/
│   ├── reddit.ts       # Main scraper logic
│   ├── types.ts        # Shared interfaces
│   └── signals.ts      # Pain point detection
├── index.ts            # Entry point
tests/
└── scrapers/
    └── reddit.test.ts
package.json
tsconfig.json
README.md

### Interface to Implement

interface RawPost {
  id: string;
  source: 'reddit';
  sourceId: string;
  title: string;
  body: string;
  url: string;
  author: string;
  score: number;
  commentCount: number;
  createdAt: Date;
  scrapedAt: Date;
  subreddit: string;
  signals: string[];  // which pain point phrases were detected
}

async function scrapeReddit(subreddits: string[], hoursBack: number): Promise<RawPost[]>

### Success Criteria
- Scrapes 100+ posts per run
- Detects pain point signals accurately
- Handles rate limits gracefully
- Includes unit tests

When done, update c:\Users\brand\DevVault\01-Projects\ideaforge\Context.md
~~~

---

### Agent 2: Hacker News Scraper

~~~text
You are building the Hacker News scraper module for IdeaForge.

## Context
IdeaForge is a SaaS that scrapes the web daily for technical pain points and generates prioritized entrepreneurial ideas with business plans.

Read this first for full context:
- c:\Users\brand\DevVault\01-Projects\ideaforge\ideaforge.md
- c:\Users\brand\DevVault\01-Projects\ideaforge\Feature-Plan.md

## Your Task
Build a HN scraper that collects posts and comments containing pain points.

### Requirements

1. **Target Content**:
   - "Ask HN" posts (last 24-48 hours)
   - Comments on "Show HN" posts
   - Front page discussions about tools/products

2. **Data to Extract**:
   - Post/comment text
   - Points (upvotes)
   - Author, timestamp
   - Parent post context (for comments)

3. **Use HN Algolia API**:
   Base: https://hn.algolia.com/api/v1/
   Search: /search?query=...&tags=ask_hn
   By date: /search_by_date?...
   Item: /items/{id}

4. **Search Queries**:
   - "wish there was"
   - "frustrated with"
   - "looking for"
   - "anyone know of"
   - "I'd pay for"

### Deliverables
Add to: c:\Users\brand\DevVault\01-Projects\ideaforge\

src/scrapers/
├── hackernews.ts     # Main scraper
└── hn-api.ts         # API client wrapper
tests/scrapers/
└── hackernews.test.ts

### Interface to Implement

interface HNPost extends RawPost {
  source: 'hn';
  hnType: 'story' | 'comment';
  parentId?: string;
  storyTitle?: string;  // for comments
}

async function scrapeHackerNews(queries: string[], hoursBack: number): Promise<HNPost[]>

### Success Criteria
- Scrapes 50+ relevant posts per run
- Includes both stories and comments
- Uses Algolia API efficiently
- Tests cover main scenarios

When done, update c:\Users\brand\DevVault\01-Projects\ideaforge\Context.md
~~~

---

### Agent 3: Twitter/X Scraper

~~~text
You are building the Twitter/X scraper module for IdeaForge.

## Context
IdeaForge is a SaaS that scrapes the web daily for technical pain points and generates prioritized entrepreneurial ideas with business plans.

Read this first for full context:
- c:\Users\brand\DevVault\01-Projects\ideaforge\ideaforge.md
- c:\Users\brand\DevVault\01-Projects\ideaforge\Feature-Plan.md

## Your Task
Build a Twitter scraper that collects developer complaints and wishlists.

### Requirements

1. **Target Content**:
   - Hashtags: #buildinpublic, #indiehacker, #devtools
   - Developer complaint patterns
   - Tool/app wishlists

2. **Search Queries**:
   - "wish there was an app" -filter:retweets
   - "frustrated with" (developer OR coding OR programming)
   - "I'd pay for" (tool OR app OR service)
   - "why is there no" (app OR tool)

3. **Data to Extract**:
   - Tweet text
   - Likes, retweets
   - Author handle, follower count
   - Timestamp

4. **Technical Options**:

   Option A: Twitter API v2 (Preferred if you have access)
   - Requires developer account
   - 450 requests/15 min on Basic tier
   - Use tweets/search/recent endpoint

   Option B: Nitter (Fallback)
   - Scrape nitter.net instances
   - No API key needed
   - Less reliable

   Option C: RSS Feeds
   - Twitter lists as RSS via Nitter
   - Most stable fallback

### Deliverables
Add to: c:\Users\brand\DevVault\01-Projects\ideaforge\

src/scrapers/
├── twitter.ts         # Main scraper
├── twitter-api.ts     # Official API client
└── twitter-nitter.ts  # Nitter fallback
tests/scrapers/
└── twitter.test.ts

### Interface to Implement

interface Tweet extends RawPost {
  source: 'twitter';
  likes: number;
  retweets: number;
  authorFollowers: number;
  hashtags: string[];
}

async function scrapeTwitter(queries: string[], hoursBack: number): Promise<Tweet[]>

### Success Criteria
- Works with at least one method (API or Nitter)
- Scrapes 50+ relevant tweets per run
- Filters out retweets and spam
- Graceful fallback if primary method fails

When done, update c:\Users\brand\DevVault\01-Projects\ideaforge\Context.md
~~~

---

### Agent 4: GitHub Scraper

~~~text
You are building the GitHub scraper module for IdeaForge.

## Context
IdeaForge is a SaaS that scrapes the web daily for technical pain points and generates prioritized entrepreneurial ideas with business plans.

Read this first for full context:
- c:\Users\brand\DevVault\01-Projects\ideaforge\ideaforge.md
- c:\Users\brand\DevVault\01-Projects\ideaforge\Feature-Plan.md

## Your Task
Build a GitHub scraper that finds unmet needs in issues and discussions.

### Requirements

1. **Target Content**:
   - Issues labeled "help wanted", "feature request", "enhancement"
   - Issues with high reactions but no solution
   - Discussions in popular repos

2. **Search Queries**:
   label:"help wanted" is:open stars:>500
   label:"feature request" is:open reactions:>10
   "would be nice if" in:body is:issue
   "wish this had" in:body is:issue

3. **Data to Extract**:
   - Issue title, body
   - Reactions count (+1, heart, etc.)
   - Comments count
   - Repository name, stars
   - Labels

4. **Use GitHub API**:
   - REST API or GraphQL
   - Authenticate for higher rate limits (5000/hour)
   - Use Octokit library

### Deliverables
Add to: c:\Users\brand\DevVault\01-Projects\ideaforge\

src/scrapers/
├── github.ts          # Main scraper
└── github-api.ts      # Octokit wrapper
tests/scrapers/
└── github.test.ts

### Interface to Implement

interface GitHubIssue extends RawPost {
  source: 'github';
  repo: string;
  repoStars: number;
  reactions: number;
  labels: string[];
  state: 'open' | 'closed';
}

async function scrapeGitHub(queries: string[], hoursBack: number): Promise<GitHubIssue[]>

### Success Criteria
- Scrapes 100+ relevant issues per run
- Prioritizes popular repos
- Handles pagination
- Respects rate limits

When done, update c:\Users\brand\DevVault\01-Projects\ideaforge\Context.md
~~~

---

## Phase 2: Analysis Pipeline

---

### Agent 5: Deduplicator / Clustering

~~~text
You are building the deduplication and clustering module for IdeaForge.

## Context
IdeaForge scrapes 300+ posts daily from Reddit, HN, Twitter, GitHub. Many posts describe the same problem in different words. Your job is to cluster similar problems together.

Read this first:
- c:\Users\brand\DevVault\01-Projects\ideaforge\Feature-Plan.md (Module 2A)

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
Add to: c:\Users\brand\DevVault\01-Projects\ideaforge\

src/analysis/
├── deduplicator.ts    # Main clustering logic
├── embeddings.ts      # OpenAI embedding client
└── similarity.ts      # Cosine similarity utils
tests/analysis/
└── deduplicator.test.ts

### Interface to Implement

interface ProblemCluster {
  id: string;
  representativePost: RawPost;
  relatedPosts: RawPost[];
  frequency: number;
  totalScore: number;
  embedding: number[];
  problemStatement: string;  // AI-generated
  sources: string[];  // ['reddit', 'hn', ...]
}

async function clusterPosts(posts: RawPost[]): Promise<ProblemCluster[]>

### Success Criteria
- Reduces 300 posts to 30-50 unique problems
- Similar problems consistently grouped
- AI summaries are concise and accurate
- Processing completes in <2 minutes

When done, update c:\Users\brand\DevVault\01-Projects\ideaforge\Context.md
~~~

---

### Agent 6: Scorer

~~~text
You are building the scoring module for IdeaForge.

## Context
After deduplication, we have 30-50 unique problems. Your job is to score each problem on impact and effort to calculate priority.

Read this first:
- c:\Users\brand\DevVault\01-Projects\ideaforge\Feature-Plan.md (Module 2B)
- c:\Users\brand\DevVault\01-Projects\ideaforge\ideaforge.md (Scoring Algorithm section)

## Your Task
Score each problem cluster on:
- **Frequency**: How often mentioned (from cluster data)
- **Severity**: How painful (AI assessment)
- **Market Size**: Potential customer base (AI assessment)
- **Technical Complexity**: How hard to build (AI assessment)
- **Time to MVP**: Weekend/Week/Month/Quarter (AI assessment)

### Scoring Formula

IMPACT = frequency × severity × marketSize (each 1-10)
EFFORT = technicalComplexity × timeToMvp (each 1-10)
PRIORITY = IMPACT / EFFORT

### AI Prompt Template
Use GPT-4 to assess severity, market size, complexity:

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

### Deliverables
Add to: c:\Users\brand\DevVault\01-Projects\ideaforge\

src/analysis/
├── scorer.ts          # Main scoring logic
└── score-prompts.ts   # AI prompt templates
tests/analysis/
└── scorer.test.ts

### Interface

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

When done, update c:\Users\brand\DevVault\01-Projects\ideaforge\Context.md
~~~

---

### Agent 7: Gap Analyzer

~~~text
You are building the gap analysis module for IdeaForge.

## Context
For each scored problem, we need to find existing solutions and identify gaps in the market.

Read this first:
- c:\Users\brand\DevVault\01-Projects\ideaforge\Feature-Plan.md (Module 2C)

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
Add to: c:\Users\brand\DevVault\01-Projects\ideaforge\

src/analysis/
├── gap-analyzer.ts    # Main analysis logic
├── web-search.ts      # Search API client
└── competitor.ts      # Competitor analysis
tests/analysis/
└── gap-analyzer.test.ts

### Interface

interface GapAnalysis {
  problemId: string;
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

async function analyzeGaps(problem: ScoredProblem): Promise<GapAnalysis>

When done, update c:\Users\brand\DevVault\01-Projects\ideaforge\Context.md
~~~

---

### Agent 8: Brief Generator

~~~text
You are building the business brief generator for IdeaForge.

## Context
This is the core output of IdeaForge - the daily business briefs that users receive.

Read this first:
- c:\Users\brand\DevVault\01-Projects\ideaforge\ideaforge.md (What You Get section)
- c:\Users\brand\DevVault\01-Projects\ideaforge\Feature-Plan.md (Module 2D)

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
Add to: c:\Users\brand\DevVault\01-Projects\ideaforge\

src/generation/
├── brief-generator.ts   # Main generator
├── templates.ts         # Prompt templates
└── tech-stacks.ts       # Tech stack recommendations
tests/generation/
└── brief-generator.test.ts

### Interface

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

When done, update c:\Users\brand\DevVault\01-Projects\ideaforge\Context.md
~~~

---

## Phase 3: Delivery

---

### Agent 9: Email Delivery

~~~text
You are building the email delivery system for IdeaForge.

## Context
Every day at 8 AM, we send the daily brief email to all subscribers.

Read this first:
- c:\Users\brand\DevVault\01-Projects\ideaforge\ideaforge.md

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
Add to: c:\Users\brand\DevVault\01-Projects\ideaforge\

src/delivery/
├── email.ts              # Send logic
├── email-builder.ts      # HTML generation
└── templates/
    └── daily.html        # Email template
tests/delivery/
└── email.test.ts

When done, update c:\Users\brand\DevVault\01-Projects\ideaforge\Context.md
~~~

---

### Agent 10: Web Dashboard

~~~text
You are building the web dashboard for IdeaForge.

## Context
Pro users access the full dashboard to browse ideas, view historical briefs, and manage their account.

Read this first:
- c:\Users\brand\DevVault\01-Projects\ideaforge\Feature-Plan.md (Module 3B)

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
Create at: c:\Users\brand\DevVault\01-Projects\ideaforge-web\

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

When done, update c:\Users\brand\DevVault\01-Projects\ideaforge\Context.md
~~~

---

## Coordination Rules

1. **Before starting**: Read Context.md and claim your module
2. **During work**: Commit frequently, update Context.md with progress
3. **If blocked**: Post in Agent-Communication.md
4. **When done**: Mark complete in Context.md, list any follow-up tasks
