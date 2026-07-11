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

// Global callback cooldown map
if (!global._cbCooldowns) global._cbCooldowns = new Map();

async function handleCallback(update, bridge, client) {
    const cbq = update.callback_query;
    if (!cbq?.data) return;
    
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

    // /list category navigation
    if (data.startsWith('list_cat_') || data === 'list_main') {
        // Answer callback first to stop loading spinner
        await answerCBQ(bridge, cbq.id);
        const ctx2 = buildContext(update, bridge, client);
        if (!ctx2) return;
        ctx2.args = data === 'list_main' ? [] : [data.replace('list_cat_', '')];
        try {
            const listPlugin = require('./plugins/list.js');
            // Edit existing message instead of sending new one
            const cats = new Map();
            const fs = require('fs');
            const path = require('path');
            const pluginsDir = path.join(__dirname, 'plugins');
            const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js') && !f.startsWith('_') && f !== 'list.js');
            for (const file of files) {
                try {
                    const p = require(path.join(pluginsDir, file));
                    if (!p.name || p.hidden) continue;
                    const cat = (p.category || 'General').toUpperCase();
                    if (!cats.has(cat)) cats.set(cat, []);
                    cats.get(cat).push(p);
                } catch(e) {}
            }
            const CAT_EMOJI = { 'MEDIA': '🎬', 'SYSTEM': '⚙️', 'MODERATION': '🛡️', 'ECONOMY': '💰', 'GAMES': '🎮', 'UTILITY': '🛠️', 'AI': '🤖', 'GENERAL': '📋', 'MUSIC': '🎵' };

            if (data === 'list_main') {
                const totalCmds = [...cats.values()].reduce((s, c) => s + c.length, 0);
                const msg = `🦅 <b>ARCHON CG-223</b>
━━━━━━━━━━━━━━━━

<b>${totalCmds} commands</b> across <b>${cats.size} categories</b>

Tap a category:

🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;
                const sorted = [...cats.entries()].sort((a,b) => b[1].length - a[1].length);
                const rows = [];
                for (let i = 0; i < sorted.length; i += 2) {
                    const row = [];
                    const [c1, cmds1] = sorted[i];
                    row.push({ text: `${CAT_EMOJI[c1]||'📋'} ${c1} (${cmds1.length})`, callback_data: `list_cat_${c1.toLowerCase()}` });
                    if (sorted[i+1]) { const [c2, cmds2] = sorted[i+1]; row.push({ text: `${CAT_EMOJI[c2]||'📋'} ${c2} (${cmds2.length})`, callback_data: `list_cat_${c2.toLowerCase()}` }); }
                    rows.push(row);
                }
                await editMsg(bridge, chatId, msgId, msg, { inline_keyboard: rows });
            } else {
                const filter = data.replace('list_cat_', '');
                const found = [...cats.entries()].find(([k]) => k.toLowerCase() === filter);
                if (!found) return;
                const [cat, cmds] = found;
                const emoji = CAT_EMOJI[cat] || '📋';
                let msg = `${emoji} <b>${cat}</b> (${cmds.length})
━━━━━━━━━━━━━━━━

`;
                cmds.forEach(cmd => {
                    const aliases = cmd.aliases?.length ? ` · ${cmd.aliases.slice(0,2).map(a => `/${a}`).join(' ')}` : '';
                    msg += `<code>/${cmd.name}</code>${aliases}
`;
                    if (cmd.description) msg += `  <i>${cmd.description.substring(0,55)}</i>
`;
                });
                msg += `
🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;
                await editMsg(bridge, chatId, msgId, msg, { inline_keyboard: [[{ text: '← Back', callback_data: 'list_main' }]] });
            }
        } catch(e) { console.error('[LIST CB]', e.message); }
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

    // Direct command trigger from button
    if (data.startsWith('cmd:')) {
        const cmdName = data.split(':')[1];
        const ctx = buildContext(update, bridge, client);
        if (!ctx) return;
        ctx.args = [];
        const cmd = bridge.getCommand(cmdName);
        if (cmd?.handler) {
            try { await cmd.handler(ctx); } catch(e) { ctx.replyHTML(`❌ ${escapeHTML(e.message)}`); }
        } else {
            ctx.replyHTML(`💡 Type <code>/${escapeHTML(cmdName)}</code> to use this command!`);
        }
        return;
    }

    // Menu navigation — smooth edit in place
    if (!data.startsWith('m:')) return;

    const page = data.split(':')[1];

    switch (page) {
        case 'main':
            await editMsg(bridge, chatId, msgId, welcomeText(name), welcomeMarkup());
            break;

        case 'ai':
            await editMsg(bridge, chatId, msgId, PAGES.ai, subMarkup([
                [{ text: '💬 Ask Lydia AI', callback_data: 'cmd:lydia' }, { text: '🌐 Translate', callback_data: 'cmd:translate' }],
            ]));
            break;

        case 'games':
            await editMsg(bridge, chatId, msgId, PAGES.games, subMarkup([
                [{ text: '🎯 Trivia', callback_data: 'cmd:trivia' }, { text: '🔤 Word Guess', callback_data: 'cmd:wordguess' }],
                [{ text: '🎲 Roll Dice', callback_data: 'cmd:roll' }, { text: '🪙 Coin Flip', callback_data: 'cmd:coinflip' }],
            ]));
            break;

        case 'econ':
            await editMsg(bridge, chatId, msgId, PAGES.econ, subMarkup([
                [{ text: '🎁 Daily Reward', callback_data: 'cmd:daily' }, { text: '💰 Balance', callback_data: 'cmd:balance' }],
                [{ text: '📊 Rank', callback_data: 'cmd:rank' }, { text: '📋 Profile', callback_data: 'cmd:profile' }],
            ]));
            break;

        case 'util':
            await editMsg(bridge, chatId, msgId, PAGES.util, subMarkup([
                [{ text: '🌤️ Weather', callback_data: 'cmd:weather' }, { text: '💎 Crypto', callback_data: 'cmd:crypto' }],
                [{ text: '🌐 Translate', callback_data: 'cmd:translate' }, { text: '⏰ Reminder', callback_data: 'cmd:remind' }],
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
        // Auto lang — checks user preference first, falls back to Telegram language_code
        lang: (() => {
            try {
                const fs = require('fs');
                const db = JSON.parse(fs.readFileSync('/tmp/archon_user_langs.json', 'utf8'));
                return db[String(userId)] || msg?.from?.language_code || 'en';
            } catch { return msg?.from?.language_code || 'en'; }
        })(),
        t: (key, vars = {}) => {
            try {
                const { t: translate } = require('./plugins/../lang/index.js');
                const fs = require('fs');
                const db = JSON.parse(fs.readFileSync('/tmp/archon_user_langs.json', 'utf8'));
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
            const numLines = ctx.args[1] || '20';
            const LOG_PROCS = {
                'arch': 'Architect-CG223', 'bot': 'Architect-CG223', 'all': 'Architect-CG223',
                'dash': 'architect-dashboard', 'dashboard': 'architect-dashboard',
                'lava': 'lavalink', 'lavalink': 'lavalink',
                'wa': 'archon-wa', 'whatsapp': 'archon-wa',
            };
            const procName = LOG_PROCS[filter] || 'Architect-CG223';
            const isErr = filter === 'errors' || filter === 'err';
            try {
                let raw;
                if (isErr) {
                    raw = execSync(`pm2 logs Architect-CG223 --lines ${numLines} --nostream 2>&1 | grep -i error`).toString();
                } else {
                    raw = execSync(`pm2 logs ${procName} --lines ${numLines} --nostream 2>&1`).toString();
                }
                const cleaned = raw.trim().split('\n')
                    .filter(l => l.trim())
                    .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\d+\|[\w-]+\s*\|\s*/, '').trim())
                    .filter(Boolean).slice(-parseInt(numLines)).join('\n');
                const label = isErr ? '🔴 ERRORS' : filter === 'dash' || filter === 'dashboard' ? '🖥️ DASHBOARD' : filter === 'lava' || filter === 'lavalink' ? '🎵 LAVALINK' : '📋 BOT';
                await ctx.replyHTML(`${label} <b>${procName}</b> (${numLines} lines)\n━━━━━━━━━━━━━━━━\n<pre>${escapeHTML(cleaned.substring(0, 3500))}</pre>\n<i>${new Date().toLocaleTimeString()} · BAMAKO_223 🇲🇱</i>`);
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

    // ── NEW MEMBER JOIN (chat_member update) ──
    if (update.chat_member) {
        const cm = update.chat_member;
        const newStatus = cm.new_chat_member?.status;
        const oldStatus = cm.old_chat_member?.status;
        // Member joined = new status is member/administrator, old was left/kicked/restricted
        const joined = ['member','administrator','creator'].includes(newStatus) && 
                       ['left','kicked','restricted'].includes(oldStatus);
        if (!joined) return;
        const member = cm.new_chat_member?.user;
        if (!member || member.is_bot) return;
        const chatId = String(cm.chat.id);
        const chatTitle = cm.chat.title || 'the group';
        const joinMembers = [member];
        // Fall through to welcome logic below
        try {
            const db = client?.db;
            if (db) {
                try { db.prepare(`CREATE TABLE IF NOT EXISTS group_settings (chat_id TEXT PRIMARY KEY, welcome_enabled INTEGER DEFAULT 0, welcome_text TEXT, welcome_type TEXT DEFAULT 'random')`).run(); } catch {}
                const settings = db.prepare('SELECT * FROM group_settings WHERE chat_id = ?').get(chatId);
                if (settings?.welcome_enabled) {
                    const name = escapeHTML(member.first_name || member.username || 'Friend');
                    let msg;
                    if (settings.welcome_text) {
                        msg = settings.welcome_text
                            .replace(/{name}/g, `<a href="tg://user?id=${member.id}">${name}</a>`)
                            .replace(/{group}/g, escapeHTML(chatTitle));
                    } else {
                        try {
                            const { t } = require('./plugins/../lang/index.js');
                            const memberLang = member.language_code || 'en';
                            const rawMsg = t(memberLang, 'welcome_default', { name, group: escapeHTML(chatTitle) });
                            msg = rawMsg.replace(/{name}/g, `<a href="tg://user?id=${member.id}">${name}</a>`);
                        } catch(le) {
                            msg = `Hey <a href="tg://user?id=${member.id}">${name}</a>! Welcome to ${escapeHTML(chatTitle)}! 🦅`;
                        }
                    }
                    await bridge.sendTo(cm.chat.id, msg, { parse_mode: 'HTML' });
                }
            }
        } catch(e) { console.error('[WELCOME]', e.message); }
        return;
    }

    // ── NEW MEMBER JOIN (legacy message update) ──
    const joinMembers = update.message?.new_chat_members;
    if (joinMembers?.length) {
        const chatId = String(update.message.chat.id);
        const chatTitle = update.message.chat.title || 'the group';
        try {
            const welcomePlugin = require('./plugins/welcome.js');
            const db = client?.db;
            if (db) {
                try {
                    db.prepare(`CREATE TABLE IF NOT EXISTS group_settings (
                        chat_id TEXT PRIMARY KEY, welcome_enabled INTEGER DEFAULT 0,
                        welcome_text TEXT, welcome_type TEXT DEFAULT 'random'
                    )`).run();
                } catch {}
                const settings = db.prepare('SELECT * FROM group_settings WHERE chat_id = ?').get(chatId);
                if (settings?.welcome_enabled) {
                    for (const member of joinMembers) {
                        if (member.is_bot) continue;
                        const name = escapeHTML(member.first_name || member.username || 'Friend');
                        let msg;
                        if (settings.welcome_text) {
                            msg = settings.welcome_text
                                .replace(/{name}/g, `<a href="tg://user?id=${member.id}">${name}</a>`)
                                .replace(/{group}/g, escapeHTML(chatTitle));
                        } else {
                            const WELCOMES = [
                                `Hey <a href="tg://user?id=${member.id}">${name}</a>! Welcome to ${escapeHTML(chatTitle)}! 🦅`,
                                `🎉 <a href="tg://user?id=${member.id}">${name}</a> just joined! Say hello!`,
                                `Welcome aboard <a href="tg://user?id=${member.id}">${name}</a>! The node grows stronger 💪`,
                                `🚀 <a href="tg://user?id=${member.id}">${name}</a> has entered the chat! Glad you're here!`,
                                `<a href="tg://user?id=${member.id}">${name}</a> dropped in! Welcome to ${escapeHTML(chatTitle)} 🇲🇱`,
                            ];
                            msg = WELCOMES[Math.floor(Math.random() * WELCOMES.length)];
                        }
                        await bridge.sendTo(update.message.chat.id, msg, { parse_mode: 'HTML' });
                    }
                }
            }
        } catch(e) { console.error('[WELCOME]', e.message); }
        return;
    }

    // ── MEMBER LEFT ──
    const leftMember = update.message?.left_chat_member;
    if (leftMember && !leftMember.is_bot) {
        const chatId = String(update.message.chat.id);
        try {
            const db = client?.db;
            if (db) {
                const settings = db.prepare('SELECT * FROM group_settings WHERE chat_id = ?').get(chatId);
                if (settings?.welcome_enabled) {
                    const name = escapeHTML(leftMember.first_name || 'Someone');
                    await bridge.sendTo(update.message.chat.id,
                        `👋 ${name} has left the chat. See you around!`,
                        { parse_mode: 'HTML' }
                    );
                }
            }
        } catch(e) {}
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
                                // Debug — log update types
                                const uType = Object.keys(u).filter(k => k !== 'update_id')[0];
                                if (uType !== 'message' || u.message?.new_chat_members || u.message?.left_chat_member) {
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
