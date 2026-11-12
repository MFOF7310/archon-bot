// ═══════════════════════════════════════════
//  ARCHON CG-223 — TELEGRAM BOT ENGINE v3.0
//  Smooth single-message UI with inline editing
// ═══════════════════════════════════════════

const fs = require('fs');
const bot_version = (() => { try { return require('fs').readFileSync('/root/cloud-gaming-223-digital-engine/version.txt', 'utf8').trim(); } catch { return '3.1.0'; } })();
const path = require('path');
const https = require('https');
const os = require('os');

const green = "\x1b[32m", yellow = "\x1b[33m", red = "\x1b[31m", cyan = "\x1b[36m", reset = "\x1b[0m";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Typing animation helper — shows ... then resolves
async function thinkingMsg(bridge, chatId, text = '⏳') {
    const dots = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    await bridge.sendAction(chatId, 'typing');
    return bridge.sendTo(chatId, text, { parse_mode: 'HTML' });
}
const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
const formatUptime = (s) => { const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60); return d>0?`${d}d ${h}h ${m}m`:h>0?`${h}h ${m}m`:`${m}m`; };
const escapeHTML = (t) => !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const healthBar = (v, max, len=10) => { const f = Math.max(1, Math.min(len, Math.floor((v/max)*len))); return '█'.repeat(f) + '▒'.repeat(len-f); };
const randomPick = (arr) => arr[Math.floor(Math.random()*arr.length)];
const levenshtein = (a, b) => { const m=[]; for(let i=0;i<=b.length;i++)m[i]=[i]; for(let j=0;j<=a.length;j++)m[0][j]=j; for(let i=1;i<=b.length;i++)for(let j=1;j<=a.length;j++)m[i][j]=b[i-1]===a[j-1]?m[i-1][j-1]:Math.min(m[i-1][j-1]+1,m[i][j-1]+1,m[i-1][j]+1); return m[b.length][a.length]; };

// ═══════════════════════════════
//  SMOOTH UI — Edit in place
// ═══════════════════════════════

const { m: M, langOf } = require('./lang/menu');

/** The /start menu: six areas, then language and the full list */
const welcomeMarkup = (lang = 'en') => require('./lang/menu').startMenu('', lang).markup;

/** A page's buttons, with a way back to the menu */
function subMarkup(buttons, lang = 'en') {
    return { inline_keyboard: [...buttons, [{ text: M(lang, 'b_back'), callback_data: 'm:main' }]] };
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
function answerCBQ(bridge, cbqId, text, showAlert = false, url = null) {
    const payload = { callback_query_id: cbqId, text: text || '', show_alert: showAlert };
    if (url) payload.url = url;
    const body = JSON.stringify(payload);
    const req = https.request(`https://api.telegram.org/bot${bridge.token}/answerCallbackQuery`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 5000 }, ()=>{});
    req.on('error',()=>{}); req.write(body); req.end();
}

// ═══════════════════════════════
//  WELCOME TEXT BUILDERS
// ═══════════════════════════════

const welcomeText = (name, lang = 'en') => require('./lang/menu').startMenu(name, lang).text;

// A menu page: title, one sentence, then the commands ("/cmd <arg> · what it does")
function pageText(lang, key, extra = '') {
    const lines = (M(lang, key + '_c') || []).map((l) => {
        const [cmd, ...rest] = String(l).split(' · ');
        return `<code>${escapeHTML(cmd)}</code> · ${escapeHTML(rest.join(' · '))}`;
    });
    return `<b>${M(lang, key + '_t')}</b>\n${M(lang, key + '_d')}\n\n${lines.join('\n')}${extra}`;
}

// ═══════════════════════════════
//  CALLBACK HANDLER — Smooth UI
// ═══════════════════════════════

// Global callback cooldown map
if (!global._cbCooldowns) global._cbCooldowns = new Map();

