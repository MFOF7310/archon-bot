'use strict';
// Shapes the model's text for Discord and builds the answer card.
// Part of Lydia (plugins/lydia.js), moved here as is: the code below is unchanged.
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { t } = require('../i18n');
const { CFG, THEMES } = require('./config');

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE FORMATTER — light touch: the model's own layout is kept, code blocks are never changed
// ═══════════════════════════════════════════════════════════════════════════════

function formatDiscordResponse(text) {
  if (!text) return '';
  const parts = String(text).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\r\n?/g, '\n').split(/(```[\s\S]*?```)/g);
  return parts.map((p, i) => (i % 2 === 1 ? p : p
    .replace(/^#{1,3}\s+(.+)$/gm, '**$1**')          // # titles read as shouting in a chat card
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n'))).join('').trim();
}

// One card per answer: Discord refuses a V2 message over 4000 characters, so a long answer stops at a paragraph
function fitReply(text) {
  if (text.length <= CFG.MAX_REPLY_CHARS) return text;
  let cut = text.slice(0, CFG.MAX_REPLY_CHARS);
  const at = cut.lastIndexOf('\n\n');
  if (at > CFG.MAX_REPLY_CHARS * 0.6) cut = cut.slice(0, at);
  if ((cut.match(/```/g) || []).length % 2) cut += '\n```';   // close a code block cut in the middle
  return cut + '\n\n…';
}

function buildEmbed(reply, message, options = {}) {
  const { isError = false, isThinking = false, theme = THEMES.default, model = null, latency = null, tokens = null, sources = [], lang = 'en' } = options;

  // Red only for real errors: picking the colour from words in the answer ("bug", "fix") made friendly replies look like alerts
  const embedColor = isError ? 0xff4757 : 0xE6A817;

  const c = new ContainerBuilder().setAccentColor(embedColor);

  if (isThinking) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${theme.emoji} ${require('../i18n').t('lydia.thinkingEmbed.label', lang)}\n*${require('../i18n').t('lydia.thinkingEmbed.text', lang)}*`));
    return c;
  }

  const content = fitReply(formatDiscordResponse(reply));
  const card = new ContainerBuilder().setAccentColor(embedColor);
  card.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  card.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  if (sources.length > 0 && !isError) {
    const links = sources.slice(0, 4).map((src, idx) => `[[${idx + 1}]](${src.url}) ${src.title.length > 80 ? src.title.slice(0, 80) + '…' : src.title}`).join('\n');
    card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${require('../i18n').t('lydia.sourcesTitle', lang)}**\n${links}`));
  }
  // Which model answered: honest, and useful when a server compares answers
  card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${theme.emoji} Archon${model?.name && !isError ? ` · ${model.name}` : ''}`));
  return [card];
}

module.exports = { formatDiscordResponse, fitReply, buildEmbed };
