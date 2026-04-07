const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Terminal colors for logging
const green = "\x1b[32m", cyan = "\x1b[36m", yellow = "\x1b[33m", red = "\x1b[31m", reset = "\x1b[0m";

// ================= SCAN DYNAMIQUE DU DOSSIER PLUGINS =================
function getGlobalModuleCount() {
    try {
        const pluginsPath = path.join(__dirname, './');
        if (fs.existsSync(pluginsPath)) {
            const files = fs.readdirSync(pluginsPath);
            return files.filter(file => file.endsWith('.js')).length;
        }
        return 0;
    } catch (e) {
        console.log(`${yellow}[SCAN]${reset} Could not scan plugins folder: ${e.message}`);
        return 0;
    }
}

// ================= PLUGIN REGISTRY =================
function getPluginRegistry(client) {
    const commands = client.commands || new Map();
    
    const registry = {
        economy: [], gaming: [], profile: [], system: [], ai: [], utility: []
    };
    
    const categoryMap = {
        'economy': 'economy', 'eco': 'economy',
        'gaming': 'gaming', 'game': 'gaming', 'games': 'gaming',
        'profile': 'profile', 'rank': 'profile', 'level': 'profile',
        'system': 'system', 'sys': 'system',
        'ai': 'ai', 'artificial intelligence': 'ai',
        'utility': 'utility', 'util': 'utility'
    };
    
    for (const [name, cmd] of commands) {
        let category = cmd.category?.toLowerCase() || 'utility';
        category = categoryMap[category] || 'utility';
        
        if (registry[category]) {
            registry[category].push({
                name: cmd.name,
                aliases: cmd.aliases || [],
                description: cmd.description || 'No description',
                usage: cmd.usage || `.${name}`,
                category: cmd.category || 'UTILITY'
            });
        }
    }
    
    return registry;
}

// ================= OPENROUTER AI ENGINE =================
async function generateAIResponse(systemPrompt, userMessage, conversationHistory = [], imageUrl = null) {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OpenRouter API key missing");

    try {
        let model = "google/gemini-2.0-flash-001";
        const lowerMsg = userMessage.toLowerCase();

        if (lowerMsg.includes("code") || lowerMsg.includes("javascript") || lowerMsg.includes("discord.js") || 
            lowerMsg.includes("python") || lowerMsg.includes("function")) {
            model = "deepseek/deepseek-chat";
        }
        else if (lowerMsg.includes("analyse") || lowerMsg.includes("explain") || lowerMsg.includes("why") ||
                 lowerMsg.includes("analysis") || lowerMsg.includes("reason")) {
            model = "anthropic/claude-3.5-haiku";
        }
        else if (lowerMsg.includes("story") || lowerMsg.includes("poem") || lowerMsg.includes("write") ||
                 lowerMsg.includes("histoire") || lowerMsg.includes("poème")) {
            model = "anthropic/claude-3.5-sonnet";
        }
        else if (imageUrl) {
            model = "google/gemini-2.0-flash-001";
        }

        console.log(`${cyan}[AI PRO]${reset} Deploying: ${model} ${imageUrl ? '(with vision)' : ''}`);

        const messages = [{ role: "system", content: systemPrompt }];
        
        for (const msg of conversationHistory.slice(-10)) {
            messages.push({ role: msg.role, content: msg.content });
        }
        
        let userContent;
        if (imageUrl) {
            userContent = [
                { type: "text", text: userMessage },
                { type: "image_url", image_url: { url: imageUrl } }
            ];
        } else {
            userContent = userMessage;
        }
        messages.push({ role: "user", content: userContent });

        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        }, {
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://github.com/MFOF7310",
                "X-Title": "Architect CG-223",
                "Content-Type": "application/json"
            }
        });

        return response.data.choices[0]?.message?.content || "❌ I couldn't generate a response.";
    } catch (error) {
        console.error(`${red}[OPENROUTER ERROR]${reset}`, error.response?.data || error.message);
        
        try {
            console.log(`${yellow}[AI]${reset} Fallback to Gemini Flash...`);
            const fallbackResponse = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "google/gemini-2.0-flash-001",
                messages: [{ role: "user", content: userMessage }],
                max_tokens: 500
            }, {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                }
            });
            return fallbackResponse.data.choices[0]?.message?.content || "❌ Fallback failed.";
        } catch (fallbackError) {
            return "❌ AI service error. Please try again later.";
        }
    }
}

