# Contributing to ARCHON CG-223

Thanks for your interest in contributing. This is a solo-maintained project built from Bamako, Mali 🇲🇱 — contributions are welcome but reviewed carefully.

## Before You Start

- Check existing [issues](https://github.com/MFOF7310/archon-bot/issues) and [pull requests](https://github.com/MFOF7310/archon-bot/pulls) to avoid duplicates
- For major changes, open an issue first to discuss the approach
- This project uses Node.js 20, Discord.js v14, and better-sqlite3 — stick to the existing stack

## Plugin Structure

Every plugin must export:

```js
module.exports = {
    name: 'commandname',
    description: 'Short description.',
    category: 'CATEGORY',
    cooldown: 3000,
    data: new SlashCommandBuilder()..., // required for slash registration
    run: async (client, message, args, db, serverSettings) => {},
    execute: async (interaction, client) => {}
};
```

- Prefix (`run`) and slash (`execute`) must both be implemented
- Always use `message.reply()` not `message.channel.send()` for responses
- Slash commands must call `interaction.deferReply()` for any async operation

## Code Style

- No external dependencies without prior discussion
- Error handling on every async call — no unhandled rejections
- Use `client.detectLanguage(commandName, guildId)` for language detection
- Database queries use better-sqlite3 (synchronous) — no async DB calls

## Testing Before PR

```bash
node --check plugins/<your-plugin>.js
node scripts/deploy-commands.js
pm2 restart Architect-CG223 --update-env
# Run .alive or /alive — verify no errors in pm2 logs
```

## Commit Convention

```
feat(plugin): add new feature
fix(plugin): fix specific bug
refactor(plugin): improve structure
docs: update documentation
chore: dependency or config update
```

## Contact

Questions? Join [Eagle Community](https://discord.gg/NFSMFJajp9) or DM [mfof7559](https://discord.gg/F9HjtwWQ) on Discord.

