# Changelog

All notable updates to ARCHON CG-223, in plain language.

## 2026-10-10 — Welcome card: Components V2 + character art

**New**
- Welcome message body migrated to Components V2 (container + media gallery + section + separator + action row). Now matches the layout pattern used by other bots we look up to.
- `/help` is a real clickable slash-command link inside the welcome text, resolved at render time (falls back gracefully if the command ID can't be found).
- Character art on the left of the welcome card — silver-haired cyberpunk agent, paired with the waving chibi on the right. Both are drawn from `assets/welcome/` so you can swap them without code changes.
- Member avatar moved out of the card and into the message body (static, top-right of the greeting paragraph) — same place Ephi-style bots put it.
- `help_hint` text added to all five languages (en, fr, bm, zh, ar). Bambara line corrected to `n bɛna a ɲɛ jira i la`.

**Improved**
- Emoji defaults for party/wave now read from `config/emojis.js` instead of being hardcoded inline — matches the rule the rest of the codebase follows.
- Removed the purple `WELCOME` ribbon overlay that was sitting on top of the member-number line on the card. The member name already did the job; the ribbon was competing with it.
- `/welcome` plugin description no longer mentions "pro-tips" (feature removed).

**Removed**
- The 3–5 random pro-tips that used to appear under every welcome message. Replaced with a single warm pointer to `/help`.
- `buildRandomTips()` — no longer called anywhere.

**Parked (next session)**
- Transparent PNG version of the character art. Current `.jpg` keys cleanly against the card's dark grid; a native PNG would just be cosmetic polish. Needs `rembg` installed in `/opt/rembg` venv (`pip install "rembg[cpu]"`).
- Small x-offset for the character if the eventual transparent PNG exposes a hard left-edge crop.
- Goodbye card — untouched. Still on the old V1 embed, still has the tips block, still uses inline animated emoji IDs. Deserves its own pass.

**Commits:** `b611798` · `e802e22`

---

## 2026-09-22

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

