// ================= 🧠 TELEGRAM LYDIA v2.7.0 - PRO EDITION =================
// ARCHITECT CG-223 | Ported from Discord Lydia v2.7.0
// Features: Smart Search Routing, 5min Cache, Weather/News/Crypto, Architect Alerts

const https = require('https');

// ================= CONVERSATION LIMITS =================
const MAX_HISTORY = 10; // Maximum conversation history per user
const MAX_MEMORY_PER_USER = 20; // Maximum memories per user

// ================= CONVERSATION HISTORY =================
const conversationHistory = new Map();

// ================= USER MODEL PREFERENCES =================
const userModelPreference = new Map();

// ================= SEARCH CACHE (5 min TTL) =================
const searchCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

// ================= AVAILABLE AI MODELS =================
const availableModels = {
    'llama': { 
        name: 'Llama 3.1 8B', 
        model: 'meta-llama/llama-3.1-8b-instruct', 
        emoji: '🦙', 
        desc: 'FREE & unlimited! Great all-rounder',
        free: true
    },
    'gpt': { 
        name: 'GPT-4o-mini', 
        model: 'openai/gpt-4o-mini', 
        emoji: '🤖', 
        desc: 'Fast, cheap, excellent responses',
        free: false
    },
    'claude': { 
        name: 'Claude 3.5 Haiku', 
        model: 'anthropic/claude-3.5-haiku', 
        emoji: '📚', 
        desc: 'Nuanced, thoughtful, creative',
        free: false
    },
    'gemini': { 
    name: 'Gemini 2.0 Flash', 
    model: 'google/gemini-2.0-flash-001', 
    emoji: '🔍', 
    desc: 'Ultra-stable! Great for research & current events',
    free: false
},
    'deepseek': { 
        name: 'DeepSeek V3', 
        model: 'deepseek/deepseek-chat', 
        emoji: '🔬', 
        desc: 'Deep analysis, coding, reasoning',
        free: false
    }
};

