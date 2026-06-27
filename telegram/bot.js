// ═══════════════════════════════════════════
//  ARCHON CG-223 — TELEGRAM BOT ENGINE v3.0
//  Smooth single-message UI with inline editing
// ═══════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const green = "\x1b[32m", yellow = "\x1b[33m", red = "\x1b[31m", cyan = "\x1b[36m", reset = "\x1b[0m";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
const formatUptime = (s) => { const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60); return d>0?`${d}d ${h}h ${m}m`:h>0?`${h}h ${m}m`:`${m}m`; };
const escapeHTML = (t) => !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const healthBar = (v, max, len=10) => { const f = Math.max(1, Math.min(len, Math.floor((v/max)*len))); return '█'.repeat(f) + '▒'.repeat(len-f); };
const randomPick = (arr) => arr[Math.floor(Math.random()*arr.length)];
const levenshtein = (a, b) => { const m=[]; for(let i=0;i<=b.length;i++)m[i]=[i]; for(let j=0;j<=a.length;j++)m[0][j]=j; for(let i=1;i<=b.length;i++)for(let j=1;j<=a.length;j++)m[i][j]=b[i-1]===a[j-1]?m[i-1][j-1]:Math.min(m[i-1][j-1]+1,m[i][j-1]+1,m[i-1][j]+1); return m[b.length][a.length]; };

// ═══════════════════════════════
//  SMOOTH UI — Edit in place
// ═══════════════════════════════

/** Build the welcome menu markup */
function welcomeMarkup() {
    return {
        inline_keyboard: [
            [{ text: '🤖 AI Assistant', callback_data: 'm:ai' }, { text: '🎮 Games', callback_data: 'm:games' }],
            [{ text: '💰 Economy', callback_data: 'm:econ' }, { text: '🛠️ Utility', callback_data: 'm:util' }],
            [{ text: '📋 All Commands', callback_data: 'm:cmds' }, { text: 'ℹ️ About', callback_data: 'm:about' }],
        ]
    };
}

/** Build submenu markup with back button */
function subMarkup(buttons) {
    const kb = [...buttons];
    kb.push([{ text: '🔙 Back', callback_data: 'm:main' }]);
    return { inline_keyboard: kb };
}

/** Edit a message in place — smooth transition */
async function editMsg(bridge, chatId, msgId, text, markup) {
    if (!msgId) return false;
    return new Promise((resolve) => {
        const payload = { chat_id: chatId, message_id: msgId, text: text.substring(0, 4096), parse_mode: 'HTML' };
        if (markup) payload.reply_markup = markup;
        const body = JSON.stringify(payload);
        const req = https.request(
            `https://api.telegram.org/bot${bridge.token}/editMessageText`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 },
            (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d).ok);}catch{resolve(false);} }); }
        );
        req.on('error',()=>resolve(false));
        req.on('timeout',()=>{req.destroy();resolve(false);});
        req.write(body); req.end();
    });
}

/** Acknowledge callback query */
function answerCBQ(bridge, cbqId, text) {
    const body = JSON.stringify({ callback_query_id: cbqId, text, show_alert: false });
    const req = https.request(`https://api.telegram.org/bot${bridge.token}/answerCallbackQuery`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 5000 }, ()=>{});
    req.on('error',()=>{}); req.write(body); req.end();
}

// ═══════════════════════════════
//  WELCOME TEXT BUILDERS
// ═══════════════════════════════

