# Day 1 Email (24 hours after signup)

## Subject Line Options
- Did any problems spark your interest?
- Quick question about yesterday's problems
- What did you think of your first batch?

---

## Email Body

Hey {{name}},

You got your first batch of problems yesterday.

Quick question: **Did any stand out?**

If so, here's what to do next:

1. **Read the full brief** — See the technical spec and competitor analysis
2. **Check the market gaps** — Where can you differentiate?
3. **Validate fast** — 5 quick customer conversations beats weeks of building

If nothing clicked, no worries. Tomorrow's problems will be completely different—scraped fresh from overnight discussions.

**Pro tip:** Filter by effort level. Looking for a weekend project? Sort by "weekend" problems. Have more time? The "month" problems tend to have bigger impact potential.

**Yesterday's Quick Wins:**

{{#each quickWins}}
- **{{this.name}}** ({{this.effortEstimate}}) — {{this.tagline}}
{{/each}}

[View All Problems →]({{dashboardUrl}})

Still exploring? That's fine. The best builders I know evaluated dozens of ideas before committing.

— The ZeroToShip Team

---

## Footer
You're receiving this because you signed up for ZeroToShip.
[Manage preferences]({{preferencesUrl}}) · [Unsubscribe]({{unsubscribeUrl}})

---

## Template Variables
- `{{name}}` - User's first name
- `{{quickWins}}` - Array of weekend/week ideas from yesterday
- `{{quickWins[].name}}` - Idea name
- `{{quickWins[].effortEstimate}}` - Effort level
- `{{quickWins[].tagline}}` - One-liner
- `{{dashboardUrl}}` - Link to web dashboard
- `{{preferencesUrl}}` - Settings page
- `{{unsubscribeUrl}}` - Unsubscribe link