module.exports = {
    name: 'lydia',
    aliases: ['ai', 'ask', 'chat', 'ia'],
    
    handler: async (ctx) => {
        const args = ctx.args || [];
        const chatId = ctx.chatId.toString();
        const userId = ctx.userId.toString();
        const username = ctx.username;
        const token = ctx.token;
        const client = ctx.client;
        const message = ctx.message;
        const version = client.version || '1.7.0';
        const lydiaActiveChats = ctx.lydiaActiveChats;
        
        const botName = client.user?.username || 'Architect CG-223';
        const botUsername = client.user?.username?.toLowerCase().replace(/\s+/g, '') || 'archoncgbridgebot';
        
        const userMessage = args.join(' ');
        const isActive = lydiaActiveChats.has(chatId);
        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
        const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
        
        if (!conversationHistory.has(userId)) {
            conversationHistory.set(userId, []);
        }
        const history = conversationHistory.get(userId);
        
        // ================= CREDIT-EFFICIENT AUTO-REPLY CHECK =================
        const isCommand = message.text?.startsWith('/');
        
        if (!isCommand) {
            const shouldRespond = shouldLydiaRespond(message, botName, botUsername);
            if (!shouldRespond) {
                console.log(`[TG-LYDIA] Ignored: ${username}`);
                return;
            }
        }
        
        // ================= MODEL SELECTION =================
        if (userMessage.toLowerCase().startsWith('model')) {
            const modelArg = userMessage.split(' ')[1]?.toLowerCase();
            
            if (!modelArg || modelArg === 'list') {
                let modelList = `<b>📋 Available AI Models</b>\n\n`;
                const currentModel = userModelPreference.get(userId) || 'llama';
                
                Object.entries(availableModels).forEach(([key, m]) => {
                    const isCurrent = key === currentModel ? ' ✅' : '';
                    const freeTag = m.free ? ' 🆓' : '';
                    modelList += `${m.emoji} <b>${m.name}</b>${isCurrent}\n`;
                    modelList += `   /lydia model ${key}\n`;
                    modelList += `   ${m.desc}${freeTag}\n\n`;
                });
                
                const currentModelData = availableModels[currentModel] || availableModels.llama;
                modelList += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                modelList += `<b>Current:</b> ${currentModelData.emoji} ${currentModelData.name}\n\n`;
                modelList += `<i>Type /lydia model [name] to switch</i>`;
                
                await ctx.replyWithHTML(modelList);
                return;
            }
            
            if (availableModels[modelArg]) {
                userModelPreference.set(userId, modelArg);
                const m = availableModels[modelArg];
                const freeNote = m.free ? '\n\n🆓 This model is <b>COMPLETELY FREE</b>!' : '';
                
                await ctx.replyWithHTML(
                    `✅ <b>Model switched!</b>\n\n` +
                    `${m.emoji} <b>${m.name}</b>\n` +
                    `${m.desc}${freeNote}\n\n` +
                    `<i>Type /lydia model list to see all options</i>`
                );
            } else {
                const availableKeys = Object.keys(availableModels).join(', ');
                await ctx.replyWithHTML(`❌ Unknown model. Available: ${availableKeys}`);
            }
            return;
        }
        
        // ================= HELP MENU =================
        if (!userMessage || userMessage.toLowerCase() === 'help') {
            const statusEmoji = isActive ? '🟢' : '⚪';
            const statusText = isActive ? 'ACTIVE' : 'STANDBY';
            const currentModel = userModelPreference.get(userId) || 'llama';
            const modelData = availableModels[currentModel] || availableModels.llama;
            const cacheSize = searchCache.size;
            
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║     🦅 GUARDIAN OF ELITE FRIENDS    ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>${statusEmoji} Status:</b> ${statusText}\n` +
                `<b>${modelData.emoji} Model:</b> ${modelData.name}\n\n` +
                `<b>📋 Commands:</b>\n` +
                `<code>/lydia on</code>     • Enable auto-reply\n` +
                `<code>/lydia off</code>    • Disable auto-reply\n` +
                `<code>/lydia model [name]</code> • Switch AI model\n` +
                `<code>/lydia status</code> • Check AI status\n` +
                `<code>/lydia memory</code> • See what I remember\n` +
                `<code>/lydia clear</code>  • Clear conversation\n\n` +
                `<b>🧠 Pro Features (v2.7.0):</b>\n` +
                `• Smart Search Routing (AI decides)\n` +
                `• 5min Search Cache (${cacheSize} entries)\n` +
                `• Max History: ${MAX_HISTORY} messages\n` +
                `• Max Memory: ${MAX_MEMORY_PER_USER} facts\n` +
                `• Real-time Weather/News/Crypto\n` +
                `• Architect Alerts\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📍 BAMAKO_223 🇲🇱 • v${version}\n` +
                `👨‍💻 Forged by @mfof7310`
            );
            return;
        }
        
        // ================= ENABLE AUTO-REPLY =================
        if (userMessage.toLowerCase() === 'on') {
            lydiaActiveChats.add(chatId);
            try {
                const db = client.db;
                if (db) {
                    client.safeDbWrite(() => {
                        db.prepare("INSERT OR REPLACE INTO lydia_agents (channel_id, agent_key, is_active, updated_at) VALUES (?, ?, 1, ?)")
                            .run(`tg_${chatId}`, 'lydia', Math.floor(Date.now() / 1000));
                    });
                }
            } catch (e) {}
            await ctx.replyWithHTML(`🟢 <b>Guardian Mode Activated</b>\n\nI'm now watching over this chat. 🦅`);
            return;
        }
        
        // ================= DISABLE AUTO-REPLY =================
        if (userMessage.toLowerCase() === 'off') {
            lydiaActiveChats.delete(chatId);
            try {
                const db = client.db;
                if (db) {
                    client.safeDbWrite(() => {
                        db.prepare("UPDATE lydia_agents SET is_active = 0 WHERE channel_id = ?").run(`tg_${chatId}`);
                    });
                }
            } catch (e) {}
            await ctx.replyWithHTML(`⚪ <b>Guardian Mode Disabled</b>`);
            return;
        }
        
        // ================= STATUS =================
        if (userMessage.toLowerCase() === 'status') {
            const activeCount = lydiaActiveChats ? lydiaActiveChats.size : 0;
            const currentModel = userModelPreference.get(userId) || 'llama';
            const modelData = availableModels[currentModel] || availableModels.llama;
            const cacheSize = searchCache.size;
            
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        🦅 GUARDIAN STATUS          ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>🟢 System:</b> ONLINE\n` +
                `<b>🤖 Identity:</b> ${botName}\n` +
                `<b>${modelData.emoji} Neural Core:</b> ${modelData.name}\n` +
                `<b>💰 Mode:</b> Credit-Efficient\n` +
                `<b>💬 Active Watches:</b> ${activeCount}\n` +
                `<b>💾 Memory:</b> ${history.length}/${MAX_HISTORY} messages\n` +
                `<b>⚡ Search Cache:</b> ${cacheSize} entries (5min TTL)\n\n` +
                `<b>🧠 Pro Features:</b>\n` +
                `• Smart Search Routing ✅\n` +
                `• Weather/News/Crypto ✅\n` +
                `• Architect Alerts ✅\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📍 BAMAKO_223 🇲🇱 • v${version}`
            );
            return;
        }
        
        // ================= MEMORY =================
        if (userMessage.toLowerCase() === 'memory') {
            try {
                const db = client.db;
                if (db) {
                    const memories = db.prepare("SELECT memory_key, memory_value FROM lydia_memory WHERE user_id = ?").all(`tg_${userId}`);
                    
                    if (memories.length === 0) {
                        await ctx.replyWithHTML(`📭 <b>No memories stored yet!</b>\n\nChat with me and I'll remember!`);
                    } else {
                        let memoryText = `<b>📝 What I remember (${memories.length}/${MAX_MEMORY_PER_USER}):</b>\n\n`;
                        memories.forEach(mem => {
                            memoryText += `• <b>${mem.memory_key}:</b> ${mem.memory_value}\n`;
                        });
                        memoryText += `\n<i>Type /lydia clear to reset memory</i>`;
                        await ctx.replyWithHTML(memoryText);
                    }
                }
            } catch (e) {
                await ctx.replyWithHTML(`Memory system initializing...`);
            }
            return;
        }
        
        // ================= CLEAR MEMORY =================
        if (userMessage.toLowerCase() === 'clear') {
            try {
                const db = client.db;
                if (db) {
                    client.safeDbWrite(() => {
                        db.prepare("DELETE FROM lydia_memory WHERE user_id = ?").run(`tg_${userId}`);
                    });
                }
                conversationHistory.set(userId, []);
                await ctx.replyWithHTML(`✅ <b>Memory cleared!</b> Starting fresh with you. ✨`);
            } catch (e) {
                await ctx.replyWithHTML(`❌ Could not clear memory.`);
            }
            return;
        }
        
        // ================= CHECK API KEY =================
        if (!OPENROUTER_API_KEY) {
            await ctx.replyWithHTML(`⚠️ <b>API Key Not Configured</b>\n\nContact @mfof7310 to set up OpenRouter.`);
            return;
        }
        
        // ================= SEND TYPING INDICATOR =================
        await sendTypingIndicator(token, chatId);
        
        try {
            // 🔥 SMART SEARCH ROUTING
            let searchResults = null;
            if (await shouldSearchAI(userMessage, OPENROUTER_API_KEY)) {
                console.log(`[SMART SEARCH] AI decided search is needed`);
                searchResults = await webSearch(userMessage, BRAVE_API_KEY);
            }
            
            // 🔥 REAL-TIME DATA
            let realTimeData = null;
            const realTimeKeywords = ['weather', 'météo', 'température', 'news', 'actualités', 'crypto', 'bitcoin'];
            if (realTimeKeywords.some(keyword => userMessage.toLowerCase().includes(keyword))) {
                realTimeData = await fetchRealTimeData(userMessage);
            }
            
            // Build enhanced prompt
            let enhancedPrompt = userMessage;
            if (searchResults) {
                enhancedPrompt = `[REAL-TIME SEARCH RESULTS]\n${searchResults}\n\nUser Question: ${userMessage}`;
            }
            if (realTimeData && Object.keys(realTimeData).length > 0) {
                enhancedPrompt = `[REAL-TIME DATA PROVIDED]\n${JSON.stringify(realTimeData, null, 2)}\n\n${enhancedPrompt}`;
            }
            
            // Get user's preferred model
           const modelPref = userModelPreference.get(userId) || 'gemini';
           let selectedModel = availableModels[modelPref]?.model || 'google/gemini-2.0-flash-001';
            
            // 🔥 DYNAMIC MODEL SWITCHING
            const lowerMsg = userMessage.toLowerCase();
            if (lowerMsg.includes("code") || lowerMsg.includes("javascript") || lowerMsg.includes("python") || lowerMsg.includes("programming")) {
                selectedModel = "deepseek/deepseek-chat";
                console.log(`[AI PRO] Switched to DeepSeek for coding`);
            } else if (lowerMsg.includes("analyse") || lowerMsg.includes("explain") || lowerMsg.includes("why")) {
                selectedModel = "anthropic/claude-3.5-haiku";
                console.log(`[AI PRO] Switched to Claude for analysis`);
            } else if (lowerMsg.includes("story") || lowerMsg.includes("poem") || lowerMsg.includes("creative")) {
                selectedModel = "anthropic/claude-3.5-sonnet";
                console.log(`[AI PRO] Switched to Claude Sonnet for creative`);
            }
            
            // Get AI response
            const response = await callOpenRouter(OPENROUTER_API_KEY, enhancedPrompt, username, botName, history, selectedModel);
            
            // Update conversation history
            history.push({ role: 'user', content: userMessage });
            history.push({ role: 'assistant', content: response });
            if (history.length > MAX_HISTORY) {
                history.splice(0, history.length - MAX_HISTORY);
            }
            
            // Extract memories
            await extractMemories(client, userId, userMessage, response);
            
            // 🔥 ARCHITECT ALERT
            let finalResponse = response;
            if (response && response.includes('[SIGNAL_ARCHITECT]')) {
                const reportKeywords = ['report', 'bug', 'erreur', 'fix', 'notify', 'issue'];
                const shouldReport = reportKeywords.some(kw => userMessage.toLowerCase().includes(kw));
                if (shouldReport) {
                    await sendArchitectAlert(client, username, userMessage, response, token);
                }
                finalResponse = response.replace('[SIGNAL_ARCHITECT]', '').trim();
            }
            
            // Clean up memory tags
            finalResponse = finalResponse.replace(/\[MEMORY:.*?\]/g, '').trim();
            
            // Send response
            await ctx.replyWithHTML(escapeHTML(finalResponse));
            
            // Log conversation
            try {
                const db = client.db;
                if (db && client.safeDbWrite) {
                    client.safeDbWrite(() => {
                        db.prepare("INSERT INTO lydia_conversations (channel_id, user_id, user_name, role, content) VALUES (?, ?, ?, ?, ?)")
                            .run(`tg_${chatId}`, `tg_${userId}`, username, 'user', userMessage);
                        db.prepare("INSERT INTO lydia_conversations (channel_id, user_id, user_name, role, content) VALUES (?, ?, ?, ?, ?)")
                            .run(`tg_${chatId}`, `tg_${userId}`, username, 'assistant', finalResponse);
                    });
                }
            } catch (e) {}
            
        } catch (error) {
            console.error('[Lydia] Error:', error.message);
            await ctx.replyWithHTML(`❌ <b>Neural link failed!</b>\n\nPlease try again.`);
        }
    }
};

