# Indie Hackers Post

## Title
I built a tool that finds startup ideas from Reddit/HN and scores them by opportunity

---

## Body

Hey IH!

I've been lurking here for years, always looking for that next idea to build. The problem? I'd spend hours on Reddit and HN, then forget what I found, or never validate if it was worth building.

Sound familiar?

So I built **IdeaForge**—a tool that does the research for you and delivers scored startup ideas to your inbox every morning.

### How it works

Every day at 6 AM, IdeaForge:

1. **Scrapes 300+ posts** from Reddit, HN, Twitter, and GitHub
2. **Detects pain point signals** like "I wish there was..." or "Why doesn't X exist?"
3. **Clusters similar problems** using AI embeddings
4. **Scores each problem** by opportunity vs effort
5. **Generates full briefs** with tech specs, competitors, and go-to-market

By 8 AM, you have 10 ideas in your inbox with everything you need to decide what to build.

### What's in a brief?

- Problem statement and target audience
- Existing solutions and their gaps
- Technical spec (stack, architecture, MVP scope)
- Business model and pricing strategy
- Launch channels and first customer strategy
- Risk assessment

### The scoring formula

```
PRIORITY = IMPACT / EFFORT

IMPACT = frequency × severity × market_size
EFFORT = complexity × time_to_mvp
```

Ideas that are painful, common, and quick to build bubble to the top.

### Pricing

- **Free**: 3 ideas/day (problem + solution only)
- **Pro ($19/mo)**: 10 full briefs/day
- **Enterprise ($99/mo)**: Unlimited + API

### Why I built this

I kept seeing the same pattern:

1. Browse Reddit/HN for hours
2. Find interesting problems
3. Forget to save them
4. See someone else build it 6 months later
5. "I should have built that"

IdeaForge captures those problems automatically, scores them, and packages them so you can actually act on them.

### Tech stack

- TypeScript, Node.js
- Fastify + Drizzle ORM
- OpenAI (GPT-4 + embeddings)
- Supabase (Postgres + Auth)
- Next.js 15 + Tailwind
- Resend for email

### Try it

[URL]

Would love feedback from this community:

1. Is the idea format useful for you?
2. What categories of ideas are you most interested in?
3. What other sources should I scrape?

Happy to answer any questions about the build or share more technical details.

---

*Building in public: I'll post updates on how the launch goes and what I learn.*
