# Changelog

What changed in ARCHON CG-223, in plain language. These are the same notes `/changelog` shows in Discord
(in English, French, Chinese and Arabic). This file is generated from `config/changelog.json`: edit that file,
then run `node scripts/changelog-md.js`.

## 3.2.0 · 2026-11-11

**New**
- /invest is now a card with Claim, Invest and Refresh buttons. Each stake grows up to +10 %.
- /mylang lets you pick your language in one tap, separately for each server and for DMs.
- Dashboard: a new Overview with a to-do list and your key numbers, plus ticket response times.
- Update announcements: pick an updates channel and new versions are posted there automatically.

**Improved**
- /bot activity shows the last 7 days with the trend and the top commands.
- The AutoMod daily summary arrives at 21:00 in your server's own time zone.
- Tickets keep their number after a restart, and categories accept custom emojis.
- /setloadout accepts every CODM weapon, with suggestions as you type.
- Telegram: downloads, games, economy and group moderation were redesigned.

**Fixed**
- Verification by DM answers again.
- One level-up announcement instead of two, and turning leveling off really stops XP.
- Lydia switches to another model when one is busy on free servers.
- The bot's audit log and activity counts are accurate again.

## 3.1.2 · 2026-10-10

**New**
- A redesigned welcome card with character art and a clickable /help link.
- Owners choose the channels where Lydia answers, right from the dashboard.

**Improved**
- The invite link asks only for the permissions ARCHON really uses.
- Removing ARCHON keeps your settings for 7 days, so inviting it back keeps your setup.

**Fixed**
- Premium status is shown correctly when it has lapsed.
- Missing Arabic, Bambara and Chinese translations were added.

## 3.1.0 · 2026-09-22

**New**
- Owners can now pick exactly which channels Lydia AI responds in, right from the Dashboard — no need to type commands in Discord.
- The invite link now asks for only the permissions ARCHON actually uses, instead of full Administrator access.

**Fixed**
- The welcome message now leads with CODM features (scrims, meta, builds, clan wars) and shows in French and English.
- `/verify status` and the Dashboard now correctly show when Premium has lapsed, instead of falsely saying verification is still active.
- Kicking ARCHON no longer wipes a server's settings instantly — there's now a 7-day grace period before cleanup, so re-inviting the bot keeps your setup.
- Role-verification errors now say exactly what's wrong with a role (e.g. "this role can mention @everyone") instead of a vague permissions message.
- Fixed several missing Arabic, Bambara, and Chinese translations across game, AFK, AI, and welcome messages.

**Improved**
- Bot status messages now highlight CODM features (scrims, meta, clan wars) instead of generic server stats.
