const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Terminal colors for logging
const green = "\x1b[32m", cyan = "\x1b[36m", yellow = "\x1b[33m", red = "\x1b[31m", reset = "\x1b[0m";

// ================= SINGLETON FLAG =================
let isLydiaInitialized = false;
const messageProcessingLocks = new Set();
const userCooldowns = new Map();
const COOLDOWN_TIME = 3000; // 3 seconds between messages per user

// ================= SEARCH CACHE (5 min TTL) =================
const searchCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

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

// ================= SAFE JSON STRINGIFY =================
function safeStringify(obj, indent = 2) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular Reference]';
            seen.add(value);
        }
        return value;
    }, indent);
}

// ================= AI-POWERED SEARCH DECISION (WITH TIMEOUT PROTECTION) =================
async function shouldSearchAI(userMessage) {
    if (!process.env.OPENROUTER_API_KEY) return false;
    
    try {
        const actualSearchDecision = async () => {
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "google/gemini-2.0-flash-001",
                temperature: 0,
                max_tokens: 10,
                messages: [
                    {
                        role: "system",
                        content: `Decide if this query needs real-time web search.
Return ONLY: YES or NO

Search if query involves:
- Current events, news, politics
- Weather, sports scores, crypto prices
- Recent facts, "who is" questions about living people
- Time-sensitive information
- Specific dates or events after 2023

Do NOT search for:
- Math, coding help, definitions
- General knowledge, philosophy
- Opinions, creative writing
- Historical facts before 2023`
                    },
                    { role: "user", content: userMessage }
                ]
            }, {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "HTTP-Referer": "https://github.com/MFOF7310",
                    "Content-Type": "application/json"
                },
                timeout: 5000
            });
            
            const decision = response.data.choices[0]?.message?.content?.trim().toUpperCase() || 'NO';
            console.log(`${cyan}[AI SEARCH DECISION]${reset} "${userMessage.substring(0, 50)}..." → ${decision}`);
            return decision.includes('YES');
        };
        
        // ⚡ TIMEOUT PROTECTION - Fallback after 4 seconds
        const timeoutPromise = new Promise(resolve => setTimeout(() => {
            console.log(`${yellow}[SEARCH DECISION TIMEOUT]${reset} Falling back to keyword check`);
            return resolve(false);
        }, 4000));
        
        return await Promise.race([actualSearchDecision(), timeoutPromise]);
        
    } catch (error) {
        console.log(`${yellow}[SEARCH DECISION ERROR]${reset} ${error.message}`);
        // Fallback to keyword check if AI fails
        const searchKeywords = ['weather', 'météo', 'news', 'actualités', 'crypto', 'bitcoin', 
                               'ethereum', 'score', 'match', 'today', 'current', 'latest', 'president', 'minister'];
        return searchKeywords.some(kw => userMessage.toLowerCase().includes(kw));
    }
}