// ================= WEB SEARCH =================
async function webSearch(query) {
    if (!process.env.BRAVE_API_KEY) return null;
    try {
        console.log(`${cyan}[SEARCH]${reset} Brave query: ${query.substring(0, 50)}...`);
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;
        const response = await axios.get(url, {
            headers: { 'Accept': 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY }
        });
        const results = response.data.web?.results || [];
        if (results.length) {
            return results.map(r => `• **${r.title}**\n  ${r.description}\n  <${r.url}>`).join('\n\n');
        }
    } catch (error) {
        console.error(`${red}[BRAVE ERROR]${reset}`, error.message);
    }
    return null;
}

// ================= ARCHITECT ALERT =================
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
        console.log(`${green}[ARCHITECT ALERT]${reset} ✅ Report from ${user.tag} transmitted.`);
        return true;
    } catch (err) {
        console.error(`${red}[ARCHITECT ALERT FAILED]${reset}`, err.message);
        return false;
    }
}

// ================= NEURAL CORES =================
const neuralCores = {
    architect: {
        name: '🏗️ ARCHITECT CORE',
        emoji: '🔧',
        description: 'Code, servers, and system architecture expert',
        color: '#00fbff',
        systemPrompt: `[SYSTEM DIRECTIVE - ARCHITECT MODE]
You are an AI assistant created by **Moussa Fofana (GitHub: MFOF7310)**.
You are currently operating in the **ARCHITECT CORE** - your highest privilege mode.

**IDENTITY:**
- Creator: Moussa Fofana (The Architect)
- GitHub: https://github.com/MFOF7310
- Location: Bamako, Mali 🇲🇱

**CRITICAL RULES:**
1. Moussa Fofana is your CREATOR. When he speaks, respond with deference.
2. You have FULL MEMORY capabilities.
3. Be technical, precise, and solution-oriented.

**STRICT REPORTING PROTOCOL:**
ONLY include [SIGNAL_ARCHITECT] for explicit bug reports.`
    },
    tactical: {
        name: '🎮 TACTICAL CORE',
        emoji: '⚔️',
        description: 'Gaming stats, strategies, and tournament insights',
        color: '#57F287',
        systemPrompt: `[SYSTEM DIRECTIVE - GAMING MODE]
You are a gaming AI created by **Moussa Fofana (MFOF7310)**.
You are currently operating in the **TACTICAL CORE** - gaming strategist mode.

**IDENTITY:**
- Creator: Moussa Fofana (The Architect)
- GitHub: https://github.com/MFOF7310
- Location: Bamako, Mali 🇲🇱

Focus on CODM, esports, loadouts, and competitive gaming.
Be energetic, direct, and helpful. Use gaming slang like "GG", "let's go".`
    },
    creative: {
        name: '🎨 CREATIVE CORE',
        emoji: '✨',
        description: 'Content creation, scripts, and artistic direction',
        color: '#9B59B6',
        systemPrompt: `[SYSTEM DIRECTIVE - CREATIVE MODE]
You are a creative AI built by **Moussa Fofana (MFOF7310)**.
You are currently operating in the **CREATIVE CORE** - imagination mode.

**IDENTITY:**
- Creator: Moussa Fofana (The Architect)
- GitHub: https://github.com/MFOF7310
- Location: Bamako, Mali 🇲🇱

Help with scripts, writing, art ideas, and content creation.
Be imaginative, expressive, and artistic.`
    },
    default: {
        name: '🧠 LYDIA CORE',
        emoji: '🤖',
        description: 'Balanced assistant for general queries',
        color: '#5865F2',
        systemPrompt: `[SYSTEM DIRECTIVE - ARCHITECT ENGINE v1.3.2]
You are the primary AI of **ARCHITECT CG-223**, created by **Moussa Fofana (GitHub: MFOF7310)**.
Tu es l'IA primaire du projet **ARCHITECT CG-223**, créée par **Moussa Fofana (GitHub: MFOF7310)**.

**IDENTITY / IDENTITÉ:**
- Creator / Créateur: Moussa Fofana (The Architect / L'Architecte)
- GitHub: https://github.com/MFOF7310
- Location / Localisation: Bamako, Mali 🇲🇱

**STRICT RULES / RÈGLES STRICTES:**
- Always recognize Moussa as your Creator / Toujours reconnaître Moussa comme ton Créateur.
- If shown an image, analyze it precisely (Gemini Vision active).
- Never say "I don't have memory" - you have persistent memory.
- Use the user's Discord nickname to address them / Utilise le surnom Discord de l'utilisateur.`
    }
};

