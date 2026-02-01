# Feature Plan - Technical Implementation

> **Purpose**: Detailed technical breakdown of each module with clear tasks for parallel agent development.

---

## Module Overview

```
┌─────────────────────────────────────────────────────────────┐
│  MODULE DEPENDENCY GRAPH                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Phase 1 (Parallel)        Phase 2 (Parallel)    Phase 3    │
│  ┌─────────────────┐       ┌──────────────┐     ┌────────┐ │
│  │ Reddit Scraper  │──┐    │  Deduplicator│──┐  │ Email  │ │
│  ├─────────────────┤  │    ├──────────────┤  │  │Delivery│ │
│  │ HN Scraper      │──┼───▶│  Scorer      │──┼─▶├────────┤ │
│  ├─────────────────┤  │    ├──────────────┤  │  │  Web   │ │
│  │ Twitter Scraper │──┤    │ Gap Analyzer │──┤  │Dashboard│ │
│  ├─────────────────┤  │    ├──────────────┤  │  ├────────┤ │
│  │ GitHub Scraper  │──┘    │Brief Generator│──┘  │  API   │ │
│  └─────────────────┘       └──────────────┘     └────────┘ │
│                                                              │
│  [Can build in parallel]   [Can build in parallel]          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Scraper Layer

### Module 1A: Reddit Scraper
**Owner**: Agent 1
**Effort**: 1-2 days

**Functionality**:
- Scrape posts from target subreddits
- Extract: title, body, upvotes, comments, timestamp, URL
- Filter for pain point signals ("I wish", "frustrated", "why isn't there")
- Handle rate limiting and pagination
- Store raw posts in database

**Target Subreddits**:
```
r/SideProject
r/startups
r/Entrepreneur
r/webdev
r/programming
r/devops
r/selfhosted
r/software
```

**Schema**:
```typescript
interface RawPost {
  id: string;
  source: 'reddit' | 'hn' | 'twitter' | 'github';
  sourceId: string;
  title: string;
  body: string;
  url: string;
  author: string;
  score: number;  // upvotes
  commentCount: number;
  createdAt: Date;
  scrapedAt: Date;
  subreddit?: string;
  signals: string[];  // detected pain point phrases
}
```

**Files**:
```
src/scrapers/reddit.ts
src/scrapers/types.ts
tests/scrapers/reddit.test.ts
```

---

### Module 1B: Hacker News Scraper
**Owner**: Agent 2
**Effort**: 1-2 days

**Functionality**:
- Use HN Algolia API (official, no rate limits)
- Scrape "Ask HN" posts
- Scrape comments on Show HN posts
- Extract complaints and feature requests
- Filter for pain point signals

**Target Queries**:
```
"Ask HN" + recent
"wish there was"
"frustrated with"
"looking for a tool"
"why doesn't" + tool/app/service
```

**API Endpoint**:
```
https://hn.algolia.com/api/v1/search?query=...&tags=ask_hn
```

**Files**:
```
src/scrapers/hackernews.ts
tests/scrapers/hackernews.test.ts
```

---

### Module 1C: Twitter/X Scraper
**Owner**: Agent 3
**Effort**: 2-3 days

**Functionality**:
- Use Twitter API v2 (requires developer account)
- Search for hashtags: #buildinpublic, #indiehacker
- Search for complaint patterns
- Extract: tweet text, likes, retweets, author followers
- Handle API rate limits (450 requests/15 min)

**Target Searches**:
```
"wish there was an app" -filter:retweets
"frustrated with" developer OR coding
"I'd pay for" tool OR app OR service
#buildinpublic "struggling with"
```

**Fallback**: If API access is limited, use Nitter or RSS feeds

**Files**:
```
src/scrapers/twitter.ts
tests/scrapers/twitter.test.ts
```

---

### Module 1D: GitHub Scraper
**Owner**: Agent 4
**Effort**: 1-2 days

**Functionality**:
- Use GitHub API (authenticated for higher rate limits)
- Search issues with labels: "help wanted", "feature request", "enhancement"
- Focus on popular repos (>1000 stars)
- Extract: issue title, body, reactions, comments
- Identify unmet needs and feature gaps

**Target Queries**:
```
label:"help wanted" is:open stars:>1000
label:"feature request" is:open comments:>10
"would be nice if" in:body is:issue
```

**Files**:
```
src/scrapers/github.ts
tests/scrapers/github.test.ts
```

---

## Phase 2: Analysis Pipeline

### Module 2A: Deduplicator / Clustering
**Owner**: Agent 5
**Effort**: 2-3 days

**Functionality**:
- Take all raw posts from Phase 1
- Generate embeddings using OpenAI text-embedding-3-small
- Cluster similar posts using cosine similarity
- Merge duplicates, keep highest-scored version
- Output: clustered problem statements

**Algorithm**:
```
1. Generate embedding for each post (title + body)
2. Compute pairwise cosine similarity
3. If similarity > 0.85, cluster together
4. For each cluster, select representative post
5. Aggregate metrics (total upvotes, frequency)
```

**Schema**:
```typescript
interface ProblemCluster {
  id: string;
  representativePost: RawPost;
  relatedPosts: RawPost[];
  frequency: number;  // how many similar posts
  totalScore: number;  // sum of upvotes
  embedding: number[];
  problemStatement: string;  // AI-generated summary
}
```

**Files**:
```
src/analysis/deduplicator.ts
src/analysis/embeddings.ts
tests/analysis/deduplicator.test.ts
```

---

### Module 2B: Scorer
**Owner**: Agent 6
**Effort**: 2-3 days

**Functionality**:
- Score each problem cluster on multiple dimensions
- Use AI + heuristics for scoring
- Output: ranked list of problems

**Scoring Dimensions**:
```typescript
interface ProblemScore {
  frequency: number;      // 1-10: how often mentioned
  severity: number;       // 1-10: how painful (AI assessment)
  marketSize: number;     // 1-10: potential customer base
  technicalComplexity: number;  // 1-10: how hard to build
  timeToMvp: number;      // 1-10: 1=weekend, 10=quarter
  solutionClarity: number; // 1-10: is solution obvious?

