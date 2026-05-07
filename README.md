## 🦅 ARCHITECT CG-223 — THE SUPREME NEURAL GRID

<div align="center">
  <img src="https://img.shields.io/badge/ARCHITECT-CG--223-gold?style=for-the-badge" alt="ARCHITECT CG-223">
  <img src="https://img.shields.io/badge/Node-BAMAKO__223-2ecc71?style=for-the-badge" alt="BAMAKO_223">
  <img src="https://img.shields.io/badge/Version-v1.8.0-blue?style=for-the-badge" alt="v1.8.0">
  <br>
  <img src="https://img.shields.io/badge/Status-ONLINE-brightgreen?style=flat-square" alt="ONLINE">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/Platform-Discord.js_v14-5865F2?style=flat-square" alt="Discord.js">
</div>

---

## 📋 OVERVIEW

ARCHITECT CG-223 is an enterprise-grade, multi-server Discord bot with advanced per-server configuration, bilingual support (English/French), real-time threat intelligence, neural leveling, AI-powered conversations, and a competitive marketplace. Built for the Cloud Gaming-223 community in Bamako, Mali.

---

## 📛 NAMING CLARIFICATION

| Name | What It Refers To |
|------|-------------------|
| `cloud-gaming-223-digital-engine` | **GitHub Repository** |
| `ARCHITECT CG-223` | **Bot Display Name** (in Discord) |
| `BAMAKO_223` | **Node Name** (in logs & PM2) |
| `Cloud Gaming-223` | **Community/Server Name** |


## 🚀 QUICK START

# Prerequisites

· Node.js v18 or higher
· Discord Bot Token (Developer Portal)
· API Keys: OpenRouter/Groq, Google Gemini, Brave Search (optional)

## Installation

## bash
# 1. Clone the repository
```git clone https://github.com/MFOF7310/cloud-gaming-223-digital-engine.git
cd cloud-gaming-223-digital-engine```

# 2. Install dependencies
```npm install```

# 3. Configure environment
cp .env.example .env
```nano .env```

## Environment Variables

# env
# ================= REQUIRED =================
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_application_client_id
OWNER_ID=your_discord_user_id

# ================= AI APIs =================
OPENROUTER_API_KEY=your_openrouter_key_here    # Lydia AI
GEMINI_API_KEY=your_gemini_key_here            # Vision analysis
BRAVE_API_KEY=your_brave_search_key_here       # Web search (optional)

# ================= TELEGRAM BRIDGE =================
TELEGRAM_BOT_TOKEN=your_telegram_token_here    # Optional
TELEGRAM_CHAT_ID=your_chat_id_here             # Optional

# ================= OPTIONAL =================
PREFIX=.
GUILD_ID=your_main_server_id
WELCOME_CHANNEL_ID=channel_id
GOODBYE_CHANNEL_ID=channel_id
LOG_CHANNEL_ID=channel_id
RULES_CHANNEL_ID=channel_id
GENERAL_CHANNEL_ID=channel_id
MEMBER_ROLE=role_id
VIP_ROLE_ID=role_id
VERIFIED_ROLE_ID=role_id

## 🚀 Start the Bot

