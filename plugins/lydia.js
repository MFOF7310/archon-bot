'use strict';

const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { icon } = require('../lib/ui/icons');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
let axios = null;
try { axios = require('axios'); }
catch (e) { console.warn('[LYDIA] axios not installed — AI/web features degraded, but /lydia still registers. Fix: npm i axios'); }


// Lydia's parts live in lib/lydia/ (config, language, prompt, safety, search, models, memory, format)
const { isPremium, getGuildModel, CFG, C, detectTheme } = require('../lib/lydia/config');
const { detectUserLanguage, LANG_NAMES } = require('../lib/lydia/language');
const { SETUP_QUESTION, RULES_QUESTION, buildSystemPrompt } = require('../lib/lydia/prompt');
const { scrubSecrets, validateResponse } = require('../lib/lydia/safety');
const { webSearch } = require('../lib/lydia/search');
const { MODEL_POOL, PREMIUM_MODEL, generateAIResponse } = require('../lib/lydia/models');
const { parseAndStoreMemory, parseAndScheduleReminder, handleMemorySubcommand, forgetMemories } = require('../lib/lydia/memory');
const { buildEmbed } = require('../lib/lydia/format');
const { extractFiles, stripFakeLinks } = require('../lib/lydia/files');

const lydiaActions = require('./lydia-actions');
const { isElevated: _isElevated } = (() => { try { return require('./automod'); } catch { return { isElevated: () => false }; } })();



// ─── Plan limits (free: CFG.FREE_* · Premium: none) ─────────────────────────
let _usageReady = false;
function usageTable(db) {
  if (_usageReady || !db) return;
  db.prepare('CREATE TABLE IF NOT EXISTS lydia_usage (user_id TEXT, guild_id TEXT, day TEXT, n INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id, day))').run();
  _usageReady = true;
}
const usageDay = () => new Date().toISOString().slice(0, 10);   // UTC: resets at midnight UTC
function usageOf(db, guildId, userId) {
  try {
    usageTable(db);
    const day = usageDay();
    const me = userId ? db.prepare('SELECT n FROM lydia_usage WHERE user_id = ? AND guild_id = ? AND day = ?').get(userId, guildId, day)?.n || 0 : 0;
    const server = db.prepare('SELECT COALESCE(SUM(MIN(n, ?)), 0) AS n FROM lydia_usage WHERE guild_id = ? AND day = ?').get(CFG.FREE_DAILY_LIMIT, guildId, day).n;
    return { me, server };
  } catch { return { me: 0, server: 0 }; }
}
// The server's active channels, the first switched on first (the free plan answers in the first CFG.FREE_CHANNELS)
function activeChannels(client, guild) {
  const ids = Object.keys(client.lydiaChannels || {}).filter((id) => guild.channels.cache.has(id));
  if (ids.length < 2) return ids;
  const since = {};
  try {
    for (const r of client.db.prepare(`SELECT channel_id, updated_at FROM lydia_agents WHERE is_active = 1 AND channel_id IN (${ids.map(() => '?').join(',')})`).all(...ids)) since[r.channel_id] = r.updated_at || 0;
  } catch { /* keep the order found */ }
  return ids.sort((a, b) => (since[a] || 0) - (since[b] || 0));
}
function answeringChannels(client, guild) {
  const all = activeChannels(client, guild);
  return isPremium(client.db, guild.id) ? all : all.slice(0, CFG.FREE_CHANNELS);
}
const serverNoticeDay = new Map();   // guild → the day the "server limit reached" notice was sent

let isLydiaInitialized = false;
const userCooldowns = new Map();
const channelCooldowns = new Map();
const messageProcessingLocks = new Set();

// ═══════════════════════════════════════════════════════════════════════════════
// ANSI COLORS
// ═══════════════════════════════════════════════════════════════════════════════






// ═══════════════════════════════════════════════════════════════════════════════
// BOT NAME DETECTOR
// ═══════════════════════════════════════════════════════════════════════════════

function getBotName(message) {
  return message.guild?.members?.me?.displayName
    || message.client?.user?.displayName
    || message.client?.user?.username
    || 'Archon';
}





// ═══════════════════════════════════════════════════════════════════════════════
// EMBED BUILDER (Updated — multi-embed support, no truncation)
// ═══════════════════════════════════════════════════════════════════════════════

// UI language for the bot's own messages: the server's setting when set (bm -> fr), else the person's language
function _uiLang(client, message, personLang) {
    // Force pickLang to look up the user's mylang preference
    const userId = message.author?.id || message.user?.id;
    const guildId = message.guild?.id || message.guildId;
    return pickLang(client, guildId, message, userId) || personLang || 'en';
}


// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER (Updated — uses new buildEmbed which returns array)
// ═══════════════════════════════════════════════════════════════════════════════


