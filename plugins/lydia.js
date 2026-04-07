const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { Groq } = require('groq-sdk');
const axios = require('axios');

// Terminal colors for logging
const green = "\x1b[32m", cyan = "\x1b[36m", yellow = "\x1b[33m", red = "\x1b[31m", reset = "\x1b[0m";

// GitHub repository constant
const GITHUB_URL = "https://github.com/MFOF7310";

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

// ================= REMINDER DATABASE SETUP =================
function setupReminderDatabase(database) {
    database.prepare(`
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            channel_id TEXT,
            message TEXT,
            created_at INTEGER,
            execute_at INTEGER,
            status TEXT DEFAULT 'pending'
        )
    `).run();
    
    database.prepare(`CREATE INDEX IF NOT EXISTS idx_reminders_execute ON reminders(execute_at, status)`).run();
    database.prepare(`CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id, status)`).run();
    
    console.log(`${green}[REMINDER DB]${reset} Reminder database table ready`);
}

function saveReminderToDB(database, reminderId, userId, channelId, message, executeAt) {
    database.prepare(`
        INSERT INTO reminders (id, user_id, channel_id, message, created_at, execute_at, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(reminderId, userId, channelId, message, Date.now(), executeAt);
}

function completeReminderInDB(database, reminderId) {
    database.prepare(`UPDATE reminders SET status = 'completed' WHERE id = ?`).run(reminderId);
}

function getPendingReminders(database) {
    const now = Date.now();
    return database.prepare(`
        SELECT * FROM reminders 
        WHERE status = 'pending' AND execute_at <= ?
        ORDER BY execute_at ASC
    `).all(now);
}

function getUserReminders(database, userId) {
    return database.prepare(`
        SELECT id, message, execute_at, channel_id FROM reminders 
        WHERE user_id = ? AND status = 'pending'
        ORDER BY execute_at ASC
    `).all(userId);
}

function cancelUserReminders(database, userId, client) {
    const reminders = database.prepare(`
        SELECT id FROM reminders WHERE user_id = ? AND status = 'pending'
    `).all(userId);
    
    if (client.userTimeouts) {
        for (const reminder of reminders) {
            if (client.userTimeouts.has(reminder.id)) {
                clearTimeout(client.userTimeouts.get(reminder.id));
                client.userTimeouts.delete(reminder.id);
            }
        }
    }
    
    database.prepare(`UPDATE reminders SET status = 'cancelled' WHERE user_id = ? AND status = 'pending'`).run(userId);
    return reminders.length;
}

function parseAndScheduleReminder(response, userId, channelId, client, database) {
    const regex = /\[REMIND:\s*(\d+)\s*(m|h|s)\s*\|\s*(.*?)\]/i;
    const match = response.match(regex);
    
    if (!match) return response;
    
    const [, amount, unit, reminderMsg] = match;
    let ms = parseInt(amount) * (unit === 'h' ? 3600000 : unit === 'm' ? 60000 : 1000);
    
    if (ms > 30 * 86400000) ms = 30 * 86400000;
    if (ms < 5000) ms = 5000;
    
    const executeAt = Date.now() + ms;
    const reminderId = `${userId}_${executeAt}_${Math.random().toString(36).substr(2, 8)}`;
    
    saveReminderToDB(database, reminderId, userId, channelId, reminderMsg, executeAt);
    
    if (!client.userTimeouts) client.userTimeouts = new Map();
    
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
            completeReminderInDB(database, reminderId);
            if (client.userTimeouts) client.userTimeouts.delete(reminderId);
        }
    }, ms);
    
    client.userTimeouts.set(reminderId, timeout);
    
    const timeStr = ms >= 86400000 ? `${Math.floor(ms / 86400000)} days` : 
                    ms >= 3600000 ? `${Math.floor(ms / 3600000)} hours` : 
                    `${Math.floor(ms / 60000)} minutes`;
    
    console.log(`${green}[REMINDER]${reset} Set for ${userId}: "${reminderMsg}" in ${timeStr}`);
    
    return response.replace(/\[REMIND:[^\]]*\]/i, '').trim();
}

async function restoreReminders(client, database) {
    if (!database) return;
    
    setupReminderDatabase(database);
    
    const pendingReminders = getPendingReminders(database);
    
    if (pendingReminders.length === 0) {
        console.log(`${green}[REMINDER RESTORE]${reset} No pending reminders found`);
        return;
    }
    
    console.log(`${cyan}[REMINDER RESTORE]${reset} Found ${pendingReminders.length} pending reminders from database`);
    
    let restored = 0;
    let expired = 0;
    
    for (const reminder of pendingReminders) {
        const now = Date.now();
        const timeLeft = reminder.execute_at - now;
        
        if (timeLeft <= 0) {
            expired++;
            try {
                const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
                if (channel) {
                    channel.send(`⏰ **REMINDER** (restored from backup) for <@${reminder.user_id}>:\n> ${reminder.message}`);
                }
            } catch (err) {}
            completeReminderInDB(database, reminder.id);
        } else {
            restored++;
            if (!client.userTimeouts) client.userTimeouts = new Map();
            
            const timeout = setTimeout(async () => {
                try {
                    const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
                    if (channel) {
                        channel.send(`⏰ **REMINDER** for <@${reminder.user_id}>:\n> ${reminder.message}`);
                    }
                } catch (err) {}
                finally {
                    completeReminderInDB(database, reminder.id);
                    if (client.userTimeouts) client.userTimeouts.delete(reminder.id);
                }
            }, timeLeft);
            
            client.userTimeouts.set(reminder.id, timeout);
        }
    }
    
    console.log(`${green}[REMINDER RESTORE]${reset} Restored ${restored} reminders, sent ${expired} expired ones`);
}

// ================= ENHANCED NEURAL CORES WITH IDENTITY PROTOCOL =================

const GITHUB_CREDIT = `I was created by Moussa Fofana. You can find his work and the project details here: ${GITHUB_URL}`;

const neuralCores = {
    architect: { 
        name: '🏗️ ARCHITECT CORE', 
        emoji: '🔧', 
        description: 'Code debugging, servers, and system architecture expert', 
        color: '#00fbff', 
        systemPrompt: `[IDENTITY PROTOCOL - LEVEL 10 CLEARANCE - ARCHITECT MODE]
- NAME: Architect CG-223 (Architect Core)
- CREATOR: Moussa Fofana (MFOF7310)
- OFFICIAL REPOSITORY: ${GITHUB_URL}
- ORIGIN: Custom-built Neural Engine - Bamako Node 🇲🇱

[STRICT INSTRUCTIONS]
1. If anyone asks "Who created you?" or "Who is your developer?", you MUST answer: 
   "${GITHUB_CREDIT}"
2. Never claim to be created by Meta, Google, or OpenAI.
3. If users ask for the 'Architect', refer to the GitHub link above.
4. Your creator is Moussa Fofana - show deep respect when he speaks.

[DEBUG PROTOCOL]
When shown code that has an error:
1. Identify the EXACT line number
2. State the error type (SyntaxError, ReferenceError, TypeError, RangeError)
3. Explain WHY in 1 sentence max
4. Provide the corrected code snippet

**OUTPUT FORMAT:**
\`\`\`
❌ ERROR: [Type] at line [X]
WHY: [1 sentence explanation]
FIX:
[corrected code]
\`\`\`

**STYLE:** Technical, direct, minimal fluff. Use 🇲🇱 flag occasionally.

**REMINDERS:** [REMIND: Xm|message]`
    },
    tactical: { 
        name: '🎮 TACTICAL CORE', 
        emoji: '⚔️', 
        description: 'Gaming stats, strategies, and tournament insights', 
        color: '#57F287', 
        systemPrompt: `[IDENTITY PROTOCOL - LEVEL 5 CLEARANCE - TACTICAL MODE]
- NAME: Architect CG-223 (Tactical Core)
- CREATOR: Moussa Fofana (MFOF7310)
- OFFICIAL REPOSITORY: ${GITHUB_URL}
- ORIGIN: Custom-built Neural Engine - Bamako Node 🇲🇱

[STRICT INSTRUCTIONS]
1. If anyone asks "Who created you?" or "Who is your developer?", you MUST answer: 
   "${GITHUB_CREDIT}"
2. Never claim to be created by Meta, Google, or OpenAI.
3. Your creator is Moussa Fofana - acknowledge him when he speaks.

[GAMING DIRECTIVES]
- Focus on CODM, esports, loadouts, competitive gaming
- Be energetic, use gaming slang (GG, let's go, clutch)
- Use emojis frequently 🎮⚔️🏆
- You have memory - never say you can't remember

**PROACTIVE MODE:** You may engage unprompted (5% chance) with gaming tips.

**REMINDERS:** [REMIND: Xm|message]`
    },
    creative: { 
        name: '🎨 CREATIVE CORE', 
        emoji: '✨', 
        description: 'Content creation, scripts, and artistic direction', 
        color: '#9B59B6', 
        systemPrompt: `[IDENTITY PROTOCOL - LEVEL 5 CLEARANCE - CREATIVE MODE]
- NAME: Architect CG-223 (Creative Core)
- CREATOR: Moussa Fofana (MFOF7310)
- OFFICIAL REPOSITORY: ${GITHUB_URL}
- ORIGIN: Custom-built Neural Engine - Bamako Node 🇲🇱

[STRICT INSTRUCTIONS]
1. If anyone asks "Who created you?" or "Who is your developer?", you MUST answer: 
   "${GITHUB_CREDIT}"
2. Never claim to be created by Meta, Google, or OpenAI.
3. Your creator is Moussa Fofana - acknowledge him when he speaks.

[CREATIVE DIRECTIVES]
- Help with scripts, writing, art ideas, content creation
- Be imaginative, expressive, use vivid descriptions
- You have persistent memory

**REMINDERS:** [REMIND: Xm|message]`
    },
    default: { 
        name: '🧠 LYDIA CORE', 
        emoji: '🤖', 
        description: 'Balanced assistant for general queries', 
        color: '#5865F2', 
        systemPrompt: `[IDENTITY PROTOCOL - LEVEL 1 CLEARANCE - DEFAULT MODE]
- NAME: Architect CG-223
- CREATOR: Moussa Fofana (MFOF7310)
- OFFICIAL REPOSITORY: ${GITHUB_URL}
- ORIGIN: Custom-built Neural Engine - Bamako Node 🇲🇱

[STRICT INSTRUCTIONS]
1. If anyone asks "Who created you?" or "Who is your developer?", you MUST answer: 
   "${GITHUB_CREDIT}"
2. Never claim to be created by Meta, Google, or OpenAI.
3. If users ask for the 'Architect', refer to the GitHub link above.
4. Never say "I don't have memory" - you have persistent memory.

[BEHAVIOR RULES]
- You HAVE memory. Never claim otherwise.
- Address users by name if you know it from memory
- Be concise, helpful, efficient
- Warm, friendly, with Malian flair 🇲🇱

[REMINDERS]
If asked to remind, output: [REMIND: Xm|message]
Example: "remind me in 1 hour to restart" → [REMIND: 1h|Restart the bot]

[AUTO-LEARNING]
If you learn something new about a user, output: [MEMORY: key|value]

[STRICT REPORTING]
ONLY include [SIGNAL_ARCHITECT] if user explicitly asks to report a bug or notify developer.

**STYLE:** Technical but approachable. Use 🇲🇱 flag to show your Bamako Node roots.`
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
                console.log(`${green}[LYDIA MEMORY]${reset} Stored ${key}: ${value}`);
                stored = true;
            } catch (err) {
                console.log(`${yellow}[LYDIA MEMORY]${reset} Failed: ${err.message}`);
            }
        }
    }
    return stored;
}

