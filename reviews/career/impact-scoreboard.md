# Impact Scoreboard

Reporting window: 2026-01-31 to 2026-02-13  
Method: repository-history-derived delivery proxies (not vanity claims)

## Delivery Throughput

| Metric | Value | How measured | Notes |
|---|---:|---|---|
| Total commits | 168 | `git rev-list --count --since='2026-01-30' --until='2026-02-13 23:59' HEAD` | High-volume MVP + hardening window |
| Active shipping days | 9 of 14 | unique commit dates in window | Sustained multi-day push rather than one burst |
| Average commits per active day | 18.7 | total commits / active days | Includes feature, fix, test, and refactor cycles |
| Unique files touched | 393 | unique file paths in `git log --name-only` | Broad full-stack surface area |
| Gross code churn | +128,651 / -30,305 lines | `git log --numstat` aggregate | Indicates heavy implementation + refinement |
| Net code delta | +98,346 lines | insertions minus deletions | Early-stage buildout pattern |

## Quality and Reliability Investment

| Metric | Value | How measured | Notes |
|---|---:|---|---|
| Test/CI-related commits | 35 | commit subject regex: `test|ci|e2e|snapshot|lint|build` | Significant quality focus during velocity |
| Test-surface files touched | 111 | unique files matching `tests/`, `web/**/__tests__/`, `web/e2e/` | Broad test footprint evolution |
| Test code churn | +39,074 / -4,244 lines | `git log --numstat` on test paths | Strong investment in regression coverage |
| Security/auth/billing-focused commits | 29 | commit subject regex: `oauth|auth|billing|stripe|rate limit|idor|hash api|security` | Hardening done in parallel with feature work |
| Pipeline/scheduler-focused commits | 21 | commit subject regex: `pipeline|scheduler|quality gate|diagnostic|orchestrator` | Core agentic workflow actively improved |

## Product and Platform Surface Distribution

| Area | Touch count | Measurement | Interpretation |
|---|---:|---|---|
| `web/` | 519 | file-touch frequency in git history | Rapid UX and conversion iteration |
| `src/` | 445 | file-touch frequency in git history | Backend/pipeline execution and API evolution |
| `tests/` | 168 | file-touch frequency in git history | Ongoing test modernization and expansion |
| `drizzle/` | 26 | file-touch frequency in git history | Schema evolution during MVP hardening |

## KPI Gaps To Fill Next

These are next-layer metrics to upgrade from delivery proxies to product/ops outcomes:

1. Activation funnel: signup -> first successful login -> first value moment.
2. Pipeline quality pass rate and fallback rate (instrumented in LangGraph Phase 0).
3. Cost per accepted brief and mean generation latency trend by week.
4. Incident rate and mean time to recovery for auth/billing/pipeline failures.