async function handleLydiaMessage(message, client, database) {
  if (!message.guild || message.author.bot) return;

  // Check if Lydia AI is enabled for this server
  const lydiaSettings = client.getServerSettings?.(message.guild.id);
  if (lydiaSettings?.ai_enabled === 0 || lydiaSettings?.aiEnabled === false) return;

  const key = `${message.id}-${message.author.id}`;
  if (messageProcessingLocks.has(key)) return;

  const now = Date.now();
  if (now - (userCooldowns.get(message.author.id) || 0) < CFG.COOLDOWN_TIME) return;
  if (channelCooldowns.has(message.channel.id) && now - channelCooldowns.get(message.channel.id) < CFG.CHANNEL_COOLDOWN) return;
  if (!client.lydiaChannels?.[message.channel.id]) return;
  // A prefix command (".ask …", ".8ball …") is for that command: Lydia doesn't answer it too
  {
    const _prefix = String(lydiaSettings?.prefix || '.');
    const _txt = String(message.content || '');
    if (_prefix && _txt.startsWith(_prefix)) {
      const _cmd = _txt.slice(_prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
      if (_cmd && (client.commands?.get(_cmd) || client.commands?.find?.((c) => Array.isArray(c.aliases) && c.aliases.includes(_cmd)))) return;
    }
  }
  // Only messages addressed to the bot start the cooldowns (any chat in the channel used to block the next real question)
  {
    const _name = (getBotName(message) || 'Archon').toLowerCase();
    const _c = (message.content || '').toLowerCase();
    if (!(_c.startsWith(_name) || message.mentions?.has(client.user))) return;
  }

  // Free plan: she answers in the first CFG.FREE_CHANNELS channels switched on, quietly ignores the others
  if (!answeringChannels(client, message.guild).includes(message.channel.id)) return;

  messageProcessingLocks.add(key);
  userCooldowns.set(message.author.id, now);
  channelCooldowns.set(message.channel.id, now);

  let thinkingMsg = null;
  let searchUsed = false;
  let searchSources = [];

  // The member's own language when the message shows it, else their /mylang or the server language
  const uiLang = _uiLang(client, message, 'en');
  const lang = detectUserLanguage(message.content || '') || uiLang || 'en';

  try {
    const botName = (getBotName(message) || 'Archon').toLowerCase();
    const userName = message.member?.displayName || message.author?.username || 'Unknown';
    const content = (message.content || '').toLowerCase();


    const addressed = content.startsWith(botName.toLowerCase()) || message.mentions?.has(client.user);
    if (!addressed) { messageProcessingLocks.delete(key); return; }

    let userPrompt = message.content || '';
    if (content.startsWith(botName.toLowerCase())) {
      userPrompt = (message.content || '').slice(botName.length).trim();
    } else {
      userPrompt = (message.content || '').replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
    }

    const theme = detectTheme(userPrompt || 'hello');

    thinkingMsg = await message.reply({
      components: [buildEmbed(null, message, { isThinking: true, theme, lang: uiLang })],
      allowedMentions: { repliedUser: false },
      flags: MessageFlags.IsComponentsV2
    }).catch(() => null);

    console.log(`${C.cyan}[LYDIA]${C.reset} ${userName} [${lang}]: ${message.content?.substring(0, 50)} | ${theme.name}`);

    let imageUrl = null;
    if (message.attachments?.size > 0) {
      const att = message.attachments.first();
      if (att.contentType?.startsWith('image/')) imageUrl = att.url;
    }
    // A reply: she reads the message it answers (its words and its picture, ARCHON's own cards included)
    if (message.reference?.messageId) {
      const ref = await message.fetchReference().catch(() => null);
      if (ref) {
        const card = require('../lib/message-text').cardText(ref);
        const quotedText = [String(ref.content || '').trim(), card.text].filter(Boolean).join('\n').replace(/\s+/g, ' ').slice(0, 800);
        if (!imageUrl) imageUrl = [...(ref.attachments?.values?.() || [])].find((a) => /^image\//.test(a.contentType || ''))?.url || card.image || null;
        const who = ref.author ? `${ref.author.globalName || ref.author.username}${ref.author.bot ? ' (a bot)' : ''}` : 'someone';
        if (quotedText || imageUrl) userPrompt = `[Replying to ${who}: "${quotedText || '(a picture)'}"${imageUrl ? ' — the picture is attached' : ''}]\n${userPrompt}`;
      }
    }

    if (!userPrompt.trim()) {
      const staticMsg = t(lang === 'fr' ? 'lydia.greeting_fr' : 'lydia.greeting_en', lang, { user: userName });
      const staticEmbeds = buildEmbed(staticMsg, message, { isError: false, theme, lang });
      if (thinkingMsg) await thinkingMsg.edit({ components: staticEmbeds, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
      else await message.reply({ components: staticEmbeds, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
      messageProcessingLocks.delete(key);
      return;
    }

    let memories = [];
    try {
      memories = database.prepare(`
        SELECT memory_key, memory_value FROM lydia_memory
        WHERE user_id = ? AND guild_id = ? ORDER BY updated_at DESC LIMIT ?
      `).all(message.author.id, message.guild.id, CFG.MAX_MEMORY_PER_USER);   // only what they told her on THIS server
    } catch (e) {}

    // Only ARCHON's owner is "the developer" and sees the owner-only commands. Every server owner used to be
    // introduced as the developer, and the owner was looked up with two Discord API calls on every message.
    const envOwnerId = process.env.OWNER_ID || process.env.DEVELOPER_ID || process.env.BOT_OWNER;
    const isOwner = envOwnerId && message.author.id === envOwnerId ? 'dev' : message.author.id === message.guild.ownerId ? 'server' : null;
    // Free plan: CFG.FREE_DAILY_LIMIT messages per member and CFG.FREE_SERVER_DAILY per server each day.
    // One short notice when a limit is reached, then silence until midnight UTC.
    if (isOwner !== 'dev' && !isPremium(database, message.guild.id)) {
      const day = usageDay();
      const { me, server } = usageOf(database, message.guild.id, message.author.id);
      let notice = null, blocked = false;
      if (me >= CFG.FREE_DAILY_LIMIT) {
        blocked = true;
        if (me === CFG.FREE_DAILY_LIMIT) notice = t('lydia.daily_limit', lang, { n: CFG.FREE_DAILY_LIMIT });
        try { database.prepare('UPDATE lydia_usage SET n = n + 1 WHERE user_id = ? AND guild_id = ? AND day = ?').run(message.author.id, message.guild.id, day); } catch {}
      } else if (server >= CFG.FREE_SERVER_DAILY) {
        blocked = true;
        if (serverNoticeDay.get(message.guild.id) !== day) {
          serverNoticeDay.set(message.guild.id, day);
          notice = t('lydia.server_limit', lang, { n: CFG.FREE_SERVER_DAILY });
        }
      }
      if (blocked) {
        if (thinkingMsg) {
          if (notice) await thinkingMsg.edit({ components: buildEmbed(notice, message, { theme, lang }), flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
          else await thinkingMsg.delete().catch(() => {});
        }
        messageProcessingLocks.delete(key);
        return;
      }
      try { database.prepare('INSERT INTO lydia_usage (user_id, guild_id, day, n) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, guild_id, day) DO UPDATE SET n = n + 1').run(message.author.id, message.guild.id, day); } catch {}
    }

    const serverPrefix = client.getServerSettings?.(message.guild.id)?.prefix || process.env.PREFIX || '.';

    const systemPrompt = buildSystemPrompt(botName, userName, message.guild, isOwner, theme, serverPrefix, lang, client.commands?.size || 0, message.content, client.commands, !!(message.guild?.id && isPremium(database, message.guild.id)),
      // the same totals as the restart card (plugins loaded, slash commands), so Archon never quotes a different number
      client.moduleStats ? { ...client.moduleStats, total: client.commands?.size || client.moduleStats.total, slash: client._slashCount || client.moduleStats.slash } : null);

    let fullSystem = memories.length > 0
      ? `${systemPrompt}\n\n[Your memories about this user]:\n${memories.map(m => `\u2022 ${m.memory_key}: ${m.memory_value}`).join('\n')}`
      : systemPrompt;
    let history = [];
    try {
      const rawHistory = database.prepare(`
        SELECT role, content, user_name FROM lydia_conversations
        WHERE channel_id = ? AND guild_id = ? ORDER BY timestamp DESC LIMIT ?
      `).all(message.channel.id, message.guild.id, CFG.MAX_HISTORY);

      rawHistory.reverse();
      for (const turn of rawHistory) {
        const cleanRole = turn.role === 'assistant' ? 'assistant' : 'user';
        const cleanContent = cleanRole === 'user'
          ? `${turn.user_name}: ${turn.content}`
          : turn.content;
        if (history.length > 0 && history[history.length - 1].role === cleanRole) {
          history[history.length - 1].content += `\n${cleanContent}`;
        } else {
          history.push({ role: cleanRole, content: cleanContent });
        }
      }
    } catch (e) {
      console.log(`${C.yellow}[HISTORY ERR]${C.reset} ${e.message}`);
    }

    try {
      database.prepare(`
        INSERT INTO lydia_conversations (channel_id, guild_id, user_id, user_name, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(message.channel.id, message.guild.id, message.author.id, userName, 'user', userPrompt, Math.floor(Date.now() / 1000));
    } catch (dbError) {
      console.log(`${C.yellow}[DB WRITE ERR]${C.reset} Failed to save user message: ${dbError.message}`);
    }

    let searchResults = null;
    // Web search only for questions about the world, not about ARCHON itself (that's in the prompt already).
    // Whole words: "update" used to match "updated", "find" matched "finder", and each one cost a paid search.
    const searchTriggers = /\b(search|google|look up|who is|what is|latest|news|weather|price|today|tonight|this week|score|météo|actualités?|prix|qui est|c'est quoi|aujourd'hui)\b/i;
    const aboutBot = /\b(archon|lydia|command|commande|prefix|préfixe|dashboard|slash)\b|^[./!]/i.test(userPrompt);
    const braveKey = process.env.BRAVE_API_KEY;
    if (braveKey && !aboutBot && searchTriggers.test(userPrompt)) {
      const searchData = await webSearch(userPrompt, braveKey);
      if (searchData) {
        searchResults = searchData.formatted;
        searchSources = searchData.sources;
        searchUsed = true;
      }
    }

    const finalPrompt = searchResults
      ? `[Web search results \u2014 cite sources using [1], [2], etc. when referencing]:\n${searchResults}\n\n[User question]: ${userPrompt}`
      : userPrompt;

    // This server's live facts (lib/lydia-context.js): modules, commands turned off, public channels, Premium, and the
    // asker's own numbers; server managers also get AutoMod, Premium end and open tickets. Nothing from other servers.
    const isManager = !!message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
    try {
      const ctx = require('../lib/lydia-context');
      fullSystem += `\n\n${ctx.build(client, message.guild, message.member)}`;
      if (isManager) fullSystem += `\n${ctx.forManagers(client, message.guild)}`;
    } catch (e) { console.error('[LYDIA] server facts:', e.message); }

    // Setup questions ("what's left to set up?"): server managers get this server's checklist (lib/setup-checklist.js,
    // the same list /setup shows), read only and without channel or role names. Other members get no configuration.
    // It stays for the follow-up messages too (the last turns were about setup), so Lydia never answers a follow-up
    // without the data and then takes back an answer that was right.
    const setupTalk = SETUP_QUESTION.test(message.content || '') || history.slice(-4).some((h) => SETUP_QUESTION.test(String(h.content || '')));
    if (setupTalk) {
      if (isManager) {
        try {
          const list = require('../lib/setup-checklist');
          fullSystem += `\n\n[SERVER SETUP — live data, checked by ARCHON for this very message. It is real and current: rely on it, and never say you can't see the server's setup. Read only: you cannot change any setting and must never say you did. The person asking manages this server. Tell them what is done and what is left, most important first, and for each missing item name the place after the arrow where they fix it. /setup shows the same list with buttons.]\n${list.summaryText(list.compute(client, message.guild), lang)}`;
        } catch (e) { console.error('[LYDIA] setup checklist:', e.message); }
      } else {
        fullSystem += `\n\n[The person asking does not manage this server. Do not describe how the server is configured (channels, roles, verification, logs); suggest they ask a server admin, who can see everything with /setup.]`;
      }
    }

    // Rules questions ("sum up the rules"): the server's real rules, from /rules set or the rules channel
    // (lib/rules-text.js). Public to members, so anyone gets them. Kept for follow-ups like the setup checklist.
    const rulesTalk = RULES_QUESTION.test(message.content || '') || history.slice(-4).some((h) => RULES_QUESTION.test(String(h.content || '')));
    if (rulesTalk && message.guild) {
      try {
        const rules = await require('../lib/rules-text').get(client, message.guild);
        fullSystem += rules
          ? `\n\n[SERVER RULES — the real text of this server's rules, read by ARCHON just now from ${rules.where}. Rely on it and never say you can't see the rules. When asked for a summary, give the main points in a few short lines in the member's language, without adding rules that aren't there. Quote a rule only if they ask about a specific one.]\n${rules.text}`
          : `\n\n[This server has no rules ARCHON can read (none saved with /rules set, and no readable rules channel). Say so plainly; an admin can add them with /rules set or set a rules channel in /channels.]`;
      } catch (e) { console.error('[LYDIA] rules:', e.message); }
    }

    const aiResult = await generateAIResponse(fullSystem, finalPrompt, history, imageUrl, theme, message.guild?.id ?? null);

    if (!aiResult) {
      const errorMsg = !process.env.OPENROUTER_API_KEY ? t('lydia.ai_no_key', lang) : t('lydia.ai_unavailable', lang);
      const errorEmbeds = buildEmbed(errorMsg, message, { isError: true, theme, lang });
      if (thinkingMsg) await thinkingMsg.edit({ components: errorEmbeds, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
      else await message.reply({ components: errorEmbeds, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
      messageProcessingLocks.delete(key);
      return;
    }

    let { content: aiReply, model, latency, tokens } = aiResult;

    const validation = validateResponse(aiReply, lang);
    let safeReply = validation.cleaned;
    if (validation.ok !== false && message.guild && typeof safeReply === 'string') {
      try {
        safeReply = await lydiaActions.handleIntent({ reply: safeReply, message, client, db: database, isPremium, isElevated: _isElevated, lang: uiLang });
      } catch (e) { console.log('[LYDIA ACTION] error:', e.message); }
    }
    if (!validation.ok) {
      console.log(`${C.yellow}[HALLUCINATION REPLACED]${C.reset} Reason: ${validation.reason}`);
    }

    safeReply = scrubSecrets(safeReply);



    const cleanReply = safeReply
      .replace(/\[MEMORY:\s*[^|]+?\s*\|\s*[^\]]+?\s*\]/g, '')
      .replace(/\[REMIND:[^\]]*\]/g, '')
      .trim();

    try {
      database.prepare(`
        INSERT INTO lydia_conversations (channel_id, guild_id, user_id, user_name, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(message.channel.id, message.guild.id, client.user.id, botName, 'assistant', safeReply, Math.floor(Date.now() / 1000));
    } catch (e) {}

    parseAndStoreMemory(safeReply, message.author.id, database, message.guild.id);   // memories belong to this server
    // The tags are read from the reply before they are stripped (they were stripped first, so no reminder was ever set)
    parseAndScheduleReminder(safeReply, message.author.id, message.channel.id, client, database, message.guild.id);
    // Files asked for: [FILE:name] + code block become real attachments; invented download links lose their link
    const { text: withoutFiles, files } = extractFiles(cleanReply);
    const finalReply = stripFakeLinks(withoutFiles);

    // NEW — buildEmbed now returns array of embeds (multi-embed support)
    const finalEmbeds = buildEmbed(finalReply, message, {
      isError: false, theme, model, latency, tokens, sources: searchSources, lang
    });
    const { AttachmentBuilder, FileBuilder } = require('discord.js');
    const attachments = files.map((f) => new AttachmentBuilder(Buffer.from(f.content, 'utf8'), { name: f.name }));
    const fileParts = files.map((f) => new FileBuilder().setURL(`attachment://${f.name}`));   // V2 shows files through File parts
    const payload = { components: [...finalEmbeds, ...fileParts], files: attachments, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    if (files.length) console.log(`[LYDIA] guild=${message.guild?.id} sent ${files.length} file(s): ${files.map((f) => f.name).join(', ')}`);

    if (thinkingMsg) await thinkingMsg.edit(payload);
    else await message.reply(payload);

    if (client.botStats && message.guild) {
      client.botStats.onLydiaChatProcessed?.(database, message.guild.id);
    }

  } catch (err) {
    console.error(`${C.red}[LYDIA]${C.reset} ${err.message}`);
    const errorEmbeds = buildEmbed(t('lydia.ai_error', lang), message, { isError: true });
    if (thinkingMsg) await thinkingMsg.edit({ components: errorEmbeds, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
    else await message.reply({ components: errorEmbeds, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
  } finally {
    messageProcessingLocks.delete(key);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRUNE
// ═══════════════════════════════════════════════════════════════════════════════

function pruneOldConversations(database) {
  try {
    const result = database.prepare(`
      DELETE FROM lydia_conversations WHERE timestamp < ?
    `).run(Math.floor(Date.now() / 1000) - (7 * 86400));
    if (result.changes > 0) console.log(`${C.green}[LYDIA]${C.reset} ${result.changes} old messages pruned`);
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOGGLE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

// ─── The /lydia card: state here, active channels, plan and today's use, with buttons ───
function statusCard(client, guild, channelId, userId, member, lang, notice) {
  const L = (k, v) => t('lydia.' + k, lang, v || {});
  const where = guild.channels.cache.get(channelId) || guild;
  const I = (k) => icon(k, where);
  const ss = client.getServerSettings?.(guild.id) || {};
  const serverOff = ss.ai_enabled === 0 || ss.aiEnabled === false;
  const premium = isPremium(client.db, guild.id);
  const active = activeChannels(client, guild);
  const answering = premium ? active : active.slice(0, CFG.FREE_CHANNELS);
  const on = active.includes(channelId);
  const bot = guild.members.me?.displayName || client.user?.username || 'Archon';
  const chName = guild.channels.cache.get(channelId)?.name;

  let state;
  if (serverOff) state = `${I('warn')} ${L('c_server_off')}`;
  else if (on && !answering.includes(channelId)) state = `${I('warn')} ${L('c_not_answering', { n: CFG.FREE_CHANNELS, list: answering.map((id) => `<#${id}>`).join(', ') })}`;
  else if (on) state = `${I('on')} ${L('c_on')}\n-# ${L('how_mention', { bot })}`;
  else state = `${I('off')} ${L('c_off')}`;

  const head = [
    notice ? `-# ${notice}` : null,
    `-# ${guild.name}${chName ? ` · #${chName}` : ''}`,
    `## ${I('sparkle')} Lydia`,
    state,
  ].filter(Boolean).join('\n');

  const list = active.length ? active.slice(0, 10).map((id) => `<#${id}>`).join(', ') + (active.length > 10 ? '…' : '') : L('c_none');
  const lines = [`${I('ch_title')} **${L('c_channels')}** · ${list}${premium ? '' : ` ${L('c_count', { n: Math.min(active.length, CFG.FREE_CHANNELS), max: CFG.FREE_CHANNELS })}`}`];
  if (premium) {
    let model = PREMIUM_MODEL.name;
    try { const m = getGuildModel(client.db, guild.id); if (m && m !== 'auto') model = MODEL_POOL.find((x) => x.id === m)?.name || model; } catch {}
    lines.push(`${I('star')} **${L('c_premium')}** · ${L('c_premium_desc', { model })}`);
  } else {
    const use = usageOf(client.db, guild.id, userId);
    const fill = Math.min(10, Math.round((use.server / CFG.FREE_SERVER_DAILY) * 10));
    lines.push(`${I('gift')} **${L('c_free')}** · ${L('c_free_desc', { n: CFG.FREE_DAILY_LIMIT })}`);
    lines.push(`${L('c_today', { used: Math.min(use.server, CFG.FREE_SERVER_DAILY), max: CFG.FREE_SERVER_DAILY })}\n\`${'▰'.repeat(fill)}${'▱'.repeat(10 - fill)}\``);
    lines.push(`-# ${L('c_reset', { me: Math.min(use.me, CFG.FREE_DAILY_LIMIT), max: CFG.FREE_DAILY_LIMIT })}`);
  }

  const row = new ActionRowBuilder();
  if (member && require('../lib/access').can(member, 'settings').ok) {
    row.addComponents(on
      ? new ButtonBuilder().setCustomId(`lyd:toggle:${channelId}`).setStyle(ButtonStyle.Danger).setLabel(L('btn_off_here')).setEmoji(I('off'))
      : new ButtonBuilder().setCustomId(`lyd:toggle:${channelId}`).setStyle(ButtonStyle.Success).setLabel(L('btn_on_here')).setEmoji(I('on')));
  }
  row.addComponents(
    new ButtonBuilder().setCustomId('lyd:mem').setStyle(ButtonStyle.Secondary).setLabel(L('btn_memory')).setEmoji(I('brain')),
    new ButtonBuilder().setCustomId('lyd:forget').setStyle(ButtonStyle.Secondary).setLabel(L('btn_forget')).setEmoji(I('clear')),
  );
  const items = [{ text: head }, { rule: true }, { text: lines.join('\n') }, { row }];
  if (!premium) items.push({ text: `-# ${L('c_upsell')}` });
  return require('../lib/games/v2').card(serverOff ? 0xBA7517 : on ? 0x1D9E75 : 0x95a5a6, items);
}

// Switches her on or off in one channel. Returns the notice to show, or null when nothing changed.
function setChannel(client, guild, channelId, on, lang) {
  const L = (k, v) => t('lydia.' + k, lang, v || {});
  if (!client.lydiaChannels) client.lydiaChannels = {};
  if (on) {
    if (client.lydiaChannels[channelId]) return null;
    if (!isPremium(client.db, guild.id)) {
      const active = activeChannels(client, guild);
      if (active.length >= CFG.FREE_CHANNELS) return { error: L('n_limit_channels', { n: CFG.FREE_CHANNELS, list: active.map((id) => `<#${id}>`).join(', ') }) };
    }
    client.lydiaChannels[channelId] = true;
    try { client.db?.prepare('INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at) VALUES (?, ?, 1, ?)').run(channelId, 'default', Math.floor(Date.now() / 1000)); } catch {}
    return { ok: L('n_on') };
  }
  if (!client.lydiaChannels[channelId]) return null;
  delete client.lydiaChannels[channelId];
  try { client.db?.prepare('UPDATE lydia_agents SET is_active = 0 WHERE channel_id = ?').run(channelId); } catch {}
  return { ok: L('n_off') };
}

// .lydia on/off/status (prefix) — kept for those who type it
async function handleLydiaToggle(client, channelId, guildId, userId, action, respondFn = null) {
  const lang = pickLang(client, guildId, null, userId) || 'en';
  const guild = client.guilds.cache.get(guildId);
  if (!guild || !guild.channels.cache.has(channelId)) {
    if (respondFn) await respondFn({ content: t('lydia.lydia_channel_missing', lang), flags: 64 });
    return;
  }
  const member = await guild.members.fetch(userId).catch(() => null);
  let notice = null;
  if (action === 'on' || action === 'off') {
    const r = setChannel(client, guild, channelId, action === 'on', lang);
    notice = !r ? `${icon('info', guild)} ${t(action === 'on' ? 'lydia.lydia_on_already' : 'lydia.lydia_off_already', lang)}`
      : r.error ? `${icon('no', guild)} ${r.error}` : `${icon('ok', guild)} ${r.ok}`;
  }
  if (respondFn) await respondFn(statusCard(client, guild, channelId, userId, member, lang, notice));
}

// Buttons on the card: lyd:toggle:<channel> (admins), lyd:mem, lyd:forget
async function handleComponent(ix, client) {
  if (!ix.guild) return;
  const lang = pickLang(client, ix.guildId, ix, ix.user.id) || 'en';
  const [, act, channelId] = ix.customId.split(':');
  if (act === 'mem') return handleMemorySubcommand(ix, client.db, true, client);
  if (act === 'forget') return forgetMemories(ix, client.db, client);
  if (act === 'toggle') {
    const no = require('../lib/access').deny(ix.member, 'settings', lang);
    if (no) return ix.reply({ content: no, flags: 64, allowedMentions: { parse: [] } });
    const on = !!client.lydiaChannels?.[channelId];
    const r = setChannel(client, ix.guild, channelId, !on, lang);
    const notice = r?.error ? `${icon('no', ix)} ${r.error}` : r?.ok ? `${icon('ok', ix)} ${r.ok}` : null;
    return ix.update(statusCard(client, ix.guild, channelId, ix.user.id, ix.member, lang, notice));
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

function setupLydia(client, database) {
  if (!client || !database || isLydiaInitialized) return;
  isLydiaInitialized = true;

  try {
    database.prepare(`
      CREATE TABLE IF NOT EXISTS lydia_keys (
        guild_id TEXT NOT NULL, service TEXT NOT NULL,
        api_key TEXT NOT NULL, set_by TEXT,
        set_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (guild_id, service)
      )
    `).run();

    database.prepare(`
      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, user_tag TEXT,
        guild_id TEXT, channel_id TEXT NOT NULL, message TEXT NOT NULL,
        execute_at INTEGER NOT NULL, delivered INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run();

    try {
      const cols = database.prepare('PRAGMA table_info(reminders)').all().map(c => c.name);
      if (!cols.includes('user_tag')) {
        database.prepare('ALTER TABLE reminders ADD COLUMN user_tag TEXT').run();
        console.log(`${C.green}[MIGRATION]${C.reset} Added user_tag to reminders`);
      }
      if (!cols.includes('guild_id')) {
        database.prepare('ALTER TABLE reminders ADD COLUMN guild_id TEXT').run();
        console.log(`${C.green}[MIGRATION]${C.reset} Added guild_id to reminders`);
      }
      if (!cols.includes('delivered')) {
        database.prepare('ALTER TABLE reminders ADD COLUMN delivered INTEGER DEFAULT 0').run();
        console.log(`${C.green}[MIGRATION]${C.reset} Added delivered to reminders`);
      }
      if (!cols.includes('created_at')) {
        database.prepare('ALTER TABLE reminders ADD COLUMN created_at INTEGER DEFAULT (strftime("%s", "now"))').run();
        console.log(`${C.green}[MIGRATION]${C.reset} Added created_at to reminders`);
      }
      if (cols.includes('status') && !cols.includes('delivered')) {
        console.log(`${C.yellow}[MIGRATION]${C.reset} Old reminders schema detected \u2014 migrating...`);
        database.prepare('ALTER TABLE reminders RENAME TO reminders_old').run();
        database.prepare(`
          CREATE TABLE reminders (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, user_tag TEXT,
            guild_id TEXT, channel_id TEXT NOT NULL, message TEXT NOT NULL,
            execute_at INTEGER NOT NULL, delivered INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
          )
        `).run();
        database.prepare(`
          INSERT INTO reminders (id, user_id, channel_id, message, execute_at, delivered)
          SELECT id, user_id, channel_id, message, execute_at,
            CASE WHEN status = 'completed' THEN 1 ELSE 0 END
          FROM reminders_old
        `).run();
        database.prepare('DROP TABLE reminders_old').run();
        console.log(`${C.green}[MIGRATION]${C.reset} Reminders table migrated successfully`);
      }
    } catch (migrateErr) {
      console.log(`${C.yellow}[MIGRATION]${C.reset} Reminders migration check: ${migrateErr.message}`);
    }

    database.prepare(`
      CREATE TABLE IF NOT EXISTS lydia_memory (
        user_id TEXT, guild_id TEXT NOT NULL DEFAULT '', memory_key TEXT, memory_value TEXT, updated_at INTEGER,
        PRIMARY KEY (user_id, guild_id, memory_key)
      )
    `).run();

    database.prepare(`
      CREATE TABLE IF NOT EXISTS lydia_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT, guild_id TEXT, user_id TEXT, user_name TEXT,
        role TEXT, content TEXT, timestamp INTEGER
      )
    `).run();

    database.prepare(`
      CREATE TABLE IF NOT EXISTS lydia_agents (
        channel_id TEXT PRIMARY KEY, agent_key TEXT,
        is_active INTEGER DEFAULT 0, updated_at INTEGER
      )
    `).run();

    // Memories are kept per server (they used to follow a member everywhere, so what they told Lydia on one server
    // could come up on another). Older rows keep guild_id '': listed in the member's memory card, never used in answers.
    try {
      const mcols = database.prepare('PRAGMA table_info(lydia_memory)').all().map(c => c.name);
      if (!mcols.includes('guild_id')) {
        database.exec(`
          CREATE TABLE lydia_memory_v2 (user_id TEXT, guild_id TEXT NOT NULL DEFAULT '', memory_key TEXT, memory_value TEXT, updated_at INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id, memory_key));
          INSERT OR IGNORE INTO lydia_memory_v2 (user_id, guild_id, memory_key, memory_value, updated_at) SELECT user_id, '', memory_key, memory_value, updated_at FROM lydia_memory;
          DROP TABLE lydia_memory;
          ALTER TABLE lydia_memory_v2 RENAME TO lydia_memory;`);
        console.log(`${C.green}[MIGRATION]${C.reset} Lydia memories are now kept per server`);
      }
    } catch (e) { console.error(`${C.red}[MIGRATION]${C.reset} lydia_memory:`, e.message); }

    try {
      const cols = database.prepare('PRAGMA table_info(lydia_conversations)').all().map(c => c.name);
      if (!cols.includes('guild_id')) {
        database.prepare('ALTER TABLE lydia_conversations ADD COLUMN guild_id TEXT').run();
        console.log(`${C.green}[MIGRATION]${C.reset} Added guild_id to lydia_conversations`);
      }
    } catch (e) {}

    client.lydiaChannels = {};
    const active = database.prepare('SELECT channel_id FROM lydia_agents WHERE is_active = 1').all();
    for (const ch of active) client.lydiaChannels[ch.channel_id] = true;

    // Reminders are delivered by plugins/reminder.js tick() (every 30 s)

    setInterval(() => pruneOldConversations(database), 86400000);

    console.log(`${C.green}[LYDIA]${C.reset} ${active.length} channels restored. ${Object.keys(LANG_NAMES).length} languages supported. Ready!`);
  } catch (err) {
    console.error(`${C.red}[LYDIA INIT]${C.reset} ${err.message}`);
    isLydiaInitialized = false;
    return;
  }

  client.on('messageCreate', async (message) => {
    if (!message || message.author?.bot) return;
    try {
      await handleLydiaMessage(message, client, database);
    } catch (eventErr) {
      console.error(`${C.red}[LYDIA]${C.reset} ${eventErr.message}`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function runLydiaCommand(client, message, args, database, serverSettings, usedCommand) {
    const guildId = message.guild?.id ?? 'DM';
  if (!message.guild) return;
  const lang = serverSettings?.language && serverSettings.language !== 'auto' ? serverSettings.language : 'en';
  const sub = args[0]?.toLowerCase() || 'status';
  if (sub === 'memory') return await handleMemorySubcommand(message, database, false, client);
  if (sub === 'forget') return await forgetMemories(message, database, client);
  // switching Lydia on or off is a server setting: Manage Server (lib/access); the card itself is for everyone
  if (sub === 'on' || sub === 'off') { const _no = require('../lib/access').deny(message.member, 'settings', lang); if (_no) return message.reply({ content: _no, allowedMentions: { parse: [] } }).catch(() => {}); }


  if (!['on', 'off', 'status'].includes(sub)) return;
  await handleLydiaToggle(client, message.channel.id, message.guild.id, message.author.id, sub, async (payload) => message.reply(payload));
}

const slashCommand = new SlashCommandBuilder()
  .setName('lydia')
  .setDescription('\u{2728} Archon AI in this channel: state, limits, your memory')
  .setDescriptionLocalizations({ fr: '\u{2728} L\u2019IA Archon dans ce salon : \u00e9tat, limites, ta m\u00e9moire' });

// /lydia: the card, privately. Admins get the switch for this channel; everyone gets their memory buttons.
async function executeSlashCommand(interaction, client) {
  const lang = pickLang(client, interaction.guildId, interaction, interaction.user.id) || 'en';
  if (!interaction.guild) return interaction.reply({ content: t('lydia.no_guild', lang), flags: 64 });
  return interaction.reply({ ...statusCard(client, interaction.guild, interaction.channelId, interaction.user.id, interaction.member, lang), flags: MessageFlags.IsComponentsV2 | 64 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  name: 'lydia',
  aliases: ['ai', 'neural'],
  description: '\u{1F9E0} Friendly AI assistant \u2014 multilingual, remembers facts, web-enabled',
  category: 'SYSTEM',
  cooldown: 5000,
  run: runLydiaCommand,
  MODEL_POOL,
  execute: executeSlashCommand,
  data: slashCommand,
  handleComponent,
  setChannel,
  activeChannels,
  usageOf,
  CFG,
  setupLydia,
  webSearch,
  generateAIResponse,
  detectUserLanguage,
  validateResponse,
  scrubSecrets,
};

console.log(`${C.green}[LYDIA]${C.reset} AI Engine v2.6 loaded — Beautiful formatting | Anti-hallucination | ${Object.keys(LANG_NAMES).length} languages | Model fallback | Response cache`);
