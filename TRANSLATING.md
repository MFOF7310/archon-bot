# Translating ARCHON CG-223

Thanks for helping members read ARCHON in their own language.

## Languages

| Code | Language | Status |
|---|---|---|
| `en` | English | Complete, the reference |
| `fr` | French | Complete |
| `zh` | Chinese (Simplified) | Complete |
| `ar` | Arabic | Complete |
| `bm` | Bambara | Started, needs native speakers |

Any key missing in a language falls back to **English**.

## Where the texts are

| Path | What's in it |
|---|---|
| `lang/<code>/<module>.json` | Bot texts, one file per module (`ticket.json`, `automod.json`, `giveaway.json`…) |
| `lib/lang/<code>.json` | Older shared texts, still in use |
| `config/changelog.json` | Release notes, one line per language |
| `telegram/lang/` | Telegram bot texts |

Open the English file of a module, then the same file in your language, and translate key by key.

## Rules

**Keep exactly as written**

| What | Examples |
|---|---|
| Variables | `{user}` `{server}` `{n}` `{amount}` `{duration}` |
| Brand names | `ARCHON CG-223`, `Lydia`, `Top.gg`, `CODM` |
| Commands | `/ticket`, `.giveaway`, `/meta weapon` |
| Markdown | `**bold**`, `` `code` ``, `-#` at the start of a line, `>` for quotes |
| Custom emoji codes | `<:name:123…>` |

**Write like a person**

- Short, plain sentences. Say what happened and what the member can do next.
- Use the familiar form when the English speaks to a member (`tu` in French), unless the module already uses another form.
- Plurals use two keys: `xxxOne` and `xxxMany`. Translate both.
- Button labels: 1 to 3 words. Discord cuts form titles and labels at 45 characters.
- Keep a loan word (`Boost`, `Premium`, `streak`) if that's what gamers say in your language.

## Bambara

Bambara has a small set of drafted texts that no native speaker has reviewed yet. If you speak it, you're the person we need: start with `lib/lang/bm.json` and `lang/bm/mylang.json`, the texts members see first.

Already-chosen words (keep them unless you have a good reason):

| Bambara | Meaning |
|---|---|
| `don` | day |
| `bonusi` | bonus |
| `sɔrɔ` | get / receive |
| `ɲɔgɔnna` | in a row |
| `kɛlɛla` | veteran (literally warrior) |

## Sending your work

1. Fork the repository.
2. Translate the files of one or more modules.
3. Check that each JSON file is still valid (no missing comma, no stray quote).
4. Open a pull request titled `i18n(<code>): <module>`.

Once merged, the bot restarts by itself and your texts are live a minute later.

Questions: open an issue or ask in the [Eagle Community](https://discord.gg/NFSMFJajp9) on Discord.
