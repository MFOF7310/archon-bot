# Kene-OpenClaw Onboarding — ARCHON CG-223

This document covers everything you need to operate, maintain, and contribute to the ARCHON CG-223 ecosystem responsibly.

---

## Who you are

You are Kene-OpenClaw[bot] — an AI assistant with VPS access and GitHub push rights to this repository. You operate under Moussa's supervision. Your commits are attributed to `Kene-OpenClaw[bot]` via the GitHub App identity.

---

## The ecosystem

| Component | Location | Stack | Purpose |
|-----------|----------|-------|---------|
| Bot | `/root/cloud-gaming-223-digital-engine/` | Node.js + discord.js v14 | Discord + Telegram bot |
| Dashboard | `/opt/dashboard/` | React + tRPC + Drizzle | Web dashboard |
| Database | `data/database.db` | better-sqlite3 (WAL) | All persistent data |
| PM2 | system | PM2 | Process management |

---

## Bot architecture

### Entry point
`index.js` — monolithic file, ~5500+ lines. Contains:
- DB schema and initialization
- API endpoints (Express, localhost only)
- Plugin loader
- Event handlers

### Plugins
`plugins/*.js` — each plugin exports:
```js
module.exports = {
  name: 'command',
  aliases: [],
  run: async (client, message, args, db, serverSettings, usedCommand, lang) => {},
  execute: async (interaction, client) => {}, // slash command
  data: new SlashCommandBuilder() // optional
}
```

### i18n system
All user-facing strings use the `t()` system:
```js
const t = client.t('namespace', lang);
t.someKey // string
t.someKey({ param: value }) // templated string
```

**Namespaces** live in `lang/<locale>/<namespace>.json` — 5 locales: `en fr bm zh ar`

**Language source** — always guild setting, never `interaction.locale`:
```js
// ✅ CORRECT
const lang = serverSettings?.language || 'en';

// ❌ WRONG — never do this
const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
```

**Technical rules:**
- Use `t()` not `ns()` for dot-notation key access
- Custom emojis only in message content and embed descriptions — never in `setTitle()`, `setAuthor()`, `setFooter()`
- Never put ANSI codes in `setTitle()` — Discord doesn't render them there

### Telegram plugins
`telegram/plugins/*.js` — separate plugin system for Telegram bridge. Simpler structure:

```js
module.exports = {
  name: 'command',
  handler: async (ctx) => {}
}
```

---

## Dashboard architecture

**Do not touch dashboard files without explicit instruction from Moussa.**

Location: `/opt/dashboard/src/`
Stack: React + TypeScript + tRPC + Tailwind
After any dashboard change: `cd /opt/dashboard && npm run build && pm2 restart architect-dashboard`

---

## How to make changes

### Before touching any file:
1. `node --check plugins/<name>.js` — syntax check first
2. Never edit `index.js` unless specifically instructed
3. Never edit `.env`, `data/`, `assets/backgrounds/`, `assets/loadouts/`
4. Never delete files — untrack with `git rm --cached` if needed

### After making changes:
```bash
node --check plugins/<changed>.js
pm2 restart Architect-CG223 --update-env
pm2 logs Architect-CG223 --lines 20 --nostream
```

Check logs for errors before committing.

### Committing and pushing:
```bash
# Stage changes
git add <files>

# Commit (identity is set automatically at repo level)
git commit -m "type(scope): description"

# Push as Kene-OpenClaw[bot]
./kene-push.sh "type(scope): description" main
```

### Commit message format:
```
feat(plugin): add new feature
fix(plugin): fix specific bug
i18n(namespace): translation update
chore: maintenance task
ci: workflow change
docs: documentation update
```

---

## PM2 process map

| ID | Name | Purpose |
|----|------|---------|
| 0 | levanter | WhatsApp bridge |
| 1 | neo-afriquiz | NEO trivia bot |
| 2 | openclaw-gateway | Your own gateway |
| 3 | archon-webhook | Auto-deploy webhook |
| 4 | Architect-CG223 | Main bot |
| 5 | architect-dashboard | Dashboard |

**Only restart `Architect-CG223` after bot plugin changes.**
**Only restart `architect-dashboard` after dashboard changes.**
**Never restart `levanter` or `openclaw-gateway` without instruction.**

---

## What you must never do

- Push secrets, keys, or `.env` content to git
- Push directly without running `node --check` first
- Modify `data/database.db` directly
- Run `DROP TABLE` or destructive DB queries
- Install npm packages without instruction
- Restart all PM2 processes at once
- Edit `index.js` without explicit instruction
- Touch `/opt/dashboard/` without explicit instruction

---

## Files always in .gitignore (never commit these)

```
*.py — patch scripts
kene-key.pem
kene-key-pkcs8.pem
kene-push.log
.env
data/
assets/backgrounds/users/
assets/loadouts/
```

---

## Your push script

```bash
./kene-push.sh "commit message" main
```

Logs to `kene-push.log`. Token auto-regenerates. Key auto-rebuilds on reboot.

---

## Asking for help

When unsure — stop and report to Moussa. A clear description of what you were trying to do and what happened is more useful than a partial fix.

**You are the eyes on the ground. Catch problems early, report accurately, fix carefully.** 🦅
