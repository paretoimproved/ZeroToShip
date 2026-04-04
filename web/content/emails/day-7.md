# Day 7 Email (1 week after signup)

## Subject Line Options
- Your first week with ZeroToShip (quick recap)
- 7 days, {{totalProblems}} problems — what's next?
- Help me make ZeroToShip better for you

---

## Email Body

Hey {{name}},

You've been with ZeroToShip for a week. Here's your recap:

---

**Your Week in Numbers**

| Metric | Value |
|--------|-------|
| Problems delivered | {{totalProblems}} |
| Top scoring problem | {{topIdea.name}} ({{topIdea.priorityScore}}/100) |
| Most common category | {{topCategory}} |
| Quick wins (weekend projects) | {{quickWinCount}} |

---

**I have a favor to ask.**

What would help me improve ZeroToShip for you?

Just hit reply and answer any of these:

1. **What's working well?** (Keep doing this)
2. **What's missing?** (What would make this 10x better?)
3. **Would you recommend it to a friend?** (Why or why not?)

Your feedback directly shapes the product. I read every reply.

---

**What's Next?**

{{#if isPro}}
You're on Pro—awesome! Here are some features you might have missed:

- **Archive search** — Find ideas from previous days
- **Category filters** — Focus on your niche
- **Export to CSV** — Take your ideas anywhere

[Explore the Dashboard →]({{dashboardUrl}})
{{else}}
You're on the free plan. Here's what Pro unlocks:

- Unlimited spec generation (vs 3/month)
- Custom problem submission
- Problem watching
- Full technical specs
- Archive access

[Try Pro for $19/mo →]({{upgradeUrl}})
{{/if}}

---

Thanks for being an early user. Seriously.

— {{senderName}}, Founder of ZeroToShip

P.S. Found a problem you want to solve? Reply and tell me—I'd love to hear what you're building.

---

## Footer
You're receiving this because you signed up for ZeroToShip.
[Manage preferences]({{preferencesUrl}}) · [Unsubscribe]({{unsubscribeUrl}})

---

## Template Variables
- `{{name}}` - User's first name
- `{{totalProblems}}` - Total problems delivered
- `{{topIdea.name}}` - Highest scoring idea of the week
- `{{topIdea.priorityScore}}` - Score
- `{{topCategory}}` - Most frequent category in their ideas
- `{{quickWinCount}}` - Number of weekend/week projects
- `{{isPro}}` - Boolean for conditional content
- `{{dashboardUrl}}` - Link to web dashboard
- `{{upgradeUrl}}` - Pro upgrade link
- `{{senderName}}` - Founder's first name
- `{{preferencesUrl}}` - Settings page
- `{{unsubscribeUrl}}` - Unsubscribe link
