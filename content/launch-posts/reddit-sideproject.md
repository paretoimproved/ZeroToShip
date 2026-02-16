# r/SideProject

**Title:** I built a daily digest that finds startup ideas by scraping Reddit, HN, and GitHub for real pain points

---

I've spent way too many hours scrolling through Reddit and Hacker News, bookmarking posts where someone says "why doesn't X exist?" or "I'd pay for something that does Y." I had a notes app full of these scattered complaints and never did anything with them.

At some point I thought, why am I doing this manually? So I built a thing.

**ZeroToShip** is a pipeline that runs every morning at 5 AM. It pulls around 500 posts from 28 subreddits, Hacker News, and GitHub. Then it groups similar complaints together, scores them on urgency and engagement, and uses Claude to write up a brief for each one — the actual problem, a proposed solution, rough market analysis, technical spec, and a go-to-market approach. The top ideas land in my inbox before I'm out of bed.

A few things surprised me while building this:

The scraping was the easy part. Scoring ideas is where it gets tricky. High engagement doesn't always mean it's a good startup idea, sometimes people just love complaining. I'm still tweaking the scoring, and I'll probably always be tweaking it.

The AI-generated briefs turned out better than I expected. I figured they'd be generic motivational fluff, but when you give Claude the actual clustered posts, engagement data, and scoring context, the market analysis sections are genuinely useful. I've found competitors I didn't know existed just from reading the briefs.

Daily email beats a dashboard. I built a whole web app with an archive, sorting, bookmarks — and my beta testers told me they mostly just read the email over coffee. The dashboard is nice for going back to things, but the email is what keeps them engaged.

I've had two friends using it for about a week. One of them told me he stopped his usual "stare at a blank editor trying to think of what to build" routine and just picks from the digest now. That felt good to hear.

There's a free tier that gives you the top 3 ideas each day, and a Builder tier at $19/mo for the full 10-idea report with all the detail. Not trying to get rich off this, mostly want to see if other people find it as useful as I do.

https://www.zerotoship.dev

Happy to talk about the pipeline, the scoring approach, or anything else if you're curious.
