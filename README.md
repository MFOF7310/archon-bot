☁️ CLOUD GAMING-223 DIGITAL ENGINE

<div align="center">

High-performance modular Discord bot framework designed for cloud gamers and streamers
---

## 📁 Project Structure

```
cloud-gaming-223-digital-engine/
├── index.js                 # Main bot engine
├── package.json            # Dependencies and scripts
├── .env                    # Environment variables
├── database.json           # User XP database (auto-generated)
├── plugins/                # Command modules
│   ├── lydia.js           # Lydia AI (Groq-powered)
│   ├── top.js              # XP and leveling system
│   ├── weather.js         # Weather information
│   ├── news.js            # News feed
│   ├── stats.js       # Game statistics
│   ├── help.js            # Help command
│   ├── ping.js            # Latency checker
│   ├── userinfo.js        # User information
│   └── ...                # Additional plugins
└── README.md              # This file
```

### Note: All core utilities (database, logger, rate limiter) are built directly into index.js — no separate lib/ folder.

---

## 🎮 Commands

Lydia AI (Gaming Assistant)

Command Description
.lydia on Enable Lydia AI in current channel
.lydia off Disable Lydia AI in current channel
@Lydia [question] Ask Lydia about gaming, CODM, etc.

## XP System

Command Description
.rank Check your XP and level
.leaderboard View server leaderboard
---

## 🎯 About

Cloud Gaming-223 Digital Engine is a professional Discord bot framework built for the gaming community, with a focus on cloud gaming and streamers. Created by MFOF7310 in Bamako, Mali, this bot is specifically optimized for Starlink satellite internet connectivity, ensuring reliable performance even in regions with variable network conditions.

The bot features a modular 32-plugin architecture that allows for easy extensibility, scalability, and maintainability. Whether you're a cloud gamer, streamer, or community manager, this bot provides the tools you need to engage your audience.

---

## ✨ Features

Feature Description Status
🎮 Lydia AI Gaming expert specializing in CODM (Call of Duty: Mobile) with intelligent fallback responses ✅ Live
🔍 Brave Search Web search integration powered by Brave Search API ✅ Live
⭐ XP System Level up by chatting and engaging in your server ✅ Live
👋 Welcome Messages Auto-greet new members with styled, customizable embeds ✅ Live
🔒 Admin Controls Toggle AI features per channel with granular permissions ✅ Live
⏱️ Rate Limiting Prevent spam with intelligent cooldown system (3s default) ✅ Live
📊 Persistent Database JSON-based storage for user XP, levels, and gaming preferences ✅ Live
🌤️ Weather Updates Real-time weather information for any location ✅ Live
📰 News Feed Latest gaming and tech news aggregation ✅ Live
🎮 Game Stats Player statistics for popular games (CODM, Valorant, etc.) ✅ Live
📱 TikTok Monitor Live stream monitoring and notifications 🔄 In Development

---


## Plugin System Logic

Each plugin follows a standardized structure:

```javascript
// Example plugin structure
module.exports = {
  name: 'commandName',
  description: 'What the command does',
  aliases: ['alt1', 'alt2'],
  usage: '.command [args]',
  cooldown: 3, // seconds
  permissions: ['SendMessages'],
  async execute(message, args, client) {
    // Plugin logic here
  }
}
```

## AI Integration Logic

Lydia AI (Groq-Powered):

· Uses Groq API with Llama-based models
· Specialized gaming knowledge with CODM expertise
· Smart fallback responses when API is unavailable
· Context-aware conversation handling
· Rate-limited to prevent abuse (3-second cooldown)

## Brave Search:

· Web search via Brave Search API
· Returns formatted results with titles, descriptions, and URLs
· Configurable result count (default: 5)
· Safe search filtering

## Database Logic

The bot uses a simple JSON-based database (database.json) for persistent storage:

```javascript
{
  "userId": {
    "name": "username",
    "discriminator": "1234",
    "xp": 1250,
    "level": 2,
    "totalMessages": 342,
    "lastSeen": "2026-03-28T10:30:00Z",
    "gaming": {
      "primaryGame": "CODM",
      "rank": "Legendary",
      "preferences": {
        "loadout": "BP50 Aggressive",
        "sensitivity": "High"
      }
    },
    "settings": {
      "aiEnabled": true,
      "notifications": true
    }
  }
}
```

## XP Calculation Logic:

