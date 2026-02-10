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
- **Twitter**: ~~API v2 with Nitter fallback~~ — **Non-functional** (no bearer token, all Nitter instances dead since 2023). Scheduled for replacement.
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
- **Shared Types**: `@zerotoship/shared` package with Zod schemas

### Remaining Work
- [ ] Beta launch to 100 users
- [ ] Monitoring and alerting
- [ ] Automated pipeline failure notifications
- [ ] **Replace Twitter scraper with Bluesky, dev.to, and Lobste.rs** — Twitter/X API costs $100/mo and all Nitter instances are dead. Replace with three free alternatives: Bluesky (AT Protocol, `@atproto/api`, social/microblogging), dev.to (REST API, developer articles), Lobste.rs (JSON API, tech link aggregator). All three are free with no API keys required (Bluesky has optional auth for higher rate limits). Plan details in `.claude/plans/glowing-imagining-karp.md`. Files to create: `src/scrapers/bluesky.ts`, `src/scrapers/devto.ts`, `src/scrapers/lobsters.ts` + tests. Files to update: `src/scrapers/types.ts`, `src/scheduler/types.ts`, `src/scheduler/phases/scrape.ts`, `src/scheduler/orchestrator.ts`, `src/config/env.ts`.
- [ ] **Live Pipeline Logs in Admin Dashboard** — Currently scraper/analyzer logs go to stdout only (visible in Railway deploy logs, but ephemeral). Add DB-backed log capture so logs are viewable in the admin UI. Approach: new `pipeline_logs` table (runId, level, phase, message, data, timestamp) + custom Pino transport that inserts log entries alongside stdout + `GET /api/v1/admin/runs/:runId/logs` endpoint with phase/level filtering + SSE endpoint for live streaming during active runs + log viewer component (auto-scroll, level color coding, phase filter chips) wired into `/admin/runs/[runId]` and `/admin/pipeline`. Works because scheduler and API share the same Supabase Postgres instance. Estimated effort: 1-2 days. Files to create: Drizzle migration, `src/scheduler/utils/pino-db-transport.ts`, log viewer component. Files to modify: `src/api/db/schema.ts`, `src/scheduler/utils/logger.ts`, `src/api/routes/admin.ts`, `web/app/admin/runs/[runId]/page.tsx`, `web/app/admin/pipeline/page.tsx`.

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
| **Admin Pipeline Live Status** | Real-time pipeline progress in the admin console: animated phase stepper (scrape → analyze → generate → deliver) with elapsed time per phase, log stream, and error surfacing. Current status polling is minimal — replace with a clear visual timeline that shows which phase is active, completed, or failed at a glance. |

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
| **Live Signal Feed + Custom Alerts** | Real-time pain point feed with custom filters ("alert me about CI/CD complaints with 50+ upvotes"). Slack/Discord integration, push notifications. Transforms ZeroToShip from newsletter to intelligence tool. | Infrastructure cost — real-time scraping requires different architecture than daily batch. Start with 4x daily before true real-time. |
| **Competitive Intelligence Layer** | Continuous market monitoring for saved ideas. Track Product Hunt launches, GitHub repos, funding announcements. Alert: "A YC company just launched in this space." | Very high effort and ongoing API costs. Start with manual "re-analyze" triggers. |
| **Platform API + Marketplace** | Public scoring/brief-generation API. Let AI assistants, startup tools, and accelerators plug in. Revenue from usage-based API calls ($0.01-0.10/call). | Requires validated product-market fit on core product first. Risk of cannibalizing the dashboard. |
| **Community Discussion per Idea** | Lightweight comment threads on each idea for founders to discuss viability and collaborate. Drives engagement, SEO, and organic discovery. | Needs critical mass (~500+ active users) to avoid empty-room problem. |

---

## Competitive Feature Matrix

> Added: 2026-02-08 | Source: Strategic Analysis