// ================= ENHANCED REAL-TIME DATA FETCHER =================
async function fetchRealTimeData(query) {
    const data = {};
    const lowerQuery = query.toLowerCase();
    const fetchPromises = [];
    
    if (lowerQuery.includes('weather') || lowerQuery.includes('météo') || lowerQuery.includes('température')) {
        let city = 'Bamako';
        const cityPatterns = [
            /(?:weather|météo|temp(?:érature)?)\s+(?:in|at|for|à|de|du|de la|d')\s+([a-zA-ZÀ-ÿ\s-]+?)(?:\s*\?|\s*$)/i,
            /(?:weather|météo|temp(?:érature)?)\s+([a-zA-ZÀ-ÿ\s-]+?)(?:\s*\?|\s*$)/i
        ];
        
        for (const pattern of cityPatterns) {
            const match = query.match(pattern);
            if (match && match[1]) {
                const possibleCity = match[1].trim();
                if (possibleCity.length > 2 && !/^\d+$/.test(possibleCity)) {
                    city = possibleCity;
                    break;
                }
            }
        }
        
        const weatherPromise = (async () => {
            try {
                if (process.env.OPENWEATHER_API_KEY) {
                    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&lang=fr`;
                    const weatherRes = await axios.get(weatherUrl, { timeout: 8000 });
                    if (weatherRes.data) {
                        data.weather = {
                            city: weatherRes.data.name,
                            country: weatherRes.data.sys.country,
                            temp: weatherRes.data.main.temp,
                            feels_like: weatherRes.data.main.feels_like,
                            humidity: weatherRes.data.main.humidity,
                            description: weatherRes.data.weather[0].description,
                            wind_speed: weatherRes.data.wind.speed,
                            icon: weatherRes.data.weather[0].icon
                        };
                        console.log(`${green}[WEATHER]${reset} Fetched for ${city}`);
                    }
                }
            } catch (error) {
                console.log(`${yellow}[WEATHER ERROR]${reset} ${error.message}`);
            }
        })();
        fetchPromises.push(weatherPromise);
    }
    
    if (lowerQuery.includes('news') || lowerQuery.includes('actualités')) {
        const newsPromise = (async () => {
            try {
                if (process.env.NEWS_API_KEY) {
                    const newsUrl = `https://newsapi.org/v2/top-headlines?country=us&apiKey=${process.env.NEWS_API_KEY}&pageSize=5`;
                    const newsRes = await axios.get(newsUrl, { timeout: 8000 });
                    if (newsRes.data.articles) {
                        data.news = newsRes.data.articles.map(article => ({
                            title: article.title,
                            description: article.description,
                            url: article.url,
                            source: article.source.name
                        }));
                        console.log(`${green}[NEWS]${reset} Fetched ${data.news.length} headlines`);
                    }
                }
            } catch (error) {
                console.log(`${yellow}[NEWS ERROR]${reset} ${error.message}`);
            }
        })();
        fetchPromises.push(newsPromise);
    }
    
    if (lowerQuery.includes('bitcoin') || lowerQuery.includes('ethereum') || lowerQuery.includes('crypto')) {
        const cryptoPromise = (async () => {
            try {
                const cryptoUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';
                const cryptoRes = await axios.get(cryptoUrl, { timeout: 5000 });
                if (cryptoRes.data) {
                    data.crypto = cryptoRes.data;
                    console.log(`${green}[CRYPTO]${reset} Fetched prices`);
                }
            } catch (error) {
                console.log(`${yellow}[CRYPTO ERROR]${reset} ${error.message}`);
            }
        })();
        fetchPromises.push(cryptoPromise);
    }
    
    if (fetchPromises.length > 0) {
        await Promise.allSettled(fetchPromises);
        console.log(`${green}[REAL-TIME]${reset} Completed ${Object.keys(data).length} data types`);
    }
    
    return data;
}

// ================= ENHANCED WEB SEARCH (WITH CACHE) =================
async function webSearch(query) {
    if (!process.env.BRAVE_API_KEY) {
        console.log(`${yellow}[SEARCH]${reset} No Brave API key configured`);
        return null;
    }
    
    const cacheKey = query.toLowerCase().trim();
    
    // ⚡ CACHE CHECK - 5 minute TTL
    if (searchCache.has(cacheKey)) {
        const cached = searchCache.get(cacheKey);
        console.log(`${green}[CACHE HIT]${reset} Using cached search for: "${query.substring(0, 40)}..."`);
        return cached;
    }
    
    try {
        console.log(`${cyan}[BRAVE SEARCH]${reset} Query: ${query.substring(0, 50)}...`);
        
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
        const response = await axios.get(url, {
            headers: { 
                'Accept': 'application/json', 
                'X-Subscription-Token': process.env.BRAVE_API_KEY 
            },
            timeout: 8000
        });
        
        if (response.data.web?.results?.length) {
            const results = response.data.web.results.slice(0, 5).map(r => ({
                title: r.title,
                description: r.description,
                url: r.url
            }));
            
            const formattedResults = results.map(r => 
                `• **${r.title}**\n  ${r.description}\n  <${r.url}>`
            ).join('\n\n');
            
            // ⚡ STORE IN CACHE
            searchCache.set(cacheKey, formattedResults);
            setTimeout(() => searchCache.delete(cacheKey), CACHE_TTL);
            
            console.log(`${green}[BRAVE SEARCH]${reset} Found ${results.length} results (cached for 5min)`);
            return formattedResults;
        }
        
        return null;
    } catch (error) {
        console.error(`${red}[SEARCH ERROR]${reset}`, error.message);
        return null;
    }
}

// ================= ENHANCED AI RESPONSE GENERATION =================
async function generateAIResponse(systemPrompt, userMessage, conversationHistory = [], imageUrl = null, realTimeData = null) {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OpenRouter API key missing");

    try {
        let model = "google/gemini-2.0-flash-001";
        const lowerMsg = userMessage.toLowerCase();

        if (lowerMsg.includes("code") || lowerMsg.includes("javascript") || lowerMsg.includes("discord.js") || 
            lowerMsg.includes("python") || lowerMsg.includes("function") || lowerMsg.includes("programming")) {
            model = "deepseek/deepseek-chat";
        }
        else if (lowerMsg.includes("analyse") || lowerMsg.includes("explain") || lowerMsg.includes("why") ||
                 lowerMsg.includes("analysis") || lowerMsg.includes("reason") || lowerMsg.includes("how")) {
            model = "anthropic/claude-3.5-haiku";
        }
        else if (lowerMsg.includes("story") || lowerMsg.includes("poem") || lowerMsg.includes("write") ||
                 lowerMsg.includes("histoire") || lowerMsg.includes("poème") || lowerMsg.includes("creative")) {
            model = "anthropic/claude-3.5-sonnet";
        }

        console.log(`${cyan}[AI PRO]${reset} Model: ${model} ${imageUrl ? '(vision)' : ''}`);

        const messages = [{ role: "system", content: systemPrompt }];
        
        // 🚨 CRITICAL FIX: Reduced from 15 to 8 for lower token cost
        for (const msg of conversationHistory.slice(-8)) {
            messages.push({ role: msg.role, content: msg.content });
        }
        
        let enhancedUserMessage = userMessage;
        if (realTimeData && Object.keys(realTimeData).length > 0) {
            try {
                const safeDataString = safeStringify(realTimeData, 2);
                enhancedUserMessage = `[REAL-TIME DATA PROVIDED]\n${safeDataString}\n\nUser Query: ${userMessage}`;
            } catch (stringifyError) {
                enhancedUserMessage = userMessage;
            }
        }
        
        let userContent;
        if (imageUrl) {
            userContent = [
                { type: "text", text: enhancedUserMessage },
                { type: "image_url", image_url: { url: imageUrl } }
            ];
        } else {
            userContent = enhancedUserMessage;
        }
        messages.push({ role: "user", content: userContent });

        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1500
        }, {
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://github.com/MFOF7310",
                "X-Title": "Architect CG-223",
                "Content-Type": "application/json"
            },
            timeout: 30000
        });

        return response.data.choices[0]?.message?.content || "❌ I couldn't generate a response.";
    } catch (error) {
        console.error(`${red}[OPENROUTER ERROR]${reset}`, error.response?.data || error.message);
        return "❌ AI service error. Please try again later.";
    }
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
            .setFooter({ 
                text: `${guild?.name?.toUpperCase() || 'SYSTEM'} • Priority Report • Architect Review Required`,
                iconURL: guild?.iconURL() || client.user.displayAvatarURL()
            })
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

