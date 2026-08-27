<div align="center">

<img src="https://cdn.discordapp.com/avatars/1472707869257367676/a_aa7dec778d53a895daadd74ddf7c9700.gif" width="120" height="120" style="border-radius: 50%"/>

# 🦅 ARCHON CG-223

**The Neural Architect — Multi-Platform Discord & Telegram Bot**

[![Discord](https://img.shields.io/badge/Discord-Eagle%20Community-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.gg/NFSMFJajp9)
[![Telegram](https://img.shields.io/badge/Telegram-archon223-26A5E4?style=flat&logo=telegram&logoColor=white)](https://t.me/architect223bot)
[![Dashboard](https://img.shields.io/badge/Dashboard-Live-00f0ff?style=flat&logo=vercel&logoColor=white)](https://bamako-steel-dev.xyz)
[![Version](https://img.shields.io/badge/Version-v3.1.0-00ff88?style=flat)](#)
[![Servers](https://img.shields.io/badge/Servers-25+-f1c40f?style=flat)](#)
[![Users](https://img.shields.io/badge/Users-365+-ff6b6b?style=flat)](#)
[![Made in Mali](https://img.shields.io/badge/Made%20in-Bamako%2C%20Mali%20🇲🇱-green?style=flat)](#)

*Built from scratch in Bamako, Mali — developed entirely from a phone via Termux + SSH*

</div>

---

## ✨ Features

### 🎮 Discord — 110 plugins · 86 slash commands

<details>
<summary><b>🧠 AI & Language</b></summary>

- Lydia AI — 28 languages, multi-agent system, dynamic changelog reader
- Per-server language setting: EN / FR / BM / AR / ZH
- Auto-detected locale fallback

</details>

<details>
<summary><b>💰 Economy & Progression</b></summary>

- Credits, XP, daily rewards, investments, duels
- Shop, inventory, loadouts, custom roles
- Per-server leveling config via dashboard

</details>

<details>
<summary><b>🛡️ Moderation</b></summary>

- AutoMod with attachment detection, @everyone guard
- Warnings, mutes, kicks, bans with audit logs
- Ticket system v2 — priority flags, ratings, ANSI embeds
- Captcha verification

</details>

<details>
<summary><b>🎵 Music</b></summary>

- SoundCloud primary + YouTube yt-dlp fallback
- Queue management, loop, skip, volume
- Per-guild play history and top tracks leaderboard on dashboard
- 530+ curated tracks including Mali legends, Arabic, Chinese artists

</details>

<details>
<summary><b>🎉 Social & Fun</b></summary>

- Giveaways — booster 2x entries, DM notifications, ANSI embeds
- Birthday announcements with per-server channel
- Welcome / goodbye canvas cards with Mali gold theme
- AFK system, auto-reply per channel, profile cards with custom backgrounds
- Games — Trivia, Word Guess, Dice, Coin Flip, Duel

</details>

<details>
<summary><b>📊 Dashboard</b></summary>

- Discord OAuth2 login with full guild isolation
- Server settings — language, welcome/goodbye, leveling, automod
- Per-guild music stats and top tracks
- User profiles with rank, XP, badges, economy stats
- Live at [bamako-steel-dev.xyz](https://bamako-steel-dev.xyz)

</details>

---

### 📱 Telegram — 53 plugins

<details>
<summary><b>🎬 Media Downloads</b></summary>

- YouTube, Instagram, Twitter/X, TikTok, Facebook, Snapchat, Vimeo
- Auto quality selection, file size handling

</details>

<details>
<summary><b>🌍 Multilingual & Group Tools</b></summary>

- EN / FR / Bamanankan / ZH — auto-detected per user
- Welcome/goodbye with GIF support, per-topic channel, auto-close
- Smart group settings panel with 2-min auto-close
- Auto-reply filters — per-chat, per-group, private isolation

</details>

<details>
<summary><b>🎮 Games & System</b></summary>

- Trivia v3 — Mali / Africa / Tech / Gaming / General categories
- /sysctl — PM2 restart, logs, monit directly from Telegram
- GitHub commit tracking with auto-broadcast on deploy

</details>

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

![Plugins](https://img.shields.io/badge/Discord%20Plugins-110-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram%20Plugins-53-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)
![Commands](https://img.shields.io/badge/Slash%20Commands-86-00ff88?style=for-the-badge)
![Servers](https://img.shields.io/badge/Servers-25+-f1c40f?style=for-the-badge)
![Users](https://img.shields.io/badge/Users-365+-ff6b6b?style=for-the-badge)
![Languages](https://img.shields.io/badge/Languages-EN%20%7C%20FR%20%7C%20BM%20%7C%20AR%20%7C%20ZH-green?style=for-the-badge)

---

## 🚀 Self-Hosting

### Prerequisites

- Node.js 20+
- Python 3.x
- ffmpeg + yt-dlp installed globally
- PM2 (`npm install -g pm2`)
- Discord application + bot token from [discord.com/developers](https://discord.com/developers)
- Telegram bot token from [@BotFather](https://t.me/BotFather)

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
CLIENT_SECRET=your_oauth2_secret
DASHBOARD_URL=http://localhost:3000
ANTHROPIC_API_KEY=your_key
GUILD_ID=your_main_guild_id
API_ADMIN_SECRET=a_strong_secret
```

---

<details>
<summary><b>🐧 Linux / VPS (Recommended)</b></summary>

```bash
git clone https://github.com/MFOF7310/archon-bot.git
cd archon-bot
npm install
cp .env.example .env
# fill in .env
node scripts/deploy-commands.js
pm2 start index.js --name Architect-CG223
pm2 save && pm2 startup
```

</details>

<details>
<summary><b>📱 Termux (Android — no root required)</b></summary>

```bash
pkg update && pkg upgrade
pkg install nodejs python ffmpeg git
pip install yt-dlp
npm install -g pm2
git clone https://github.com/MFOF7310/archon-bot.git
cd archon-bot
npm install
cp .env.example .env
node scripts/deploy-commands.js
pm2 start index.js --name Architect-CG223
```

</details>

<details>
<summary><b>🪟 Windows</b></summary>

1. Install [Node.js 20](https://nodejs.org) and [Git](https://git-scm.com)
2. Install [ffmpeg](https://ffmpeg.org/download.html) and add to PATH
3. Run:

```bash
git clone https://github.com/MFOF7310/archon-bot.git
cd archon-bot
npm install
copy .env.example .env
node scripts/deploy-commands.js
npm install -g pm2
pm2 start index.js --name Architect-CG223
```

</details>

<details>
<summary><b>🍎 macOS</b></summary>

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

</details>

<details>
<summary><b>📊 Dashboard Setup (Optional)</b></summary>

```bash
cd /path/to/dashboard
npm install
npm run build
pm2 start dist/boot.js --name architect-dashboard
```

Requires its own `.env` with `DATABASE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `SESSION_SECRET`.

</details>

---

### Deploying Slash Commands

After any plugin change:

```bash
node scripts/deploy-commands.js
```

Only plugins with a valid `SlashCommandBuilder` export are registered. Each plugin logs as `✅ deployed` or `⏭️ skipped (prefix-only)`.

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