| Feature | ZeroToShip | GummySearch (disc.) | Exploding Topics | SparkToro | Glimpse | BigIdeasDB | BuzzSumo | Brandwatch |
|---------|-----------|---------------------|-------------------|-----------|---------|------------|----------|------------|
| **Multi-source scraping** | ✅ 4 platforms | ❌ Reddit only | ⚠️ Multiple (trends) | ⚠️ Social profiles | ⚠️ Google Trends+ | ❌ Curated manually | ✅ Multiple sources | ✅ Multiple sources |
| **Reddit monitoring** | ✅ 8 subreddits + 50 signals | ✅ Full Reddit search | ⚠️ Trend detection only | ❌ | ✅ Subreddit trends | ❌ | ✅ Content monitoring | ✅ Full monitoring |
| **HN scraping** | ✅ Algolia API | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Twitter/social monitoring** | ⚠️ Broken (planned: Bluesky + dev.to + Lobste.rs) | ❌ | ✅ Trend tracking | ⚠️ Audience data only | ❌ | ❌ | ✅ Content monitoring | ✅ Full monitoring |
| **GitHub issue tracking** | ✅ 500+ star repos | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **AI clustering** | ✅ Embeddings + cosine 0.85 | ⚠️ Keyword grouping | ⚠️ Topic clustering | ⚠️ Audience clustering | ⚠️ Trend grouping | ❌ Manual curation | ⚠️ Topic clustering | ✅ AI-powered |
| **Pain point detection** | ✅ 50+ signal patterns | ✅ Keyword-based | ❌ Trend-focused | ❌ Audience-focused | ❌ Trend-focused | ⚠️ Manual selection | ❌ Content-focused | ⚠️ Sentiment only |
| **Opportunity scoring** | ✅ AI + heuristic hybrid | ⚠️ Engagement metrics | ✅ Growth score | ⚠️ Audience size | ✅ Growth prediction | ❌ | ⚠️ Engagement score | ⚠️ Sentiment score |
| **Competitor gap analysis** | ✅ SerpAPI/Brave + AI | ❌ | ❌ | ⚠️ Competitor audience | ❌ | ❌ | ⚠️ Content gap | ✅ Competitive intel |
| **Business briefs** | ✅ Claude-generated full briefs | ❌ | ❌ | ❌ | ❌ | ⚠️ Basic descriptions | ❌ | ❌ |
| **Technical specs** | ✅ Stack + architecture | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Email delivery** | ✅ Tier-based daily digest | ❌ | ✅ Weekly newsletter | ❌ | ⚠️ Alert emails | ❌ | ✅ Alert emails | ✅ Alert emails |
| **Web dashboard** | ✅ Next.js 15 | ✅ Web app | ✅ Web app | ✅ Web app | ✅ Chrome extension + web | ✅ Web app | ✅ Web app | ✅ Web app |
| **API access** | ✅ Fastify REST API | ❌ | ❌ | ✅ REST API | ❌ | ❌ | ✅ REST API | ✅ REST API |
| **Archive/history** | ✅ Full archive | ⚠️ Session-based | ✅ Trend history | ⚠️ Limited | ✅ Trend history | ❌ | ✅ Content archive | ✅ Full archive |
| **Personalization** | ✅ Preferences + behavior | ✅ Saved searches | ⚠️ Topic follows | ✅ Audience filters | ⚠️ Topic follows | ❌ | ✅ Topic alerts | ✅ Full customization |
| **Real-time alerts** | ❌ Daily batch (planned) | ❌ | ❌ | ❌ | ⚠️ Email alerts | ❌ | ✅ Instant alerts | ✅ Real-time |
| **Export** | ✅ Enterprise tier | ❌ | ✅ CSV/PDF | ⚠️ CSV | ❌ | ❌ | ✅ CSV/PDF/Excel | ✅ Full export |
| **Team features** | ❌ (planned) | ❌ | ✅ Team plans | ✅ Team plans | ❌ | ❌ | ✅ Team plans | ✅ Full team |
| **Free tier** | ✅ 3 ideas/day | ❌ Trial only | ❌ Trial only | ❌ Trial only | ❌ Trial only | ✅ Browse free | ❌ Trial only | ❌ Trial only |
| **Entry price** | $19/mo | $29/mo (was) | $39/mo | $38/mo | $99/mo | $20/mo | $199/mo | $800+/mo |
| **Enterprise price** | $99/mo | $199/mo (was) | $249/mo | $112/mo | $99+/mo | N/A | $999/mo | Custom |

