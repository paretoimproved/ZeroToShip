# Welcome Email (Day 0 - Immediate)

## Subject Line Options
- Your first validated problems are ready
- Welcome to ZeroToShip - Your first problems are inside
- [ZeroToShip] Let's find your next project

---

## Email Body

Hey {{name}},

Welcome to ZeroToShip!

Starting tomorrow morning, you'll get validated problems delivered to your inbox. Each one scraped from Reddit, Hacker News, and GitHub in the last 24 hours.

**Here's how it works:**

1. **Check your inbox each morning** — Your daily problems arrive
2. **Review the scores** — Higher priority = bigger opportunity, less effort
3. **Click through for details** — See the full brief (Pro only)
4. **Start building** — Or wait for tomorrow's batch

**Today's Top Idea Preview:**

> **{{topIdea.name}}**
> {{topIdea.tagline}}
>
> Priority Score: {{topIdea.priorityScore}}/100
> Effort: {{topIdea.effortEstimate}}
>
> *{{topIdea.problemStatement}}*

[View Full Brief →]({{topIdea.url}})

**Quick tip:** The best ideas often have high "severity" scores—those are the painful problems people will actually pay to solve.

Questions? Just reply to this email.

— The ZeroToShip Team

---

P.S. Want full specs? [Upgrade to Pro]({{upgradeUrl}}) for full specs for every problem.

---

## Footer
You're receiving this because you signed up for ZeroToShip.
[Manage preferences]({{preferencesUrl}}) · [Unsubscribe]({{unsubscribeUrl}})

---

## Template Variables
- `{{name}}` - User's first name
- `{{ideaCount}}` - number of problems delivered
- `{{topIdea.name}}` - Today's #1 idea name
- `{{topIdea.tagline}}` - One-line description
- `{{topIdea.priorityScore}}` - Score out of 100
- `{{topIdea.effortEstimate}}` - weekend/week/month/quarter
- `{{topIdea.problemStatement}}` - The problem being solved
- `{{topIdea.url}}` - Link to full brief
- `{{upgradeUrl}}` - Pro upgrade link
- `{{preferencesUrl}}` - Settings page
- `{{unsubscribeUrl}}` - Unsubscribe link
