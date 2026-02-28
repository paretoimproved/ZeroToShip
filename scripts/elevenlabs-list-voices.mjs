#!/usr/bin/env node
/* eslint-disable no-console */

const API_BASE = 'https://api.elevenlabs.io/v1';

function usage() {
  console.log('Usage: ELEVENLABS_API_KEY=... node scripts/elevenlabs-list-voices.mjs');
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    usage();
    throw new Error('Missing ELEVENLABS_API_KEY');
  }

  const res = await fetch(`${API_BASE}/voices?show_legacy=true`, {
    headers: { 'xi-api-key': apiKey },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ElevenLabs voices HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = JSON.parse(text);
  const voices = Array.isArray(json.voices) ? json.voices : [];

  console.log('name\tvoice_id\tcategory');
  for (const v of voices) {
    console.log(`${v.name ?? ''}\t${v.voice_id ?? ''}\t${v.category ?? ''}`);
  }
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});