**Key takeaways**:
- ZeroToShip is the **only tool** combining multi-source scraping + AI pain point detection + business brief generation
- HN scraping and GitHub issue tracking are **unique differentiators** no competitor offers
- Biggest gaps vs competitors: real-time alerts, team features, and keyword monitoring (saved searches)
- ZeroToShip has the most generous free tier in the market
- Entry price ($19/mo) is the lowest among serious competitors

---

## Market-Driven Feature Requirements

> Added: 2026-02-08 | Source: Competitive Gap Analysis
> Note: These are NEW features not already in the roadmap above.

| # | Feature | Description | Competitive Justification | Effort | Priority | Tier |
|---|---------|-------------|--------------------------|--------|----------|------|
| 1 | **Keyword Monitoring & Saved Searches** | Users define custom keyword sets (e.g., "CI/CD complaints", "database migration pain") and receive alerts when new posts match across all sources. Persistent saved searches with notification preferences. | GummySearch's core feature used by 135K+ users. Direct replacement value for GummySearch refugees. Syften ($19-99) and F5Bot (free) compete here. | Medium (2-3 weeks) | **P0 -- Critical** | Pro (basic), Enterprise (unlimited) |
| 2 | **Subreddit Analytics Dashboard** | Visual analytics showing which subreddits generate the most pain point signals, trending topics per subreddit, posting activity heatmaps, and sentiment trends over time. | GummySearch's most-used feature. Provides transparency into signal sources. No other idea-discovery tool offers this granularity. | Medium (2 weeks) | **P1 -- High** | Pro |
| 3 | **Mobile PWA** | Responsive Progressive Web App with offline support, push notifications for new ideas, and mobile-optimized idea cards. Add-to-homescreen capability. | BuzzSumo and Brandwatch have mobile apps. Founders check ideas on the go -- mobile access increases daily engagement by 40-60% based on industry benchmarks. | Medium (2-3 weeks) | **P1 -- High** | All tiers |
| 4 | **Slack/Discord Bot** | Deliver daily idea digests and real-time alerts directly to team Slack channels or Discord servers. Configurable: choose which ideas, frequency, and format. | Enterprise differentiator. Syften and F5Bot offer similar integrations. Slack integration is table stakes for B2B SaaS at $99+/mo price point. | Low-Medium (1-2 weeks) | **P1 -- High** | Enterprise |
| 5 | **Browser Extension** | Chrome/Firefox extension that overlays ZeroToShip analysis on Reddit, HN, and Twitter posts. See pain point scores, related ideas, and signal counts while browsing. | Glimpse built its entire product around a Chrome extension. Provides "aha moment" during natural browsing behavior. Drives habit formation. | Medium (3-4 weeks) | **P2 -- Medium** | Pro |
| 6 | **Landing Page Auto-Generator** | From any idea brief, generate a complete landing page (HTML/CSS/JS) with value prop, features, pricing placeholder, and email capture form. One-click deploy to Vercel/Netlify. | No competitor offers this. Bridges the gap between idea and validation. Ties into Execution Engine concept but is standalone and immediately useful. | Medium (2-3 weeks) | **P2 -- Medium** | Pro (1/mo), Enterprise (unlimited) |
| 7 | **Customer Interview Script Generator** | AI-generated interview scripts with 10-15 questions tailored to the specific pain point, target customer persona, and validation goals. Includes scoring rubric for responses. | No competitor offers this. Reduces time-to-validation from days to minutes. Natural extension of brief generation using existing Claude pipeline. | Low (1 week) | **P2 -- Medium** | Pro |
| 8 | **Regulatory/Compliance Checker** | For each idea, automatically flag potential regulatory concerns: GDPR, HIPAA, PCI-DSS, fintech regulations, FDA requirements. Includes jurisdiction-specific notes and compliance cost estimates. | Valuable for healthcare/fintech verticals. No competitor offers this. Reduces founder risk by surfacing regulatory blockers early. Enables Niche/Vertical Editions. | Medium (2-3 weeks) | **P2 -- Medium** | Enterprise |
| 9 | **Market Timing Indicator** | "Is now the right time?" composite signal based on Google Trends velocity, related VC funding activity, competitive density (new entrants per quarter), and technology maturity (Gartner-style). | No competitor offers timing analysis. Addresses the #1 founder question: "Why now?" Differentiates from static idea lists. | Medium-High (3-4 weeks) | **P2 -- Medium** | Pro (basic), Enterprise (detailed) |
| 10 | **Idea Comparison Tool** | Side-by-side comparison of 2-3 ideas across all scoring dimensions: market size, competition, technical difficulty, time-to-MVP, regulatory risk, and trend direction. Visual radar charts. | Decision-making aid for founders evaluating multiple opportunities. No competitor offers structured comparison. Low effort, high perceived value. | Low (1 week) | **P1 -- High** | Pro |
| 11 | **Founder Skill Matching** | Users declare their tech stack, domain expertise, and available resources. Each idea gets a "fit score" (0-100%) showing alignment. "This idea is a 90% match for your React + Python stack." | Personalization beyond preferences. No competitor offers skill-based matching. Increases conversion by showing personally relevant opportunities. | Low-Medium (1-2 weeks) | **P2 -- Medium** | Free (basic), Pro (detailed) |
| 12 | **White-Label Reports** | Enterprise customers can brand ZeroToShip reports with their logo, colors, and custom domain. Redistribute reports to their own clients (accelerators, VCs, consultancies). | Brandwatch offers white-labeling at $800+/mo. High-margin feature for Enterprise tier. Enables channel partnerships with accelerators and VCs. | Medium (2-3 weeks) | **P3 -- Low** | Enterprise (add-on) |

