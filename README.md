## 🤖 Cloud Gaming-223 Bot

## ✨ Features

## Feature Description
🎮 Lydia AI Gaming expert specializing in CODM, with smart fallback responses
📸 Gemini Vision Analyze images, screenshots, and pictures
⭐ XP System Level up by chatting in the server
👋 Welcome Messages Auto-greet new members with styled embeds
🔒 Admin Controls Toggle AI features per channel
⏱️ Rate Limiting Prevents spam (3s cooldown)
📊 Database Persistent storage for user XP and levels

## 🚀 Quick Start

Prerequisites

· Node.js v18 or higher
· Discord Bot Token
· Groq API Key
· Google Gemini API Key

Installation

## 1. Clone the repository
   ```bash
   git clone https://github.com/MFOF7310/cloud-gaming-223-bot.git
   cd cloud-gaming-223-bot
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
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Optional (with defaults)
   PREFIX=.
   OWNER_ID=your_discord_user_id
   WELCOME_CHANNEL_ID=channel_id_for_welcome_messages
   ```
## 4. Start the bot
   ```bash
   npm start
   ```
   Or for development with auto-restart:
   ```bash
   npm install -g nodemon
   nodemon index.js
   ```

## 📁 Project Structure

```
cloud-gaming-223-bot/
├── index.js                 # Main bot engine
├── package.json            # Dependencies and scripts
├── .env                    # Environment variables
├── database.json           # User XP database (auto-generated)
├── plugins/                # Command modules
│   ├── lydia.js           # Lydia AI toggle command
│   ├── gemini.js          # Gemini image analysis
│   └── ...                # Other commands
└── README.md              # This file
```

## 🎮 Commands

Lydia AI (Gaming Assistant)

## Command Description
.lydia on Enable Lydia AI in current channel
.lydia off Disable Lydia AI in current channel
@Lydia [question] Ask Lydia anything (gaming, CODM, general)

## Gemini Vision (Image Analysis)

## Command Description
.gemini [question] Ask Gemini with or without image
.gemini + (attached image) Analyze the attached image
Reply to image with .gemini Analyze the replied image

## Examples

```
📸 .gemini What's in this screenshot? [attach image]
🎮 @Lydia best BP50 loadout for ranked
📢 .lydia on
❓ @Lydia when is next CODM update?
```

## 🛠️ Configuration

## Discord Developer Portal Setup

## 1. Go to Discord Developer Portal
## 2. Create a new application and bot
#@ 3. Enable these Privileged Gateway Intents:
   · ✅ MESSAGE CONTENT INTENT
   · ✅ SERVER MEMBERS INTENT
   · ✅ GUILD MESSAGES INTENT

## Bot Invite Link

## Generate invite link with these permissions:

· Send Messages
· Read Message History
· Attach Files
· Mention Everyone
· Add Reactions

## 📊 Database

User XP is stored in database.json:

```json
{
  "userId": {
    "name": "username",
    "xp": 1250,
    "level": 2,
    "gaming": {
      "game": "CODM",
      "rank": "Legendary"
    }
  }
}
```

## 🚀 Deployment Options

## Option 1: Deploy on Bot-Hosting.net (FREE) ✅

Bot-Hosting.net offers free Discord bot hosting with 24/7 uptime, perfect for this bot!

## Step 1: Prepare Your Files

Create a ZIP archive containing:

· index.js
· package.json
· package-lock.json (if exists)
· plugins/ folder (with all command files)
· .env file (IMPORTANT: Include this with your API keys)

## Step 2: Create Bot-Hosting.net Account

1. Go to Bot-Hosting.net
2. Click "Register" and create an account
3. Verify your email
4. Log in to the dashboard

## Step 3: Create New Bot

1. Click "Create a Bot" or "New Bot" on the dashboard
2. Fill in the details:
   · Bot Name: Cloud Gaming-223 Bot
   · Description: AI bot with gaming expertise and image analysis
   · Start Command: npm start (or node index.js)
   · Bot Type: Node.js

## Step 4: Upload Files

1. Upload your ZIP file containing all bot files
2. The system will automatically extract it
3. Wait for the upload to complete

## Step 5: Configure Environment Variables

Bot-Hosting.net will automatically read your .env file, but you can also add/edit them in the dashboard:

· Go to "Environment Variables" tab
· Verify all your keys are there:
  · DISCORD_TOKEN
  · GROQ_API_KEY
  · GEMINI_API_KEY
  · PREFIX (optional)
  · OWNER_ID (optional)
  · WELCOME_CHANNEL_ID (optional)

