# Contributing to ARCHON CG-223

Thanks for wanting to help. Bug reports, fixes, translations and ideas are all welcome.

- **A bug or an idea:** open an issue, or say it in the [Eagle Community](https://discord.gg/NFSMFJajp9) on Discord.
- **A security problem:** don't open a public issue, follow [SECURITY.md](SECURITY.md).
- **A translation:** see [TRANSLATING.md](TRANSLATING.md).

---

## How changes go live

`main` is the live bot. Every push to `main` deploys itself:

1. GitHub calls the deploy webhook on the server.
2. The server pulls the new code and checks every changed `.js` file with `node --check`.
3. If the checks pass, the bot restarts on its own. If one fails, the previous code is put back and nothing restarts.
4. A Telegram message says how it went.

So there's nothing to restart by hand after a push. Two exceptions need a manual `pm2 restart Architect-CG223`:

- **New npm packages.** The webhook stops before restarting and asks for `npm install` first.
- **`config/emojis.js`.** It isn't tracked by git (each server has its own emoji IDs), and the bot reads it at start-up.

The dashboard works the same way from its own repository: a push to its `main` pulls, builds and restarts it.

### Before you push

- `node --check` every file you changed.
- `git status --short`: commit only what you mean to.
- Watch for the Telegram deploy message.

---

## Code conventions

### Texts and languages

- Every text a member or admin sees goes in `lang/<code>/<module>.json`, never written into the plugin.
- Read it with `i18n.t('<module>.<key>', lang, { vars })`. Variables are written `{name}` in the JSON.
- Get the language with `pickLang(client, guildId, interaction, userId)` from `lib/pick-lang`.
- Fill **en, fr, zh and ar**. A missing key falls back to English.
- `t()` returns the key itself when it's missing, so `t('x') || 'fallback'` never falls back. Add the key instead.
- Plurals use two keys (`xxxOne` / `xxxMany`).

### Writing style

- Plain, human sentences: say what happened and what to do next. No terminal jargon.
- No "successfully", no "please", no exclamation marks on system messages.

### Cards and icons

- New cards use Components V2 through `lib/games/v2` (`card(color, items)`).
- A V2 message holds at most 4000 characters of text.
- Icons come from `config/emojis.js` through `lib/ui/icons` (`icon()` / `iconObj()`), always with a standard emoji fallback.
- Replies that name members use `allowedMentions` so nobody gets pinged by accident.

### Data

- Credits go through `client.addCredits()` and `client.removeCredits()`. Writing the `users` table directly is undone by the cache flush.
- Server settings go through `client.updateServerSetting()` with a mapped key (`automodEnabled`, not `automod_enabled`).
- `moderation_logs.timestamp` is in **seconds**. Let SQLite fill `id`.

### Slash commands

The bot is close to Discord's limit of 100 global slash commands. Add a subcommand to an existing command, or a prefix command, rather than a new slash command.

---

## Release notes

Release notes live in `config/changelog.json`, in en, fr, zh and ar, written for members (no commit jargon, no security details). Bump `version.txt` to the same version. `/changelog` and the update announcements read that file.

Then rebuild `CHANGELOG.md` from it:

```bash
node scripts/changelog-md.js
```
