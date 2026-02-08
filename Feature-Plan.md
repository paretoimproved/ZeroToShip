# Feature Plan

> **Purpose**: Architecture overview, current status, and roadmap for future development.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  PIPELINE FLOW                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Scrape (Parallel)         Analyze (Parallel)    Deliver    │
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
│  06:00 UTC                 07:00 UTC            08:00 UTC   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## What's Built

### Scrapers
- **Reddit**: 8 subreddits, JSON API, rate limiting, 50+ pain point signal patterns
- **Hacker News**: Algolia API, Ask HN + Show HN comments
- **Twitter**: API v2 with Nitter fallback (5 instances, auto-rotate)
- **GitHub**: Octokit REST, issue labels, repos with >500 stars

### Analysis Pipeline
- **Deduplicator**: OpenAI embeddings, cosine similarity clustering (threshold 0.85), caching
- **Scorer**: AI-based impact/effort scoring with heuristic fallback, score caching
- **Gap Analyzer**: SerpAPI/Brave Search with AI competitor analysis, market opportunity scoring
- **Brief Generator**: Claude-powered structured business briefs (name, problem, solution, tech spec, business model, GTM, risks)

### Delivery
- **Email**: Resend API, tier-based content (free: 3 ideas, pro: 10), batch sending, HTML + plain text
- **Web Dashboard**: Next.js 15, today's ideas, archive, idea detail, settings, account management
- **REST API**: Fastify, JWT + API key auth, rate limiting, tier gating, usage tracking

### Infrastructure
- **Database**: PostgreSQL (Supabase), Drizzle ORM, migrations
- **Scheduler**: node-cron orchestrator with resume capability, phase persistence, metrics
- **Payments**: Stripe integration with webhook handling
- **Deployment**: Railway (API + scheduler), Vercel (web), Docker configs
- **Shared Types**: `@ideaforge/shared` package with Zod schemas

### Remaining Work
- [ ] Beta launch to 100 users
- [ ] Monitoring and alerting
- [ ] Automated pipeline failure notifications

---

## Future Enhancements

> Full strategic rationale in `.claude/docs/ai/ideaforge/10x/session-1.md`

### Quick Wins (Low effort, high value)

| Feature | Description |
|---------|-------------|
| **"Why This Idea" Explainer** | Show signal counts and source breakdown under each idea (e.g., "Based on 47 Reddit posts. 'I'd pay for this' appeared 8 times."). Data already exists in ProblemCluster. |
| **Source Links on Ideas** | Link each brief to the original Reddit/HN/Twitter posts that generated it. Lets founders do their own customer discovery. |
| **Share Idea as Link** | Public shareable page per idea with OG meta tags and "Get ideas like this daily" CTA. Free organic growth channel. |
| **One-Click Dismissal** | "Not for me" button on ideas. Feeds personalization, makes users feel in control. |
| **Weekly Trend Report** | Sunday email summarizing trending topics, rising/falling categories, and top signals of the week. Aggregates existing daily data. |

### Medium-Term (Moderate effort, high leverage)

| Feature | Description |
|---------|-------------|
| **Idea Portfolio & Progress Tracking** | Let users save ideas and track status: Exploring -> Validating -> Building -> Launched -> Abandoned. Creates habit formation and dramatically improves retention. |
| **Personalized Idea Ranking** | Learn preferences from user behavior (clicks, saves, dismissals) and re-rank the daily feed per user. Preferences schema already exists — this adds behavioral signals. |
| **Idea Deep-Dive on Demand** | "Go Deeper" button that runs fresh analysis: more competitor research, TAM/SAM/SOM, regulatory considerations, customer discovery scripts, refined 90-day plan. Clear pro/enterprise upsell. |
| **Idea Score History Sparkline** | Track priority scores over time and show a sparkline trend. Rising scores suggest growing pain points. |
| **Niche/Vertical Editions** | Focused editions (DevTools, Healthcare, Fintech) with specialized scrapers, scoring, and domain-specific brief sections. Architecture already supports parameterization. |

### Strategic Bets (High effort, potentially transformative)

| Feature | Description | Key Risk |
|---------|-------------|----------|
| **Founder Validation Network** | Crowdsourced "Would you build this?" voting on each idea. Aggregate signals: "312 founders viewed this, 47 would build it." Creates a data network effect moat. Unlocks enterprise data licensing and founder matching. | Cold start — needs ~1000 active users before signals are meaningful. |
| **Idea-to-Action Execution Engine** | One click from idea to personalized execution roadmap: week-by-week plan, landing page copy, customer interview scripts, pricing strategy, boilerplate repo. Collapses the gap between reading and doing. | Scope creep — must stay focused on the first 48 hours, not become a project management tool. |
| **Live Signal Feed + Custom Alerts** | Real-time pain point feed with custom filters ("alert me about CI/CD complaints with 50+ upvotes"). Slack/Discord integration, push notifications. Transforms IdeaForge from newsletter to intelligence tool. | Infrastructure cost — real-time scraping requires different architecture than daily batch. Start with 4x daily before true real-time. |
| **Competitive Intelligence Layer** | Continuous market monitoring for saved ideas. Track Product Hunt launches, GitHub repos, funding announcements. Alert: "A YC company just launched in this space." | Very high effort and ongoing API costs. Start with manual "re-analyze" triggers. |
| **Platform API + Marketplace** | Public scoring/brief-generation API. Let AI assistants, startup tools, and accelerators plug in. Revenue from usage-based API calls ($0.01-0.10/call). | Requires validated product-market fit on core product first. Risk of cannibalizing the dashboard. |
| **Community Discussion per Idea** | Lightweight comment threads on each idea for founders to discuss viability and collaborate. Drives engagement, SEO, and organic discovery. | Needs critical mass (~500+ active users) to avoid empty-room problem. |
