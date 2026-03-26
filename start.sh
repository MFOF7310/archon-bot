#!/bin/bash

# --- CLOUD GAMING-223 | AUTO-RESTART SYSTEM ---
echo "🛰️ Starting Digital Engine V1.1..."

while true
do
    # Run the bot
    node index.js

    # If the bot crashes or stops, wait 5 seconds and restart
    echo "⚠️ Engine stopped or crashed! Restarting in 5 seconds..."
    sleep 5
    echo "🔄 Rebooting System..."
done
