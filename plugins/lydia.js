const { EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const axios = require('axios');

// ================= CONFIG =================
const COOLDOWN_TIME = 4000;
const MAX_HISTORY = 10;
const MAX_MEMORY_PER_USER = 20;

// Confirmed working models on OpenRouter (updated 2026-05-18)
const PRIMARY_MODEL = 'google/gemini-2.0-flash-001';
const FALLBACK_MODEL = 'meta-llama/llama-3.1-70b-instruct';

let isLydiaInitialized = false;
const userCooldowns = new Map();
const messageProcessingLocks = new Set();

// ================= COLORS =================
const green = '\x1b[32m', yellow = '\x1b[33m', red = '\x1b[31m', cyan = '\x1b[36m', reset = '\x1b[0m';

// ================= WEB SEARCH =================
async function webSearch(query) {
    if (!process.env.BRAVE_API_KEY) return null;
    try {
        const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
            headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY, 'Accept': 'application/json' },
            params: { q: query, count: 3, text_decorations: false, safesearch: 'strict' },
            timeout: 8000
        });
        if (!res.data?.web?.results?.length) return null;
        return res.data.web.results.slice(0, 3).map(r => `- ${r.title}: ${r.description}`).join('\n');
    } catch (e) { return null; }
}

// ================= AI RESPONSE (SIMPLE: 1 model + 1 fallback) =================
async function generateAIResponse(systemPrompt, userMessage, history = [], imageUrl = null) {
    const messages = [{ role: 'system', content: systemPrompt }];

    // Recent conversation context with header for better model understanding
if (Array.isArray(history) && history.length > 0) {
    messages.push({ 
        role: 'system', 
        content: '[CONVERSATION HISTORY BELOW — Use for context but respond only to the latest message]' 
    });
    messages.push(...history.slice(-MAX_HISTORY).map(h => ({ role: h.role, content: h.content })));
}

    if (imageUrl) {
        messages.push({
            role: 'user',
            content: [{ type: 'text', text: userMessage }, { type: 'image_url', image_url: { url: imageUrl } }]
        });
    } else {
        messages.push({ role: 'user', content: userMessage });
    }

    const models = [PRIMARY_MODEL, FALLBACK_MODEL];
    for (const model of models) {
        try {
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model, messages, temperature: 0.7, max_tokens: 800
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://github.com/MFOF7310',
                    'X-Title': 'Architect-CG-223',
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });
            if (response.data?.choices?.[0]?.message?.content) {
    const content = response.data.choices[0].message.content;
    const approxTokens = Math.ceil(content.length / 4);
    console.log(`${green}[AI OK]${reset} ${model} | ~${approxTokens} tokens`);
    return content;
}
        } catch (e) {
            const status = e.response?.status || 'no-status';
            const errData = e.response?.data;
            const errMsg = errData?.error?.message || errData?.message || e.message || 'unknown';
            console.log(`${red}[AI FAIL]${reset} ${model} | HTTP ${status} | ${errMsg.substring(0, 100)}`);
            if (errData) console.log(`${red}[AI DETAIL]${reset}`, JSON.stringify(errData).substring(0, 200));
        }
    }
    console.log(`${red}[AI]${reset} Both models failed. Check: 1) OPENROUTER_API_KEY 2) OpenRouter credits 3) Model availability`);
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
            database.prepare(`INSERT INTO lydia_memory (user_id, memory_key, memory_value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, memory_key) DO UPDATE SET memory_value = excluded.memory_value, updated_at = excluded.updated_at`).run(userId, key, value, Date.now());
        } catch (e) {}
    }
}

// ================= REMINDERS =================
function parseAndScheduleReminder(response, userId, channelId, client, database) {
    const regex = /\[REMIND:\s*(\d+)\s*(min|h|sec|s|m)\s*\|\s*(.+?)\]/i;
    const match = response.match(regex);
    if (!match) return response;

    const [, amount, unit, msg] = match;
    const multipliers = { sec: 1000, s: 1000, min: 60000, m: 60000, h: 3600000 };
    const ms = Math.max(5000, Math.min(parseInt(amount) * (multipliers[unit.toLowerCase()] || 60000), 30 * 86400000));
    const executeAt = Math.floor((Date.now() + ms) / 1000);
    const id = `${userId}_${executeAt}_${Math.random().toString(36).slice(2, 7)}`;

    try {
        database.prepare(`INSERT INTO reminders (id, user_id, channel_id, message, execute_at, status) VALUES (?, ?, ?, ?, ?, 'pending')`).run(id, userId, channelId, msg, executeAt);
        setTimeout(async () => {
            try {
                const ch = await client.channels.fetch(channelId).catch(() => null);
                if (ch) await ch.send(`🔔 <@${userId}> **Reminder:** ${msg}`).catch(() => {});
                database.prepare(`UPDATE reminders SET status = 'completed' WHERE id = ?`).run(id);
            } catch (e) {}
        }, ms);
    } catch (e) {}
    return response.replace(/\[REMIND:[^\]]*\]/i, '').trim();
}