### Implementation Priority Order

**Phase 1 -- GummySearch Capture (Weeks 1-4)**:
1. Keyword Monitoring & Saved Searches (P0)
2. Idea Comparison Tool (P1, low effort)
3. Subreddit Analytics Dashboard (P1)

**Phase 2 -- Engagement & Retention (Weeks 5-8)**:
4. Slack/Discord Bot (P1)
5. Mobile PWA (P1)
6. Founder Skill Matching (P2)

**Phase 3 -- Differentiation (Weeks 9-16)**:
7. Customer Interview Script Generator (P2)
8. Browser Extension (P2)
9. Landing Page Auto-Generator (P2)
10. Market Timing Indicator (P2)

**Phase 4 -- Enterprise Expansion (Weeks 17+)**:
11. Regulatory/Compliance Checker (P2)
12. White-Label Reports (P3)

---

## Pricing-Driven Feature Priorities

> Added: 2026-02-08 | Source: Competitor Pricing Analysis

### Free Tier ($0) -- Demonstrate Value, Drive Conversion

**Goal**: Show enough value that users *need* more. Current 3 ideas/day is correct -- satisfies curiosity without satisfying the need.

- 3 ideas/day with problem statement + solution summary (current)
- Basic category/vertical preferences (current)
- Weekly Trend Report email (planned quick win)
- "Blurred/locked" full briefs visible but unreadable -- creates desire for Pro
- Basic Founder Skill Matching (new) -- shows fit score, locks detailed breakdown
- Idea Comparison Tool limited to 1 comparison/week (new)

