# TODOs

## Open

### P2: Open-Source the Codebase
**What:** Make the IdeaForge repo public as a portfolio piece and marketing channel.
**Why:** A fully built SaaS (pipeline + payments + AI + tests) is compelling open-source content. Attracts developer audience who are potential users.
**Context:** Considered as Approach B during CEO review (2026-03-21). Deferred in favor of customer discovery sprint. Revisit after sprint regardless of outcome. Requires careful redaction of secrets/env vars before publishing.
**Effort:** S (human: ~3 days / CC: ~2 hours)
**Depends on:** PMF Sprint completion (Week 2-3)

### P3: Create DESIGN.md (Design System Documentation)
**What:** Run `/design-consultation` to create DESIGN.md with design tokens, color system, typography scale, spacing rules, and component vocabulary.
**Why:** Undocumented design systems drift. Each new page/component risks slightly different spacing, colors, or patterns. DESIGN.md becomes the source of truth for visual consistency.
**Context:** Current design is clean and consistent (Tailwind-based) but implicit. Flagged during plan-design-review (2026-03-22). Only relevant if PMF validates and product continues.
**Effort:** S (human: ~2 days / CC: ~30 min)
**Depends on:** PMF Sprint completion

### P3: Backfill Evidence Accuracy Review
**What:** Review accuracy of evidence strength tiers on backfilled briefs vs newly generated ones.
**Why:** The backfill script (Phase 8) approximates evidence from the `sources` array, which is capped at 5 items by `extractSources()`. This means sourceCount maxes at 5 and totalEngagement is partial. New briefs compute from the full ProblemCluster data (true frequency, all sources). Some backfilled briefs may have inaccurate tiers.
**Context:** Flagged during eng review outside voice (2026-03-23). Approximation is acceptable for visual consistency on old briefs, but should be verified once new evidence-first briefs are generating alongside backfilled ones.
**Effort:** XS (human: ~2 hours / CC: ~15 min)
**Depends on:** Evidence-first briefs Wave 2 (schema + backfill) shipped

### P3: Reddit Scraper Rate Limiting for Multi-Endpoint Scraping
**What:** Address Reddit rate limit exposure when Phase 6 (hot/top/comments) triples API calls from 35 to 105 per scrape cycle.
**Why:** Reddit's unauthenticated rate limit is 60 req/min. With 3 endpoints × 35 subreddits, scrape time increases to ~105s minimum and risks 429 errors.
**Context:** Flagged during eng review (2026-03-23). Options: increase request delay to 2s, reduce subreddit list to ~20, or add Reddit OAuth. Defer decision to Phase 6 implementation.
**Effort:** S (human: ~4 hours / CC: ~20 min)
**Depends on:** Evidence-first briefs Phase 6 (Reddit scraper improvements)

### P2: Technical Blog Posts / Content-Led Growth
**What:** Write 3-5 blog posts about building IdeaForge — architecture decisions, Claude Code workflow, testing strategy, pipeline design.
**Why:** Plays to founder's strength (engineering craft). Builds developer audience. Content compounds over time.
**Context:** Considered as Approach C during CEO review (2026-03-21). Deferred because direct discovery conversations produce faster signal. Can be combined with open-sourcing.
**Effort:** M (human: ~3 weeks / CC: ~4 hours for drafts)
**Depends on:** PMF Sprint completion

## Completed
(none yet)