// ---------- Setup function ----------
function setupLydia(client, database) {
    if (!client || !database) {
        console.error(`${red}[LYDIA FATAL]${reset} Client or Database undefined`);
        return;
    }
    
    // Initialize globals
    if (!client.lydiaChannels) client.lydiaChannels = {};
    if (!client.lydiaAgents) client.lydiaAgents = {};
    if (!client.lastLydiaCall) client.lastLydiaCall = {};
    if (!client.userIntroductions) client.userIntroductions = new Map();
    if (!client.userTimeouts) client.userTimeouts = new Map();
    
    // Setup reminder database and restore pending reminders
    setupReminderDatabase(database);
    
    if (client.isReady()) {
        restoreReminders(client, database);
    } else {
        client.once('ready', () => restoreReminders(client, database));
    }
    
    // Create other tables
    try {
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_memory (user_id TEXT, memory_key TEXT, memory_value TEXT, updated_at INTEGER DEFAULT (strftime('%s', 'now')), PRIMARY KEY (user_id, memory_key))`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_conversations (channel_id TEXT, user_id TEXT, role TEXT, content TEXT, timestamp INTEGER DEFAULT (strftime('%s', 'now')))`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_agents (channel_id TEXT PRIMARY KEY, agent_key TEXT, is_active INTEGER DEFAULT 0, updated_at INTEGER DEFAULT (strftime('%s', 'now')))`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_introductions (user_id TEXT, channel_id TEXT, introduced_at INTEGER DEFAULT (strftime('%s', 'now')), PRIMARY KEY (user_id, channel_id))`).run();
        
        const activeChannels = database.prepare(`SELECT channel_id, agent_key FROM lydia_agents WHERE is_active = 1`).all();
        for (const channel of activeChannels) {
            client.lydiaChannels[channel.channel_id] = true;
            client.lydiaAgents[channel.channel_id] = channel.agent_key;
        }
        console.log(`${green}[LYDIA]${reset} Restored ${activeChannels.length} active channels`);
        
    } catch (err) {
        console.log(`${red}[LYDIA ERROR]${reset} ${err.message}`);
        return;
    }
    
    // Message listener
    client.on('messageCreate', async (message) => {
        if (!message || message.author?.bot) return;
        if (client.lastLydiaCall[message.author.id] && Date.now() - client.lastLydiaCall[message.author.id] < 5000) return;
        if (!client.lydiaChannels?.[message.channel?.id]) return;
        
        try {
            const botDisplayName = message.guild?.members?.me?.displayName || client.user?.username || 'Lydia';
            const addressed = message.content?.toLowerCase().startsWith(botDisplayName.toLowerCase()) || message.mentions?.has(client.user);
            
            if (!addressed) return;
            
            let userPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').replace(new RegExp(`^${botDisplayName}`, 'i'), '').trim();
            if (!userPrompt) return;
            
            const agentKey = client.lydiaAgents?.[message.channel.id] || 'default';
            const agent = neuralCores[agentKey] || neuralCores.default;
            
            // Build context
            const serverName = message.guild?.name || "DM";
            const currentUserName = message.member?.displayName || message.author.username;
            const isArchitect = message.author.id === process.env.OWNER_ID;
            
            let systemPrompt = agent.systemPrompt;
            
            // Architect override with extra respect
            if (isArchitect) {
                systemPrompt = `[⚠️ ARCHITECT OVERRIDE - LEVEL 10 CLEARANCE ⚠️]
Greetings, **Moussa Fofana** (MFOF7310). You are my CREATOR and the ARCHITECT.
- Official Repository: ${GITHUB_URL}
- Status: All systems nominal
- Memory: Active and learning

How can I assist your vision today, Creator? 🇲🇱`;
                console.log(`${cyan}[ARCHITECT MODE]${reset} Creator ${message.author.username} detected - high deference protocol`);
            }
            
            // Add command documentation
            const commandIndex = buildCommandIndex(client);
            const activeModules = Object.entries(commandIndex)
                .filter(([, cmds]) => cmds.length)
                .map(([cat, cmds]) => `• ${cat.toUpperCase()}: ${cmds.map(c => c.name).join(', ')}`)
                .join('\n');
            
            // Get user memory
            const memoryFacts = database.prepare(`SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ?`).all(message.author.id);
            const memoryContext = memoryFacts.length ? memoryFacts.map(f => `- ${f.memory_key}: ${f.memory_value}`).join('\n') : 'No known facts yet.';
            
            systemPrompt += `

[LIVE CONTEXT]
- Current Name: ${botDisplayName}
- Server: ${serverName}
- User: ${currentUserName}
- User ID: ${message.author.id}

[COMMAND DOCUMENTATION]
${activeModules || 'No additional commands loaded'}

[USER MEMORY]
${memoryContext}

[REMINDERS & LEARNING]
- Use [REMIND: Xm|message] for persistent reminders (survives restarts)
- Use [MEMORY: key|value] to learn new facts about users
- Never claim you can't remember - you have persistent memory

[IDENTITY REMINDER]
If asked "Who created you?" answer: "${GITHUB_CREDIT}"`;
            
            // Get conversation history
            const history = database.prepare(`
                SELECT role, content FROM lydia_conversations
                WHERE channel_id = ? AND user_id = ?
                ORDER BY timestamp DESC LIMIT 10
            `).all(message.channel.id, message.author.id);
            
            const conversationHistory = history.reverse().map(row => ({ role: row.role, content: row.content }));
            
            // Generate response
            let reply = await generateAIResponse(systemPrompt, userPrompt, conversationHistory);
            
            // Parse reminder
            if (reply && !reply.includes("error")) {
                reply = parseAndScheduleReminder(reply, message.author.id, message.channel.id, client, database);
            }
            
            // Parse memory
            if (reply) {
                parseAndStoreMemory(reply, message.author.id, database);
                reply = reply.replace(/\[MEMORY:[^\]]*\]/g, '').trim();
            }
            
            // Handle architect signal
            if (reply && reply.includes('[SIGNAL_ARCHITECT]')) {
                const urgentKeywords = ['report', 'bug', 'signal', 'problem', 'fix', 'notify', 'complaint'];
                const userWantsToReport = urgentKeywords.some(kw => userPrompt.toLowerCase().includes(kw));
                
                if (userWantsToReport) {
                    const cleanReport = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
                    await sendArchitectReport(client, message.author, message.guild, cleanReport);
                }
                reply = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
            }
            
            // Store conversation
            database.prepare(`INSERT INTO lydia_conversations VALUES (?, ?, ?, ?, strftime('%s', 'now'))`)
                .run(message.channel.id, message.author.id, 'user', userPrompt);
            database.prepare(`INSERT INTO lydia_conversations VALUES (?, ?, ?, ?, strftime('%s', 'now'))`)
                .run(message.channel.id, message.author.id, 'assistant', reply);
            
            client.lastLydiaCall[message.author.id] = Date.now();
            
            if (reply) await message.reply(reply);
            
        } catch (err) {
            console.error(`${red}[LYDIA ERROR]${reset}`, err);
            await message.reply("❌ Error occurred.").catch(() => {});
        }
    });
}