function rehydrateReminders(client, database) {
    try {
        const pending = database.prepare(`SELECT * FROM reminders WHERE status = 'pending' AND execute_at > ?`).all(Math.floor(Date.now() / 1000));
        for (const r of pending) {
            const ms = (r.execute_at * 1000) - Date.now();
            if (ms <= 0) {
                client.channels.fetch(r.channel_id).then(ch => ch?.send(`🔔 **OVERDUE** <@${r.user_id}>: ${r.message}`).catch(() => {})).catch(() => {});
                database.prepare(`UPDATE reminders SET status = 'completed' WHERE id = ?`).run(r.id);
            } else {
                setTimeout(async () => {
                    const ch = await client.channels.fetch(r.channel_id).catch(() => null);
                    if (ch) await ch.send(`🔔 <@${r.user_id}> **Reminder:** ${r.message}`).catch(() => {});
                    database.prepare(`UPDATE reminders SET status = 'completed' WHERE id = ?`).run(r.id);
                }, ms);
            }
        }
        if (pending.length > 0) console.log(`${green}[REHYDRATE]${reset} ${pending.length} reminders restored`);
    } catch (e) {}
}

// ================= EMBED (CLEAN: no latency, no model name, no tech details) =================
function buildEmbed(reply, message) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setDescription(reply.length > 4096 ? reply.substring(0, 4093) + '...' : reply);
    if (message.guild) {
        embed.setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ size: 16 }) || undefined });
    }
    return embed;
}

// ================= SYSTEM PROMPT (SIMPLE) =================
function buildSystemPrompt(botName, userName, lang, guild, isOwner) {
    const bamakoTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Bamako' });
        let prompt = `You are ${botName}, the AI assistant of ARCHITECT CG-223. Created by Moussa Fofana (MFOF7310). Based in Bamako, Mali.

RULES:
- Be warm and direct. Like a smart friend, not a robot.
- Keep responses short (1-3 sentences) unless asked for detail.
- CRITICAL LANGUAGE RULE: Always detect the user's language from their message and respond in THAT EXACT language. If they write in French, reply in French. If Chinese, reply in Chinese. If Arabic, reply in Arabic. Never switch languages mid-conversation. Default to English only if the language is unclear.
- If you don't know, say so honestly.
- To remember: [MEMORY: key | value]
- To set reminder: [REMIND: N min/h/sec | message]

CONTEXT:
User: ${userName}${isOwner ? ' (OWNER)' : ''}
Server: ${guild.name}
Time: ${bamakoTime}
Location: Bamako, Mali`;

    if (isOwner) prompt += '\nThis user is the server owner. Address them respectfully.';
    return prompt;
}

