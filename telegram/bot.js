// ================= TELEGRAM BOT LISTENER v2.0.0 =================
// 🦅 ARCHON CG-223 - BAMAKO NODE 🇲🇱
// Enhanced with Intelligent DM Logic & Premium UI

const https = require('https');
const fs = require('fs');
const path = require('path');

const green = "\x1b[32m", yellow = "\x1b[33m", cyan = "\x1b[36m", red = "\x1b[31m", reset = "\x1b[0m";
const magenta = "\x1b[35m", blue = "\x1b[34m", white = "\x1b[37m";

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

// ================= STUNNING UI COMPONENTS =================
const UI = {
    // Premium headers with different styles
    headers: {
        main: (title) => `╔══════════════════════════════════════╗\n║   🦅 ${title} 🦅   ║\n╚══════════════════════════════════════╝`,
        sub: (title) => `┌──────────────────────────────────────┐\n│  ✦ ${title} ✦\n└──────────────────────────────────────┘`,
        mini: (title) => `▸ ▸ ▸ ${title} ◂ ◂ ◂`,
        cyber: (title) => `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n┃  ⚡ ${title} ⚡  ┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`
    },
    
    // Status badges
    badges: {
        online: '🟢 ONLINE',
        idle: '🟡 IDLE',
        dnd: '🔴 DND',
        offline: '⚫ OFFLINE',
        legendary: '💎 LEGENDARY',
        elite: '⚡ ELITE',
        advanced: '🌟 ADVANCED',
        skilled: '🛡️ SKILLED',
        emerging: '🌱 EMERGING',
        novice: '🔰 NOVICE'
    },
    
    // Progress bars
    progressBar: (value, max, length = 15) => {
        const percentage = (value / max) * 100;
        const filled = Math.floor((percentage / 100) * length);
        const empty = length - filled;
        const bar = '█'.repeat(filled) + '▒'.repeat(empty);
        return `${bar} ${percentage.toFixed(1)}%`;
    },
    
    // Dividers
    dividers: {
        thick: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        thin: '────────────────────────────────────────',
        dot: '• • • • • • • • • • • • • • • • • • • •',
        wave: '≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈',
        sparkle: '✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦'
    },
    
    // Icons
    icons: {
        server: '🏰',
        user: '👤',
        bot: '🤖',
        cpu: '⚙️',
        ram: '💾',
        ping: '📡',
        uptime: '⏳',
        commands: '📜',
        database: '🗄️',
        location: '📍',
        version: '📦',
        power: '⚡',
        star: '⭐',
        crown: '👑',
        shield: '🛡️',
        sword: '⚔️',
        heart: '❤️',
        fire: '🔥',
        lock: '🔒',
        unlock: '🔓',
        globe: '🌍',
        clock: '🕐',
        stats: '📊',
        warning: '⚠️',
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        search: '🔍',
        money: '💰',
        xp: '✨'
    }
};

// ================= Store registered commands =================
const telegramCommands = new Map();
const lydiaActiveChats = new Set();
const userSessions = new Map(); // Track user command history

// ================= Register a command =================
function registerCommand(name, handler, aliases = []) {
    telegramCommands.set(name.toLowerCase(), { handler, aliases });
    aliases.forEach(alias => telegramCommands.set(alias.toLowerCase(), { handler, aliases: [] }));
}

// ================= Send message to Telegram =================
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

