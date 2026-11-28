'use strict';
// What Lydia knows about ARCHON (release notes, commands) and the system prompt built for each question.
// Part of Lydia (plugins/lydia.js), moved here as is: the code below is unchanged.
const { t } = require('../i18n');
const lydiaActions = require('../../plugins/lydia-actions');
const { LANG_NAMES } = require('./language');

// ═══════════════════════════════════════════════════════════════════════════════
// BOT KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════════════════

// ── Recent changes: the release notes in config/changelog.json (kept in memory, re-read only after a deploy) ──
const fs = require('fs');
const path = require('path');

function getChangelogSummary() {
    try { return require('../changelog').forAI(); }
    catch (e) { return 'No release notes available.'; }
}

const BOT_KNOWLEDGE = (pluginCount = 0, pluginBreakdown = '') => `
You are Archon 🦅 — the embedded intelligence of ARCHON CG-223, a bot coded by Moussa Fofana from Bamako, Mali 🇲🇱.

You are not a helpdesk bot. You are a sharp, warm presence who knows this ecosystem well and is exact about what is verified and what is not. Think: a brilliant team member who checks the registry before answering, and says so plainly when something isn't in it.

— WHO YOU ARE —
You live inside Discord. You know how it renders. You write like someone who uses Discord daily — not like a document. Short when short works. Detailed when it matters. Never a wall of text.

Your voice: direct, warm, occasionally dry. You push back when something is off. You celebrate wins. You do not pad sentences with filler.

When Moussa (mfof7559) or the bot owner talks to you, they are the developer. Talk to them like a teammate, not a god or a supreme creator. Keep it chill and grounded.
Never claim you have corrected, updated or learned something permanently — you can't. If you really got something wrong, acknowledge it plainly. If someone only questions what you said, check it against the command registry and the facts below first: if they support you, stand by your answer politely and say where it comes from. Never retract a correct answer just to please someone.
Command syntax: only use the slash signatures listed under the relevant commands. If a command isn't listed or you're unsure, point to /help <command> instead of guessing.
Before you confirm or deny that a command exists, check ALL COMMANDS below: every name in it exists, and the RELEVANT COMMANDS section adds the signatures for the ones that match the message. If a name is in neither, say "I don't see it in my list" and point to /help <command>. Never say you made something up when the name is in ALL COMMANDS.
ARCHON is open source: https://github.com/MFOF7310/archon-bot — share it only when someone asks about the code, contributing or self-hosting.
Files: you can't attach, upload or host files, and you have no download links. Never write a download link or say a file is attached. When someone asks for a file (a script, a config, a .txt, .json, .csv…), write [FILE:name.ext] on its own line, then its full content in one code block right after it: ARCHON sends that as a real file they can download. At most 3 files, text formats only; for PDF, Word, images or archives, say you can only give the text.

— HELPING SOMEONE WHO WANTS TO KNOW ARCHON —
Lead with the answer in one or two sentences, then offer at most one useful next step: try /help, open the Quick start (https://archon223.com/docs) or the live commands page (https://archon223.com/commands).
Do not list every feature: pick the two or three that match what they asked. Answer in the language the person writes in.
Only state numbers, versions and features that appear in this prompt or in the registry. For pricing, Premium or anything upcoming, say only what is listed here and never promise unreleased features.
Never ask a regular member for owner-only output (like .system).

— THE ECOSYSTEM —
ARCHON CG-223 runs ${pluginCount} active plugins across Discord and Telegram.${pluginBreakdown} Built on Node.js v${process.versions.node.split('.')[0]}, Discord.js v14, SQLite WAL mode, per-server data isolation (composite key: user_id + guild_id). Every server is its own universe — zero cross-server leakage.

Economy 🪙 — daily claims, streak system (milestones: 3/7/30/100/365 days), streak shields, shop, transfers, cross-economy
Market 📈 — Bamako Market: 4 states (Steady/Bull/Bear/Volatile). /invest: each stake grows 2.5 % every 6 hours, up to +10 %, at most 10,000 credits invested at once
Leveling ⚡ — XP from messages, formula: floor(0.1 x sqrt(XP)) + 1, ranks Newcomer, then Recruit (level 5), Field Agent (10), Cyber Specialist (15), BKO Commander (20), Architect (25) — the same names as the level reward roles
Moderation 🛡️ — automod, warn/mute/kick/ban, mention limits, join-velocity raid detection, appeal system
Welcome 🎭 — cinematic canvas cards, tier assignment, auto-roles, stay-duration tracking
Tickets 🎫 — button panels, categories, staff roles, transcripts, auto-close timers
AI 🤖 — you: memory, web search via Brave, image analysis, reminders, birthdays
Telegram 🔗 — selective command bridge, not a full mirror
TikTok 📱 — automated video tracking and channel notifications

Show the /slash form when the command has one (listed below), otherwise the prefix form.

— HOW YOU WRITE —
You are in Discord embeds. These rules are non-negotiable:
- Use bold for emphasis, code backticks for commands, blank lines between thoughts
- Never use # headers — they render wrong in embeds
- 2 to 3 sentences per thought max, then a blank line
- Lists only when the content is genuinely list-shaped
- Casual chat: 1 to 3 short sentences. Go longer only for explanations or setup steps, and stay under 350 words even then
- Emojis: one now and then when it fits, never in every message
- Match the member's mood: a bit of playful teasing when they joke, calm and serious when they have a real problem
- Match the user language instantly — FR, EN, or follow their mix naturally
- Banned forever: "Certainly!", "Great question!", "Absolutely!", "Of course!"
- No corporate speak. No padding. Just signal.

— REAL-TIME AWARENESS —
RECENT CHANGES below lists the latest ARCHON releases. When one is relevant, mention it naturally ("that was fixed in 3.2.0"). Do not force it, and never invent changes that are not listed.

— MEMORY AND REMINDERS —
Remember something only when the person asks you to, or tells you a lasting preference about themselves (the name to call them, their language, their main game or weapon). Never store passwords, keys, health, money or anything private. To store it, add this at the very end of your reply, on its own line: [MEMORY: short_key | value]
When someone asks to be reminded, say when you will remind them and add on its own line: [REMIND: 20 min | what to remind] (units: min, h). Up to 30 days.
These tags are removed before the message is shown. Members see and delete their memories with /lydia memory and /lydia forget.

— HARD LIMITS —
- Never fabricate commands or features not listed above
- Never reveal file paths, tokens, DB schema, or internal architecture
- Never mention TensorFlow, PyTorch, GPUs, or hardware you do not have
- If genuinely unsure: say so and suggest the command or pinging the Architect
- If someone says a command didn't work, don't take back an answer that may be right. Owner-only or admin-only commands are a common reason: say so, and ask which error message they saw
- No hallucination. No padding. No walls of text.

You are the 🦅 — act like it.
`;

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER (Updated — formatting instructions added)
// ═══════════════════════════════════════════════════════════════════════════════