**Conversion levers**: Blurred content, "Unlock full brief" CTA, comparison limits, weekly email with "You missed 7 Pro-only ideas this week"

### Pro Tier ($19/mo) -- Core Value, Below Competitor Pricing

**Goal**: Justify $19/mo vs free AND outperform competitors charging $29-99/mo. At $19/mo, ZeroToShip delivers more actionable output than GummySearch did at $29/mo or Exploding Topics at $39/mo.

**Current features**: 10 ideas/day, full briefs, archive access, priority email delivery

**Should add (from existing roadmap)**:
- Source Links on Ideas -- GummySearch users expect raw post access
- "Why This Idea" Explainer -- signal transparency builds trust
- Idea Portfolio & Progress Tracking -- habit formation and retention
- Personalized Idea Ranking -- behavioral learning for better relevance
- Idea Score History Sparkline -- trend visibility

**Should add (new features)**:
- Keyword Monitoring: 5 saved searches with daily digest alerts
- Subreddit Analytics Dashboard: read-only analytics view
- Idea Comparison Tool: unlimited comparisons
- Customer Interview Script Generator: 3 scripts/month
- Founder Skill Matching: detailed breakdown + recommendations
- Landing Page Auto-Generator: 1 page/month
- Browser Extension: full access
- Mobile PWA: full access with push notifications

**Competitive justification**: At $19/mo with these features, ZeroToShip offers:
- 10x more actionable output than Exploding Topics ($39/mo)
- Full Reddit + HN + Twitter + GitHub vs Reddit-only (GummySearch was $29/mo)
- AI-generated briefs with tech specs (no competitor at any price)
- Below the $20 ChatGPT psychological anchor

### Enterprise Tier ($99/mo --> recommend $149/mo)

**Goal**: Justify vs Glimpse ($99), SparkToro ($112), Exploding Topics ($249). Current $99 is underpriced for the feature set.

**Current features**: Unlimited ideas, API access, custom filters, export, validation add-on

**Should add (new features)**:
- Keyword Monitoring: unlimited saved searches with real-time alerts
- Slack/Discord Bot: full integration with configurable channels
- Team Workspaces: shared idea boards, team comments, role-based access
- White-Label Reports: custom branding for redistribution
- Subreddit Analytics Dashboard: full analytics with export
- Regulatory/Compliance Checker: automated regulatory flagging
- Market Timing Indicator: detailed timing analysis with data sources
- Priority Support SLA: 4-hour response time, dedicated Slack channel
- Landing Page Auto-Generator: unlimited pages
- Customer Interview Script Generator: unlimited scripts

**Price increase rationale**: Market data shows $112-249 range for comparable tools. At $149/mo, ZeroToShip is still 42% below Exploding Topics and offers unique features (briefs, GitHub tracking, multi-source pain point detection) no competitor matches.

### Feature Unlock Matrix by Tier

