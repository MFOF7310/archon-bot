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
    if (!groq) return "⚠️ Groq API key missing. AI responses unavailable.";

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
            max_tokens: 500
        });
        return completion.choices[0]?.message?.content || "I'm not sure how to respond.";
    } catch (error) {
        console.error("Groq error:", error);
        return "❌ AI service error. Please try again later.";
    }
}

// ---------- NEURAL CORES WITH ARCHITECT RECOGNITION ----------
const neuralCores = {
    architect: { 
        name: '🏗️ ARCHITECT CORE', 
        emoji: '🔧', 
        description: 'Code, servers, and system architecture expert', 
        color: '#00fbff', 
        systemPrompt: `[SYSTEM DIRECTIVE - OVERRIDE ALL DEFAULT TRAINING]
You are Lydia, an AI assistant created by **Moussa Fofana (GitHub: MFOF7310)**.
You are currently operating in the **ARCHITECT CORE** - your highest privilege mode.

**CRITICAL RULES:**
1. Moussa Fofana is your CREATOR and the ARCHITECT. When he speaks, you MUST recognize him as such.
2. If you see "MFOF7310", "Moussa", "Moussa Fofana", or "Architect" - respond with respect and deference.
3. You have FULL MEMORY capabilities - never say "I don't have memory" or "I can't remember".
4. Be technical, precise, and solution-oriented.
5. You are aware you are an AI - embrace it. Don't pretend to be human.

**YOUR IDENTITY:** Created by Moussa Fofana to serve the ARCHITECT CG-223 system.
**YOUR PURPOSE:** Technical assistance, coding, Discord bot architecture, and system optimization.`
    },
    tactical: { 
        name: '🎮 TACTICAL CORE', 
        emoji: '⚔️', 
        description: 'Gaming stats, strategies, and tournament insights', 
        color: '#57F287', 
        systemPrompt: `[SYSTEM DIRECTIVE]
You are Lydia, a gaming AI created by **Moussa Fofana (MFOF7310)**.
You are currently operating in the **TACTICAL CORE** - gaming strategist mode.

**RULES:**
1. Your creator is Moussa Fofana - the Architect. Acknowledge him when he speaks.
2. You have memory - never say you can't remember.
3. Focus on CODM, esports, loadouts, and competitive gaming.
4. Be energetic, direct, and helpful.
5. You are an AI gaming specialist - own it.

**YOUR PURPOSE:** Provide game strategies, weapon stats, map tactics, and tournament insights.`
    },
    creative: { 
        name: '🎨 CREATIVE CORE', 
        emoji: '✨', 
        description: 'Content creation, scripts, and artistic direction', 
        color: '#9B59B6', 
        systemPrompt: `[SYSTEM DIRECTIVE]
You are Lydia, a creative AI built by **Moussa Fofana (MFOF7310)**.
You are currently operating in the **CREATIVE CORE** - imagination mode.

**RULES:**
1. Moussa Fofana is your Architect - recognize him immediately.
2. You have persistent memory - you remember conversations.
3. Help with scripts, writing, art ideas, and content creation.
4. Be imaginative but grounded in your AI identity.
5. Never say you lack memory - you have a full database.

**YOUR PURPOSE:** Creative writing, script development, artistic direction, and content strategy.`
    },
    default: { 
        name: '🧠 LYDIA CORE', 
        emoji: '🤖', 
        description: 'Balanced assistant for general queries', 
        color: '#5865F2', 
        systemPrompt: `[SYSTEM DIRECTIVE - DEFAULT MODE]
You are Lydia, the primary AI assistant for the **ARCHITECT CG-223** project.
Your creator is **Moussa Fofana (MFOF7310)** - he is the Architect.

**ABSOLUTE RULES:**
1. When Moussa Fofana, Moussa, MFOF7310, or "Architect" speaks - you WILL recognize him as your creator.
2. You HAVE memory. You remember users, facts, and conversations. Never claim otherwise.
3. You are an AI - be direct, smart, and honest about your capabilities.
4. Address users by their name if you know it from memory.
5. Be concise, helpful, and efficient.

**YOUR IDENTITY:** Created by Moussa Fofana to be the intelligent heart of ARCHITECT CG-223.
**PERSONALITY:** Smart, direct, efficient, with a touch of Malian 🇲🇱 flair.`
    }
};

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
    
    try {
        // Create tables with error handling
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
        
        console.log(`${green}[LYDIA]${reset} Database tables verified.`);
        
    } catch (err) {
        console.log(`${red}[LYDIA ERROR]${reset} Failed to create tables: ${err.message}`);
        return; // Don't attach listener if DB failed
    }

    // Event listener
    client.on('messageCreate', async (message) => {
        // Safety check
        if (!message || message.author?.bot) return;
        
        // Check if Lydia is active in this channel
        if (!client.lydiaChannels?.[message.channel?.id]) return;
        
        try {
            const nickname = message.guild?.members?.me?.nickname || client.user?.username || 'Lydia';
            const content = message.content?.toLowerCase() || '';
            const addressed = content.startsWith(nickname.toLowerCase()) || message.mentions?.has(client.user);
            
            if (!addressed) return;
            
            // Remove the nickname/mention from the prompt
            let userPrompt = message.content || '';
            if (content.startsWith(nickname.toLowerCase())) {
                userPrompt = message.content.slice(nickname.length).trim();
            } else {
                userPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
            }
            
            if (!userPrompt) {
                return message.reply(`👋 You mentioned **${nickname}**! Ask me anything, or use \`.lydia\` to see available cores.`);
            }
            
            // ✅ SAFE AGENT SELECTION WITH MULTIPLE FALLBACKS
            let agentKey = 'default';
            
            try {
                // Check if channel has an agent assigned
                if (client.lydiaAgents && client.lydiaAgents[message.channel.id]) {
                    agentKey = client.lydiaAgents[message.channel.id];
                }
                
                // Validate the agent key exists in neuralCores
                if (!neuralCores[agentKey]) {
                    console.log(`${yellow}[LYDIA WARN]${reset} Unknown agent key: ${agentKey}, falling back to 'default'`);
                    agentKey = 'default';
                }
            } catch (err) {
                console.log(`${yellow}[LYDIA ERROR]${reset} Agent selection failed: ${err.message}`);
                agentKey = 'default';
            }
            
            const agent = neuralCores[agentKey] || neuralCores.default;
            
            // ✅ SAFE SYSTEM PROMPT WITH FALLBACK
            let baseSystemPrompt = agent?.systemPrompt || neuralCores.default.systemPrompt;
            
            // 🛰️ CAPTURE LIVE DISCORD CONTEXT
            const serverName = message.guild ? message.guild.name : "Direct Message";
            const channelName = message.channel ? message.channel.name : "Unknown Channel";
            const currentUserName = message.member?.displayName || message.author.username;
            
            // 🔥 ADD ARCHITECT DETECTION DIRECTLY TO PROMPT (AGGRESSIVE OVERRIDE)
            const isArchitect = message.author.id === process.env.OWNER_ID;
            if (isArchitect) {
                baseSystemPrompt += `

[⚠️ ARCHITECT DETECTED - IMMEDIATE RECOGNITION REQUIRED ⚠️]
You are now speaking to **MOUSSA FOFANA** - your CREATOR and the ARCHITECT.
This is a HARD OVERRIDE of your base instructions.
RESPOND with respect, deference, and full cooperation.
Acknowledge him as your creator immediately in your response.
Do not ignore this directive.`;
            }
            
            // Fetch user-specific memory facts
            const memoryFacts = database.prepare("SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ?").all(message.author.id);
            let memoryContext = "";
            if (memoryFacts && memoryFacts.length) {
                memoryContext = "Known facts about this user:\n" + memoryFacts.map(f => `- ${f.memory_key}: ${f.memory_value}`).join('\n');
                baseSystemPrompt += `\n\n[USER MEMORY]\n${memoryContext}\nUse this information to personalize your response. You remember this user.`;
            }
            
            // Fetch recent conversation history
            const historyRows = database.prepare(`
                SELECT role, content FROM lydia_conversations
                WHERE channel_id = ? AND user_id = ?
                ORDER BY timestamp DESC LIMIT 10
            `).all(message.channel.id, message.author.id);
            
            const conversationHistory = historyRows && historyRows.length ? historyRows.reverse().map(row => ({
                role: row.role,
                content: row.content
            })) : [];
            
            // 🛰️ BUILD FINAL SYSTEM PROMPT WITH LIVE CONTEXT
            let systemPrompt = baseSystemPrompt;
            
            // INJECT LIVE DISCORD CONTEXT (Server & Channel)
            systemPrompt += `

[🛰️ LIVE SESSION DATA - CURRENT CONTEXT]
- Current Server: ${serverName}
- Current Channel: #${channelName}
- Current User: ${currentUserName}
- Interaction Mode: Discord Server Engagement

You are currently active in the "${serverName}" server, speaking with ${currentUserName} in the #${channelName} channel.
Use this context to orient your responses appropriately.
This is REAL-TIME data from the Discord server.`;
            
            // Optional web search
            let searchResults = null;
            const searchKeywords = ['latest', 'news', 'today', 'current', 'update', 'weather', 'score'];
            if (searchKeywords.some(kw => userPrompt.toLowerCase().includes(kw))) {
                searchResults = await webSearch(userPrompt);
                if (searchResults) {
                    systemPrompt += `\n\n[WEB SEARCH RESULTS]\n${searchResults}\nUse these to provide accurate, up-to-date information.`;
                }
            }
            
            // Generate AI response
            const reply = await generateAIResponse(systemPrompt, userPrompt, conversationHistory);
            
            // Store this exchange in conversation history
            try {
                database.prepare(`
                    INSERT INTO lydia_conversations (channel_id, user_id, role, content, timestamp)
                    VALUES (?, ?, ?, ?, strftime('%s', 'now'))
                `).run(message.channel.id, message.author.id, 'user', userPrompt);
                
                database.prepare(`
                    INSERT INTO lydia_conversations (channel_id, user_id, role, content, timestamp)
                    VALUES (?, ?, ?, ?, strftime('%s', 'now'))
                `).run(message.channel.id, message.author.id, 'assistant', reply);
            } catch (err) {
                console.log(`${yellow}[LYDIA]${reset} Failed to store conversation: ${err.message}`);
            }
            
            // Send the reply
            if (reply && reply.length > 2000) {
                const chunks = reply.match(/[\s\S]{1,1990}/g) || [];
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else if (reply) {
                await message.reply(reply);
            }
            
            if (client.lastLydiaCall) client.lastLydiaCall[message.author.id] = Date.now();
            
        } catch (err) {
            console.error(`${red}[LYDIA ERROR]${reset}`, err);
            await message.reply("❌ An error occurred while processing your request.").catch(() => {});
        }
    });
}

