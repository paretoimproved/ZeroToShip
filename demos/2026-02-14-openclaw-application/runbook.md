# Loom Recording Runbook (Playwright + Descript)

## 1) Record the screen (Loom)

1. Open Loom (`/Applications/Loom.app`) and sign in.
2. Choose "Screen + Camera" or "Screen only" (screen only is usually cleaner for an application demo).
3. Start recording.
4. In a terminal, run:

```bash
/Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/loom-demo-openclaw-ready.sh
```

The Playwright window will step through the flow and pause at the key frames for narration alignment.

## 2) Generate voiceover (Descript)

1. Open Descript (`/Applications/Descript.app`) and sign in.
2. Create a new project, import the Loom video.
3. Add a voiceover track using an AI voice (or Overdub).
4. Paste the script segments from:
   - `/Users/brandonqueener/Desktop/github/Projects/IdeaForge/demos/2026-02-14-openclaw-application/voiceover.md`
5. If needed, add short pauses between segments so they land on the Playwright holds.
6. Export the final video.

## 3) Tuning pace (optional)

You can adjust hold timings without touching code:

```bash
DEMO_HOLD_DASHBOARD_MS=7000 \
DEMO_HOLD_BRIEF_PROBLEM_MS=16000 \
DEMO_HOLD_BRIEF_SOLUTION_MS=16000 \
DEMO_HOLD_BRIEF_TECH_MS=16000 \
DEMO_HOLD_BRIEF_SOURCES_MS=14000 \
DEMO_HOLD_PIPELINE_MS=7000 \
DEMO_HOLD_RUNS_MS=5000 \
DEMO_HOLD_RUN_DETAIL_MS=5000 \
DEMO_HOLD_TRACE_MS=11000 \
DEMO_HOLD_PITCH_MS=18000 \
DEMO_END_HOLD_MS=20000 \
/Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/loom-demo-openclaw-ready.sh
```

## 3.1) Verify timing windows (recommended)

To confirm the brief section actually stays on-screen as long as the voiceover says it does, run once with timeline logging:

```bash
DEMO_LOG_TIMELINE=1 /Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/loom-demo-openclaw-ready.sh
```

Playwright will print `DEMO_TIMELINE_MS=[...]` with timestamps for each beat (brief open, tab switches, admin shift, etc).

## 4) Fully automated ElevenLabs voiceover (no editor)

If you want the best-sounding TTS without manual editing, use ElevenLabs via the stitch script.

1. Get an ElevenLabs API key.
2. List available voices and choose a `voice_id`:

```bash
ELEVENLABS_API_KEY="..." node /Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/elevenlabs-list-voices.mjs
```

3. Stitch video + ElevenLabs narration:

```bash
export ELEVENLABS_API_KEY="..."
export ELEVENLABS_VOICE_ID="..."

# Optional tuning
export ELEVENLABS_MODEL_ID="eleven_v3"
export ELEVENLABS_STABILITY="0.5"
export ELEVENLABS_SIMILARITY="0.85"
export ELEVENLABS_STYLE="0.2"
export ELEVENLABS_SPEAKER_BOOST="true"

/Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/stitch-openclaw-demo.sh
```

If you're iterating on audio only, reuse the last recorded video:

```bash
DEMO_SKIP_RECORD=1 /Users/brandonqueener/Desktop/github/Projects/IdeaForge/scripts/stitch-openclaw-demo.sh
```
