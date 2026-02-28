# Career-Focused Decision Log

## Decision Template

- Date: YYYY-MM-DD
- Decision:
- Context:
- Options considered:
- Chosen option:
- Why:
- Tradeoffs:
- Revisit trigger:
- Evidence:

---

## Entries

- Date: 2026-02-01
- Decision: Consolidate into a monorepo and run cross-layer iteration
- Context: Backend, scheduler, and web iteration were tightly coupled during MVP buildout.
- Options considered: keep separate repos and synchronize releases; consolidate into one workspace.
- Chosen option: monorepo with shared package boundaries.
- Why: reduced integration overhead and enabled faster full-stack fix loops.
- Tradeoffs: larger repo churn and more frequent lockfile/workspace coordination.
- Revisit trigger: if build/test times or review complexity become a bottleneck.
- Evidence: `4d87622`, `cb747a3`.

- Date: 2026-02-07
- Decision: Ship MVP first, then harden in rapid follow-up cycles
- Context: The project needed real usage/testing pressure to identify the highest-leverage fixes.
- Options considered: extended pre-release polish; MVP launch with immediate hardening sprint.
- Chosen option: MVP launch with aggressive post-launch stabilization.
- Why: real failure data is more valuable than speculative polish.
- Tradeoffs: visible post-launch bug volume and frequent patch cadence.
- Revisit trigger: if defect volume remains high after stabilization cycles.
- Evidence: `7e381c5`, `59a032a`, `ff6b21b`, `c7c6c9d`.

- Date: 2026-02-08
- Decision: Add operator-first admin control surfaces early
- Context: Pipeline behavior and brief quality were difficult to manage without direct controls.
- Options considered: delay admin tooling; invest early in run visibility + controls.
- Chosen option: early admin console, run history, and quality-gate visibility.
- Why: improved operating leverage and faster debugging for pipeline issues.
- Tradeoffs: some early engineering time moved from end-user features to internal tooling.
- Revisit trigger: if operator workflows stabilize and tooling investment no longer pays back.
- Evidence: `341e2fe`, `4ce8be2`, `346f145`.

- Date: 2026-02-09
- Decision: Use freemium access controls to balance acquisition and monetization
- Context: Needed top-of-funnel growth without fully giving away premium value.
- Options considered: strict paywall; fully open archive; constrained preview model.
- Chosen option: constrained preview ("velvet rope") with clear upgrade paths.
- Why: enables product discovery while maintaining paid differentiation.
- Tradeoffs: additional complexity in tier gating and UX edge cases.
- Revisit trigger: if conversion or retention data indicates poor balance between free value and upgrade pressure.
- Evidence: `e8defe5`, `27a0435`, `2f43625`, `21cdc88`.

- Date: 2026-02-10
- Decision: Gate production deployment through CI and broaden automated coverage
- Context: Commit velocity accelerated; manual verification was insufficient.
- Options considered: manual deploy checks; CI-enforced quality gates.
- Chosen option: CI workflow plus Vercel production gate and expanded test suites.
- Why: protects release quality while preserving rapid iteration pace.
- Tradeoffs: occasional CI friction and time spent stabilizing tests.
- Revisit trigger: if CI signal quality degrades or cycle time becomes unacceptable.
- Evidence: `679d0f6`, `3d80378`, `53bbd73`, `16664b7`, `7f1f143`.

- Date: 2026-02-10
- Decision: Prioritize security controls before scaling usage
- Context: Auth, billing, and API surfaces introduced meaningful abuse/security risk.
- Options considered: defer hardening until traffic growth; patch critical vectors immediately.
- Chosen option: immediate hardening (API key hashing, rate limiting, auth and tier protections).
- Why: lowered operational and reputational risk before broader adoption.
- Tradeoffs: reduced short-term feature bandwidth.
- Revisit trigger: if new attack vectors emerge from new product surfaces.
- Evidence: `37774d7`, `fe5292b`, `f9b8057`, `dc27943`.

- Date: 2026-02-12
- Decision: Treat mobile OAuth reliability as a top-priority path to activation
- Context: Login failures on mobile created direct onboarding drop-off risk.
- Options considered: accept desktop-only reliability temporarily; close mobile OAuth gaps immediately.
- Chosen option: immediate mobile OAuth stabilization with backend code exchange fallback.
- Why: authentication reliability is a critical dependency for growth.
- Tradeoffs: repeated short-cycle auth fixes and test maintenance.
- Revisit trigger: if auth failure reports remain after stabilization.
- Evidence: `e9bd1dc`, `ee8e5e8`, `1054f3a`.

- Date: 2026-02-13
- Decision: Start LangGraph migration with instrumentation-first Phase 0
- Context: Migration risk needed measurable before/after comparisons and safe rollback.
- Options considered: immediate orchestrator rewrite; phased migration with diagnostics baseline.
- Chosen option: phased migration beginning with diagnostics and admin visibility.
- Why: reduced migration blast radius and enabled KPI-based gate decisions.
- Tradeoffs: temporary dual-path complexity and slower full cutover.
- Revisit trigger: if graph mode outperforms legacy consistently across KPI gates.
- Evidence: `7553761`, `docs/planning/langgraph-decision-log.md`.
