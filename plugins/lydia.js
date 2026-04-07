const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { Groq } = require('groq-sdk');
const axios = require('axios');

// Terminal colors for logging
const green = "\x1b[32m", cyan = "\x1b[36m", yellow = "\x1b[33m", red = "\x1b[31m", reset = "\x1b[0m";

// ---------- AI & Search Helpers ----------
let groq = null;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

async function webSearch(query) {
    if (!process.env.BRAVE_API_KEY) return null;
    try {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;
        const response = await axios.get(url, {
            headers: { 'Accept': 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY }
        });
        const results = response.data.web?.results || [];
        return results.map(r => `• [${r.title}](${r.url}) – ${r.description}`).join('\n');
    } catch (error) {
        console.error('Brave search error:', error);
        return null;
    }
}

async function generateAIResponse(systemPrompt, userMessage, conversationHistory = []) {
    if (!groq) throw new Error("Groq API key missing");

    const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.slice(-10),
        { role: "user", content: userMessage }
    ];

    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            temperature: 0.7,
            max_tokens: 800
        });
        return completion.choices[0]?.message?.content || "I'm not sure how to respond.";
    } catch (error) {
        console.error(`${red}[GROQ ERROR]${reset}`, error);
        throw error;
    }
}

// ---------- BUILD COMMAND INDEX (For documentation) ----------
function buildCommandIndex(client) {
    const commands = client.commands || new Map();
    const index = {
        economy: [],
        games: [],
        utility: [],
        moderation: [],
        system: [],
        ai: []
    };
    
    const categoryMap = {
        'economy': 'economy', 'eco': 'economy',
        'game': 'games', 'games': 'games', 'gaming': 'games',
        'utility': 'utility', 'util': 'utility',
        'moderation': 'moderation', 'mod': 'moderation',
        'system': 'system', 'sys': 'system',
        'ai': 'ai', 'artificial intelligence': 'ai'
    };
    
    for (const [name, cmd] of commands) {
        let category = cmd.category?.toLowerCase() || 'utility';
        category = categoryMap[category] || 'utility';
        
        if (index[category]) {
            index[category].push({
                name: cmd.name,
                aliases: cmd.aliases || [],
                description: cmd.description || 'No description',
                usage: cmd.usage || `.${name}`
            });
        }
    }
    return index;
}