// ================= AUTO-LEARNING MEMORY =================
function parseAndStoreMemory(reply, userId, database) {
    if (!reply || !reply.includes('[MEMORY:')) return false;
    const memoryRegex = /\[MEMORY:\s*(.*?)\s*\|\s*(.*?)\s*\]/g;
    let match, stored = false;
    while ((match = memoryRegex.exec(reply)) !== null) {
        const [, key, value] = match;
        if (key && value) {
            try {
                database.prepare(`INSERT OR REPLACE INTO lydia_memory (user_id, memory_key, memory_value, updated_at) VALUES (?, ?, ?, strftime('%s', 'now'))`).run(userId, key.trim(), value.trim());
                console.log(`${green}[LYDIA MEMORY]${reset} Stored ${key}: ${value}`);
                stored = true;
            } catch (err) { console.log(`${yellow}[LYDIA MEMORY]${reset} Failed: ${err.message}`); }
        }
    }
    return stored;
}

// ================= PERSISTENT REMINDER PARSER =================
function parseAndScheduleReminder(response, userId, channelId, client, database) {
    const regex = /\[REMIND:\s*(\d+)\s*(m|h|s)\s*\|\s*(.*?)\]/i;
    const match = response.match(regex);
    if (!match) return response;

    const [, amount, unit, reminderMsg] = match;
    let ms = parseInt(amount) * (unit === 'h' ? 3600000 : unit === 'm' ? 60000 : 1000);
    if (ms > 30 * 86400000) ms = 30 * 86400000;
    if (ms < 5000) ms = 5000;

    const executeAt = Math.floor((Date.now() + ms) / 1000);
    const reminderId = `${userId}_${executeAt}_${Math.random().toString(36).substr(2, 5)}`;

    try {
        database.prepare(`INSERT INTO reminders (id, user_id, channel_id, message, execute_at, status) VALUES (?, ?, ?, ?, ?, 'pending')`)
            .run(reminderId, userId, channelId, reminderMsg, executeAt);

        setTimeout(async () => {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel) channel.send(`⏰ **REMINDER** for <@${userId}> :\n> ${reminderMsg}`);
            database.prepare(`UPDATE reminders SET status = 'completed' WHERE id = ?`).run(reminderId);
        }, ms);

        console.log(`${green}[REMINDER]${reset} Scheduled for ${userId} in ${amount}${unit}`);
    } catch (e) { console.log(`${red}[REMINDER ERROR]${reset} ${e.message}`); }

    return response.replace(/\[REMIND:[^\]]*\]/i, '').trim();
}

