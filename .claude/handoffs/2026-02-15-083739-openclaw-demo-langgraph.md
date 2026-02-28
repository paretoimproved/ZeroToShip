# Handoff: OpenClaw Application Demo + LangGraph Architecture (IdeaForge)

- Date: 2026-02-15
- Repo: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge`
- Branch: `codex/dummy-proof-ux` (worktree is currently dirty; see `git status`)

## Goal Of This Handoff

Enable a fresh agent (Claude Code) to:

1. Understand the LangGraph migration architecture + where it is documented.
2. Regenerate / tweak the OpenClaw application demo (Playwright + Loom + stitched MP4) with voiceover that matches visuals exactly.
3. Send an application email to `openclaw@launch.co` with the correct positioning and assets.

## Canonical Architecture Docs (LangGraph Migration)

These are the authoritative sources to cite for “5-phase LangGraph implementation” (and current status):

- Roadmap status: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/docs/planning/langgraph-roadmap-status.md`
- Decision log: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/docs/planning/langgraph-decision-log.md`
- Session handoff log: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/docs/planning/langgraph-session-handoff.md`

What’s implemented (high level):

- Provider seam + generation mode selector (`legacy` vs `graph`)
- Phase 2/3: graph-mode generation w/ bounded attempts, section-aware retries, model cascade, budgets, concurrency
- Phase 4: handoff seam (mocked today; n8n/MCP real wiring can be added later)
- Phase 5: publish/review gate (run-level delivery block + admin approve/reject)

Key code entry points (good starting reads):

- Provider selection + generate phase plumbing:
  - `src/generation/providers/*`
  - `src/scheduler/phases/generate.ts`
- Graph runner + nodes:
  - `src/generation/graph/*`
- Scheduler/orchestrator:
  - `src/scheduler/orchestrator.ts`
- Admin trace UI (Mermaid):
  - `web/app/admin/runs/[runId]/page.tsx`

## OpenClaw Application Demo (What Exists Now)

### Output Artifacts

- Final stitched MP4 (video + narration muxed):
  - `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/out/openclaw-ready-demo.mp4`
- Narration track used for overlay:
  - `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/out/narration.mp3`
- Narration scripts:
  - ElevenLabs/plain: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/narration.txt`
  - macOS `say`: `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/narration.say.txt`

### Demo Flow (Visual Story)

Playwright-driven demo is deterministic (API mocked) and does:

1. Dashboard: “Today’s Top Ideas”
2. Brief detail: click through tabs (Problem -> Solution -> Tech Spec -> Sources) to show the analysis “shape”
3. Admin: Pipeline Control (cron framing)
4. Admin: Runs list -> Run detail -> expand Run Trace (shows graph trace + handoff seam)
5. Admin: pitch screen (`/admin/demo/openclaw`)

Driver:

- `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/web/e2e/tests/demo/loom-openclaw-ready-demo.spec.ts`

### Critical Fix For Voiceover Alignment (Timing Windows)

Problem: narration said “brief section ~1 minute” but visuals switched to Admin too early.

Fix: the demo driver now has explicit per-tab hold windows:

- `DEMO_HOLD_BRIEF_INTRO_MS`
- `DEMO_HOLD_BRIEF_PROBLEM_MS`
- `DEMO_HOLD_BRIEF_SOLUTION_MS`
- `DEMO_HOLD_BRIEF_TECH_MS`
- `DEMO_HOLD_BRIEF_SOURCES_MS`
- `DEMO_HOLD_BRIEF_TAB_SWITCH_MS`

Additionally, a timeline logger exists to measure actual transitions:

- `DEMO_LOG_TIMELINE=1` prints `DEMO_TIMELINE_MS=[...]`

Timing notes:

- `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/timing-plan.md`

Latest measured brief -> admin switch:

- ~60.2s after `brief_visible` (matches the narration intent)

### Scripts (Record / Stitch)

- Loom (headed) runner:
  - `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/loom-demo-openclaw-ready.sh`
- Fully automated stitch (Playwright record + TTS + ffmpeg mux):
  - `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/stitch-openclaw-demo.sh`

Runbook:

- `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/runbook.md`

### Mocks (Make Brief Tabs Work Reliably)

To ensure the “Sources” tab is visible in the brief:

- E2E mock ideas include `sources[]` now:
  - `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/web/e2e/utils/api-mock.utils.ts`

## OpenClaw Application Email (Draft)

Target email:

- `openclaw@launch.co`

Positioning to keep consistent with demo:

- ZeroToShip = daily signal engine (briefs)
- Brief tab structure = prompt substrate
- OpenClaw = thin execution layer that launches bounded workflows from the handoff seam
- Monitoring = LangGraph trace in admin + auditability

Draft (edit name/links as needed):

```text
Hi Launch team,

I’m applying for the OpenClaw initiative with an “OpenClaw-ready” product that already runs a daily pipeline of startup briefs and exposes the exact seam where an OpenClaw skill should plug in.

What we have today
- ZeroToShip (zerotoship.dev): a daily cron pulls pain points (Reddit/HN/GitHub), clusters + scores them, and generates ranked briefs.
- Briefs are structured into tabs (Problem, Solution, Tech Spec, Sources). That structure is prompt substrate for OpenClaw agents.
- Graph-mode generation is auditable: per-brief retries, budgets, fallbacks, and an admin-visible LangGraph workflow trace.
- Agent handoff is already modeled as a bounded seam (timeouts/circuit breaker + structured outputs), which is where OpenClaw can launch downstream workflows.

OpenClaw product we’re building
“Brief -> Validation Kit”: select the top 1–3 briefs from the daily run, then run separate agent workflows to produce a 48-hour validation kit (landing page + copy, outreach sequences, pricing, lightweight repo plan), and monitor execution end-to-end via trace.

Demo
Happy to share a Loom link, or see the attached MP4.

My background
Engineering manager (Coinbase), comfortable directing both human teams and agent workflows with clear guardrails and measurable outputs.

Thanks,
<Your name>
```

## Secrets / Local Env (Do Not Commit)

The demo tooling can use ElevenLabs for narration:

- API key + voice id should live in a gitignored file:
  - `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/.env.local`

Do not put API keys into this repo, handoffs, or chat transcripts.

## Obsidian Daily Logs (User Mentioned)

User has daily logs in an Obsidian vault:

- Vault path (local): `/Users/brandonqueener/Desktop/github/DevVault`

Those logs are not part of the repo; use them as narrative/context only if Brandon points you to specific pages/dates.

## Exact Next Steps (For Claude Code)

1. Confirm current demo timing is still correct:
   - `DEMO_LOG_TIMELINE=1 /Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/loom-demo-openclaw-ready.sh`
2. Re-stitch MP4 if narration text changes:
   - `DEMO_TTS_ENGINE=external DEMO_NARRATION_AUDIO_PATH=/Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/out/narration.mp3 /Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/stitch-openclaw-demo.sh`
3. Finalize the application email copy and send to `openclaw@launch.co` with the MP4 attached.

## Useful Commands

- Demo (headed, for Loom):
  - `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/loom-demo-openclaw-ready.sh`
- Generate ElevenLabs narration (writes MP3):
  - `node /Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/elevenlabs-tts.mjs --voice-id "$ELEVENLABS_VOICE_ID" --text-file /Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/narration.txt --out /Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/out/narration.mp3`
- Build check (web):
  - `npm run web:build`

