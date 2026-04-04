#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/brandonqueener/Desktop/github/Projects/IdeaForge"
DEMO_DIR="$ROOT/demos/2026-02-14-openclaw-application"
OUT_DIR="$DEMO_DIR/out"
VIDEO_DIR="$OUT_DIR/video"

mkdir -p "$VIDEO_DIR"
mkdir -p "$OUT_DIR"

# Optional: load local secrets/config (gitignored) without requiring shell exports.
# shellcheck disable=SC1090
ENV_FILE="${DEMO_ENV_FILE:-$DEMO_DIR/.env.local}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

EXISTING_AUDIO="${DEMO_NARRATION_AUDIO_PATH:-}"

TTS_ENGINE="${DEMO_TTS_ENGINE:-}"
if [[ -z "${TTS_ENGINE}" ]]; then
  if [[ -n "${EXISTING_AUDIO}" ]]; then
    TTS_ENGINE="external"
  elif [[ -n "${ELEVENLABS_API_KEY:-}" ]]; then
    TTS_ENGINE="elevenlabs"
  else
    TTS_ENGINE="say"
  fi
fi

VOICE="${DEMO_VOICE:-Samantha}"
NARRATION_SAY_SRC="${DEMO_NARRATION_SAY_SRC:-$DEMO_DIR/narration.say.txt}"
NARRATION_TEXT_SRC="${DEMO_NARRATION_TEXT_SRC:-$DEMO_DIR/narration.txt}"

if [[ "$TTS_ENGINE" == "external" ]]; then
  if [[ -z "${EXISTING_AUDIO}" || ! -f "${EXISTING_AUDIO}" ]]; then
    echo "Missing DEMO_NARRATION_AUDIO_PATH (or file does not exist): ${EXISTING_AUDIO}" >&2
    exit 1
  fi
elif [[ "$TTS_ENGINE" == "say" ]]; then
  if [[ ! -f "$NARRATION_SAY_SRC" ]]; then
    echo "Missing narration script: $NARRATION_SAY_SRC" >&2
    exit 1
  fi
elif [[ "$TTS_ENGINE" == "elevenlabs" ]]; then
  if [[ ! -f "$NARRATION_TEXT_SRC" ]]; then
    echo "Missing narration text: $NARRATION_TEXT_SRC" >&2
    exit 1
  fi
  if [[ -z "${ELEVENLABS_API_KEY:-}" ]]; then
    echo "Missing ELEVENLABS_API_KEY for DEMO_TTS_ENGINE=elevenlabs" >&2
    exit 1
  fi
  if [[ -z "${ELEVENLABS_VOICE_ID:-}" ]]; then
    echo "Missing ELEVENLABS_VOICE_ID for DEMO_TTS_ENGINE=elevenlabs" >&2
    echo "Tip: list voices with: ELEVENLABS_API_KEY=... node $ROOT/scripts/elevenlabs-list-voices.mjs" >&2
    exit 1
  fi
else
  echo "Unknown DEMO_TTS_ENGINE: $TTS_ENGINE (expected: say|elevenlabs)" >&2
  exit 1
fi

# 1) Record the demo video (Playwright recordVideo -> .webm in VIDEO_DIR).
export DEMO_RECORD_VIDEO_DIR="$VIDEO_DIR"

# Keep these aligned to the narration pacing unless you know what you're doing.
export DEMO_START_HOLD_MS="${DEMO_START_HOLD_MS:-1500}"
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
export DEMO_END_HOLD_MS="${DEMO_END_HOLD_MS:-20000}"
export DEMO_RUN_ID="${DEMO_RUN_ID:-run_20260214_openclaw_demo}"

cd "$ROOT"

if [[ "${DEMO_SKIP_RECORD:-0}" != "1" ]]; then
  # Use the web workspace runner directly so Playwright args behave consistently.
  if [[ "${DEMO_QUIET:-1}" == "1" ]]; then
    npm run test:e2e --prefix web -- --workers=1 tests/demo/loom-openclaw-ready-demo.spec.ts >/dev/null
  else
    npm run test:e2e --prefix web -- --workers=1 tests/demo/loom-openclaw-ready-demo.spec.ts
  fi
fi