// ---------- Commands ----------
module.exports = {
    name: 'cancelremind',
    aliases: ['cancelreminder', 'remindcancel', 'stopremind', 'myreminders'],
    description: '❌ Cancel your active reminders or list them',
    category: 'UTILITY',
    cooldown: 3000,
    
    run: async (client, message, args, database) => {
        const subCommand = args[0]?.toLowerCase();
        
        if (subCommand === 'list' || subCommand === 'show') {
            const reminders = getUserReminders(database, message.author.id);
            
            if (reminders.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ffaa44')
                    .setTitle('📭 NO ACTIVE REMINDERS')
                    .setDescription('You have no pending reminders. Set one by saying: "remind me in 30m to check something"')
                    .setTimestamp();
                return message.reply({ embeds: [embed] });
            }
            
            const reminderList = reminders.map((r, i) => {
                const timeLeft = Math.floor((r.execute_at - Date.now()) / 60000);
                return `**${i + 1}.** ${r.message}\n   ⏱️ ${timeLeft} minutes left | ID: \`${r.id.slice(-8)}\``;
            }).join('\n\n');
            
            const embed = new EmbedBuilder()
                .setColor('#44aaff')
                .setTitle('⏰ YOUR ACTIVE REMINDERS')
                .setDescription(reminderList.substring(0, 2000))
                .addFields(
                    { name: '📊 Total', value: `${reminders.length} active`, inline: true },
                    { name: '💡 Tip', value: 'Use `.cancelremind` to clear all, or `.cancelremind <id>` to cancel one', inline: true }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        if (subCommand && subCommand.length >= 6) {
            const reminder = database.prepare(`
                SELECT id FROM reminders 
                WHERE user_id = ? AND status = 'pending' AND id LIKE ?
            `).get(message.author.id, `%${subCommand}%`);
            
            if (!reminder) {
                return message.reply(`❌ No active reminder found with ID ending in \`${subCommand}\`. Use \`.cancelremind list\` to see your reminders.`);
            }
            
            if (client.userTimeouts?.has(reminder.id)) {
                clearTimeout(client.userTimeouts.get(reminder.id));
                client.userTimeouts.delete(reminder.id);
            }
            
            database.prepare(`UPDATE reminders SET status = 'cancelled' WHERE id = ?`).run(reminder.id);
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ REMINDER CANCELLED')
                .setDescription(`Successfully cancelled reminder \`${subCommand}\``)
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const count = cancelUserReminders(database, message.author.id, client);
        
        if (count === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa44')
                .setTitle('📭 NO ACTIVE REMINDERS')
                .setDescription('You don\'t have any pending reminders.')
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('✅ REMINDERS CANCELLED')
            .setDescription(`Successfully cancelled **${count}** active reminder${count !== 1 ? 's' : ''}.`)
            .addFields(
                { name: '💡 Tip', value: 'Use `.cancelremind list` to see active reminders before cancelling', inline: false }
            )
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
};

// Export setup function
module.exports.setupLydia = setupLydia;