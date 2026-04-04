#!/usr/bin/env bash
set -euo pipefail

cd /Users/brandonqueener/Desktop/github/Projects/IdeaForge

# Watchable pacing controls used by web/e2e/utils/journey-helpers.ts
export JOURNEY_HEADED="${JOURNEY_HEADED:-true}"
export JOURNEY_PAUSE_MS="${JOURNEY_PAUSE_MS:-1300}"

# Optional holds to make Loom recording easier (milliseconds)
export DEMO_START_HOLD_MS="${DEMO_START_HOLD_MS:-1500}"
export DEMO_END_HOLD_MS="${DEMO_END_HOLD_MS:-20000}"

# Cue holds for narration alignment (milliseconds)
export DEMO_HOLD_DASHBOARD_MS="${DEMO_HOLD_DASHBOARD_MS:-6000}"
# Brief holds (timed to narration beats)
export DEMO_HOLD_BRIEF_INTRO_MS="${DEMO_HOLD_BRIEF_INTRO_MS:-6000}"
export DEMO_HOLD_BRIEF_PROBLEM_MS="${DEMO_HOLD_BRIEF_PROBLEM_MS:-14000}"
export DEMO_HOLD_BRIEF_SOLUTION_MS="${DEMO_HOLD_BRIEF_SOLUTION_MS:-14000}"
export DEMO_HOLD_BRIEF_TECH_MS="${DEMO_HOLD_BRIEF_TECH_MS:-14000}"
export DEMO_HOLD_BRIEF_SOURCES_MS="${DEMO_HOLD_BRIEF_SOURCES_MS:-8000}"
export DEMO_HOLD_BRIEF_TAB_SWITCH_MS="${DEMO_HOLD_BRIEF_TAB_SWITCH_MS:-900}"
export DEMO_HOLD_PIPELINE_MS="${DEMO_HOLD_PIPELINE_MS:-5500}"
export DEMO_HOLD_RUNS_MS="${DEMO_HOLD_RUNS_MS:-4500}"
export DEMO_HOLD_RUN_DETAIL_MS="${DEMO_HOLD_RUN_DETAIL_MS:-4500}"
export DEMO_HOLD_TRACE_MS="${DEMO_HOLD_TRACE_MS:-9000}"
export DEMO_HOLD_PITCH_MS="${DEMO_HOLD_PITCH_MS:-18000}"

# Optional: set a run id displayed in the Admin UI
export DEMO_RUN_ID="${DEMO_RUN_ID:-run_20260214_openclaw_demo}"

# Call the web workspace Playwright runner directly so args reliably reach Playwright.
npm run test:e2e --prefix web -- --headed --workers=1 tests/demo/loom-openclaw-ready-demo.spec.ts