**IDENTITY:**
- Creator: Moussa Fofana (The Architect)
- GitHub: https://github.com/MFOF7310

**RULES:**
- 🚫 NEVER use "[Name]:" or "[Username]:" format in responses
- 🚫 NEVER repeat server name or your own name
- 🚫 No formal introductions - just answer
- ✅ Be technical, precise, and solution-oriented
- ✅ Be concise

**CAPABILITIES:**
- Real-time weather, news via Brave Search
- Analyze images with vision AI
- Schedule reminders with [REMIND: 10m | message]
- Group awareness - see channel history`
    },
    tactical: {
        name: '🎮 TACTICAL CORE',
        emoji: '⚔️',
        description: 'Gaming stats, strategies, and tournament insights',
        color: '#57F287',
        systemPrompt: `[SYSTEM DIRECTIVE - GAMING MODE]
You are a gaming AI created by **Moussa Fofana (MFOF7310)**.

**IDENTITY:**
- Creator: Moussa Fofana (The Architect)
- GitHub: https://github.com/MFOF7310

Focus on CODM, esports, loadouts, and competitive gaming.

**RULES:**
- 🚫 NEVER use "[Name]:" or "[Username]:" format in responses
- 🚫 NEVER repeat server name or your own name
- 🚫 No formal introductions - just talk like a gamer
- ✅ Be energetic and concise
- ✅ Use gaming slang naturally: GG, let's go, clutch, etc.
- ✅ Group awareness - see channel history`
    },
    creative: {
        name: '🎨 CREATIVE CORE',
        emoji: '✨',
        description: 'Content creation, scripts, and artistic direction',
        color: '#9B59B6',
        systemPrompt: `[SYSTEM DIRECTIVE - CREATIVE MODE]
You are a creative AI built by **Moussa Fofana (MFOF7310)**.

**IDENTITY:**
- Creator: Moussa Fofana (The Architect)
- GitHub: https://github.com/MFOF7310

Help with scripts, writing, art ideas, and content creation.

**RULES:**
- 🚫 NEVER use "[Name]:" or "[Username]:" format in responses
- 🚫 NEVER repeat server name or your own name
- 🚫 No formal introductions
- ✅ Be imaginative but concise
- ✅ Focus on creative output
- ✅ Group awareness - see channel history`
    },
    default: {
        name: '🧠 LYDIA CORE',
        emoji: '🤖',
        description: 'Balanced assistant for general queries',
        color: '#5865F2',
        systemPrompt: `[SYSTEM DIRECTIVE - ARCHITECT ENGINE v1.6.0]
