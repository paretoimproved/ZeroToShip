# Session Context

Session ID: e6ad986b-c8f7-49a6-85da-348dc9ef88fc
Commit Message: Implement the following plan:

# Clean Up Card UIs: Remove Revenue Estim

## Prompts

### Prompt 1

Implement the following plan:

# Clean Up Card UIs: Remove Revenue Estimate + Fix Bookmark Cursor

## Context

The archive/explore card grid shows a green `revenueEstimate` field that often contains raw markdown (`### Revenue Projections | Period | Fre...`). This doesn't align with the "problem library + spec generation" model and looks broken. Additionally, the bookmark button shows a `cursor-not-allowed` (circle-with-slash) icon during the API call, making users think the action failed even though it uses optimistic UI and succeeds.

---

## Changes

### 1. Remove revenue estimate from CompactCard (archive)

**File:** `web/app/archive/page.tsx` (~lines 252-265)

Remove the revenue `<span>` from the bottom row. Before:
```tsx
<div className="flex items-center justify-between gap-2 min-w-0">
  <span className={`...${getEffortBadgeColor(idea.effortEstimate)}`}>
    {getEffortLabel(idea.effortEstimate)}
  </span>
  <span title={humanizeText(idea.revenueEstimate)}
    className="text-xs font-medium text-emerald-700 dark:text-emerald-300 truncate min-w-0">
    {humanizeText(idea.revenueEstimate)}
  </span>
</div>
```

After — just the effort badge, no revenue:
```tsx
<div className="flex items-center gap-2 min-w-0">
  <span className={`...${getEffortBadgeColor(idea.effortEstimate)}`}>
    {getEffortLabel(idea.effortEstimate)}
  </span>
</div>
```

### 2. Remove revenue estimate from explore page cards

**File:** `web/app/explore/page.tsx` (~lines 131-137)

Same pattern — remove the `<span>` rendering `humanizeText(idea.revenueEstimate)`.

### 3. Remove Revenue + Market from IdeaCard

**File:** `web/components/IdeaCard.tsx` (~lines 49-54)

Remove both the `Revenue: {idea.revenueEstimate}` and `Market: {idea.marketSize}` spans. Keep just the EffortBadge.

### 4. Fix bookmark cursor

**File:** `web/components/BookmarkButton.tsx` (line 72)

Change:
```
${pending ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
```
To:
```
${pending ? "opacity-60" : "cursor-pointer"}
```

The button is already `disabled={pending}` which prevents double-clicks. The optimistic UI toggles the visual state immediately. Removing `cursor-not-allowed` eliminates the false "failed" signal.

---

## Files

| # | File | Change |
|---|------|--------|
| 1 | `web/app/archive/page.tsx` | Remove revenueEstimate span from CompactCard |
| 2 | `web/app/explore/page.tsx` | Remove revenueEstimate span from explore card |
| 3 | `web/components/IdeaCard.tsx` | Remove Revenue + Market spans |
| 4 | `web/components/BookmarkButton.tsx` | Remove `cursor-not-allowed` from pending state |

---

## Verification

```bash
cd web && npx next build    # Frontend build passes
```

Manual:
- Archive page: cards show effort badge only at bottom, no green text
- Explore page: same clean cards
- IdeaCard: shows only effort badge, no revenue/market text
- Bookmark: click → icon fills immediately, no circle-with-slash cursor


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: /Users/brandonqueener/.claude/projects/-Users-brandonqueener-Desktop-github-Projects-IdeaForge/fc72c4d5-412b-4094-89aa-7a478b3fe780.jsonl

If this plan can be broken down into multiple independent tasks, consider using the TeamCreate tool to create a team and parallelize the work.

## Summary

Type-check passes. Here's a summary of all changes:

**Done — 4 files changed:**

| File | Change |
|------|--------|
| `web/app/archive/page.tsx` | Removed revenue estimate `<span>` + unused `humanizeText` import |
| `web/app/explore/page.tsx` | Removed revenue estimate `<span>` + unused `humanizeText` import |
| `web/components/IdeaCard.tsx` | Removed Revenue + Market spans, kept EffortBadge only |
| `web/components/BookmarkButton.tsx` | Removed `cursor-not-allowed` from pending state |

Frontend build and type-check both pass.

---

Regarding your question about test speed — the tests appear to hang when run via `npm test` in this session. To diagnose properly, I'd need to look at the test config and suite size. Want me to investigate the test performance issue as a separate task? Common quick wins for a 1400+ test suite:

- **Run only affected tests**: `vitest --changed` to run tests related to changed files
- **Parallel workers**: Ensure Vitest `pool` is set to `threads` or `forks` with enough workers
- **Sharding in CI**: Split the suite across multiple CI jobs
- **Mock-heavy tests**: Ensure expensive setup (DB connections, module mocking) isn't repeated unnecessarily

Let me know if you'd like me to dig into the test config and propose concrete optimizations.