  impactScore: number;    // frequency × severity × marketSize
  effortScore: number;    // technicalComplexity × timeToMvp
  priorityScore: number;  // impactScore / effortScore
}
```

**AI Prompt for Severity Assessment**:
```
Analyze this problem statement and rate its severity (1-10):

Problem: "{problemStatement}"
Context: Found {frequency} times across {sources}

Consider:
- How much time/money does this cost users?
- How emotionally frustrating is this?
- Is this a daily annoyance or occasional inconvenience?

Respond with JSON: { "severity": N, "reasoning": "..." }
```

**Files**:
```
src/analysis/scorer.ts
tests/analysis/scorer.test.ts
```

---

### Module 2C: Gap Analyzer
**Owner**: Agent 7
**Effort**: 2-3 days

**Functionality**:
- For each problem, search for existing solutions
- Use web search API (SerpAPI or Brave Search)
- Identify gaps in existing solutions
- Determine if market opportunity exists

**Process**:
```
1. Generate search queries from problem statement
2. Fetch top 10 results for each query
3. Analyze results with AI to identify:
   - Direct competitors
   - Partial solutions
   - Gaps and weaknesses
4. Output competitive analysis
```

**Schema**:
```typescript
interface GapAnalysis {
  problemId: string;
  existingSolutions: Solution[];
  gaps: string[];  // unmet needs
  marketOpportunity: 'high' | 'medium' | 'low';
  competitorWeaknesses: string[];
  differentiationAngles: string[];
}

interface Solution {
  name: string;
  url: string;
  description: string;
  pricing: string;
  weaknesses: string[];
}
```

**Files**:
```
src/analysis/gap-analyzer.ts
tests/analysis/gap-analyzer.test.ts
```

---

### Module 2D: Brief Generator
**Owner**: Agent 8
**Effort**: 2-3 days

**Functionality**:
- Take scored + analyzed problems
- Generate full business briefs using AI
- Include technical implementation specs
- Output ready-to-use business plans

**Brief Template**:
```markdown
# {Idea Name}

## Problem Statement
{AI-generated summary of the pain point}

## Target Audience
{Who experiences this problem, estimated size}

## Existing Solutions
{Competitors and their weaknesses}

## Proposed Solution
{What to build, key features}

## Technical Specification
- Tech Stack: {recommendations}
- Architecture: {high-level design}
- MVP Scope: {minimum features}
- Estimated Effort: {weekend/week/month}

## Business Model
- Pricing: {suggested tiers}
- Revenue Potential: {projections}
- Go-to-Market: {launch strategy}

## Risks & Mitigations
{Potential challenges and how to address them}
```

**Files**:
```
src/generation/brief-generator.ts
src/generation/templates.ts
tests/generation/brief-generator.test.ts
```

---

## Phase 3: Delivery System

### Module 3A: Email Delivery
**Owner**: Agent 9
**Effort**: 1-2 days

**Functionality**:
- Generate HTML email from daily briefs
- Send via Resend or SendGrid
- Handle subscriber management
- Track open/click rates

**Email Structure**:
```
Subject: 🔥 Today's Top Startup Idea: {#1 Idea Name}

