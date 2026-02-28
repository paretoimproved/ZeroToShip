# Weekly Build Log

This log is written for interview storytelling: what shipped, what failed, what was learned, and what changed in execution strategy.

## 2026-W05 (2026-01-31 to 2026-02-02)

Date range focus: foundation and cost-aware architecture setup.

Shipped:

1. REST API, scheduler/orchestrator, DB migrations, and seed/verification tooling.
2. Email delivery module and Stripe integration.
3. Batch-oriented analysis/generation optimizations plus cost validation support.
4. Monorepo consolidation for faster cross-layer iteration.

What failed / friction:

1. Deployment and config issues surfaced early (Nixpacks/Railway and build alignment).
2. Provider migration and test mocks needed cleanup during velocity.

What changed in approach:

1. Moved to a unified workspace and faster vertical slicing.
2. Started treating cost controls as first-class rather than deferred polish.

Evidence:

1. `2772598`, `6c6b647`, `63a575e`, `dbb362a`, `9538817`.
2. `929a4e4`, `9e55668`, `9f4e5d0`, `79218f7`, `989e6d8`, `0376141`, `4d87622`.

## 2026-W06 (2026-02-03 to 2026-02-09)

Date range focus: MVP release and product/operator surface expansion.

Shipped:

1. MVP completion and deployment with live API wiring.
2. Admin console with tier controls, pipeline controls, and user management.
3. Pipeline run history and quality gate visibility.
4. OAuth support, archive redesign, pagination/infinite scroll, and pricing/tier updates.

What failed / friction:

1. Auth/OAuth edge cases created repeated login regressions.
2. Archive pagination/state defects required rapid follow-up fixes.
3. Pipeline polling and threshold tuning needed tighter feedback loops.

What changed in approach:

1. Shifted into "ship then harden immediately" cadence.
2. Elevated operator visibility and controls to reduce blind debugging.

Evidence:

1. `7e381c5`, `59a032a`, `0f27f37`.
2. `341e2fe`, `4ce8be2`, `346f145`.
3. `41fcf95`, `99c231c`, `28e1580`, `50dfad9`, `f674d2b`, `1412967`.

## 2026-W07 (2026-02-10 to 2026-02-13)

Date range focus: reliability, security, and migration readiness.

Shipped:

1. CI workflow, deploy gating, scheduler phase integration tests, and component tests.
2. Security hardening (API key hashing, rate limiting, IDOR fixes, tier derivation from subscriptions).
3. SEO/explore/email/admin enhancements and broad UX polishing.
4. LangGraph Phase 0 diagnostics instrumentation and admin visibility.

What failed / friction:

1. CI/test instability required repeated normalization and environment fixes.
2. Mobile OAuth and checkout flow had production-grade edge-case failures.

What changed in approach:

1. Reinforced CI as required release gate.
2. Began migration with instrumentation-first strategy to preserve rollback safety.

Evidence:

1. `679d0f6`, `3d80378`, `53bbd73`, `16664b7`.
2. `37774d7`, `fe5292b`, `f9b8057`, `dc27943`.
3. `e9bd1dc`, `1054f3a`, `bd6521c`.
4. `7553761`.
