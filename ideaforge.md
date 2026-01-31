# IdeaForge - Daily Entrepreneurial Idea Generator

## Metadata
- **Status**: Active
- **Start Date**: 2026-01-31
- **Tech Stack**: TypeScript, Puppeteer/Playwright, OpenAI API, Node.js
- **Repository**: TBD
- **Team**: Multi-Agent (Parallel Execution)
- **Related Projects**: [[git-to-daily]]

## Overview
IdeaForge is an automated SaaS that scrapes the web daily for technical pain points, analyzes them using AI, and delivers prioritized entrepreneurial ideas with realistic business plans and clear technical specifications.

**You wake up. You check your email. IdeaForge tells you what to build today.**

## The Product

### What It Does
Every day at 8 AM, IdeaForge:
1. **Scrapes** Reddit, HN, Twitter/X, GitHub for complaints and wishlists
2. **Analyzes** using AI to cluster, score, and validate ideas
3. **Generates** business briefs with technical implementation specs
4. **Delivers** via email, web dashboard, and API

### What You Get (Daily Output)
```
═══════════════════════════════════════════════════════════
  IDEAFORGE DAILY BRIEF - January 31, 2026
═══════════════════════════════════════════════════════════

🏆 TOP IDEA: LocalCI - Run CI Pipelines Locally
   Priority Score: 9.2/10 | Effort: Weekend | Revenue: $5K/mo

   PROBLEM: Developers waste 2+ hours/day pushing commits just
   to debug CI failures. 45% cite this as their #1 frustration.

   MARKET SIZE: 28M developers worldwide use CI/CD

   EXISTING SOLUTIONS:
   ├── act (GitHub Actions) - Limited, doesn't support all features
   ├── Docker Compose - Requires manual setup
   └── GAP: No unified auto-detect + execute tool

   TECHNICAL SOLVE:
   ├── CLI tool in TypeScript
   ├── Auto-detect .github/workflows, .gitlab-ci.yml
   ├── Parse YAML, spin up Docker containers
   └── Stream output in real-time

   MONETIZATION:
   ├── Free: 3 runs/day
   ├── Pro: $9/mo unlimited
   └── Teams: $29/mo with caching

   GO-TO-MARKET:
   ├── Launch on HN "Show HN"
   ├── Post in r/devops, r/github
   └── Twitter thread on CI pain points

───────────────────────────────────────────────────────────
📊 TODAY'S TOP 10 IDEAS (ranked by impact/effort)
───────────────────────────────────────────────────────────
1. LocalCI (9.2) - Run CI locally
2. UnbloatedAPI (8.5) - Lightweight Postman
3. DocHunt (7.8) - Unified doc search
4. DebtTracker (6.9) - Tech debt visualization
5. AICodeVerify (6.2) - Validate AI code
...

[Full briefs for all 10 available in dashboard]
═══════════════════════════════════════════════════════════
```

## Monetization Model

| Tier | Price | What You Get |
|------|-------|--------------|
| **Free** | $0 | Top 3 ideas daily (problem + solution only) |
| **Pro** | $19/mo | Full daily report (10 ideas + business briefs) |
| **Enterprise** | $99/mo | API access + custom filters + historical data |
| **Validation Pack** | $49 one-time | Deep-dive on 1 idea (competitor matrix, TAM, technical spec) |

### Revenue Projections
- 1,000 free users → 5% convert → 50 Pro × $19 = **$950/mo**
- Scale to 10,000 free → 500 Pro = **$9,500/mo**
- Add 20 Enterprise = **$11,480/mo**
- Affiliate revenue (domains, hosting, no-code tools) = **+$2K/mo**

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     IDEAFORGE SYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   SCRAPER LAYER                       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │   │
│  │  │ Reddit  │ │   HN    │ │ Twitter │ │ GitHub  │    │   │
│  │  │ Scraper │ │ Scraper │ │ Scraper │ │ Scraper │    │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘    │   │
│  └───────┼───────────┼───────────┼───────────┼──────────┘   │
│          └───────────┴───────────┴───────────┘              │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  ANALYSIS PIPELINE                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │ Deduplicator│─▶│   Scorer    │─▶│ Gap Analyzer│   │   │
│  │  │ (Clustering)│  │ (AI + Rules)│  │ (Solutions) │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 GENERATION ENGINE                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │   Brief     │  │  Technical  │  │  Business   │   │   │
│  │  │  Generator  │  │    Spec     │  │    Plan     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  DELIVERY SYSTEM                      │   │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐          │   │
│  │  │  Email  │    │   Web   │    │   API   │          │   │
│  │  │ (Resend)│    │Dashboard│    │  (REST) │          │   │
│  │  └─────────┘    └─────────┘    └─────────┘          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    DATA LAYER                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │  Raw Posts  │  │   Ideas     │  │   Users     │   │   │
│  │  │  (Postgres) │  │  (Postgres) │  │  (Postgres) │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Current Sprint/Milestone
**Current Focus**: MVP Development