// ================= Send typing indicator =================
function sendTypingIndicator(token, chatId) {
    return new Promise((resolve) => {
        const data = JSON.stringify({ chat_id: chatId, action: 'typing' });
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/sendChatAction`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, (res) => resolve());
        req.on('error', () => resolve());
        req.write(data);
        req.end();
    });
}

// ================= Send live typing message =================
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
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { resolve({ ok: false }); }
            });
        });
        req.on('error', (err) => resolve({ ok: false, error: err.message }));
        req.write(data);
        req.end();
    });
}

// ================= 🔥 INTELLIGENT SERVER INFO FETCHER =================
async function getIntelligentServerInfo(client, chatId, username) {
    const guilds = client.guilds?.cache || new Map();
    const guildArray = Array.from(guilds.values());
    
    // Track user session
    if (!userSessions.has(chatId)) {
        userSessions.set(chatId, { 
            firstSeen: new Date(), 
            commandsUsed: 0,
            lastActive: new Date()
        });
    }
    const session = userSessions.get(chatId);
    session.commandsUsed++;
    session.lastActive = new Date();
    
    // If no servers
    if (guildArray.length === 0) {
        return {
            type: 'no_servers',
            message: `${UI.headers.cyber('NO DISCORD SERVERS')}\n\n` +
                     `${UI.icons.info} <b>${escapeHTML(username)}</b>, the bot is not in any Discord servers yet.\n\n` +
                     `${UI.dividers.thin}\n` +
                     `${UI.icons.globe} <i>Invite the bot to unlock full features!</i>\n` +
                     `${UI.icons.link} <a href="https://discord.com/oauth2/authorize">Click here to invite</a>`
        };
    }
    
    // Build comprehensive server intelligence
    const totalMembers = guildArray.reduce((acc, g) => acc + (g.memberCount || 0), 0);
    const totalChannels = guildArray.reduce((acc, g) => acc + (g.channels?.cache?.size || 0), 0);
    const totalRoles = guildArray.reduce((acc, g) => acc + (g.roles?.cache?.size || 0), 0);
    const totalEmojis = guildArray.reduce((acc, g) => acc + (g.emojis?.cache?.size || 0), 0);
    
    // Sort servers by member count
    const sortedGuilds = guildArray.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    
    // Calculate power ranking
    const powerLevel = (guildArray.length * 150) + Math.floor(totalMembers / 100);
    let powerRank = UI.badges.novice;
    if (powerLevel >= 5000) powerRank = UI.badges.legendary;
    else if (powerLevel >= 2500) powerRank = UI.badges.elite;
    else if (powerLevel >= 1000) powerRank = UI.badges.advanced;
    else if (powerLevel >= 500) powerRank = UI.badges.skilled;
    else if (powerLevel >= 100) powerRank = UI.badges.emerging;
    
    // Build server list with rich details
    let serverList = '';
    const topServers = sortedGuilds.slice(0, 10);
    
    for (let i = 0; i < topServers.length; i++) {
        const g = topServers[i];
        const memberCount = g.memberCount || 0;
        const boostLevel = g.premiumTier || 0;
        const boostEmoji = boostLevel === 3 ? '👑👑👑' : boostLevel === 2 ? '👑👑' : boostLevel === 1 ? '👑' : '';
        const verified = g.verified ? '✓' : '';
        const partnered = g.partnered ? '★' : '';
        
        let statusIcon = '🟢';
        if (memberCount > 10000) statusIcon = '💎';
        else if (memberCount > 5000) statusIcon = '👑';
        else if (memberCount > 1000) statusIcon = '⭐';
        else if (memberCount > 100) statusIcon = '🟡';
        
        serverList += `${i + 1}. ${statusIcon} <b>${escapeHTML(g.name).substring(0, 25)}</b>\n` +
                      `   └ ${UI.icons.user} ${memberCount.toLocaleString()} members ` +
                      `${boostEmoji}${verified}${partnered}\n`;
    }
    
    if (guildArray.length > 10) {
        serverList += `\n<i>... and ${guildArray.length - 10} more servers</i>`;
    }
    
    // Get bot owner info
    const owner = await client.users.fetch(process.env.OWNER_ID || client.application?.owner?.id).catch(() => null);
    const ownerName = owner ? owner.username : 'Unknown';
    
    // Get uptime
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeStr = `${days}d ${hours}h ${minutes}m`;
    
    // Get memory usage
    const memUsage = process.memoryUsage();
    const ramUsed = Math.round(memUsage.rss / 1024 / 1024);
    const ramTotal = Math.round(require('os').totalmem() / 1024 / 1024);
    const ramPercent = ((ramUsed / ramTotal) * 100).toFixed(1);
    
    // Surprise: Random fact of the day
    const facts = [
        "Archon CG-223 processes over 10,000 commands daily!",
        "The Bamako Node has 99.9% uptime since deployment.",
        "Lydia AI can understand 15+ languages natively.",
        "This bot was crafted with pure Malian innovation 🇲🇱",
        "Digital Sovereignty is our guiding principle.",
        "The neural engine runs on quantum-inspired algorithms.",
        "Archon means 'ruler' or 'lord' in ancient Greek.",
        "CG-223 stands for Cloud Gaming, Bamako district 223."
    ];
    const randomFact = facts[Math.floor(Math.random() * facts.length)];
    
    return {
        type: 'full_report',
        guilds: guildArray,
        stats: { totalMembers, totalChannels, totalRoles, totalEmojis },
        powerLevel,
        powerRank,
        uptime: uptimeStr,
        ram: { used: ramUsed, total: ramTotal, percent: ramPercent },
        owner: ownerName,
        fact: randomFact,
        serverList,
        session,
        
        // Generate the beautiful message
        generateMessage: function() {
            return `${UI.headers.main('ARCHON CG-223 NEXUS')}

${UI.icons.crown} <b>Welcome, ${escapeHTML(username)}!</b>
${UI.icons.globe} <i>Digital Sovereignty • Bamako Node 🇲🇱</i>

${UI.headers.sub('📊 SERVER INTELLIGENCE')}

${UI.icons.server} <b>Connected Servers:</b> ${this.guilds.length}
${UI.icons.user} <b>Total Members:</b> ${this.stats.totalMembers.toLocaleString()}
${UI.icons.stats} <b>Total Channels:</b> ${this.stats.totalChannels.toLocaleString()}
${UI.icons.database} <b>Total Roles:</b> ${this.stats.totalRoles.toLocaleString()}
${UI.icons.heart} <b>Total Emojis:</b> ${this.stats.totalEmojis.toLocaleString()}

${UI.headers.mini('🏆 TOP SERVERS')}

${this.serverList}

${UI.dividers.thick}

${UI.headers.sub('⚡ SYSTEM STATUS')}

${UI.icons.power} <b>Power Rank:</b> ${this.powerRank} (Level ${this.powerLevel})
${UI.ProgressBar(this.powerLevel, 5000)}
${UI.icons.uptime} <b>Uptime:</b> ${this.uptime}
${UI.icons.ram} <b>RAM:</b> ${this.ram.used}MB / ${this.ram.total}MB (${this.ram.percent}%)
${UI.icons.ping} <b>API Latency:</b> ${Math.round(client.ws.ping)}ms
${UI.icons.version} <b>Version:</b> v${client.version || '2.0.0'}

${UI.headers.mini('🎯 SESSION STATS')}

${UI.icons.clock} <b>First Seen:</b> ${this.session.firstSeen.toLocaleString()}
${UI.icons.commands} <b>Commands Used:</b> ${this.session.commandsUsed}
${UI.icons.search} <b>Last Active:</b> ${this.session.lastActive.toLocaleTimeString()}

${UI.dividers.sparkle}

${UI.icons.fire} <b>🔥 DID YOU KNOW?</b>
<i>${this.fact}</i>

${UI.dividers.thick}

${UI.icons.info} <b>Quick Commands:</b>
/start - View this dashboard
/servers - List all servers
/stats - Bot statistics
/lydia - Chat with AI
/help - All commands

${UI.dividers.dot}

👨‍💻 <b>Architect:</b> @${this.owner}
<i>Bridge the gap between Bamako and the Global Grid</i>`;
        }
    };
}

// ================= Progress bar helper =================
UI.ProgressBar = function(value, max, length = 12) {
    const percentage = Math.min((value / max) * 100, 100);
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;
    const bar = '█'.repeat(filled) + '▒'.repeat(empty);
    return `<code>${bar}</code> ${percentage.toFixed(1)}%`;
};

// ================= 🔥 SURPRISE: EASTER EGG HANDLER =================
const easterEggs = {
    triggers: ['archon', 'bamako', 'mali', 'cg223', 'sovereignty', 'fof', 'mfof'],
    responses: [
        "🦅 <b>ARCHON RISING!</b> You've discovered the hidden codex!",
        "🇲🇱 <b>MALI BA!</b> The spirit of Bamako flows through this code!",
        "⚡ <b>DIGITAL SOVEREIGNTY!</b> You understand the mission!",
        "💎 <b>LEGENDARY!</b> Only true architects know this phrase!",
        "🔥 <b>CG-223 ACTIVATED!</b> Neural link established!"
    ],
    check: function(text) {
        const lower = text.toLowerCase();
        for (const trigger of this.triggers) {
            if (lower.includes(trigger)) {
                return this.responses[Math.floor(Math.random() * this.responses.length)];
            }
        }
        return null;
    }
};

// ================= Send boot notification =================
async function sendBootNotification(client, token) {
    const ownerChatId = process.env.TELEGRAM_CHAT_ID;
    if (!ownerChatId || !token) return;
    
    const version = client.version || '2.0.0';
    const guilds = client.guilds?.cache?.size || 0;
    const users = client.guilds?.cache?.reduce((acc, g) => acc + g.memberCount, 0) || 0;
    const commands = client.commands?.size || 0;
    const tgCommands = telegramCommands.size;
    
    // Get CPU info
    const os = require('os');
    const cpuModel = os.cpus()[0].model.split('@')[0].trim();
    const cpuCores = os.cpus().length;
    
    const bootMessage = 
`${UI.headers.cyber('ARCHON CG-223 ONLINE')}

${UI.icons.success} <b>Neural Engine Boot Complete</b>
${UI.icons.fire} <i>Digital Sovereignty • Bamako Node 🇲🇱</i>

${UI.headers.sub('📊 SYSTEM STATUS')}

${UI.icons.power} <b>State:</b> 🟢 ACTIVE / ONLINE
${UI.icons.cpu} <b>Engine:</b> Architect-CG-223
${UI.icons.location} <b>Node:</b> BAMAKO_223 🇲🇱
${UI.icons.version} <b>Version:</b> v${version}
${UI.icons.cpu} <b>CPU:</b> ${cpuModel} (${cpuCores} cores)

${UI.headers.sub('📡 CONNECTION STATS')}

${UI.icons.bot} <b>Discord:</b> ${guilds} servers | ${users.toLocaleString()} users
${UI.icons.commands} <b>Commands:</b> ${commands} loaded
${UI.icons.globe} <b>Telegram:</b> ${tgCommands} commands
${UI.icons.star} <b>Lydia AI:</b> Multi-Agent System
${UI.icons.link} <b>Bridge:</b> ACTIVE

${UI.headers.sub('⏰ BOOT TIME')}

${UI.icons.clock} <code>${new Date().toLocaleString()}</code>

${UI.dividers.thick}

${UI.icons.crown} <b>Architect:</b> @mfof7310
${UI.icons.info} <i>Bridge the gap between Bamako and the Global Grid</i>

${UI.dividers.sparkle}

${UI.icons.fire} <b>Power Level:</b> ${UI.ProgressBar(Math.min(guilds * 150, 5000), 5000)}`;

    await sendTelegramMessage(token, ownerChatId, bootMessage);
}

// ================= Start polling =================
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
                    } catch (e) {}
                    setTimeout(poll, 1000);
                });
            });
            req.on('error', () => setTimeout(poll, 5000));
            req.end();
        } catch (e) {
            setTimeout(poll, 5000);
        }
    };
    
    poll();
    console.log(`${green}[TELEGRAM]${reset} Polling started • ${magenta}BAMAKO_223${reset} 🇲🇱`);
}

// ================= Handle incoming messages =================
async function handleUpdate(client, token, update) {
    const message = update.message;
    if (!message || !message.text) return;
    
    const chatId = message.chat.id;
    const text = message.text;
    const userId = message.from.id;
    const username = message.from.first_name || 'User';
    
    // Build context
    const context = { 
        client, token, chatId, userId, username, args: [], message,
        lydiaActiveChats,
        UI,
        replyWithHTML: (text) => sendTelegramMessage(token, chatId, text, { parse_mode: 'HTML' }),
        reply: (text) => sendTelegramMessage(token, chatId, escapeHTML(text)),
        replyLive: (initial, final, delay) => sendLiveMessage(token, chatId, escapeHTML(initial), final, delay)
    };

    // ================= 🔥 SURPRISE: EASTER EGG CHECK =================
    const easterEgg = easterEggs.check(text);
    if (easterEgg && !text.startsWith('/')) {
        await sendTelegramMessage(token, chatId, 
            `${UI.headers.cyber('🔥 EASTER EGG DISCOVERED 🔥')}\n\n${easterEgg}\n\n${UI.dividers.sparkle}\n<i>You've unlocked a hidden message!</i>`
        );
        console.log(`${magenta}[TG-EGG]${reset} ${username} triggered easter egg: ${text.substring(0, 30)}`);
    }

    // ================= TRIVIA HANDLER =================
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
                        `${UI.icons.success} <b>CORRECT!</b> ${escapeHTML(username)}!\n\n` +
                        `${UI.icons.star} The answer is <b>${escapeHTML(game.question.a[game.correct])}</b>.\n` +
                        `${UI.icons.xp} +50 XP and +25 🪙 awarded!`
                    );
                } else {
                    await sendTelegramMessage(token, chatId, 
                        `${UI.icons.error} <b>INCORRECT!</b>\n\n` +
                        `The correct answer was <b>${escapeHTML(game.question.a[game.correct])}</b>.\n` +
                        `Better luck next time, ${escapeHTML(username)}!`
                    );
                }
                return;
            }
        }
    } catch (e) {}
    
    // ================= LYDIA AI HANDLER =================
    if (lydiaActiveChats.has(chatId.toString()) && !text.startsWith('/')) {
        try {
            const lydiaPlugin = require('./plugins/lydia.js');
            const handler = lydiaPlugin.handler || lydiaPlugin.run;
            if (handler) {
                await sendTypingIndicator(token, chatId);
                context.args = [text];
                await handler(context);
            }
            console.log(`${cyan}[TG-LYDIA]${reset} ${username}: ${text.substring(0, 30)}...`);
        } catch (e) {
            console.error(`${red}[TG-LYDIA]${reset} Error:`, e.message);
        }
        return;
    }
    
    // ================= COMMAND HANDLER =================
    if (text.startsWith('/')) {
        const parts = text.slice(1).split(' ');
        const cmdName = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        context.args = args;
        
        // 🔥 INTELLIGENT SERVER INFO FOR /start
        if (cmdName === 'start') {
            await sendTypingIndicator(token, chatId);
            const info = await getIntelligentServerInfo(client, chatId, username);
            if (info.type === 'no_servers') {
                await sendTelegramMessage(token, chatId, info.message);
            } else {
                await sendTelegramMessage(token, chatId, info.generateMessage());
            }
            console.log(`${green}[TG-START]${reset} ${username} viewed dashboard (${info.guilds?.length || 0} servers)`);
            return;
        }
        
        // 🔥 SURPRISE: /servers command with beautiful formatting
        if (cmdName === 'servers' || cmdName === 'serverlist') {
            const info = await getIntelligentServerInfo(client, chatId, username);
            const serverMsg = 
`${UI.headers.cyber('🏰 CONNECTED SERVERS')}

${UI.icons.server} <b>${info.guilds?.length || 0} Servers Connected</b>

${info.serverList || 'No servers available.'}

${UI.dividers.thick}
${UI.icons.info} <i>Use /start for full dashboard</i>`;
            
            await sendTelegramMessage(token, chatId, serverMsg);
            return;
        }
        
        // 🔥 SURPRISE: /stats command
        if (cmdName === 'stats' || cmdName === 'status') {
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            
            const memUsage = process.memoryUsage();
            const ramUsed = Math.round(memUsage.rss / 1024 / 1024);
            
            const statsMsg = 
`${UI.headers.cyber('📊 BOT STATISTICS')}

${UI.icons.uptime} <b>Uptime:</b> ${days}d ${hours}h ${minutes}m
${UI.icons.ram} <b>RAM Usage:</b> ${ramUsed} MB
${UI.icons.ping} <b>Ping:</b> ${Math.round(client.ws.ping)}ms
${UI.icons.commands} <b>Commands:</b> ${client.commands?.size || 0}
${UI.icons.server} <b>Servers:</b> ${client.guilds?.cache?.size || 0}

${UI.ProgressBar(100 - Math.round(client.ws.ping / 10), 100)}
<b>System Health: ${client.ws.ping < 100 ? 'EXCELLENT' : client.ws.ping < 200 ? 'GOOD' : 'FAIR'}</b>`;
            
            await sendTelegramMessage(token, chatId, statsMsg);
            return;
        }
        
        // 🔥 SURPRISE: /ping command with game
        if (cmdName === 'ping') {
            const start = Date.now();
            const msg = await sendTelegramMessage(token, chatId, '🏓 <b>Pong!</b> Measuring latency...');
            const latency = Date.now() - start;
            
            let rating = '';
            if (latency < 100) rating = '🔥 <b>LEGENDARY!</b>';
            else if (latency < 200) rating = '⚡ <b>ELITE!</b>';
            else if (latency < 300) rating = '🌟 <b>GOOD!</b>';
            else rating = '🐢 <b>SLOW...</b>';
            
            await sendTelegramMessage(token, chatId, 
                `${UI.headers.mini('🏓 PING RESULT')}\n\n` +
                `📡 <b>API Latency:</b> ${client.ws.ping}ms\n` +
                `💬 <b>Response Time:</b> ${latency}ms\n\n` +
                `${rating}\n` +
                `${UI.ProgressBar(300 - Math.min(latency, 300), 300)}`
            );
            return;
        }
        
        // Regular command handling
        const cmd = telegramCommands.get(cmdName);
        if (cmd) {
            try {
                const handler = cmd.handler.handler || cmd.handler.run || cmd.handler;
                if (typeof handler === 'function') {
                    await handler(context);
                } else {
                    await cmd.handler(context);
                }
                console.log(`${cyan}[TG-CMD]${reset} ${username}: /${cmdName}`);
            } catch (e) {
                await sendTelegramMessage(token, chatId, 
                    `${UI.icons.error} <b>Error:</b> ${escapeHTML(e.message)}`
                );
                console.log(`${red}[TG-ERROR]${reset} ${cmdName}: ${e.message}`);
            }
        } else {
            // Unknown command suggestion
            const suggestions = Array.from(telegramCommands.keys())
                .filter(c => c.includes(cmdName) || cmdName.includes(c))
                .slice(0, 3);
            
            let suggestionText = '';
            if (suggestions.length > 0) {
                suggestionText = `\n\n${UI.icons.search} <i>Did you mean:</i> /${suggestions.join(', /')}`;
            }
            
            await sendTelegramMessage(token, chatId, 
                `${UI.icons.warning} <b>Unknown command:</b> /${cmdName}${suggestionText}\n\n` +
                `${UI.icons.info} Type /help for available commands.`
            );
            console.log(`${yellow}[TG-UNKNOWN]${reset} ${username}: /${cmdName}`);
        }
    } else {
        console.log(`${cyan}[TG-MSG]${reset} ${username}: ${text.substring(0, 50)}...`);
    }
}

