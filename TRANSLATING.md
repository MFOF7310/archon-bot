# Contributing Translations to ARCHON CG-223

Thanks for helping make ARCHON accessible in more languages. This guide covers everything you need to know before you start.

---

## Supported locales

| Code | Language | Status |
|------|----------|--------|
| `en` | English | ✅ Complete |
| `fr` | French | ✅ Complete |
| `bm` | Bambara | ✅ Complete |
| `zh` | Chinese (Simplified) | ✅ Complete |
| `ar` | Arabic | ✅ Complete |

To add a new language, open an issue first so we can discuss scope before you invest time.

---

## File structure

Each locale lives in `lang/<code>/` and contains three files:
lang/
en/
shop.json       — Shop interface, item names, purchase messages
use.json        — Inventory and item activation interface
inventory.json  — Inventory display and sell interface
Start with `shop.json` — it covers the most visible user-facing strings. `use.json` and `inventory.json` can follow.

---

## Rules — read these before translating

### 1. Never translate these — leave them exactly as written

| What | Examples |
|------|---------|
| Token placeholders | `{price}` `{balance}` `{level}` `{user}` `{item}` `{amount}` `{type}` `{rank}` |
| Brand names | `ARCHON CG-223` `BAMAKO-STEEL-NODE` `Neural` |
| Command names | `.buy` `.bal` `.credits` |
| Emoji | 🪙 ⚡ 🛡️ 🎖️ 📦 |
| Markdown formatting | `**bold**` `` `code` `` |

### 2. Intentional loan words — your call

These words are used as loans in some locales. You can keep them or find a native equivalent:

- `Boost` / `Streak` / `Badge` / `VIP` / `Stock` / `Permanent`

### 3. Priority tiers

**Tier 1 — Critical (do these first)**
- `insufficientFunds` `levelRequirement` `purchaseError` `accessDenied`
- `itemNotFound` `purchaseComplete` `purchaseSuccessful`
- All `items.*` names and descriptions

**Tier 2 — Important**
- Button labels: `inventory` `refresh` `close` `backToInventory`
- Status strings: `owned` `locked` `depleted` `processing`

**Tier 3 — Polish**
- Footer strings, notification authors, hint text

---

## How to submit

1. Fork the repo
2. Copy `lang/en/` to `lang/<your-code>/`
3. Translate strings following the rules above
4. Open a PR with the title: `i18n(<code>): <language> translations`
5. Note any loan words you kept and why

---

## Questions

Open an issue or reach out on [Discord](https://discord.gg/NFSMFJajp9). The maintainer speaks EN, FR, AR, ZH, and BM.
