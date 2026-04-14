// ================= TELEGRAM BOT LISTENER v1.7.0 =================
const https = require('https');
const fs = require('fs');
const path = require('path');

const green = "\x1b[32m", yellow = "\x1b[33m", cyan = "\x1b[36m", red = "\x1b[31m", reset = "\x1b[0m";

// ================= SAFE HTML ESCAPE FUNCTION =================
function escapeHTML(text) {
    if (!text || typeof text !== 'string') return "";
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

//================= Store registered commands =================
const telegramCommands = new Map();
const lydiaActiveChats = new Set();

//================= Register a command =================
function registerCommand(name, handler, aliases = []) {
    telegramCommands.set(name.toLowerCase(), { handler, aliases });
    aliases.forEach(alias => telegramCommands.set(alias.toLowerCase(), { handler, aliases: [] }));
}

//================= Send message to Telegram =================
function sendTelegramMessage(token, chatId, text, options = {}) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            chat_id: chatId,
            text: options.parse_mode === 'HTML' ? text : escapeHTML(text),
            parse_mode: options.parse_mode || 'HTML',
            disable_web_page_preview: options.disable_preview || false
        });
        
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve(json);
                } catch (e) {
                    resolve({ ok: false, error: 'Invalid response' });
                }
            });
        });
        
        req.on('error', (err) => {
            resolve({ ok: false, error: err.message });
        });
        
        req.write(data);
        req.end();
    });
}

//================= Send typing indicator to Telegram =================
function sendTypingIndicator(token, chatId) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            chat_id: chatId,
            action: 'typing'
        });
        
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/sendChatAction`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            resolve();
        });
        
        req.on('error', () => resolve());
        req.write(data);
        req.end();
    });
}

//======= Send a message that shows "typing..." =======
async function sendLiveMessage(token, chatId, initialText, finalText, typingDelay = 1500) {
    await sendTypingIndicator(token, chatId);
    
    const initialMsg = await sendTelegramMessage(token, chatId, escapeHTML(initialText));
    if (!initialMsg.ok) return initialMsg;
    
    await new Promise(resolve => setTimeout(resolve, typingDelay));
    
    const messageId = initialMsg.result.message_id;
    
    return new Promise((resolve) => {
        const data = JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: finalText,
            parse_mode: 'HTML'
        });
        
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/editMessageText`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ ok: false });
                }
            });
        });
        
        req.on('error', (err) => resolve({ ok: false, error: err.message }));
        req.write(data);
        req.end();
    });
}

//================= Send boot notification to owner =================
async function sendBootNotification(client, token) {
    const ownerChatId = process.env.TELEGRAM_CHAT_ID;
    if (!ownerChatId || !token) return;
    
    const version = client.version || '1.7.0';
    const guilds = client.guilds?.cache?.size || 0;
    const users = client.guilds?.cache?.reduce((acc, g) => acc + g.memberCount, 0) || 0;
    const commands = client.commands?.size || 0;
    
    const bootMessage = 
`╔══════════════════════════════════╗
║   🦅 ARCHITECT CG-223 ONLINE 🦅   ║
╚══════════════════════════════════╝

✅ <b>Neural Engine Boot Complete</b>

<b>📊 SYSTEM STATUS</b>
• 🟢 State: <b>ACTIVE / ONLINE</b>
• ⚡ Engine: Architect-CG-223
• 📍 Node: BAMAKO_223 🇲🇱
• 📦 Version: v${version}

<b>📡 CONNECTION STATS</b>
• 🤖 Discord: ${guilds} servers | ${users} users
• 💬 Commands: ${commands} loaded
• 🧠 Lydia: Multi-Agent AI
• 🌉 Telegram Bridge: ACTIVE

<b>⏰ BOOT TIME</b>
• <code>${new Date().toLocaleString()}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Digital Sovereignty • Bamako Node</i>
👨‍💻 <b>Architect:</b> @mfof7310`;

    await sendTelegramMessage(token, ownerChatId, bootMessage);
}