· Each message: +15-25 XP (randomized)
· Voice activity: +5 XP per minute
· Level formula: level = Math.floor(0.1 * Math.sqrt(xp))
· Level-up messages with rewards

---

## 🎮 Commands

### Lydia AI (Gaming Assistant)

Command Description Example
.lydia on Enable Lydia AI in current channel .lydia on
.lydia off Disable Lydia AI in current channel .lydia off
.lydia status Check Lydia AI status .lydia status
@Lydia [question] Ask Lydia anything about gaming @Lydia best BP50 loadout for ranked

Brave Search

Command Description Example
.search [query] Search the web .search CODM season 6
.image [query] Search for images .image legendary operator

XP System

Command Description Example
.rank Check your rank and XP .rank
.leaderboard View server leaderboard .leaderboard
.level [@user] Check another user's level .level @player

## Weather System

Command Description Example
.weather Plus any country in the world with cities images and weather info

## Utility Commands

Command Description Example
.weather [city] Get weather information .weather Bamako
.news [topic] Get latest news .news gaming
.gamestats [game] [player] Get player statistics .gamestats CODM MFOF7310
.ping Check bot latency .ping
.userinfo [@user] Display user information .userinfo @member

Admin Commands

Command Description Example
.setwelcome [#channel] Set welcome message channel .setwelcome #welcome
.setprefix [prefix] Change command prefix .setprefix !
.toggleai [#channel] Toggle AI in specific channel .toggleai #bot-commands

---

## 🚀 Quick Start

Prerequisites

· Node.js v18 or higher
· Discord Bot Token from Discord Developer Portal
· Groq API Key from Groq Console
· Brave Search API Key from Brave Search API

### Installation

## 1. Clone the repository

```bash
git clone https://github.com/MFOF7310/cloud-gaming-223-digital-engine.git
cd cloud-gaming-223-digital-engine
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Create a .env file in the root directory:

```env
# Required
DISCORD_TOKEN=your_discord_bot_token_here
GROQ_API_KEY=your_groq_api_key_here
WEATHER_API_KEY=your_weather_api_key_here
BRAVE_API_KEY=your_brave_search_api_key_here

# Optional (with defaults)
PREFIX=.
OWNER_ID=your_discord_user_id
WELCOME_CHANNEL_ID=channel_id_for_welcome_messages
LOG_CHANNEL_ID=channel_id_for_bot_logs_channel
COOLDOWN_SECONDS=3
```

## 4. Start the bot

```bash
npm start
```

## For development with auto-restart:

```bash
npm install -g nodemon
nodemon index.js
```

## Discord Developer Portal Setup

### 1. Go to Discord Developer Portal
### 2. Create a new application and bot
### 3. Enable these Privileged Gateway Intents:
   · ✅ MESSAGE CONTENT INTENT
   · ✅ SERVER MEMBERS INTENT
   · ✅ GUILD MESSAGES INTENT

Bot Invite Link Generation

Generate invite link with these permissions:

· Send Messages
· Read Message History
· Attach Files
· Embed Links
· Use Slash Commands
· Connect (for voice/music)
· Speak (for voice/music)

---

## 🚢 Deployment Options

Option 1: Deploy on Bot-Hosting.net (FREE) ✅

Free tier includes: 24/7 uptime, 100MB RAM, 500MB storage, 1 CPU core

Step-by-step:

## 1. Prepare your files - Create a ZIP archive containing:
   · index.js
   · package.json
   · package-lock.json
   · plugins/ folder (all command files)
   · .env file (with all API keys)
   · database.json (optional, will be created automatically)
2. Create account at Bot-Hosting.net
3. Create new bot:
   · Bot Name: Cloud Gaming-223
   · Start Command: npm start
   · Bot Type: Node.js
4. Upload your ZIP file
5. Verify environment variables in the dashboard
6. Start the bot

## Option 2: Deploy on Render

```bash
# Push to GitHub first, then:
# Create new Web Service → Connect repo → Configure:
Build Command: npm install
Start Command: node index.js
# Add environment variables in dashboard
```

## Option 3: Deploy on VPS (Ubuntu)

```bash
# Connect to VPS
ssh user@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# Clone and setup
git clone https://github.com/MFOF7310/cloud-gaming-223-digital-engine.git
cd cloud-gaming-223-digital-engine
npm install

# Set up PM2 for persistence
npm install -g pm2
pm2 start index.js --name "cg223-bot"
pm2 save
pm2 startup
```

---

## ⚙️ Configuration

Environment Variables

Variable Required Default Description
DISCORD_TOKEN ✅ - Your Discord bot token
GROQ_API_KEY ✅ - Groq API key for Lydia AI
BRAVE_API_KEY ✅ - Brave Search API key
PREFIX ❌ . Command prefix
OWNER_ID ❌ - Discord user ID for owner alerts
WELCOME_CHANNEL_ID ❌ - Channel for welcome messages
MUSIC_DEFAULT_VOLUME ❌ 50 Default music volume (0-100)
COOLDOWN_SECONDS ❌ 3 Rate limit cooldown in seconds

Rate Limiting Logic

The bot implements a per-user, per-command cooldown system:

· Default: 3 seconds between commands
· Prevents spam and API abuse
· Users receive feedback when rate-limited
· Cooldown can be configured per command or globally

---

## 🔌 Plugin Development

Creating a New Plugin

Create a new file in the plugins/ folder following this template:

```javascript
// plugins/example.js
module.exports = {
  name: 'example',
  description: 'Example command',
  aliases: ['ex', 'demo'],
  usage: '.example [text]',
  cooldown: 5,
  permissions: ['SendMessages'],
  async execute(message, args, client) {
    const input = args.join(' ') || 'Hello World!';
    
    // Access database
    const db = client.database;
    const userData = await db.getUser(message.author.id);
    
    // Send response
    await message.reply(`You said: ${input}`);
  }
};
```

## Plugin Registration

The main bot (index.js) automatically loads all .js files from the plugins/ folder on startup. No manual registration needed!

Best Practices

1. Error handling - Always wrap logic in try-catch
2. Rate limiting - Respect the cooldown system
3. Async operations - Use async/await for database calls
4. Logging - Use the built-in logger utility
5. Permissions - Check user permissions before executing

---

## 📊 Database Structure

User Schema

```javascript
{
  "userId": {
    "name": "string",
    "discriminator": "string",
    "xp": "number",
    "level": "number",
    "totalMessages": "number",
    "voiceMinutes": "number",
    "lastSeen": "ISO date string",
    "lastDaily": "ISO date string",
    "gaming": {
      "primaryGame": "string",
      "rank": "string",
      "preferences": "object"
    },
    "settings": {
      "aiEnabled": "boolean",
      "notifications": "boolean",
      "prefix": "string"
    }
  }
}
```

## Database Operations

```javascript
// Get user data
const user = await db.getUser(userId);

// Update XP
await db.addXP(userId, amount);

// Set user preference
await db.setPreference(userId, key, value);

// Get leaderboard
const leaderboard = await db.getLeaderboard(guildId, limit);
```

---

## 🔧 Troubleshooting

Common Issues

Issue Cause Solution
"Neural link interrupted" Groq API error or rate limit Check API key, wait 3 seconds between requests
Commands not responding Intents not enabled Enable MESSAGE CONTENT, SERVER MEMBERS, GUILD MESSAGES intents
Music won't play Missing voice permissions Ensure bot has Connect and Speak permissions
Database not saving Permission issues Check write permissions for database.json
Bot offline on Bot-Hosting.net Memory limit exceeded Free tier has 100MB limit, optimize code

Debug Mode

Enable debug logging by setting environment variable:

```env
DEBUG=true
```

This will output detailed logs to the console.

---

## 📝 Version History

Current version: 1.1.0 (March 27, 2026)

See version.txt for detailed version history.

---

## 🙏 Credits

Component Technology
Bot Framework Discord.js v14
AI Engine Groq API (Llama-based models)
Search Brave Search API
Gemini 
Hosting Bot-Hosting.net (free tier optimized)

---

## 📱 Connect with the Architect

<div align="center">

Platform Link
🔵 GitHub @MFOF7310
📸 Instagram @mfof7310
📱 TikTok @cloudgaming223
💬 Discord Eagle Community
🔵 Facebook Official Page

📍 Based in: Bamako, Mali 🇲🇱
🌐 Optimized for: Starlink connectivity

</div>

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">

Made with ❤️ in Bamako, Mali

Optimized for Bot-Hosting.net free tier • 24/7 Uptime • Cloud Gaming-223 Digital Engine

Report Bug · Request Feature

</div>

---
