# START HERE - Building IdeaForge

> **IdeaForge**: A SaaS that scrapes the web daily for pain points and delivers prioritized business ideas with technical specs.

---

## What We're Building

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│   You wake up. Check email. Know what to build today.   │
│                                                          │
│   ┌─────────────────────────────────────────────────┐   │
│   │  🔥 TODAY'S TOP IDEA: LocalCI                    │   │
│   │     Score: 9.2 | Effort: Weekend | Rev: $5K/mo  │   │
│   │                                                  │   │
│   │  PROBLEM: Devs waste 2+ hrs/day debugging CI    │   │
│   │  SOLUTION: CLI that runs pipelines locally      │   │
│   │  TECH: TypeScript + Docker SDK                  │   │
│   │  MONETIZATION: Free tier → $9/mo Pro            │   │
│   │  LAUNCH: Show HN + r/devops                     │   │
│   └─────────────────────────────────────────────────┘   │
│                                                          │
│   + 9 more ideas ranked by impact/effort...             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## How It Works

| Time | What Happens |
|------|--------------|
| 6 AM | **Scrape** - Reddit, HN, Twitter, GitHub for pain points |
| 7 AM | **Analyze** - Cluster, score, find gaps using AI |
| 7:30 AM | **Generate** - Business briefs with tech specs |
| 8 AM | **Deliver** - Email to all subscribers |

---

## Monetization

| Tier | Price | What They Get |
|------|-------|---------------|
| Free | $0 | Top 3 ideas (problem + solution) |
| Pro | $19/mo | 10 ideas + full briefs + archive |
| Enterprise | $99/mo | API + custom filters |
| Validation | $49 | Deep-dive on 1 idea |

**Target**: 1,000 free users → 50 Pro = **$950/mo MRR**

---

## Building in Parallel

We can build multiple modules simultaneously. Here's the dependency graph:

```
PHASE 1: SCRAPERS (ALL PARALLEL)
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Reddit  │ │    HN    │ │ Twitter  │ │  GitHub  │
│  Agent 1 │ │  Agent 2 │ │  Agent 3 │ │  Agent 4 │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     └────────────┴────────────┴────────────┘
                       │
                       ▼
PHASE 2: ANALYSIS (MOSTLY PARALLEL)
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Dedup   │───▶│  Scorer  │───▶│   Gap    │───▶│  Brief   │
│ Agent 5  │    │ Agent 6  │    │ Agent 7  │    │ Agent 8  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                     │
                       ┌─────────────────────────────┘
                       ▼
PHASE 3: DELIVERY (PARALLEL)
              ┌──────────┐    ┌──────────┐
              │  Email   │    │   Web    │
              │ Agent 9  │    │ Agent 10 │
              └──────────┘    └──────────┘
```

---

## Quick Start: Launch Agents

### Option 1: Launch All Phase 1 Agents Now

Open 4 terminal windows and paste each agent prompt from [Agent-Instructions.md](Agent-Instructions.md):

```bash
# Terminal 1
claude
# Paste: Agent 1 (Reddit Scraper) prompt

# Terminal 2
claude
# Paste: Agent 2 (HN Scraper) prompt

# Terminal 3
claude
# Paste: Agent 3 (Twitter Scraper) prompt

# Terminal 4
claude
# Paste: Agent 4 (GitHub Scraper) prompt
```

### Option 2: Launch Sequentially

Start with Reddit + HN (most reliable), then add Twitter + GitHub:

```bash
# First wave
claude  # Reddit scraper
claude  # HN scraper

# Second wave (after first completes)
claude  # Twitter scraper
claude  # GitHub scraper
```

---

## Project Structure (After Building)

```
01-Projects/
├── ideaforge/            # Planning docs + codebase (this folder)
│   ├── ideaforge.md      # Product overview
│   ├── Feature-Plan.md   # Technical details
│   ├── Agent-Instructions.md
│   ├── Context.md        # Coordination state
│   ├── Daily/
│   └── src/              # Source code (built by agents)
│   ├── src/
│   │   ├── scrapers/     # Reddit, HN, Twitter, GitHub
│   │   ├── analysis/     # Dedup, Scorer, Gap, Brief
│   │   ├── delivery/     # Email
│   │   └── scheduler/    # Cron orchestration
│   ├── tests/
│   ├── package.json
│   └── README.md
│
└── ideaforge-web/        # Dashboard (Next.js)
    ├── app/
    ├── components/
    └── lib/
```

---

## Coordination Protocol

### Before Starting Work
1. Read [Context.md](Context.md) - check module status
2. Claim your module by updating the status table
3. Read [Feature-Plan.md](Feature-Plan.md) for your module's details

### During Work
1. Create code in the appropriate directory
2. Write tests alongside implementation
3. Post status updates to Context.md Agent Communication Log

### After Completing
1. Mark module "Complete" in Context.md
2. Note any blockers or follow-ups discovered
3. If Phase 1, signal that Phase 2 can start

---

## Key Documents

| Document | What It Contains |
|----------|------------------|
| [ideaforge.md](ideaforge.md) | Product vision, architecture, monetization |
| [Feature-Plan.md](Feature-Plan.md) | Technical specs for each module |
| [Agent-Instructions.md](Agent-Instructions.md) | Copy-paste prompts for agents |
| [Context.md](Context.md) | Current status, coordination |
| [Decisions.md](Decisions.md) | Architecture decision records |

---

## Success Criteria

### Week 1
- [ ] All 4 scrapers working
- [ ] Collecting 300+ posts/day

### Week 2
- [ ] Analysis pipeline complete
- [ ] Generating 10+ scored ideas/day

### Week 3
- [ ] Email delivery working
- [ ] 50 beta users signed up

### Week 4
- [ ] Dashboard live
- [ ] First paying customer

---

## Let's Build This 🚀

1. **Read**: [ideaforge.md](ideaforge.md) for full product vision
2. **Pick**: A module from [Agent-Instructions.md](Agent-Instructions.md)
3. **Launch**: Paste the agent prompt into a new Claude session
4. **Track**: Update [Context.md](Context.md) with progress
