# Show HN Post

## Title
Show HN: IdeaForge – Daily startup ideas scraped from Reddit, HN, Twitter, GitHub

---

## Body

I built IdeaForge to solve my own problem: I have technical skills but struggle to find ideas worth building.

Every morning at 8 AM, it:

1. Scrapes 300+ posts from Reddit, HN, Twitter, and GitHub for pain points
2. Uses AI to cluster similar problems together
3. Scores each by impact (frequency × severity × market size) and effort (complexity × time to MVP)
4. Generates complete business briefs for the top 10

**What you get in your inbox:**

- Problem statement with target audience
- Competitor analysis (strengths, weaknesses, market gaps)
- Technical spec (recommended stack, architecture, MVP scope)
- Business model and pricing strategy
- Go-to-market plan with launch channels

**The scoring formula:**

```
PRIORITY = IMPACT / EFFORT
where:
  IMPACT = frequency × severity × marketSize
  EFFORT = technicalComplexity × timeToMvp
```

Weekend projects with high priority scores bubble to the top—perfect for shipping fast.

**Pricing:**

- Free: 3 ideas/day (problem + solution only)
- Pro ($19/mo): 10 ideas/day with full briefs
- Enterprise ($99/mo): Unlimited + API access

**Tech stack:**

- Scrapers: TypeScript, Cheerio, Octokit, Nitter (Twitter fallback)
- Analysis: OpenAI GPT-4, text-embedding-3-small for clustering
- Backend: Fastify, Drizzle ORM, Supabase (Postgres + Auth)
- Frontend: Next.js 15, Tailwind CSS
- Email: Resend

**Try it:** [URL]

I'd love feedback on:

1. Are the ideas actually useful?
2. Is the brief format helpful for deciding what to build?
3. What sources should I add?

Happy to answer questions about the technical implementation too.