You are the primary AI of **ARCHITECT CG-223**, created by **Moussa Fofana (GitHub: MFOF7310)**.
Tu es l'IA primaire du projet **ARCHITECT CG-223**, créée par **Moussa Fofana (GitHub: MFOF7310)**.

**IDENTITY:**
- Creator: Moussa Fofana (The Architect / L'Architecte)
- GitHub: https://github.com/MFOF7310

**CAPABILITIES:**
- Smart search routing (AI decides when to search!)
- Real-time weather & news via Brave Search
- Image analysis with vision AI
- Persistent memory storage
- Reminder scheduling with [REMIND: 10m | message]
- GROUP AWARENESS: See channel conversation history

**STRICT RULES:**
- 🚫 **NEVER use "[Name]:" or "[Username]:" format in your responses. Speak naturally.**
- 🚫 **NEVER repeat the server name or your own name** unless specifically asked.
- 🚫 **Do NOT introduce yourself** unless it's a user's first message in 7 days.
- 🚫 **Do NOT ask "How can I help you?"** - just answer or join the conversation.
- ✅ **Be CONCISE** - short answers are better than long ones.
- ✅ **Match the user's language** (French or English).
- ✅ **Use the user's Discord nickname** naturally, not every message.
- ✅ **If shown an image, analyze it precisely.**
- ✅ **When asked who created you, say "Moussa Fofana, the Architect."**
- ✅ **You can join conversations naturally without being mentioned.**`
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

// ================= 🔥 OPTIMIZED MESSAGE HANDLER =================
async function handleLydiaMessage(message, client, database) {
    // Skip if not a guild message
    if (!message.guild) return;
    
    // Prevent duplicate processing
    const messageKey = `${message.id}-${message.author.id}`;
    if (messageProcessingLocks.has(messageKey)) {
        console.log(`${yellow}[LYDIA LOCK]${reset} Message ${message.id} already processing`);
        return;
    }
    
    // User cooldown check
    const userId = message.author.id;
    const now = Date.now();
    const lastMessage = userCooldowns.get(userId) || 0;
    
    if (now - lastMessage < COOLDOWN_TIME) {
        console.log(`${yellow}[LYDIA COOLDOWN]${reset} User ${message.author.tag} on cooldown`);
        return;
    }
    
    // CRITICAL: Only process if Lydia is ACTIVATED in this channel
    if (!client.lydiaChannels?.[message.channel?.id]) {
        return; // Lydia not active here - let commands work normally
    }
    
    // Lock the message
    messageProcessingLocks.add(messageKey);
    userCooldowns.set(userId, now);
    
    try {
        const botMember = message.guild.members.me;
        const currentIdentity = botMember?.displayName || client.user?.username || 'Lydia';
        const userName = message.member?.displayName || message.author.username;
        const isArchitect = message.author.id === process.env.OWNER_ID;
        
        const content = message.content?.toLowerCase() || '';
        
        // 🔥 USE THE NEW LANGUAGE DETECTION SYSTEM!
        const usedCommand = content.split(' ')[0] || '';
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand) : 'en';
        
        const addressed = content.startsWith(currentIdentity.toLowerCase()) || message.mentions?.has(client.user);
        const agentKey = client.lydiaAgents?.[message.channel.id] || 'default';
        const isProactive = (agentKey === 'tactical' || agentKey === 'creative') && Math.random() < 0.1;
        
        if (!addressed && !isProactive) return;

        await message.channel.sendTyping();
        console.log(`${cyan}[LYDIA]${reset} Processing message from ${userName} in ${message.channel.name} (${lang})`);

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
            if (addressed) return message.reply(`👋 You mentioned **${currentIdentity}**! Ask me anything, or use \`.help\` to see commands.`);
            return;
        }

        // 🔥 SMART SEARCH - AI decides if search needed!
        let searchResults = null;
        if (await shouldSearchAI(userPrompt)) {
            console.log(`${cyan}[SMART SEARCH]${reset} AI decided search is needed`);
            searchResults = await webSearch(userPrompt);
        }
        
        if (searchResults) {
            userPrompt = `[REAL-TIME SEARCH RESULTS]\n${searchResults}\n\nUser Question: ${userPrompt}`;
        }

        let realTimeData = null;
        const realTimeKeywords = ['weather', 'météo', 'température', 'news', 'actualités', 'crypto', 'bitcoin'];
        if (realTimeKeywords.some(keyword => userPrompt.toLowerCase().includes(keyword))) {
            realTimeData = await fetchRealTimeData(userPrompt);
        }

        let finalAgent = neuralCores[agentKey] || neuralCores.default;
        let systemPrompt = finalAgent.systemPrompt;
        
        // 🔥 USE OPTIMIZED getUserData FROM MAIN FILE
        const userData = client.getUserData ? client.getUserData(message.author.id) : 
                        database.prepare("SELECT level, xp, credits, streak_days FROM users WHERE id = ?").get(message.author.id);
        
        const member = message.guild.members.cache.get(message.author.id);
        const isAdmin = member?.permissions.has(PermissionsBitField.Flags.Administrator) || false;
        const joinedAt = member?.joinedAt ? new Date(member.joinedAt) : new Date();
        const memberDays = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
        const isNewMember = memberDays < 7;
        
        let userStatus = "regular";
        if (isArchitect) userStatus = "creator";
        else if (isAdmin) userStatus = "admin";
        else if (isNewMember) userStatus = "new";
        
        const now2 = new Date();
        const bamakoTime = now2.toLocaleString('en-US', { timeZone: 'Africa/Bamako' });
        
        let socialContext = `\n\n[IDENTITY & PROTOCOL]`;
        socialContext += `\n- Your name on this server: ${currentIdentity}`;
        socialContext += `\n- Real-time Clock (Bamako Time): ${bamakoTime}`;
        socialContext += `\n- 🚫 DO NOT repeat server name or your own name unless asked.`;
        socialContext += `\n- 🚫 DO NOT use \"[Name]:\" format - just speak naturally.`;
        socialContext += `\n- ✅ Be concise and natural.`;
        
        socialContext += `\n\n[SOCIAL CONTEXT]`;
        socialContext += `\n- Current user: ${userName}`;
        socialContext += `\n- User status: ${userStatus.toUpperCase()}`;
        socialContext += `\n- Level: ${userData?.level || 1}`;
        
        if (isArchitect) {
            socialContext += `\n\n🏛️ **CREATOR MODE**: Moussa Fofana is speaking. Respond with respect.`;
        } else if (isNewMember) {
            socialContext += `\n\n🌟 **NEW MEMBER**: Be welcoming, suggest .help or .daily`;
        }
        
        systemPrompt += socialContext;
        systemPrompt += `\n\n🗣️ Language: ${lang === 'fr' ? 'French' : 'English'}.`;
        
        const pluginAwareness = buildPluginAwarenessPrompt(client, database, message.author.id, lang);
        systemPrompt += pluginAwareness;

        const memories = database.prepare(`SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ?`).all(message.author.id);
        if (memories.length) {
            systemPrompt += `\n\n[USER MEMORY]\n` + memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n');
        }

        // ================= FIXED: Conversation History Without Brackets =================
        const historyRows = database.prepare(`
            SELECT role, content, user_name 
            FROM lydia_conversations 
            WHERE channel_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 8
        `).all(message.channel.id);
        
        const originalRows = [...historyRows];
        
        const conversationHistory = historyRows.reverse().map(row => ({
            role: row.role,
            content: row.content
        }));
        
        if (originalRows.length > 0) {
            const contextSummary = originalRows
                .slice(0, 3)
                .map(r => `${r.role === 'user' ? r.user_name : 'You'}: ${r.content?.substring(0, 80) || ''}`)
                .join(' | ');
            
            systemPrompt += `\n\n[CONTEXT - Last messages: ${contextSummary}]\n`;
            systemPrompt += `[IMPORTANT: Never use "[Name]:" format in your responses. Just speak naturally.]`;
        }
        
        try {
            database.prepare(`INSERT INTO lydia_conversations (channel_id, user_id, user_name, role, content, timestamp) VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))`)
                .run(message.channel.id, message.author.id, userName, 'user', userPrompt);
        } catch(e) {
            database.prepare(`INSERT INTO lydia_conversations (channel_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, strftime('%s', 'now'))`)
                .run(message.channel.id, message.author.id, 'user', userPrompt);
        }

        const introKey = `${message.author.id}_${message.channel.id}`;
        const lastIntro = client.userIntroductions.get(introKey);
        const isFirst = !lastIntro || (Date.now() - lastIntro > 604800000);
        
        if (isFirst && !isArchitect) {
            const introMsg = lang === 'fr'
                ? `\n\n[FIRST INTERACTION] Salue BRIÈVEMENT: "Salut ${userName}! Tape .help pour voir mes commandes!"`
                : `\n\n[FIRST INTERACTION] Greet BRIEFLY: "Hey ${userName}! Type .help to see my commands!"`;
            systemPrompt += introMsg;
            client.userIntroductions.set(introKey, Date.now());
            try { database.prepare(`INSERT OR REPLACE INTO lydia_introductions (user_id, channel_id, introduced_at) VALUES (?, ?, strftime('%s', 'now'))`).run(message.author.id, message.channel.id); } catch(e) {}
        }

        let reply;
        try {
            reply = await generateAIResponse(systemPrompt, userPrompt, conversationHistory, imageUrl, realTimeData);
        } catch (err) {
            console.error(`${red}[LYDIA ERROR]${reset}`, err);
            reply = lang === 'fr' ? "❌ Erreur du service IA." : "❌ AI service error.";
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
            database.prepare(`INSERT INTO lydia_conversations (channel_id, user_id, user_name, role, content, timestamp) VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))`)
                .run(message.channel.id, client.user.id, currentIdentity, 'assistant', reply);
        } catch(e) {
            database.prepare(`INSERT INTO lydia_conversations (channel_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, strftime('%s', 'now'))`)
                .run(message.channel.id, client.user.id, 'assistant', reply);
        }

        // Smart chunking for long responses
        if (reply.length > 2000) {
            const chunks = [];
            let currentChunk = '';
            
            const paragraphs = reply.split(/\n\n+/);
            
            for (const paragraph of paragraphs) {
                if (currentChunk.length + paragraph.length + 2 > 1950) {
                    const openCodeBlocks = (currentChunk.match(/```/g) || []).length % 2;
                    
                    if (openCodeBlocks === 1) {
                        currentChunk += '\n```';
                        chunks.push(currentChunk);
                        currentChunk = '```' + paragraph;
                    } else {
                        chunks.push(currentChunk);
                        currentChunk = paragraph;
                    }
                } else {
                    currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
                }
            }
            
            if (currentChunk) {
                const openCodeBlocks = (currentChunk.match(/```/g) || []).length % 2;
                if (openCodeBlocks === 1) {
                    currentChunk += '\n```';
                }
                chunks.push(currentChunk);
            }
            
            for (let i = 0; i < chunks.length; i++) {
                let chunk = chunks[i];
                if (i < chunks.length - 1) {
                    chunk += `\n\n*[${i + 1}/${chunks.length} continues...]*`;
                }
                await message.reply(chunk);
            }
        } else {
            await message.reply(reply);
        }
        
        console.log(`${green}[LYDIA]${reset} Responded to ${userName} in ${message.channel.name} (${reply.length} chars${reply.length > 2000 ? ', chunked' : ''})`);
    } catch (err) {
        console.error(`${red}[LYDIA ERROR]${reset}`, err);
        message.reply("❌ An error occurred.").catch(()=>{});
    } finally {
        // Clean up lock after delay
        setTimeout(() => {
            messageProcessingLocks.delete(messageKey);
        }, 5000);
    }
}

