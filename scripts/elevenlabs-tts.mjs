#!/usr/bin/env node
/* eslint-disable no-console */

import fs from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://api.elevenlabs.io/v1';

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith('--')) return fallback;
  return v;
}

function usage() {
  console.log('Usage:');
  console.log('  ELEVENLABS_API_KEY=... node scripts/elevenlabs-tts.mjs \\');
  console.log('    --voice-id <voice_id> --text-file <path> --out <path> \\');
  console.log('    [--model-id eleven_v3] [--output-format mp3_44100_128] \\');
  console.log('    [--stability 0.5] [--similarity 0.85] [--style 0.2] [--speaker-boost true]');
}

function parseNum(name, raw, def) {
  if (raw == null) return def;
  const v = Number(raw);
  if (!Number.isFinite(v)) throw new Error(`Invalid --${name} "${raw}"`);
  return v;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    usage();
    throw new Error('Missing ELEVENLABS_API_KEY');
  }

  const voiceId = getArg('voice-id', process.env.ELEVENLABS_VOICE_ID);
  const textFile = getArg('text-file', null);
  const outFile = getArg('out', null);

  if (!voiceId || !textFile || !outFile) {
    usage();
    throw new Error('Missing required args: --voice-id, --text-file, --out');
  }

  const modelId = getArg('model-id', process.env.ELEVENLABS_MODEL_ID || 'eleven_v3');
  const outputFormat = getArg('output-format', process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128');

  const stability = clamp01(parseNum('stability', getArg('stability', process.env.ELEVENLABS_STABILITY), 0.5));
  const similarityBoost = clamp01(parseNum('similarity', getArg('similarity', process.env.ELEVENLABS_SIMILARITY), 0.85));
  const style = clamp01(parseNum('style', getArg('style', process.env.ELEVENLABS_STYLE), 0.2));

  const speakerBoostRaw = getArg('speaker-boost', process.env.ELEVENLABS_SPEAKER_BOOST || 'true');
  const useSpeakerBoost = String(speakerBoostRaw).toLowerCase() !== 'false';

  const text = (await fs.readFile(textFile, 'utf8')).trim();
  if (!text) throw new Error(`Empty narration text: ${textFile}`);

  const url = new URL(`${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/stream`);
  url.searchParams.set('output_format', outputFormat);

  const body = {
    text,
    model_id: modelId,
    voice_settings: {
      stability,
      similarity_boost: similarityBoost,
      style,
      use_speaker_boost: useSpeakerBoost,
    },
  };

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS HTTP ${res.status}: ${errText.slice(0, 700)}`);
  }

  const ab = await res.arrayBuffer();
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, new Uint8Array(ab));

  console.log(`Wrote narration: ${outFile}`);
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});

