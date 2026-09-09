#!/bin/bash
set -e

BRANCH=${2:-main}
MSG=${1:-"chore: Kene automated update"}
BASE="/root/cloud-gaming-223-digital-engine"
LOG="$BASE/kene-push.log"

log() { echo "[$(date -Iseconds)] $1" >> "$LOG"; }

log "Push started — branch: $BRANCH, msg: $MSG"

# Generate token
TOKEN=$(node "$BASE/kene-token.js" 2>>"$LOG")

if [ -z "$TOKEN" ]; then
    log "❌ Token generation failed"
    echo "❌ Failed to get GitHub App token"
    exit 1
fi

log "Token OK"

# Push with bot identity
git -C "$BASE" \
    -c user.name="Kene-OpenClaw[bot]" \
    -c user.email="kene-openclaw[bot]@users.noreply.github.com" \
    -c "url.https://x-access-token:${TOKEN}@github.com/.insteadOf=git@github.com:" \
    push origin "$BRANCH" 2>>"$LOG"

log "✅ Pushed to $BRANCH"
echo "✅ Pushed to $BRANCH as Kene-OpenClaw[bot]"
