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

# ==================== START TUNNEL ON PORT 3000 ====================
echo "🌐 Starting tunnel on port 3000..."
npx localtunnel --port 3000 2>&1 &
sleep 3
echo "🌐 Look above for: your url is: https://xxxx.loca.lt"
echo ""

# ==================== DISPLAY SYSTEM INFO ====================
echo "╔══════════════════════════════════════════════╗"
echo "║     🦅 ARCHITECT CG-223 • NEURAL ENGINE      ║"
echo "║         📍 NODE: BAMAKO_223 🇲🇱                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "📦 Node.js: $(node --version)"
echo "📁 Project: $(pwd)"
echo "🕐 Started: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ==================== AUTO-RESTART LOOP ====================
restart_count=0

while true
do
    restart_count=$((restart_count + 1))
    
    echo "🛰️ [START] Neural Engine v1.8.0 | Restart #${restart_count}"
    echo "──────────────────────────────────────────────"
    
    node index.js 2>&1 | tee -a logs/bot-$(date '+%Y-%m-%d').log
    
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