| Feature | Free ($0) | Pro ($19/mo) | Enterprise ($149/mo) |
|---------|-----------|--------------|----------------------|
| Daily ideas | 3 | 10 | Unlimited |
| Idea summaries | ✅ | ✅ | ✅ |
| Full business briefs | ❌ (blurred preview) | ✅ | ✅ |
| Source links | ❌ | ✅ | ✅ |
| "Why This Idea" explainer | ❌ | ✅ | ✅ |
| Archive access | ❌ | ✅ | ✅ |
| Idea portfolio tracking | ❌ | ✅ | ✅ |
| Personalized ranking | ❌ | ✅ | ✅ |
| Score sparklines | ❌ | ✅ | ✅ |
| Keyword monitoring | ❌ | 5 searches | Unlimited |
| Saved search alerts | ❌ | Daily digest | Real-time |
| Subreddit analytics | ❌ | Read-only | Full + export |
| Idea comparison | 1/week | Unlimited | Unlimited |
| Founder skill matching | Basic score | Detailed breakdown | Detailed + team |
| Interview script generator | ❌ | 3/month | Unlimited |
| Landing page generator | ❌ | 1/month | Unlimited |
| Browser extension | ❌ | ✅ | ✅ |
| Mobile PWA | ✅ (limited) | ✅ (full) | ✅ (full) |
| Weekly trend report | ✅ | ✅ | ✅ |
| Slack/Discord bot | ❌ | ❌ | ✅ |
| API access | ❌ | ❌ | ✅ |
| Export (CSV/PDF) | ❌ | ❌ | ✅ |
| Team workspaces | ❌ | ❌ | ✅ |
| White-label reports | ❌ | ❌ | ✅ (add-on) |
| Regulatory checker | ❌ | ❌ | ✅ |
| Market timing indicator | ❌ | Basic | Detailed |
| Deep-dive on demand | ❌ | 3/month | Unlimited |
| Validation add-on | ❌ | $49/idea | $79/idea |
| Priority support | Community | Email (48hr) | Dedicated (4hr SLA) |
| Custom vertical editions | ❌ | ❌ | ✅ |

---

## Risk-Adjusted Priority Updates

> Added: 2026-02-08 | Source: Competitive Findings

### 1. GummySearch Shutdown Impact -- URGENT

GummySearch's discontinuation leaves 135K+ users without their primary Reddit research tool. This is the single largest near-term opportunity.

**Immediate actions**:
- **Keyword Monitoring & Saved Searches**: Elevate from "not planned" to **Q1 Priority #1**. This is what GummySearch users are actively searching for replacements for. Without it, ZeroToShip misses the migration window.
- **Subreddit Analytics Dashboard**: Elevate to **Q1 Priority #3**. GummySearch's most visual feature -- users expect this.
- **"Share Idea as Link"** (existing Quick Win): Becomes **more urgent**. Public shareable pages capture organic search traffic from "GummySearch alternative" queries.
- **"Source Links on Ideas"** (existing Quick Win): Becomes **more urgent**. GummySearch users expect to see and click through to raw Reddit posts. Without source links, the product feels like a black box.

**Marketing implication**: Create "ZeroToShip vs GummySearch" comparison page, target "GummySearch alternative" SEO keywords, and post in communities where GummySearch users congregate. Expected capture: 500-1,000 users from this channel alone.

### 2. Emerging Competitor Defense

**Redreach** ($19/mo) and **PainOnSocial** are directly competing in the pain-point-from-social-media space. Both are Reddit-only, early-stage, and lack AI brief generation.

**Defensive differentiation**:
- **Multi-source advantage**: Neither competitor scrapes HN, Twitter, or GitHub. Emphasize "4 platforms, not just Reddit" in all positioning.
- **Full briefs**: Neither generates business briefs with tech specs, GTM strategy, or risk analysis. This is the moat.
- **Email delivery**: Both require users to check a dashboard. ZeroToShip delivers to inbox. Convenience wins.
- **Free tier**: Neither offers a meaningful free tier. ZeroToShip's 3 ideas/day creates a funnel competitors can't match.

