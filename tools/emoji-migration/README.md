# Emoji Migration Tools

One-off tooling for migrating **guild emojis → Discord Application Emojis**
(app-scoped, render in every server the bot is in, no External Emoji
permission, works in DMs).

## When you'd run these

- First-time migration of a bot's emoji registry
- Adding a new source guild (rerun the audit + upload for that guild)
- Regenerating the app registry after uploading new emojis manually

## Prerequisites

- `DISCORD_TOKEN` in the environment (the same token the bot uses).
  Get it from PM2: `pm2 env 4 | grep DISCORD_TOKEN`
- Discord Dev Portal access for the target application
- `config/emojis.js` present (live registry)

## Files

| File | Purpose |
|---|---|
| `build_migration_plan.js` | Reads `config/emojis.js`, cross-references both source guilds, produces `emoji_migration_plan.json` + `.md` |
| `upload_app_emojis.js` | Reads the plan, uploads to the Dev Portal via REST, writes `app_emoji_ids.json` (resume-safe) |
| `build_app_registry.js` | Reads `app_emoji_ids.json` + current `config/emojis.js`, writes `config/emojis.app.js` |

## Typical run order

```bash
cd /root/cloud-gaming-223-digital-engine

# 0. Load the token for the session
export DISCORD_TOKEN="$(pm2 env 4 | grep '^DISCORD_TOKEN:' | sed 's/^DISCORD_TOKEN: *//' | head -1)"

# 1. Audit — no changes, produces a plan + checklist
node tools/emoji-migration/build_migration_plan.js

# 2. Review the plan
less emoji_migration_plan.md

# 3. Upload (resume-safe; safe to Ctrl+C and re-run)
node tools/emoji-migration/upload_app_emojis.js

# 4. Build the drop-in registry
node tools/emoji-migration/build_app_registry.js

# 5. Cutover (with backup)
cp config/emojis.js config/emojis.app.bak
cp config/emojis.app.js config/emojis.js
pm2 restart Architect-CG223 --update-env

# Rollback if needed
cp config/emojis.app.bak config/emojis.js
pm2 restart Architect-CG223 --update-env

Notes

· All three tools use path.resolve(__dirname, '../..') to locate
  the project root, so they work no matter where you invoke them from.
· Outputs (emoji_migration_plan.json, app_emoji_ids.json) are
  written to the project root, not to tools/.
· These files are safe to re-run. build_migration_plan.js and
  build_app_registry.js are pure reads+write-report. upload_app_emojis.js
  skips any emoji already present in the Dev Portal.

Gitignore

The tooling is tracked in git; its outputs are not. See the
.gitignore entries for emoji_migration_plan.*, app_emoji_ids.json,
emoji_migration.diff.md, config/emojis.app.js.
