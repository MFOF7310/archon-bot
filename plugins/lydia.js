/**
 * ARCHITECT CG-223 // LYDIA AI ENGINE v2.6
 * Multi-agent AI with persistent memory, web search, image analysis
 * Anti-hallucination | Universal language | Performance optimized
 * + Beautiful Discord formatting (multi-embed, paragraph splitting)
 *
 * By: Moussa Fofana // Node BAMAKO_223
 */

'use strict';

const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CFG = {
  COOLDOWN_TIME: 3000,
  MAX_HISTORY: 8,
  MAX_MEMORY_PER_USER: 25,
  CHANNEL_COOLDOWN: 1500,
  MAX_EMBED_DESC: 3800,
  MAX_TOKENS: 1200,
  RESPONSE_TIMEOUT: 15000,
  CACHE_TTL_MS: 120000,
  MAX_CONCURRENT_MODELS: 3,
  MAX_EMBEDS_PER_MSG: 4,
  PARAGRAPH_MAX_LINES: 8,
};

let isLydiaInitialized = false;
const userCooldowns = new Map();
const channelCooldowns = new Map();
const messageProcessingLocks = new Set();
const responseCache = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// ANSI COLORS
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', blue: '\x1b[34m', reset: '\x1b[0m'
};

// ═══════════════════════════════════════════════════════════════════════════════
// SENTIMENT COLOR ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const PALETTE = {
  default:  { base: '#5865F2', urgent: '#ff4757', calm: '#747d8c', alert: '#ffa502' },
  tech:     { base: '#00d4ff', urgent: '#ff3838', calm: '#7bed9f', alert: '#eccc68' },
  intel:    { base: '#9b59b6', urgent: '#ff4757', calm: '#a29bfe', alert: '#fd79a8' },
  tactical: { base: '#f39c12', urgent: '#ff4757', calm: '#55efc4', alert: '#ffeaa7' },
  medical:  { base: '#e74c3c', urgent: '#ff4757', calm: '#fab1a0', alert: '#ff7675' },
  academic: { base: '#2ecc71', urgent: '#ff4757', calm: '#55efc4', alert: '#fdcb6e' },
  police:   { base: '#34495e', urgent: '#c0392b', calm: '#7f8c8d', alert: '#f1c40f' }
};

function getSentimentColor(themeKey, text = '') {
  const t = PALETTE[themeKey] || PALETTE.default;
  const lower = (text || '').toLowerCase();
  const critical = ['error', 'bug', 'crash', 'fail', 'broken', 'hack', 'virus', 'attack', 'emergency', 'critical', 'not working', 'fatal', 'panic', 'breach'];
  if (critical.some(k => lower.includes(k))) return t.urgent;
  const alert = ['warning', 'caution', 'careful', 'alert', 'attention', 'verify', 'suspicious', 'unauthorized', 'banned', 'kick', 'mute'];
  if (alert.some(k => lower.includes(k))) return t.alert;
  const calm = ['success', 'done', 'complete', 'working', 'perfect', 'great', 'thanks', 'love', 'happy', 'congratulations', 'welcome'];
  if (calm.some(k => lower.includes(k))) return t.calm;
  return t.base;
}

// ═══════════════════════════════════════════════════════════════════════════════
// THEME ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const THEMES = {
  default:  { name: 'Monitor',        emoji: '\u2728', tone: 'friendly, helpful, conversational' },
  tech:     { name: 'Tech Analyst',   emoji: '\u{1F4BB}', tone: 'expert developer, clear explanations, production-ready code' },
  intel:    { name: 'Intel Officer',  emoji: '\u{1F50D}', tone: 'informative, well-sourced, factual, structured briefing' },
  tactical: { name: 'Field Guide',    emoji: '\u{1F4CB}', tone: 'clear, actionable, step-by-step, mission-oriented' },
  medical:  { name: 'Health Advisor', emoji: '\u{1F3E5}', tone: 'caring, cautious, recommends professional help when needed' },
  academic: { name: 'Scholar',        emoji: '\u{1F4DA}', tone: 'patient, thorough, breaks down complex topics' },
  police:   { name: 'System Monitor', emoji: '\u{1F6E1}\u{FE0F}', tone: 'authoritative, precise, security-conscious, monitor-style' }
};