async function handleCallback(update, bridge, client) {
    const cbq = update.callback_query;
    // Handle game callbacks (no data, just game_short_name)
    if (!cbq?.data && cbq?.game_short_name) {
        await answerCBQ(bridge, cbq.id, '', false, 'https://bamako-steel-dev.xyz/games/trivia.html');
        return;
    }
    // Cooldown — 1.2s per user per button
    const cdKey = `${cbq.from?.id}:${cbq.data}`;
    const last = global._cbCooldowns.get(cdKey);
    if (last && Date.now() - last < 1200) {
        await answerCBQ(bridge, cbq.id);
        return;
    }
    global._cbCooldowns.set(cdKey, Date.now());
    
    // Small human delay — feels natural
    await new Promise(r => setTimeout(r, 350));
    
    // Show typing indicator
    try { await bridge.sendAction(cbq.message?.chat?.id, 'typing'); } catch(e) {}

    const data = cbq.data;
    const chatId = cbq.message?.chat?.id;
    const msgId = cbq.message?.message_id;
    const userId = cbq.from?.id;
    const name = cbq.from?.first_name || 'User';

    // No-op
    if (data === '_noop') { answerCBQ(bridge, cbq.id); return; }

    // Answer callback immediately to stop loading spinner
    answerCBQ(bridge, cbq.id);

    // Language card: open it from the menu, or switch with one tap (the card is edited in place)
    if (data.startsWith('lang:')) {
        const sl = require('./plugins/setlang');
        const code = data.split(':')[1];
        let outcome = null;
        if (code === 'auto' || sl.LANG_INFO[code]) { sl.setChoice(userId, code); outcome = code; }
        const c = sl.card(userId, cbq.from?.language_code, outcome, true);
        await editMsg(bridge, chatId, msgId, c.text, c.markup);
        return;
    }

    // /list category navigation
    if (data.startsWith('list_cat_') || data === 'list_main') {
        // The /list card changes in place, with the views list.js builds from the loaded commands
        try {
            const L = require('./plugins/list.js');
            const lang = langOf(userId, cbq.from?.language_code);
            let view;
            if (data === 'list_main') view = L.overview(bridge, lang);
            else {
                const found = L.areas(bridge).find(([cat]) => cat.toLowerCase() === data.replace('list_cat_', ''));
                view = found ? L.area(bridge, lang, found[0], found[1]) : L.overview(bridge, lang);
            }
            await editMsg(bridge, chatId, msgId, view.text, view.markup);
        } catch (e) { console.error('[LIST CB]', e.message); }
        return;
    }

    // Update callbacks
    if (data === 'update_pull') {
        const ctx2 = buildContext(update, bridge, client);
        if (!ctx2) return;
        ctx2.args = ['pull'];
        try {
            const updatePlugin = require('./plugins/update.js');
            await updatePlugin.handler(ctx2);
        } catch(e) {}
        return;
    }
    if (data === 'update_skip') {
        await editMsg(bridge, chatId, msgId, '👍 No worries — update skipped for now!\n\n🦅 ARCHON CG-223', {});
        return;
    }

    // tgame play button — game callback
    if (cbq.game_short_name === 'archontrivia' || data === 'tgame_play') {
        await answerCBQ(bridge, cbq.id, '', false, 'https://bamako-steel-dev.xyz/games/trivia.html');
        return;
    }

    // Trivia game callbacks
    if (data.startsWith('trivia_')) {
        const ctx2 = buildContext(update, bridge, client);
        if (!ctx2) return;
        try {
            const triviaPlugin = require('./plugins/trivia.js');
            if (triviaPlugin.handleCallback) {
                await triviaPlugin.handleCallback(ctx2, data);
            }
        } catch(e) { console.error('[TRIVIA CB]', e.message); }
        return;
    }

    // Group settings panel callbacks
    if (data.startsWith('gs_')) {
        const ctx2 = buildContext(update, bridge, client);
        if (!ctx2) return;
        const db = client && client.db;
        const groupName = update.callback_query && update.callback_query.message && update.callback_query.message.chat && update.callback_query.message.chat.title || 'this group';
        if (!db) return;
        try {
            const sp = require('./plugins/settings.js');
            await sp.handleCallback(ctx2, data, bridge, db, chatId, msgId, groupName);
        } catch(e) { console.error('[SETTINGS CB]', e.message); }
        return;
    }

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

    // ── YOUTUBE DOWNLOAD CALLBACKS ──
    if (data.startsWith('ytdl:')) {
        const ctx = buildContext(update, bridge, client);
        if (!ctx) return;
        const parts = data.split(':');
        const mediaType = parts[1];
        const quality   = (parts[2] === 'best' || /^\d{3,4}$/.test(parts[2] || '')) ? parts[2] : ''; // only a known quality reaches yt-dlp
        const urlKey    = parts[3];
        // Resolve short key back to full URL
        let url = urlKey;
        if (!urlKey.startsWith('http')) {
            try {
                const ytv = require('./plugins/ytv');
                url = ytv.getUrl(urlKey) || urlKey;
            } catch {}
            try {
                const yta = require('./plugins/yta');
                if (!url || !url.startsWith('http')) url = yta.getUrl(urlKey) || urlKey;
            } catch {}
        }

        answerCBQ(bridge, cbq.id);
        // The message with the quality buttons becomes the status line of the download: one message, no pile-up
        ctx.statusMsgId = msgId;
        try {
            if (mediaType === 'v') { ctx.args = [url, quality]; await require('./plugins/ytv').handler(ctx); }
            else { ctx.args = [url]; await require('./plugins/yta').handler(ctx); }
        } catch (e) {
            console.error('[YTDL CB]', e.message);
            await bridge.editMessage(chatId, msgId, require('./lang/media').tr(ctx)('failed'), { parse_mode: 'HTML' }).catch(() => {});
        }
        return;
    }

    // Help menu button handlers
    if (data.startsWith('cmd_') || data.startsWith('help_') || data.startsWith('game_') || data === 'menu_main') {
        const ctx = buildContext(update, bridge, client);
        if (!ctx) return;

        // Animate: show typing first
        await bridge.sendAction(chatId, 'typing');

        if (data === 'menu_main' || data === 'cmd_menu') {
            // Show all commands by category
            const cats = new Map();
            for (const [n, c] of bridge.commands) {
                if (c.hidden) continue;
                if (!cats.has(c.category)) cats.set(c.category, []);
                cats.get(c.category).push(n);
            }
            let txt = `📋 <b>All Commands</b> (${bridge.commands.size} total)\n━━━━━━━━━━━━━━━━\n\n`;
            for (const [cat, cmds] of [...cats.entries()].sort()) {
                txt += `<b>${escapeHTML(cat)}</b>\n${cmds.map(c=>`<code>/${c}</code>`).join(' ')}\n\n`;
            }
            await editMsg(bridge, chatId, msgId, txt, { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'm:main' }]] });
            return;
        }

        if (data === 'cmd_games' || data === 'game_trivia') {
            const ctx2 = buildContext(update, bridge, client);
            ctx2.args = [];
            const cmd = bridge.getCommand('trivia');
            if (cmd?.handler) await cmd.handler(ctx2).catch(() => {});
            return;
        }
        if (data === 'game_word') {
            const ctx2 = buildContext(update, bridge, client);
            ctx2.args = [];
            const cmd = bridge.getCommand('wordguess');
            if (cmd?.handler) await cmd.handler(ctx2).catch(() => {});
            return;
        }
        if (data === 'game_roll') {
            const ctx2 = buildContext(update, bridge, client);
            ctx2.args = [];
            const cmd = bridge.getCommand('roll');
            if (cmd?.handler) await cmd.handler(ctx2).catch(() => {});
            return;
        }
        if (data === 'game_flip') {
            const ctx2 = buildContext(update, bridge, client);
            ctx2.args = [];
            const cmd = bridge.getCommand('coinflip');
            if (cmd?.handler) await cmd.handler(ctx2).catch(() => {});
            return;
        }
        if (data === 'cmd_economy') {
            const ctx2 = buildContext(update, bridge, client);
            ctx2.args = [];
            const cmd = bridge.getCommand('balance');
            if (cmd?.handler) await cmd.handler(ctx2).catch(() => {});
            return;
        }
        if (data === 'cmd_utility') {
            await editMsg(bridge, chatId, msgId,
                `🛠️ <b>Utility Commands</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `<code>/weather</code> &lt;city&gt; — Weather forecast\n` +
                `<code>/crypto</code> &lt;coin&gt; — Crypto prices\n` +
                `<code>/translate</code> &lt;text&gt; — Translate text\n` +
                `<code>/remind</code> — Set reminders\n` +
                `<code>/id</code> — Get user/chat ID\n` +
                `<code>/ping</code> — Bot latency`,
                { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_main' }]] }
            );
            return;
        }
        if (data === 'cmd_mod') {
            await editMsg(bridge, chatId, msgId,
                `🛡️ <b>Moderation Commands</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `<code>/kick</code> — Kick a member\n` +
                `<code>/ban</code> — Ban a member\n` +
                `<code>/unban</code> &lt;id&gt; — Unban someone\n` +
                `<code>/mute</code> — Mute a member\n` +
                `<code>/warn</code> — Warn a member\n` +
                `<code>/pin</code> — Pin a message\n` +
                `<code>/rules</code> — View/set group rules\n` +
                `<code>/admins</code> — List admins\n` +
                `<code>/antilink</code> on/off — Block links\n` +
                `<code>/promote</code>/<code>/demote</code> — Manage admins`,
                { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_main' }]] }
            );
            return;
        }
        if (data === 'cmd_help') {
            await editMsg(bridge, chatId, msgId,
                `🆘 <b>How to use ARCHON CG-223</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `• Type <code>/help &lt;command&gt;</code> for details\n` +
                `• Most commands work in groups and private chats\n` +
                `• Admin commands require admin rights\n` +
                `• Use /start to see the main menu\n\n` +
                `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`,
                { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_main' }]] }
            );
            return;
        }

        // Help category pages
        if (data.startsWith('help_')) {
            const category = data.replace('help_', '');
            const cmds = [...bridge.commands.values()].filter(c => c.category?.toLowerCase() === category && !c.hidden);
            let txt = `📂 <b>${escapeHTML(category.charAt(0).toUpperCase() + category.slice(1))}</b>\n━━━━━━━━━━━━━━━━\n\n`;
            if (!cmds.length) txt += 'No commands in this category.';
            else cmds.forEach(c => {
                txt += `<code>/${c.name}</code> — ${escapeHTML(c.description)}\n`;
            });
            await editMsg(bridge, chatId, msgId, txt, { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_main' }]] });
            return;
        }
        return;
    }

    // A button that runs a command with one argument and shows the answer in the same message (cmdx:<command>:<arg>)
    if (data.startsWith('cmdx:')) {
        const [, cmdName, arg = ''] = data.split(':');
        const ctx = buildContext(update, bridge, client);
        if (!ctx) return;
        ctx.args = arg ? [arg] : [];
        ctx.calledAs = cmdName;
        ctx.statusMsgId = msgId;
        const cmd = bridge.getCommand(cmdName);
        if (cmd?.handler && !cmd.ownerOnly) { try { await cmd.handler(ctx); } catch (e) { console.error('[CMDX]', cmdName, e.message); } }
        return;
    }

    // Direct command trigger from button
    if (data.startsWith('cmd:')) {
        const cmdName = data.split(':')[1];
        const ctx = buildContext(update, bridge, client);
        if (!ctx) return;
        ctx.args = [];
        ctx.calledAs = cmdName;
        const cmd = bridge.getCommand(cmdName);
        if (cmd?.handler) {
            try { await cmd.handler(ctx); } catch(e) { ctx.replyHTML(`❌ ${escapeHTML(e.message)}`); }
        } else {
            ctx.replyHTML(`💡 Type <code>/${escapeHTML(cmdName)}</code> to use this command!`);
        }
        return;
    }

    // Server card buttons (owner only, checked inside)
    if (data.startsWith('sys:')) {
        const ctx = buildContext(update, bridge, client);
        if (ctx) { try { await require('./plugins/sysctl').onButton(ctx, data, msgId); } catch (e) { console.error('[SYSCTL]', e.message); } }
        return;
    }

    // Menu navigation — smooth edit in place
    if (!data.startsWith('m:')) return;

    const page = data.split(':')[1];
    const lang = langOf(userId, cbq.from?.language_code);
    const b = (k, cmd) => ({ text: M(lang, k), callback_data: 'cmd:' + cmd });

    switch (page) {
        case 'main':
            await editMsg(bridge, chatId, msgId, welcomeText(name, lang), welcomeMarkup(lang));
            break;
        case 'ai':
            await editMsg(bridge, chatId, msgId, pageText(lang, 'ai'), subMarkup([[b('b_ask', 'lydia'), b('b_tr', 'translate')]], lang));
            break;
        case 'dl':
            await editMsg(bridge, chatId, msgId, pageText(lang, 'dl'), subMarkup([[b('b_search', 'yts')]], lang));
            break;
        case 'games':
            await editMsg(bridge, chatId, msgId, pageText(lang, 'games'), subMarkup([[b('b_trivia', 'trivia'), b('b_word', 'wordguess')], [b('b_roll', 'roll'), b('b_flip', 'flip')]], lang));
            break;
        case 'econ':
            await editMsg(bridge, chatId, msgId, pageText(lang, 'econ'), subMarkup([[b('b_daily', 'daily'), b('b_bal', 'balance')], [b('b_rank', 'rank'), b('b_prof', 'profile')]], lang));
            break;
        case 'group':
            await editMsg(bridge, chatId, msgId, pageText(lang, 'group'), subMarkup([[b('b_settings', 'settings'), b('b_admins', 'admins')]], lang));
            break;
        case 'util':
            await editMsg(bridge, chatId, msgId, pageText(lang, 'util'), subMarkup([[b('b_weather', 'weather'), b('b_crypto', 'crypto')], [b('b_tr', 'translate'), b('b_remind', 'reminder')]], lang));
            break;
        case 'cmds': {
            // Every command by area, built from what is really loaded
            const cats = new Map();
            for (const [, c] of bridge.commands) {
                if (c.hidden || c.ownerOnly) continue;
                const cat = c.category || 'Other';
                if (!cats.has(cat)) cats.set(cat, []);
                cats.get(cat).push(c);
            }
            let txt = `<b>${M(lang, 'all_t')}</b>\n\n`;
            for (const [cat, cmds] of [...cats.entries()].sort()) txt += `<b>${escapeHTML(cat)}</b>\n${cmds.map((c) => `/${c.name}`).join('  ')}\n\n`;
            txt += `<i>${M(lang, 'all_hint')}</i>`;
            await editMsg(bridge, chatId, msgId, txt, subMarkup([[{ text: M(lang, 'b_about'), callback_data: 'm:about' }]], lang));
            break;
        }
        case 'about': {
            const txt = `<b>${M(lang, 'about_t')}</b>\n${M(lang, 'about_d')}\n\n<i>${M(lang, 'about_up', { uptime: formatUptime(process.uptime()), version: bot_version })}</i>`;
            await editMsg(bridge, chatId, msgId, txt, subMarkup([[{ text: '🔗 GitHub', url: 'https://github.com/MFOF7310' }, { text: '🌐 bamako-steel-dev.xyz', url: 'https://bamako-steel-dev.xyz' }]], lang));
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
        // Auto lang — checks user preference first, falls back to Telegram language_code
        lang: (() => {
            try {
                const fs = require('fs');
                const db = JSON.parse(fs.readFileSync(require('./safe').store('archon_user_langs.json'), 'utf8'));
                return db[String(userId)] || msg?.from?.language_code || 'en';
            } catch { return msg?.from?.language_code || 'en'; }
        })(),
        t: (key, vars = {}) => {
            try {
                const { t: translate } = require('./plugins/../lang/index.js');
                const fs = require('fs');
                const db = JSON.parse(fs.readFileSync(require('./safe').store('archon_user_langs.json'), 'utf8'));
                const lang = db[String(userId)] || msg?.from?.language_code || 'en';
                return translate(lang, key, vars, userId);
            } catch { return key; }
        },
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
        sendAudio: (a, o={}) => bridge.sendAudio(chatId, a, o),
        sendVideoBuffer: (buf, o={}) => bridge.sendVideoBuffer(chatId, buf, o),
        sendAudioBuffer: (buf, o={}) => bridge.sendAudioBuffer(chatId, buf, o),
        sendPhotoBuffer: (buf, o={}) => bridge.sendPhotoBuffer(chatId, buf, o),
        sendMediaGroup: (media, o={}) => bridge.sendMediaGroup(chatId, media, o),
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
    console.log(`\x1b[35m[TELEGRAM]\x1b[0m ${loaded} plugins loaded ✅${failed > 0 ? ` • ${failed} failed ❌` : ''} • ${bridge?.commands?.size || loaded} commands registered`);
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
            const _lang = langOf(ctx.userId, ctx.message?.from?.language_code);
            const sent = await bridge.sendTo(ctx.chatId, welcomeText(ctx.message?.from?.first_name || ctx.username, _lang), { parse_mode: 'HTML', extra: { reply_markup: welcomeMarkup(_lang) } });
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
            await ctx.replyHTML(`📊 <b>STATISTICS</b>\n━━━━━━━━━━━━━━━━━━━━\n\nUptime · ${formatUptime(process.uptime())}\nRAM    · ${ramU} MB\nPing   · ${ping}ms\nTG Cmds· ${bridge.commands.size}\nLydia  · ${bridge.lydiaActiveChats.size} chats\n\nHealth · ${bar} ${health}\n\n<i>${bot_version}</i>`);
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

        // Server tools live in plugins/sysctl.js (the card, logs, files, restarts)
        case 'logs':
        case 'pm2':
        case 'restart': {
            if (!ctx.isOwner()) { await ctx.replyHTML('⛔ Owner only.'); return true; }
            const sys = require('./plugins/sysctl');
            if (cmdName === 'logs') ctx.calledAs = 'tail';
            if (cmdName === 'pm2') ctx.calledAs = 'sysctl';
            if (cmdName === 'restart') { ctx.calledAs = 'sysctl'; ctx.args = ['restart', ...(ctx.args || [])]; }
            await sys.handler(ctx);
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

    // ── NEW MEMBER JOIN (chat_member update) ──
    if (update.chat_member) {
        const cm = update.chat_member;
        const newStatus = cm.new_chat_member?.status;
        const oldStatus = cm.old_chat_member?.status;
        const joined = ['member','administrator','creator'].includes(newStatus) &&
                       ['left','kicked','restricted'].includes(oldStatus);
        if (!joined) return;
    }
    // Legacy new_chat_members handled by chat_member update above

    // ── MEMBER LEFT ──
    const leftMember = update.message?.left_chat_member;
    if (leftMember && !leftMember.is_bot) {
        const chatId = String(update.message.chat.id);
        try {
            const welcomePlugin = require('./plugins/welcome.js');
            const db = client && client.db;
            if (db && welcomePlugin.sendGoodbye) {
                await welcomePlugin.sendGoodbye(bridge, db, chatId, leftMember, update.message?.chat?.title || 'the group');
            }
        } catch(e) { console.error('[GOODBYE]', e.message); }
        return;
    }

    // Regular text messages
    const ctx = buildContext(update, bridge, client);
    if (!ctx || ctx.isBot) return;

    if (ctx.text?.startsWith('/')) {
        // One line per command: who, what, where, when
        const _where = ctx.isPrivate ? 'in a DM' : `in ${ctx.isChannel ? 'channel' : 'group'} "${ctx.message?.chat?.title || ctx.chatId}"`;
        const _time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Bamako' });
        console.log(`${cyan}[TG]${reset} ${_time} · ${ctx.username} (${ctx.userId}) used ${ctx.text.split(' ')[0]} ${_where}`);
    }

    const { text } = ctx;
    if (!text) return;

    // Auto-reply filter check for regular messages
    if (!text.startsWith('/')) {
        try {
            const filterPlugin = require('./plugins/filter.js');
            if (filterPlugin.checkMessage) {
                const handled = await filterPlugin.checkMessage(ctx);
                if (handled) return;
            }
        } catch(e) { console.error('[FILTER ERR]', e.message); }
    }

    if (text.startsWith('/')) {
        const parts = text.slice(1).split(' ');
        const cmdName = parts[0].toLowerCase().split('@')[0];
        const args = parts.slice(1);
        ctx.args = args;
        ctx.calledAs = cmdName; // the word the member typed (/flip and /roll share one plugin)

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
            try {
                await cmd.handler(ctx);
                bridge.stats.commandsUsed++;
            } catch (err) {
                console.error(`${red}[TG ERROR]${reset} /${cmdName}: ${err.message}`);
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
            const allowedUpdates = encodeURIComponent(JSON.stringify(["message","edited_message","callback_query","chat_member","my_chat_member"]));
            const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastId+1}&limit=100&timeout=30&allowed_updates=${allowedUpdates}`;
            https.get(url, { timeout: 40000 }, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', async () => {
                    errs = 0;
                    try {
                        const json = JSON.parse(body);
                        if (json.ok && json.result?.length > 0) {
                            for (const u of json.result) {
                                lastId = Math.max(lastId, u.update_id);
                                // Set TG_DEBUG=1 in .env to see every raw update (button presses filled the log otherwise)
                                if (process.env.TG_DEBUG === '1') {
                                    const uType = Object.keys(u).filter(k => k !== 'update_id')[0];
                                    console.log('[TG DEBUG] update type:', uType, JSON.stringify(u).substring(0, 100));
                                }
                                await handleUpdate(u, bridge, client);
                            }
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
    
    // Auto-check for updates 60s after boot
    setTimeout(async () => {
        try {
            const updatePlugin = require('./plugins/update.js');
            const ownerChatId = process.env.TELEGRAM_CHAT_ID;
            if (ownerChatId && updatePlugin.autoCheck) {
                await updatePlugin.autoCheck(bridge, ownerChatId);
            }
        } catch(e) {}
    }, 60000);
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
    const msg = `⚡ <b>ARCHON CG-223 ONLINE</b>\n━━━━━━━━━━━━━━━━━━━━\n\n🟢 System Active\nEngine  · Architect-CG-223\nNode    · BAMAKO_223 🇲🇱\nVersion · ${bot_version}\n\n📡 Connections\nDiscord  · ${g} servers · ${formatNumber(u)} members\nTelegram · ${bridge.commands.size} commands\n\n🕐 ${new Date().toLocaleString()}\n· @mfof7310 ·`;
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