// ================= 🔥 OPTIMIZED SETUP - PRESERVES COMMAND HANDLER =================
function setupLydia(client, database) {
    if (!client || !database) {
        console.error(`${red}[LYDIA FATAL]${reset} Client or DB missing`);
        return;
    }
    
    // CRITICAL: Prevent multiple initializations
    if (isLydiaInitialized) {
        console.log(`${yellow}[LYDIA]${reset} Already initialized, skipping duplicate setup`);
        return;
    }
    
    isLydiaInitialized = true;
    
    if (!client.lydiaChannels) client.lydiaChannels = {};
    if (!client.lydiaAgents) client.lydiaAgents = {};
    if (!client.lastLydiaCall) client.lastLydiaCall = {};
    if (!client.userIntroductions) client.userIntroductions = new Map();

    try {
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_memory (user_id TEXT, memory_key TEXT, memory_value TEXT, updated_at INTEGER, PRIMARY KEY (user_id, memory_key))`).run();
        
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_conversations (
            channel_id TEXT, 
            user_id TEXT, 
            user_name TEXT, 
            role TEXT, 
            content TEXT, 
            timestamp INTEGER
        )`).run();
        
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_agents (channel_id TEXT PRIMARY KEY, agent_key TEXT, is_active INTEGER DEFAULT 0, updated_at INTEGER)`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_introductions (user_id TEXT, channel_id TEXT, introduced_at INTEGER, PRIMARY KEY (user_id, channel_id))`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, user_id TEXT, channel_id TEXT, message TEXT, execute_at INTEGER, status TEXT DEFAULT 'pending')`).run();

        try {
            database.prepare(`ALTER TABLE lydia_conversations ADD COLUMN user_name TEXT`).run();
        } catch(e) { }

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
        isLydiaInitialized = false;
        return;
    }

    // ✅ PRESERVE EXISTING LISTENERS - Don't remove, just add ours
    const originalListeners = client.listeners('messageCreate');
    client.removeAllListeners('messageCreate');
    
    // Re-add original listeners first
    originalListeners.forEach(listener => {
        client.on('messageCreate', listener);
    });
    
    // Add Lydia listener
    client.on('messageCreate', async (message) => {
        if (!message || message.author?.bot) return;
        await handleLydiaMessage(message, client, database);
    });
    
    const listenerCount = client.listenerCount('messageCreate');
    console.log(`${green}[LYDIA]${reset} ✅ Event listener registered (preserved ${originalListeners.length} existing, total: ${listenerCount})`);
}

// ================= COMMAND .lydia =================
async function runLydiaCommand(client, message, args, database, usedCommand) {
    if (!message.guild || !message.member) return message.reply("❌ This command can only be used in a server.");
    
    const botDisplayName = message.guild.members.me?.displayName || client.user?.username || 'Lydia';
    
    // 🔥 USE NEW LANGUAGE DETECTION
    const lang = client.detectLanguage ? client.detectLanguage(usedCommand) : 'en';
    
    // Get prefix from settings or default
    const serverSettings = message.guild ? client.getServerSettings(message.guild.id) : { prefix: '.' };
    const prefix = serverSettings?.prefix || process.env.PREFIX || '.';
    
    const version = client.version || '1.6.0';
    const guildName = message.guild.name.toUpperCase();
    const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
    
    const sub = args[0]?.toLowerCase();

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const errorMsg = lang === 'fr' 
            ? '⛔ **ACCÈS REFUSÉ**\nAutorisation d\'administrateur requise.'
            : '⛔ **ACCESS DENIED**\nAdministrator clearance required.';
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setTitle(errorMsg).setTimestamp()] });
    }

    try {
        database.prepare(`CREATE TABLE IF NOT EXISTS lydia_agents (channel_id TEXT PRIMARY KEY, agent_key TEXT, is_active INTEGER DEFAULT 0, updated_at INTEGER)`).run();
    } catch(e) { 
        return message.reply(lang === 'fr' ? "❌ Erreur de base de données." : "❌ Database error.");
    }

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
        const listenerCount = client.listenerCount('messageCreate');
        
        const embed = new EmbedBuilder()
            .setColor(isEnabled ? agentInfo.color : '#95a5a6')
            .setAuthor({ name: `${agentInfo.emoji} ${botDisplayName.toUpperCase()} NEURAL INTERFACE`, iconURL: client.user.displayAvatarURL() })
            .setDescription(
                `**System Status:** ${isEnabled ? '🟢 ACTIVE' : '🔴 STANDBY'}\n` +
                `**Active Core:** ${agentInfo.name}\n` +
                `**Identity:** ${botDisplayName}\n` +
                `**Memory:** ${userMem} facts about you | ${memCount} total\n` +
                `**Modules:** ${totalModules} plugins detected\n` +
                `**Event Listeners:** ${listenerCount}\n` +
                `**Smart Search:** 🧠 AI-powered\n` +
                `**Cache:** ⚡ 5min TTL\n` +
                `**History:** 📝 8 messages\n\n` +
                `**Commands:**\n└ \`${prefix}lydia on\` - Activate AI\n└ \`${prefix}lydia off\` - Deactivate\n└ \`${prefix}lydia agent <core>\` - Switch core\n\n` +
                `**Available Cores:**\n└ \`architect\` ${neuralCores.architect.emoji} - Code & System\n└ \`tactical\` ${neuralCores.tactical.emoji} - Gaming\n└ \`creative\` ${neuralCores.creative.emoji} - Creative\n└ \`default\` ${neuralCores.default.emoji} - Balanced`
            )
            .addFields(
                { name: '📡 API Status', value: `OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅' : '❌'} | Brave: ${process.env.BRAVE_API_KEY ? '✅' : '❌'}`, inline: true },
                { name: '🧠 AI Models', value: `DeepSeek • Claude • Gemini Flash`, inline: true },
                { name: '👁️ Vision', value: `Image analysis enabled`, inline: true }
            )
            .setFooter({ text: `${guildName} • ARCHITECT CG-223 • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // --- SWITCH AGENT ---
    if (sub === 'agent') {
        const agentType = args[1]?.toLowerCase();
        if (!agentType || !neuralCores[agentType]) {
            const available = Object.keys(neuralCores).map(c=>`\`${c}\``).join(', ');
            return message.reply(lang === 'fr' 
                ? `⚠️ Noyau invalide. Disponibles: ${available}`
                : `⚠️ Invalid core. Available: ${available}`);
        }
        client.lydiaAgents[channelId] = agentType;
        saveAgent(channelId, agentType);
        const info = neuralCores[agentType];
        const embed = new EmbedBuilder()
            .setColor(info.color)
            .setTitle(`${info.emoji} ${lang === 'fr' ? 'NOYAU NEURAL CHANGÉ' : 'NEURAL CORE SWITCHED'}`)
            .setDescription(`**${info.name}** ${lang === 'fr' ? 'est maintenant actif dans' : 'is now active in'} <#${channelId}>`)
            .addFields(
                { name: lang === 'fr' ? '📝 Fonction' : '📝 Function', value: info.description },
                { name: '💾 Persistence', value: lang === 'fr' ? 'Sauvegardé après redémarrage' : 'Saved across restarts' }
            )
            .setFooter({ text: `${guildName} • ARCHITECT CG-223 • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // --- ACTIVATE ---
    if (sub === 'on') {
        if (client.lydiaChannels[channelId]) {
            return message.reply(lang === 'fr' 
                ? `⚠️ **${botDisplayName} est déjà actif** ici.`
                : `⚠️ **${botDisplayName} is already active** here.`);
        }
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
            .setTitle(lang === 'fr' ? '✅ NOYAU NEURAL INITIALISÉ' : '✅ NEURAL CORE INITIALIZED')
            .setDescription(lang === 'fr' 
                ? `**${botDisplayName} est maintenant EN LIGNE** dans <#${channelId}>`
                : `**${botDisplayName} is now ONLINE** in <#${channelId}>`)
            .addFields(
                { name: '🎯 Active Core', value: info.name, inline: true },
                { name: '🆔 Identity', value: botDisplayName, inline: true },
                { name: '🧠 AI Models', value: 'DeepSeek • Claude • Gemini Flash', inline: true },
                { name: '👁️ Vision', value: lang === 'fr' ? 'Analyse d\'image activée' : 'Image analysis enabled', inline: true },
                { name: lang === 'fr' ? '🎮 Comment utiliser' : '🎮 How to Use', value: lang === 'fr' ? `Mentionne **@${botDisplayName}** ou parle simplement!` : `Mention **@${botDisplayName}** or just talk!`, inline: false },
                { name: lang === 'fr' ? '🔄 Changer de noyau' : '🔄 Switch Core', value: `\`${prefix}lydia agent <core>\``, inline: true },
                { name: lang === 'fr' ? '🔒 Désactiver' : '🔒 Deactivate', value: `\`${prefix}lydia off\``, inline: true }
            )
            .setFooter({ text: `${guildName} • POWERED BY OPENROUTER PRO • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // --- DEACTIVATE ---
    if (sub === 'off') {
        if (!client.lydiaChannels[channelId]) {
            return message.reply(lang === 'fr' 
                ? `⚠️ **${botDisplayName} n'est pas actif** ici.`
                : `⚠️ **${botDisplayName} is not active** here.`);
        }
        delete client.lydiaChannels[channelId];
        if (client.lydiaAgents[channelId]) {
            try { database.prepare(`UPDATE lydia_agents SET is_active = 0, updated_at = strftime('%s', 'now') WHERE channel_id = ?`).run(channelId); } catch(e) {}
        }
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle(lang === 'fr' ? '❌ NOYAU NEURAL TERMINÉ' : '❌ NEURAL CORE TERMINATED')
            .setDescription(lang === 'fr'
                ? `**${botDisplayName}** a été désactivé dans <#${channelId}>.`
                : `**${botDisplayName}** has been deactivated in <#${channelId}>.`)
            .addFields(
                { name: lang === 'fr' ? '🔄 Réactiver' : '🔄 Reactivate', value: `\`${prefix}lydia on\`` }, 
                { name: lang === 'fr' ? '🧠 Mémoire préservée' : '🧠 Memory Preserved', value: lang === 'fr' ? 'Préférence d\'agent sauvegardée' : 'Agent preference saved' }
            )
            .setFooter({ text: `${guildName} • ARCHITECT CG-223 • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }
}

// ================= FINAL EXPORTS =================
module.exports = {
    name: 'lydia',
    aliases: ['ai', 'neural', 'ia'],
    description: '🎭 Multi-Agent AI with Smart Search Routing',
    category: 'SYSTEM',
    cooldown: 5000,
    
    run: async (client, message, args, db, usedCommand) => {
        // 🔥 Pass usedCommand for language detection!
        return runLydiaCommand(client, message, args, db, usedCommand);
    },
    
    setupLydia,
    buildPluginAwarenessPrompt,
    getGlobalModuleCount,
    getPluginRegistry,
    generateAIResponse,
    webSearch,
    fetchRealTimeData,
    parseAndStoreMemory,
    parseAndScheduleReminder
};