# Project Agent Workflow Guardrails

This file defines mandatory workflow guardrails for Codex in this repository.

## Primary Objective

Keep roadmap execution consistent across sessions and prevent context drift during the LangGraph migration.

## Required Skills for This Project

Use these skills by default when relevant:

1. `$roadmap-loop-enforcer` for session start/end discipline.
2. `$roadmap-ticket-slicer` for decomposing roadmap phases into executable tickets.
3. `$roadmap-gate-review` for go/no-go decisions and rollout promotion checks.

## Mandatory Session Pattern

For any code-changing session:

1. Read:
   - `docs/planning/langgraph-roadmap-status.md`
   - `docs/planning/langgraph-decision-log.md`
   - `docs/planning/langgraph-session-handoff.md`
2. Define one session objective.
3. Keep scope small and reversible.
4. End by updating:
   - `docs/planning/langgraph-roadmap-status.md`
   - `docs/planning/langgraph-session-handoff.md`
5. If architectural or workflow decisions were made, update:
   - `docs/planning/langgraph-decision-log.md`

## Redirect Rule

If work starts without the above pattern:

1. Redirect to the session protocol first.
2. Then continue implementation work.

## Mechanical Enforcement

Use the built-in script:

1. `npm run check:roadmap-loop`

Install git hooks once per clone:

1. `npm run hooks:install`

Bypass (rare, explicit only):

1. `ROADMAP_LOOP_BYPASS=1 npm run check:roadmap-loop`