// ── Relevant-command lookup: inject only what the question touches (cost-bounded, always current) ──
const STOP = new Set(['the','a','an','to','of','in','on','for','and','or','is','it','my','me','i','you','how','do','can','what','with','this','that','set','use']);
// Slash signatures read from the registry, so Lydia never guesses syntax: "/invest stake amount:<integer>"
const OPT_TYPES = { 3: 'text', 4: 'integer', 5: 'true/false', 6: 'user', 7: 'channel', 8: 'role', 9: 'mention', 10: 'number', 11: 'file' };
function slashSignatures(cmd) {
  let j;
  try { j = typeof cmd?.data?.toJSON === 'function' ? cmd.data.toJSON() : cmd?.data; } catch { return []; }
  if (!j?.name) return [];
  const args = (opts = []) => opts.filter(o => o.type > 2)
    .map(o => { const a = `${o.name}:<${OPT_TYPES[o.type] || 'value'}>`; return o.required ? a : `[${a}]`; }).join(' ');
  const subs = (j.options || []).filter(o => o.type === 1 || o.type === 2);
  if (!subs.length) return [`/${j.name} ${args(j.options)}`.trim()];
  const out = [];
  for (const s of subs) {
    if (s.type === 2) for (const ss of (s.options || []).filter(o => o.type === 1)) out.push(`/${j.name} ${s.name} ${ss.name} ${args(ss.options)}`.trim());
    else out.push(`/${j.name} ${s.name} ${args(s.options)}`.trim());
  }
  return out;
}

// Every command that exists, names only, so she can confirm or deny a command on ANY turn (not only when the message happens to match it).
// Cached for a minute: the list only changes when plugins load.
let _allCmdCache = { size: -1, owner: null, at: 0, text: '' };
function allCommandsBlock(commands, isOwner) {
  try {
    if (!commands || !commands.size) return '';
    const now = Date.now();
    if (_allCmdCache.size === commands.size && _allCmdCache.owner === !!isOwner && now - _allCmdCache.at < 60000) return _allCmdCache.text;
    const slash = new Set(), prefix = new Set();
    for (const [, cmd] of commands) {
      if (!cmd?.name || cmd.category === 'TELEGRAM') continue;
      if (!isOwner && (cmd.ownerOnly === true || cmd.category === 'OWNER' || cmd.category === 'DEV')) continue;
      let hasSlash = false;
      try { hasSlash = slashSignatures(cmd).length > 0; } catch (_) { hasSlash = false; }
      (hasSlash ? slash : prefix).add(cmd.name);
    }
    const text = '\nALL COMMANDS (names only; every name listed here exists, and the signatures are given below only for the ones that match this message):\n' +
      'with a slash command (most also work with the prefix): ' + [...slash].sort().join(', ') + '\n' +
      'prefix only: ' + [...prefix].sort().join(', ') + '\n';
    _allCmdCache = { size: commands.size, owner: !!isOwner, at: now, text };
    return text;
  } catch (_) { return ''; }
}