```bash
# Production (run once)
npm start

# Development with auto-restart on file changes
```npx nodemon index.js
```

# With PM2 (recommended for 24/7 production)
```npm install -g pm2
```
```pm2 start index.js --name "Architect-CG223"
```
```pm2 save
```
```pm2 startup
```

---

## 📁 PROJECT STRUCTURE

architect-cg223/
├── index.js                    # 🧠 Main neural engine (3300+ lines)
├── package.json                # Dependencies
├── .env                        # Environment variables
├── version.txt                 # Dynamic versioning
│
├── plugins/                    # Command modules
│   ├── lydia.js               # 🧠 Lydia AI (multi-agent)
│   ├── gemini.js              # 📸 Gemini Vision analysis
│   ├── market-manager.js      # 📊 Market trends engine
│   ├── afk.js                 # 💤 AFK system
│   ├── birthday.js            # 🎂 Birthday reminders
│   ├── automod.js             # 🛡️ Auto-moderation
│   ├── serversettings.js      # ⚙️ Per-server configuration
│   └── ...                    # 20+ more commands
│
├── telegram/                   # Telegram bridge
│   ├── bridge.js              # 🌉 Discord → Telegram
│   └── bot.js                 # 🤖 Telegram → Discord
│
├── data/                       # Auto-generated
│   ├── database.sqlite        # 💾 SQLite database
│   ├── changelog.md           # 📋 Auto-generated registry
│   └── .bot_state.json        # 📊 State tracking
│
└── README.md                   # This file

---

## 🎮 COMMANDS

## 🧠 AI Commands

Command Description
.lydia [message] Ask Lydia AI anything
@Lydia [question] Mention-based AI query
.gemini [question] Analyze with Gemini Vision
.gemini + image Analyze attached image

## ⚙️ Admin Commands

Command Description
.serversettings View/Edit per-server configuration
.serversettings view View all server settings
.serversettings set <setting> <value> Change a setting
.serversettings reset CONFIRM Reset to defaults
.serversettings export Export config as JSON
.lydia on/off Toggle Lydia AI per channel

## 👤 User Commands

Command Description
.help View available commands
.profile View your neural profile
.daily Claim daily rewards
.shop Browse the item shop
.rank Check your level rank
.leaderboard Server XP leaderboard
.afk [reason] Set AFK status
.credits / .balance Check your credits

## 🎮 Gaming Commands

Command Description
.gaming set <game> <rank> Set your gaming profile
.gaming profile View gaming stats

## 💰 Economy Commands

# Command Description
.shop buy <item> Purchase shop items
.shop inventory View your inventory
.transfer <@user> <amount> Transfer credits
.invest <amount> Invest in the market
.market View market trends

---

## 🛡️ SECURITY INTELLIGENCE SYSTEM

The GUARDIAN OSINT v3.0 engine analyzes every new member across 6 threat vectors:

## Vector Detection
🔴 Account Age <24h (40pts), <3d (30pts), <7d (20pts)
⚠️ Default Avatar Possible bot/troll (15pts)
🔢 Username Patterns Numeric-only, suspicious keywords, impersonation
🌊 Join Velocity Raid detection (5+ joins/60s = 25pts)
🎯 Server Targeting New account targeting old server (10pts)
🤖 Unverified Bot Bot without verification (20pts)

## Risk Classification

Score Level Action
0-14 🟢 LOW Routine processing
15-29 🟡 ELEVATED Standard monitoring
30-49 🟠 MEDIUM Active surveillance
50-69 🔴 HIGH Heightened surveillance, mod alert
70+ ⛔ CRITICAL Auto-quarantine, DM owner

---

## ⚙️ PER-SERVER CONFIGURATION (47 SETTINGS)

# Each server can customize:

## Category Settings
🏠 General Prefix, Language, Timezone
👋 Welcome Channel, Message, Enable/Disable
👋 Goodbye Channel, Message, Enable/Disable
📈 Leveling XP Multiplier, Cooldown, Min/Max Gain, Level Channel
💰 Economy Starting Balance, Max Daily Streak, Market Enable
🛡️ Moderation Spam Threshold, Mention Limit, Max Warnings, Action
🤖 Features AFK, AI, Auto-Mod, Link Filter, Invite Filter
👤 Roles Member, Auto, Mute, Join roles
📡 Channels Rules, General, Daily, Shop, Market, Log, Mod Log

---

## 💾 DATABASE ARCHITECTURE

```
📊 SQLite (WAL Mode)
├── PRAGMA synchronous = NORMAL
├── PRAGMA cache_size = -64000
├── PRAGMA temp_store = MEMORY
├── Circuit Breaker (5 failures → 60s cooldown)
├── Batch Writes (50 updates/batch)
├── Dead Letter Queue (1000 max)
├── Cache Janitor (30min cleanup, 1h TTL)
└── Weekly Auto-Purge (Sunday 3AM UTC)

