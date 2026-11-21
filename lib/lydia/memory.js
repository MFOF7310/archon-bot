'use strict';
// What Lydia remembers about members and the reminders she sets, plus the memory and forget answers.
// Part of Lydia (plugins/lydia.js), moved here as is: the code below is unchanged.
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { t } = require('../i18n');
const { pickLang } = require('../pick-lang');
const { C } = require('./config');

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function parseAndStoreMemory(reply, userId, database, guildId = '') {
  if (!reply?.includes('[MEMORY:')) return;
  const regex = /\[MEMORY:\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]/g;
  let match;
  while ((match = regex.exec(reply)) !== null) {
    const key = match[1]?.trim().toLowerCase();
    const value = match[2]?.trim();
    if (!key || !value || key.length > 50 || value.length > 200) continue;
    try {
      database.prepare(`
        INSERT OR REPLACE INTO lydia_memory (user_id, guild_id, memory_key, memory_value, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, String(guildId || ''), key, value, Date.now());
      console.log(`${C.green}[MEMORY]${C.reset} Stored ${key} for user ${userId}`);
    } catch (dbError) {
      console.log(`${C.yellow}[MEMORY ERR]${C.reset} ${dbError.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function parseAndScheduleReminder(response, userId, channelId, client, database, guildId = null) {
  const regex = /\[REMIND:\s*(\d+)\s*(min|h|sec|s|m|hour|hours|minute|minutes)\s*\|\s*(.+?)\]/gi;
  let match;
  let cleanedResponse = response;
  const now = Date.now();

  while ((match = regex.exec(response)) !== null) {
    const [, amount, unit, msg] = match;
    const multipliers = {
      sec: 1000, s: 1000,
      min: 60000, m: 60000, minute: 60000, minutes: 60000,
      h: 3600000, hour: 3600000, hours: 3600000
    };
    const ms = Math.max(5000, Math.min(parseInt(amount) * (multipliers[unit.toLowerCase()] || 60000), 30 * 86400000));
    const executeAt = Math.floor((now + ms) / 1000);
    const id = `${userId}_${executeAt}_${Math.random().toString(36).slice(2, 9)}`;

    try {
      database.prepare(`
        INSERT INTO reminders (id, user_id, user_tag, guild_id, channel_id, message, execute_at, delivered, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(id, userId, null, guildId, channelId, msg.trim(), executeAt, Math.floor(now / 1000));

      // Delivered by plugins/reminder.js tick() (every 30 s)

      console.log(`${C.green}[REMIND]${C.reset} Scheduled "${msg.trim()}" for ${userId} in ${amount}${unit}`);
    } catch (e) {
      console.log(`${C.yellow}[REMIND ERR]${C.reset} ${e.message}`);
    }

    cleanedResponse = cleanedResponse.replace(match[0], '').trim();
  }

  return cleanedResponse.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY SUBCOMMAND
// ═══════════════════════════════════════════════════════════════════════════════

async function handleMemorySubcommand(interactionOrMessage, database, isSlash = false, client = null) {
  const _ssM = client?.getServerSettings?.(interactionOrMessage.guild?.id) || {};
  const lang = _ssM.language && _ssM.language !== 'auto' ? _ssM.language : (isSlash ? (interactionOrMessage.locale?.startsWith('fr') ? 'fr' : 'en') : 'en');
  let userId, username, respond;
  if (isSlash) {
    userId = interactionOrMessage.user.id;
    username = interactionOrMessage.user.username;
    respond = async (content) => interactionOrMessage.reply(content);
  } else {
    userId = interactionOrMessage.author.id;
    username = interactionOrMessage.author.username;
    // A channel message can't be private: the memories go to the member's DMs instead of the channel
    respond = async (content) => {
      const dm = { ...content, flags: content.flags & ~64 };
      return interactionOrMessage.author.send(dm).then(() => interactionOrMessage.react(require('../ui/icons').icon('inbox', interactionOrMessage)).catch(() => {}))
        .catch(() => interactionOrMessage.reply(dm));
    };
  }

  try {
    // this server's memories, plus the older ones saved before memories were kept per server (shown, never used)
    const gid = interactionOrMessage.guild?.id || null;
    const memories = gid
      ? database.prepare(`SELECT memory_key, memory_value, updated_at, guild_id FROM lydia_memory WHERE user_id = ? AND guild_id IN (?, '') ORDER BY guild_id DESC, updated_at DESC`).all(userId, gid)
      : database.prepare(`SELECT memory_key, memory_value, updated_at, guild_id FROM lydia_memory WHERE user_id = ? ORDER BY updated_at DESC`).all(userId);

    if (!memories.length) {
      const c = new ContainerBuilder().setAccentColor(0xf1c40f);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${require('../ui/icons').icon('inbox_empty', interactionOrMessage)} ${t('lydia.memory_empty_title', lang)}`));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${t('lydia.memory_empty', lang)}\n\n` + t('lydia.memory_empty_hint', lang) + '\n\n' + t('lydia.memory_example', lang)));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('lydia.memory_footer', lang)}`));
      await respond({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
      return;
    }

    const c = new ContainerBuilder().setAccentColor(0x2ecc71);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${require('../ui/icons').icon('brain', interactionOrMessage)} ${t('lydia.memory_card_title', lang, { user: username })}\n-# ${t('lydia.memory_count', lang, { n: memories.length })}`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    
    for (const m of memories.slice(0, 25)) {
      // Discord shows the date in each reader's own format (stored in ms; older rows may be in seconds)
      const ms = Number(m.updated_at) < 1e12 ? Number(m.updated_at) * 1000 : Number(m.updated_at);
      const date = ms > 0 ? `<t:${Math.floor(ms / 1000)}:D>` : '—';
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${require('../ui/icons').icon('pin', interactionOrMessage)} ${m.memory_key}**\n${m.memory_value}\n-# ${t('lydia.memory_saved_on', lang, { date })}${m.guild_id ? '' : ` · ${t('lydia.memory_legacy', lang)}`}`));
    }
    
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${memories.length > 25 ? t('lydia.memory_showing', lang, { count: 25, total: memories.length }) : t('lydia.memory_footer', lang)} · ${t('lydia.memory_forget_hint', lang)}`));

    await respond({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
  } catch (err) {
    console.error(`${C.red}[LYDIA MEMORY]${C.reset} ${err.message}`);
    const c = new ContainerBuilder().setAccentColor(0xe74c3c);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🔴 ${t('lydia.classification.systemAlert', lang)}`));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('lydia.memory_error', lang)));
    await respond({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
  }
}

// Deletes every memory Archon keeps about the member who asks, on every server (the older ones too)
async function forgetMemories(src, database, client) {
  const userId = src.user?.id || src.author?.id;
  let lang = 'en';
  try { lang = pickLang(client, src.guild?.id, src.user ? src : null, userId) || 'en'; } catch {}
  let n = 0;
  try { n = database.prepare('DELETE FROM lydia_memory WHERE user_id = ?').run(userId).changes; } catch {}
  const text = n ? t('lydia.memory_forgot', lang, { n }) : t('lydia.memory_forget_none', lang);
  return src.reply(src.user ? { content: text, flags: 64 } : { content: text }).catch(() => {});
}

module.exports = { parseAndStoreMemory, parseAndScheduleReminder, handleMemorySubcommand, forgetMemories };
