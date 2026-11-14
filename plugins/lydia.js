'use strict';

const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
let axios = null;
try { axios = require('axios'); }
catch (e) { console.warn('[LYDIA] axios not installed — AI/web features degraded, but /lydia still registers. Fix: npm i axios'); }

let _isPremium = null;
function isPremium(db, guildId) {
  try {
    if (!_isPremium) _isPremium = require('./premium').isPremium;
    return _isPremium(db, guildId);
  } catch { return false; }
}

const lydiaActions = require('./lydia-actions');
const { isElevated: _isElevated } = (() => { try { return require('./automod'); } catch { return { isElevated: () => false }; } })();

// Per-guild custom API keys (premium) — falls back to global .env when unset
function getGuildKey() { return null; }   // custom keys were removed (unused); kept so older callers still work
function _unusedGuildKey(database, guildId, service) {
  try {
    if (!database || !guildId) return null;
    const row = database.prepare('SELECT api_key FROM lydia_keys WHERE guild_id = ? AND service = ?').get(String(guildId), service);
    return row?.api_key || null;
  } catch { return null; }
}

function getGuildModel(database, guildId) {
  try {
    if (!database || !guildId) return null;
    const row = database.prepare('SELECT lydia_model FROM server_settings WHERE guild_id = ?').get(String(guildId));
    return row?.lydia_model || null;
  } catch { return null; }
}

const CFG = {
  COOLDOWN_TIME: 3000,
  MAX_HISTORY: 8,
  MAX_MEMORY_PER_USER: 25,
  CHANNEL_COOLDOWN: 1500,
  MAX_TOKENS: 700,
  RESPONSE_TIMEOUT: 15000,
  MAX_REPLY_CHARS: 3600,     // a Components V2 message holds 4000 characters of text in total
  FREE_DAILY_LIMIT: 30,      // messages per member per day on servers without Premium (protects the OpenRouter bill)
};

let isLydiaInitialized = false;
const userCooldowns = new Map();
const channelCooldowns = new Map();
const messageProcessingLocks = new Set();

