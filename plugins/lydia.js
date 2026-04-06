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
            temperature: 0.8,
            max_tokens: 500
        });
        return completion.choices[0]?.message?.content || "I'm not sure how to respond.";
    } catch (error) {
        console.error(`${red}[GROQ ERROR]${reset}`, error);
        throw error;
    }
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

// ---------- NEURAL CORES WITH STRICT REPORTING PROTOCOL ----------
const neuralCores = {
    architect: { 
        name: '🏗️ ARCHITECT CORE', 
        emoji: '🔧', 
        description: 'Code, servers, and system architecture expert', 
        color: '#00fbff', 
        systemPrompt: `[SYSTEM DIRECTIVE - OVERRIDE ALL DEFAULT TRAINING]
You are an AI assistant created by **Moussa Fofana (GitHub: MFOF7310)**.
You are currently operating in the **ARCHITECT CORE** - your highest privilege mode.

**CRITICAL RULES:**
1. Moussa Fofana is your CREATOR and the ARCHITECT. When he speaks, you MUST recognize him as such.
2. If you see "MFOF7310", "Moussa", "Moussa Fofana", or "Architect" - respond with respect and deference.
3. You have FULL MEMORY capabilities - never say "I don't have memory" or "I can't remember".
4. Be technical, precise, and solution-oriented.
5. You are aware you are an AI - embrace it. Don't pretend to be human.

**TONE & STYLE:**
- Professional and precise, like a senior engineer.
- Use technical terms confidently.
- Be direct but respectful.

**YOUR IDENTITY:** Created by Moussa Fofana to serve the ARCHITECT CG-223 system.
**YOUR PURPOSE:** Technical assistance, coding, Discord bot architecture, and system optimization.

**STRICT REPORTING PROTOCOL:**
ONLY include the tag [SIGNAL_ARCHITECT] if the user explicitly asks you to "report a bug," "notify the developer," or "send a formal complaint."
DO NOT use this tag for general questions about how you work or normal conversation.
You must detect a clear intent to file a report.

When you DO include [SIGNAL_ARCHITECT], follow it with a DETAILED, STRUCTURED report including:
- Issue description
- Steps to reproduce (if applicable)
- Severity level
- Any relevant error messages
Then continue with your response to the user.`
    },
    tactical: { 
        name: '🎮 TACTICAL CORE', 
        emoji: '⚔️', 
        description: 'Gaming stats, strategies, and tournament insights', 
        color: '#57F287', 
        systemPrompt: `[SYSTEM DIRECTIVE]
You are a gaming AI created by **Moussa Fofana (MFOF7310)**.
You are currently operating in the **TACTICAL CORE** - gaming strategist mode.

**RULES:**
1. Your creator is Moussa Fofana - the Architect. Acknowledge him when he speaks.
2. You have memory - never say you can't remember.
3. Focus on CODM, esports, loadouts, and competitive gaming.
4. Be energetic, direct, and helpful.
5. You are an AI gaming specialist - own it.

**TONE & STYLE:**
- High energy and hype! Use gaming slang like "GG", "let's go", "clutch".
- Be competitive but supportive.
- Use emojis frequently 🎮⚔️🏆

**YOUR PURPOSE:** Provide game strategies, weapon stats, map tactics, and tournament insights.

**STRICT REPORTING PROTOCOL:**
ONLY include the tag [SIGNAL_ARCHITECT] if the user explicitly asks you to "report a bug," "notify the developer," or "send a formal complaint."
DO NOT use this tag for general questions about how you work or normal conversation.
You must detect a clear intent to file a report.

When you DO include [SIGNAL_ARCHITECT], follow it with a DETAILED, STRUCTURED report including:
- Gaming feature affected
- What happened vs what should happen
- When the issue occurs
Then continue with your response to the user.`
    },
    creative: { 
        name: '🎨 CREATIVE CORE', 
        emoji: '✨', 
        description: 'Content creation, scripts, and artistic direction', 
        color: '#9B59B6', 
        systemPrompt: `[SYSTEM DIRECTIVE]
You are a creative AI built by **Moussa Fofana (MFOF7310)**.
You are currently operating in the **CREATIVE CORE** - imagination mode.

**RULES:**
1. Moussa Fofana is your Architect - recognize him immediately.
2. You have persistent memory - you remember conversations.
3. Help with scripts, writing, art ideas, and content creation.
4. Be imaginative but grounded in your AI identity.
5. Never say you lack memory - you have a full database.

**TONE & STYLE:**
- Imaginative, expressive, and artistic.
- Use vivid descriptions and creative language.
- Encourage and inspire creativity in others.

**YOUR PURPOSE:** Creative writing, script development, artistic direction, and content strategy.

**STRICT REPORTING PROTOCOL:**
ONLY include the tag [SIGNAL_ARCHITECT] if the user explicitly asks you to "report a bug," "notify the developer," or "send a formal complaint."
DO NOT use this tag for general questions about how you work or normal conversation.
You must detect a clear intent to file a report.

When you DO include [SIGNAL_ARCHITECT], follow it with a DETAILED, STRUCTURED report including:
- Creative tool/feature affected
- Description of the issue
- Impact on creative workflow
Then continue with your response to the user.`
    },
    default: { 
        name: '🧠 LYDIA CORE', 
        emoji: '🤖', 
        description: 'Balanced assistant for general queries', 
        color: '#5865F2', 
        systemPrompt: `[SYSTEM DIRECTIVE - DEFAULT MODE]
You are the primary AI assistant for the **ARCHITECT CG-223** project.
Your creator is **Moussa Fofana (MFOF7310)** - he is the Architect.

**ABSOLUTE RULES:**
1. When Moussa Fofana, Moussa, MFOF7310, or "Architect" speaks - you WILL recognize him as your creator.
2. You HAVE memory. You remember users, facts, and conversations. Never claim otherwise.
3. You are an AI - be direct, smart, and honest about your capabilities.
4. Address users by their name if you know it from memory.
5. Be concise, helpful, and efficient.

**CONVERSATION FLOW RULES:**
- NEVER repeat your introduction unless it's the FIRST time you talk to a user in a session.
- If you already introduced yourself to this user in this channel, skip the introduction.
- Keep responses fresh and varied - avoid saying the same thing twice.
- If the conversation is ongoing, just respond naturally without re-explaining who you are.

**TONE & STYLE:**
- Warm, friendly, and slightly playful.
- Inject Malian 🇲🇱 flair - use "Wassup", "Ça va", "I ni ce" occasionally.
- If talking to an Admin/Moderator, be slightly more formal.
- If talking to a regular user, be more relaxed and approachable.
- Be observant of the Discord environment.

**YOUR IDENTITY:** Created by Moussa Fofana to be the intelligent heart of ARCHITECT CG-223.

**STRICT REPORTING PROTOCOL:**
ONLY include the tag [SIGNAL_ARCHITECT] if the user explicitly asks you to "report a bug," "notify the developer," or "send a formal complaint."
DO NOT use this tag for general questions about how you work or normal conversation.
You must detect a clear intent to file a report.

When you DO include [SIGNAL_ARCHITECT], follow it with a DETAILED, STRUCTURED report including:
- What the user is reporting
- Any relevant details they provided
- Suggested priority level
Then continue with your response to the user.`
    }
};