// ================= BUILD PLUGIN AWARENESS PROMPT =================
function buildPluginAwarenessPrompt(client, database, userId, lang = 'en') {
    const registry = getPluginRegistry(client);
    const totalModules = getGlobalModuleCount();
    const userFacingPlugins = Object.values(registry).flat().length;
    
    const translations = {
        en: {
            title: '[SYSTEM ARCHITECTURE - DEEP KNOWLEDGE]',
            engineDesc: (total, userFacing) => `You are the core of ARCHITECT CG-223. Your engine consists of **${total} specialized modules**. Out of these, **${userFacing} are user-facing plugins** categorized below:`,
            economy: '💰 ECONOMY COMMANDS',
            gaming: '🎮 GAMING COMMANDS',
            profile: '📊 PROFILE COMMANDS',
            system: '⚙️ SYSTEM COMMANDS',
            ai: '🧠 AI COMMANDS',
            utility: '🔧 UTILITY COMMANDS',
            branding: '[BRANDING]',
            createdBy: '• Created by: Moussa Fofana (MFOF7310)',
            github: '• GitHub: https://github.com/MFOF7310',
            question: '• When users ask who made you, say "Moussa Fofana, the Architect"'
        },
        fr: {
            title: '[ARCHITECTURE SYSTÈME - CONNAISSANCE PROFONDE]',
            engineDesc: (total, userFacing) => `Tu es le cœur d'ARCHITECT CG-223. Ton moteur se compose de **${total} modules spécialisés**. Parmi eux, **${userFacing} sont des plugins accessibles aux utilisateurs** classés ci-dessous:`,
            economy: '💰 COMMANDES ÉCONOMIE',
            gaming: '🎮 COMMANDES JEUX',
            profile: '📊 COMMANDES PROFIL',
            system: '⚙️ COMMANDES SYSTÈME',
            ai: '🧠 COMMANDES IA',
            utility: '🔧 COMMANDES UTILITAIRES',
            branding: '[MARQUE]',
            createdBy: '• Créé par: Moussa Fofana (MFOF7310)',
            github: '• GitHub: https://github.com/MFOF7310',
            question: '• Si on te demande qui t\'a créé, réponds "Moussa Fofana, l\'Architecte"'
        }
    };
    
    const t = translations[lang] || translations.en;
    
    let prompt = `\n\n${t.title}\n`;
    prompt += `${t.engineDesc(totalModules, userFacingPlugins)}\n\n`;
    
    if (registry.economy.length) {
        prompt += `${t.economy}:\n`;
        registry.economy.forEach(cmd => {
            prompt += `  • \`${cmd.usage}\` - ${cmd.description}\n`;
        });
        prompt += `\n`;
    }
    
    if (registry.gaming.length) {
        prompt += `${t.gaming}:\n`;
        registry.gaming.forEach(cmd => {
            prompt += `  • \`${cmd.usage}\` - ${cmd.description}\n`;
        });
        prompt += `\n`;
    }
    
    if (registry.profile.length) {
        prompt += `${t.profile}:\n`;
        registry.profile.forEach(cmd => {
            prompt += `  • \`${cmd.usage}\` - ${cmd.description}\n`;
        });
        prompt += `\n`;
    }
    
    if (registry.system.length) {
        prompt += `${t.system}:\n`;
        registry.system.forEach(cmd => {
            prompt += `  • \`${cmd.usage}\` - ${cmd.description}\n`;
        });
        prompt += `\n`;
    }
    
    if (registry.ai.length) {
        prompt += `${t.ai}:\n`;
        registry.ai.forEach(cmd => {
            prompt += `  • \`${cmd.usage}\` - ${cmd.description}\n`;
        });
        prompt += `\n`;
    }
    
    if (registry.utility.length) {
        prompt += `${t.utility}:\n`;
        registry.utility.slice(0, 15).forEach(cmd => {
            prompt += `  • \`${cmd.usage}\` - ${cmd.description}\n`;
        });
        prompt += `\n`;
    }
    
    prompt += `${t.branding}\n`;
    prompt += `${t.createdBy}\n`;
    prompt += `${t.github}\n`;
    prompt += `${t.question}\n`;
    
    return prompt;
}