function welcomeText(name) {
    const h = new Date().getHours();
    const greet = h>=5&&h<12?'Good Morning':h>=12&&h<17?'Good Afternoon':'Good Evening';
    return `🦅 <b>ARCHON CG-223</b>
━━━━━━━━━━━━━━━━━━━━━━

<b>${greet}, ${escapeHTML(name)}! 👋</b>

Welcome to <b>Archon CG-223</b> — your multi-purpose command node serving <b>BAMAKO_223 🇲🇱</b> with digital sovereignty.

━━━━━━━━━━━━━━━━━━━━━━
  🤖 <b>AI Assistant</b> · Ask anything
  🎮 <b>Games</b> · Trivia, Word Guess, Dice
  💰 <b>Economy</b> · Credits, Daily, Shop
  🛡️ <b>Moderation</b> · Mute, Purge, Welcome
  🛠️ <b>Utility</b> · Weather, Crypto, Translate
  📺 <b>Media</b> · Video Downloader
  🔗 <b>Bridge</b> · Discord Sync
━━━━━━━━━━━━━━━━━━━━━━

💡 <i>Tap a button below, or type</i> <code>/help</code> <i>for all commands.</i>

· @mfof7310 · BAMAKO_223 🇲🇱 ·`;
}

const PAGES = {
    ai: `🤖 <b>AI ASSISTANT — LYDIA</b>
━━━━━━━━━━━━━━━━━━━━━━

Powered by <b>Gemini 2.0</b> via OpenRouter.

<b>Commands:</b>
  <code>/lydia &lt;msg&gt;</code> — Chat with me
  <code>/lydia on</code> — Auto-reply mode
  <code>/lydia off</code> — Disable auto-reply
  <code>/lydia clear</code> — Reset memory
  <code>/lydia status</code> — View status

I remember 12 messages. Mention "archon", "bamako", or "cg223" for easter eggs!

💡 <i>Just start typing in a group where I'm active!</i>`,

    games: `🎮 <b>GAMES & FUN</b>
━━━━━━━━━━━━━━━━━━━━━━

<b>Commands:</b>
  <code>/trivia</code> — Quiz with button answers 🎯
  <code>/wordguess</code> — Hangman with letter keys 🔤
  <code>/roll 6</code> — Roll dice 🎲
  <code>/flip</code> — Coin flip 🪙
  <code>/leaderboard</code> — Top players 🏆

Earn XP, climb ranks, compete with friends!

💡 <i>All games work in any chat — groups, channels, DMs!</i>`,

    econ: `💰 <b>ECONOMY SYSTEM</b>
━━━━━━━━━━━━━━━━━━━━━━

Welcome to the <b>Bamako Economy</b>!

<b>Commands:</b>
  <code>/daily</code> — Claim daily reward
  <code>/balance</code> — Your credits
  <code>/rank</code> — Level & XP progress
  <code>/profile</code> — Full stats
  <code>/leaderboard</code> — Top players
  <code>/invest</code> — Bamako Market
  <code>/shop</code> — Browse items

🔥 <b>Streaks:</b> 7d = +500 🪙 · 30d = +2000 🪙
🏆 <b>Ranks:</b> 🌱Recruit → 👑Architect`,

    util: `🛠️ <b>UTILITY TOOLS</b>
━━━━━━━━━━━━━━━━━━━━━━

<b>Commands:</b>
  <code>/weather &lt;city&gt;</code> — Weather 🌤️
  <code>/crypto &lt;coin&gt;</code> — Crypto prices 💎
  <code>/translate &lt;text&gt; &lt;lang&gt;</code> — Translator 🌐
  <code>/reminder &lt;time&gt; &lt;text&gt;</code> — Reminder ⏰
  <code>/douyin &lt;url&gt;</code> — Video DL 🎬
  <code>/joke</code> — Random joke 😂

Also: <code>/id</code> · <code>/ping</code> · <code>/alive</code> · <code>/creator</code>`,

    cmds: `📋 <b>ALL COMMANDS</b>
━━━━━━━━━━━━━━━━━━━━━━`,

    about: `🦅 <b>ABOUT ARCHON CG-223</b>
━━━━━━━━━━━━━━━━━━━━━━

<b>Architect:</b> Moussa Fofana
<b>Telegram:</b> @mfof7310
<b>Discord:</b> mfof7559
<b>GitHub:</b> github.com/MFOF7310
<b>Location:</b> Bamako, Mali 🇲🇱

━━━━━━━━━━━━━━━━━━━━━━
  <b>Node</b>     · BAMAKO_223 🇲🇱
  <b>Version</b>  · v3.0.0
  <b>CPU</b>      · ${os.cpus()[0].model.split('@')[0].trim()}
  <b>Cores</b>    · ${os.cpus().length}
  <b>Uptime</b>   · {{UPTIME}}
━━━━━━━━━━━━━━━━━━━━━━

<i>"Digital Sovereignty · BAMAKO_223"</i>`,
};

