# Dev.to / Hashnode

**Title:** I built a multi-agent AI pipeline that generates startup briefs from social signals every day

---

I want to walk through the architecture of something I've been building for the past few months. It's called ZeroToShip, and on the surface it's straightforward — a daily email digest of startup ideas. But under the hood, the generation layer is where things got interesting.

## The Problem

Every day, thousands of people post about problems they're having across Reddit, Hacker News, and GitHub. Those complaints are startup ideas in disguise, but they're scattered across dozens of communities and buried under noise. I wanted a system that could find the signal, group it, and produce something actionable from it — automatically, every morning.

## The Pipeline

The system runs on a cron job at 5 AM Pacific. Here's the flow:

**Scrape** — Pulls around 500 posts from 28 subreddits (via the Reddit API), Hacker News (Algolia API), and GitHub (Octokit). Each source has its own rate limits and quirks. Reddit's the most restrictive.

**Deduplicate** — Uses a Union-Find clustering algorithm over embeddings to group near-duplicate posts. This collapses related complaints into single ideas. Running at O(n^2), which is fine at current scale but something I'll need to revisit if volume grows.

**Score** — A hybrid approach. An AI-assisted scorer evaluates urgency, market signals, and solvability, combined with a heuristic layer that weighs comment engagement, upvote velocity, and keyword patterns. Scores are cached for 48 hours to avoid redundant API calls.

**Gap Analysis** — Before generating briefs, the pipeline checks if similar products already exist using SerpAPI with a Brave Search fallback. This adds competitive context to each idea and filters out problems that are already well-served.

**Generate** — This is the part I want to dig into.

## The Graph Generation Mode

I started with a simple approach: one Claude API call per brief, a big prompt with all the context, get a response, done. It worked, but the output quality was inconsistent. Some sections would be great and others would be thin or generic. And if one section failed quality checks, the whole brief had to be regenerated.

So I built a second generation mode — a multi-node state machine I'm calling the "graph" provider.

**How it works:**

Each brief flows through a pipeline of specialized nodes. Instead of one monolithic prompt asking Claude to produce everything at once, each node handles a single concern:

- **Problem Analysis** — Takes the clustered posts and engagement data, produces the problem description
- **Solution Design** — Reads the problem analysis, proposes a solution with technical approach
- **Market Analysis** — Evaluates competitors (from the gap analysis phase), TAM, user segments
- **Technical Spec** — Generates stack recommendations, MVP scope, complexity estimate
- **Go-to-Market** — Produces a launch strategy based on where the original complaints came from
- **Synthesis** — Combines all sections, checks for coherence, produces the final brief

Each node can independently retry if its output doesn't meet quality thresholds. And here's the part that keeps costs down: the pipeline uses a model cascade.

**The model cascade:**

Every node starts with Haiku (cheapest, fastest). If the output passes quality checks, great — move on. If not, it retries with Sonnet. If that still doesn't pass, it escalates to Opus. In practice, Haiku handles 90%+ of generations on the first attempt. Opus almost never fires. The whole 10-brief pipeline costs about 7 cents per run.

This matters because the alternative — running everything through Opus — would be about 10x more expensive per run, and the quality difference is marginal for most sections. The cascade gives you Opus-level quality only where it's actually needed.

**Budget controls:**

The graph mode also has per-run budget limits. If costs start creeping up (maybe an unusually complex batch of ideas requires more retries), the pipeline stops generating new briefs and delivers what it has. You can see budget diagnostics in the admin console — how much each brief cost, which nodes escalated, where retries happened.

**Trace visualization:**

Every graph run produces a Mermaid diagram showing the actual execution path — which nodes ran, which retried, which models were used at each step. This lives in the admin console and has been invaluable for debugging. When a brief comes out weird, I can look at the trace and see exactly where the pipeline made a bad decision.

## The Provider Pattern

Both generation modes — the simple legacy provider and the graph provider — sit behind the same interface. A `selectGenerationProvider()` function returns whichever provider is configured, and the orchestrator doesn't know or care which one is running. This made it trivial to A/B test the two modes and roll out graph mode gradually.

The mode is configurable via environment variable (`GENERATION_MODE=graph`), CLI flag (`--generation-mode graph`), or the admin console. In production, the scheduler deep-merges the config so the generation mode setting survives through the cron path — a bug I had to fix recently where the mode was getting silently overwritten by a shallow object spread.

## What I'd Do Differently

The Union-Find clustering works but it's a blunt instrument. I'd like to explore topic modeling or hierarchical clustering to get more nuanced idea groupings. Right now, "frustration with email clients" and "frustration with calendar apps" sometimes end up in the same cluster because people mention both in the same post.

The quality evaluation in the graph mode is prompt-based — Claude evaluates its own output. This creates an obvious bias. I've thought about using a different model for evaluation, or building a simple rubric-based classifier, but haven't gotten to it yet.

## Try It

The pipeline runs every morning. Free tier gives you the top 3 ideas. Builder tier ($19/mo) gives you all 10 with full briefs.

https://www.zerotoship.dev

If you're working on similar problems — scraping, clustering, multi-agent generation, model cascades — I'd be interested to hear how you approached it. Still learning and iterating on all of this.