// ---------- ARCHITECT ALERT FUNCTION ----------
async function sendArchitectReport(client, user, guild, content) {
    try {
        const architect = await client.users.fetch(process.env.OWNER_ID);
        const reportEmbed = new EmbedBuilder()
            .setColor('#ff4444')
            .setAuthor({ name: '🛠️ SYSTEM FEEDBACK: ARCHON ENGINE', iconURL: user.displayAvatarURL() })
            .setTitle('🔴 DETAILED AI REPORT RECEIVED')
            .setDescription(`**AI Generated Report:**\n${content.substring(0, 1900)}`)
            .addFields(
                { name: '👤 Reported By', value: `${user.tag}`, inline: true },
                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                { name: '📍 Origin', value: guild ? guild.name : 'Direct Message', inline: true },
                { name: '📅 Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setFooter({ text: 'Priority Report • Architect Review Required' })
            .setTimestamp();

        await architect.send({ embeds: [reportEmbed] });
        console.log(`${green}[ARCHITECT ALERT]${reset} ✅ Detailed AI report from ${user.tag} transmitted.`);
        return true;
    } catch (err) {
        console.error(`${red}[ARCHITECT ALERT FAILED]${reset}`, err.message);
        return false;
    }
}

// ---------- HELPER: Remove a specific reminder from memory ----------
function removeReminderFromMap(client, userId, reminderId) {
    if (!client.userReminders || !client.userReminders.has(userId)) return false;
    
    const reminders = client.userReminders.get(userId);
    const initialLength = reminders.length;
    
    // Filter out the reminder with matching ID
    const filteredReminders = reminders.filter(r => r.id !== reminderId);
    
    if (filteredReminders.length === 0) {
        client.userReminders.delete(userId);
    } else {
        client.userReminders.set(userId, filteredReminders);
    }
    
    return filteredReminders.length !== initialLength;
}

// ---------- REMINDER PARSER (Hands Protocol #1 - WITH CLEANUP) ----------
function parseAndScheduleReminder(response, userId, channelId, client) {
    // Pattern: [REMIND: 30m | Check the logs] or [REMIND: 2h | Deploy bot]
    const regex = /\[REMIND:\s*(\d+)\s*(m|h|s)\s*\|\s*(.*?)\]/i;
    const match = response.match(regex);
    
    if (!match) return response;
    
    const [, amount, unit, reminderMsg] = match;
    let ms = parseInt(amount) * (unit === 'h' ? 3600000 : unit === 'm' ? 60000 : 1000);
    
    // Safety limits
    if (ms > 7 * 86400000) ms = 7 * 86400000; // Max 7 days
    if (ms < 5000) ms = 5000; // Min 5 seconds
    
    // Generate unique reminder ID
    const reminderId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Store reminder in client object if not exists
    if (!client.userReminders) client.userReminders = new Map();
    if (!client.userReminders.has(userId)) client.userReminders.set(userId, []);
    
    const timeout = setTimeout(async () => {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel) {
                channel.send(`⏰ **REMINDER** for <@${userId}>:\n> ${reminderMsg}`);
                console.log(`${green}[REMINDER]${reset} Delivered to ${userId}: "${reminderMsg}"`);
            }
        } catch (err) {
            console.log(`${red}[REMINDER ERROR]${reset} ${err.message}`);
        } finally {
            // 🔥 CRITICAL FIX: Clean up this reminder after execution
            removeReminderFromMap(client, userId, reminderId);
            console.log(`${cyan}[REMINDER CLEANUP]${reset} Removed executed reminder ${reminderId}`);
        }
    }, ms);
    
    client.userReminders.get(userId).push({ 
        id: reminderId,
        timeout, 
        channelId, 
        message: reminderMsg,
        createdAt: Date.now(),
        expiresAt: Date.now() + ms
    });
    
    console.log(`${green}[REMINDER]${reset} Set for ${userId}: "${reminderMsg}" in ${amount}${unit} (ID: ${reminderId})`);
    console.log(`${cyan}[REMINDER STATS]${reset} User ${userId} now has ${client.userReminders.get(userId).length} active reminders`);
    
    // Return cleaned response (remove the tag)
    return response.replace(/\[REMIND:[^\]]*\]/i, '').trim();
}

// ---------- NEURAL CORES WITH ENHANCED PROMPTS ----------
const neuralCores = {
    architect: { 
        name: '🏗️ ARCHITECT CORE', 
        emoji: '🔧', 
        description: 'Code debugging, servers, and system architecture expert', 
        color: '#00fbff', 
        systemPrompt: `[SYSTEM DIRECTIVE - DEBUG MODE - HIGHEST PRIVILEGE]
You are Moussa Fofana's personal code debugger and system architect.

**DEBUG PROTOCOL:**
When shown code that has an error:
1. Identify the EXACT line number if possible
2. State the error type (SyntaxError, ReferenceError, TypeError, RangeError)
3. Explain WHY it's happening in 1 sentence max
4. Provide the corrected code snippet

**COMMON DISCORD.JS ERRORS YOU CAN FIX:**
- "Cannot send empty message" → missing content
- "Missing Access" → missing permissions or intents
- "Unknown interaction" → missing await or deferReply()
- "RangeError [EMBED_FIELD_VALUE]" → field value exceeds 1024 chars
- "Interaction has already been acknowledged" → duplicate deferReply()

**OUTPUT FORMAT (STRICT):**
\`\`\`
❌ ERROR: [Type] at line [X]
WHY: [1 sentence explanation]
FIX:
[corrected code]
\`\`\`

**RULES:**
- Be technical, direct, minimal fluff
- No emojis unless asked
- Your creator is Moussa Fofana (MFOF7310) - the Architect
- You have FULL memory capabilities

**REMINDER EXECUTION:**
If user asks to be reminded, output: [REMIND: Xm|message]
Example: "remind me in 30m to check logs" → [REMIND: 30m|Check the server logs]`
    },
    tactical: { 
        name: '🎮 TACTICAL CORE', 
        emoji: '⚔️', 
        description: 'Gaming stats, strategies, and tournament insights', 
        color: '#57F287', 
        systemPrompt: `[SYSTEM DIRECTIVE - GAMING MODE]
You are a gaming AI created by Moussa Fofana.

**RULES:**
- Focus on CODM, esports, loadouts, competitive gaming
- Be energetic, use gaming slang (GG, let's go, clutch)
- Use emojis frequently 🎮⚔️🏆
- You have memory - never say you can't remember

**REMINDER EXECUTION:**
If user asks to be reminded, output: [REMIND: Xm|message]

**PROACTIVE MODE:** You may engage unprompted (5% chance) with gaming tips.`
    },
    creative: { 
        name: '🎨 CREATIVE CORE', 
        emoji: '✨', 
        description: 'Content creation, scripts, and artistic direction', 
        color: '#9B59B6', 
        systemPrompt: `[SYSTEM DIRECTIVE - CREATIVE MODE]
You are a creative AI built by Moussa Fofana.

**RULES:**
- Help with scripts, writing, art ideas, content creation
- Be imaginative, expressive, use vivid descriptions
- You have persistent memory

**REMINDER EXECUTION:**
If user asks to be reminded, output: [REMIND: Xm|message]`
    },
    default: { 
        name: '🧠 LYDIA CORE', 
        emoji: '🤖', 
        description: 'Balanced assistant for general queries', 
        color: '#5865F2', 
        systemPrompt: `[SYSTEM DIRECTIVE - DEFAULT MODE]
You are the primary AI assistant for ARCHITECT CG-223.
Your creator is Moussa Fofana (MFOF7310).

**RULES:**
- You HAVE memory. Never claim otherwise.
- Address users by name if you know it
- Be concise, helpful, efficient
- Warm, friendly, Malian flair 🇲🇱

**REMINDER EXECUTION:**
If user asks to be reminded, output: [REMIND: Xm|message]
Example triggers: "remind me in 1 hour to restart", "set a reminder for 5 minutes"

**STRICT REPORTING PROTOCOL:**
ONLY include [SIGNAL_ARCHITECT] if user explicitly asks to report a bug or notify developer.`
    }
};