// ═══════════════════════════════
//  CALLBACK HANDLER — Smooth UI
// ═══════════════════════════════

async function handleCallback(update, bridge, client) {
    const cbq = update.callback_query;
    if (!cbq?.data) return;

    const data = cbq.data;
    const chatId = cbq.message?.chat?.id;
    const msgId = cbq.message?.message_id;
    const userId = cbq.from?.id;
    const name = cbq.from?.first_name || 'User';

    // No-op
    if (data === '_noop') { answerCBQ(bridge, cbq.id); return; }

    // Answer callback immediately to stop loading spinner
    answerCBQ(bridge, cbq.id);

    // Route to game plugins first
    if (data.startsWith('wg_') || data.startsWith('tr_')) {
        const ctx = buildContext(update, bridge, client);
        if (!ctx) return;

        if (data.startsWith('wg_')) {
            try { const wg = require('./plugins/wordguess'); if (wg.handleCallback) await wg.handleCallback(ctx, data); } catch(e){}
            return;
        }
        if (data.startsWith('tr_')) {
            try { const tr = require('./plugins/trivia'); if (tr.handleCallback) await tr.handleCallback(ctx, data); } catch(e){}
            return;
        }
    }

    // Menu navigation — smooth edit in place
    // Route to help/start plugin callbacks
    if (data.startsWith('menu_') || data.startsWith('cmd_') || data.startsWith('start_') || data.startsWith('game_') || data.startsWith('lydia_') || data.startsWith('help_')) {
        const ctx = buildContext(update, bridge, client);
        if (!ctx) return;
        try {
            const help = require('./plugins/help');
            if (help.handleCallback) {
                const handled = await help.handleCallback(ctx, data);
                if (handled) return;
            }
        } catch(e) {}
        try {
            const start = require('./plugins/start');
            if (start.handleCallback) {
                const handled = await start.handleCallback(ctx, data);
                if (handled) return;
            }
        } catch(e) {}
        return;
    }

    if (!data.startsWith('m:')) return;

    const page = data.split(':')[1];

    switch (page) {
        case 'main':
            await editMsg(bridge, chatId, msgId, welcomeText(name), welcomeMarkup());
            break;

        case 'ai':
            await editMsg(bridge, chatId, msgId, PAGES.ai, subMarkup([
                [{ text: '💬 Start Chat', callback_data: '_noop' }, { text: '❓ Ask', callback_data: '_noop' }],
            ]));
            break;

        case 'games':
            await editMsg(bridge, chatId, msgId, PAGES.games, subMarkup([
                [{ text: '🎯 Trivia', callback_data: '_noop' }, { text: '🔤 Word Guess', callback_data: '_noop' }],
                [{ text: '🎲 Roll Dice', callback_data: '_noop' }, { text: '🪙 Coin Flip', callback_data: '_noop' }],
            ]));
            break;

        case 'econ':
            await editMsg(bridge, chatId, msgId, PAGES.econ, subMarkup([
                [{ text: '🎁 Daily', callback_data: '_noop' }, { text: '💰 Balance', callback_data: '_noop' }],
                [{ text: '📊 Rank', callback_data: '_noop' }, { text: '📋 Profile', callback_data: '_noop' }],
            ]));
            break;

        case 'util':
            await editMsg(bridge, chatId, msgId, PAGES.util, subMarkup([
                [{ text: '🌤️ Weather', callback_data: '_noop' }, { text: '💎 Crypto', callback_data: '_noop' }],
                [{ text: '🌐 Translate', callback_data: '_noop' }, { text: '⏰ Reminder', callback_data: '_noop' }],
            ]));
            break;

        case 'cmds': {
            // Build dynamic command list
            const cats = new Map();
            for (const [n, c] of bridge.commands) {
                if (c.hidden) continue;
                if (!cats.has(c.category)) cats.set(c.category, []);
                cats.get(c.category).push(c);
            }
            let txt = PAGES.cmds + '\n\n';
            for (const [cat, cmds] of [...cats.entries()].sort()) {
                txt += `<b>${escapeHTML(cat)}</b>: ${cmds.map(c=>`<code>/${c.name}</code>`).join(' ')}\n\n`;
            }
            txt += '<i>Type /help &lt;command&gt; for details</i>';
            await editMsg(bridge, chatId, msgId, txt, subMarkup([]));
            break;
        }

        case 'about': {
            const txt = PAGES.about.replace('{{UPTIME}}', formatUptime(process.uptime()));
            await editMsg(bridge, chatId, msgId, txt, subMarkup([
                [{ text: '🔗 GitHub', url: 'https://github.com/MFOF7310' }],
            ]));
            break;
        }
    }
}

