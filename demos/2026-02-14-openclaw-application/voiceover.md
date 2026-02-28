# ZeroToShip "OpenClaw-Ready" Loom Demo Voiceover (60-90s)

This voiceover is aligned to the Playwright demo driver:

- `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/web/e2e/tests/demo/loom-openclaw-ready-demo.spec.ts`
- Runner: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/loom-demo-openclaw-ready.sh`

If you keep the default hold timings from the runner script, the segment lengths below will line up without manual tweaking.

## Segment 0 (start hold, ~1-2s)

Alright, quick demo of ZeroToShip as the signal engine for an OpenClaw execution product.

## Segment 1 (Dashboard hold, ~6s)

This is ZeroToShip. Every day it pulls real pain points from places like Reddit, Hacker News, and GitHub, clusters and scores them, and generates ranked startup briefs.
The point is: high-signal inputs, on a daily cadence.

## Segment 2 (Idea detail hold, ~6s)

Here’s one brief as the entry point. You get the problem, audience, market notes, and sources.
In an OpenClaw product, this is the “pick the brief” moment that triggers an execution workflow.

## Segment 3 (Admin runs list hold, ~4-5s)

And here’s the operational side: every pipeline run is auditable.
You can see mode, phases, quality pass rate, fallback rate, and unit cost.

## Segment 4 (Run detail hold, ~4-5s)

Inside a run, generation is graph-mode with guardrails: bounded attempts, section-aware retries, and budget caps, with legacy fallback always available.

## Segment 5 (Run trace expanded hold, ~9s)

This trace is the proof. You can see each attempt, which model was used, which sections were retried, and why.
And this handoff line is the agent-to-agent seam: we can call out to n8n or MCP-backed workflows to enrich evidence, with timeouts and circuit breaking.

## Segment 6 (end hold, ~10-15s)

So the OpenClaw layer is intentionally thin: it’s a chat-first wrapper that selects a brief and runs a bounded workflow to produce a 48-hour validation kit.
Revenue is subscription for daily briefs, plus paid execution runs when you generate those kits.