Tables:
├── users                  # XP, level, credits, streaks
├── server_settings        # 47 per-server configs
├── security_intel         # Threat history database
├── lydia_conversations    # AI chat history
├── lydia_memory          # AI memory storage
├── shop_items            # Economy items
├── user_inventory        # Player inventories
├── investments           # Market investments
├── reminders             # User reminders
├── warnings              # Moderation warnings
├── moderation_logs       # Action history
├── birthdays             # Birthday registry
├── transfers             # Credit transfers
├── server_backups        # Server backups
└── user_links            # Telegram bridge links
```

---

## 🚀 DEPLOYMENT OPTIONS

# Option 1: Bot-Hosting.net (FREE) ✅

# 1. Create ZIP with: index.js, package.json, plugins/, .env
# 2. Upload to Bot-Hosting.net
# 3. Set start command: node index.js
# 4. Click Start

Free Tier: 24/7 Uptime, 100MB RAM, 500MB Storage

### Option 2: PM2 on VPS (Recommended)

> **You'll need:** A VPS (Virtual Private Server) from providers like:
> - [DigitalOcean](https://digitalocean.com) ($6/month)
> - [Hetzner](https://hetzner.com) (~$4/month)
> - [Vultr](https://vultr.com) ($6/month)
> - [OVHcloud](https://ovhcloud.com)

## bash
# 1. SSH into your VPS
# Replace 'user' with your VPS username and 'your-server-ip' with your server IP
# Example: ssh root@192.168.1.100
```ssh user@your-server-ip
```

# 2. Update system packages
```sudo apt update && sudo apt upgrade -y
```

# 3. Install Node.js 18+
```curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

# 4. Verify installation
```node --version
npm --version
```

# 5. Clone repository & setup
```git clone https://github.com/MFOF7310/cloud-gaming-223-digital-engine.git
cd cloud-gaming-223-digital-engine
npm install
```

# 6. Configure environment variables
```nano .env
```

# Paste your tokens, then CTRL+X → Y → ENTER to save

# 7. Install PM2 globally
```npm install -g pm2
```

# 8. Start the bot with PM2
```pm2 start index.js --name "Architect-CG223"
```

# 9. Save PM2 process list (auto-restart on reboot)
```pm2 save
```

# 10. Enable PM2 startup on system boot
```pm2 startup
```

# Copy and run the command it outputs


## Option 3: Render / Heroku

# bash
# Add environment variables in dashboard
# Build: npm install
# Start: node index.js

---

## ⚙️ ENVIRONMENT VARIABLES REFERENCE

Variable Required Default Description
DISCORD_TOKEN ✅ - Discord bot token
CLIENT_ID ✅ - Application client ID
OWNER_ID ✅ - Your Discord user ID
OPENROUTER_API_KEY ✅ - AI API for Lydia
GEMINI_API_KEY ✅ - Google Gemini for Vision
BRAVE_API_KEY ❌ - Web search capability
TELEGRAM_BOT_TOKEN ❌ - Telegram bridge
TELEGRAM_CHAT_ID ❌ - Target chat ID
PREFIX ❌ . Command prefix
GUILD_ID ❌ - Main server ID
WELCOME_CHANNEL_ID ❌ - Welcome messages
GOODBYE_CHANNEL_ID ❌ - Goodbye messages
LOG_CHANNEL_ID ❌ - Security intel logs
MEMBER_ROLE ❌ - Auto-assign role

---

## 🔧 TROUBLESHOOTING

Issue Solution
"Neural link interrupted" Check OPENROUTER_API_KEY in .env
Bot won't start Verify DISCORD_TOKEN and CLIENT_ID are set
Commands not responding Bot needs MESSAGE CONTENT INTENT enabled
Database locked errors Circuit breaker activates; wait 60 seconds
Welcome messages not sending Set welcome_channel in server settings
Memory usage high Cache janitor runs every 30min; reduce CACHE_CONFIG.MAX_AGE_MS

---

## 📱 CONNECT WITH THE ARCHITECT

Platform Link
🔵 Facebook Official Page
📱 TikTok @cloudgaming223
📸 Instagram @mfof7310
💬 WhatsApp +1 548 520 0518
🐙 GitHub MFOF7310

---

## 📜 LICENSE

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 CREDITS

· Architect: Moussa Fofana (CG-223)
· Community: Cloud Gaming-223 🇲🇱
· Node: BAMAKO_223
· Powered by: Discord.js v14, Groq AI, Google Gemini, SQLite (WAL)

---

<div align="center">
  <b>🏗️ Built with neural precision in Bamako, Mali 🇲🇱</b><br>
  <img src="https://img.shields.io/badge/Cloud_Gaming--223-Official-blue?style=for-the-badge" alt="Cloud Gaming-223">
  <br>
  <sub>✅ Bot-Hosting.net Compatible • ✅ PM2 Ready • ✅ 24/7 Uptime</sub>
  <br><br>
  <i>"The grid adapts. The grid survives. The grid prevails."</i>
</div>
```