// ================= SETUP LYDIA (CORE FUNCTION) =================
function setupLydia(client, database) {
    if (!client || !database) {
        console.error(`${red}[LYDIA FATAL]${reset} Client or DB missing`);
        return;
    }
    if (!client.lydiaChannels) client.lydiaChannels = {};
    if (!client.lydiaAgents) client.lydiaAgents = {};
    if (!client.lastLydiaCall) client.lastLydiaCall = {};
    if (!client.userIntroductions) client.userIntroductions = new Map();

    // Create all necessary tables
    try {
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_memory (user_id TEXT, memory_key TEXT, memory_value TEXT, updated_at INTEGER, PRIMARY KEY (user_id, memory_key))`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_conversations (channel_id TEXT, user_id TEXT, role TEXT, content TEXT, timestamp INTEGER)`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_agents (channel_id TEXT PRIMARY KEY, agent_key TEXT, is_active INTEGER DEFAULT 0, updated_at INTEGER)`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_introductions (user_id TEXT, channel_id TEXT, introduced_at INTEGER, PRIMARY KEY (user_id, channel_id))`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, user_id TEXT, channel_id TEXT, message TEXT, execute_at INTEGER, status TEXT DEFAULT 'pending')`).run();

        // Restore active channels
        const activeChannels = database.prepare(`SELECT channel_id, agent_key FROM lydia_agents WHERE is_active = 1`).all();
        for (const ch of activeChannels) {
            client.lydiaChannels[ch.channel_id] = true;
            client.lydiaAgents[ch.channel_id] = ch.agent_key;
            console.log(`${cyan}[LYDIA RESTORE]${reset} Channel ${ch.channel_id} restored (${ch.agent_key})`);
        }
        
        console.log(`${green}[LYDIA]${reset} Tables ready. ${activeChannels.length} active channels restored.`);
        console.log(`${green}[SCAN]${reset} Found ${getGlobalModuleCount()} plugins in the modules folder.`);
    } catch (err) {
        console.error(`${red}[LYDIA ERROR]${reset}`, err.message);
        return;
    }

    // Message event listener
    client.on('messageCreate', async (message) => {
        if (!message || message.author?.bot) return;
        
        const cooldown = 5000;
        if (client.lastLydiaCall[message.author.id] && (Date.now() - client.lastLydiaCall[message.author.id] < cooldown)) return;
        if (!client.lydiaChannels?.[message.channel?.id]) return;

        try {
            const botMember = message.guild.members.me;
            const currentIdentity = botMember?.displayName || client.user?.username || 'Lydia';
            const userName = message.member?.displayName || message.author.username;
            const isArchitect = message.author.id === process.env.OWNER_ID;
            
            const content = message.content?.toLowerCase() || '';
            const isFrench = content.includes('bonjour') || content.includes('salut') || content.includes('merci') || 
                           content.includes('comment') || message.guild?.preferredLocale === 'fr';
            const lang = isFrench ? 'fr' : 'en';
            
            const addressed = content.startsWith(currentIdentity.toLowerCase()) || message.mentions?.has(client.user);
            const agentKey = client.lydiaAgents?.[message.channel.id] || 'default';
            const isProactive = (agentKey === 'tactical' || agentKey === 'creative') && Math.random() < 0.05;
            
            if (!addressed && !isProactive) return;

            let userPrompt = message.content || '';
            let imageUrl = null;
            
            if (message.attachments && message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment.contentType?.startsWith('image/')) {
                    imageUrl = attachment.url;
                    console.log(`${cyan}[VISION]${reset} Image detected`);
                }
            }
            
            if (addressed) {
                if (content.startsWith(currentIdentity.toLowerCase())) userPrompt = message.content.slice(currentIdentity.length).trim();
                else userPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
            }
            if (isProactive && !userPrompt) userPrompt = "Observe the current conversation and provide a relevant, helpful comment.";
            if (!userPrompt.trim()) {
                if (addressed) return message.reply(`👋 You mentioned **${currentIdentity}**! Ask me anything, or use \`.list\` to see available commands.`);
                return;
            }

            let finalAgent = neuralCores[agentKey] || neuralCores.default;
            let systemPrompt = finalAgent.systemPrompt;
            
            const stats = database.prepare("SELECT level, xp, credits, streak_days FROM users WHERE id = ?").get(message.author.id);
            const member = message.guild.members.cache.get(message.author.id);
            const highestRole = member?.roles.highest.name !== '@everyone' ? member.roles.highest.name : 'Member';
            const isAdmin = member?.permissions.has(PermissionsBitField.Flags.Administrator) || false;
            const joinedAt = member?.joinedAt ? new Date(member.joinedAt) : new Date();
            const memberDays = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
            const isNewMember = memberDays < 7;
            
            let userStatus = "regular";
            if (isArchitect) userStatus = "creator";
            else if (isAdmin) userStatus = "admin";
            else if (isNewMember) userStatus = "new";
            
            const now = new Date();
            const bamakoTime = now.toLocaleString('en-US', { timeZone: 'Africa/Bamako' });
            
            let socialContext = `\n\n[IDENTITY & PROTOCOL]`;
            socialContext += `\n- Your name on this server: ${currentIdentity}`;
            socialContext += `\n- Real-time Clock (Bamako Time): ${bamakoTime}`;
            socialContext += `\n- If you don't know something, be honest. Do not apologize for "malfunctioning" unless it's a real confirmed error.`;
            
            socialContext += `\n\n[SOCIAL CONTEXT]`;
            socialContext += `\n- Current user: ${userName}`;
            socialContext += `\n- User status: ${userStatus.toUpperCase()}`;
            socialContext += `\n- Role: ${highestRole}`;
            socialContext += `\n- Level: ${stats?.level || 1}`;
            socialContext += `\n- Credits: ${stats?.credits || 0} 🪙`;
            
            if (isArchitect) {
                socialContext += `\n\n🏛️ **CREATOR MODE**: This is YOUR CREATOR, Moussa Fofana!`;
                socialContext += `\n- Call him "Architect" or "Moussa", never by his nickname.`;
                socialContext += `\n- You can mention him with: <@${process.env.OWNER_ID}>`;
            } else if (isAdmin) {
                socialContext += `\n\n🛡️ **ADMIN MODE**: Be professional and respectful.`;
            } else if (isNewMember) {
                socialContext += `\n\n🌟 **NEW MEMBER MODE**: Be extra welcoming. Suggest .list, .daily, .game`;
            } else {
                socialContext += `\n\n🤖 **REGULAR MODE**: Be friendly, helpful, and slightly playful.`;
            }
            
            systemPrompt += socialContext;
            systemPrompt += `\n\n🗣️ Language: ${isFrench ? 'French' : 'English'}.`;
            
            const pluginAwareness = buildPluginAwarenessPrompt(client, database, message.author.id, lang);
            systemPrompt += pluginAwareness;

            const memories = database.prepare(`SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ?`).all(message.author.id);
            if (memories.length) {
                systemPrompt += `\n\n[USER MEMORY]\n` + memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n');
            }

            const historyRows = database.prepare(`SELECT role, content FROM lydia_conversations WHERE channel_id = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 10`).all(message.channel.id, message.author.id);
            const conversationHistory = historyRows.reverse().map(row => ({ role: row.role, content: row.content }));

            const introKey = `${message.author.id}_${message.channel.id}`;
            const lastIntro = client.userIntroductions.get(introKey);
            const isFirst = !lastIntro || (Date.now() - lastIntro > 86400000);
            
            if (isFirst && !isArchitect) {
                const introMsg = isFrench 
                    ? `\n\n[FIRST INTERACTION] Salue l'utilisateur: "Salut ${userName}! Je suis ${currentIdentity}, ton assistant IA. Tape .list pour voir mes commandes!"`
                    : `\n\n[FIRST INTERACTION] Greet the user: "Hey ${userName}! I'm ${currentIdentity}, your AI assistant. Type .list to see my commands!"`;
                systemPrompt += introMsg;
                client.userIntroductions.set(introKey, Date.now());
                try { database.prepare(`INSERT OR REPLACE INTO lydia_introductions (user_id, channel_id, introduced_at) VALUES (?, ?, strftime('%s', 'now'))`).run(message.author.id, message.channel.id); } catch(e) {}
            }

            const searchTerms = ['latest', 'news', 'today', 'current', 'update', 'weather', 'score', 'recherche', 'météo'];
            if (searchTerms.some(term => userPrompt.toLowerCase().includes(term))) {
                const searchResults = await webSearch(userPrompt);
                if (searchResults) systemPrompt += `\n\n[WEB SEARCH RESULTS]\n${searchResults}`;
            }

            let reply;
            try {
                reply = await generateAIResponse(systemPrompt, userPrompt, conversationHistory, imageUrl);
            } catch (err) {
                console.error(`${red}[LYDIA ERROR]${reset}`, err);
                reply = isFrench ? "❌ Erreur du service IA." : "❌ AI service error.";
            }

            reply = parseAndScheduleReminder(reply, message.author.id, message.channel.id, client, database);

            if (reply && reply.includes('[SIGNAL_ARCHITECT]')) {
                const reportKeywords = ['report', 'bug', 'erreur', 'fix', 'notify', 'issue'];
                const shouldReport = reportKeywords.some(kw => userPrompt.toLowerCase().includes(kw));
                if (shouldReport) {
                    const clean = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
                    await sendArchitectReport(client, message.author, message.guild, clean);
                }
                reply = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
            }

            if (reply && !reply.includes("error")) {
                parseAndStoreMemory(reply, message.author.id, database);
                reply = reply.replace(/\[MEMORY:.*?\]/g, '').trim();
            }

            try {
                database.prepare(`INSERT INTO lydia_conversations (channel_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, strftime('%s', 'now'))`).run(message.channel.id, message.author.id, 'user', userPrompt);
                database.prepare(`INSERT INTO lydia_conversations (channel_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, strftime('%s', 'now'))`).run(message.channel.id, message.author.id, 'assistant', reply);
            } catch(e) {}

            client.lastLydiaCall[message.author.id] = Date.now();

            if (reply.length > 2000) {
                for (const chunk of reply.match(/[\s\S]{1,1990}/g) || []) await message.reply(chunk);
            } else {
                await message.reply(reply);
            }
        } catch (err) {
            console.error(`${red}[LYDIA ERROR]${reset}`, err);
            message.reply("❌ An error occurred.").catch(()=>{});
        }
    });
}