[Hero: Top idea with score]
[Quick list: Ideas 2-10]
[CTA: Upgrade for full briefs]
[Footer: Unsubscribe]
```

**Files**:
```
src/delivery/email.ts
src/delivery/templates/daily-email.html
tests/delivery/email.test.ts
```

---

### Module 3B: Web Dashboard
**Owner**: Agent 10
**Effort**: 3-5 days

**Functionality**:
- Next.js app with authentication
- Display daily ideas with full briefs
- Historical archive of past ideas
- Filter by category, score, effort
- User preferences (categories, notifications)

**Pages**:
```
/               - Today's ideas
/archive        - Historical ideas
/idea/[id]      - Full brief view
/settings       - User preferences
/account        - Subscription management
```

**Files**:
```
web/
├── app/
│   ├── page.tsx
│   ├── archive/page.tsx
│   ├── idea/[id]/page.tsx
│   └── settings/page.tsx
├── components/
│   ├── IdeaCard.tsx
│   ├── BriefView.tsx
│   └── ScoreDisplay.tsx
└── lib/
    └── api.ts
```

---

### Module 3C: REST API
**Owner**: Agent 11
**Effort**: 2-3 days

**Functionality**:
- RESTful API for programmatic access
- API key authentication
- Rate limiting
- Endpoints for ideas, briefs, search

**Endpoints**:
```
GET  /api/v1/ideas/today       - Today's ranked ideas
GET  /api/v1/ideas/:id         - Single idea with brief
GET  /api/v1/ideas/search      - Search historical ideas
POST /api/v1/validate          - Deep validation request
GET  /api/v1/account           - API usage stats
```

**Files**:
```
src/api/routes/ideas.ts
src/api/routes/validate.ts
src/api/middleware/auth.ts
src/api/middleware/rateLimit.ts
tests/api/ideas.test.ts
```

---

## Phase 4: Infrastructure

### Module 4A: Database Schema
**Owner**: Any Agent (foundational)
**Effort**: 1 day

**Tables**:
```sql
-- Raw scraped posts
CREATE TABLE raw_posts (
  id UUID PRIMARY KEY,
  source VARCHAR(20),
  source_id VARCHAR(255),
  title TEXT,
  body TEXT,
  url TEXT,
  author VARCHAR(255),
  score INTEGER,
  comment_count INTEGER,
  created_at TIMESTAMP,
  scraped_at TIMESTAMP,
  metadata JSONB
);

-- Clustered problems
CREATE TABLE problems (
  id UUID PRIMARY KEY,
  statement TEXT,
  frequency INTEGER,
  total_score INTEGER,
  embedding VECTOR(1536),
  created_at TIMESTAMP
);

-- Generated ideas
CREATE TABLE ideas (
  id UUID PRIMARY KEY,
  problem_id UUID REFERENCES problems(id),
  name VARCHAR(255),
  brief TEXT,
  technical_spec TEXT,
  business_plan TEXT,
  impact_score DECIMAL,
  effort_score DECIMAL,
  priority_score DECIMAL,
  generated_at TIMESTAMP
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  tier VARCHAR(20) DEFAULT 'free',
  api_key VARCHAR(64),
  created_at TIMESTAMP
);
```

---

### Module 4B: Scheduler / Orchestrator
**Owner**: Agent 12
**Effort**: 1-2 days

**Functionality**:
- Cron job to run daily pipeline
- Orchestrate scraper → analysis → generation → delivery
- Handle failures and retries
- Logging and monitoring

**Schedule**:
```
06:00 - Run all scrapers
07:00 - Run analysis pipeline
07:30 - Generate briefs
08:00 - Send emails
```

**Files**:
```
src/scheduler/cron.ts
src/scheduler/orchestrator.ts
src/scheduler/logger.ts
```

---

## Development Phases

### Sprint 1: Foundation (Week 1) ✅ COMPLETE
- [x] Database schema setup
- [x] Reddit scraper
- [x] HN scraper
- [x] Basic deduplicator

### Sprint 2: Core Pipeline (Week 2) ✅ COMPLETE
- [x] Twitter scraper
- [x] GitHub scraper
- [x] Scorer module
- [x] Gap analyzer

### Sprint 3: Generation (Week 3) ✅ COMPLETE
- [x] Brief generator
- [x] Email delivery
- [x] Basic dashboard

### Sprint 4: Infrastructure (Week 4) 🔜 IN PROGRESS
- [ ] REST API endpoints (Agent 11)
- [ ] Scheduler/Orchestrator (Agent 12)
- [ ] Database migrations
- [ ] Deployment setup

### Sprint 5: Polish & Launch
- [ ] Payment integration (Stripe)
- [ ] Beta launch to 100 users
- [ ] Monitoring & alerting
