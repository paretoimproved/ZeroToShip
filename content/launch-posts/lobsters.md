# Lobsters

**Title:** ZeroToShip: Daily startup ideas from Reddit/HN/GitHub pain points (multi-agent AI pipeline)

**Tags:** show, ai, web

---

I've been building a daily pipeline that scrapes Reddit (28 subreddits), Hacker News, and GitHub for pain points, clusters them with embedding-based deduplication, and generates startup idea briefs using a multi-node Claude pipeline with a model cascade (Haiku -> Sonnet -> Opus, escalating only on quality failures).

The generation layer is the interesting part technically. Each brief goes through specialized nodes — problem analysis, solution design, market analysis, tech spec, go-to-market — and a synthesis step. Each node starts on the cheapest model and only escalates if quality thresholds aren't met. Keeps per-run costs to about $0.07 while getting Opus-level output where it matters.

Stack is TypeScript throughout: Fastify API, Next.js 15 frontend, Drizzle ORM with Supabase PostgreSQL, Railway for hosting. Two generation modes behind a common provider interface — a single-call legacy mode and the multi-agent graph mode.

Free tier available (top 3 ideas daily). Happy to discuss the architecture if anyone's working on similar agent pipelines.

https://www.zerotoship.dev
