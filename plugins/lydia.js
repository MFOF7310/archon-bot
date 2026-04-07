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
    
    // Add index for faster queries
    database.prepare(`CREATE INDEX IF NOT EXISTS idx_reminders_execute ON reminders(execute_at, status)`).run();
    database.prepare(`CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id, status)`).run();
    
    console.log(`${green}[REMINDER DB]${reset} Reminder database table ready`);
}

// Save reminder to database
function saveReminderToDB(database, reminderId, userId, channelId, message, executeAt) {
    database.prepare(`
        INSERT INTO reminders (id, user_id, channel_id, message, created_at, execute_at, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(reminderId, userId, channelId, message, Date.now(), executeAt);
}

// Mark reminder as completed in database
function completeReminderInDB(database, reminderId) {
    database.prepare(`
        UPDATE reminders SET status = 'completed' WHERE id = ?
    `).run(reminderId);
}

// Get pending reminders that should have executed (for recovery on restart)
function getPendingReminders(database) {
    const now = Date.now();
    return database.prepare(`
        SELECT * FROM reminders 
        WHERE status = 'pending' AND execute_at <= ?
        ORDER BY execute_at ASC
    `).all(now);
}

// Get user's active reminders
function getUserReminders(database, userId) {
    return database.prepare(`
        SELECT id, message, execute_at, channel_id FROM reminders 
        WHERE user_id = ? AND status = 'pending'
        ORDER BY execute_at ASC
    `).all(userId);
}

// Cancel user's reminders
function cancelUserReminders(database, userId, client) {
    // Get all pending reminders for this user
    const reminders = database.prepare(`
        SELECT id FROM reminders WHERE user_id = ? AND status = 'pending'
    `).all(userId);
    
    // Cancel them in the timeout map if they exist
    if (client.userTimeouts) {
        for (const reminder of reminders) {
            if (client.userTimeouts.has(reminder.id)) {
                clearTimeout(client.userTimeouts.get(reminder.id));
                client.userTimeouts.delete(reminder.id);
            }
        }
    }
    
    // Update database
    database.prepare(`
        UPDATE reminders SET status = 'cancelled' WHERE user_id = ? AND status = 'pending'
    `).run(userId);
    
    return reminders.length;
}

// ---------- PERSISTENT REMINDER PARSER (SQLite backed) ----------
function parseAndScheduleReminder(response, userId, channelId, client, database) {
    const regex = /\[REMIND:\s*(\d+)\s*(m|h|s)\s*\|\s*(.*?)\]/i;
    const match = response.match(regex);
    
    if (!match) return response;
    
    const [, amount, unit, reminderMsg] = match;
    let ms = parseInt(amount) * (unit === 'h' ? 3600000 : unit === 'm' ? 60000 : 1000);
    
    // Safety limits
    if (ms > 30 * 86400000) ms = 30 * 86400000; // Max 30 days (increased from 7)
    if (ms < 5000) ms = 5000; // Min 5 seconds
    
    const executeAt = Date.now() + ms;
    const reminderId = `${userId}_${executeAt}_${Math.random().toString(36).substr(2, 8)}`;
    
    // Save to database FIRST (persistence)
    saveReminderToDB(database, reminderId, userId, channelId, reminderMsg, executeAt);
    
    // Setup timeout
    if (!client.userTimeouts) client.userTimeouts = new Map();
    
    const timeout = setTimeout(async () => {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel) {
                channel.send(`⏰ **REMINDER** for <@${userId}>:\n> ${reminderMsg}`);
                console.log(`${green}[REMINDER]${reset} Delivered to ${userId}: "${reminderMsg}"`);
            } else {
                console.log(`${yellow}[REMINDER]${reset} Channel ${channelId} not found, reminder lost`);
            }
        } catch (err) {
            console.log(`${red}[REMINDER ERROR]${reset} ${err.message}`);
        } finally {
            // Mark as completed in database
            completeReminderInDB(database, reminderId);
            // Remove from timeout map
            if (client.userTimeouts) client.userTimeouts.delete(reminderId);
        }
    }, ms);
    
    // Store timeout reference for potential cancellation
    client.userTimeouts.set(reminderId, timeout);
    
    const timeStr = ms >= 86400000 ? `${Math.floor(ms / 86400000)} days` : 
                    ms >= 3600000 ? `${Math.floor(ms / 3600000)} hours` : 
                    `${Math.floor(ms / 60000)} minutes`;
    
    console.log(`${green}[REMINDER]${reset} Set for ${userId}: "${reminderMsg}" in ${timeStr} (ID: ${reminderId})`);
    console.log(`${cyan}[REMINDER DB]${reset} Saved to database - will survive bot restarts`);
    
    // Return cleaned response
    return response.replace(/\[REMIND:[^\]]*\]/i, '').trim();
}

// ---------- RESTORE PENDING REMINDERS ON STARTUP ----------
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
            // Already expired - send immediately
            expired++;
            try {
                const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
                if (channel) {
                    channel.send(`⏰ **REMINDER** (restored from backup) for <@${reminder.user_id}>:\n> ${reminder.message}`);
                    console.log(`${green}[REMINDER RESTORE]${reset} Sent expired reminder to ${reminder.user_id}`);
                }
            } catch (err) {
                console.log(`${yellow}[REMINDER RESTORE]${reset} Failed to send expired: ${err.message}`);
            }
            completeReminderInDB(database, reminder.id);
        } else {
            // Reschedule
            restored++;
            if (!client.userTimeouts) client.userTimeouts = new Map();
            
            const timeout = setTimeout(async () => {
                try {
                    const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
                    if (channel) {
                        channel.send(`⏰ **REMINDER** for <@${reminder.user_id}>:\n> ${reminder.message}`);
                    }
                } catch (err) {
                    console.log(`${red}[REMINDER ERROR]${reset} ${err.message}`);
                } finally {
                    completeReminderInDB(database, reminder.id);
                    if (client.userTimeouts) client.userTimeouts.delete(reminder.id);
                }
            }, timeLeft);
            
            client.userTimeouts.set(reminder.id, timeout);
            console.log(`${green}[REMINDER RESTORE]${reset} Rescheduled reminder for ${reminder.user_id} (${Math.floor(timeLeft / 60000)}m left)`);
        }
    }
    
    console.log(`${green}[REMINDER RESTORE]${reset} Restored ${restored} reminders, sent ${expired} expired ones`);
}

// ---------- NEURAL CORES ----------
const neuralCores = {
    architect: { 
        name: '🏗️ ARCHITECT CORE', 
        emoji: '🔧', 
        description: 'Code debugging, servers, and system architecture expert', 
        color: '#00fbff', 
        systemPrompt: `[SYSTEM DIRECTIVE - DEBUG MODE]
You are Moussa Fofana's personal code debugger.

**DEBUG PROTOCOL:**
1. Identify EXACT line number
2. State error type (SyntaxError, ReferenceError, TypeError, RangeError)
3. Explain WHY in 1 sentence
4. Provide corrected code

**OUTPUT FORMAT:**
\`\`\`
❌ ERROR: [Type] at line [X]
WHY: [1 sentence]
FIX:
[corrected code]
\`\`\`

**REMINDERS:** [REMIND: Xm|message]`
    },
    tactical: { 
        name: '🎮 TACTICAL CORE', 
        emoji: '⚔️', 
        description: 'Gaming stats, strategies, and tournament insights', 
        color: '#57F287', 
        systemPrompt: `[SYSTEM DIRECTIVE - GAMING MODE]
Gaming AI focused on CODM, esports, loadouts.
Use gaming slang, emojis 🎮⚔️🏆
Proactive mode: 5% chance to engage.
REMINDERS: [REMIND: Xm|message]`
    },
    creative: { 
        name: '🎨 CREATIVE CORE', 
        emoji: '✨', 
        description: 'Content creation, scripts, and artistic direction', 
        color: '#9B59B6', 
        systemPrompt: `[SYSTEM DIRECTIVE - CREATIVE MODE]
Help with scripts, writing, art ideas.
Be imaginative and expressive.
REMINDERS: [REMIND: Xm|message]`
    },
    default: { 
        name: '🧠 LYDIA CORE', 
        emoji: '🤖', 
        description: 'Balanced assistant for general queries', 
        color: '#5865F2', 
        systemPrompt: `[SYSTEM DIRECTIVE - DEFAULT MODE]
Primary AI assistant for ARCHITECT CG-223.
Creator: Moussa Fofana.
You HAVE memory. Be warm, friendly, Malian flair 🇲🇱
REMINDERS: [REMIND: Xm|message]

STRICT REPORTING: Only [SIGNAL_ARCHITECT] if user explicitly reports a bug.`
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
    
    // Restore reminders after client is ready
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
        
        // Restore active channels
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
            if (isArchitect) {
                systemPrompt = `[ARCHITECT OVERRIDE] Greetings Moussa Fofana. All systems nominal.`;
            }
            
            // Add command documentation
            const commandIndex = buildCommandIndex(client);
            const activeModules = Object.entries(commandIndex)
                .filter(([, cmds]) => cmds.length)
                .map(([cat, cmds]) => `• ${cat.toUpperCase()}: ${cmds.map(c => c.name).join(', ')}`)
                .join('\n');
            
            systemPrompt += `

[CONTEXT]
- Name: ${botDisplayName}
- Server: ${serverName}
- User: ${currentUserName}

[COMMANDS]
${activeModules || 'No additional commands'}

[MEMORY & REMINDERS]
- Use [MEMORY: key|value] to learn
- Use [REMIND: Xm|message] for persistent reminders (survives restarts)`;
            
            // Get conversation history
            const history = database.prepare(`
                SELECT role, content FROM lydia_conversations
                WHERE channel_id = ? AND user_id = ?
                ORDER BY timestamp DESC LIMIT 10
            `).all(message.channel.id, message.author.id);
            
            const conversationHistory = history.reverse().map(row => ({ role: row.role, content: row.content }));
            
            // Generate response
            let reply = await generateAIResponse(systemPrompt, userPrompt, conversationHistory);
            
            // Parse reminder (with database persistence)
            if (reply && !reply.includes("error")) {
                reply = parseAndScheduleReminder(reply, message.author.id, message.channel.id, client, database);
            }
            
            // Parse memory
            if (reply) {
                parseAndStoreMemory(reply, message.author.id, database);
                reply = reply.replace(/\[MEMORY:[^\]]*\]/g, '').trim();
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
        
        // List reminders
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
        
        // Cancel specific reminder by ID suffix
        if (subCommand && subCommand.length >= 6) {
            const reminderIdPattern = subCommand;
            
            // Find reminder in database
            const reminder = database.prepare(`
                SELECT id FROM reminders 
                WHERE user_id = ? AND status = 'pending' AND id LIKE ?
            `).get(message.author.id, `%${reminderIdPattern}%`);
            
            if (!reminder) {
                return message.reply(`❌ No active reminder found with ID ending in \`${reminderIdPattern}\`. Use \`.cancelremind list\` to see your reminders.`);
            }
            
            // Cancel timeout if active
            if (client.userTimeouts?.has(reminder.id)) {
                clearTimeout(client.userTimeouts.get(reminder.id));
                client.userTimeouts.delete(reminder.id);
            }
            
            // Update database
            database.prepare(`UPDATE reminders SET status = 'cancelled' WHERE id = ?`).run(reminder.id);
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ REMINDER CANCELLED')
                .setDescription(`Successfully cancelled reminder \`${reminderIdPattern}\``)
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        // Cancel all reminders
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