// ═══════════════════════════════
//  CONTEXT BUILDER
// ═══════════════════════════════

function buildContext(update, bridge, client) {
    const msg = update.message || update.edited_message || update.channel_post || update.callback_query?.message;
    if (!msg) return null;

    const cbq = update.callback_query;
    const chatId = msg.chat?.id;
    const userId = cbq?.from?.id || msg.from?.id;
    const username = msg.from?.first_name || msg.from?.username || 'User';
    const chatType = msg.chat?.type;

    const sessionKey = `${chatId}:${userId}`;
    if (!bridge.userSessions.has(sessionKey)) {
        bridge.userSessions.set(sessionKey, { firstSeen: new Date(), commandsUsed: 0, lastActive: new Date(), userId, chatId, username });
    }
    const session = bridge.userSessions.get(sessionKey);
    session.commandsUsed++;
    session.lastActive = new Date();

    let text = '';
    if (cbq) text = cbq.data || '';
    else text = msg.text || msg.caption || '';

    const ctx = {
        bridge, client, message: msg, update, text, chatId, userId, username, chatType,
        isBot: msg.from?.is_bot, isPrivate: chatType === 'private',
        isGroup: ['group', 'supergroup'].includes(chatType), isChannel: chatType === 'channel',
        callbackQuery: cbq, session, lydiaActiveChats: bridge.lydiaActiveChats, conversations: bridge.conversations, args: [],
        isOwner: () => String(userId) === String(process.env.OWNER_ID) || String(userId) === String(process.env.TELEGRAM_CHAT_ID),
        isAdmin: async () => bridge.isAdmin(chatId, userId),
        reply: (t, o={}) => bridge.sendTo(chatId, t, { reply_to: msg.message_id, ...o }),
        replyHTML: (t, o={}) => bridge.sendTo(chatId, t, { reply_to: msg.message_id, parse_mode: 'HTML', ...o }),
        send: (t, o={}) => bridge.sendTo(chatId, t, o),
        sendHTML: (t, o={}) => bridge.sendTo(chatId, t, { parse_mode: 'HTML', ...o }),
        edit: (mId, t, o={}) => bridge.editMessage(chatId, mId, t, o),
        deleteMsg: (mId) => bridge.deleteMessage(chatId, mId),
        action: (a='typing') => bridge.sendAction(chatId, a),
        sendPhoto: (p, o={}) => bridge.sendPhoto(chatId, p, o),
        sendVideo: (v, o={}) => bridge.sendVideo(chatId, v, o),
        sendDoc: (d, o={}) => bridge.sendDocument(chatId, d, o),
    };

    if (cbq) {
        ctx.answerCallback = (txt, alert=false) => answerCBQ(bridge, cbq.id, txt);
    }
    return ctx;
}

