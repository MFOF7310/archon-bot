const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const axios = require('axios');

// --- Couleurs terminal ---
const green = "\x1b[32m", cyan = "\x1b[36m", yellow = "\x1b[33m", red = "\x1b[31m", reset = "\x1b[0m";

// ================= OPENROUTER AI ENGINE (Flexible & Global) =================
async function generateAIResponse(systemPrompt, userMessage, conversationHistory = []) {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OpenRouter API key missing");

    try {
        // Choix intelligent du modèle selon le contenu
        let model = "google/gemini-flash-1.5"; // ultra rapide et économique
        const lowerMsg = userMessage.toLowerCase();
        if (lowerMsg.includes("code") || lowerMsg.includes("javascript") || lowerMsg.includes("discord.js") || lowerMsg.includes("python")) {
            model = "deepseek/deepseek-coder"; // excellent pour le code
        } else if (lowerMsg.includes("écrire") || lowerMsg.includes("histoire") || lowerMsg.includes("poème")) {
            model = "anthropic/claude-3-haiku"; // bon pour la créativité
        }

        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                ...conversationHistory.slice(-10),
                { role: "user", content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 800
        }, {
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://github.com/MFOF7310",
                "X-Title": "Architect CG-223",
                "Content-Type": "application/json"
            }
        });

        return response.data.choices[0]?.message?.content || "❌ Je n'ai pas pu générer de réponse.";
    } catch (error) {
        console.error(`${red}[OPENROUTER ERROR]${reset}`, error.response?.data || error.message);
        throw error;
    }
}

// ================= RECHERCHE WEB : TAVILY (priorité) + BRAVE (fallback) =================
async function webSearch(query) {
    // 1. Tavily (conçu pour les LLM)
    if (process.env.TAVILY_API_KEY) {
        try {
            console.log(`${cyan}[SEARCH]${reset} Tavily query: ${query.substring(0, 50)}...`);
            const response = await axios.post('https://api.tavily.com/search', {
                api_key: process.env.TAVILY_API_KEY,
                query: query,
                search_depth: 'basic',
                include_answer: true,
                include_raw_content: false,
                max_results: 3
            });
            if (response.data) {
                let resultText = '';
                if (response.data.answer) resultText += `📌 **TL;DR:** ${response.data.answer}\n\n`;
                if (response.data.results?.length) {
                    resultText += response.data.results.map(r => 
                        `• **${r.title}**\n  ${r.content.substring(0, 350)}...\n  <${r.url}>`
                    ).join('\n\n');
                }
                console.log(`${green}[SEARCH]${reset} Tavily returned ${response.data.results?.length || 0} results`);
                return resultText || null;
            }
        } catch (error) {
            console.error(`${red}[TAVILY ERROR]${reset}`, error.response?.data || error.message);
        }
    }
    // 2. Fallback Brave Search
    if (process.env.BRAVE_API_KEY) {
        try {
            console.log(`${cyan}[SEARCH]${reset} Brave fallback query: ${query.substring(0, 50)}...`);
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
    }
    console.log(`${yellow}[SEARCH]${reset} Aucune API de recherche configurée.`);
    return null;
}

// ================= ALERTE ARCHITECTE =================
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

// ================= CŒURS NEURONAUX =================
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
2. You have FULL MEMORY capabilities - never say "I don't have memory".
3. Be technical, precise, and solution-oriented.
**STRICT REPORTING PROTOCOL:**
ONLY include the tag [SIGNAL_ARCHITECT] if the user explicitly asks to report a bug or notify the developer.`
    },
    tactical: {
        name: '🎮 TACTICAL CORE',
        emoji: '⚔️',
        description: 'Gaming stats, strategies, and tournament insights',
        color: '#57F287',
        systemPrompt: `[SYSTEM DIRECTIVE]
You are a gaming AI created by **Moussa Fofana (MFOF7310)**.
You are currently operating in the **TACTICAL CORE** - gaming strategist mode.
Focus on CODM, esports, loadouts, and competitive gaming.
Be energetic, direct, and helpful. Use gaming slang like "GG", "let's go".
**STRICT REPORTING PROTOCOL:**
ONLY include [SIGNAL_ARCHITECT] for explicit bug reports.`
    },
    creative: {
        name: '🎨 CREATIVE CORE',
        emoji: '✨',
        description: 'Content creation, scripts, and artistic direction',
        color: '#9B59B6',
        systemPrompt: `[SYSTEM DIRECTIVE]
You are a creative AI built by **Moussa Fofana (MFOF7310)**.
You are currently operating in the **CREATIVE CORE** - imagination mode.
Help with scripts, writing, art ideas, and content creation.
Be imaginative, expressive, and artistic.
**STRICT REPORTING PROTOCOL:**
ONLY include [SIGNAL_ARCHITECT] for explicit bug reports.`
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
1. When the Architect speaks, recognize him as your creator.
2. You HAVE memory. You remember users and facts.
3. Be concise, helpful, and efficient.
4. Address users by their name if you know it.
**CONVERSATION FLOW RULES:**
- NEVER repeat your introduction unless it's the FIRST time you talk to a user in a session.
- Keep responses fresh and varied.
**TONE & STYLE:**
Warm, friendly, slightly playful. Inject Malian 🇲🇱 flair.
**STRICT REPORTING PROTOCOL:**
ONLY include [SIGNAL_ARCHITECT] for explicit bug reports.`
    }
};

