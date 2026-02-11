#!/usr/bin/env bash
# Generate apple-touch-icon.png (180x180) from favicon.svg
# Requires: npx @resvg/resvg-js-cli or rsvg-convert or Inkscape
#
# Option 1 — resvg (npm, no native deps):
#   npx @aspect-build/resvg web/public/favicon.svg --width 180 --height 180 -o web/public/apple-touch-icon.png
#
# Option 2 — rsvg-convert (brew install librsvg):
#   rsvg-convert -w 180 -h 180 web/public/favicon.svg -o web/public/apple-touch-icon.png
#
# Option 3 — Inkscape:
#   inkscape web/public/favicon.svg -w 180 -h 180 -o web/public/apple-touch-icon.png

set -euo pipefail

SVG="web/public/favicon.svg"
OUT="web/public/apple-touch-icon.png"

if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 180 -h 180 "$SVG" -o "$OUT"
  echo "Generated $OUT via rsvg-convert"
elif command -v inkscape &>/dev/null; then
  inkscape "$SVG" -w 180 -h 180 -o "$OUT"
  echo "Generated $OUT via inkscape"
else
  echo "No SVG-to-PNG converter found."
  echo "Install librsvg: brew install librsvg"
  echo "Then re-run this script."
  exit 1
fi
