#!/bin/bash

# ╔══════════════════════════════════════════════════╗
# ║     ARCHITECT CG-223 • NEURAL ENGINE LAUNCHER    ║
# ║         BAMAKO_223 🇲🇱 • STARTUP PROTOCOL          ║
# ╚══════════════════════════════════════════════════╝

# ==================== CREATE REQUIRED FOLDERS ====================
echo "📁 Initializing directory structure..."
mkdir -p data logs backups

# ==================== CLEANUP OLD LOGS (7 DAYS) ====================
echo "🧹 Cleaning logs older than 7 days..."
find ./logs -name "*.log" -mtime +7 -delete 2>/dev/null

# ==================== START LOCALTUNNEL ====================
echo "🌐 Starting secure tunnel on port 20582..."
lt --port 20582 --subdomain archon-engine-api > /dev/null 2>&1 &
TUNNEL_PID=$!
echo "✅ Tunnel PID: ${TUNNEL_PID}"
sleep 2

# ==================== DISPLAY SYSTEM INFO ====================
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     🦅 ARCHITECT CG-223 • NEURAL ENGINE      ║"
echo "║         📍 NODE: BAMAKO_223 🇲🇱                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "📦 Node.js: $(node --version)"
echo "📁 Project: $(pwd)"
echo "🌐 Dashboard: https://archon-engine-api.loca.lt"
echo "🕐 Started: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ==================== AUTO-RESTART LOOP ====================
restart_count=0

while true
do
    restart_count=$((restart_count + 1))
    
    echo "🛰️ [START] Neural Engine v1.8.0 | Restart #${restart_count}"
    echo "──────────────────────────────────────────────"
    
    node index.js
    
    exit_code=$?
    
    echo ""
    echo "──────────────────────────────────────────────"
    echo "⚠️  Engine stopped (Exit code: ${exit_code})"
    echo "🔄 Restarting in 5 seconds..."
    sleep 5
    
    if [ $restart_count -gt 10 ]; then
        echo "🔴 Multiple crashes detected (${restart_count})"
        echo "⏳ Extended cooldown: 30 seconds..."
        sleep 30
        restart_count=0
    fi
    
    echo "🔄 Rebooting Neural Grid..."
    echo ""
done