**Goals**:
- [ ] Build scraper modules (Reddit, HN, Twitter, GitHub)
- [ ] Build analysis pipeline (AI scoring, gap detection)
- [ ] Build report generator (daily briefs)
- [ ] Build delivery system (email first, then dashboard)
- [ ] Launch beta to 100 users

## Quick Links
- [[START-HERE]] - Agent onboarding and parallel setup
- [[Feature-Plan]] - Technical implementation plan
- [[Architecture]] - System design details
- [[Agent-Instructions]] - Copy-paste prompts for agents
- [[Decisions]] - Architecture Decision Records
- [[Context]] - Current working memory
- [[Daily/]] - Daily work logs

## Data Sources (Scraping Targets)

| Source | What to Scrape | Signal |
|--------|----------------|--------|
| **Reddit** | r/SideProject, r/startups, r/Entrepreneur, r/webdev | "I wish...", "Why isn't there...", "I'd pay for..." |
| **Hacker News** | Ask HN, Show HN comments, front page discussions | Complaints, feature requests, tool discussions |
| **Twitter/X** | #buildinpublic, #indiehacker, developer complaints | Frustration tweets, tool wishlists |
| **GitHub** | Issues with "help wanted", feature request labels | Unmet needs in existing tools |
| **Stack Overflow** | Highly voted questions without good answers | Unsolved technical problems |
| **Product Hunt** | Comments on dev tools, failed/abandoned products | Gaps in market |

## Scoring Algorithm

```
PRIORITY_SCORE = (IMPACT / EFFORT) × CONFIDENCE

Where:
  IMPACT = frequency × severity × market_size
    - frequency: How often is this mentioned? (1-10)
    - severity: How painful is the problem? (1-10)
    - market_size: How many people have this problem? (1-10)

  EFFORT = technical_complexity × time_to_mvp
    - technical_complexity: How hard to build? (1-10)
    - time_to_mvp: Weekend=1, Week=3, Month=7, Quarter=10

  CONFIDENCE = data_quality × solution_clarity
    - data_quality: How reliable is source data? (0.5-1.0)
    - solution_clarity: Is the solution obvious? (0.5-1.0)
```

## Success Metrics
- **Week 1**: Scrapers collecting 500+ posts/day
- **Week 2**: Analysis generating 10+ scored ideas/day
- **Week 3**: Email delivery to 50 beta users
- **Month 1**: 100 free users, 5 paying customers
- **Month 3**: 1,000 free users, 50 paying ($950 MRR)

## Tech Stack
- **Runtime**: Node.js + TypeScript
- **Scraping**: Puppeteer (Reddit, HN), Twitter API, GitHub API
- **AI**: OpenAI GPT-4 for analysis and generation
- **Database**: PostgreSQL (Supabase or Railway)
- **Email**: Resend or SendGrid
- **Web**: Next.js dashboard
- **Hosting**: Vercel (web) + Railway (scrapers/cron)
- **Scheduling**: Node-cron or Railway cron jobs

## Competitive Landscape
| Competitor | What They Do | Gap We Fill |
|------------|--------------|-------------|
| Exploding Topics | Trend tracking | No business plans, no technical specs |
| SparkToro | Audience research | Not focused on building products |
| Indie Hackers | Community discussions | Manual research required |
| **IdeaForge** | **Automated daily ideas + business briefs** | **Full pipeline: discovery → plan → spec** |