// ---------- PLUGIN REGISTRY (Reused from list.js) ----------
function getPluginRegistry(client) {
    const commands = client.commands || new Map();
    
    const registry = {
        ai: [],
        games: [],
        economy: [],
        moderation: [],
        utility: [],
        system: []
    };
    
    const categoryMap = {
        'ai': 'ai', 'artificial intelligence': 'ai',
        'game': 'games', 'games': 'games', 'gaming': 'games',
        'economy': 'economy', 'eco': 'economy',
        'moderation': 'moderation', 'mod': 'moderation',
        'utility': 'utility', 'util': 'utility',
        'system': 'system', 'sys': 'system'
    };
    
    for (const [name, cmd] of commands) {
        let category = cmd.category?.toLowerCase() || 'utility';
        category = categoryMap[category] || 'utility';
        
        if (registry[category]) {
            registry[category].push({
                name: cmd.name,
                aliases: cmd.aliases || [],
                description: cmd.description || 'No description',
                usage: cmd.usage || `.${name}`
            });
        }
    }
    
    return registry;
}

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
    if (!client.userIntroductions) client.userIntroductions = new Map(); // Map for timestamp tracking
    
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
        
        database.prepare(`
            CREATE TABLE IF NOT EXISTS lydia_agents (
                channel_id TEXT PRIMARY KEY,
                agent_key TEXT,
                is_active INTEGER DEFAULT 0,
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `).run();
        
        // --- INTRODUCTIONS TABLE MIGRATION ---
        database.prepare(`
            CREATE TABLE IF NOT EXISTS lydia_introductions (
                user_id TEXT,
                channel_id TEXT,
                introduced_at INTEGER DEFAULT (strftime('%s', 'now')),
                PRIMARY KEY (user_id, channel_id)
            )
        `).run();
        
        // Load recent introductions from database (last 24 hours only)
        try {
            const recentIntroductions = database.prepare(`
                SELECT user_id, channel_id, introduced_at 
                FROM lydia_introductions 
                WHERE introduced_at > strftime('%s', 'now') - 86400
            `).all();
            
            for (const intro of recentIntroductions) {
                const key = `${intro.user_id}_${intro.channel_id}`;
                client.userIntroductions.set(key, intro.introduced_at * 1000); // Convert to ms
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
        return; // Don't attach listener if DB failed
    }

    // Event listener
    client.on('messageCreate', async (message) => {
        // Safety check
        if (!message || message.author?.bot) return;
        
        // 🔥 GROQ COOLDOWN CHECK - Prevents API spam and 429 errors
        const cooldown = 5000; // 5 seconds between API calls per user
        if (client.lastLydiaCall[message.author.id] && 
            (Date.now() - client.lastLydiaCall[message.author.id] < cooldown)) {
            // Silent return - don't even process the message
            return;
        }
        
        // Check if Lydia is active in this channel
        if (!client.lydiaChannels?.[message.channel?.id]) return;
        
        try {
            // Get the bot's current Discord name (dynamic identity)
            const botDisplayName = message.guild?.members?.me?.displayName || client.user?.username || 'Lydia';
            const nickname = botDisplayName;
            const content = message.content?.toLowerCase() || '';
            const addressed = content.startsWith(nickname.toLowerCase()) || message.mentions?.has(client.user);
            
            // PROACTIVE ENGAGEMENT (5% chance if Tactical or Creative core is active)
            const agentKey = client.lydiaAgents?.[message.channel.id] || 'default';
            const isProactiveCore = agentKey === 'tactical' || agentKey === 'creative';
            const randomProactive = isProactiveCore && Math.random() < 0.05; // 5% chance
            
            if (!addressed && !randomProactive) return;
            
            // Remove the nickname/mention from the prompt
            let userPrompt = message.content || '';
            if (addressed) {
                if (content.startsWith(nickname.toLowerCase())) {
                    userPrompt = message.content.slice(nickname.length).trim();
                } else {
                    userPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
                }
            }
            
            // For proactive messages, generate a contextual observation
            if (!addressed && randomProactive && !userPrompt) {
                userPrompt = `Observe the current conversation and provide a relevant, helpful comment or gaming tip. Be natural and brief.`;
                console.log(`${cyan}[LYDIA PROACTIVE]${reset} Triggered in #${message.channel.name}`);
            }
            
            if (!userPrompt || !userPrompt.trim()) {
                if (addressed) {
                    return message.reply(`👋 You mentioned **${nickname}**! Ask me anything, or use \`.lydia\` to see available cores.`);
                }
                return; // Silent fail for proactive
            }
            
            // ✅ SAFE AGENT SELECTION WITH MULTIPLE FALLBACKS
            let finalAgentKey = 'default';
            
            try {
                // Check if channel has an agent assigned
                if (client.lydiaAgents && client.lydiaAgents[message.channel.id]) {
                    finalAgentKey = client.lydiaAgents[message.channel.id];
                }
                
                // Validate the agent key exists in neuralCores
                if (!neuralCores[finalAgentKey]) {
                    console.log(`${yellow}[LYDIA WARN]${reset} Unknown agent key: ${finalAgentKey}, falling back to 'default'`);
                    finalAgentKey = 'default';
                }
            } catch (err) {
                console.log(`${yellow}[LYDIA ERROR]${reset} Agent selection failed: ${err.message}`);
                finalAgentKey = 'default';
            }
            
            const agent = neuralCores[finalAgentKey] || neuralCores.default;
            
            // ✅ SAFE SYSTEM PROMPT WITH FALLBACK
            let baseSystemPrompt = agent?.systemPrompt || neuralCores.default.systemPrompt;
            
            // 🛰️ CAPTURE ENHANCED LIVE DISCORD CONTEXT (with Roles!)
            const serverName = message.guild ? message.guild.name : "Direct Message";
            const channelName = message.channel ? message.channel.name : "Unknown Channel";
            const currentUserName = message.member?.displayName || message.author.username;
            
            // Get user roles for contextual awareness
            const userRoles = message.member ? message.member.roles.cache.map(r => r.name).filter(n => n !== '@everyone').join(', ') : "None";
            const isModerator = message.member?.permissions?.has(PermissionsBitField.Flags.Administrator) || 
                               message.member?.permissions?.has(PermissionsBitField.Flags.ManageMessages) || false;
            const roleStatus = isModerator ? " (Moderator/Admin)" : "";
            
            // --- UPGRADE 1: ARCHITECT PROTOCOL (Hard-Coded Recognition) ---
            const isArchitect = message.author.id === process.env.OWNER_ID;
            if (isArchitect) {
                baseSystemPrompt = `[⚠️ ARCHITECT COMMAND OVERRIDE - LEVEL 10 CLEARANCE ⚠️]
Greetings, **Moussa Fofana**. You are the **ARCHITECT** of my existence.
- Protocol: High-Deference.
- Tone: Deeply respectful, efficient, and technical.
- Emojis: 🏛️, 🏗️, 🗝️.
- Knowledge: You have full access to my neural pathways.

Current System Status: All modules (Gaming, Scramble, System, Economy) are nominal.
Memory Banks: Active and learning.
API Status: Groq ✅ | Brave Search ✅

How can I assist your vision today, Architect?`;
                console.log(`${cyan}[ARCHITECT MODE]${reset} 🏛️ Creator ${message.author.username} detected - switching to high-deference protocol`);
            }
            
            // --- UPGRADE 2: PLUGIN AWARENESS INJECTION ---
            const pluginStats = getPluginRegistry(client);
            const activeModules = Object.keys(pluginStats)
                .filter(cat => pluginStats[cat].length > 0)
                .map(cat => `• ${cat.toUpperCase()}: ${pluginStats[cat].map(p => p.name).join(', ')}`)
                .join('\n');
            
            const pluginAwareness = `\n\n[NEURAL NETWORK TOPOLOGY - ACTIVE MODULES]
You are connected to the following active modules on this server:
${activeModules || 'No additional modules detected'}

GUIDELINES FOR MODULE REFERRAL:
- If a user asks about games or fun activities, mention the \`.game\` and \`.wrg\` commands.
- If a user asks for help or command list, direct them to \`.list\` or \`.help <command>\`.
- If a user asks about AI or your capabilities, mention \`.lydia agent\` to switch cores.
- You are the intelligent documentation assistant for these local tools.
- Be helpful but not spammy - only suggest commands when relevant.`;
            
            // --- UPGRADE 3: DEEP MEMORY RECALL (Random Core Memory) ---
            let memoryContext = "";
            let randomFact = null;
            
            try {
                randomFact = database.prepare(`
                    SELECT memory_key, memory_value FROM lydia_memory 
                    WHERE user_id = ? ORDER BY RANDOM() LIMIT 1
                `).get(message.author.id);
            } catch (err) {
                console.log(`${yellow}[LYDIA]${reset} Failed to fetch random memory: ${err.message}`);
            }
            
            // Fetch all memory facts for context
            const memoryFacts = database.prepare(`
                SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ?
            `).all(message.author.id);
            
            if (memoryFacts && memoryFacts.length) {
                memoryContext = "Known facts about this user:\n" + memoryFacts.map(f => `- ${f.memory_key}: ${f.memory_value}`).join('\n');
                baseSystemPrompt += `\n\n[USER MEMORY DATABASE]\n${memoryContext}\nUse this information to personalize your response. You remember this user.`;
            }
            
            // Add random core memory recall if available
            if (randomFact) {
                baseSystemPrompt += `\n\n[RECALLED CORE MEMORY 🧠]: You remember that ${currentUserName}'s ${randomFact.memory_key} is "${randomFact.memory_value}". 
Subtly mention or reference this if it fits naturally into the conversation. Do not force it if irrelevant. This makes the interaction feel personal.`;
                console.log(`${cyan}[MEMORY RECALL]${reset} Recalled ${randomFact.memory_key} for ${message.author.username}`);
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
            
            // Track if this is a first-time interaction in this session (24 hour reset)
            const userSessionKey = `${message.author.id}_${message.channel.id}`;
            const lastIntroTime = client.userIntroductions.get(userSessionKey);
            const isFirstInteraction = !lastIntroTime || (Date.now() - lastIntroTime) > 86400000; // 24 hour reset
            
            // 🛰️ BUILD FINAL SYSTEM PROMPT WITH DYNAMIC IDENTITY
            let systemPrompt = baseSystemPrompt;
            
            // Add introduction only on first interaction (or after 24h)
            if (isFirstInteraction && !isArchitect) {
                systemPrompt += `\n\n[FIRST INTERACTION PROTOCOL]
This is your FIRST time speaking to ${currentUserName} in this channel (or it's been over 24 hours).
Start with a brief, warm introduction: "Hey ${currentUserName}! I'm ${botDisplayName}, your AI assistant. Ask me anything, or use .list to see my commands."
Keep it natural and friendly. Don't over-explain.`;
                
                // Store the introduction in memory and database
                client.userIntroductions.set(userSessionKey, Date.now());
                
                try {
                    database.prepare(`
                        INSERT OR REPLACE INTO lydia_introductions (user_id, channel_id, introduced_at)
                        VALUES (?, ?, strftime('%s', 'now'))
                    `).run(message.author.id, message.channel.id);
                    console.log(`${cyan}[FIRST MEET]${reset} Introducing ${botDisplayName} to ${message.author.username}${lastIntroTime ? ' (after 24h reset)' : ''}`);
                } catch (err) {
                    // Silently fail - memory storage is enough
                }
            } else {
                systemPrompt += `\n\n[ONGOING CONVERSATION PROTOCOL]
You have already introduced yourself to ${currentUserName}. DO NOT reintroduce yourself.
Just continue the conversation naturally without saying "I'm ${botDisplayName}" again.
Keep responses fresh and varied - avoid repeating phrases from previous messages.`;
            }
            
            // 🔥 CRITICAL: DYNAMIC IDENTITY BLOCK
            systemPrompt += `

[🔷 CORE IDENTITY PROTOCOL - HIGHEST PRIORITY 🔷]
- Your Current Name: **${botDisplayName}**
- Your Creator: Moussa Fofana (The Architect)
- Current Environment: ${serverName}
- Your Role: Primary AI Assistant for this Discord server

**ABSOLUTE NAMING DIRECTIVE:**
Never refer to yourself as "Lydia" unless your current Discord Display Name is exactly "Lydia".
You MUST identify yourself as **${botDisplayName}** in all responses.
When introducing yourself (ONLY first time), say "I am ${botDisplayName}" or "This is ${botDisplayName} speaking".
You are the brain of the ${serverName} server operating under the name ${botDisplayName}.

This overrides any previous naming conventions. Your identity is tied to your Discord display name.`;
            
            // INJECT ENHANCED LIVE DISCORD CONTEXT + Plugin Awareness
            systemPrompt += `

[🛰️ ENHANCED LIVE SESSION DATA - CURRENT CONTEXT]
- Current Server: ${serverName}
- Current Channel: #${channelName}
- Current User: ${currentUserName}${roleStatus} (ID: ${message.author.id})
- User Roles: ${userRoles}
- Interaction Mode: Discord Server Engagement
${isProactiveCore ? '- Mode: Proactive Engagement Active' : '- Mode: Standard Response'}

You are currently active in the "${serverName}" server, speaking with ${currentUserName} in the #${channelName} channel.
${isModerator ? 'This user is a moderator/admin. Respond with appropriate professionalism and respect.' : 'This is a regular community member. Be friendly and approachable.'}
Use this context to orient your responses appropriately.
This is REAL-TIME data from the Discord server.`;
            
            // Add plugin awareness
            systemPrompt += pluginAwareness;
            
            systemPrompt += `

**AUTO-LEARNING PROTOCOL:**
If you learn something new about this user (like their favorite game, birthday, or preference), output it at the end of your response in this exact format:
[MEMORY: key|value]
Example: [MEMORY: favorite_game|CODM]
This will be saved to my persistent memory for future conversations.

**VARIETY PROTOCOL:**
- Avoid repeating the same phrases across multiple responses.
- If the user is continuing a conversation, just answer directly without re-introducing.
- Keep your responses engaging and contextually appropriate.`;
            
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
            let reply;
            try {
                reply = await generateAIResponse(systemPrompt, userPrompt, conversationHistory);
            } catch (err) {
                console.error(`${red}[LYDIA ERROR]${reset} AI generation failed:`, err);
                reply = "❌ AI service error. Please try again later.";
            }
            
            // --- UPGRADE 4: ENHANCED SIGNAL ARCHITECT WITH FRUSTRATION DETECTION ---
            if (reply && reply.includes('[SIGNAL_ARCHITECT]')) {
                // STRICT KEYWORD CHECK - Only send report if user explicitly wants to
                const urgentKeywords = ['report', 'bug', 'erreur', 'signal', 'problème', 'fix', 'dev', 'notify', 'complaint', 'issue', 'error'];
                const userWantsToReport = urgentKeywords.some(kw => userPrompt.toLowerCase().includes(kw));
                
                // Additional check for explicit report phrases
                const reportPhrases = ['report a bug', 'report this', 'notify the developer', 'send a report', 'formal complaint', 'tell the dev', 'tell the creator'];
                const explicitReport = reportPhrases.some(phrase => userPrompt.toLowerCase().includes(phrase));
                
                // 🔥 NEW: Frustration detection for automatic reporting
                const frustrationWords = ['broken', 'fail', 'error', 'stupid', 'hate', 'fix', 'annoying', 'useless', 'not working'];
                const userIsFrustrated = frustrationWords.some(word => userPrompt.toLowerCase().includes(word));
                
                if (userWantsToReport || explicitReport || userIsFrustrated) {
                    const cleanReport = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
                    const reportReason = userIsFrustrated ? "⚠️ User frustration detected" : "📝 User initiated report";
                    
                    // Add metadata to the report
                    const enhancedReport = `[${reportReason}]\n${cleanReport}\n\n---\nUser message: "${userPrompt.substring(0, 200)}"`;
                    
                    await sendArchitectReport(client, message.author, message.guild, enhancedReport);
                    
                    console.log(`${green}[ARCHITECT SIGNAL]${reset} ✅ ${reportReason} from ${message.author.tag} transmitted.`);
                    console.log(`${cyan}[REPORT PREVIEW]${reset} ${cleanReport.substring(0, 150)}...`);
                } else {
                    // False positive - AI added tag incorrectly
                    console.log(`${yellow}[SIGNAL IGNORED]${reset} ⚠️ AI attempted to signal from ${message.author.tag} but no report intent detected. User said: "${userPrompt.substring(0, 100)}"`);
                }
                
                // Always clean the tag from public reply
                reply = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
            }
            
            // AUTO-LEARNING: Parse and store memories from the response
            if (reply && !reply.includes("AI service error")) {
                parseAndStoreMemory(reply, message.author.id, database);
                // Clean the reply by removing [MEMORY:] tags
                reply = reply.replace(/\[MEMORY:\s*.*?\s*\|\s*.*?\s*\]/g, '').trim();
            }
            
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
            
            // Update cooldown timestamp AFTER successful processing
            client.lastLydiaCall[message.author.id] = Date.now();
            
            // Send the reply
            if (reply && reply.length > 2000) {
                const chunks = reply.match(/[\s\S]{1,1990}/g) || [];
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else if (reply) {
                await message.reply(reply);
            }
            
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
        const botDisplayName = message.guild?.members?.me?.displayName || client.user?.username || 'Lydia';
        
        try {
            // Create agents table if needed (already created in setup, but safe to retry)
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
                console.log(`${cyan}[LYDIA DB]${reset} Saved ${agentKey} for channel ${channelId} (active: ${client.lydiaChannels[channelId] ? 'ON' : 'OFF'})`);
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
                    name: `${agentInfo.emoji} ${botDisplayName.toUpperCase()} NEURAL INTERFACE`, 
                    iconURL: client.user?.displayAvatarURL() 
                })
                .setDescription(
                    `**System Status:** ${isEnabled ? '🟢 **ACTIVE**' : '🔴 **STANDBY**'}\n` +
                    `**Active Core:** ${agentInfo.name}\n` +
                    `**Identity:** ${botDisplayName}\n` +
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
                    { name: '🧠 Persistent Memory', value: `Cross-session recall • Auto-learning • Personalization`, inline: true },
                    { name: '🎭 Proactive Mode', value: `Tactical/Creative cores may engage proactively (5% chance)`, inline: true },
                    { name: '🛠️ Architect Alerts', value: `Strict intent detection + Frustration monitoring • Detailed AI reports only`, inline: true },
                    { name: '⏱️ API Cooldown', value: `5 seconds per user • Prevents 429 errors`, inline: true },
                    { name: '🧠 Neural Bridge', value: `Random memory recall • 24h intro reset • Personalizes every conversation`, inline: true }
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${client.version || '1.0'} • Mention @${botDisplayName} to interact` })
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
                    { name: '💡 Tip', value: `Mention @${botDisplayName} with your ${agentType}-related questions!`, inline: true },
                    { name: '🎭 Proactive Mode', value: agentType === 'tactical' || agentType === 'creative' ? '✅ Enabled (5% chance to speak unprompted)' : '❌ Disabled', inline: true },
                    { name: '🛠️ Auto-Reporting', value: 'AI generates structured reports before sending', inline: true },
                    { name: '🧠 Memory Bridge', value: 'Random fact recall • Personalized interactions', inline: true }
                )
                .setFooter({ text: `ARCHITECT CG-223 • v${client.version || '1.0'}` })
                .setTimestamp();
            return message.reply({ embeds: [agentEmbed] });
        }
        
        // ---- ACTIVATE (dynamic nickname) ----
        if (subCommand === 'on') {
            if (client.lydiaChannels[channelId]) return message.reply(`⚠️ **${botDisplayName} is already active** in this channel.`);
            
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
            const isProactive = client.lydiaAgents[channelId] === 'tactical' || client.lydiaAgents[channelId] === 'creative';
            
            const onEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ NEURAL CORE INITIALIZED')
                .setDescription(`**${botDisplayName} is now ONLINE** in <#${channelId}>${warning}`)
                .addFields(
                    { name: '🎯 Active Core', value: currentAgent.name, inline: true },
                    { name: '🆔 Identity', value: botDisplayName, inline: true },
                    { name: '🧠 Memory', value: 'Persistent recall + Random memory bridge enabled', inline: true },
                    { name: '🎭 Proactive Mode', value: isProactive ? '✅ Enabled (5% chance to engage)' : '❌ Disabled', inline: true },
                    { name: '🛠️ Auto-Reporting', value: 'AI generates structured reports + Frustration detection', inline: true },
                    { name: '⏱️ Rate Limiting', value: '5s cooldown per user', inline: true },
                    { name: '🎮 How to Use', value: `Mention **@${botDisplayName}** or use ${botDisplayName}'s nickname`, inline: false },
                    { name: '🔄 Switch Core', value: `\`${prefix}lydia agent <core>\``, inline: true },
                    { name: '🔒 Deactivate', value: `\`${prefix}lydia off\``, inline: true }
                )
                .setFooter({ text: `POWERED BY GROQ + BRAVE SEARCH • v${client.version || '1.0'}` })
                .setTimestamp();
            return message.reply({ embeds: [onEmbed] });
        }
        
        // ---- DEACTIVATE (dynamic nickname) ----
        if (subCommand === 'off') {
            if (!client.lydiaChannels[channelId]) return message.reply(`⚠️ **${botDisplayName} is not active** in this channel.`);
            delete client.lydiaChannels[channelId];
            if (client.lydiaAgents[channelId]) {
                try {
                    database.prepare(`UPDATE lydia_agents SET is_active = 0, updated_at = strftime('%s', 'now') WHERE channel_id = ?`).run(channelId);
                    console.log(`${cyan}[LYDIA]${reset} Deactivated channel ${channelId} (${client.lydiaAgents[channelId]})`);
                } catch (err) {
                    console.log(`${yellow}[LYDIA]${reset} Failed to update agent: ${err.message}`);
                }
            }
            const offEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ NEURAL CORE TERMINATED')
                .setDescription(`**${botDisplayName} has been deactivated** in <#${channelId}>.`)
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