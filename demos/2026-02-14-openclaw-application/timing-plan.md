# OpenClaw Demo Timing Plan (Voiceover ↔ Visuals)

Goal: keep the idea brief on screen long enough to match the narration (about 60s from opening the brief to switching into Admin).

## How Timing Is Enforced

The Playwright driver uses explicit per-beat holds for the brief tabs:

- `DEMO_HOLD_BRIEF_INTRO_MS`
- `DEMO_HOLD_BRIEF_PROBLEM_MS`
- `DEMO_HOLD_BRIEF_SOLUTION_MS`
- `DEMO_HOLD_BRIEF_TECH_MS`
- `DEMO_HOLD_BRIEF_SOURCES_MS`

Those holds determine when the demo switches to Admin.

## Measure the Real Timeline (Source of Truth)

Run once with timeline logging:

```bash
DEMO_LOG_TIMELINE=1 /Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/loom-demo-openclaw-ready.sh
```

It prints `DEMO_TIMELINE_MS=[...]` with offsets from demo start.

## Latest Measured Timeline (2026-02-14)

Measured marks (ms offsets):

```json
[
  {"label":"dashboard_visible","offsetMs":1355},
  {"label":"brief_visible","offsetMs":8553},
  {"label":"brief_problem_start","offsetMs":14555},
  {"label":"brief_solution_start","offsetMs":29598},
  {"label":"brief_tech_start","offsetMs":44571},
  {"label":"brief_sources_start","offsetMs":59554},
  {"label":"admin_pipeline_visible","offsetMs":68715},
  {"label":"admin_runs_visible","offsetMs":74557},
  {"label":"admin_run_detail_visible","offsetMs":82652},
  {"label":"admin_trace_expanded","offsetMs":87234},
  {"label":"pitch_visible","offsetMs":97749}
]
```

Key takeaway:

- Brief open → Admin switch: `admin_pipeline_visible - brief_visible ≈ 60.2s`

## Target Windows (What To Aim For)

If you want the brief section to last ~60s after the brief opens, adjust:

- Decrease: `DEMO_HOLD_BRIEF_*_MS` to speed up tab dwell time
- Increase: `DEMO_HOLD_BRIEF_*_MS` to slow down tab dwell time

Recommended “brief section” budget (approx):

- Intro: 6s
- Problem: 14s
- Solution: 14s
- Tech: 14s
- Sources: 12s

Total: ~60s (plus small overhead for tab switching and annotation overlays).
