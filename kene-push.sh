#!/bin/bash
set -e
BRANCH=${2:-main}
MSG=${1:-"chore: Kene automated update"}

TOKEN=$(node /root/cloud-gaming-223-digital-engine/kene-token.js)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get GitHub App token"
    exit 1
fi

git -C /root/cloud-gaming-223-digital-engine \
    -c user.name="Kene-OpenClaw[bot]" \
    -c user.email="kene-openclaw[bot]@users.noreply.github.com" \
    -c "url.https://x-access-token:${TOKEN}@github.com/.insteadOf=git@github.com:" \
    push origin $BRANCH

echo "✅ Pushed to $BRANCH as Kene-OpenClaw[bot]"