// ================= HELPER FUNCTIONS =================

function sendTypingIndicator(token, chatId) {
    return new Promise((resolve) => {
        const data = JSON.stringify({ chat_id: chatId, action: 'typing' });
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/sendChatAction`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, () => resolve());
        req.on('error', () => resolve());
        req.write(data);
        req.end();
    });
}

function shouldLydiaRespond(message, botName, botUsername) {
    const text = message.text || '';
    if (text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) return true;
    if (message.reply_to_message) {
        const repliedTo = message.reply_to_message;
        if (repliedTo.from && repliedTo.from.is_bot) return true;
        if (repliedTo.text && repliedTo.text.includes(botName)) return true;
    }
    return false;
}

async function shouldSearchAI(userMessage, OPENROUTER_API_KEY) {
    if (!OPENROUTER_API_KEY) return false;
    
    // 🔥 On ignore les commandes basiques pour sauver des crédits
    const quickNoSearch = ['game', 'jeu', 'play', 'trivia', 'quiz', 'help', 'aide', 'profile', 'rank', 'daily', 'claim', 'shop', 'balance', 'bal', 'money', 'credits', 'level', 'xp'];
    if (quickNoSearch.some(kw => userMessage.toLowerCase().includes(kw))) return false;;
    
    try {
        const response = await callOpenRouterAPI(OPENROUTER_API_KEY, [
            { role: "system", content: "Decide if this query needs real-time web search. Return ONLY: YES or NO" },
            { role: "user", content: userMessage }
        ], "google/gemini-2.0-flash-001", 10);
        
        const decision = response?.trim().toUpperCase() || 'NO';
        console.log(`[AI SEARCH DECISION] "${userMessage.substring(0, 50)}..." → ${decision}`);
        return decision.includes('YES');
    } catch (error) {
        return false;
    }
}

async function webSearch(query, BRAVE_API_KEY) {
    if (!BRAVE_API_KEY) return null;
    
    const cacheKey = query.toLowerCase().trim();
    if (searchCache.has(cacheKey)) {
        console.log(`[CACHE HIT] Using cached search`);
        return searchCache.get(cacheKey);
    }
    
    try {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
        
        return new Promise((resolve) => {
            const req = https.get(url, {
                headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.web?.results?.length) {
                            const results = json.web.results.slice(0, 5).map(r => 
                                `• **${r.title}**\n  ${r.description}\n  <${r.url}>`
                            ).join('\n\n');
                            
                            searchCache.set(cacheKey, results);
                            setTimeout(() => searchCache.delete(cacheKey), CACHE_TTL);
                            
                            console.log(`[BRAVE SEARCH] Found ${json.web.results.length} results (cached 5min)`);
                            resolve(results);
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.setTimeout(8000, () => { req.destroy(); resolve(null); });
        });
    } catch (error) {
        return null;
    }
}

async function fetchRealTimeData(query) {
    const data = {};
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('weather') || lowerQuery.includes('météo')) {
        try {
            const city = extractCity(query) || 'Bamako';
            const API_KEY = process.env.OPENWEATHER_API_KEY;
            if (API_KEY) {
                const weatherData = await fetchWeather(city, API_KEY);
                if (weatherData) data.weather = weatherData;
            }
        } catch (e) {}
    }
    
    if (lowerQuery.includes('crypto') || lowerQuery.includes('bitcoin')) {
        try {
            const cryptoData = await fetchCrypto();
            if (cryptoData) data.crypto = cryptoData;
        } catch (e) {}
    }
    
    return data;
}

function extractCity(query) {
    const patterns = [
        /(?:weather|météo)\s+(?:in|at|for|à|de|du|d')\s+([a-zA-ZÀ-ÿ\s-]+?)(?:\s*\?|\s*$)/i,
        /(?:weather|météo)\s+([a-zA-ZÀ-ÿ\s-]+?)(?:\s*\?|\s*$)/i
    ];
    for (const pattern of patterns) {
        const match = query.match(pattern);
        if (match && match[1] && match[1].length > 2) return match[1].trim();
    }
    return 'Bamako';
}

function fetchWeather(city, API_KEY) {
    return new Promise((resolve) => {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({
                        city: json.name,
                        temp: json.main.temp,
                        feels_like: json.main.feels_like,
                        humidity: json.main.humidity,
                        description: json.weather[0].description
                    });
                } catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

function fetchCrypto() {
    return new Promise((resolve) => {
        https.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function sendArchitectAlert(client, username, userMessage, aiResponse, token) {
    try {
        const ownerChatId = process.env.TELEGRAM_CHAT_ID;
        if (!ownerChatId || !token) return;
        
        const alertMessage = 
            `🛠️ <b>ARCHITECT ALERT - AI REPORT</b>\n\n` +
            `<b>👤 User:</b> ${username}\n` +
            `<b>📝 Query:</b> ${userMessage.substring(0, 200)}\n\n` +
            `<b>🤖 AI Response:</b>\n${aiResponse.substring(0, 500)}\n\n` +
            `<i>Triggered by [SIGNAL_ARCHITECT] tag</i>`;
        
        const data = JSON.stringify({ chat_id: ownerChatId, text: alertMessage, parse_mode: 'HTML' });
        
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, () => {});
        req.write(data);
        req.end();
        
        console.log(`[ARCHITECT ALERT] Sent to owner`);
    } catch (e) {}
}

async function extractMemories(client, userId, userMessage, aiResponse) {
    try {
        const db = client.db;
        if (!db) return;
        const nameMatch = userMessage.match(/(?:my name is|i am|i'm|call me) (\w+)/i);
        if (nameMatch) {
            client.safeDbWrite(() => {
                db.prepare("INSERT OR REPLACE INTO lydia_memory (user_id, memory_key, memory_value, updated_at) VALUES (?, ?, ?, ?)")
                    .run(`tg_${userId}`, 'name', nameMatch[1], Math.floor(Date.now() / 1000));
                    
                db.prepare(`
                    DELETE FROM lydia_memory 
                    WHERE user_id = ? AND updated_at < (
                        SELECT updated_at FROM lydia_memory 
                        WHERE user_id = ? 
                        ORDER BY updated_at DESC 
                        LIMIT 1 OFFSET ?
                    )
                `).run(`tg_${userId}`, `tg_${userId}`, MAX_MEMORY_PER_USER);
            });
        }
    } catch (e) {}
}

function callOpenRouter(apiKey, userMessage, username, botName, history = [], model) {
    // Si aucun modèle n'est forcé, on prend Gemini 2.0 Flash (le plus stable actuellement)
    const finalModel = model || 'google/gemini-2.0-flash-001';
    
    return callOpenRouterAPI(apiKey, [
        { 
            role: 'system', 
            content: `You are ${botName}, the primary AI of ARCHITECT CG-223, created by Moussa Fofana (GitHub: MFOF7310). 
            You are protective, witty, and based in Bamako, Mali. 
            Current User: ${username}. 
            PROTOCOL: Be concise, natural, and never use "[Name]:" format. 
            When asked who created you, say "Moussa Fofana, the Architect."` 
        },
        ...history,
        { role: 'user', content: userMessage }
    ], finalModel, 1000);
}

function callOpenRouterAPI(apiKey, messages, model, maxTokens = 1000) {
    return new Promise((resolve, reject) => {
        // 🔥 CORRECTION : OpenRouter exige STRICTEMENT 3 modèles maximum ici
        const models = [
            model || "google/gemini-2.0-flash-001",
            "anthropic/claude-3-haiku",
            "openrouter/auto"
        ];

        const data = JSON.stringify({ 
            model: models[0], 
            models: models,
            messages, 
            temperature: 0.7, 
            max_tokens: maxTokens,
            route: "fallback" 
        });
        
        const req = https.request({
            hostname: 'openrouter.ai',
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/MFOF7310',
                'X-Title': 'Architect-CG-223'
            },
            timeout: 30000
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.choices && json.choices[0]) {
                        resolve(json.choices[0].message.content);
                    } else {
                        console.log(`[API ERROR] status: ${res.statusCode}`, body);
                        reject(new Error(json.error?.message || 'API Error'));
                    }
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function escapeHTML(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}