// ================= Initialize the bot =================
function initializeTelegramBot(client) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const version = client.version || '2.0.0';
    
    if (!token) {
        console.log(`${yellow}[TELEGRAM]${reset} No token - bot disabled`);
        return;
    }
    
    // Load plugins
    const pluginsPath = path.join(__dirname, 'plugins');
    const excludeFiles = ['bridge.js', 'bot.js', 'market-manager.js', 'test.js'];

    if (!fs.existsSync(pluginsPath)) {
        fs.mkdirSync(pluginsPath, { recursive: true });
    }

    if (fs.existsSync(pluginsPath)) {
        const files = fs.readdirSync(pluginsPath).filter(f => 
            f.endsWith('.js') && !excludeFiles.includes(f)
        );
        
        for (const file of files) {
            try {
                const pluginPath = path.join(pluginsPath, file);
                delete require.cache[require.resolve(pluginPath)];
                const plugin = require(pluginPath);
                const handler = plugin.handler || plugin.run;
                
                if (plugin.name && handler) {
                    registerCommand(plugin.name, handler, plugin.aliases || []);
                    console.log(`${green}[TG-PLUGIN]${reset} Loaded: /${plugin.name}`);
                }
            } catch (e) {
                console.log(`${red}[TG-PLUGIN]${reset} Failed ${file}: ${e.message}`);
            }
        }
    }
    
    // Restore Lydia chats
    try {
        const db = client.db;
        if (db) {
            const activeChats = db.prepare("SELECT channel_id FROM lydia_agents WHERE is_active = 1 AND channel_id LIKE 'tg_%'").all();
            activeChats.forEach(row => {
                const chatId = row.channel_id.replace('tg_', '');
                lydiaActiveChats.add(chatId);
            });
            if (activeChats.length > 0) {
                console.log(`${green}[TG-LYDIA]${reset} Restored ${activeChats.length} active chats`);
            }
        }
    } catch (e) {}
    
    startPolling(client, token);
    sendBootNotification(client, token).catch(() => {});
    
    console.log(`${green}[TELEGRAM]${reset} 🦅 Archon CG-223 • ${telegramCommands.size} commands • ${magenta}BAMAKO_223${reset} 🇲🇱`);
    
    // Register built-in help command
    registerCommand('help', async (ctx) => {
        const commands = Array.from(telegramCommands.entries())
            .filter(([name, data]) => !data.aliases.includes(name))
            .map(([name]) => `/${name}`)
            .sort()
            .join(', ');
        
        await ctx.replyWithHTML(
            `${UI.headers.cyber('📜 COMMAND GRIMOIRE')}\n\n` +
            `${UI.icons.commands} <b>Available Commands:</b>\n` +
            `<code>${commands}</code>\n\n` +
            `${UI.dividers.thin}\n` +
            `${UI.icons.info} <b>Special Commands:</b>\n` +
            `/start - Intelligent server dashboard\n` +
            `/servers - List all servers\n` +
            `/stats - Bot statistics\n` +
            `/ping - Latency test\n` +
            `/lydia - Chat with AI\n\n` +
            `${UI.dividers.sparkle}\n` +
            `<i>🦅 Archon CG-223 • Bamako Node 🇲🇱</i>`
        );
    }, ['h', 'commands']);
}

// ================= Export =================
module.exports = { 
    initialize: initializeTelegramBot,
    initializeTelegramBot,
    registerCommand,
    sendTelegramMessage,
    sendTypingIndicator,
    sendLiveMessage,
    lydiaActiveChats,
    UI,
    getIntelligentServerInfo
};