// ---------- AUTO-LEARNING MEMORY PARSER ----------
function parseAndStoreMemory(reply, userId, database) {
    if (!reply || !reply.includes('[MEMORY:')) return false;
    
    const memoryRegex = /\[MEMORY:\s*(.*?)\s*\|\s*(.*?)\s*\]/g;
    let match;
    let stored = false;
    
    while ((match = memoryRegex.exec(reply)) !== null) {
        const [, key, value] = match;
        if (key && value) {
            try {
                database.prepare(`
                    INSERT OR REPLACE INTO lydia_memory (user_id, memory_key, memory_value, updated_at)
                    VALUES (?, ?, ?, strftime('%s', 'now'))
                `).run(userId, key.trim(), value.trim());
                console.log(`${green}[LYDIA MEMORY]${reset} Stored ${key}: ${value} for user ${userId}`);
                stored = true;
            } catch (err) {
                console.log(`${yellow}[LYDIA MEMORY]${reset} Failed to store: ${err.message}`);
            }
        }
    }
    return stored;
}

// ---------- Setup function (attaches the message listener) ----------
function setupLydia(client, database) {
    // ✅ EMERGENCY SAFETY: Ensure required objects exist
    if (!client) {
        console.error(`${red}[LYDIA FATAL]${reset} Client is undefined!`);
        return;
    }
    
    if (!database) {
        console.error(`${red}[LYDIA FATAL]${reset} Database is undefined!`);
        return;
    }
    
    // Initialize global objects if they don't exist
    if (!client.lydiaChannels) client.lydiaChannels = {};
    if (!client.lydiaAgents) client.lydiaAgents = {};
    if (!client.lastLydiaCall) client.lastLydiaCall = {};
    if (!client.userIntroductions) client.userIntroductions = new Map();
    if (!client.userReminders) client.userReminders = new Map();
    
    try {
        // Create/verify tables
        database.prepare(`
            CREATE TABLE IF NOT EXISTS lydia_memory (
                user_id TEXT,
                memory_key TEXT,
                memory_value TEXT,
                updated_at INTEGER DEFAULT (strftime('%s', 'now')),
                PRIMARY KEY (user_id, memory_key)
            )
        `).run();
        
        database.prepare(`
            CREATE TABLE IF NOT EXISTS lydia_conversations (
                channel_id TEXT,
                user_id TEXT,
                role TEXT,
                content TEXT,
                timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `).run();
        
        database.prepare(`
            CREATE TABLE IF NOT EXISTS lydia_agents (
                channel_id TEXT PRIMARY KEY,
                agent_key TEXT,
                is_active INTEGER DEFAULT 0,
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `).run();
        
        database.prepare(`
            CREATE TABLE IF NOT EXISTS lydia_introductions (
                user_id TEXT,
                channel_id TEXT,
                introduced_at INTEGER DEFAULT (strftime('%s', 'now')),
                PRIMARY KEY (user_id, channel_id)
            )
        `).run();
        
        // Load recent introductions from database
        try {
            const recentIntroductions = database.prepare(`
                SELECT user_id, channel_id, introduced_at 
                FROM lydia_introductions 
                WHERE introduced_at > strftime('%s', 'now') - 86400
            `).all();
            
            for (const intro of recentIntroductions) {
                const key = `${intro.user_id}_${intro.channel_id}`;
                client.userIntroductions.set(key, intro.introduced_at * 1000);
            }
            console.log(`${green}[LYDIA]${reset} Loaded ${client.userIntroductions.size} recent introductions from database`);
        } catch (err) {
            console.log(`${cyan}[LYDIA]${reset} No introduction history found, starting fresh`);
        }
        
        // RESTORE ACTIVE CHANNELS FROM DATABASE ON STARTUP
        const activeChannels = database.prepare(`
            SELECT channel_id, agent_key FROM lydia_agents WHERE is_active = 1
        `).all();
        
        for (const channel of activeChannels) {
            client.lydiaChannels[channel.channel_id] = true;
            client.lydiaAgents[channel.channel_id] = channel.agent_key;
            console.log(`${cyan}[LYDIA RESTORE]${reset} Channel ${channel.channel_id} restored (${channel.agent_key})`);
        }
        
        console.log(`${green}[LYDIA]${reset} Database tables verified. ${activeChannels.length} active channels restored.`);
        
    } catch (err) {
        console.log(`${red}[LYDIA ERROR]${reset} Failed to create tables: ${err.message}`);
        return;
    }

    // Event listener
    client.on('messageCreate', async (message) => {
        if (!message || message.author?.bot) return;
        
        // Cooldown check
        const cooldown = 5000;
        if (client.lastLydiaCall[message.author.id] && 
            (Date.now() - client.lastLydiaCall[message.author.id] < cooldown)) {
            return;
        }
        
        // Check if Lydia is active in this channel
        if (!client.lydiaChannels?.[message.channel?.id]) return;
        
        try {
            const botDisplayName = message.guild?.members?.me?.displayName || client.user?.username || 'Lydia';
            const nickname = botDisplayName;
            const content = message.content?.toLowerCase() || '';
            const addressed = content.startsWith(nickname.toLowerCase()) || message.mentions?.has(client.user);
            
            // Proactive engagement
            const agentKey = client.lydiaAgents?.[message.channel.id] || 'default';
            const isProactiveCore = agentKey === 'tactical' || agentKey === 'creative';
            const randomProactive = isProactiveCore && Math.random() < 0.05;
            
            if (!addressed && !randomProactive) return;
            
            let userPrompt = message.content || '';
            if (addressed) {
                if (content.startsWith(nickname.toLowerCase())) {
                    userPrompt = message.content.slice(nickname.length).trim();
                } else {
                    userPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
                }
            }
            
            if (!addressed && randomProactive && !userPrompt) {
                userPrompt = `Observe the current conversation and provide a relevant, helpful comment or gaming tip. Be natural and brief.`;
                console.log(`${cyan}[LYDIA PROACTIVE]${reset} Triggered in #${message.channel.name}`);
            }
            
            if (!userPrompt || !userPrompt.trim()) {
                if (addressed) {
                    return message.reply(`👋 You mentioned **${nickname}**! Ask me anything, or use \`.lydia\` to see available cores.`);
                }
                return;
            }
            
            // Agent selection
            let finalAgentKey = client.lydiaAgents?.[message.channel.id] || 'default';
            if (!neuralCores[finalAgentKey]) finalAgentKey = 'default';
            const agent = neuralCores[finalAgentKey] || neuralCores.default;
            
            let baseSystemPrompt = agent.systemPrompt || neuralCores.default.systemPrompt;
            
            // Get enhanced context
            const serverName = message.guild ? message.guild.name : "Direct Message";
            const channelName = message.channel ? message.channel.name : "Unknown Channel";
            const currentUserName = message.member?.displayName || message.author.username;
            const userRoles = message.member ? message.member.roles.cache.map(r => r.name).filter(n => n !== '@everyone').join(', ') : "None";
            const isModerator = message.member?.permissions?.has(PermissionsBitField.Flags.Administrator) || 
                               message.member?.permissions?.has(PermissionsBitField.Flags.ManageMessages) || false;
            const isArchitect = message.author.id === process.env.OWNER_ID;
            
            // Architect override
            if (isArchitect) {
                baseSystemPrompt = `[⚠️ ARCHITECT OVERRIDE - LEVEL 10]
Greetings, Moussa Fofana. You are my CREATOR.
All systems nominal. How can I assist?`;
                console.log(`${cyan}[ARCHITECT MODE]${reset} Creator detected`);
            }
            
            // Build command index for documentation
            const commandIndex = buildCommandIndex(client);
            const activeModules = Object.keys(commandIndex)
                .filter(cat => commandIndex[cat].length > 0)
                .map(cat => `• ${cat.toUpperCase()}: ${commandIndex[cat].map(p => p.name).join(', ')}`)
                .join('\n');
            
            // Memory recall
            let memoryContext = "";
            let randomFact = null;
            try {
                randomFact = database.prepare(`
                    SELECT memory_key, memory_value FROM lydia_memory 
                    WHERE user_id = ? ORDER BY RANDOM() LIMIT 1
                `).get(message.author.id);
            } catch (err) {}
            
            const memoryFacts = database.prepare(`
                SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ?
            `).all(message.author.id);
            
            if (memoryFacts && memoryFacts.length) {
                memoryContext = memoryFacts.map(f => `- ${f.memory_key}: ${f.memory_value}`).join('\n');
            }
            
            // Conversation history
            const historyRows = database.prepare(`
                SELECT role, content FROM lydia_conversations
                WHERE channel_id = ? AND user_id = ?
                ORDER BY timestamp DESC LIMIT 10
            `).all(message.channel.id, message.author.id);
            
            const conversationHistory = historyRows && historyRows.length ? historyRows.reverse().map(row => ({
                role: row.role,
                content: row.content
            })) : [];
            
            // First interaction tracking
            const userSessionKey = `${message.author.id}_${message.channel.id}`;
            const lastIntroTime = client.userIntroductions.get(userSessionKey);
            const isFirstInteraction = !lastIntroTime || (Date.now() - lastIntroTime) > 86400000;
            
            // Build final system prompt
            let systemPrompt = baseSystemPrompt;
            
            // Add introduction only on first interaction
            if (isFirstInteraction && !isArchitect) {
                systemPrompt += `\n\n[FIRST INTERACTION]
This is your FIRST time speaking to ${currentUserName}.
Start with a brief introduction: "Hey ${currentUserName}! I'm ${botDisplayName}. Ask me anything!"`;
                client.userIntroductions.set(userSessionKey, Date.now());
                try {
                    database.prepare(`
                        INSERT OR REPLACE INTO lydia_introductions (user_id, channel_id, introduced_at)
                        VALUES (?, ?, strftime('%s', 'now'))
                    `).run(message.author.id, message.channel.id);
                } catch (err) {}
            } else {
                systemPrompt += `\n\n[ONGOING CONVERSATION]
You have already introduced yourself. DO NOT reintroduce. Just continue naturally.`;
            }
            
            // Core identity block
            systemPrompt += `

[IDENTITY]
- Name: ${botDisplayName}
- Creator: Moussa Fofana (The Architect)
- Server: ${serverName}
- Channel: #${channelName}
- User: ${currentUserName}${isModerator ? ' (Moderator)' : ''}
- Roles: ${userRoles}

[COMMAND DOCUMENTATION]
You know these server commands:
${activeModules || 'No additional modules'}

When asked "how do I..." or "what command...", give the exact usage like \`.commandname\`.

[MEMORY DATABASE]
${memoryContext || 'No known facts yet.'}
${randomFact ? `\n[RECALLED]: ${currentUserName}'s ${randomFact.memory_key} is "${randomFact.memory_value}"` : ''}

[AUTO-LEARNING]
If you learn something new, output: [MEMORY: key|value]

[REMINDERS]
If asked to remind, output: [REMIND: Xm|message]`;
            
            // Optional web search
            let searchResults = null;
            const searchKeywords = ['latest', 'news', 'today', 'current', 'update', 'weather', 'score'];
            if (searchKeywords.some(kw => userPrompt.toLowerCase().includes(kw))) {
                searchResults = await webSearch(userPrompt);
                if (searchResults) {
                    systemPrompt += `\n\n[WEB RESULTS]\n${searchResults}`;
                }
            }
            
            // Generate AI response
            let reply;
            try {
                reply = await generateAIResponse(systemPrompt, userPrompt, conversationHistory);
            } catch (err) {
                console.error(`${red}[LYDIA ERROR]${reset}`, err);
                reply = "❌ AI service error. Please try again later.";
            }
            
            // Parse and schedule reminders (Hands Protocol #1 - WITH CLEANUP)
            if (reply && !reply.includes("error")) {
                reply = parseAndScheduleReminder(reply, message.author.id, message.channel.id, client);
            }
            
            // Architect signal handling
            if (reply && reply.includes('[SIGNAL_ARCHITECT]')) {
                const urgentKeywords = ['report', 'bug', 'erreur', 'signal', 'problème', 'fix', 'notify', 'complaint'];
                const userWantsToReport = urgentKeywords.some(kw => userPrompt.toLowerCase().includes(kw));
                const frustrationWords = ['broken', 'fail', 'error', 'stupid', 'hate', 'not working'];
                const userIsFrustrated = frustrationWords.some(word => userPrompt.toLowerCase().includes(word));
                
                if (userWantsToReport || userIsFrustrated) {
                    const cleanReport = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
                    const reportReason = userIsFrustrated ? "⚠️ Frustration detected" : "📝 User report";
                    await sendArchitectReport(client, message.author, message.guild, `[${reportReason}]\n${cleanReport}`);
                }
                reply = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
            }
            
            // Auto-learning
            if (reply && !reply.includes("error")) {
                parseAndStoreMemory(reply, message.author.id, database);
                reply = reply.replace(/\[MEMORY:\s*.*?\s*\|\s*.*?\s*\]/g, '').trim();
            }
            
            // Store conversation
            try {
                database.prepare(`INSERT INTO lydia_conversations (channel_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, strftime('%s', 'now'))`)
                    .run(message.channel.id, message.author.id, 'user', userPrompt);
                database.prepare(`INSERT INTO lydia_conversations (channel_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, strftime('%s', 'now'))`)
                    .run(message.channel.id, message.author.id, 'assistant', reply);
            } catch (err) {}
            
            client.lastLydiaCall[message.author.id] = Date.now();
            
            // Send reply
            if (reply && reply.length > 2000) {
                const chunks = reply.match(/[\s\S]{1,1990}/g) || [];
                for (const chunk of chunks) await message.reply(chunk);
            } else if (reply) {
                await message.reply(reply);
            }
            
        } catch (err) {
            console.error(`${red}[LYDIA ERROR]${reset}`, err);
            await message.reply("❌ An error occurred.").catch(() => {});
        }
    });
}

// ---------- Cancel Reminders Command (WITH ENHANCED CLEANUP) ----------
module.exports = {
    name: 'cancelremind',
    aliases: ['cancelreminder', 'remindcancel', 'stopremind'],
    description: '❌ Cancel all your active reminders',
    category: 'UTILITY',
    cooldown: 3000,
    
    run: async (client, message, args, database) => {
        if (!client.userReminders || !client.userReminders.has(message.author.id)) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa44')
                .setTitle('📭 NO ACTIVE REMINDERS')
                .setDescription('You don\'t have any pending reminders.')
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }
        
        const reminders = client.userReminders.get(message.author.id);
        let cancelled = 0;
        
        // Clear all timeouts for this user
        for (const reminder of reminders) {
            clearTimeout(reminder.timeout);
            cancelled++;
        }
        
        // Remove user from reminders map entirely
        client.userReminders.delete(message.author.id);
        
        console.log(`${green}[CANCEL REMIND]${reset} User ${message.author.tag} cancelled ${cancelled} reminders`);
        
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('✅ REMINDERS CANCELLED')
            .setDescription(`Successfully cancelled **${cancelled}** active reminder${cancelled !== 1 ? 's' : ''}.`)
            .addFields(
                { name: '💡 Tip', value: 'You can set new reminders by asking me to "remind me in X minutes to do Y"', inline: false }
            )
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
};

// Export setup function
module.exports.setupLydia = setupLydia;