// ═══════════════════════════════
//  PLUGIN LOADER
// ═══════════════════════════════

function loadPlugins(bridge, client) {
    const pluginsDir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
        return { loaded: 0, failed: 0 };
    }
    const EXCLUDED = ['bridge.js', 'bot.js', 'market-manager.js', 'test.js', 'telegram.js', 'start.js'];
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js') && !EXCLUDED.includes(f));
    let loaded = 0, failed = 0;
    for (const file of files) {
        try {
            const fp = path.join(pluginsDir, file);
            delete require.cache[require.resolve(fp)];
            const p = require(fp);
            const h = p.handler || p.run;
            if (!h || !p.name) continue;
            bridge.registerCommand(p.name, h, {
                description: p.description || p.desc || '', category: p.category || 'General',
                usage: p.usage || '', aliases: p.aliases || [], ownerOnly: p.ownerOnly || false,
                adminOnly: p.adminOnly || false, cooldown: p.cooldown, hidden: p.hidden || false,
            });
            loaded++;
        } catch (err) {
            failed++;
        }
    }
    // Sync to client for dashboard
    if (client && bridge) {
        client.telegramCommandCount = bridge.commands.size;
        client._telegramCommands = bridge.commands.size;
    }
    return { loaded, failed };
}

// ═══════════════════════════════
//  BUILT-IN COMMANDS
// ═══════════════════════════════

