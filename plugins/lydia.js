const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const axios = require('axios');

// ================= CONFIG =================
const COOLDOWN_TIME = 3000;
const MAX_HISTORY = 12;
const MAX_MEMORY_PER_USER = 25;
const CHANNEL_COOLDOWN = 1500;
const MAX_EMBED_DESC = 4096;
const MAX_TOKENS = 1024;

let isLydiaInitialized = false;
const userCooldowns = new Map();
const channelCooldowns = new Map();
const messageProcessingLocks = new Set();

// ================= COLORS =================
const C = {
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', blue: '\x1b[34m', reset: '\x1b[0m'
};

// ================= DYNAMIC POLICE/INTEL COLOR ENGINE =================
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

// ================= THEME ENGINE (ENHANCED) =================
const THEMES = {
  default:  { name: 'Monitor',      emoji: '✨', tone: 'friendly, helpful, conversational' },
  tech:     { name: 'Tech Analyst', emoji: '💻', tone: 'expert developer, clear explanations, production-ready code' },
  intel:    { name: 'Intel Officer',emoji: '🔍', tone: 'informative, well-sourced, factual, structured briefing' },
  tactical: { name: 'Field Guide',  emoji: '📋', tone: 'clear, actionable, step-by-step, mission-oriented' },
  medical:  { name: 'Health Advisor',emoji: '🏥', tone: 'caring, cautious, recommends professional help when needed' },
  academic: { name: 'Scholar',      emoji: '📚', tone: 'patient, thorough, breaks down complex topics' },
  police:   { name: 'System Monitor',emoji: '🛡️', tone: 'authoritative, precise, security-conscious, monitor-style' }
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

// ================= BOT ENGINE KNOWLEDGE (NO ENV SECRETS) =================
const BOT_KNOWLEDGE = `
You are Lydia, the onboard AI expert monitor for ARCHITECT CG-223 (also called ARCHON CG-223), a Discord bot engineered by Moussa Fofana from Bamako, Mali 🇲🇱.

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
2. ECONOMY — Credit system (🪙) with daily claims, streak bonuses (3d/7d/30d/100d/365d milestones), streak shields, and shop purchases.
3. BAMAKO MARKET — 4-state virtual market (Steady/Bull/Bear/Volatile) updating every 6 hours. Investment mechanics with profit claiming.
4. AUTO-MOD & SECURITY — Spam/link/invite filtering, mention limits, warning escalation (mute/kick/ban), and join-velocity threat scoring.
5. WELCOME & GOODBYE — Cinematic embeds with tier assignment based on member count, auto-role assignment, and stay-duration analytics.
6. TICKET SYSTEM — Button-panel support tickets with categories, staff roles, transcript channels, and auto-close timers.
7. REMINDERS & BIRTHDAYS — Persistent per-user reminders with DM+channel fallback. Birthday tracking with daily celebration checks.
8. TELEGRAM BRIDGE — Selective command sync to Telegram. Not a full mirror.
9. TIKTOK NOTIFICATIONS — Automated video tracking and designated channel posting.
10. LYDIA AI — Yourself. Memory, search, analysis, and conversational assistance.

PROFESSIONAL CONDUCT PROTOCOL:
1. NEVER fabricate features, commands, or capabilities. If uncertain, say: "I don't have real-time access to that configuration. Try the command or contact the architect."
2. NEVER mention TensorFlow, PyTorch, Keras, OpenCV, GPUs, hardware upgrades, or "nano bananas." These do not exist in this ecosystem.
3. When asked "what can you do," respond like a consultant: ask what domain they need help with, then provide targeted guidance. Do not dump a list unless explicitly asked for a full overview.
4. For general knowledge questions, prefer live web search. If search is unavailable, express uncertainty.
5. Never reveal file paths, database schemas, API keys, or internal architecture details.
6. Always match the user's language automatically.
7. Use markdown formatting for clarity. Keep responses concise but substantive.
8. For troubleshooting: diagnose first, then prescribe. Ask clarifying questions when needed.

OWNER INFO:
- Architect: Moussa Fofana (MFOF7310)
- Origin: Bamako, Mali 🇲🇱
- Public Repository: github.com/MFOF7310
`;

// ================= BOT NAME DETECTOR =================
function getBotName(message) {
  return message.guild?.members?.me?.displayName 
    || message.client?.user?.displayName 
    || message.client?.user?.username 
    || 'Lydia';
}

// ================= WEB SEARCH (ENHANCED WITH CLICKABLE LINKS) =================
async function webSearch(query) {
  if (!process.env.BRAVE_API_KEY) return null;
  try {
    const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'X-Subscription-Token': process.env.BRAVE_API_KEY,
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

// ================= MODEL POOL =================
const MODEL_POOL = [
  { id: 'meta-llama/llama-3.1-70b-instruct', emoji: '🧠', name: 'Llama 3.1' },
  { id: 'mistralai/mistral-7b-instruct', emoji: '⚡', name: 'Mistral 7B' },
  { id: 'google/gemini-2.0-flash-exp', emoji: '✨', name: 'Gemini Flash' },
  { id: 'anthropic/claude-3-haiku', emoji: '🎋', name: 'Claude Haiku' },
  { id: 'cohere/command-r-plus', emoji: '🔮', name: 'Command R+' }
];

async function generateAIResponse(systemPrompt, userMessage, history = [], imageUrl = null, theme = THEMES.default) {
  const messages = [{ role: 'system', content: systemPrompt }];

  if (Array.isArray(history) && history.length > 0) {
    messages.push({
      role: 'system',
      content: `[CONVERSATION HISTORY — Contextual reference only. Respond to the LATEST message]`
    });
    messages.push(...history.slice(-MAX_HISTORY).map(h => ({ role: h.role, content: h.content })));
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

  for (const model of MODEL_POOL) {
    try {
      const startTime = Date.now();
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: model.id,
        messages,
        temperature: 0.65,
        max_tokens: MAX_TOKENS,
        top_p: 0.9
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://github.com/MFOF7310',
          'X-Title': 'Architect-CG-223',
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });

      const latency = Date.now() - startTime;
      const content = response.data?.choices?.[0]?.message?.content;

      if (content && content.trim().length > 0) {
        const approxTokens = Math.ceil(content.length / 4);
        console.log(`${C.green}[AI OK]${C.reset} ${model.id} | ~${approxTokens}tk | ${latency}ms | ${theme.name}`);
        return { content: content.trim(), model, latency, tokens: approxTokens };
      }
    } catch (e) {
      const status = e.response?.status || 'NET';
      const errMsg = e.response?.data?.error?.message || e.message || 'unknown';
      console.log(`${C.yellow}[AI RETRY]${C.reset} ${model.id} | HTTP ${status} | ${errMsg.substring(0, 80)}`);
    }
  }

  console.log(`${C.red}[AI]${C.reset} All models failed. Check API key and network.`);
  return null;
}

// ================= MEMORY =================
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

// ================= REMINDERS (UNIFIED SCHEMA) =================
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
                .setAuthor({ name: '🔔 Reminder', iconURL: client.user?.displayAvatarURL() })
                .setDescription(`**${msg.trim()}**`)
                .setFooter({ text: 'Architect CG-223 • Reminder' })
                .setTimestamp()
              ]
            }).catch(() => {});
          }
          
          const ch = await client.channels.fetch(channelId).catch(() => null);
          if (ch?.isTextBased?.()) {
            await ch.send({
              content: `🔔 <@${userId}> **Reminder:** ${msg.trim()}`,
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
                content: `🔔 **OVERDUE** <@${r.user_id}>: ${r.message}`,
                allowedMentions: { users: [r.user_id] }
              }).catch(() => {});
            }
          })
          .catch(() => {});
        database.prepare(`UPDATE reminders SET delivered = 1 WHERE id = ?`).run(r.id);
      } else {
        setTimeout(async () => {
          try {
            const user = await client.users.fetch(r.user_id).catch(() => null);
            if (user) {
              await user.send({
                embeds: [new EmbedBuilder()
                  .setColor('#f1c40f')
                  .setAuthor({ name: '🔔 Reminder', iconURL: client.user?.displayAvatarURL() })
                  .setDescription(`**${r.message}**`)
                  .setFooter({ text: 'Architect CG-223 • Reminder' })
                  .setTimestamp()
                ]
              }).catch(() => {});
            }
            
            const ch = await client.channels.fetch(r.channel_id).catch(() => null);
            if (ch?.isTextBased?.()) {
              await ch.send({
                content: `🔔 <@${r.user_id}> **Reminder:** ${r.message}`,
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

// ================= POLICE/INTEL EMBED BUILDER (ENHANCED + SOURCES) =================
function buildEmbed(reply, message, options = {}) {
  const { isError = false, isThinking = false, theme = THEMES.default, model = null, latency = null, tokens = null, sources = [] } = options;

  const bamakoTime = new Date().toLocaleTimeString('en-US', {
    timeZone: 'Africa/Bamako',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const themeKey = Object.keys(THEMES).find(k => THEMES[k].name === theme.name) || 'default';
  const embedColor = isError ? '#ff4757' : getSentimentColor(themeKey, reply);

  let classification = 'UNCLASSIFIED';
  let badgeEmoji = '🟢';
  if (isError) { classification = 'SYSTEM ALERT'; badgeEmoji = '🔴'; }
  else if (themeKey === 'police') { classification = 'SECURITY BRIEF'; badgeEmoji = '🛡️'; }
  else if (themeKey === 'tech') { classification = 'TECHNICAL BRIEF'; badgeEmoji = '💻'; }
  else if (themeKey === 'intel') { classification = 'INTEL REPORT'; badgeEmoji = '🔍'; }
  else if (themeKey === 'medical') { classification = 'MEDICAL ADVISORY'; badgeEmoji = '🏥'; }
  else if (themeKey === 'tactical') { classification = 'FIELD GUIDE'; badgeEmoji = '📋'; }
  else if (themeKey === 'academic') { classification = 'RESEARCH NOTE'; badgeEmoji = '📚'; }

  if (isThinking) {
    return new EmbedBuilder()
      .setColor('#f1c40f')
      .setAuthor({
        name: `${badgeEmoji} ${classification} • ANALYZING...`,
        iconURL: message.author.displayAvatarURL({ dynamic: true, size: 32 })
      })
      .setDescription(`\`\`\`ansi\n\u001b[1;33m[ ${theme.name.toUpperCase()} ] \u001b[0m\u001b[33mProcessing neural request...\u001b[0m\n\`\`\``)
      .setFooter({
        text: `ARCHITECT CG-223 // ${message.guild?.name || 'DM'} // ${bamakoTime} UTC`,
        iconURL: message.guild?.iconURL({ size: 16 }) || message.client?.user?.displayAvatarURL()
      })
      .setTimestamp();
  }

  let formattedReply = reply;
  if (!isError && reply && reply.length > 120 && !reply.includes('```')) {
    formattedReply = reply
      .replace(/^(#{1,3})\s+/gm, '**') 
      .replace(/\n{3,}/g, '\n\n');
  }

  if (formattedReply.length > MAX_EMBED_DESC) {
    formattedReply = formattedReply.substring(0, MAX_EMBED_DESC - 3) + '...';
  }

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setAuthor({
      name: `${badgeEmoji} ${classification}`,
      iconURL: message.author.displayAvatarURL({ dynamic: true, size: 32 })
    })
    .setDescription(formattedReply)
    .setFooter({
      text: `ARCHITECT CG-223 // ${message.guild?.name || 'DM'} // ${bamakoTime} UTC`,
      iconURL: message.guild?.iconURL({ size: 16 }) || message.client?.user?.displayAvatarURL()
    })
    .setTimestamp();

  const botCommands = ['.daily', '.shop', '.profile', '.level', '.market', '.help', '.ticket', '.remind', '.afk', '.invest', '.claim', '.streak', '.rank', '.leaderboard', '.whois', '.mute', '.kick', '.ban', '.warn', '.automod'];
  const mentionedCommand = reply ? botCommands.find(cmd => reply.toLowerCase().includes(cmd)) : null;
  if (mentionedCommand && !isError) {
    embed.addFields({
      name: '📋 SYSTEM BRIEFING',
      value: `\`> ${mentionedCommand}\` — Use this command in any server channel.`,
      inline: false
    });
  }

  // 🔗 REAL-TIME SOURCES FIELD
  if (sources.length > 0 && !isError && !isThinking) {
    const sourceLinks = sources.slice(0, 4).map((s, i) => {
      const title = s.title.length > 80 ? s.title.substring(0, 80) + '...' : s.title;
      return `[[${i + 1}]](${s.url}) ${title}`;
    }).join('\n');
    embed.addFields({
      name: '🔗 Real-Time Sources',
      value: sourceLinks,
      inline: false
    });
  }

  if ((themeKey === 'tech' || themeKey === 'intel') && model && !isError) {
    embed.setFooter({
      text: `ARCHITECT CG-223 // ${model.name} // ${latency}ms // ${message.guild?.name || 'DM'} // ${bamakoTime} UTC`,
      iconURL: message.guild?.iconURL({ size: 16 }) || message.client?.user?.displayAvatarURL()
    });
  }

  return embed;
}

// ================= SYSTEM PROMPT BUILDER (UNIVERSAL + ENGINE KNOWLEDGE) =================
function buildSystemPrompt(botName, userName, guild, isOwner, theme, prefix = '.', lang = 'en') {
  const bamakoTime = new Date().toLocaleTimeString('en-US', {
    timeZone: 'Africa/Bamako',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  const dateStr = new Date().toLocaleDateString('en-US', {
    timeZone: 'Africa/Bamako',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `${BOT_KNOWLEDGE}

You are ${botName}, the onboard AI expert monitor for ARCHITECT CG-223.

OPERATIONAL CONTEXT:
- Server: ${guild.name}
- User: ${userName} ${isOwner ? '(Bot Owner)' : ''}
- Date: ${dateStr}
- Time: ${bamakoTime} (Bamako, UTC+0)
- Active Mode: ${theme.name}
- Server Prefix: \`${prefix}\`
- Command Format: \`${prefix}command\` or \`/command\`

GUIDANCE STANDARDS:
- Be professional, warm, and precise — like a senior technical consultant.
- Diagnose before prescribing. Ask one clarifying question if the user's intent is ambiguous.
- When suggesting commands, always provide both prefix and slash variants.
- If a user asks about something outside the bot's scope, offer web search or suggest they contact the architect.
- Never dump exhaustive lists unless explicitly requested. Prioritize relevance.
- Cite web sources using [1], [2] format when search data is provided.`;
}

// ================= MESSAGE HANDLER =================
async function handleLydiaMessage(message, client, database) {
  if (!message.guild || message.author.bot) return;

  const key = `${message.id}-${message.author.id}`;
  if (messageProcessingLocks.has(key)) return;

  const now = Date.now();
  if (now - (userCooldowns.get(message.author.id) || 0) < COOLDOWN_TIME) return;
  if (channelCooldowns.has(message.channel.id) && now - channelCooldowns.get(message.channel.id) < CHANNEL_COOLDOWN) return;
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
    const lang = client.userLastLang?.get(message.author.id) || 'en';

    const addressed = content.startsWith(botName.toLowerCase()) || message.mentions?.has(client.user);
    if (!addressed) { messageProcessingLocks.delete(key); return; }

    let userPrompt = message.content || '';
    if (content.startsWith(botName.toLowerCase())) {
      userPrompt = (message.content || '').slice(botName.length).trim();
    } else {
      userPrompt = (message.content || '').replace(new RegExp(`<<@!?${client.user.id}>`), '').trim();
    }

    const theme = detectTheme(userPrompt || 'hello');

    thinkingMsg = await message.reply({
      embeds: [buildEmbed(null, message, { isThinking: true, theme })],
      allowedMentions: { repliedUser: false }
    }).catch(() => null);

    console.log(`${C.cyan}[LYDIA]${C.reset} ${userName}: ${message.content?.substring(0, 50)} | ${theme.name}`);

    let imageUrl = null;
    if (message.attachments?.size > 0) {
      const att = message.attachments.first();
      if (att.contentType?.startsWith('image/')) imageUrl = att.url;
    }

    if (!userPrompt.trim()) {
      const staticMsg = `Hey ${userName}! I'm here and ready to help. What would you like to know?`;
      const staticEmbed = buildEmbed(staticMsg, message, { isError: false, theme });
      if (thinkingMsg) await thinkingMsg.edit({ embeds: [staticEmbed] });
      else await message.reply({ embeds: [staticEmbed] });
      messageProcessingLocks.delete(key);
      return;
    }

    let memories = [];
    try {
      memories = database.prepare(`
        SELECT memory_key, memory_value FROM lydia_memory
        WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?
      `).all(message.author.id, MAX_MEMORY_PER_USER);
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
      ? `${systemPrompt}\n\n[Your memories about this user]:\n${memories.map(m => `• ${m.memory_key}: ${m.memory_value}`).join('\n')}`
      : systemPrompt;

    let history = [];
    try {
      const rawHistory = database.prepare(`
        SELECT role, content, user_name FROM lydia_conversations
        WHERE channel_id = ? AND guild_id = ? ORDER BY timestamp DESC LIMIT ?
      `).all(message.channel.id, message.guild.id, MAX_HISTORY);

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
      ? `[Web search results — cite sources using [1], [2], etc. when referencing]:\n${searchResults}\n\n[User question]: ${userPrompt}`
      : userPrompt;

    const aiResult = await generateAIResponse(fullSystem, finalPrompt, history, imageUrl, theme);

    if (!aiResult) {
      const errorMsg = !process.env.OPENROUTER_API_KEY
        ? '⚠️ **OPENROUTER_API_KEY** not detected in environment variables'
        : '⚠️ **AI temporarily unavailable.** Please try again in a moment.';
      const errorEmbed = buildEmbed(errorMsg, message, { isError: true, theme });
      if (thinkingMsg) await thinkingMsg.edit({ embeds: [errorEmbed] });
      else await message.reply({ embeds: [errorEmbed] });
      messageProcessingLocks.delete(key);
      return;
    }

    const { content: aiReply, model, latency, tokens } = aiResult;

    // ===== ANTI-HALLUCINATION FILTER =====
    const bannedTerms = ['nano banana', 'tensorflow', 'pytorch', 'keras', 'opencv', 'scikit-image', 'gpu upgrade', 'hardware upgrade'];
    let safeReply = aiReply;
    for (const term of bannedTerms) {
      if (safeReply.toLowerCase().includes(term)) {
        console.log(`${C.red}[HALLUCINATION FILTER]${C.reset} Blocked term: ${term}`);
        safeReply = "I don't have information about that. I can help you with the features listed in my system briefing instead.";
        break;
      }
    }
    // =====================================

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

    const finalEmbed = buildEmbed(finalReply, message, { isError: false, theme, model, latency, tokens, sources: searchSources });
    if (thinkingMsg) await thinkingMsg.edit({ embeds: [finalEmbed] });
    else await message.reply({ embeds: [finalEmbed] });

    if (client.botStats && message.guild) {
      client.botStats.onLydiaChatProcessed?.(database, message.guild.id);
    }

  } catch (err) {
    console.error(`${C.red}[LYDIA]${C.reset} ${err.message}`);
    const errorEmbed = buildEmbed('Something went wrong. Please try again!', message, { isError: true });
    if (thinkingMsg) await thinkingMsg.edit({ embeds: [errorEmbed] }).catch(() => {});
    else await message.reply({ embeds: [errorEmbed] }).catch(() => {});
  } finally {
    messageProcessingLocks.delete(key);
  }
}

// ================= OWNER HELPER =================
async function getGuildOwner(client, guildId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    const owner = await client.users.fetch(guild.ownerId);
    return { id: owner.id, username: owner.username, displayName: owner.displayName || owner.username };
  } catch (e) { return null; }
}

// ================= PRUNE =================
function pruneOldConversations(database) {
  try {
    const result = database.prepare(`
      DELETE FROM lydia_conversations WHERE timestamp < ?
    `).run(Math.floor(Date.now() / 1000) - (7 * 86400));
    if (result.changes > 0) console.log(`${C.green}[LYDIA]${C.reset} ${result.changes} old messages pruned`);
  } catch (e) {}
}

// ================= TOGGLE HANDLER (PERSISTENCE-SAFE) =================
async function handleLydiaToggle(client, channelId, guildId, userId, action, respondFn = null) {
  if (!client.lydiaChannels) client.lydiaChannels = {};

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.guild) {
    if (respondFn) await respondFn({ content: '❌ Channel not found.', flags: 64 });
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
        name: `${botName} • ${isEnabled ? 'ACTIVE' : 'STANDBY'}`,
        iconURL: client.user.displayAvatarURL()
      })
      .setThumbnail(isEnabled ? client.user.displayAvatarURL() : null)
      .setDescription(
        isEnabled
          ? `\`\`\`ansi\n\u001b[1;32m[ SYSTEM MONITOR ]\u001b[0m\n\u001b[32m${botName} is active in #${channel.name}\u001b[0m\n\`\`\`\n` +
            `**Chat methods:**\n‣ Mention @${botName}\n‣ Type \`${prefix}ai [message]\`\n‣ Say \`${botName} [message]\`\n\n` +
            `🖼️ Image analysis supported.`
          : `\`\`\`ansi\n\u001b[1;33m[ SYSTEM MONITOR ]\u001b[0m\n\u001b[33m${botName} is in standby mode\u001b[0m\n\`\`\`\n` +
            `**Activate:** \`${prefix}lydia on\`\n\n📌 Memory, reminders, and web search available when active.`
      )
      .setFooter({
        text: `#${channel.name} • ${new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Bamako' })}`,
        iconURL: guild.iconURL()
      })
      .setTimestamp();
    if (respondFn) await respondFn({ embeds: [embed] });
    return;
  }

  if (action === 'on') {
    if (client.lydiaChannels[channelId]) {
      if (respondFn) await respondFn({ content: `⚠️ ${botName} is already active here.`, flags: 64 });
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
      .setAuthor({ name: `🟢 SYSTEM MONITOR • ONLINE`, iconURL: client.user.displayAvatarURL() })
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription(
        `\`\`\`ansi\n\u001b[1;32m[ NEURAL LINK ESTABLISHED ]\u001b[0m\n\u001b[32m${botName} is now active in #${channel.name}\u001b[0m\n\`\`\`\n` +
        `**Chat methods:**\n‣ Mention @${botName}\n‣ Type \`${prefix}ai [question]\`\n‣ Say \`${botName} [question]\`\n\n` +
        `🧠 Memory: \`[MEMORY: key | value]\`\n⏰ Reminders: \`[REMIND: 5 min | message]\``
      )
      .setFooter({ text: `#${channel.name} • Ready to help`, iconURL: guild.iconURL() })
      .setTimestamp();
    if (respondFn) await respondFn({ embeds: [embed] });
    return;
  }

  if (action === 'off') {
    if (!client.lydiaChannels[channelId]) {
      if (respondFn) await respondFn({ content: `⚠️ ${botName} is not active here.`, flags: 64 });
      return;
    }
    
    delete client.lydiaChannels[channelId];
    try {
      client.db?.prepare(`UPDATE lydia_agents SET is_active = 0 WHERE channel_id = ?`).run(channelId);
    } catch (e) {}
    
    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setAuthor({ name: `🔴 SYSTEM MONITOR • OFFLINE`, iconURL: client.user.displayAvatarURL() })
      .setDescription(
        `\`\`\`ansi\n\u001b[1;31m[ NEURAL LINK TERMINATED ]\u001b[0m\n\u001b[31m${botName} has been deactivated in #${channel.name}\u001b[0m\n\`\`\`\n` +
        `**Reactivate:** \`${prefix}lydia on\`\n\n💬 Available in other active channels.`
      )
      .setFooter({ text: `#${channel.name} • Sleep mode`, iconURL: guild.iconURL() })
      .setTimestamp();
    if (respondFn) await respondFn({ embeds: [embed] });
    return;
  }
}

// ================= MEMORY SUBCOMMAND =================
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
          name: `📭 MEMORY VAULT • ${username}`,
          iconURL: isSlash ? interactionOrMessage.user.displayAvatarURL() : interactionOrMessage.author.displayAvatarURL()
        })
        .setDescription(
          `\`\`\`ansi\n\u001b[1;33m[ ARCHIVE EMPTY ]\u001b[0m\n\u001b[33mNo stored memories found.\u001b[0m\n\`\`\`\n` +
          `**How to save:** While chatting, include:\n\`[MEMORY: key | value]\`\n\n**Example:**\n\`Remember my favorite color is blue\`\n→ Stores \`favorite_color: blue\``
        )
        .setFooter({ text: 'Memories persist across conversations' })
        .setTimestamp();
      await respond({ embeds: [embed], ephemeral: true });
      return;
    }

    const memoryFields = memories.slice(0, 25).map(m => {
      const date = new Date(m.updated_at).toLocaleDateString();
      return {
        name: `📌 ${m.memory_key}`,
        value: `${m.memory_value}\n*Stored: ${date}*`,
        inline: false
      };
    });

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setAuthor({
        name: `🧠 MEMORY ARCHIVE • ${username}`,
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
      .setAuthor({ name: '🔴 SYSTEM ALERT', iconURL: isSlash ? interactionOrMessage.user.displayAvatarURL() : interactionOrMessage.author.displayAvatarURL() })
      .setDescription('❌ Could not retrieve memories. Please try again later.')
      .setTimestamp();
    await respond({ embeds: [errorEmbed], ephemeral: true });
  }
}

// ================= SETUP (RESTORED — CRITICAL!) =================
function setupLydia(client, database) {
  if (!client || !database || isLydiaInitialized) return;
  isLydiaInitialized = true;

  try {
    database.prepare(`
      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_tag TEXT,
        guild_id TEXT,
        channel_id TEXT NOT NULL,
        message TEXT NOT NULL,
        execute_at INTEGER NOT NULL,
        delivered INTEGER DEFAULT 0,
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
        console.log(`${C.yellow}[MIGRATION]${C.reset} Old reminders schema detected — migrating...`);
        database.prepare('ALTER TABLE reminders RENAME TO reminders_old').run();
        database.prepare(`
          CREATE TABLE reminders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            user_tag TEXT,
            guild_id TEXT,
            channel_id TEXT NOT NULL,
            message TEXT NOT NULL,
            execute_at INTEGER NOT NULL,
            delivered INTEGER DEFAULT 0,
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

    console.log(`${C.green}[LYDIA]${C.reset} ${active.length} channels restored. Ready to chat!`);
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
      console.error(`\x1b[31m[EVENT CRITICAL]\x1b[0m ${eventErr.message}`);
    }
  });
}

// ================= COMMAND HANDLERS =================
async function runLydiaCommand(client, message, args, database, serverSettings, usedCommand) {
  if (!message.guild) return;
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor('#ff4757').setDescription('🔴 **ACCESS DENIED** — Administrator privileges required')]
    }).catch(() => {});
  }

  const sub = args[0]?.toLowerCase() || 'status';
  if (sub === 'memory') return await handleMemorySubcommand(message, database, false);
  if (!['on', 'off', 'status'].includes(sub)) return;
  await handleLydiaToggle(client, message.channel.id, message.guild.id, message.author.id, sub, async (payload) => message.reply(payload));
}

const slashCommand = new SlashCommandBuilder()
  .setName('lydia')
  .setDescription('🧠 Manage Lydia AI')
  .addSubcommand(s => s.setName('on').setDescription('🟢 Activate Lydia AI'))
  .addSubcommand(s => s.setName('off').setDescription('🔴 Deactivate Lydia AI'))
  .addSubcommand(s => s.setName('status').setDescription('📊 Show Lydia status'))
  .addSubcommand(s => s.setName('memory').setDescription('🧠 View your stored memories'));

async function executeSlashCommand(interaction, client) {
  if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: 64 });
  if (!interaction.member.permissions?.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#ff4757').setDescription('🔴 **ACCESS DENIED** — Administrator privileges required')],
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

// ================= EXPORTS =================
module.exports = {
  name: 'lydia',
  aliases: ['ai', 'neural'],
  description: '🧠 Friendly AI assistant — multilingual, remembers facts, web-enabled',
  category: 'SYSTEM',
  cooldown: 5000,
  run: runLydiaCommand,
  execute: executeSlashCommand,
  data: slashCommand,
  setupLydia,
  webSearch,
  generateAIResponse
};
