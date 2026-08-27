<div align="center">

<img src="https://cdn.discordapp.com/avatars/1472707869257367676/a_aa7dec778d53a895daadd74ddf7c9700.gif" width="120" height="120" style="border-radius: 50%"/>

# 🦅 ARCHON CG-223

**The Neural Architect — Multi-Platform Discord & Telegram Bot**

[![Discord](https://img.shields.io/badge/Discord-Eagle%20Community-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.gg/NFSMFJajp9)
[![Telegram](https://img.shields.io/badge/Telegram-archon223-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/architect223bot)
[![Dashboard](https://img.shields.io/badge/Dashboard-bamako--steel--dev.xyz-00f0ff?style=flat&logo=vercel&logoColor=white)](https://bamako-steel-dev.xyz)
[![Version](https://img.shields.io/badge/Version-v3.1.0-00ff88?style=flat)](#)
[![Servers](https://img.shields.io/badge/Servers-25+-f1c40f?style=flat)](#)
[![Made in Mali](https://img.shields.io/badge/Made%20in-Bamako%2C%20Mali%20🇲🇱-green?style=flat)](#)

*Built from scratch in Bamako, Mali — developed entirely from a phone via Termux + SSH*

</div>

---

## ✨ Features

### 🎮 Discord — 110 plugins · 86 slash commands

| Category | Highlights |
|----------|------------|
| 🧠 AI | Lydia — 28 languages, multi-agent, dynamic changelog |
| 💰 Economy | Credits, XP, daily rewards, shop, investments, duels |
| 🛡️ Moderation | AutoMod, warnings, tickets, audit logs, captcha |
| 🎵 Music | SoundCloud + YouTube fallback, queue, per-guild history |
| 📊 Dashboard | OAuth2 web panel at [bamako-steel-dev.xyz](https://bamako-steel-dev.xyz) |
| 🎉 Social | Giveaways, birthdays, welcome cards, AFK, auto-reply |
| 🏆 Rankings | Global & per-server leaderboards, profile cards |
| 🎮 Games | Trivia, Word Guess, Dice, Coin Flip, Duel |
| 🌍 i18n | EN / FR / BM / AR / ZH — per-server language setting |

### 📱 Telegram — 53 plugins

| Category | Highlights |
|----------|------------|
| 🎬 Media | YouTube, Instagram, Twitter/X, TikTok, Facebook, Snapchat, Vimeo |
| 🌍 Languages | EN, FR, Bamanankan, ZH — auto-detected per user |
| 👋 Welcome | GIF support, per-topic channel, auto-close |
| 🎮 Games | Trivia v3 — Mali / Africa / Tech / Gaming / General |
| 🖥️ System | /sysctl — PM2 restart, logs, monit from Telegram |
| 🔄 Updates | GitHub commit tracking with auto-broadcast |

### 🌐 Dashboard

- Discord OAuth2 login with guild isolation (IDOR-guarded)
- Server management — language, welcome/goodbye, leveling, automod
- Economy & XP settings per server
- Per-guild music stats and top tracks leaderboard
- User profiles with rank, XP, badges, economy stats

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 |
| Discord | Discord.js v14 |
| Telegram | Custom polling engine |
| Database | SQLite via better-sqlite3 |
| Dashboard | React + TypeScript + Tailwind + tRPC |
| API | Express + Hono |
| Hosting | Hetzner CPX22 VPS |
| Proxy | Nginx + Cloudflare |
| Process | PM2 |
| Media | yt-dlp + ffmpeg |
| Auth | Discord OAuth2 |

---

## 📊 Stats

| Metric | Value |
|--------|-------|
| Discord Plugins | 110 |
| Telegram Plugins | 53 |
| Slash Commands | 86 |
| Servers | 25+ |
| Users | 365+ |
| Languages | EN / FR / BM / AR / ZH |

---

## 🚀 Self-Hosting

### Prerequisites

- Node.js 20+
- Python 3.x (for patch scripts)
- ffmpeg + yt-dlp installed globally
- PM2 (`npm install -g pm2`)
- A Discord application + bot token from [discord.com/developers](https://discord.com/developers)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
CLIENT_SECRET=your_oauth2_secret
DASHBOARD_URL=http://localhost:3000
ANTHROPIC_API_KEY=your_key        # optional — powers Lydia AI
GUILD_ID=your_main_guild_id
API_ADMIN_SECRET=a_strong_secret  # secures admin API routes
```

---

### 🐧 Linux / VPS (Recommended)

```bash
git clone https://github.com/MFOF7310/archon-bot.git
cd archon-bot
npm install
cp .env.example .env
# fill in .env
node scripts/deploy-commands.js   # register slash commands
pm2 start index.js --name Architect-CG223
pm2 save
pm2 startup                       # auto-restart on reboot
```

---

### 📱 Termux (Android — no root required)

```bash
pkg update && pkg upgrade
pkg install nodejs python ffmpeg git
npm install -g pm2
git clone https://github.com/MFOF7310/archon-bot.git
cd archon-bot
npm install
cp .env.example .env
# edit .env with your preferred editor (nano, vim)
node scripts/deploy-commands.js
pm2 start index.js --name Architect-CG223
```

> ⚠️ yt-dlp must be installed separately on Termux:
> `pip install yt-dlp`

---

### 🪟 Windows

```bash
# Install Node.js 20 from https://nodejs.org
# Install Git from https://git-scm.com
git clone https://github.com/MFOF7310/archon-bot.git
cd archon-bot
npm install
copy .env.example .env
# edit .env in Notepad or VSCode
node scripts/deploy-commands.js
npm install -g pm2
pm2 start index.js --name Architect-CG223
```

> ⚠️ ffmpeg must be added to PATH manually. Download from [ffmpeg.org](https://ffmpeg.org/download.html).

---

### 🍎 macOS

```bash
brew install node ffmpeg git python3
pip3 install yt-dlp
npm install -g pm2
git clone https://github.com/MFOF7310/archon-bot.git
cd archon-bot
npm install
cp .env.example .env
node scripts/deploy-commands.js
pm2 start index.js --name Architect-CG223
```

---

### 🐳 Docker (coming soon)

Docker support is planned. For now use the Linux/VPS method on any Docker host.

---

### Deploying Slash Commands

After any plugin change, re-run:

```bash
node scripts/deploy-commands.js
```

Only plugins with a valid `SlashCommandBuilder` export are registered. The script logs each plugin as `✅ deployed` or `⏭️ skipped (prefix-only)`.

---

### Dashboard (Optional)

The React dashboard runs separately:

```bash
cd /path/to/dashboard
npm install
npm run build
pm2 start dist/boot.js --name architect-dashboard
```

Requires its own `.env` with `DATABASE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `SESSION_SECRET`.

---

## 🌍 About

ARCHON CG-223 is built by **Moussa Fofana** ([@MFOF7310](https://github.com/MFOF7310)) from **Bamako, Mali** 🇲🇱

- **Built entirely from a phone** — Samsung Galaxy Z Fold 5, Termux + SSH into Hetzner VPS
- **Not a fork** — built from scratch, every line written by hand
- **Dual platform** — Discord + Telegram from a single codebase
- **Production ready** — serving 25+ servers and 365+ users
- **Multilingual core** — EN / FR / Bamanankan / AR / ZH

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

🦅 **ARCHON CG-223** • BAMAKO_223 🇲🇱

*Neural Grid v3.1.0 — All systems nominal*

</div>

