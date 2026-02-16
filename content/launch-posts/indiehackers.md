# IndieHackers

**Title:** Soft launching ZeroToShip — daily startup ideas scraped from Reddit, HN, and GitHub

---

Hey IH,

I'm Brandon. For the past couple years I've been stuck in the same cycle a lot of you probably know: get excited about a random idea, build it for a weekend, launch it to nobody, move on. Rinse and repeat.

The problem wasn't execution. I can ship things. The problem was I kept building stuff that sounded cool to me instead of stuff people were actually asking for. So a few months ago I decided to fix the input — automate the research part and see what happens.

That became **ZeroToShip**.

**What it does:**
Every morning at 5 AM, a pipeline scrapes about 500 posts from 28 subreddits, Hacker News, and GitHub. It groups similar complaints into clusters (think: 10 different people frustrated with invoicing tools becomes one "invoicing" idea). Each cluster gets scored on engagement, urgency signals, and rough market indicators. Then Claude writes a brief for the top ideas — problem, solution, market analysis, tech spec, go-to-market.

You get it in your inbox. Scan it over coffee. Move on with your day or dig into something that grabbed you.

**The stack:**
TypeScript end-to-end. Fastify for the API, Next.js 15 for the frontend, Supabase for the database, Resend for email, Claude for generation. Hosted on Railway (API + scheduler) and Vercel (web). The whole AI pipeline costs about 7 cents per run — under $2/month to operate at current volume.

**Where I'm at:**
Two friends have been dogfooding it for about a week. I ran a full smoke test yesterday and everything passed — signup, email confirmation, dashboard, billing through Stripe, mobile, the whole flow. Payments are live. Looking for early users now.

**Pricing:**
Free: top 3 ideas daily, no card required.
Builder: $19/mo for all 10 ideas with full briefs.
Enterprise: $99/mo for API access and custom filters.

**Stuff I'm genuinely unsure about:**
- Is $19 right? I have no signal yet beyond "my friends think it's fair."
- Should I add any kind of community or discussion layer, or does the value stay in the async daily digest format?
- What would actually make you open your wallet for something like this?

I'd really like honest feedback. Not looking for validation — looking for the stuff that would make this more useful to you.

https://www.zerotoship.dev