async function handleBuiltin(ctx, cmdName, bridge) {
    const { client } = ctx;

    switch (cmdName) {
        case 'start': {
            await ctx.action('typing');
            const sent = await bridge.sendTo(ctx.chatId, welcomeText(ctx.username), { parse_mode: 'HTML', extra: { reply_markup: welcomeMarkup() } });
            // Store message ID for potential edit later
            if (sent?.success && sent.data?.message_id) {
                bridge._welcomeMsgs = bridge._welcomeMsgs || new Map();
                bridge._welcomeMsgs.set(`${ctx.chatId}_${ctx.userId}`, sent.data.message_id);
            }
            return true;
        }

        case 'servers': {
            const guilds = client?.guilds?.cache || new Map();
            const arr = Array.from(guilds.values());
            if (arr.length === 0) return ctx.replyHTML(`🏰 <b>NO SERVERS</b>`);
            const totalM = arr.reduce((a,g) => a+(g.memberCount||0), 0);
            const sorted = arr.sort((a,b) => (b.memberCount||0)-(a.memberCount||0));
            let msg = `🏰 <b>CONNECTED</b>\n━━━━━━━━━━━━━━━━━━━━\n${arr.length} servers · ${formatNumber(totalM)} members\n\n`;
            sorted.slice(0, 12).forEach((g,i) => {
                msg += ` ${String(i+1).padStart(2)}. ${escapeHTML(g.name.substring(0,24)).padEnd(24)} ${formatNumber(g.memberCount||0)}\n`;
            });
            if (arr.length > 12) msg += `\n<i>...and ${arr.length-12} more</i>`;
            await ctx.replyHTML(msg);
            return true;
        }

        case 'stats':
        case 'status': {
            const ping = Math.round(client?.ws?.ping||0);
            const mem = process.memoryUsage();
            const ramU = Math.round(mem.rss/1024/1024);
            let health = 'EXCELLENT', bar = healthBar(Math.max(0, 500-ping), 500);
            if (ping > 300) health = 'POOR'; else if (ping > 200) health = 'FAIR'; else if (ping > 100) health = 'GOOD';
            await ctx.replyHTML(`📊 <b>STATISTICS</b>\n━━━━━━━━━━━━━━━━━━━━\n\nUptime · ${formatUptime(process.uptime())}\nRAM    · ${ramUMB}\nPing   · ${ping}ms\nTG Cmds· ${bridge.commands.size}\nLydia  · ${bridge.lydiaActiveChats.size} chats\n\nHealth · ${bar} ${health}\n\n<i>v3.0.0</i>`);
            return true;
        }

        case 'ping': {
            const s = Date.now();
            await ctx.replyHTML(`🏓 <i>Measuring...</i>`);
            const lat = Date.now() - s;
            const ws = Math.round(client?.ws?.ping||0);
            let emoji, rating;
            if (lat < 100) { emoji='🔥'; rating='LEGENDARY!'; } else if (lat < 200) { emoji='⚡'; rating='ELITE!'; } else if (lat < 300) { emoji='🌟'; rating='GOOD'; } else { emoji='🐢'; rating='SLOW'; }
            await ctx.replyHTML(`🏓 <b>PING</b>\n━━━━━━━━━━━━━━━━━━━━\n\n${emoji} <b>${rating}</b>\n📡 Latency: <b>${lat}ms</b>\n📡 Discord: <b>${ws}ms</b>`);
            return true;
        }

        case 'logs': {
            if (!ctx.isOwner()) return ctx.replyHTML('⛔ <b>Owner only</b>');
            await ctx.action('typing');
            const { execSync } = require('child_process');
            const filter = ctx.args[0]?.toLowerCase() || 'all';
            try {
                let raw;
                if (filter === 'errors') {
                    raw = execSync('tail -30 /root/.pm2/logs/Architect-CG223-error.log 2>/dev/null').toString();
                } else if (filter === 'dash') {
                    raw = execSync('tail -20 /root/.pm2/logs/architect-dashboard-out.log 2>/dev/null').toString();
                } else {
                    raw = execSync('tail -25 /root/.pm2/logs/Architect-CG223-out.log 2>/dev/null').toString();
                }
                const lines = raw.trim().split('\n').slice(-20);
                const cleaned = lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/.*\|\s+/, '').trim()).filter(Boolean).join('\n');
                const label = filter === 'errors' ? '🔴 ERROR LOG' : filter === 'dash' ? '🖥️ DASHBOARD LOG' : '📋 BOT LOG';
                await ctx.replyHTML(`${label}\n<pre>${escapeHTML(cleaned.substring(0, 3500))}</pre>\n<i>filter: ${filter} · ${new Date().toLocaleTimeString()}</i>`);
            } catch(e) {
                await ctx.replyHTML(`❌ <b>Log read failed</b>\n<code>${escapeHTML(e.message)}</code>`);
            }
            return true;
        }

        case 'restart': {
            if (!ctx.isOwner()) return ctx.replyHTML('⛔ <b>Owner only</b>');
            const target = ctx.args[0]?.toLowerCase();
            if (!target) return ctx.replyHTML('⚠️ Usage: <code>/restart bot</code> or <code>/restart dash</code>');
            await ctx.action('typing');
            const { execSync } = require('child_process');
            try {
                if (target === 'bot') {
                    execSync('pm2 restart Architect-CG223 --update-env', { timeout: 15000 });
                    await ctx.replyHTML('⚡ <b>BOT RESTARTING</b>\n━━━━━━━━━━━━━━━━━━━━\n\n🔄 Architect-CG223 restart signal sent\n⏳ Back online in ~10 seconds\n\n<i>· BAMAKO_223 🇲🇱 ·</i>');
                } else if (target === 'dash') {
                    execSync('pm2 restart architect-dashboard', { timeout: 15000 });
                    await ctx.replyHTML('⚡ <b>DASHBOARD RESTARTING</b>\n━━━━━━━━━━━━━━━━━━━━\n\n🔄 architect-dashboard restart signal sent\n⏳ Back online in ~5 seconds\n\n<i>· BAMAKO_223 🇲🇱 ·</i>');
                } else {
                    await ctx.replyHTML('⚠️ Unknown target. Use <code>bot</code> or <code>dash</code>');
                }
            } catch(e) {
                await ctx.replyHTML(`❌ <b>Restart failed</b>\n<code>${escapeHTML(e.message)}</code>`);
            }
            return true;
        }

        case 'pm2': {
            if (!ctx.isOwner()) return ctx.replyHTML('⛔ <b>Owner only</b>');
            await ctx.action('typing');
            const { execSync } = require('child_process');
            try {
                const raw = execSync('pm2 jlist 2>/dev/null').toString();
                const list = JSON.parse(raw);
                let msg = '📊 <b>PM2 PROCESSES</b>\n━━━━━━━━━━━━━━━━━━━━\n\n';
                list.forEach(p => {
                    const status = p.pm2_env?.status === 'online' ? '🟢' : '🔴';
                    const mem = Math.round((p.monit?.memory || 0) / 1024 / 1024);
                    const cpu = p.monit?.cpu || 0;
                    const restarts = p.pm2_env?.restart_time || 0;
                    msg += `${status} <b>${escapeHTML(p.name)}</b> <i>(id:${p.pm_id})</i>\n`;
                    msg += `   RAM: ${mem}MB · CPU: ${cpu}% · ↺ ${restarts}\n\n`;
                });
                msg += `<i>${new Date().toLocaleTimeString()} · BAMAKO_223 🇲🇱</i>`;
                await ctx.replyHTML(msg);
            } catch(e) {
                await ctx.replyHTML(`❌ <b>PM2 read failed</b>\n<code>${escapeHTML(e.message)}</code>`);
            }
            return true;
        }

        default: return false;
    }
}

