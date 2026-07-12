#!/bin/bash
# ═══ ARCHON Termux Setup — One command restore 🇲🇱 ═══
echo "🦅 Installing ARCHON Termux config..."
cp colors.properties ~/.termux/
cp termux.properties ~/.termux/
cp font.ttf ~/.termux/
cat bashrc >> ~/.bashrc
termux-reload-settings
echo "✅ Done! Restart Termux to apply."