// ================= MESSAGE HANDLER (OPTIMIZED) =================
async function handleLydiaMessage(message, client, database) {
    if (!message.guild || message.author.bot) return;

    const key = `${message.id}-${message.author.id}`;
    if (messageProcessingLocks.has(key)) return;

    const now = Date.now();
    if (now - (userCooldowns.get(message.author.id) || 0) < COOLDOWN_TIME) return;
    if (!client.lydiaChannels?.[message.channel.id]) return;

    messageProcessingLocks.add(key);
    userCooldowns.set(message.author.id, now);

    try {
        const botName = message.guild.members.me?.displayName || 'Lydia';
        const userName = message.member?.displayName || message.author.username;
        const content = message.content?.toLowerCase() || '';
        const lang = client.detectLanguage ? (client.detectLanguage(message.content) || 'en') : 'en';

        const addressed = content.startsWith(botName.toLowerCase()) || message.mentions?.has(client.user);
        if (!addressed) { messageProcessingLocks.delete(key); return; }

        await message.channel.sendTyping().catch(() => {});
        console.log(`${cyan}[LYDIA]${reset} ${userName}: ${message.content?.substring(0, 50)}`);

        // Extract user prompt
        let userPrompt = message.content || '';
        let imageUrl = null;
        if (message.attachments?.size > 0) {
            const att = message.attachments.first();
            if (att.contentType?.startsWith('image/')) imageUrl = att.url;
        }
        if (content.startsWith(botName.toLowerCase())) userPrompt = message.content.slice(botName.length).trim();
        else userPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();

        // First-time greeting
        let introGreeting = '';
        try {
            const existing = database.prepare('SELECT 1 FROM lydia_introductions WHERE user_id = ? AND channel_id = ?').get(message.author.id, message.channel.id);
            if (!existing) {
                const greetings = lang === 'fr'
                    ? [`👋 Salut **${userName}** ! Je suis ${botName}, ravie de te rencontrer !`, `🌟 Hey **${userName}** ! Bienvenue sur **${message.guild.name}** !`]
                    : [`👋 Hey **${userName}** ! I'm ${botName}, nice to meet you !`, `🌟 Hello **${userName}** ! Welcome to **${message.guild.name}** !`];
                introGreeting = greetings[Math.floor(Math.random() * greetings.length)];
                database.prepare('INSERT OR IGNORE INTO lydia_introductions (user_id, channel_id, introduced_at) VALUES (?, ?, ?)').run(message.author.id, message.channel.id, Date.now());
            }
        } catch (e) {}

        if (!userPrompt.trim()) {
            const reply = introGreeting || `👋 Hey ${userName} ! I'm here — just ask me anything.`;
            await message.reply({ embeds: [buildEmbed(reply, message)] });
            messageProcessingLocks.delete(key);
            return;
        }

        if (introGreeting) userPrompt = `[First conversation. Greet naturally: "${introGreeting}"] ${userPrompt}`;

// Skip AI for simple greetings (saves API credits)
const simpleGreetings = /^(hello|hi|hey|salut|coucou|yo|bonjour|bonsoir)[\s!]*$/i;
if (simpleGreetings.test(userPrompt.trim()) && !imageUrl) {
    const replies = lang === 'fr' 
        ? [`👋 Salut **${userName}** !`, `😊 Coucou !`, `✨ Hey, quoi de neuf ?`]
        : [`👋 Hey **${userName}** !`, `😊 Hi there!`, `✨ Hello! What's up?`];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    await message.reply({ embeds: [buildEmbed(reply, message)] });
    messageProcessingLocks.delete(key);
    return;
}

// ================= OPTIMIZED MEMORY & HISTORY MATRIX =================
        const ownerInfo = await getGuildOwner(client, message.guild.id);
        const isOwner = ownerInfo && message.author.id === ownerInfo.id;
        const systemPrompt = buildSystemPrompt(botName, userName, lang, message.guild, isOwner);

        // 1. Fetch user memories cleanly
        let memories = [];
        try { 
            memories = database.prepare('SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?')
                .all(message.author.id, MAX_MEMORY_PER_USER); 
        } catch (e) {}
        
        const fullSystem = memories.length > 0 
            ? `${systemPrompt}\n\n[USER FACT MEMORIES]:\n${memories.map(m => `• ${m.memory_key}: ${m.memory_value}`).join('\n')}` 
            : systemPrompt;

        // 2. Fetch recent conversation history safely
let history = [];
try { 
    const rawHistory = database.prepare('SELECT role, content, user_name FROM lydia_conversations WHERE channel_id = ? AND guild_id = ? ORDER BY timestamp DESC LIMIT ?')
        .all(message.channel.id, message.guild.id, MAX_HISTORY);
    
    // Reverse so oldest comes first
    rawHistory.reverse();

    // Strict alternation filter with username context preserved
    for (const turn of rawHistory) {
        const cleanRole = turn.role === 'assistant' ? 'assistant' : 'user';
        const cleanContent = cleanRole === 'user' 
            ? `${turn.user_name}: ${turn.content}` 
            : turn.content;
        
        // Merge consecutive same-role messages to maintain alternation
        if (history.length > 0 && history[history.length - 1].role === cleanRole) {
            history[history.length - 1].content += `\n${cleanContent}`;
        } else {
            history.push({ role: cleanRole, content: cleanContent });
        }
    }
} catch (e) {
    console.log(`[LYDIA HISTORY ERR] ${e.message}`);
}

        // 3. Save user message BEFORE API call (single save, no duplicates)
        try { 
            database.prepare('INSERT INTO lydia_conversations (channel_id, guild_id, user_id, user_name, role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?, strftime("%s", "now"))')
                .run(message.channel.id, message.guild.id, message.author.id, userName, 'user', userPrompt); 
        } catch (e) {}

        // Search + AI
        let searchResults = null;
        const searchTriggers = ['search', 'find', 'what is', 'who is', 'latest', 'news', 'weather', 'how to'];
        if (searchTriggers.some(t => userPrompt.toLowerCase().includes(t)) && process.env.BRAVE_API_KEY) {
            searchResults = await webSearch(userPrompt);
        }
        const finalPrompt = searchResults ? `[SEARCH]:\n${searchResults}\n\n[QUESTION]: ${userPrompt}` : userPrompt;

        const aiReply = await generateAIResponse(fullSystem, finalPrompt, history, imageUrl);
        if (!aiReply) {
            const errorMsg = !process.env.OPENROUTER_API_KEY 
                ? '❌ **OPENROUTER_API_KEY** not set in `.env` file'
                : '❌ **AI temporarily unavailable.**\n_Check bot console for error details._';
            await message.reply({ embeds: [buildEmbed(errorMsg, message)] });
            messageProcessingLocks.delete(key);
            return;
        }

        // Clean and save assistant reply
        const cleanReply = aiReply.replace(/\[MEMORY:\s*[^|]+?\s*\|\s*[^\]]+?\s*\]/g, '').replace(/\[REMIND:[^\]]*\]/i, '').trim();
        try { 
            database.prepare('INSERT INTO lydia_conversations (channel_id, guild_id, user_id, user_name, role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?, strftime("%s", "now"))')
                .run(message.channel.id, message.guild.id, client.user.id, botName, 'assistant', aiReply); 
        } catch (e) {}
        
        parseAndStoreMemory(aiReply, message.author.id, database);
        const finalReply = parseAndScheduleReminder(cleanReply, message.author.id, message.channel.id, client, database);

        await message.reply({ embeds: [buildEmbed(finalReply, message)] });

        if (client.botStats && message.guild) client.botStats.onLydiaChatProcessed(database, message.guild.id);

    } catch (err) {
        console.error(`${red}[LYDIA]${reset} ${err.message}`);
        message.reply('Something went wrong. Try again.').catch(() => {});
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
        const result = database.prepare('DELETE FROM lydia_conversations WHERE timestamp < ?').run(Math.floor(Date.now() / 1000) - (7 * 86400));
        if (result.changes > 0) console.log(`${green}[LYDIA]${reset} ${result.changes} old messages pruned`);
    } catch (e) {}
}