// ═══════════════════════════════
//  UPDATE HANDLER
// ═══════════════════════════════

async function handleUpdate(update, bridge, client) {
    // Handle callbacks FIRST (button taps)
    if (update.callback_query) {
        await handleCallback(update, bridge, client);
        return;
    }

    // Regular text messages
    const ctx = buildContext(update, bridge, client);
    if (!ctx || ctx.isBot) return;

    if (ctx.text?.startsWith('/')) {
        console.log(`${cyan}[TG]${reset} ${ctx.username}: ${ctx.text.split(' ')[0]}`);
    }

    const { text } = ctx;
    if (!text) return;

    if (text.startsWith('/')) {
        const parts = text.slice(1).split(' ');
        const cmdName = parts[0].toLowerCase().split('@')[0];
        const args = parts.slice(1);
        ctx.args = args;

        // Cooldown
        const cdKey = `${ctx.userId}:${cmdName}`;
        if (!client._tgCooldowns) client._tgCooldowns = new Map();
        const last = client._tgCooldowns.get(cdKey);
        const now = Date.now();
        if (last && (now - last) < 1500) return;
        client._tgCooldowns.set(cdKey, now);

        // Built-ins
        if (await handleBuiltin(ctx, cmdName, bridge)) return;

        // Plugin commands
        const cmd = bridge.getCommand(cmdName);
        if (cmd?.handler) {
            if (cmd.ownerOnly && !ctx.isOwner()) return ctx.replyHTML(`⛔ <b>Owner only</b>`);
            if (cmd.adminOnly && !(await ctx.isAdmin())) return ctx.replyHTML(`⛔ <b>Admin only</b>`);
            try { await cmd.handler(ctx); bridge.stats.commandsUsed++; } catch (err) {
                console.error(`${red}[TG]${reset} /${cmdName}: ${err.message}`);
                ctx.replyHTML(`❌ Error. Try again.`);
            }
            return;
        }

        // Unknown — suggest similar
        const names = Array.from(bridge.commands.keys());
        const sug = names.filter(c => levenshtein(cmdName, c) <= 2).slice(0, 3);
        let msg = `⚠️ <b>Unknown:</b> <code>/${escapeHTML(cmdName)}</code>`;
        if (sug.length) msg += `\n\nDid you mean: ${sug.map(s=>`<code>/${s}</code>`).join(', ')}`;
        msg += `\n\n📖 <code>/help</code> for all ${bridge.commands.size} commands`;
        await ctx.replyHTML(msg);
        return;
    }

    // Lydia auto-reply
    if (bridge.lydiaActiveChats.has(String(ctx.chatId))) {
        try { const l = bridge.getCommand('lydia'); if (l?.handler) { await ctx.action('typing'); ctx.args = [ctx.text]; await l.handler(ctx); } } catch(e){}
        return;
    }

    // Easter eggs
    const low = text.toLowerCase();
    const triggers = ['archon', 'bamako', 'mali', 'cg223', 'sovereignty', 'fof', 'mfof'];
    const responses = ["🔥 ARCHON RISING! Hidden codex discovered!", "🇲🇱 MALI BA! Bamako spirit flows!", "⚡ DIGITAL SOVEREIGNTY!", "💎 LEGENDARY! Architect code!"];
    for (const t of triggers) { if (low.includes(t)) { ctx.replyHTML(`🔥 <b>EASTER EGG!</b>\n\n${randomPick(responses)}`).catch(()=>{}); return; } }
}

