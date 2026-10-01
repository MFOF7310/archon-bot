// ═══════════════════════════════════════════════════════════════════════════
// GAME UI — the shared look for every ARCHON game
// Cards, buttons, the private answer box, countdowns and shared wording
// (lang/<locale>/gameui.json). Games keep only their own flavour text.
// ═══════════════════════════════════════════════════════════════════════════
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const i18n = require('../i18n');

const LANGS = ['en', 'fr', 'zh', 'ar'];
const COLORS = { info: 0x00d4ff, success: 0x2ecc71, danger: 0xe74c3c, neutral: 0x95a5a6, gold: 0xffd700 };

// Bambara strings aren't written yet, so bm servers get French.
function pickLang(l) {
  if (l === 'bm') l = 'fr';
  return LANGS.includes(l) ? l : null;
}

// Server language when it's set, otherwise the user's Discord locale (slash) or the fallback (prefix).
function langFor(source, fallback) {
  const guildId = source?.guildId ?? source?.guild?.id;
  try {
    const v = source?.client?.getServerSettings?.(guildId)?.language;
    if (v && v !== 'auto' && pickLang(v)) return pickLang(v);
  } catch {}
  if (source?.locale) {
    try { const l = pickLang(i18n.slashLang?.(source)); if (l) return l; } catch {}
  }
  return pickLang(fallback) || 'en';
}

// t(lang)('key') reads the shared gameui strings; t(lang, 'cipher')('key') reads a game's own file.
const t = (lang, ns = 'gameui') => (key, vars) => i18n.t(`${ns}.${key}`, lang, vars);

const clean = (s, max = 32) => String(s ?? '').replace(/[*_`~|\\]/g, '').slice(0, max);
const countdown = (deadline) => `<t:${Math.floor(deadline / 1000)}:R>`; // Discord counts this down live
const progressBar = (current, total, size = 10) => {
  const filled = total > 0 ? Math.round((current / total) * size) : 0;
  return '▰'.repeat(filled) + '▱'.repeat(Math.max(0, size - filled));
};

// One consistent card: author line with the bot avatar, optional title/body/fields, footer, timestamp.
function card(client, { color = COLORS.info, author, title, description, fields, footer } = {}) {
  const e = new EmbedBuilder().setColor(color).setTimestamp();
  if (author) e.setAuthor({ name: author, iconURL: client?.user?.displayAvatarURL?.() });
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  if (fields?.length) e.addFields(fields);
  return e.setFooter({ text: footer || 'ARCHON CG-223' });
}

function button(id, label, emoji, style = ButtonStyle.Secondary, disabled = false) {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
  return emoji ? b.setEmoji(emoji) : b;
}
const row = (...components) => new ActionRowBuilder().addComponents(...components.flat().filter(Boolean));

// Standard Answer / Give up row used by solo games.
function answerRow(lang, prefix, enabled = true) {
  const T = t(lang);
  return row(
    button(`${prefix}_answer`, T('btnAnswer'), '🔓', ButtonStyle.Success, !enabled),
    button(`${prefix}_giveup`, T('btnGiveUp'), '🏳️', ButtonStyle.Secondary, !enabled),
  );
}

// Private one-line answer box. The game supplies the title; label and placeholder are shared.
function answerModal(lang, id, title, maxLength = 40) {
  const T = t(lang);
  return new ModalBuilder().setCustomId(id).setTitle(String(title).slice(0, 45)).addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('answer').setLabel(T('answerLabel')).setPlaceholder(T('answerPlaceholder'))
        .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(maxLength)),
  );
}

// "+25 credits · +8 XP" — what was actually paid.
const rewardText = (lang, { credits = 0, xp = 0 } = {}) => t(lang)('reward', { credits, xp });

// Leaderboard lines with medals; rows need { username, points, wins }.
function boardLines(lang, rows) {
  const T = t(lang);
  const medals = ['🥇', '🥈', '🥉'];
  return rows.map((r, i) => T('lbLine', { medal: medals[i] || `**${i + 1}.**`, name: clean(r.username) || T('unknown'), points: r.points, wins: r.wins }));
}

module.exports = {
  LANGS, COLORS, ButtonStyle,
  pickLang, langFor, t, clean, countdown, progressBar,
  card, button, row, answerRow, answerModal, rewardText, boardLines,
};
