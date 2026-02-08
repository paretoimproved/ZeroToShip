# Feedback Survey

## Trigger Conditions
- Show after 7 days of usage
- Show after viewing 10+ ideas
- Show after first Pro upgrade (immediate)
- Don't show more than once per 30 days

---

## NPS Question

### Question
How likely are you to recommend ZeroToShip to a friend or colleague?

### Scale
0 (Not at all likely) — 10 (Extremely likely)

### Follow-up by Score

**Detractors (0-6):**
> We're sorry to hear that. What's the #1 thing we could do better?

**Passives (7-8):**
> Thanks! What would make you rate us higher?

**Promoters (9-10):**
> Awesome! What do you love most about ZeroToShip?

---

## Improvement Question

### Question
What's the #1 thing we could improve?

### Type
Free text (required, min 10 characters)

### Placeholder
e.g., "More ideas in the AI/ML category" or "Faster email delivery"

---

## Category Preferences

### Question
What types of ideas interest you most?

### Type
Multi-select checkboxes

### Options
- [ ] Developer tools (APIs, CLIs, dev productivity)
- [ ] SaaS / B2B (business software, workflows)
- [ ] Consumer apps (mobile, social, lifestyle)
- [ ] AI / ML (applications using AI/ML)
- [ ] E-commerce / Marketplaces
- [ ] Fintech (payments, banking, investing)
- [ ] Health / Wellness
- [ ] Education / Learning
- [ ] Other: ________________

---

## Source Preferences

### Question
Which sources provide the most valuable ideas for you?

### Type
Ranking (drag to reorder) or single select

### Options
- Reddit
- Hacker News
- Twitter/X
- GitHub

---

## Feature Request

### Question
What feature would make ZeroToShip 10x more valuable for you?

### Type
Free text (optional)

### Placeholder
e.g., "Integration with Notion" or "Mobile app"

---

## Closing

### Thank You Message
Thanks for your feedback! It directly shapes what we build next.

### CTA (if not Pro)
Want to help even more? [Upgrade to Pro]({{upgradeUrl}}) and get 10 full briefs daily.

### CTA (if Pro)
Have more thoughts? Email us anytime at feedback@zerotoship.dev

---

## Data Collection

Store responses with:
- `user_id` (UUID)
- `nps_score` (0-10)
- `nps_followup` (text)
- `improvement` (text)
- `categories` (string array)
- `source_ranking` (string array)
- `feature_request` (text, nullable)
- `submitted_at` (timestamp)
- `user_tier` (free/pro/enterprise)
- `days_since_signup` (integer)
- `ideas_viewed_count` (integer)