# Prefer the newest *valid* .webm in the video dir (Playwright records one file per context).
VIDEO_WEBM=""
for f in $(ls -t "$VIDEO_DIR"/*.webm 2>/dev/null || true); do
  d="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f" 2>/dev/null || true)"
  if [[ -n "${d}" && "${d}" != "N/A" ]]; then
    VIDEO_WEBM="$f"
    break
  fi
done
if [[ -z "${VIDEO_WEBM:-}" ]]; then
  echo "No valid recorded video found in $VIDEO_DIR (expected *.webm)" >&2
  exit 1
fi

# 2) Generate narration audio.
NARRATION_AUDIO="$OUT_DIR/narration.audio"
if [[ "$TTS_ENGINE" == "external" ]]; then
  NARRATION_AUDIO="$EXISTING_AUDIO"
elif [[ "$TTS_ENGINE" == "say" ]]; then
  # macOS TTS -> AIFF.
  AUDIO_AIFF="$OUT_DIR/narration.aiff"
  # Fall back to a known-good voice if the requested one isn't available on this machine.
  if ! say -v '?' | awk '{print $1}' | rg -q "^${VOICE}$"; then
    VOICE="Samantha"
  fi
  say -v "$VOICE" -r "${DEMO_SAY_RATE_WPM:-175}" -f "$NARRATION_SAY_SRC" -o "$AUDIO_AIFF"
  NARRATION_AUDIO="$AUDIO_AIFF"
else
  # ElevenLabs -> MP3.
  AUDIO_MP3="$OUT_DIR/narration.mp3"
  node "$ROOT/scripts/elevenlabs-tts.mjs" \
    --voice-id "$ELEVENLABS_VOICE_ID" \
    --text-file "$NARRATION_TEXT_SRC" \
    --out "$AUDIO_MP3" \
    ${ELEVENLABS_MODEL_ID:+--model-id "$ELEVENLABS_MODEL_ID"} \
    ${ELEVENLABS_OUTPUT_FORMAT:+--output-format "$ELEVENLABS_OUTPUT_FORMAT"} \
    ${ELEVENLABS_STABILITY:+--stability "$ELEVENLABS_STABILITY"} \
    ${ELEVENLABS_SIMILARITY:+--similarity "$ELEVENLABS_SIMILARITY"} \
    ${ELEVENLABS_STYLE:+--style "$ELEVENLABS_STYLE"} \
    ${ELEVENLABS_SPEAKER_BOOST:+--speaker-boost "$ELEVENLABS_SPEAKER_BOOST"} \
    >/dev/null
  NARRATION_AUDIO="$AUDIO_MP3"
fi

# 3) Mux video + audio into MP4, padding audio if needed (keep full video length).
DUR="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO_WEBM" | awk '{printf "%.3f", $1}')"
AUD_DUR="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$NARRATION_AUDIO" | awk '{printf "%.3f", $1}')"

# Refuse to cut narration mid-sentence by default; re-record video with longer holds instead.
awk -v a="$AUD_DUR" -v v="$DUR" 'BEGIN { if (a > v + 0.25) exit 1; exit 0 }' || {
  echo "Narration is longer than video (${AUD_DUR}s > ${DUR}s). Increase demo hold timings and re-record." >&2
  echo "Tip: DEMO_HOLD_*_MS env vars control the per-scene holds." >&2
  exit 1
}

OUT_MP4="$OUT_DIR/openclaw-ready-demo.mp4"

ffmpeg -y \
  -i "$VIDEO_WEBM" \
  -i "$NARRATION_AUDIO" \
  -filter_complex "[1:a]acompressor=threshold=-18dB:ratio=3:attack=5:release=100,loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
  -map 0:v:0 -map "[a]" \
  -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p \
  -c:a aac -b:a 160k \
  -movflags +faststart \
  -shortest \
  "$OUT_MP4"

echo "Wrote stitched demo: $OUT_MP4"
echo "Source video: $VIDEO_WEBM"
echo "TTS engine: $TTS_ENGINE"
if [[ "$TTS_ENGINE" == "say" ]]; then
  echo "Voice: $VOICE"
else
  echo "ElevenLabs voice id: ${ELEVENLABS_VOICE_ID}"
  echo "ElevenLabs model id: ${ELEVENLABS_MODEL_ID:-eleven_v3}"
fi