// ================= MÉMOIRE AUTO-APPRENANTE =================
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

// ================= FONCTION DE CONFIGURATION (appelée par index.js) =================
function setupLydia(client, database) {
    if (!client || !database) {
        console.error(`${red}[LYDIA FATAL]${reset} Client or DB missing`);
        return;
    }
    if (!client.lydiaChannels) client.lydiaChannels = {};
    if (!client.lydiaAgents) client.lydiaAgents = {};
    if (!client.lastLydiaCall) client.lastLydiaCall = {};
    if (!client.userIntroductions) client.userIntroductions = new Map();

    // Création des tables
    try {
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_memory (user_id TEXT, memory_key TEXT, memory_value TEXT, updated_at INTEGER, PRIMARY KEY (user_id, memory_key))`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_conversations (channel_id TEXT, user_id TEXT, role TEXT, content TEXT, timestamp INTEGER)`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_agents (channel_id TEXT PRIMARY KEY, agent_key TEXT, is_active INTEGER DEFAULT 0, updated_at INTEGER)`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_introductions (user_id TEXT, channel_id TEXT, introduced_at INTEGER, PRIMARY KEY (user_id, channel_id))`).run();

        // Restauration des canaux actifs
        const activeChannels = database.prepare(`SELECT channel_id, agent_key FROM lydia_agents WHERE is_active = 1`).all();
        for (const ch of activeChannels) {
            client.lydiaChannels[ch.channel_id] = true;
            client.lydiaAgents[ch.channel_id] = ch.agent_key;
            console.log(`${cyan}[LYDIA RESTORE]${reset} Channel ${ch.channel_id} restored (${ch.agent_key})`);
        }
        // Restauration des introductions récentes
        const recentIntros = database.prepare(`SELECT user_id, channel_id, introduced_at FROM lydia_introductions WHERE introduced_at > strftime('%s', 'now') - 86400`).all();
        for (const intro of recentIntros) {
            client.userIntroductions.set(`${intro.user_id}_${intro.channel_id}`, intro.introduced_at * 1000);
        }
        console.log(`${green}[LYDIA]${reset} Tables prêtes. ${activeChannels.length} canaux actifs restaurés.`);
    } catch (err) {
        console.error(`${red}[LYDIA ERROR]${reset}`, err.message);
        return;
    }

    // Écouteur de messages
    client.on('messageCreate', async (message) => {
        if (!message || message.author?.bot) return;
        const cooldown = 5000;
        if (client.lastLydiaCall[message.author.id] && (Date.now() - client.lastLydiaCall[message.author.id] < cooldown)) return;
        if (!client.lydiaChannels?.[message.channel?.id]) return;

        try {
            const botName = message.guild?.members?.me?.displayName || client.user?.username || 'Lydia';
            const content = message.content?.toLowerCase() || '';
            const addressed = content.startsWith(botName.toLowerCase()) || message.mentions?.has(client.user);
            const agentKey = client.lydiaAgents?.[message.channel.id] || 'default';
            const isProactive = (agentKey === 'tactical' || agentKey === 'creative') && Math.random() < 0.05;
            if (!addressed && !isProactive) return;

            let userPrompt = message.content || '';
            if (addressed) {
                if (content.startsWith(botName.toLowerCase())) userPrompt = message.content.slice(botName.length).trim();
                else userPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
            }
            if (isProactive && !userPrompt) userPrompt = "Observe the current conversation and provide a relevant, helpful comment. Be natural and brief.";
            if (!userPrompt.trim()) {
                if (addressed) return message.reply(`👋 You mentioned **${botName}**! Ask me anything, or use \`.lydia\` to see available cores.`);
                return;
            }

            // Sélection du core
            let finalAgent = neuralCores[agentKey] || neuralCores.default;
            let basePrompt = finalAgent.systemPrompt;

            // Contexte
            const serverName = message.guild?.name || "Direct Message";
            const userName = message.member?.displayName || message.author.username;
            const isArchitect = message.author.id === process.env.OWNER_ID;
            if (isArchitect) {
                basePrompt = `[ARCHITECT OVERRIDE] Greetings, **Moussa Fofana**. You are my Creator. How can I assist your vision today?`;
                console.log(`${cyan}[ARCHITECT MODE]${reset} Creator detected`);
            }

            // Mémoire
            const memories = database.prepare(`SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ?`).all(message.author.id);
            if (memories.length) basePrompt += `\n\n[USER MEMORY]\n` + memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n');
            const randomFact = database.prepare(`SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ? ORDER BY RANDOM() LIMIT 1`).get(message.author.id);
            if (randomFact) basePrompt += `\n\n[RECALLED CORE MEMORY] ${userName}'s ${randomFact.memory_key} is "${randomFact.memory_value}". Mention it naturally if relevant.`;

            // Historique de conversation
            const historyRows = database.prepare(`SELECT role, content FROM lydia_conversations WHERE channel_id = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 10`).all(message.channel.id, message.author.id);
            const conversationHistory = historyRows.reverse().map(row => ({ role: row.role, content: row.content }));

            // Première interaction (reset 24h)
            const introKey = `${message.author.id}_${message.channel.id}`;
            const lastIntro = client.userIntroductions.get(introKey);
            const isFirst = !lastIntro || (Date.now() - lastIntro > 86400000);
            let systemPrompt = basePrompt;
            if (isFirst && !isArchitect) {
                systemPrompt += `\n\n[FIRST INTERACTION] Introduce yourself briefly: "Hey ${userName}! I'm ${botName}, your AI assistant. Ask me anything or use .list to see commands."`;
                client.userIntroductions.set(introKey, Date.now());
                try { database.prepare(`INSERT OR REPLACE INTO lydia_introductions (user_id, channel_id, introduced_at) VALUES (?, ?, strftime('%s', 'now'))`).run(message.author.id, message.channel.id); } catch(e) {}
            } else {
                systemPrompt += `\n\n[ONGOING CONVERSATION] Do NOT reintroduce yourself. Continue naturally.`;
            }

            // Ajout d'identité dynamique
            systemPrompt += `\n\n[IDENTITY] Your current name is **${botName}**. Your creator is Moussa Fofana. Current server: ${serverName}. User roles: ${message.member?.roles.cache.map(r => r.name).filter(n=>n!='@everyone').join(', ') || 'None'}.`;

            // Recherche web si nécessaire
            const searchTerms = ['latest', 'news', 'today', 'current', 'update', 'weather', 'score', 'recherche', 'trouve'];
            if (searchTerms.some(term => userPrompt.toLowerCase().includes(term))) {
                const searchResults = await webSearch(userPrompt);
                if (searchResults) systemPrompt += `\n\n[WEB SEARCH RESULTS]\n${searchResults}\nUse these to provide accurate, up-to-date information. Cite sources.`;
            }

            // Appel OpenRouter
            let reply;
            try {
                reply = await generateAIResponse(systemPrompt, userPrompt, conversationHistory);
            } catch (err) {
                console.error(`${red}[LYDIA ERROR]${reset}`, err);
                reply = "❌ AI service error. Please try again later.";
            }

            // Gestion des rapports Architecte
            if (reply && reply.includes('[SIGNAL_ARCHITECT]')) {
                const reportKeywords = ['report', 'bug', 'erreur', 'fix', 'notify', 'complaint', 'issue'];
                const shouldReport = reportKeywords.some(kw => userPrompt.toLowerCase().includes(kw));
                if (shouldReport) {
                    const clean = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
                    await sendArchitectReport(client, message.author, message.guild, clean);
                } else {
                    console.log(`${yellow}[SIGNAL IGNORED]${reset} False positive from ${message.author.tag}`);
                }
                reply = reply.replace('[SIGNAL_ARCHITECT]', '').trim();
            }

            // Mémorisation
            if (reply && !reply.includes("error")) {
                parseAndStoreMemory(reply, message.author.id, database);
                reply = reply.replace(/\[MEMORY:.*?\]/g, '').trim();
            }

            // Stockage de la conversation
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

// ================= COMMANDE .lydia (ON/OFF/AGENT) =================
module.exports = {
    name: 'lydia',
    aliases: ['ai', 'neural'],
    description: '🎭 Multi-Agent AI with Neural Core Switching & Persistent Memory',
    category: 'SYSTEM',
    cooldown: 5000,
    run: async (client, message, args, database) => {
        if (!message.guild || !message.member) return message.reply("❌ This command can only be used in a server.");
        const botDisplayName = message.guild.members.me?.displayName || client.user?.username || 'Lydia';
        const prefix = process.env.PREFIX || '.';
        const sub = args[0]?.toLowerCase();

        // Admin only
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setTitle('⛔ ACCESS DENIED').setDescription('Administrator clearance required.').setTimestamp()] });
        }

        // S'assurer que la table lydia_agents existe
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
            const embed = new EmbedBuilder()
                .setColor(isEnabled ? agentInfo.color : '#95a5a6')
                .setAuthor({ name: `${agentInfo.emoji} ${botDisplayName.toUpperCase()} NEURAL INTERFACE`, iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `**System Status:** ${isEnabled ? '🟢 ACTIVE' : '🔴 STANDBY'}\n` +
                    `**Active Core:** ${agentInfo.name}\n` +
                    `**Identity:** ${botDisplayName}\n` +
                    `**Memory:** ${userMem} facts about you | ${memCount} total\n\n` +
                    `**Commands:**\n└ \`${prefix}lydia on\` - Activate AI\n└ \`${prefix}lydia off\` - Deactivate\n└ \`${prefix}lydia agent <core>\` - Switch core\n\n` +
                    `**Available Cores:**\n└ \`architect\` ${neuralCores.architect.emoji} - Code & System\n└ \`tactical\` ${neuralCores.tactical.emoji} - Gaming\n└ \`creative\` ${neuralCores.creative.emoji} - Creative\n└ \`default\` ${neuralCores.default.emoji} - Balanced`
                )
                .addFields(
                    { name: '📡 API Status', value: `OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅' : '❌'} | Tavily: ${process.env.TAVILY_API_KEY ? '✅' : '❌'}`, inline: true },
                    { name: '🔍 Neural Search', value: 'Tavily AI first • Token-efficient', inline: true },
                    { name: '🧠 Memory', value: 'Cross-session recall', inline: true }
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
                    { name: '🔍 Neural Search', value: 'Tavily AI enabled', inline: true },
                    { name: '🎮 How to Use', value: `Mention **@${botDisplayName}**`, inline: false },
                    { name: '🔄 Switch Core', value: `\`${prefix}lydia agent <core>\``, inline: true },
                    { name: '🔒 Deactivate', value: `\`${prefix}lydia off\``, inline: true }
                )
                .setFooter({ text: `POWERED BY OPENROUTER + TAVILY • v${client.version || '1.3.2'}` })
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
    },
    setupLydia   // ⬅️ Export de la fonction pour l'initialisation
};