// ═══════════════════════════════
//  POLLING ENGINE
// ═══════════════════════════════

function startPolling(bridge, client) {
    const token = bridge.token;
    if (!token) { console.log(`${yellow}[TG]${reset} No TELEGRAM_BOT_TOKEN`); return; }

    let lastId = 0, running = true, errs = 0;

    const poll = async () => {
        if (!running) return;
        try {
            const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastId+1}&limit=100&timeout=30`;
            https.get(url, { timeout: 40000 }, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', async () => {
                    errs = 0;
                    try {
                        const json = JSON.parse(body);
                        if (json.ok && json.result?.length > 0) {
                            for (const u of json.result) { lastId = Math.max(lastId, u.update_id); await handleUpdate(u, bridge, client); }
                        }
                    } catch {}
                    setTimeout(poll, 500);
                });
            }).on('error', (err) => { errs++; console.warn(`${yellow}[TG]${reset} err ${errs}: ${err.message}`); setTimeout(poll, Math.min(30000, 2000*errs)); }).on('timeout', () => setTimeout(poll, 1000));
        } catch { errs++; if (errs >= 10) { errs = 0; setTimeout(poll, 60000); return; } setTimeout(poll, 3000); }
    };

    poll();
    console.log(`${green}[TG]${reset} Polling started`);
    process.on('SIGINT', () => { running = false; });
    process.on('SIGTERM', () => { running = false; });
}

// ═══════════════════════════════
//  BOOT NOTIFICATION
// ═══════════════════════════════

async function sendBoot(bridge, client) {
    const owner = bridge.chatId;
    if (!owner || !bridge.enabled) return;
    const g = client?.guilds?.cache?.size || 0;
    const u = client?.guilds?.cache?.reduce((a,g) => a+(g.memberCount||0), 0) || 0;
    const msg = `⚡ <b>ARCHON CG-223 ONLINE</b>\n━━━━━━━━━━━━━━━━━━━━\n\n🟢 System Active\nEngine  · Architect-CG-223\nNode    · BAMAKO_223 🇲🇱\nVersion · v3.0.0\n\n📡 Connections\nDiscord  · ${g} servers · ${formatNumber(u)} members\nTelegram · ${bridge.commands.size} commands\n\n🕐 ${new Date().toLocaleString()}\n· @mfof7310 ·`;
    await bridge.sendTo(owner, msg, { parse_mode: 'HTML' }).catch(()=>{});
}

// ═══════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════

module.exports = {
    initialize: async (client) => {
        console.log(`${cyan}[TG]${reset} Initializing engine...`);
        const bridge = client.telegramBridge;
        if (!bridge) { console.error(`${red}[TG]${reset} Bridge not initialized!`); return null; }
        loadPlugins(bridge, client);
        startPolling(bridge, client);
        setTimeout(() => sendBoot(bridge, client).catch(()=>{}), 2000);
        console.log(`${green}[TG]${reset} Engine ready · ${bridge.commands.size} commands`);
        return bridge;
    }
};
