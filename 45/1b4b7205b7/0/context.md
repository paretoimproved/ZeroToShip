# Session Context

Session ID: 01d07886-8a02-45d9-8502-a3acdf0fd225
Commit Message: Implement the following plan:

# Email Audit Round 2: Issues 1-5

## Con

## Prompts

### Prompt 1

Implement the following plan:

# Email Audit Round 2: Issues 1-5

## Context
Marketing audit identified 5 remaining issues (after our first redesign pass). All changes are in `src/delivery/email-builder.ts` with snapshot updates.

## File: `src/delivery/email-builder.ts`

### Issue 1: Tagline too abstract — add concrete "what it does" line
**Problem:** Tagline like "Client-side features, forever free, no excuses" tells users nothing about what the product actually does. They click on curiosity alone.

**Fix:** Add `firstSentence(proposedSolution)` as a concrete description line below the tagline in the hero section. This gives readers a tangible "what it is" before the CTA.

In `buildHeroSection` free tier, after the tagline `<p>` and before the CTA, add:
```html
<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.5;">
  {firstSentence(stripMarkdown(proposedSolution))}
</p>
```
For pro tier, the full sections already cover this — no change needed.

### Issue 2: Too many competing CTAs
**Problem:** 5 distinct CTAs split attention — hero CTA, inline upgrade banner, "View problem" on each card, locked footer, bottom upgrade CTA.

**Fix:**
- **Remove inline upgrade banner call** from `buildDailyEmail` (delete the `buildInlineUpgradeBanner` call, keep the function for now in case we want it back)
- **Remove "View problem →" text link** from unlocked secondary cards — make the idea **name** itself a link instead. This reduces visual noise while keeping the cards clickable.
- Result: Hero CTA (star), linked card names (supporting), bottom upgrade (closer). Three clear tiers of intent.

### Issue 3: Locked cards feel punitive
**Problem:** Opacity 0.6 + gray placeholder bar + "PRO" badge feels like punishment. Tone shifts from "valuable content" to "you've hit your limit."

**Fix in `buildIdeaCard` locked branch:**
- Remove `opacity: 0.6`
- Replace gray placeholder bar with the effort badge (show what they'd get)
- Replace "PRO" badge with subtle text: `"Unlock spec →"` linking to pricing
- Keep the idea name visible (already is)
- This makes locked cards feel like a preview of value rather than a wall

### Issue 4: Bottom CTA lacks urgency
**Problem:** "Every problem. Every spec. Every day." is a tagline, not a closer. No reason to act now.

**Fix in `buildBottomCta`:**
- Rewrite headline to be specific to today's content: use effort-level counts from the actual briefs (e.g., "Today's lineup has 4 weekend builds")
- Rewrite sub-copy to be aspirational: "Get the full spec for every problem, every day."
- Keep "Upgrade to Pro" button as-is

### Issue 5: Stat bar "Top score" is insider-speak
**Problem:** "Top score: 52.0" means nothing to new subscribers.

**Fix in `buildStatBar`:**
- Replace "Top score: X" with "Top pick: [effort] build" — tells users the best idea is doable in a weekend/week, which is universally meaningful
- Pass `topEffort` string instead of `topScore` to `buildStatBar`
- Same change in plain text version

### Plain text version
Apply same content changes:
- Add proposedSolution one-liner after tagline (free tier)
- Remove "View problem" links from unlocked cards (name + score is enough)
- Update stat bar to show effort instead of score
- Update bottom CTA copy

## Verification
```bash
npm run build && npm test
```
Snapshot tests will need updating (`npx vitest run tests/delivery/email.test.ts -u`).


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: /Users/brandonqueener/.claude/projects/-Users-brandonqueener-Desktop-github-Projects-IdeaForge/db65d7a3-feb2-4a1a-9daf-cafa63623227.jsonl

If this plan can be broken down into multiple independent tasks, consider using the TeamCreate tool to create a team and parallelize the work.

## Summary

All 5 issues implemented. Here's a summary of the changes:

### `src/delivery/email-builder.ts`

| Issue | Change |
|-------|--------|
| **1: Tagline too abstract** | Added `firstSentence(proposedSolution)` description line below the tagline in the free tier hero section (HTML + plain text) |
| **2: Too many CTAs** | Removed `buildInlineUpgradeBanner` call from `buildDailyEmail`. Replaced "View problem →" link row with the idea name itself being a link. Removed "View problem" lines from plain text |
| **3: Locked cards punitive** | Removed `opacity: 0.6`, replaced gray placeholder bar with effort badge, replaced "PRO" badge with "Unlock spec →" link to pricing. Plain text uses `[Weekend] — Unlock spec: {url}` format |
| **4: Bottom CTA lacks urgency** | Rewritten to compute effort-level counts from actual briefs (e.g., "Today's lineup has 4 weekend builds") with aspirational sub-copy. Updated signature to accept `briefs` array instead of `freeCount`/`totalCount` |
| **5: "Top score" insider-speak** | `buildStatBar` now shows "Top pick: weekend build" instead of "Top score: 52.0". Same change in plain text stat line |

### `tests/delivery/email.test.ts`
- Updated 6 assertions that checked for `[PRO]`, `>PRO</span>`, `"Every problem. Every spec. Every day."` to match the new content
- 5 snapshots auto-updated
- **All 1406 tests pass, build clean, types clean**