//================= Start polling for messages =================
function startPolling(client, token) {
    let lastUpdateId = 0;
    
    const poll = async () => {
        try {
            const url = `/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
            const req = https.request({
                hostname: 'api.telegram.org',
                path: url,
                method: 'GET'
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', async () => {
                    try {
                        const json = JSON.parse(body);
                        if (json.ok && json.result.length > 0) {
                            for (const update of json.result) {
                                lastUpdateId = update.update_id;
                                await handleUpdate(client, token, update);
                            }
                        }
                    } catch (e) {
                        //======= Silent fail - malformed JSON =======
                    }
                    setTimeout(poll, 1000);
                });
            });
            
            req.on('error', () => {
                setTimeout(poll, 5000);
            });
            
            req.end();
        } catch (e) {
            setTimeout(poll, 5000);
        }
    };
    
    poll();
    console.log(`${green}[TELEGRAM]${reset} Polling started`);
}

//================= Handle incoming Telegram messages =================
async function handleUpdate(client, token, update) {
    const message = update.message;
    if (!message || !message.text) return;
    
    const chatId = message.chat.id;
    const text = message.text;
    const userId = message.from.id;
    const username = message.from.first_name || 'User';
    
    //================= Build context with reply helper =================
    const context = { 
        client, 
        token, 
        chatId, 
        userId, 
        username, 
        args: [], 
        message,
        lydiaActiveChats,
        replyWithHTML: (text) => sendTelegramMessage(token, chatId, text, { parse_mode: 'HTML' }),
        reply: (text) => sendTelegramMessage(token, chatId, escapeHTML(text)),
        replyLive: (initial, final, delay) => sendLiveMessage(token, chatId, escapeHTML(initial), final, delay)
    };

    // ================= TRIVIA ANSWER HANDLER =================
    try {
        const triviaPlugin = require('./plugins/trivia.js');
        const activeGames = triviaPlugin.activeGames || new Map();
        
        if (activeGames.has(chatId.toString())) {
            const game = activeGames.get(chatId.toString());
            const answer = text.trim().toUpperCase();
            
            if (['A', 'B', 'C', 'D'].includes(answer)) {
                const answerIndex = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[answer];
                const isCorrect = answerIndex === game.correct;
                
                clearTimeout(game.timeout);
                activeGames.delete(chatId.toString());
                
                if (isCorrect) {
                    await sendTelegramMessage(token, chatId, 
                        `✅ <b>CORRECT!</b> ${escapeHTML(username)}!\n\n` +
                        `The answer is <b>${escapeHTML(game.question.a[game.correct])}</b>.\n` +
                        `🎉 +50 XP and +25 🪙 awarded!`
                    );
                } else {
                    await sendTelegramMessage(token, chatId, 
                        `❌ <b>INCORRECT!</b>\n\n` +
                        `The correct answer was <b>${escapeHTML(game.question.a[game.correct])}</b>.\n` +
                        `Better luck next time, ${escapeHTML(username)}!`
                    );
                }
                return;
            }
        }
    } catch (e) {
        //======= Trivia plugin might not exist yet - silent fail =======
    }
    
    // Check for Lydia auto-response (if enabled for this chat)
    if (lydiaActiveChats.has(chatId.toString()) && !text.startsWith('/')) {
        try {
            const lydiaPlugin = require('./plugins/lydia.js');
            const handler = lydiaPlugin.handler || lydiaPlugin.run;
            if (handler) {
                context.args = [text];
                await handler(context);
            }
            console.log(`${cyan}[TG-LYDIA]${reset} ${username}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`);
        } catch (e) {
            console.error(`${red}[TG-LYDIA]${reset} Error:`, e.message);
        }
        return;
    }
    
    //================= Handle commands (start with /) =================
    if (text.startsWith('/')) {
        const parts = text.slice(1).split(' ');
        const cmdName = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        context.args = args;
        
        const cmd = telegramCommands.get(cmdName);
        if (cmd) {
            try {
                const handler = cmd.handler.handler || cmd.handler.run || cmd.handler;
                if (typeof handler === 'function') {
                    await handler(context);
                } else {
                    await cmd.handler(context);
                }
                console.log(`${cyan}[TG-CMD]${reset} ${username}: /${cmdName} ${args.join(' ').substring(0, 30)}`);
            } catch (e) {
                await sendTelegramMessage(token, chatId, `❌ Error: ${escapeHTML(e.message)}`);
                console.log(`${red}[TG-ERROR]${reset} ${cmdName}: ${e.message}`);
            }
        } else {
            console.log(`${yellow}[TG-UNKNOWN]${reset} ${username}: /${cmdName}`);
        }
    } else {
        console.log(`${cyan}[TG-MSG]${reset} ${username}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    }
}

//================= Initialize the bot =================
function initializeTelegramBot(client) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const version = client.version || '1.7.0';
    
    if (!token) {
        console.log(`${yellow}[TELEGRAM BOT]${reset} No token - bot listener disabled`);
        return;
    }
    
    //================= Load command plugins =================
    const pluginsPath = path.join(__dirname, 'plugins');

    // =================🔥 Files to EXCLUDE from command loading (utility modules, not commands) =================
    const excludeFiles = ['bridge.js', 'bot.js', 'market-manager.js', 'test.js'];

    if (!fs.existsSync(pluginsPath)) {
        fs.mkdirSync(pluginsPath, { recursive: true });
        console.log(`${yellow}[TELEGRAM BOT]${reset} Created plugins folder - add command files`);
    }

    if (fs.existsSync(pluginsPath)) {
        const files = fs.readdirSync(pluginsPath).filter(f => 
            f.endsWith('.js') && !excludeFiles.includes(f)
        );
        
        if (files.length === 0) {
            console.log(`${yellow}[TELEGRAM BOT]${reset} No plugins found in /telegram/plugins`);
        }
        
        for (const file of files) {
            try {
                const pluginPath = path.join(pluginsPath, file);
                delete require.cache[require.resolve(pluginPath)];
                const plugin = require(pluginPath);
                
                const handler = plugin.handler || plugin.run;
                
                if (plugin.name && handler) {
                    registerCommand(plugin.name, handler, plugin.aliases || []);
                    console.log(`${green}[TG-PLUGIN]${reset} Loaded: /${plugin.name} ${plugin.aliases?.length ? `(${plugin.aliases.join(', ')})` : ''}`);
                } else {
                    console.log(`${yellow}[TG-PLUGIN]${reset} Skipped ${file}: missing name or handler/run`);
                }
            } catch (e) {
                console.log(`${red}[TG-PLUGIN]${reset} Failed to load ${file}: ${e.message}`);
            }
        }
    }
    
    //================= Restore Lydia active chats from database =================
    try {
        const db = client.db;
        if (db) {
            const activeChats = db.prepare("SELECT channel_id FROM lydia_agents WHERE is_active = 1 AND channel_id LIKE 'tg_%'").all();
            activeChats.forEach(row => {
                const chatId = row.channel_id.replace('tg_', '');
                lydiaActiveChats.add(chatId);
            });
            if (activeChats.length > 0) {
                console.log(`${green}[TG-LYDIA]${reset} Restored ${activeChats.length} active Lydia chats`);
            }
        }
    } catch (e) {
        //================= Silent fail - table might not exist yet =================
    }
    
    startPolling(client, token);
    
    //================= Send boot notification to owner =================
    sendBootNotification(client, token).catch(() => {});
    
    console.log(`${green}[TELEGRAM BOT]${reset} Listener started - ${telegramCommands.size} commands loaded - v${version} - BAMAKO_223 🇲🇱`);
}

//================= 🔥 Export functions =================
module.exports = { 
    initialize: initializeTelegramBot,
    initializeTelegramBot,
    registerCommand,
    sendTelegramMessage,
    sendTypingIndicator,
    sendLiveMessage,
    lydiaActiveChats
};