## Step 6: Start the Bot

1. Click "Start" button
2. Watch the logs to confirm it's running
3. You should see: 🛰️ ARCHITECT CG-223 | MODULE SYNCHRONIZATION

## Step 7: Keep Bot Online

· Free tier runs 24/7 automatically
· Bot restarts if it crashes
· You can monitor CPU/RAM usage in dashboard

Bot-Hosting.net Free Tier Limits:

· ✅ 24/7 Uptime
· ✅ 100MB RAM
· ✅ 500MB Storage
· ✅ 1 CPU Core
· ✅ Perfect for small to medium Discord servers

---

## Option 2: Deploy on Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect repository
4. Set build command: npm install
5. Set start command: node index.js
6. Add environment variables

## Option 3: Deploy on Heroku

```bash
heroku create your-bot-name
heroku config:set DISCORD_TOKEN=your_token
heroku config:set GROQ_API_KEY=your_key
heroku config:set GEMINI_API_KEY=your_key
git push heroku main
```

## Option 4: Deploy on VPS (Ubuntu)

```bash
# Connect to your VPS via SSH
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Clone repository
git clone https://github.com/MFOF7310/cloud-gaming-223-bot.git
cd cloud-gaming-223-bot

# Install dependencies
npm install

# Create .env file with your keys
nano .env

# Use PM2 to keep bot running 24/7
npm install -g pm2
pm2 start index.js --name "cloud-gaming-bot"
pm2 save
pm2 startup
```

## ⚙️ Environment Variables

Variable Required Default Description
DISCORD_TOKEN ✅ - Your Discord bot token
GROQ_API_KEY ✅ - Groq API key for Lydia AI
GEMINI_API_KEY ✅ - Google Gemini API key for vision
PREFIX ❌ . Command prefix
OWNER_ID ❌ - Discord user ID for owner alerts
WELCOME_CHANNEL_ID ❌ - Channel for welcome messages

### 🚨 Troubleshooting 

Common Issues

"Neural link interrupted"

· Check Groq API key in .env
· Rate limit hit - wait 3 seconds between questions

Gemini not analyzing images

· Ensure axios is installed: npm install axios
· Check file is actually an image (JPEG, PNG, GIF)

Commands not working

· Verify bot has proper intents enabled
· Check command prefix (default: .)

Bot-Hosting.net Specific Issues

· Bot won't start: Check logs in dashboard for errors
· Environment variables not loading: Verify .env file is in the ZIP root
· Out of memory: Free tier has 100MB limit - optimize code if needed
· Bot stops responding: Check if rate limits are being hit

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Credits

· Developer: Architect (CG-223)
· Community: Cloud Gaming-223 🇲🇱
· Powered by: Groq AI, Google Gemini, Discord.js

## 📞 Support

For issues or questions:

· Open an issue on GitHub
· Contact @Architect in Cloud Gaming-223 Discord

---

<div align="center">
  <b>Made with ❤️ in Bamako, Mali</b><br>
  <img src="https://img.shields.io/badge/Cloud_Gaming--223-Official-blue?style=for-the-badge" alt="Cloud Gaming-223">
  <br>
  <sub>✅ Optimized for Bot-Hosting.net free tier • 24/7 Uptime</sub>
</div>
```

## 🎯 Key Bot-Hosting.net Features Added:

Section What It Covers
Step-by-step guide Create account → Upload ZIP → Start bot
File preparation What to include in your ZIP
Environment variables How to set them in dashboard
Free tier limits RAM, storage, CPU specs
Troubleshooting Common Bot-Hosting.net issues

## 📝 Quick Tips for Bot-Hosting.net:

1. Always include .env in your ZIP - This saves time setting up variables
2. Keep ZIP under 50MB - Free tier has storage limits
3. Monitor logs - Dashboard shows real-time errors
4. Use npm start - Ensure your package.json has the start script


· ✅ Bot-Hosting.net (FREE, easiest)
· ✅ Render
· ✅ Heroku
· ✅ VPS (Ubuntu)


## 📱 Connect With The Architect

| Platform | Link |
|----------|------|
| 🔵 **Facebook** | [Official Page](https://www.facebook.com/share/17KysmJrtm/) |
| 📱 **TikTok** | [@cloudgaming223](https://www.tiktok.com/@cloudgaming223) |
| 📸 **Instagram** | [@mfof7310](https://www.instagram.com/mfof7310) |
| 💬 **WhatsApp** | [+1 548 520 0518](https://wa.me/15485200518) |

**📍 Node Location:** Bamako, Mali 🇲🇱