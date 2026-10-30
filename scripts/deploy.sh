#!/bin/sh
# Dev deploy: build, pack, copy to the Deck, install through Decky's own installer (needs the
# CEF debug tunnel: ssh -N -L 8081:localhost:8080 $DECK). DECK=deck@<ip> scripts/deploy.sh
set -e
: "${DECK:?set DECK=deck@<ip>}"
cd "$(dirname "$0")/.."
npx -y pnpm@9 build >/dev/null
ZIP=$(python scripts/pack.py)
scp -q "$ZIP" "$DECK:/tmp/Lyrenne.zip"
node scripts/cdp.mjs SharedJSContext @scripts/install.js
sleep 1
node scripts/cdp.mjs "Big Picture" @scripts/dismiss-prompt.js