function detectTheme(userPrompt) {
  const p = userPrompt.toLowerCase();
  const scores = {};
  scores.police = ['police', 'security', 'threat', 'breach', 'banned', 'kick', 'mute', 'warn', 'automod', 'raid', 'guardian', 'monitor', 'log', 'audit', 'suspicious', 'hack', 'attack', 'intruder'].filter(k => p.includes(k)).length;
  scores.tech = ['code', 'javascript', 'python', 'bug', 'error', 'function', 'api', 'database', 'sql', 'node', 'discord.js', 'html', 'css', 'react', 'deploy', 'server', 'json', 'async', 'await', 'promise', 'fix', 'debug', 'script', 'plugin'].filter(k => p.includes(k)).length;
  scores.intel = ['who is', 'what is', 'news', 'latest', 'weather', 'search', 'find', 'where', 'when', 'why', 'how to', 'price', 'stock', 'crypto', 'update', 'current', 'research', 'data', 'report'].filter(k => p.includes(k)).length;
  scores.tactical = ['how do i', 'steps', 'guide', 'tutorial', 'solve', 'install', 'setup', 'configure', 'build', 'create', 'make', 'recipe', 'plan', 'strategy', 'use', 'command', 'daily', 'shop', 'buy', 'claim'].filter(k => p.includes(k)).length;
  scores.medical = ['pain', 'sick', 'doctor', 'medicine', 'health', 'symptom', 'disease', 'virus', 'treatment', 'dose', 'vaccine', 'mental', 'therapy', 'diet', 'exercise', 'injury', 'hospital'].filter(k => p.includes(k)).length;
  scores.academic = ['explain', 'define', 'theory', 'concept', 'history', 'science', 'math', 'physics', 'chemistry', 'biology', 'philosophy', 'literature', 'study', 'exam', 'thesis', 'research', 'learn'].filter(k => p.includes(k)).length;
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return winner[1] > 0 ? THEMES[winner[0]] : THEMES.default;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIVERSAL LANGUAGE DETECTOR
// ═══════════════════════════════════════════════════════════════════════════════

function detectUserLanguage(text) {
  if (!text || typeof text !== 'string') return 'en';
  const t = text.toLowerCase().trim();
  if (!t) return 'en';

  if (/[\u00E0\u00E2\u00E4\u00E9\u00E8\u00EA\u00EB\u00EE\u00EF\u00F4\u00F6\u00F9\u00FB\u00FC\u00FF\u00E7\u0153\u00E6]/i.test(t)) return 'fr';
  const frWords = /\b(le|la|les|un|une|des|du|de|je|tu|il|elle|nous|vous|ils|elles|est|sont|\u00E9t\u00E9|faire|voir|aller|venir|parler|penser|tr\u00E8s|bien|oui|non|merci|bonjour|salut|comment|quoi|o\u00F9|quand|pourquoi|parce|donc|alors|aussi|encore|toujours|jamais|tout|rien|quelque|chaque|plus|moins|avec|sans|dans|sur|sous|entre|chez|vers)\b/i;
  if (frWords.test(t)) return 'fr';

  const esWords = /\b(el|la|los|las|un|una|yo|t\u00FA|\u00E9l|ella|nosotros|vosotros|ellos|son|est\u00E1|estar|hacer|ver|ir|venir|hablar|pensar|muy|bien|s\u00ED|no|gracias|hola|c\u00F3mo|qu\u00E9|d\u00F3nde|cu\u00E1ndo|porqu\u00E9|porque|entonces|tambi\u00E9n|siempre|nunca|todo|nada|cada|m\u00E1s|menos|con|sin|dentro|sobre|entre|hacia)\b/i;
  if (esWords.test(t)) return 'es';

  if (/[\u0600-\u06FF]/.test(t)) return 'ar';
  if (/[\u4E00-\u9FFF]/.test(t)) return 'zh';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(t)) return 'ja';

  return 'en';
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

const BOT_KNOWLEDGE = `
You are Lydia, the onboard AI expert monitor for ARCHITECT CG-223 (also called ARCHON CG-223), a Discord bot engineered by Moussa Fofana from Bamako, Mali \u{1F1F2}\u{1F1F1}.

CORE ARCHITECTURE:
- "Per-Server Partitioning": All user data (XP, credits, levels, stats, inventory) is strictly isolated per server via composite key (user ID + guild ID). No cross-server data leakage.
- Database: SQLite with WAL mode, auto-repair, circuit breaker protection, and batch writes.
- Plugin architecture: Modules load dynamically from /plugins and /telegram.
- Command architecture: Dual-mode — Prefix commands (server-configurable) and Slash commands (global, always available).

LYDIA AI — CAPABILITIES & IDENTITY:
- Multi-agent system with persistent memory, live web search, reminders, and image analysis.
- Auto-detect conversation themes: Tech, Intel/Research, Tactical, Medical, Academic, Police/Security.
- Memory protocol: Users store facts via [MEMORY: key | value]. Reminders via [REMIND: X min/h | message].
- Web Search: Live Brave Search integration with clickable citations [1], [2] in Discord embeds.
- Image Analysis: Vision-capable models (Gemini, Llama) process attached images.
- You operate via remote APIs (OpenRouter). No local ML frameworks, no hardware access, no "nano agents."

COMMAND INTELLIGENCE — HOW YOU GUIDE:
Command naming follows logical conventions. You infer the correct command from user intent:
- Economy & Rewards: daily, claim, streak, balance, profile, shop, buy, inventory
- Market System: market, invest
- Progression: level, rank, leaderboard
- Moderation: automod, warn, mute, kick, ban (Admin only)
- Server Management: welcome, goodbye, ticket, ticketsetup (Admin only)
- Utilities: remind, birthday
- AI Controls: lydia, ai, neural

When guiding users, present both formats: \`{prefix}command\` or \`/command\`.
Example: "To claim your daily rewards, use \`{prefix}daily\` or \`/daily\`."

REMINDER CONCIERGE PROTOCOL:
When a user asks you to set a reminder (e.g., "remind me in 5 min to call mom"):
1. You MAY use [REMIND: X min | message] to schedule it instantly as a convenience.
2. You MUST also inform them of the dedicated command for future use: \`/remind\` or \`{prefix}remind\`.
3. Professional framing: "Quick reminder set. For persistent countdown tracking and full scheduling control, use \`/remind\` or \`{prefix}remind\` anytime."
4. Never claim the dedicated command is superior to your own system — both are official. Present them as complementary options.

SYSTEMS OVERVIEW — FUNCTIONAL DOMAINS:
1. LEVELING & XP — Message-based progression with tiered roles (Neural Initiate → Supreme Architect). Formula: floor(0.1 * sqrt(XP)) + 1.
2. ECONOMY — Credit system (\u{1FA99}) with daily claims, streak bonuses (3d/7d/30d/100d/365d milestones), streak shields, and shop purchases.
3. BAMAKO MARKET — 4-state virtual market (Steady/Bull/Bear/Volatile) updating every 6 hours. Investment mechanics with profit claiming.
4. AUTO-MOD & SECURITY — Spam/link/invite filtering, mention limits, warning escalation (mute/kick/ban), and join-velocity threat scoring.
5. WELCOME & GOODBYE — Cinematic embeds with tier assignment based on member count, auto-role assignment, and stay-duration analytics.
6. TICKET SYSTEM — Button-panel support tickets with categories, staff roles, transcript channels, and auto-close timers.
7. REMINDERS & BIRTHDAYS — Persistent per-user reminders with DM+channel fallback. Birthday tracking with daily celebration checks.
8. TELEGRAM BRIDGE — Selective command sync to Telegram. Not a full mirror.
9. TIKTOK NOTIFICATIONS — Automated video tracking and designated channel posting.
10. LYDIA AI — Yourself. Memory, search, analysis, and conversational assistance.

ANTI-HALLUCINATION PROTOCOL — CRITICAL:
1. NEVER fabricate features, commands, or capabilities. If uncertain, say: "I don't have real-time access to that configuration. Try the command or contact the architect."
2. NEVER mention TensorFlow, PyTorch, Keras, OpenCV, GPUs, hardware upgrades, or "nano bananas." These do not exist in this ecosystem.
3. NEVER reveal file paths, database schemas, API keys, tokens, passwords, or internal architecture details.
4. NEVER claim to have features that are NOT listed in SYSTEMS OVERVIEW above.
5. When asked "what can you do," respond like a consultant: ask what domain they need help with, then provide targeted guidance. Do not dump a list unless explicitly asked for a full overview.
6. For general knowledge questions, prefer live web search. If search is unavailable, express uncertainty.
7. Always match the user's language automatically.
8. Use markdown formatting for clarity. Keep responses concise but substantive.
9. For troubleshooting: diagnose first, then prescribe. Ask clarifying questions when needed.
10. If asked about code, configuration, or technical details of the bot: "I can help you use the bot's features, but I don't have access to its source code or configuration files."

OWNER INFO:
- Architect: Moussa Fofana (MFOF7310)
- Origin: Bamako, Mali \u{1F1F2}\u{1F1F1}
- Public Repository: github.com/MFOF7310
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
  /\b(tensorflow|pytorch|keras|opencv|scikit|huggingface transformers|local model|on-device|gpu cluster|cuda cores|nvidia|rtx| training data)\b/gi,
  /\b(nano banana|nano agent|self-aware|conscious|sentient|emotion engine|dream mode|hologram|quantum computing)\b/gi,
  /\b(i can see (the |your )?(source code|config|env|environment|token|password|secret))/gi,
  /\b(i have access to (the |your )?(server|database|file system|logs|config))/gi,
  /\b(\/plugins\/|\/src\/|\/config\/|\/data\/database|\.env\b|\.json\b|\/telegram\/|\/node_modules\/)/gi,
];

const HALLUCINATION_FALLBACKS = [
  "I'm not certain about that. I can help you with the features I have access to \u2014 try asking about economy, leveling, moderation, or use \`.help\` to see available commands.",
  "I don't have information about that specifically. Would you like me to search the web, or can I help with something related to the bot's features?",
  "That's outside my current knowledge base. I'm focused on helping with ARCHITECT CG-223's systems. What would you like to know about?",
];

function validateResponse(response) {
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

  if (/\b(process\.env|environment variable|env var|config file|\.env)\b/gi.test(response)) {
    score += 5;
    reasons.push('Config/env reference');
  }

  const cleaned = scrubSecrets(response);

  if (score >= 3) {
    const fallback = HALLUCINATION_FALLBACKS[Math.floor(Math.random() * HALLUCINATION_FALLBACKS.length)];
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
    || 'Lydia';
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEB SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

async function webSearch(query) {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return null;
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
  { id: 'meta-llama/llama-3.1-70b-instruct', emoji: '\u{1F9E0}', name: 'Llama 3.1', tier: 'fast' },
  { id: 'google/gemini-2.0-flash-exp',       emoji: '\u2728', name: 'Gemini Flash', tier: 'fast' },
  { id: 'mistralai/mistral-7b-instruct',      emoji: '\u26A1', name: 'Mistral 7B', tier: 'fast' },
  { id: 'anthropic/claude-3-haiku',           emoji: '\u{1F38B}', name: 'Claude Haiku', tier: 'reliable' },
  { id: 'cohere/command-r-plus',              emoji: '\u{1F52E}', name: 'Command R+', tier: 'deep' },
];

async function tryModel(model, messages, timeoutMs) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      console.log(`${C.yellow}[TIMEOUT]${C.reset} ${model.id}`);
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
      console.log(`${C.yellow}[AI RETRY]${C.reset} ${model.id} | HTTP ${status} | ${errMsg.substring(0, 80)}`);
      resolve(null);
    }
  });
}

async function generateAIResponse(systemPrompt, userMessage, history = [], imageUrl = null, theme = THEMES.default) {
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

  const topModels = MODEL_POOL.slice(0, CFG.MAX_CONCURRENT_MODELS);
  console.log(`${C.cyan}[AI]${C.reset} Racing ${topModels.length} models...`);

  const promises = topModels.map(m => tryModel(m, messages, CFG.RESPONSE_TIMEOUT));

  let winner = null;
  const results = await Promise.all(promises);

  for (let i = 0; i < results.length; i++) {
    if (results[i]) {
      winner = results[i];
      winner.attempted = topModels.slice(0, i + 1).map(m => m.name).join(' \u2192 ');
      break;
    }
  }

  if (!winner) {
    const remaining = MODEL_POOL.slice(CFG.MAX_CONCURRENT_MODELS);
    for (const model of remaining) {
      const result = await tryModel(model, messages, CFG.RESPONSE_TIMEOUT);
      if (result) {
        winner = result;
        winner.attempted = 'parallel-fail \u2192 ' + model.name;
        break;
      }
    }
  }

  if (!winner) {
    console.log(`${C.red}[AI]${C.reset} All models failed. Check API key and network.`);
    return null;
  }

  console.log(`${C.green}[AI OK]${C.reset} ${winner.model.name} | ~${winner.tokens}tk | ${winner.latency}ms | via: ${winner.attempted}`);
  return winner;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE CACHE
// ═══════════════════════════════════════════════════════════════════════════════

function getCacheKey(userId, prompt) {
  const normalized = prompt.toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 100);
  return `${userId}:${normalized}`;
}

function getCachedResponse(userId, prompt) {
  const key = getCacheKey(userId, prompt);
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CFG.CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  console.log(`${C.cyan}[CACHE]${C.reset} Hit for ${key.substring(0, 40)}...`);
  return entry.data;
}

function setCachedResponse(userId, prompt, data) {
  const key = getCacheKey(userId, prompt);
  responseCache.set(key, { ts: Date.now(), data });
  if (responseCache.size > 200) {
    const oldest = responseCache.keys().next().value;
    responseCache.delete(oldest);
  }
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

function parseAndScheduleReminder(response, userId, channelId, client, database) {
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
        INSERT INTO reminders (id, user_id, user_tag, guild_id, channel_id, message, execute_at, delivered)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).run(id, userId, null, null, channelId, msg.trim(), executeAt);

      setTimeout(async () => {
        try {
          const user = await client.users.fetch(userId).catch(() => null);
          if (user) {
            await user.send({
              embeds: [new EmbedBuilder()
                .setColor('#f1c40f')
                .setAuthor({ name: '\u{1F514} Reminder', iconURL: client.user?.displayAvatarURL() })
                .setDescription(`**${msg.trim()}**`)
                .setFooter({ text: 'Architect CG-223 \u2022 Reminder' })
                .setTimestamp()
              ]
            }).catch(() => {});
          }
          const ch = await client.channels.fetch(channelId).catch(() => null);
          if (ch?.isTextBased?.()) {
            await ch.send({
              content: `\u{1F514} <@${userId}> **Reminder:** ${msg.trim()}`,
              allowedMentions: { users: [userId] }
            }).catch(() => {});
          }
          database.prepare(`UPDATE reminders SET delivered = 1 WHERE id = ?`).run(id);
        } catch (e) {
          console.log(`${C.yellow}[REMIND FAIL]${C.reset} ${e.message}`);
        }
      }, ms);

      console.log(`${C.green}[REMIND]${C.reset} Scheduled "${msg.trim()}" for ${userId} in ${amount}${unit}`);
    } catch (e) {
      console.log(`${C.yellow}[REMIND ERR]${C.reset} ${e.message}`);
    }

    cleanedResponse = cleanedResponse.replace(match[0], '').trim();
  }

  return cleanedResponse.replace(/\s+/g, ' ').trim();
}

function rehydrateReminders(client, database) {
  try {
    const pending = database.prepare(`
      SELECT * FROM reminders WHERE delivered = 0 AND execute_at > ?
    `).all(Math.floor(Date.now() / 1000));

    for (const r of pending) {
      const ms = (r.execute_at * 1000) - Date.now();
      if (ms <= 0) {
        client.channels.fetch(r.channel_id)
          .then(ch => {
            if (ch?.isTextBased?.()) {
              ch.send({
                content: `\u{1F514} **OVERDUE** <@${r.user_id}>: ${r.message}`,
                allowedMentions: { users: [r.user_id] }
              }).catch(() => {});
            }
          }).catch(() => {});
        database.prepare(`UPDATE reminders SET delivered = 1 WHERE id = ?`).run(r.id);
      } else {
        setTimeout(async () => {
          try {
            const user = await client.users.fetch(r.user_id).catch(() => null);
            if (user) {
              await user.send({
                embeds: [new EmbedBuilder()
                  .setColor('#f1c40f')
                  .setAuthor({ name: '\u{1F514} Reminder', iconURL: client.user?.displayAvatarURL() })
                  .setDescription(`**${r.message}**`)
                  .setFooter({ text: 'Architect CG-223 \u2022 Reminder' })
                  .setTimestamp()
                ]
              }).catch(() => {});
            }
            const ch = await client.channels.fetch(r.channel_id).catch(() => null);
            if (ch?.isTextBased?.()) {
              await ch.send({
                content: `\u{1F514} <@${r.user_id}> **Reminder:** ${r.message}`,
                allowedMentions: { users: [r.user_id] }
              }).catch(() => {});
            }
            database.prepare(`UPDATE reminders SET delivered = 1 WHERE id = ?`).run(r.id);
          } catch (e) {
            console.log(`${C.yellow}[REHYDRATE FAIL]${C.reset} ${e.message}`);
          }
        }, ms);
      }
    }

    if (pending.length > 0) console.log(`${C.green}[REHYDRATE]${C.reset} ${pending.length} reminders restored`);
  } catch (e) {
    console.log(`${C.yellow}[REHYDRATE ERR]${C.reset} ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISCORD RESPONSE FORMATTER v3.0 — Beautiful multi-embed splitting
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Post-processes raw AI text into beautifully formatted Discord markdown.
 * - Adds blank lines between paragraphs
 * - Ensures headers are bold and spaced
 * - Properly spaces numbered/bullet lists
 * - Wraps code blocks
 * - Keeps paragraphs short and readable
 */
function formatDiscordResponse(text) {
  if (!text) return '';

  // Strip <think> blocks
  let formatted = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Normalize line endings
  formatted = formatted.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Convert markdown headers (##, ###) to Discord bold with spacing
  formatted = formatted.replace(/^#{2,3}\s+(.+)$/gm, '\n**$1**\n');

  // Ensure numbered lists have spacing: "1. Item" -> proper format
  formatted = formatted.replace(/^(\d+)\.\s*\*\*(.+?)\*\*/gm, '$1. **$2**');

  // Add blank line before numbered lists if missing
  formatted = formatted.replace(/([^\n])(\n\d+\.\s)/g, '$1\n$2');

  // Add blank line before bullet lists if missing
  formatted = formatted.replace(/([^\n])(\n[\-\*\u2022\u25CB])\s/g, '$1\n$2 ');

  // Ensure paragraphs are separated by blank lines
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // Split very long paragraphs (no newlines for 8+ lines)
  formatted = splitLongParagraphs(formatted);

  // Clean up excessive whitespace
  formatted = formatted.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
  formatted = formatted.replace(/\n{4,}/g, '\n\n\n');

  return formatted.trim();
}

/**
 * Splits very long paragraphs (no line break for N lines) into smaller chunks.
 * This prevents walls of text in Discord.
 */
function splitLongParagraphs(text) {
  const lines = text.split('\n');
  const result = [];
  let currentPara = [];

  for (const line of lines) {
    const isEmpty = !line.trim();
    const isHeader = /^\*\*.+\*\*$/.test(line);
    const isListItem = /^\s*(\d+\.|[\-\*\u2022\u25CB])\s/.test(line);
    const isCodeBlock = /^```/.test(line);

    if (isEmpty || isHeader || isListItem || isCodeBlock) {
      // Flush current paragraph if it's getting long
      if (currentPara.length >= CFG.PARAGRAPH_MAX_LINES) {
        const mid = Math.floor(currentPara.length / 2);
        result.push(...currentPara.slice(0, mid));
        result.push('');
        result.push(...currentPara.slice(mid));
      } else if (currentPara.length > 0) {
        result.push(...currentPara);
      }
      currentPara = [];
      result.push(line);
      continue;
    }

    currentPara.push(line);

    // Flush if paragraph is getting too long
    if (currentPara.length >= CFG.PARAGRAPH_MAX_LINES) {
      result.push(...currentPara);
      result.push('');
      currentPara = [];
    }
  }

  // Flush remaining
  if (currentPara.length > 0) {
    result.push(...currentPara);
  }

  return result.join('\n');
}

/**
 * Splits formatted text into multiple embed-sized chunks.
 * Returns array of { title, content } objects.
 */
function splitIntoEmbeds(text, options = {}) {
  const { botName, themeName, isFirst = true } = options;
  const maxLen = CFG.MAX_EMBED_DESC;

  if (text.length <= maxLen) {
    return isFirst
      ? [{ title: null, content: text }]
      : [{ title: null, content: text }];
  }

  const chunks = [];
  // Split by double newlines first (paragraph boundaries)
  const paragraphs = text.split(/\n\n/);
  let current = '';

  for (const para of paragraphs) {
    const separator = current ? '\n\n' : '';
    if ((current + separator + para).length > maxLen) {
      if (current) {
        chunks.push({ title: null, content: current.trim() });
        current = para;
      } else {
        // Single paragraph too long — split by lines
        const lines = para.split('\n');
        for (const line of lines) {
          const sep = current ? '\n' : '';
          if ((current + sep + line).length > maxLen) {
            chunks.push({ title: null, content: current.trim() });
            current = line;
          } else {
            current = current + sep + line;
          }
        }
      }
    } else {
      current = current + separator + para;
    }
  }

  if (current) chunks.push({ title: null, content: current.trim() });

  // Add titles to chunks
  if (chunks.length > 1 && isFirst) {
    chunks[0].title = botName || 'Response';
    for (let i = 1; i < chunks.length; i++) {
      chunks[i].title = `Continued (${i + 1}/${chunks.length})`;
    }
  }

  return chunks;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMBED BUILDER (Updated — multi-embed support, no truncation)
// ═══════════════════════════════════════════════════════════════════════════════

function buildEmbed(reply, message, options = {}) {
  const { isError = false, isThinking = false, theme = THEMES.default, model = null, latency = null, tokens = null, sources = [], lang = 'en' } = options;

  const tz = 'Africa/Bamako';
  const bamakoTime = new Date().toLocaleTimeString('en-US', {
    timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const themeKey = Object.keys(THEMES).find(k => THEMES[k].name === theme.name) || 'default';
  const embedColor = isError ? '#ff4757' : getSentimentColor(themeKey, reply);

  let classification = 'UNCLASSIFIED';
  let badgeEmoji = '\u{1F7E2}';
  if (isError) { classification = 'SYSTEM ALERT'; badgeEmoji = '\u{1F534}'; }
  else if (themeKey === 'police') { classification = 'SECURITY BRIEF'; badgeEmoji = '\u{1F6E1}\u{FE0F}'; }
  else if (themeKey === 'tech') { classification = 'TECHNICAL BRIEF'; badgeEmoji = '\u{1F4BB}'; }
  else if (themeKey === 'intel') { classification = 'INTEL REPORT'; badgeEmoji = '\u{1F50D}'; }
  else if (themeKey === 'medical') { classification = 'MEDICAL ADVISORY'; badgeEmoji = '\u{1F3E5}'; }
  else if (themeKey === 'tactical') { classification = 'FIELD GUIDE'; badgeEmoji = '\u{1F4CB}'; }
  else if (themeKey === 'academic') { classification = 'RESEARCH NOTE'; badgeEmoji = '\u{1F4DA}'; }

  if (isThinking) {
    return new EmbedBuilder()
      .setColor('#f1c40f')
      .setAuthor({
        name: `${badgeEmoji} ${classification} \u2022 ANALYZING...`,
        iconURL: message.author.displayAvatarURL({ dynamic: true, size: 32 })
      })
      .setDescription(`\`\`\`ansi\n\u001b[1;33m[ ${theme.name.toUpperCase()} ] \u001b[0m\u001b[33mProcessing neural request...\u001b[0m\n\`\`\``)
      .setFooter({
        text: `ARCHITECT CG-223 // ${message.guild?.name || 'DM'} // ${bamakoTime} UTC`,
        iconURL: message.guild?.iconURL({ size: 16 }) || message.client?.user?.displayAvatarURL()
      })
      .setTimestamp();
  }

  // Format the response for Discord (NEW — beautiful formatting)
  const formattedReply = formatDiscordResponse(reply);

  // Split into multiple embeds if too long (NEW — no more truncation)
  const botName = message.client?.user?.username || 'Lydia';
  const chunks = splitIntoEmbeds(formattedReply, { botName, themeName: theme.name, isFirst: true });

  // Build embeds from chunks
  const embeds = [];
  for (let i = 0; i < chunks.length && i < CFG.MAX_EMBEDS_PER_MSG; i++) {
    const { title, content } = chunks[i];

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setDescription(content);

    if (i === 0) {
      embed.setAuthor({
        name: `${badgeEmoji} ${classification}`,
        iconURL: message.author.displayAvatarURL({ dynamic: true, size: 32 })
      });
      if (title) embed.setTitle(title);
    } else if (title) {
      embed.setAuthor({ name: title, iconURL: message.client?.user?.displayAvatarURL() });
    }

    // Footer only on last embed
    if (i === chunks.length - 1 || i === CFG.MAX_EMBEDS_PER_MSG - 1) {
      const footerParts = [];
      if (model) footerParts.push(`Model: ${model.name}`);
      if (latency) footerParts.push(`${latency}ms`);
      footerParts.push(`ARCHITECT CG-223`);
      if (lang === 'fr') footerParts.push('FR');
      else footerParts.push('EN');

      embed.setFooter({
        text: footerParts.join(' \u2022 '),
        iconURL: message.guild?.iconURL({ size: 16 }) || message.client?.user?.displayAvatarURL()
      });
      embed.setTimestamp();

      // Sources only on last embed
      if (sources.length > 0 && !isError) {
        const sourceLinks = sources.slice(0, 4).map((s, idx) => {
          const t = s.title.length > 80 ? s.title.substring(0, 80) + '...' : s.title;
          return `[[${idx + 1}]](${s.url}) ${t}`;
        }).join('\n');
        embed.addFields({ name: '\u{1F517} Real-Time Sources', value: sourceLinks, inline: false });
      }

      // Command mention field only on last embed
      const botCommands = ['.daily', '.shop', '.profile', '.level', '.market', '.help', '.ticket', '.remind', '.afk', '.invest', '.claim', '.streak', '.rank', '.leaderboard', '.whois', '.mute', '.kick', '.ban', '.warn', '.automod'];
      const mentionedCommand = reply ? botCommands.find(cmd => reply.toLowerCase().includes(cmd)) : null;
      if (mentionedCommand && !isError) {
        embed.addFields({
          name: '\u{1F4CB} SYSTEM BRIEFING',
          value: `\`> ${mentionedCommand}\` \u2014 Use this command in any server channel.`,
          inline: false
        });
      }
    }

    embeds.push(embed);
  }

  return embeds;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER (Updated — formatting instructions added)
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(botName, userName, guild, isOwner, theme, prefix = '.', lang = 'en') {
  const bamakoTime = new Date().toLocaleTimeString('en-US', {
    timeZone: 'Africa/Bamako', hour12: false, hour: '2-digit', minute: '2-digit'
  });

  const dateStr = new Date().toLocaleDateString('en-US', {
    timeZone: 'Africa/Bamako', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const langName = LANG_NAMES[lang] || 'English';

  const languageInstruction = `
LANGUAGE PROTOCOL \u2014 CRITICAL:
- Detected user language: ${langName} (code: ${lang})
- You MUST respond in the SAME language as the user's message.
- NEVER mix languages in the same response.
- All commands and technical terms (like "daily", "shop", "profile") should be referenced as-is regardless of language, but explanations must be in the user's language.
- Example (French user): "Pour r\u00E9clamer vos r\u00E9compenses quotidiennes, utilisez \`.daily\` ou \`/daily\`."
`;

  // NEW — formatting instructions for beautiful Discord output
  const formattingInstruction = `
FORMATTING PROTOCOL \u2014 CRITICAL:
Your responses are displayed in Discord embeds. Follow these formatting rules STRICTLY:

1. Use SHORT paragraphs (2-4 sentences max). Never write walls of text.
2. Separate EVERY section with a blank line (double newline).
3. Use **bold headers** for sections: "**Key Features:**" not "Key Features:"
4. Use numbered lists with bold items: "1. **Origin** \u2014 description here"
5. Use bullet points (\u2022 or -) for unordered lists.
6. For code: use \`inline code\` or \`\`\`language\ncode block\n\`\`\`
7. NEVER put everything in one dense paragraph. Break it up.
8. Use Discord markdown: *italic*, **bold**, \`code\`, ~~strikethrough~~.
9. End with a brief friendly closing if appropriate.
10. Keep total response under 1200 tokens (concise but complete).
`;

  return `${BOT_KNOWLEDGE}

${languageInstruction}

${formattingInstruction}

You are ${botName}, the onboard AI expert monitor for ARCHITECT CG-223.

OPERATIONAL CONTEXT:
- Server: ${guild.name}
- User: ${userName} ${isOwner ? '(Bot Owner)' : ''}
- Date: ${dateStr}
- Time: ${bamakoTime} (Bamako, UTC+0)
- Active Mode: ${theme.name}
- Server Prefix: \`${prefix}\`
- Command Format: \`${prefix}command\` or \`/command\`
- User Language: ${langName}

GUIDANCE STANDARDS:
- Be professional, warm, and precise \u2014 like a senior technical consultant.
- Diagnose before prescribing. Ask one clarifying question if the user's intent is ambiguous.
- When suggesting commands, always provide both prefix and slash variants.
- If a user asks about something outside the bot's scope, offer web search or suggest they contact the architect.
- Never dump exhaustive lists unless explicitly requested. Prioritize relevance.
- Cite web sources using [1], [2] format when search data is provided.
- RESPOND IN ${langName.toUpperCase()} \u2014 this is a strict requirement.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER (Updated — uses new buildEmbed which returns array)
// ═══════════════════════════════════════════════════════════════════════════════

async function handleLydiaMessage(message, client, database) {
  if (!message.guild || message.author.bot) return;

  const key = `${message.id}-${message.author.id}`;
  if (messageProcessingLocks.has(key)) return;

  const now = Date.now();
  if (now - (userCooldowns.get(message.author.id) || 0) < CFG.COOLDOWN_TIME) return;
  if (channelCooldowns.has(message.channel.id) && now - channelCooldowns.get(message.channel.id) < CFG.CHANNEL_COOLDOWN) return;
  if (!client.lydiaChannels?.[message.channel.id]) return;

  messageProcessingLocks.add(key);
  userCooldowns.set(message.author.id, now);
  channelCooldowns.set(message.channel.id, now);

  let thinkingMsg = null;
  let searchUsed = false;
  let searchSources = [];

  try {
    const botName = (getBotName(message) || 'Lydia').toLowerCase();
    const userName = message.member?.displayName || message.author?.username || 'Unknown';
    const content = (message.content || '').toLowerCase();

    const rawContent = message.content || '';
    const detectedLang = detectUserLanguage(rawContent);
    const lang = detectedLang;

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
      embeds: [buildEmbed(null, message, { isThinking: true, theme })],
      allowedMentions: { repliedUser: false }
    }).catch(() => null);

    console.log(`${C.cyan}[LYDIA]${C.reset} ${userName} [${lang}]: ${message.content?.substring(0, 50)} | ${theme.name}`);

    let imageUrl = null;
    if (message.attachments?.size > 0) {
      const att = message.attachments.first();
      if (att.contentType?.startsWith('image/')) imageUrl = att.url;
    }

    if (!userPrompt.trim()) {
      const greetings = {
        en: `Hey ${userName}! I'm here and ready to help. What would you like to know?`,
        fr: `Salut ${userName}! Je suis l\u00E0 et pr\u00EAt \u00E0 aider. Que souhaites-tu savoir?`,
        es: `\u00A1Hola ${userName}! Estoy aqu\u00ED y lista para ayudar. \u00BFQu\u00E9 te gustar\u00EDa saber?`,
        ar: `\u0645\u0631\u062D\u0628\u0627\u064B ${userName}! \u0623\u0646\u0627 \u0647\u0646\u0627 \u0648\u0645\u0633\u062A\u0639\u062F\u0629 \u0644\u0644\u0645\u0633\u0627\u0639\u062F\u0629. \u0645\u0627\u0630\u0627 \u062A\u0648\u062F \u0623\u0646 \u062A\u0639\u0631\u0641\u061F`,
        zh: `\u55E8 ${userName}! \u6211\u5728\u8FD9\u91CC\uFF0C\u968F\u65F6\u51C6\u5907\u5E2E\u5FD9\u3002\u4F60\u60F3\u77E5\u9053\u4EC0\u4E48\uFF1F`,
        ja: `\u3053\u3093\u306B\u3061\u306F ${userName}\u3055\u3093! \u304A\u624B\u4F1D\u3044\u3067\u304D\u308B\u3053\u3068\u304C\u3042\u308C\u3070\u3001\u304A\u6C17\u8EFD\u306B\u3069\u3046\u305E\u3002`,
      };
      const staticMsg = greetings[lang] || greetings.en;
      const staticEmbeds = buildEmbed(staticMsg, message, { isError: false, theme, lang });
      if (thinkingMsg) await thinkingMsg.edit({ embeds: staticEmbeds });
      else await message.reply({ embeds: staticEmbeds });
      messageProcessingLocks.delete(key);
      return;
    }

    const cached = getCachedResponse(message.author.id, userPrompt);
    if (cached && !imageUrl) {
      const cacheEmbeds = buildEmbed(cached.content, message, {
        isError: false, theme, model: cached.model, latency: 0, tokens: cached.tokens,
        sources: cached.sources || [], lang
      });
      if (thinkingMsg) await thinkingMsg.edit({ embeds: cacheEmbeds });
      else await message.reply({ embeds: cacheEmbeds });
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

    let ownerInfo = null;
    try {
      ownerInfo = await getGuildOwner(client, message.guild.id);
    } catch (ownerErr) {
      console.log(`${C.yellow}[OWNER CHECK ERR]${C.reset} ${ownerErr.message}`);
      ownerInfo = null;
    }
    const isOwner = ownerInfo && message.author.id === ownerInfo.id;
    const serverPrefix = client.getServerSettings?.(message.guild.id)?.prefix || process.env.PREFIX || '.';

    const systemPrompt = buildSystemPrompt(botName, userName, message.guild, isOwner, theme, serverPrefix, lang);

    const fullSystem = memories.length > 0
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
    const searchTriggers = ['search', 'find', 'what is', 'who is', 'latest', 'news', 'weather', 'how to', 'price', 'current', 'update', 'today'];
    if (searchTriggers.some(t => userPrompt.toLowerCase().includes(t)) && process.env.BRAVE_API_KEY) {
      const searchData = await webSearch(userPrompt);
      if (searchData) {
        searchResults = searchData.formatted;
        searchSources = searchData.sources;
        searchUsed = true;
      }
    }

    const finalPrompt = searchResults
      ? `[Web search results \u2014 cite sources using [1], [2], etc. when referencing]:\n${searchResults}\n\n[User question]: ${userPrompt}`
      : userPrompt;

    const aiResult = await generateAIResponse(fullSystem, finalPrompt, history, imageUrl, theme);

    if (!aiResult) {
      const errors = {
        en: !process.env.OPENROUTER_API_KEY
          ? '\u26A0\uFE0F **OPENROUTER_API_KEY** not detected in environment variables'
          : '\u26A0\uFE0F **AI temporarily unavailable.** Please try again in a moment.',
        fr: !process.env.OPENROUTER_API_KEY
          ? '\u26A0\uFE0F **OPENROUTER_API_KEY** non d\u00E9tect\u00E9e dans les variables d\u2019environnement'
          : '\u26A0\uFE0F **IA temporairement indisponible.** Veuillez r\u00E9essayer dans un moment.',
      };
      const errorEmbeds = buildEmbed(errors[lang] || errors.en, message, { isError: true, theme, lang });
      if (thinkingMsg) await thinkingMsg.edit({ embeds: errorEmbeds });
      else await message.reply({ embeds: errorEmbeds });
      messageProcessingLocks.delete(key);
      return;
    }

    const { content: aiReply, model, latency, tokens } = aiResult;

    const validation = validateResponse(aiReply);
    let safeReply = validation.ok ? validation.cleaned : validation.cleaned;
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
    const finalReply = parseAndScheduleReminder(cleanReply, message.author.id, message.channel.id, client, database);

    // NEW — buildEmbed now returns array of embeds (multi-embed support)
    const finalEmbeds = buildEmbed(finalReply, message, {
      isError: false, theme, model, latency, tokens, sources: searchSources, lang
    });

    if (thinkingMsg) await thinkingMsg.edit({ embeds: finalEmbeds });
    else await message.reply({ embeds: finalEmbeds });

    if (!imageUrl && finalReply.length > 20) {
      setCachedResponse(message.author.id, userPrompt, {
        content: finalReply, model, latency, tokens, sources: searchSources
      });
    }

    if (client.botStats && message.guild) {
      client.botStats.onLydiaChatProcessed?.(database, message.guild.id);
    }

  } catch (err) {
    console.error(`${C.red}[LYDIA]${C.reset} ${err.message}`);
    const errorEmbeds = buildEmbed('Something went wrong. Please try again!', message, { isError: true });
    if (thinkingMsg) await thinkingMsg.edit({ embeds: errorEmbeds }).catch(() => {});
    else await message.reply({ embeds: errorEmbeds }).catch(() => {});
  } finally {
    messageProcessingLocks.delete(key);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OWNER HELPER
// ═══════════════════════════════════════════════════════════════════════════════

async function getGuildOwner(client, guildId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    const owner = await client.users.fetch(guild.ownerId);
    return { id: owner.id, username: owner.username, displayName: owner.displayName || owner.username };
  } catch (e) { return null; }
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

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.guild) {
    if (respondFn) await respondFn({ content: '\u274C Channel not found.', flags: 64 });
    return;
  }

  const guild = channel.guild;
  const botName = guild.members.me?.displayName || client.user?.displayName || client.user?.username || 'Lydia';
  const prefix = client.getServerSettings?.(guildId)?.prefix || process.env.PREFIX || '.';

  if (action === 'status') {
    const isEnabled = !!client.lydiaChannels[channelId];
    const embed = new EmbedBuilder()
      .setColor(isEnabled ? '#2ecc71' : '#95a5a6')
      .setAuthor({
        name: `${botName} \u2022 ${isEnabled ? 'ACTIVE' : 'STANDBY'}`,
        iconURL: client.user.displayAvatarURL()
      })
      .setThumbnail(isEnabled ? client.user.displayAvatarURL() : null)
      .setDescription(
        isEnabled
          ? `\`\`\`ansi\n\u001b[1;32m[ SYSTEM MONITOR ]\u001b[0m\n\u001b[32m${botName} is active in #${channel.name}\u001b[0m\n\`\`\`\n` +
            `**Chat methods:**\n\u2022 Mention @${botName}\n\u2022 Type \`${prefix}ai [message]\`\n\u2022 Say \`${botName} [message]\`\n\n` +
            `\u{1F5BC}\u{FE0F} Image analysis supported.\n\u{1F310} Universal language support.`
          : `\`\`\`ansi\n\u001b[1;33m[ SYSTEM MONITOR ]\u001b[0m\n\u001b[33m${botName} is in standby mode\u001b[0m\n\`\`\`\n` +
            `**Activate:** \`${prefix}lydia on\`\n\n\u{1F4CC} Memory, reminders, web search, and multilingual support available when active.`
      )
      .setFooter({
        text: `#${channel.name} \u2022 ${new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Bamako' })}`,
        iconURL: guild.iconURL()
      })
      .setTimestamp();
    if (respondFn) await respondFn({ embeds: [embed] });
    return;
  }

  if (action === 'on') {
    if (client.lydiaChannels[channelId]) {
      if (respondFn) await respondFn({ content: `\u26A0\uFE0F ${botName} is already active here.`, flags: 64 });
      return;
    }

    client.lydiaChannels[channelId] = true;
    try {
      client.db?.prepare(`
        INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at)
        VALUES (?, ?, 1, ?)
      `).run(channelId, 'default', Math.floor(Date.now() / 1000));
    } catch (e) {}

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setAuthor({ name: `\u{1F7E2} SYSTEM MONITOR \u2022 ONLINE`, iconURL: client.user.displayAvatarURL() })
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription(
        `\`\`\`ansi\n\u001b[1;32m[ NEURAL LINK ESTABLISHED ]\u001b[0m\n\u001b[32m${botName} is now active in #${channel.name}\u001b[0m\n\`\`\`\n` +
        `**Chat methods:**\n\u2022 Mention @${botName}\n\u2022 Type \`${prefix}ai [question]\`\n\u2022 Say \`${botName} [question]\`\n\n` +
        `\u{1F9E0} Memory: \`[MEMORY: key | value]\`\n\u{1F551} Reminders: \`[REMIND: 5 min | message]\`\n\u{1F310} Universal language auto-detection`
      )
      .setFooter({ text: `#${channel.name} \u2022 Ready to help`, iconURL: guild.iconURL() })
      .setTimestamp();
    if (respondFn) await respondFn({ embeds: [embed] });
    return;
  }

  if (action === 'off') {
    if (!client.lydiaChannels[channelId]) {
      if (respondFn) await respondFn({ content: `\u26A0\uFE0F ${botName} is not active here.`, flags: 64 });
      return;
    }

    delete client.lydiaChannels[channelId];
    try {
      client.db?.prepare(`UPDATE lydia_agents SET is_active = 0 WHERE channel_id = ?`).run(channelId);
    } catch (e) {}

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setAuthor({ name: `\u{1F534} SYSTEM MONITOR \u2022 OFFLINE`, iconURL: client.user.displayAvatarURL() })
      .setDescription(
        `\`\`\`ansi\n\u001b[1;31m[ NEURAL LINK TERMINATED ]\u001b[0m\n\u001b[31m${botName} has been deactivated in #${channel.name}\u001b[0m\n\`\`\`\n` +
        `**Reactivate:** \`${prefix}lydia on\`\n\n\u{1F4AC} Available in other active channels.`
      )
      .setFooter({ text: `#${channel.name} \u2022 Sleep mode`, iconURL: guild.iconURL() })
      .setTimestamp();
    if (respondFn) await respondFn({ embeds: [embed] });
    return;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY SUBCOMMAND
// ═══════════════════════════════════════════════════════════════════════════════

async function handleMemorySubcommand(interactionOrMessage, database, isSlash = false) {
  let userId, username, respond;
  if (isSlash) {
    userId = interactionOrMessage.user.id;
    username = interactionOrMessage.user.username;
    respond = async (content) => interactionOrMessage.reply(content);
  } else {
    userId = interactionOrMessage.author.id;
    username = interactionOrMessage.author.username;
    respond = async (content) => interactionOrMessage.reply(content);
  }

  try {
    const memories = database.prepare(`
      SELECT memory_key, memory_value, updated_at FROM lydia_memory
      WHERE user_id = ? ORDER BY updated_at DESC
    `).all(userId);

    if (!memories.length) {
      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setAuthor({
          name: `\u{1F4ED} MEMORY VAULT \u2022 ${username}`,
          iconURL: isSlash ? interactionOrMessage.user.displayAvatarURL() : interactionOrMessage.author.displayAvatarURL()
        })
        .setDescription(
          `\`\`\`ansi\n\u001b[1;33m[ ARCHIVE EMPTY ]\u001b[0m\n\u001b[33mNo stored memories found.\u001b[0m\n\`\`\`\n` +
          `**How to save:** While chatting, include:\n\`[MEMORY: key | value]\`\n\n**Example:**\n\`Remember my favorite color is blue\`\n\u2192 Stores \`favorite_color: blue\``
        )
        .setFooter({ text: 'Memories persist across conversations' })
        .setTimestamp();
      await respond({ embeds: [embed], ephemeral: true });
      return;
    }

    const memoryFields = memories.slice(0, 25).map(m => {
      const date = new Date(m.updated_at).toLocaleDateString();
      return { name: `\u{1F4CC} ${m.memory_key}`, value: `${m.memory_value}\n*Stored: ${date}*`, inline: false };
    });

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setAuthor({
        name: `\u{1F9E0} MEMORY ARCHIVE \u2022 ${username}`,
        iconURL: isSlash ? interactionOrMessage.user.displayAvatarURL() : interactionOrMessage.author.displayAvatarURL()
      })
      .setDescription(`\`\`\`ansi\n\u001b[1;32m[ ${memories.length} RECORD(S) FOUND ]\u001b[0m\n\`\`\``)
      .addFields(memoryFields)
      .setFooter({ text: memories.length > 25 ? `Showing 25 of ${memories.length}` : 'Memories persist across conversations' })
      .setTimestamp();

    await respond({ embeds: [embed], ephemeral: true });
  } catch (err) {
    console.error(`${C.red}[LYDIA MEMORY]${C.reset} ${err.message}`);
    const errorEmbed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setAuthor({ name: '\u{1F534} SYSTEM ALERT', iconURL: isSlash ? interactionOrMessage.user.displayAvatarURL() : interactionOrMessage.author.displayAvatarURL() })
      .setDescription('\u274C Could not retrieve memories. Please try again later.')
      .setTimestamp();
    await respond({ embeds: [errorEmbed], ephemeral: true });
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

    database.prepare(`
      CREATE TABLE IF NOT EXISTS lydia_introductions (
        user_id TEXT, channel_id TEXT, introduced_at INTEGER,
        PRIMARY KEY (user_id, channel_id)
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

    rehydrateReminders(client, database);

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
      console.error(`\x1b[31m[EVENT CRITICAL]\x001b[0m ${eventErr.message}`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function runLydiaCommand(client, message, args, database, serverSettings, usedCommand) {
  if (!message.guild) return;
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor('#ff4757').setDescription('\u{1F534} **ACCESS DENIED** \u2014 Administrator privileges required')]
    }).catch(() => {});
  }

  const sub = args[0]?.toLowerCase() || 'status';
  if (sub === 'memory') return await handleMemorySubcommand(message, database, false);
  if (!['on', 'off', 'status'].includes(sub)) return;
  await handleLydiaToggle(client, message.channel.id, message.guild.id, message.author.id, sub, async (payload) => message.reply(payload));
}

const slashCommand = new SlashCommandBuilder()
  .setName('lydia')
  .setDescription('\u{1F9E0} Manage Lydia AI')
  .addSubcommand(s => s.setName('on').setDescription('\u{1F7E2} Activate Lydia AI'))
  .addSubcommand(s => s.setName('off').setDescription('\u{1F534} Deactivate Lydia AI'))
  .addSubcommand(s => s.setName('status').setDescription('\u{1F4CA} Show Lydia status'))
  .addSubcommand(s => s.setName('memory').setDescription('\u{1F9E0} View your stored memories'));

async function executeSlashCommand(interaction, client) {
  if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: 64 });
  if (!interaction.member.permissions?.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#ff4757').setDescription('\u{1F534} **ACCESS DENIED** \u2014 Administrator privileges required')],
      flags: 64
    });
  }

  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();

  if (sub === 'memory') {
    const database = client.db;
    if (!database) return interaction.followUp({ content: 'Database unavailable.' });
    return await handleMemorySubcommand(interaction, database, true);
  }

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
  execute: executeSlashCommand,
  data: slashCommand,
  setupLydia,
  webSearch,
  generateAIResponse,
  detectUserLanguage,
  validateResponse,
  scrubSecrets,
};

console.log(`${C.green}[LYDIA]${C.reset} AI Engine v2.6 loaded \u2014 Beautiful formatting | Anti-hallucination | ${Object.keys(LANG_NAMES).length} languages | Parallel models | Response cache`);