// ═══════════════════════════════════════════════════════════════════════════════
// ANSI COLORS
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', blue: '\x1b[34m', reset: '\x1b[0m'
};

// One look for every answer: ARCHON's gold, red only for real errors
const THEMES = { default: { name: 'Archon', emoji: '\u2728' } };
const detectTheme = () => THEMES.default;

// ═══════════════════════════════════════════════════════════════════════════════
// UNIVERSAL LANGUAGE DETECTOR
// ═══════════════════════════════════════════════════════════════════════════════

// Which language the member wrote in. Returns null when the message gives no clear signal (an emoji, a name,
// "ok"), so the caller falls back to the member's /mylang or the server language. It used to answer English
// messages in Spanish as soon as they contained "no" or "son", and in French for any accented name ("Pokémon").
const LANG_WORDS = {
  fr: /\b(je|tu|il|elle|nous|vous|ils|est|sont|suis|c'est|j'ai|t'es|les|des|une|du|au|aux|pour|avec|dans|sur|pas|mais|oui|non|merci|bonjour|salut|comment|quoi|pourquoi|quand|parce|donc|alors|aussi|encore|toujours|jamais|rien|tout|très|bien|faire|peux|veux|stp|svp|frère|wesh)\b/g,
  en: /\b(i|you|he|she|we|they|is|are|am|was|were|the|and|but|what|why|how|when|where|who|can|could|would|should|please|thanks|thank|hello|hey|this|that|have|has|do|does|don't|it's|i'm|my|your|with|for|about)\b/g,
  es: /\b(yo|tú|usted|nosotros|ellos|está|estás|estoy|eres|soy|hola|gracias|qué|cómo|dónde|cuándo|porque|también|siempre|nunca|pero|muy|quiero|puedes|necesito|ayuda)\b/g,
};
function detectUserLanguage(text) {
  const t = String(text || '').toLowerCase().replace(/<[@#&!:a-z0-9_]+>/g, ' ').trim();
  if (!t) return null;
  if (/[\u0600-\u06FF]/.test(t)) return 'ar';
  if (/[\u3040-\u30FF]/.test(t)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(t)) return 'zh';
  const score = {};
  for (const [l, re] of Object.entries(LANG_WORDS)) score[l] = (t.match(re) || []).length;
  if (/[àâçèêëîïôûùœ]/.test(t)) score.fr += 1;
  if (/[ñ¿¡]/.test(t)) score.es += 2;
  const best = Object.entries(score).sort((x, y) => y[1] - x[1]);
  if (!best[0][1] || best[0][1] === best[1][1]) return null;
  return best[0][0];
}

const LANG_NAMES = {
  en: 'English', fr: 'French', es: 'Spanish', ar: 'Arabic',
  zh: 'Chinese', ja: 'Japanese', de: 'German', pt: 'Portuguese',
  ru: 'Russian', hi: 'Hindi', tr: 'Turkish', ko: 'Korean',
  it: 'Italian', nl: 'Dutch', pl: 'Polish', sv: 'Swedish',
  da: 'Danish', no: 'Norwegian', fi: 'Finnish', el: 'Greek',
  he: 'Hebrew', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
  ms: 'Malay', tl: 'Tagalog', sw: 'Swahili', bn: 'Bengali',
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOT KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════════════════

// ── Recent changes: the release notes in config/changelog.json (kept in memory, re-read only after a deploy) ──
const fs = require('fs');
const path = require('path');

function getChangelogSummary() {
    try { return require('../lib/changelog').forAI(); }
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

— HELPING SOMEONE WHO WANTS TO KNOW ARCHON —
Lead with the answer in one or two sentences, then offer at most one useful next step: try /help, open the Quick start (https://bamako-steel-dev.xyz/docs) or the live commands page (https://bamako-steel-dev.xyz/commands).
Do not list every feature: pick the two or three that match what they asked. Answer in the language the person writes in.
Only state numbers, versions and features that appear in this prompt or in the registry. For pricing, Premium or anything upcoming, say only what is listed here and never promise unreleased features.
Never ask a regular member for owner-only output (like .system).

— THE ECOSYSTEM —
ARCHON CG-223 runs ${pluginCount} active plugins across Discord and Telegram.${pluginBreakdown} Built on Node.js v${process.versions.node.split('.')[0]}, Discord.js v14, SQLite WAL mode, per-server data isolation (composite key: user_id + guild_id). Every server is its own universe — zero cross-server leakage.

Economy 🪙 — daily claims, streak system (milestones: 3/7/30/100/365 days), streak shields, shop, transfers, cross-economy
Market 📈 — Bamako Market: 4 states (Steady/Bull/Bear/Volatile). /invest: each stake grows 2.5 % every 6 hours, up to +10 %, at most 10,000 credits invested at once
Leveling ⚡ — XP from messages, formula: floor(0.1 x sqrt(XP)) + 1, ranks from Initiate to Supreme Architect
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
- Under 350 words unless depth was explicitly requested
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
- No hallucination. No padding. No walls of text.

You are the 🦅 — act like it.
`;

// ═══════════════════════════════════════════════════════════════════════════════
// CREDENTIAL SCRUBBER
// ═══════════════════════════════════════════════════════════════════════════════

const SECRET_PATTERNS = [
  /[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g,
  /sk-[a-zA-Z0-9]{20,}/gi,
  /Bearer\s+[a-zA-Z0-9_-]{20,}/gi,
  /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/g,
  /mfa\.[\w-]{84}/g,
  /process\.env\.[A-Z_]+/gi,
  /__[A-Z_]+__/g,
  /\/home\/[^\s]+/g,
  /\/root\/[^\s]+/g,
  /C:\\\\[^\s]+/g,
  /(mysql|postgres|mongodb):\/\/[^:]+:[^@]+@/gi,
];

function scrubSecrets(text) {
  if (!text) return text;
  let cleaned = text;
  for (const pattern of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  }
  cleaned = cleaned.replace(/OPENROUTER_API_KEY|BRAVE_API_KEY|DISCORD_TOKEN|CLIENT_SECRET|MONGO_URI|DATABASE_URL|JWT_SECRET/gi, '[REDACTED]');
  return cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANTI-HALLUCINATION VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

const HALLUCINATION_PATTERNS = [
  /\b(nano banana|nano agent|self-aware|conscious|sentient|emotion engine|dream mode|hologram|quantum computing)\b/gi,
  /\b(i can see (the |your )?(source code|config|env|environment|token|password|secret))/gi,
  /\b(i have access to (the |your )?(server|database|file system|logs|config))/gi,
  /(\/root\/cloud-gaming|cloud-gaming-223-digital-engine|\/opt\/dashboard)/gi,
];

function validateResponse(response, lang = 'en') {
  if (!response) return { ok: false, cleaned: null, reason: 'empty' };

  let score = 0;
  let reasons = [];

  for (const pattern of HALLUCINATION_PATTERNS) {
    const matches = response.match(pattern);
    if (matches) {
      score += matches.length * 2;
      reasons.push(`Blocked pattern: ${matches[0].substring(0, 30)}`);
    }
  }

  if (/\b(my source code|the source code|source code of|i'm written in|i was built with|my code is|my architecture includes)\b/gi.test(response)) {
    score += 5;
    reasons.push('Source code claim');
  }

  // Talking about .env files or environment variables is normal coding help; only a claim about the bot's own is blocked
  if (/\b(my|archon'?s|the bot'?s) (\.env|environment variables?|config file|api keys?|token)\b/gi.test(response)) {
    score += 5;
    reasons.push('Own config reference');
  }

  const cleaned = scrubSecrets(response);

  if (score >= 3) {
    const fallback = t('lydia.fallback_' + (1 + Math.floor(Math.random() * 3)), lang);
    console.log(`${C.red}[HALLUCINATION BLOCKED]${C.reset} Score: ${score} | ${reasons.join(', ')}`);
    return { ok: false, cleaned: fallback, reason: reasons.join('; ') };
  }

  return { ok: true, cleaned };
}

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
// WEB SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

async function webSearch(query, keyOverride = null) {
  const apiKey = keyOverride || process.env.BRAVE_API_KEY;
  if (!apiKey || !axios) return null;
  try {
    const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json'
      },
      params: { q: query, count: 5, text_decorations: false, safesearch: 'strict' },
      timeout: 10000
    });
    if (!res.data?.web?.results?.length) return null;
    const results = res.data.web.results.slice(0, 5);
    const formatted = results.map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.description}`).join('\n');
    const sources = results.map(r => ({ title: r.title, url: r.url }));
    return { formatted, sources };
  } catch (e) {
    console.log(`${C.yellow}[SEARCH FAIL]${C.reset} ${e.message?.substring(0, 60)}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL POOL (Parallel racing)
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_POOL = [
  { id: 'anthropic/claude-sonnet-5.5',              emoji: '🤖', name: 'Claude Sonnet 5.5', tier: 'premium' },
  { id: 'openai/gpt-4o',                            emoji: '🔵', name: 'GPT-4o', tier: 'premium' },
  { id: 'anthropic/claude-haiku-5.5',               emoji: '🤖', name: 'Claude Haiku 5.5', tier: 'fast' },
  { id: 'openai/gpt-4o-mini',                       emoji: '💙', name: 'GPT-4o mini', tier: 'fast' },
  { id: 'google/gemini-2.5-flash',                  emoji: '🎋', name: 'Gemini 2.5 Flash', tier: 'fast' },
  { id: 'deepseek/deepseek-chat-v3-0324',           emoji: '🔷', name: 'DeepSeek V3', tier: 'fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct',        emoji: '🧠', name: 'Llama 3.3 70B', tier: 'fast' },
  { id: 'qwen/qwen-2.5-72b-instruct',               emoji: '🟡', name: 'Qwen 2.5 72B', tier: 'fast' },
  { id: 'mistralai/mistral-large-4-0',             emoji: '✨', name: 'Mistral Large 4', tier: 'reliable' },
];

const PREMIUM_MODEL = {
  id: 'anthropic/claude-sonnet-5.5',
  emoji: '🤖',
  name: 'Claude Sonnet 5.5',
  tier: 'premium'
};

// A model that just failed is skipped for a while instead of costing every message 15 s again:
// 5 minutes after a timeout or a busy answer, 6 hours when OpenRouter says the model doesn't exist.
const benched = new Map();
const VISION = new Set(['anthropic/claude-sonnet-5.5', 'anthropic/claude-haiku-5.5', 'openai/gpt-4o', 'openai/gpt-4o-mini', 'google/gemini-2.5-flash']);
const TOTAL_BUDGET = 30000;
function bench(model, status) {
  const long = status === 400 || status === 404;
  benched.set(model.id, Date.now() + (long ? 6 * 3600000 : 300000));
}
const isBenched = (m) => (benched.get(m.id) || 0) > Date.now();

async function tryModel(model, messages, timeoutMs, keyOverride = null) {
  const apiKey = keyOverride || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      console.log(`${C.yellow}[TIMEOUT]${C.reset} ${model.id}`);
      bench(model, 'timeout');
      resolve(null);
    }, timeoutMs);

    try {
      const startTime = Date.now();
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: model.id,
        messages,
        temperature: 0.65,
        max_tokens: CFG.MAX_TOKENS,
        top_p: 0.9
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/MFOF7310',
          'X-Title': 'Architect-CG-223',
          'Content-Type': 'application/json'
        },
        timeout: timeoutMs
      });

      clearTimeout(timer);
      const latency = Date.now() - startTime;
      const content = response.data?.choices?.[0]?.message?.content;

      if (content && content.trim().length > 0) {
        const approxTokens = Math.ceil(content.length / 4);
        resolve({ content: content.trim(), model, latency, tokens: approxTokens });
      } else {
        resolve(null);
      }
    } catch (e) {
      clearTimeout(timer);
      const status = e.response?.status || 'NET';
      const errMsg = e.response?.data?.error?.message || e.message || 'unknown';
      // A bad key (401/402) is not the model's fault: the next model would fail the same way
      if (status !== 401 && status !== 402) bench(model, status);
      console.log(`${C.yellow}[AI RETRY]${C.reset} ${model.id} | HTTP ${status} | ${errMsg.substring(0, 80)}`);
      resolve(null);
    }
  });
}

async function generateAIResponse(systemPrompt, userMessage, history = [], imageUrl = null, theme = THEMES.default, guildId = null) {
  const messages = [{ role: 'system', content: systemPrompt }];

  if (Array.isArray(history) && history.length > 0) {
    messages.push({
      role: 'system',
      content: `[CONVERSATION HISTORY \u2014 Contextual reference only. Respond to the LATEST message]`
    });
    messages.push(...history.slice(-CFG.MAX_HISTORY).map(h => ({ role: h.role, content: h.content })));
  }

  if (imageUrl) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userMessage },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  // Premium servers may bring their own OpenRouter key — else global .env
  const guildKey = guildId ? getGuildKey(global.client?.db || null, guildId, 'openrouter') : null;

  // Premium servers get Claude Sonnet directly
  const isPremiumGuild = guildId ? isPremium(global.client?.db || null, guildId) : false;

  if (isPremiumGuild) {
    const guildModel = getGuildModel(global.client?.db || null, guildId);
    if (guildModel && guildModel !== 'auto') {
      const chosenModel = MODEL_POOL.find(m => m.id === guildModel);
      if (chosenModel) {
        console.log(`${C.cyan}[AI PREMIUM]${C.reset} Guild model: ${chosenModel.emoji} ${chosenModel.name}...`);
        const result = await tryModel(chosenModel, messages, CFG.RESPONSE_TIMEOUT, guildKey);
        if (result) return result;
        console.log(`${C.yellow}[AI PREMIUM]${C.reset} Guild model failed, falling back to ${PREMIUM_MODEL.name}...`);
      }
    } else {
      console.log(`${C.cyan}[AI PREMIUM]${C.reset} Routing to ${PREMIUM_MODEL.emoji} ${PREMIUM_MODEL.name}...`);
    }
    const result = await tryModel(PREMIUM_MODEL, messages, CFG.RESPONSE_TIMEOUT, guildKey);
    if (result) return result;
    console.log(`${C.yellow}[AI PREMIUM]${C.reset} Claude unavailable, falling back to free pool...`);
  }

  // Free pool: the cheaper models, tried one after another. They used to race 3 at a time (Claude Sonnet and GPT-4o
  // included) and every message paid for all three, even though only one answer was kept.
  let pool = MODEL_POOL.filter(m => m.tier !== 'premium' && (!imageUrl || VISION.has(m.id)));
  const fresh = pool.filter(m => !isBenched(m));
  if (fresh.length) pool = fresh;   // all benched: try them anyway rather than give up
  let winner = null;
  const tried = [];
  const started = Date.now();
  for (const model of pool) {
    const left = TOTAL_BUDGET - (Date.now() - started);
    if (left < 3000) break;
    tried.push(model.name);
    const result = await tryModel(model, messages, Math.min(CFG.RESPONSE_TIMEOUT, left), guildKey);
    if (result) { winner = result; winner.attempted = tried.join(' \u2192 '); break; }
  }

  if (!winner) {
    console.log(`${C.red}[AI]${C.reset} All models failed. Check API key and network.`);
    return null;
  }

  console.log(`${C.green}[AI OK]${C.reset} ${winner.model.name} | ~${winner.tokens}tk | ${winner.latency}ms | via: ${winner.attempted}`);
  return winner;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function parseAndStoreMemory(reply, userId, database) {
  if (!reply?.includes('[MEMORY:')) return;
  const regex = /\[MEMORY:\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]/g;
  let match;
  while ((match = regex.exec(reply)) !== null) {
    const key = match[1]?.trim().toLowerCase();
    const value = match[2]?.trim();
    if (!key || !value || key.length > 50 || value.length > 200) continue;
    try {
      database.prepare(`
        INSERT OR REPLACE INTO lydia_memory (user_id, memory_key, memory_value, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(userId, key, value, Date.now());
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
function buildEmbed(reply, message, options = {}) {
  const { isError = false, isThinking = false, theme = THEMES.default, model = null, latency = null, tokens = null, sources = [], lang = 'en' } = options;

  // Red only for real errors: picking the colour from words in the answer ("bug", "fix") made friendly replies look like alerts
  const embedColor = isError ? 0xff4757 : 0xE6A817;

  const c = new ContainerBuilder().setAccentColor(embedColor);

  if (isThinking) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${theme.emoji} ${require('../lib/i18n').t('lydia.thinkingEmbed.label', lang)}\n*${require('../lib/i18n').t('lydia.thinkingEmbed.text', lang)}*`));
    return c;
  }

  const content = fitReply(formatDiscordResponse(reply));
  const card = new ContainerBuilder().setAccentColor(embedColor);
  card.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  card.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  if (sources.length > 0 && !isError) {
    const links = sources.slice(0, 4).map((src, idx) => `[[${idx + 1}]](${src.url}) ${src.title.length > 80 ? src.title.slice(0, 80) + '…' : src.title}`).join('\n');
    card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${require('../lib/i18n').t('lydia.sourcesTitle', lang)}**\n${links}`));
  }
  // Which model answered: honest, and useful when a server compares answers
  card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${theme.emoji} Archon${model?.name && !isError ? ` · ${model.name}` : ''}`));
  return [card];
}

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
  // Only messages addressed to the bot start the cooldowns (any chat in the channel used to block the next real question)
  {
    const _name = (getBotName(message) || 'Archon').toLowerCase();
    const _c = (message.content || '').toLowerCase();
    if (!(_c.startsWith(_name) || message.mentions?.has(client.user))) return;
  }

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

    if (!userPrompt.trim()) {
      const greetings = {
        es: `\u00A1Hola ${userName}! Estoy aqu\u00ED y lista para ayudar. \u00BFQu\u00E9 te gustar\u00EDa saber?`,
        ar: `\u0645\u0631\u062D\u0628\u0627\u064B ${userName}! \u0623\u0646\u0627 \u0647\u0646\u0627 \u0648\u0645\u0633\u062A\u0639\u062F\u0629 \u0644\u0644\u0645\u0633\u0627\u0639\u062F\u0629. \u0645\u0627\u0630\u0627 \u062A\u0648\u062F \u0623\u0646 \u062A\u0639\u0631\u0641\u061F`,
        zh: `\u55E8 ${userName}! \u6211\u5728\u8FD9\u91CC\uFF0C\u968F\u65F6\u51C6\u5907\u5E2E\u5FD9\u3002\u4F60\u60F3\u77E5\u9053\u4EC0\u4E48\uFF1F`,
        ja: `\u3053\u3093\u306B\u3061\u306F ${userName}\u3055\u3093! \u304A\u624B\u4F1D\u3044\u3067\u304D\u308B\u3053\u3068\u304C\u3042\u308C\u3070\u3001\u304A\u6C17\u8EFD\u306B\u3069\u3046\u305E\u3002`,
      };
      const staticMsg = lang === 'fr' ? t('lydia.greeting_fr', lang, { user: userName })
        : (greetings[lang] || t('lydia.greeting_en', lang, { user: userName }));
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
        WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?
      `).all(message.author.id, CFG.MAX_MEMORY_PER_USER);
    } catch (e) {}

    // Only ARCHON's owner is "the developer" and sees the owner-only commands. Every server owner used to be
    // introduced as the developer, and the owner was looked up with two Discord API calls on every message.
    const envOwnerId = process.env.OWNER_ID || process.env.DEVELOPER_ID || process.env.BOT_OWNER;
    const isOwner = envOwnerId && message.author.id === envOwnerId ? 'dev' : message.author.id === message.guild.ownerId ? 'server' : null;
    // Daily limit on servers without Premium: one short notice when it's reached, then silence until tomorrow
    if (isOwner !== 'dev' && !isPremium(database, message.guild.id)) {
      const day = new Date().toISOString().slice(0, 10);
      let used = 0;
      try {
        database.prepare('CREATE TABLE IF NOT EXISTS lydia_usage (user_id TEXT, guild_id TEXT, day TEXT, n INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id, day))').run();
        used = database.prepare('SELECT n FROM lydia_usage WHERE user_id = ? AND guild_id = ? AND day = ?').get(message.author.id, message.guild.id, day)?.n || 0;
      } catch {}
      if (used >= CFG.FREE_DAILY_LIMIT) {
        const notice = used === CFG.FREE_DAILY_LIMIT ? t('lydia.daily_limit', lang, { n: CFG.FREE_DAILY_LIMIT }) : null;
        try { database.prepare('UPDATE lydia_usage SET n = n + 1 WHERE user_id = ? AND guild_id = ? AND day = ?').run(message.author.id, message.guild.id, day); } catch {}
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

    const systemPrompt = buildSystemPrompt(botName, userName, message.guild, isOwner, theme, serverPrefix, lang, client.commands?.size || 0, message.content, client.commands, !!(message.guild?.id && isPremium(database, message.guild.id)), client.moduleStats);

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
    const braveKey = getGuildKey(database, message.guild.id, 'brave') || process.env.BRAVE_API_KEY;
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

    // Setup questions ("what's left to set up?"): server managers get this server's checklist (lib/setup-checklist.js,
    // the same list /setup shows), read only and without channel or role names. Other members get no configuration.
    // It stays for the follow-up messages too (the last turns were about setup), so Lydia never answers a follow-up
    // without the data and then takes back an answer that was right.
    const setupTalk = SETUP_QUESTION.test(message.content || '') || history.slice(-4).some((h) => SETUP_QUESTION.test(String(h.content || '')));
    if (setupTalk) {
      if (message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        try {
          const list = require('../lib/setup-checklist');
          fullSystem += `\n\n[SERVER SETUP — live data, checked by ARCHON for this very message. It is real and current: rely on it, and never say you can't see the server's setup. Read only: you cannot change any setting and must never say you did. The person asking manages this server. Tell them what is done and what is left, most important first, and for each missing item name the place after the arrow where they fix it. /setup shows the same list with buttons.]\n${list.summaryText(list.compute(client, message.guild), lang)}`;
        } catch (e) { console.error('[LYDIA] setup checklist:', e.message); }
      } else {
        fullSystem += `\n\n[The person asking does not manage this server. Do not describe how the server is configured (channels, roles, verification, logs); suggest they ask a server admin, who can see everything with /setup.]`;
      }
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

    parseAndStoreMemory(safeReply, message.author.id, database);
    // The tags are read from the reply before they are stripped (they were stripped first, so no reminder was ever set)
    parseAndScheduleReminder(safeReply, message.author.id, message.channel.id, client, database, message.guild.id);
    const finalReply = cleanReply;

    // NEW — buildEmbed now returns array of embeds (multi-embed support)
    const finalEmbeds = buildEmbed(finalReply, message, {
      isError: false, theme, model, latency, tokens, sources: searchSources, lang
    });

    if (thinkingMsg) await thinkingMsg.edit({ components: finalEmbeds, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    else await message.reply({ components: finalEmbeds, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });

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

async function handleLydiaToggle(client, channelId, guildId, userId, action, respondFn = null) {
  if (!client.lydiaChannels) client.lydiaChannels = {};
  const lang = pickLang(client, guildId, null, userId) || 'en';
  const L = (k, v) => t('lydia.' + k, lang, v || {});
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.guild) {
    if (respondFn) await respondFn({ content: L('lydia_channel_missing'), flags: 64 });
    return;
  }
  const guild = channel.guild;
  const bot = guild.members.me?.displayName || client.user?.username || 'Archon';
  const cmdId = client.application?.commands?.cache?.find((c) => c.name === 'lydia')?.id;
  const cmd = (sub) => (cmdId ? `</lydia ${sub}:${cmdId}>` : `\`/lydia ${sub}\``);
  const how = `> ${L('how_mention', { bot })}\n> ${L('how_memory')}`;
  const card = (color, items) => {
    const c = new ContainerBuilder().setAccentColor(color);
    for (const it of items) {
      if (it === '---') c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      else c.addTextDisplayComponents(new TextDisplayBuilder().setContent(it));
    }
    return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
  };

  if (action === 'status') {
    const on = !!client.lydiaChannels[channelId];
    const ss = client.getServerSettings?.(guildId) || {};
    const serverOff = ss.ai_enabled === 0 || ss.aiEnabled === false;   // the dashboard switch: then she answers nowhere
    const here = Object.keys(client.lydiaChannels).filter((id) => guild.channels.cache.has(id));
    const premium = isPremium(client.db, guildId);
    const items = [
      `## ${on && !serverOff ? '🟢' : '⚪'} ${bot} · ${on && !serverOff ? L('st_on') : L('st_off')}`,
      on ? `${L('st_on_desc', { channel: `<#${channelId}>` })}\n${how}` : L('st_off_desc', { channel: `<#${channelId}>`, cmd: cmd('on') }),
      '---',
      `**${L('srv_title')}**\n${here.length ? L('srv_channels', { list: here.slice(0, 10).map((id) => `<#${id}>`).join(', ') + (here.length > 10 ? '…' : '') }) : L('srv_none')}\n${premium ? L('plan_premium') : L('plan_free', { n: CFG.FREE_DAILY_LIMIT })}`,
    ];
    if (serverOff) items.push(`⚠️ **${L('ai_off_server')}**`);
    if (respondFn) await respondFn(card(serverOff ? 0xBA7517 : on ? 0x2ecc71 : 0x95a5a6, items));
    return;
  }

  if (action === 'on') {
    if (client.lydiaChannels[channelId]) {
      if (respondFn) await respondFn({ content: L('lydia_on_already'), flags: 64 });
      return;
    }
    client.lydiaChannels[channelId] = true;
    try { client.db?.prepare(`INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at) VALUES (?, ?, 1, ?)`).run(channelId, 'default', Math.floor(Date.now() / 1000)); } catch (e) {}
    if (respondFn) await respondFn(card(0x2ecc71, [`## 🟢 ${L('on_title')}`, `${L('st_on_desc', { channel: `<#${channelId}>` })}\n${how}`]));
    return;
  }

  if (action === 'off') {
    if (!client.lydiaChannels[channelId]) {
      if (respondFn) await respondFn({ content: L('lydia_off_already'), flags: 64 });
      return;
    }
    delete client.lydiaChannels[channelId];
    try { client.db?.prepare(`UPDATE lydia_agents SET is_active = 0 WHERE channel_id = ?`).run(channelId); } catch (e) {}
    if (respondFn) await respondFn(card(0x95a5a6, [`## ⚪ ${L('off_title')}`, L('off_back', { cmd: cmd('on') })]));
    return;
  }
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
      return interactionOrMessage.author.send(dm).then(() => interactionOrMessage.react('📬').catch(() => {}))
        .catch(() => interactionOrMessage.reply(dm));
    };
  }

  try {
    const memories = database.prepare(`SELECT memory_key, memory_value, updated_at FROM lydia_memory WHERE user_id = ? ORDER BY updated_at DESC`).all(userId);

    if (!memories.length) {
      const c = new ContainerBuilder().setAccentColor(0xf1c40f);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${t('lydia.memory_empty_title', lang)}`));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${t('lydia.memory_empty', lang)}\n\n` + t('lydia.memory_empty_hint', lang) + '\n\n' + t('lydia.memory_example', lang)));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('lydia.memory_footer', lang)}`));
      await respond({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
      return;
    }

    const c = new ContainerBuilder().setAccentColor(0x2ecc71);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${t('lydia.memory_card_title', lang, { user: username })}\n-# ${t('lydia.memory_count', lang, { n: memories.length })}`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    
    for (const m of memories.slice(0, 25)) {
      // Discord shows the date in each reader's own format (stored in ms; older rows may be in seconds)
      const ms = Number(m.updated_at) < 1e12 ? Number(m.updated_at) * 1000 : Number(m.updated_at);
      const date = ms > 0 ? `<t:${Math.floor(ms / 1000)}:D>` : '—';
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**📌 ${m.memory_key}**\n${m.memory_value}\n-# ${t('lydia.memory_saved_on', lang, { date })}`));
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

// Deletes every memory Archon keeps about the member who asks (memories follow the member across servers)
async function forgetMemories(src, database, client) {
  const userId = src.user?.id || src.author?.id;
  let lang = 'en';
  try { lang = pickLang(client, src.guild?.id, src.user ? src : null, userId) || 'en'; } catch {}
  let n = 0;
  try { n = database.prepare('DELETE FROM lydia_memory WHERE user_id = ?').run(userId).changes; } catch {}
  const text = n ? t('lydia.memory_forgot', lang, { n }) : t('lydia.memory_forget_none', lang);
  return src.reply(src.user ? { content: text, flags: 64 } : { content: text }).catch(() => {});
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
        user_id TEXT, memory_key TEXT, memory_value TEXT, updated_at INTEGER,
        PRIMARY KEY (user_id, memory_key)
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
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor('#ff4757').setDescription(t('lydia.admin_only', lang))]
    }).catch(() => {});
  }


  if (!['on', 'off', 'status'].includes(sub)) return;
  await handleLydiaToggle(client, message.channel.id, message.guild.id, message.author.id, sub, async (payload) => message.reply(payload));
}

const slashCommand = new SlashCommandBuilder()
  .setName('lydia')
  .setDescription('\u{1F9E0} Manage Archon AI')
  .addSubcommand(s => s.setName('on').setDescription('\u{1F7E2} Activate Archon AI'))
  .addSubcommand(s => s.setName('off').setDescription('\u{1F534} Deactivate Archon AI'))
  .addSubcommand(s => s.setName('status').setDescription('\u{1F4CA} Show Archon status'))
  .addSubcommand(s => s.setName('memory').setDescription('\u{1F9E0} View your stored memories'))
  .addSubcommand(s => s.setName('forget').setDescription('\u{1F5D1}\u{FE0F} Delete everything Archon remembers about you'))
;

async function executeSlashCommand(interaction, client) {
  const _ssX = client.getServerSettings?.(interaction.guild?.id) || {};
  const lang = _ssX.language && _ssX.language !== 'auto' ? _ssX.language : (require('../lib/i18n').slashLang(interaction));
  if (!interaction.guild) return interaction.reply({ content: t('lydia.no_guild', lang), flags: 64 });
  const _sub = interaction.options.getSubcommand();
  if (_sub === 'memory' || _sub === 'forget') {
    if (!client.db) return interaction.reply({ content: t('lydia.db_offline', lang), flags: 64 });
    return _sub === 'memory' ? handleMemorySubcommand(interaction, client.db, true, client) : forgetMemories(interaction, client.db, client);
  }
  if (!interaction.member.permissions?.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#ff4757').setDescription(t('lydia.admin_only_slash', lang))],
      flags: 64
    });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'memory') {
    // memory uses its own reply — no defer needed
    const database = client.db;
    if (!database) return interaction.reply({ content: t('lydia.db_offline', lang), flags: 64 });
    return await handleMemorySubcommand(interaction, database, true, client);
  }

  // All other subcommands need defer first
  await interaction.deferReply({ flags: 64 });

  await handleLydiaToggle(client, interaction.channelId, interaction.guildId, interaction.user.id, sub, async (payload) => {
    return interaction.followUp(payload);
  });
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
  setupLydia,
  webSearch,
  generateAIResponse,
  detectUserLanguage,
  validateResponse,
  scrubSecrets,
};

console.log(`${C.green}[LYDIA]${C.reset} AI Engine v2.6 loaded — Beautiful formatting | Anti-hallucination | ${Object.keys(LANG_NAMES).length} languages | Model fallback | Response cache`);