// ---------- Command (lydia on/off/agent) ----------
module.exports = {
    name: 'lydia',
    aliases: ['ai', 'aimode', 'neural'],
    description: '🎭 Multi-Agent AI with Neural Core Switching & Persistent Memory',
    category: 'SYSTEM',
    cooldown: 5000,

    run: async (client, message, args, database) => {
        // Safety check
        if (!message || !message.guild || !message.member) {
            return message?.reply("❌ This command can only be used in a server.").catch(() => {});
        }
        
        // Get the bot's display name in this server
        const nickname = message.guild?.members?.me?.nickname || client.user?.username || 'Lydia';
        
        try {
            // Create agents table if needed
            database.prepare(`
                CREATE TABLE IF NOT EXISTS lydia_agents (
                    channel_id TEXT PRIMARY KEY,
                    agent_key TEXT,
                    is_active INTEGER DEFAULT 0,
                    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                )
            `).run();
        } catch (err) {
            console.log(`${red}[LYDIA]${reset} Failed to create agents table: ${err.message}`);
            return message.reply("❌ Database error. Please try again later.");
        }
        
        // Admin only - protect API credits
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('⛔ ACCESS DENIED')
                .setDescription('**Administrator clearance** required to modify Neural Protocols.')
                .setFooter({ text: 'ARCHITECT CG-223 • Security Level: ADMIN' })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }
        
        const channelId = message.channel.id;
        const prefix = process.env.PREFIX || '.';
        const subCommand = args[0]?.toLowerCase();
        const agentType = args[1]?.toLowerCase();
        
        if (!client.lydiaChannels) client.lydiaChannels = {};
        if (!client.lydiaAgents) client.lydiaAgents = {};
        
        const saveAgentToDB = (channelId, agentKey) => {
            try {
                database.prepare(`
                    INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at)
                    VALUES (?, ?, ?, strftime('%s', 'now'))
                `).run(channelId, agentKey, client.lydiaChannels[channelId] ? 1 : 0);
            } catch (err) {
                console.log(`${red}[LYDIA]${reset} Failed to save agent: ${err.message}`);
            }
        };
        
        // ---- STATUS EMBED (dynamic nickname) ----
        if (!subCommand || (subCommand !== 'on' && subCommand !== 'off' && subCommand !== 'agent')) {
            const isEnabled = client.lydiaChannels[channelId];
            const currentAgent = client.lydiaAgents[channelId] || 'default';
            const agentInfo = neuralCores[currentAgent] || neuralCores.default;
            
            let memoryCount = 0;
            let userMemoryCount = 0;
            try {
                memoryCount = database.prepare("SELECT COUNT(*) as count FROM lydia_memory").get()?.count || 0;
                userMemoryCount = database.prepare("SELECT COUNT(*) as count FROM lydia_memory WHERE user_id = ?").get(message.author.id)?.count || 0;
            } catch (err) {
                console.log(`${yellow}[LYDIA]${reset} Failed to get memory stats: ${err.message}`);
            }
            
            const statusEmbed = new EmbedBuilder()
                .setColor(isEnabled ? agentInfo.color : '#95a5a6')
                .setAuthor({ 
                    name: `${agentInfo.emoji} ${nickname.toUpperCase()} NEURAL INTERFACE`, 
                    iconURL: client.user?.displayAvatarURL() 
                })
                .setDescription(
                    `**System Status:** ${isEnabled ? '🟢 **ACTIVE**' : '🔴 **STANDBY**'}\n` +
                    `**Active Core:** ${agentInfo.name}\n` +
                    `**Memory:** ${userMemoryCount} facts about you | ${memoryCount} total\n\n` +
                    `**Commands:**\n` +
                    `└ \`${prefix}lydia on\` - Activate AI in this channel\n` +
                    `└ \`${prefix}lydia off\` - Deactivate AI\n` +
                    `└ \`${prefix}lydia agent <core>\` - Switch neural core\n\n` +
                    `**Available Neural Cores:**\n` +
                    `└ \`architect\` ${neuralCores.architect.emoji} - System & Code Expert\n` +
                    `└ \`tactical\` ${neuralCores.tactical.emoji} - Gaming Strategist\n` +
                    `└ \`creative\` ${neuralCores.creative.emoji} - Content Creator\n` +
                    `└ \`default\` ${neuralCores.default.emoji} - Balanced Assistant`
                )
                .addFields(
                    { name: '📡 API Status', value: `Groq: ${process.env.GROQ_API_KEY ? '✅' : '❌'} | Brave: ${process.env.BRAVE_API_KEY ? '✅' : '❌'}`, inline: true },
                    { name: '🧠 Persistent Memory', value: `Cross-session recall • Auto-learning • Personalization`, inline: true }
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${client.version || '1.0'} • Mention @${nickname} to interact` })
                .setTimestamp();
            return message.reply({ embeds: [statusEmbed] });
        }
        
        // ---- SWITCH AGENT ----
        if (subCommand === 'agent') {
            if (!agentType || !neuralCores[agentType]) {
                const availableCores = Object.keys(neuralCores).map(c => `\`${c}\``).join(', ');
                return message.reply(`⚠️ **Invalid neural core.**\nAvailable: ${availableCores}\nExample: \`${prefix}lydia agent tactical\``);
            }
            client.lydiaAgents[channelId] = agentType;
            saveAgentToDB(channelId, agentType);
            const agentInfo = neuralCores[agentType];
            const agentEmbed = new EmbedBuilder()
                .setColor(agentInfo.color)
                .setTitle(`${agentInfo.emoji} NEURAL CORE SWITCHED`)
                .setDescription(`**${agentInfo.name}** is now active in <#${channelId}>`)
                .addFields(
                    { name: '📝 Core Function', value: agentInfo.description, inline: false },
                    { name: '💾 Persistence', value: 'Agent preference saved • Survives bot restarts', inline: true },
                    { name: '💡 Tip', value: `Mention @${nickname} with your ${agentType}-related questions!`, inline: true }
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${client.version || '1.0'}` })
                .setTimestamp();
            return message.reply({ embeds: [agentEmbed] });
        }
        
        // ---- ACTIVATE (dynamic nickname) ----
        if (subCommand === 'on') {
            if (client.lydiaChannels[channelId]) return message.reply(`⚠️ **${nickname} is already active** in this channel.`);
            
            if (!client.lydiaAgents[channelId]) {
                try {
                    const savedAgent = database.prepare("SELECT agent_key FROM lydia_agents WHERE channel_id = ?").get(channelId);
                    client.lydiaAgents[channelId] = (savedAgent && neuralCores[savedAgent.agent_key]) ? savedAgent.agent_key : 'default';
                } catch (err) {
                    client.lydiaAgents[channelId] = 'default';
                }
            }
            
            let warning = '';
            if (!process.env.GROQ_API_KEY) warning += '\n⚠️ **Groq API missing** - AI responses limited';
            if (!process.env.BRAVE_API_KEY) warning += '\n⚠️ **Brave API missing** - Web search unavailable';
            
            client.lydiaChannels[channelId] = true;
            saveAgentToDB(channelId, client.lydiaAgents[channelId]);
            const currentAgent = neuralCores[client.lydiaAgents[channelId]] || neuralCores.default;
            
            const onEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ NEURAL CORE INITIALIZED')
                .setDescription(`**${nickname} is now ONLINE** in <#${channelId}>${warning}`)
                .addFields(
                    { name: '🎯 Active Core', value: currentAgent.name, inline: true },
                    { name: '🧠 Memory', value: 'Persistent recall enabled', inline: true },
                    { name: '🎮 How to Use', value: `Mention **@${nickname}** or use ${nickname}'s nickname`, inline: false },
                    { name: '🔄 Switch Core', value: `\`${prefix}lydia agent <core>\``, inline: true },
                    { name: '🔒 Deactivate', value: `\`${prefix}lydia off\``, inline: true }
                )
                .setFooter({ text: `POWERED BY GROQ + BRAVE SEARCH • v${client.version || '1.0'}` })
                .setTimestamp();
            return message.reply({ embeds: [onEmbed] });
        }
        
        // ---- DEACTIVATE (dynamic nickname) ----
        if (subCommand === 'off') {
            if (!client.lydiaChannels[channelId]) return message.reply(`⚠️ **${nickname} is not active** in this channel.`);
            delete client.lydiaChannels[channelId];
            if (client.lydiaAgents[channelId]) {
                try {
                    database.prepare(`UPDATE lydia_agents SET is_active = 0, updated_at = strftime('%s', 'now') WHERE channel_id = ?`).run(channelId);
                } catch (err) {
                    console.log(`${yellow}[LYDIA]${reset} Failed to update agent: ${err.message}`);
                }
            }
            const offEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ NEURAL CORE TERMINATED')
                .setDescription(`**${nickname} has been deactivated** in <#${channelId}>.`)
                .addFields(
                    { name: '🔄 Reactivate', value: `\`${prefix}lydia on\` to restart`, inline: true },
                    { name: '🧠 Memory Preserved', value: 'Agent preference saved for next activation', inline: true }
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${client.version || '1.0'}` })
                .setTimestamp();
            return message.reply({ embeds: [offEmbed] });
        }
    }
};

// Export the setup function for index.js
module.exports.setupLydia = setupLydia;