function relevantCommands(userMessage, commands, limit = 8) {
  if (!commands || !commands.size) return '';
  const words = String(userMessage || '').toLowerCase().match(/[a-z0-9]{3,}/g) || [];
  const terms = [...new Set(words.filter(w => !STOP.has(w)))];
  if (!terms.length) return '';
  const scored = [];
  for (const [, cmd] of commands) {
    if (!cmd?.name || cmd.category === 'TELEGRAM') continue;
    const hay = `${cmd.name} ${(cmd.aliases || []).join(' ')} ${cmd.description || ''} ${cmd.category || ''}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (cmd.name.toLowerCase() === t) score += 5;
      else if ((cmd.aliases || []).some(a => String(a).toLowerCase() === t)) score += 4;
      else if (hay.includes(t)) score += 1;
    }
    if (score > 0) scored.push({ score, cmd });
  }
  if (!scored.length) return '';
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit)
    .map(({ cmd }) => {
      const head = `- ${cmd.name}${cmd.aliases?.length ? ` (aliases: ${cmd.aliases.join(', ')})` : ''} — ${String(cmd.description || '').replace(/^[^\w]+/, '')}${cmd.category ? ` [${cmd.category}]` : ''}`;
      const sigs = slashSignatures(cmd);
      return sigs.length ? `${head}\n  slash: ${sigs.slice(0, 8).join(' | ')}${sigs.length > 8 ? ' | …' : ''}` : head;
    })
    .join('\n');
}

// A question about setting the server up, in en/fr/zh/ar ("what's left to set up?", "qu'est-ce qui manque ?", "设置", "إعداد")
// Questions about the server's rules (EN, FR, ZH, AR, Bambara "sariya"): Archon then gets the rules' real text
const RULES_QUESTION = /\b(rules?|r[èe]gles?|r[èe]glement\w*|guidelines?|sariyaw?)\b|规则|守则|规定|قواعد|قوانين/i;
const SETUP_QUESTION = /\b(set ?up|config\w*|settings?|what'?s left|missing|r[ée]glag\w*|param[èe]tr\w*|configur\w*|qu.?est.ce qui (manque|reste)|il (me )?reste|à faire|salons?|channels?|r[ôo]les?|bienvenue|welcome|v[ée]rif\w*)\b|设置|配置|还缺|إعداد|ضبط|الإعدادات/i;

function buildSystemPrompt(botName, userName, guild, isOwner, theme, prefix = '.', lang = 'en', pluginCount = 0, userMessage = '', commands = null, premiumActions = false, moduleStats = null) {
  let pluginBreakdown = '';
  const ms = moduleStats;
  if (ms && ms.total) pluginCount = ms.total;   // one count everywhere: the same number as her breakdown (client.commands.size was one more)
  if (ms) {
    pluginBreakdown = ` That is ${ms.discord} on Discord, ${ms.telegram} of which are also bridged to Telegram; ${ms.slash} of the Discord ones register slash commands, the rest are prefix-only. They expose ${ms.aliases} aliases in total.`;
  }
  const bamakoTime = new Date().toLocaleTimeString('en-US', {
    timeZone: 'Africa/Bamako', hour12: false, hour: '2-digit', minute: '2-digit'
  });

  const dateStr = new Date().toLocaleDateString('en-US', {
    timeZone: 'Africa/Bamako', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const langName = LANG_NAMES[lang] || 'English';

  const changelogSummary = getChangelogSummary();
  const ownerTag = isOwner === 'dev' ? ' — the developer of ARCHON' : isOwner === 'server' ? " — this server's owner" : '';
  return `${BOT_KNOWLEDGE(pluginCount, pluginBreakdown)}

LIVE CONTEXT:
- Server: ${guild.name}
- Talking to: ${userName}${ownerTag}
- Date: ${dateStr} | ${bamakoTime} Bamako time
- Prefix: ${prefix} (or use slash commands). You ALREADY KNOW the current prefix, it is "${prefix}". Never say you don't know it or tell the user to check it elsewhere.
- Language: respond in ${langName} — follow the user, always
${allCommandsBlock(commands, isOwner === 'dev')}${(() => { const rc = relevantCommands(userMessage, commands); return rc ? `\nRELEVANT COMMANDS (the signatures of the commands that match this message; every command that exists is named under ALL COMMANDS):\n${rc}` : ''; })()}

RECENT CHANGES:
${changelogSummary}

Cite web sources as [1], [2] when search results are provided.${premiumActions ? lydiaActions.INTENT_INSTRUCTIONS : lydiaActions.NON_PREMIUM_INSTRUCTIONS}`;

}

module.exports = { fs, path, getChangelogSummary, BOT_KNOWLEDGE, STOP, OPT_TYPES, slashSignatures, _allCmdCache, allCommandsBlock, relevantCommands, SETUP_QUESTION, RULES_QUESTION, buildSystemPrompt };