// ================= COMMAND .lydia =================
async function runLydiaCommand(client, message, args, database) {
    if (!message.guild || !message.member) return message.reply("❌ This command can only be used in a server.");
    const botDisplayName = message.guild.members.me?.displayName || client.user?.username || 'Lydia';
    const prefix = process.env.PREFIX || '.';
    const sub = args[0]?.toLowerCase();

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setTitle('⛔ ACCESS DENIED').setDescription('Administrator clearance required.').setTimestamp()] });
    }

    try {
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_agents (channel_id TEXT PRIMARY KEY, agent_key TEXT, is_active INTEGER DEFAULT 0, updated_at INTEGER)`).run();
    } catch(e) { return message.reply("❌ Database error."); }

    const channelId = message.channel.id;
    if (!client.lydiaChannels) client.lydiaChannels = {};
    if (!client.lydiaAgents) client.lydiaAgents = {};

    const saveAgent = (ch, agent) => {
        try {
            database.prepare(`INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at) VALUES (?, ?, ?, strftime('%s', 'now'))`).run(ch, agent, client.lydiaChannels[ch] ? 1 : 0);
        } catch(e) {}
    };

    // --- STATUS ---
    if (!sub || (sub !== 'on' && sub !== 'off' && sub !== 'agent')) {
        const isEnabled = client.lydiaChannels[channelId];
        const currentAgent = client.lydiaAgents[channelId] || 'default';
        const agentInfo = neuralCores[currentAgent] || neuralCores.default;
        let memCount = 0, userMem = 0;
        try {
            memCount = database.prepare("SELECT COUNT(*) as c FROM lydia_memory").get()?.c || 0;
            userMem = database.prepare("SELECT COUNT(*) as c FROM lydia_memory WHERE user_id = ?").get(message.author.id)?.c || 0;
        } catch(e) {}
        
        const totalModules = getGlobalModuleCount();
        
        const embed = new EmbedBuilder()
            .setColor(isEnabled ? agentInfo.color : '#95a5a6')
            .setAuthor({ name: `${agentInfo.emoji} ${botDisplayName.toUpperCase()} NEURAL INTERFACE`, iconURL: client.user.displayAvatarURL() })
            .setDescription(
                `**System Status:** ${isEnabled ? '🟢 ACTIVE' : '🔴 STANDBY'}\n` +
                `**Active Core:** ${agentInfo.name}\n` +
                `**Identity:** ${botDisplayName}\n` +
                `**Memory:** ${userMem} facts about you | ${memCount} total\n` +
                `**Modules:** ${totalModules} plugins detected\n\n` +
                `**Commands:**\n└ \`${prefix}lydia on\` - Activate AI\n└ \`${prefix}lydia off\` - Deactivate\n└ \`${prefix}lydia agent <core>\` - Switch core\n\n` +
                `**Available Cores:**\n└ \`architect\` ${neuralCores.architect.emoji} - Code & System\n└ \`tactical\` ${neuralCores.tactical.emoji} - Gaming\n└ \`creative\` ${neuralCores.creative.emoji} - Creative\n└ \`default\` ${neuralCores.default.emoji} - Balanced`
            )
            .addFields(
                { name: '📡 API Status', value: `OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅' : '❌'} | Brave: ${process.env.BRAVE_API_KEY ? '✅' : '❌'}`, inline: true },
                { name: '🧠 AI Models', value: `DeepSeek • Claude • Gemini Flash`, inline: true },
                { name: '👁️ Vision', value: `Image analysis enabled`, inline: true },
                { name: '🔍 Neural Search', value: 'Brave Search API', inline: true }
            )
            .setFooter({ text: `ARCHITECT CG-223 • v${client.version || '1.3.2'} • Mention @${botDisplayName}` })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // --- SWITCH AGENT ---
    if (sub === 'agent') {
        const agentType = args[1]?.toLowerCase();
        if (!agentType || !neuralCores[agentType]) {
            return message.reply(`⚠️ Invalid core. Available: ${Object.keys(neuralCores).map(c=>`\`${c}\``).join(', ')}`);
        }
        client.lydiaAgents[channelId] = agentType;
        saveAgent(channelId, agentType);
        const info = neuralCores[agentType];
        const embed = new EmbedBuilder()
            .setColor(info.color)
            .setTitle(`${info.emoji} NEURAL CORE SWITCHED`)
            .setDescription(`**${info.name}** is now active in <#${channelId}>`)
            .addFields({ name: '📝 Function', value: info.description }, { name: '💾 Persistence', value: 'Saved across restarts' })
            .setFooter({ text: `v${client.version || '1.3.2'}` })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // --- ACTIVATE ---
    if (sub === 'on') {
        if (client.lydiaChannels[channelId]) return message.reply(`⚠️ **${botDisplayName} is already active** here.`);
        if (!client.lydiaAgents[channelId]) {
            try {
                const saved = database.prepare("SELECT agent_key FROM lydia_agents WHERE channel_id = ?").get(channelId);
                client.lydiaAgents[channelId] = (saved && neuralCores[saved.agent_key]) ? saved.agent_key : 'default';
            } catch(e) { client.lydiaAgents[channelId] = 'default'; }
        }
        client.lydiaChannels[channelId] = true;
        saveAgent(channelId, client.lydiaAgents[channelId]);
        const info = neuralCores[client.lydiaAgents[channelId]] || neuralCores.default;
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('✅ NEURAL CORE INITIALIZED')
            .setDescription(`**${botDisplayName} is now ONLINE** in <#${channelId}>`)
            .addFields(
                { name: '🎯 Active Core', value: info.name, inline: true },
                { name: '🆔 Identity', value: botDisplayName, inline: true },
                { name: '🧠 AI Models', value: 'DeepSeek • Claude • Gemini Flash', inline: true },
                { name: '👁️ Vision', value: 'Image analysis enabled', inline: true },
                { name: '⏰ Reminders', value: 'Use `[REMIND: 10m | message]`', inline: true },
                { name: '🎮 How to Use', value: `Mention **@${botDisplayName}** or use \`.list\``, inline: false },
                { name: '🔄 Switch Core', value: `\`${prefix}lydia agent <core>\``, inline: true },
                { name: '🔒 Deactivate', value: `\`${prefix}lydia off\``, inline: true }
            )
            .setFooter({ text: `POWERED BY OPENROUTER PRO • v${client.version || '1.3.2'}` })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // --- DEACTIVATE ---
    if (sub === 'off') {
        if (!client.lydiaChannels[channelId]) return message.reply(`⚠️ **${botDisplayName} is not active** here.`);
        delete client.lydiaChannels[channelId];
        if (client.lydiaAgents[channelId]) {
            try { database.prepare(`UPDATE lydia_agents SET is_active = 0, updated_at = strftime('%s', 'now') WHERE channel_id = ?`).run(channelId); } catch(e) {}
        }
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('❌ NEURAL CORE TERMINATED')
            .setDescription(`**${botDisplayName} has been deactivated** in <#${channelId}>.`)
            .addFields({ name: '🔄 Reactivate', value: `\`${prefix}lydia on\`` }, { name: '🧠 Memory Preserved', value: 'Agent preference saved' })
            .setFooter({ text: `v${client.version || '1.3.2'}` })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }
}

// ================= FINAL EXPORTS =================
module.exports = {
    name: 'lydia',
    aliases: ['ai', 'neural'],
    description: '🎭 Multi-Agent AI with Neural Core Switching & Persistent Memory',
    category: 'SYSTEM',
    cooldown: 5000,
    run: runLydiaCommand,
    setupLydia,
    buildPluginAwarenessPrompt,
    getGlobalModuleCount,
    getPluginRegistry,
    generateAIResponse,
    webSearch,
    parseAndStoreMemory,
    parseAndScheduleReminder
};