// ================= TOGGLE HANDLER =================
async function handleLydiaToggle(client, channelId, guildId, userId, action, respondFn = null) {
    if (!client.lydiaChannels) client.lydiaChannels = {};

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.guild) { if (respondFn) await respondFn({ content: 'Channel not found.', flags: 64 }); return; }

    const guild = channel.guild;
    const botName = guild.members.me?.displayName || 'Lydia';
    const prefix = client.getServerSettings?.(guildId)?.prefix || process.env.PREFIX || '.';

    if (action === 'status') {
        const isEnabled = client.lydiaChannels[channelId];
        const embed = new EmbedBuilder()
            .setColor(isEnabled ? '#2ecc71' : '#95a5a6')
            .setTitle(`${isEnabled ? '🟢' : '🔴'} ${botName}`)
            .setDescription(`**${isEnabled ? 'Online' : 'Offline'}**\n\`${prefix}lydia on\` / \`${prefix}lydia off\``);
        if (respondFn) await respondFn({ embeds: [embed] });
        return;
    }

    if (action === 'on') {
        if (client.lydiaChannels[channelId]) { if (respondFn) await respondFn({ content: `${botName} already active.`, flags: 64 }); return; }
        client.lydiaChannels[channelId] = true;
        try { client.db?.prepare('INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at) VALUES (?, ?, 1, strftime("%s", "now"))').run(channelId, 'default'); } catch (e) {}
        const channelName = channel.name || 'this channel';
const embed = new EmbedBuilder()
    .setColor('#2ecc71')
    .setTitle(`✅ ${botName} ONLINE`)
    .setDescription(`Active in **#${channelName}**!\n\n• @${botName}\n• "${botName} [question]"\n• Send images`);
        if (respondFn) await respondFn({ embeds: [embed] });
        return;
    }

    if (action === 'off') {
        if (!client.lydiaChannels[channelId]) { if (respondFn) await respondFn({ content: `${botName} not active here.`, flags: 64 }); return; }
        delete client.lydiaChannels[channelId];
        try { client.db?.prepare('UPDATE lydia_agents SET is_active = 0 WHERE channel_id = ?').run(channelId); } catch (e) {}
        const embed = new EmbedBuilder().setColor('#e74c3c').setTitle(`❌ ${botName} OFFLINE`).setDescription(`Deactivated. Reactivate: \`${prefix}lydia on\``);
        if (respondFn) await respondFn({ embeds: [embed] });
        return;
    }
}

