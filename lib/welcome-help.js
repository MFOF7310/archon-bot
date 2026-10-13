'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// WELCOME HELP — the private "getting started" card behind the Help button
// A button works for everyone who can see the message, even in channels where
// members cannot use commands (a clickable /help mention does not).
// Texts: lang/<locale>/welcome.json (help_card_*) and lang/<locale>/index.json (guardian_*).
// ═══════════════════════════════════════════════════════════════════════════
const { MessageFlags } = require('discord.js');
const v2 = require('./games/v2');
const { t } = require('./i18n');
const E = require('../config/emojis');

const LANGS = ['en', 'fr', 'zh', 'ar'];
const pick = (l) => (LANGS.includes(l) ? l : l === 'bm' ? 'fr' : 'en'); // Bambara is not written yet: French for now
const clean = (s, max = 60) => String(s ?? '').replace(/[*_`~|\\<>@]/g, '').trim().slice(0, max);

function buildWelcomeHelp({ lang, prefix, guildName }) {
  const L = pick(lang);
  const p = prefix || '.';
  const W = (key, vars = {}) => t(`welcome.${key}`, L, vars);
  const I = (key, vars = {}) => t(`index.${key}`, L, { prefix: p, ...vars });
  const server = clean(guildName) || W('help_card_server');
  const commands = ['guardian_help', 'guardian_profile', 'guardian_daily', 'guardian_shop', 'guardian_lydia'].map((k) => I(k)).join('\n');
  const card = v2.card(0x2ecc71, [
    { text: `## ${W('help_card_title')}\n${I('guardian_welcome', { server })}` },
    { rule: true },
    { text: `**${I('guardian_cmds_label')}**\n${commands}` },
    { rule: true },
    { text: [E.hubInfo, W('help_card_how', { prefix: p })].filter(Boolean).join(' ') },
  ]);
  return { ...card, flags: MessageFlags.IsComponentsV2 | 64 }; // 64 = only the person who tapped sees it
}

module.exports = { buildWelcomeHelp };