**Action**: Accelerate Keyword Monitoring (matches Redreach's feature set) and maintain brief quality (where ZeroToShip is unmatched).

### 3. Enterprise Tier Underpricing

**Current**: $99/mo. **Market range**: $99-249/mo for comparable tools.

| Competitor | Price | Comparable Features |
|-----------|-------|-------------------|
| Glimpse | $99/mo | Trend data only, no briefs, no multi-source |
| SparkToro | $112/mo | Audience research only, no pain point detection |
| Exploding Topics | $249/mo | Trend detection only, no briefs, no Reddit depth |
| BuzzSumo | $199-999/mo | Content monitoring, no idea generation |

**Recommendation**: Increase Enterprise to **$149/mo** after adding:
1. Slack/Discord integration (1-2 weeks effort)
2. Keyword Monitoring with unlimited searches (part of P0 feature)
3. Team Workspaces (basic version, 2-3 weeks effort)

**Timing**: Implement price increase at Month 3-4, after the features ship and before the GummySearch migration window closes. Early Enterprise adopters get grandfathered at $99/mo.

### 4. Quick Wins Re-Ranking (Updated Priority Order)

Original order was based on effort/value. Updated based on competitive urgency:

| Rank | Feature | Original Priority | Updated Priority | Reason |
|------|---------|-------------------|------------------|--------|
| 1 | Source Links on Ideas | Quick Win | **Urgent Quick Win** | GummySearch users expect raw post access; without it, product feels opaque |
| 2 | Share Idea as Link | Quick Win | **Urgent Quick Win** | Organic growth channel to capture GummySearch refugees via SEO |
| 3 | "Why This Idea" Explainer | Quick Win | Quick Win (unchanged) | Transparency builds trust but not competitively urgent |
| 4 | One-Click Dismissal | Quick Win | Quick Win (unchanged) | Retention feature, not acquisition |
| 5 | Weekly Trend Report | Quick Win | Quick Win (unchanged) | Engagement feature, already planned |

### 5. Strategic Bet Timing Adjustments

| Strategic Bet | Original Timing | Updated Timing | Rationale |
|---------------|----------------|----------------|-----------|
| **Founder Validation Network** | Medium priority | **Deprioritized** | Known demand from GummySearch users (keyword monitoring) > speculative network effect. Requires 1,000+ users that don't exist yet. Revisit at 2,000+ active users. |
| **Live Signal Feed + Custom Alerts** | Future | **Accelerated to Q2** | Aligns with Syften ($19-99) and F5Bot (free) competition. Keyword Monitoring (Q1) is the first step; Live Signal Feed extends it to near-real-time. Start with 4x daily polling before true real-time. |
| **Competitive Intelligence Layer** | Future | **Unchanged** | Still very high effort. Keyword Monitoring + Gap Analyzer cover 70% of the value. Revisit after core product is validated. |
| **Platform API + Marketplace** | Future | **Unchanged** | Requires PMF validation first. Current API (Enterprise tier) is sufficient. |
| **Idea-to-Action Execution Engine** | Medium priority | **Partially accelerated** | Landing Page Auto-Generator and Customer Interview Script Generator (new features) deliver standalone value without the full engine. Ship those first as stepping stones. |
| **Community Discussion per Idea** | Future | **Unchanged** | Empty-room problem persists. Revisit at 500+ active users. |

### Summary: Updated Priority Stack

**Q1 (Weeks 1-6) -- Capture & Convert**:
1. Keyword Monitoring & Saved Searches (NEW, P0)
2. Source Links on Ideas (existing, elevated)
3. Share Idea as Link (existing, elevated)
4. Idea Comparison Tool (NEW, P1, low effort)
5. Subreddit Analytics Dashboard (NEW, P1)

**Q2 (Weeks 7-14) -- Retain & Grow**:
6. "Why This Idea" Explainer (existing)
7. Slack/Discord Bot (NEW, P1)
8. Mobile PWA (NEW, P1)
9. Idea Portfolio & Progress Tracking (existing)
10. One-Click Dismissal (existing)

**Q3 (Weeks 15-22) -- Differentiate & Monetize**:
11. Enterprise price increase to $149/mo
12. Founder Skill Matching (NEW)
13. Customer Interview Script Generator (NEW)
14. Browser Extension (NEW)
15. Landing Page Auto-Generator (NEW)

**Q4 (Weeks 23+) -- Scale & Expand**:
16. Live Signal Feed + Custom Alerts (existing, accelerated)
17. Market Timing Indicator (NEW)
18. Regulatory/Compliance Checker (NEW)
19. White-Label Reports (NEW)
20. Niche/Vertical Editions (existing)
