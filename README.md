☁️ CLOUD GAMING-223 DIGITAL ENGINE
​<div align="center">
​A high-performance, modular Discord bot framework optimized for cloud gamers, streamers, and low-latency connectivity.
​</div>

​📖 Overview
​Cloud Gaming-223 Digital Engine is a professional-grade Discord bot designed to bridge the gap between high-performance gaming and community engagement. Built with a modular 32-plugin architecture, it is specifically engineered for reliability on high-latency or satellite connections like Starlink.
​Developed by MFOF7310 in Bamako, Mali, the engine features an advanced AI integration (Lydia AI) and a robust persistent XP system, making it an ideal choice for community managers and competitive gaming servers.

​✨ Key Features
Feature Description Status
Lydia AI Groq-powered gaming expert specializing in CODM and intelligent conversation. ✅ Live
Brave Search Real-time web and image search integration directly within Discord. ✅ Live
XP System Global leveling and engagement tracking with persistent JSON storage. ✅ Live
Modular Core Plugin-based system allowing seamless addition of new features without core modification. ✅ Live
Starlink Optimized Built-in rate limiting and smart fallbacks for stable performance on satellite nets. ✅ Live
TikTok Monitor Real-time stream monitoring and automated notifications. 🔄 Dev

📁 Project Architecture
```​The engine uses a streamlined structure where core utilities (database, logger, rate-limiter) are integrated into the main entry point for maximum efficiency.
cloud-gaming-223-digital-engine/
├── index.js             # Core Engine & Utility Suite
├── database.json        # Persistent User Store (Auto-generated)
├── plugins/             # Extensible Command Modules
│   ├── lydia.js         # AI Integration
│   ├── top.js           # XP/Leaderboard Logic
│   ├── weather.js       # Global Weather Data
│   └── ...              # 30+ Additional Plugins
└── .env                 # Sensitive Configuration
```
🎮 Command Interface
​🤖 Lydia AI (Gaming Assistant)
​.lydia on/off — Toggle AI responsiveness in the current channel.
​.lydia status — View the current operational status of the AI.
​@Lydia [query] — Interact with the AI regarding gaming, loadouts, or general chat.
​🏆 Engagement & XP
​.rank — Display your current level, XP, and progress.
​.leaderboard — Show the top-performing members in the server.
​.level [@user] — Check the status of another community member.
​🛠️ Utilities & Search
​.search [query] — Fetch the top 5 web results via Brave Search.
​.weather [city] — Get real-time weather reports with local imagery.
​.gamestats [game] [player] — Retrieve statistics for titles like CODM or Valorant.
​.news [topic] — Aggregate the latest gaming and tech headlines.
​🚀 Quick Start
​Prerequisites
​Node.js v18.0.0 or higher.
​API Keys: Discord Bot Token, Groq API, Brave Search API, and Weather API.
​Installation
1. Clone & Enter:
```git clone https://github.com/MFOF7310/cloud-gaming-223-digital-engine.git
cd cloud-gaming-223-digital-engine
```
2. Dependencies:
```npm install```

3. Environment Setup:
Create a .env file and populate:
```env
DISCORD_TOKEN=your_token
GROQ_API_KEY=your_key
BRAVE_API_KEY=your_key
WEATHER_API_KEY=your_key
PREFIX=.
```