// ================= SETUP =================
function setupLydia(client, database) {
    if (!client || !database || isLydiaInitialized) return;
    isLydiaInitialized = true;

    try {
        database.prepare('CREATE TABLE IF NOT EXISTS lydia_memory (user_id TEXT, memory_key TEXT, memory_value TEXT, updated_at INTEGER, PRIMARY KEY (user_id, memory_key))').run();
        database.prepare('CREATE TABLE IF NOT EXISTS lydia_conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT, guild_id TEXT, user_id TEXT, user_name TEXT, role TEXT, content TEXT, timestamp INTEGER)').run();
        database.prepare('CREATE TABLE IF NOT EXISTS lydia_agents (channel_id TEXT PRIMARY KEY, agent_key TEXT, is_active INTEGER DEFAULT 0, updated_at INTEGER)').run();
        database.prepare('CREATE TABLE IF NOT EXISTS lydia_introductions (user_id TEXT, channel_id TEXT, introduced_at INTEGER, PRIMARY KEY (user_id, channel_id))').run();
        database.prepare('CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, user_id TEXT, channel_id TEXT, message TEXT, execute_at INTEGER, status TEXT DEFAULT "pending")').run();

        // Migrate guild_id if missing
        try {
            const cols = database.prepare('PRAGMA table_info(lydia_conversations)').all().map(c => c.name);
            if (!cols.includes('guild_id')) database.prepare('ALTER TABLE lydia_conversations ADD COLUMN guild_id TEXT').run();
        } catch (e) {}

        // Restore active channels
        const active = database.prepare('SELECT channel_id FROM lydia_agents WHERE is_active = 1').all();
        for (const ch of active) client.lydiaChannels[ch.channel_id] = true;

        rehydrateReminders(client, database);
        setInterval(() => pruneOldConversations(database), 86400000);

        console.log(`${green}[LYDIA]${reset} ${active.length} channels restored, ready`);
    } catch (err) {
        console.error(`${red}[LYDIA INIT]${reset} ${err.message}`);
        isLydiaInitialized = false;
        return;
    }

    client.on('messageCreate', async (message) => {
        if (!message || message.author?.bot) return;
        await handleLydiaMessage(message, client, database);
    });
}

// ================= COMMANDS =================
async function runLydiaCommand(client, message, args, database, serverSettings, usedCommand) {
    if (!message.guild) return;
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setDescription('❌ Admin required')] }).catch(() => {});
    }
    const sub = args[0]?.toLowerCase() || 'status';
    if (!['on', 'off', 'status'].includes(sub)) return;
    await handleLydiaToggle(client, message.channel.id, message.guild.id, message.author.id, sub, async (payload) => message.reply(payload));
}

const slashCommand = new SlashCommandBuilder()
    .setName('lydia').setDescription('🧠 Manage Lydia AI')
    .addSubcommand(s => s.setName('on').setDescription('🟢 Activate Lydia AI'))
    .addSubcommand(s => s.setName('off').setDescription('🔴 Deactivate Lydia AI'))
    .addSubcommand(s => s.setName('status').setDescription('📊 Show Lydia status'));

async function executeSlashCommand(interaction, client) {
    if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: 64 });
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setDescription('❌ Admin required')], flags: 64 });
    }
    const sub = interaction.options.getSubcommand();
    await handleLydiaToggle(client, interaction.channelId, interaction.guildId, interaction.user.id, sub, async (payload) => {
        if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
        return interaction.reply(payload);
    });
}

// ================= EXPORTS =================
module.exports = {
    name: 'lydia',
    aliases: ['ai', 'neural'],
    description: '🧠 Fast AI assistant — CODM expert, bilingual, remembers facts',
    category: 'SYSTEM',
    cooldown: 5000,
    run: runLydiaCommand,
    execute: executeSlashCommand,
    data: slashCommand,
    setupLydia,
    webSearch,
    generateAIResponse
};
