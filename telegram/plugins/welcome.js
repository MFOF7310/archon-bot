const fs = require('fs');
const https = require('https');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function tgApi(token, method, params) {
    return new Promise((res) => {
        const body = JSON.stringify(params);
        const req = https.request(`https://api.telegram.org/bot${token}/${method}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 15000 },
            (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d));}catch{res({ok:false});} }); }
        );
        req.on('error',()=>res({ok:false})); req.write(body); req.end();
    });
}

function getDb(client) {
    return client?.db;
}

function getSettings(db, chatId) {
    try {
        db.prepare(`CREATE TABLE IF NOT EXISTS group_settings (
            chat_id TEXT PRIMARY KEY,
            welcome_enabled INTEGER DEFAULT 0,
            welcome_text TEXT,
            welcome_type TEXT DEFAULT 'random',
            welcome_channel_id TEXT,
            welcome_thread_id TEXT,
            welcome_gif_id TEXT,
            goodbye_enabled INTEGER DEFAULT 0,
            goodbye_text TEXT,
            goodbye_gif_id TEXT,
            goodbye_channel_id TEXT,
            goodbye_thread_id TEXT
        )`).run();
        // Add missing columns
        const cols = ['welcome_channel_id','welcome_thread_id','welcome_gif_id','goodbye_enabled','goodbye_text','goodbye_gif_id','goodbye_channel_id','goodbye_thread_id'];
        for (const col of cols) {
            try { db.prepare(`ALTER TABLE group_settings ADD COLUMN ${col} TEXT`).run(); } catch(e) {}
        }
        return db.prepare('SELECT * FROM group_settings WHERE chat_id = ?').get(String(chatId));
    } catch(e) { return null; }
}

function saveSettings(db, chatId, updates) {
    const existing = getSettings(db, chatId);
    if (existing) {
        const keys = Object.keys(updates);
        const set = keys.map(k => `${k} = ?`).join(', ');
        db.prepare(`UPDATE group_settings SET ${set} WHERE chat_id = ?`).run(...Object.values(updates), String(chatId));
    } else {
        db.prepare('INSERT INTO group_settings (chat_id, ' + Object.keys(updates).join(', ') + ') VALUES (?, ' + Object.keys(updates).map(()=>'?').join(', ') + ')').run(String(chatId), ...Object.values(updates));
    }
}

const DEFAULT_WELCOMES = [
    "Hey {name}! Welcome to {group}! 🦅",
    "🎉 {name} just joined — say hello!",
    "Welcome aboard {name}! The node grows stronger 💪",
    "🚀 {name} has entered the chat! Glad you're here!",
    "{name} dropped in! Welcome to {group} 🇲🇱",
    "🌟 A new agent joins us — welcome {name}!",
    "Hey {name}! You made it! 🔥",
];

const DEFAULT_GOODBYES = [
    "👋 {name} has left the chat. See you around!",
    "😢 {name} just left. We'll miss you!",
    "👋 Goodbye {name}! Come back soon!",
    "{name} has disconnected from the node. 🌐",
];

module.exports = {
    name: 'welcome',
    aliases: ['goodbye', 'farewell', 'welcomeset'],
    description: 'Manage welcome & goodbye messages with GIF support',
    category: 'Moderation',
    usage: '/welcome <on|off|set|setchannel|setgif|setgoodbye|test>',

    // Called from bot.js on new member join
    sendWelcome: async (bridge, db, chatId, member, chatTitle) => {
        const settings = getSettings(db, chatId);
        if (!settings?.welcome_enabled) return;

        const name = escapeHTML(member.first_name || member.username || 'Friend');
        const group = escapeHTML(chatTitle || 'the group');
        
        // Build message text
        let text;
        if (settings.welcome_text) {
            text = settings.welcome_text
                .replace(/{name}/g, `<a href="tg://user?id=${member.id}">${name}</a>`)
                .replace(/{group}/g, group);
        } else {
            const random = DEFAULT_WELCOMES[Math.floor(Math.random() * DEFAULT_WELCOMES.length)];
            text = random
                .replace(/{name}/g, `<a href="tg://user?id=${member.id}">${name}</a>`)
                .replace(/{group}/g, group);
        }

        // Determine target channel/thread
        const targetChat = settings.welcome_channel_id || chatId;
        const threadId = settings.welcome_thread_id ? parseInt(settings.welcome_thread_id) : undefined;

        const params = {
            chat_id: targetChat,
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId }),
        };

        // Send GIF or text
        if (settings.welcome_gif_id) {
            await tgApi(bridge.token, 'sendAnimation', {
                ...params,
                animation: settings.welcome_gif_id,
                caption: text,
            });
        } else {
            await tgApi(bridge.token, 'sendMessage', {
                ...params,
                text,
            });
        }
    },

    // Called from bot.js on member leave
    sendGoodbye: async (bridge, db, chatId, member, chatTitle) => {
        const settings = getSettings(db, chatId);
        if (!settings?.goodbye_enabled) return;

        const name = escapeHTML(member.first_name || member.username || 'Friend');
        const group = escapeHTML(chatTitle || 'the group');

        let text;
        if (settings.goodbye_text) {
            text = settings.goodbye_text.replace(/{name}/g, name).replace(/{group}/g, group);
        } else {
            const random = DEFAULT_GOODBYES[Math.floor(Math.random() * DEFAULT_GOODBYES.length)];
            text = random.replace(/{name}/g, name).replace(/{group}/g, group);
        }

        const targetChat = settings.goodbye_channel_id || settings.welcome_channel_id || chatId;
        const threadId = settings.goodbye_thread_id || settings.welcome_thread_id;

        const params = {
            chat_id: targetChat,
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: parseInt(threadId) }),
        };

        if (settings.goodbye_gif_id) {
            await tgApi(bridge.token, 'sendAnimation', {
                ...params,
                animation: settings.goodbye_gif_id,
                caption: text,
            });
        } else {
            await tgApi(bridge.token, 'sendMessage', { ...params, text });
        }
    },

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ Groups only!`);
        const isAdmin = await ctx.isAdmin();
        const isOwner = ctx.isOwner();
        if (!isAdmin && !isOwner) return ctx.replyHTML(`⛔ Admins only.`);

        const db = ctx.client?.db;
        if (!db) return ctx.replyHTML(`❌ Database not available.`);

        const chatId = String(ctx.chatId);
        const action = ctx.args[0]?.toLowerCase();
        console.log('[WELCOME DEBUG] action:', action, 'args:', ctx.args);
        const settings = getSettings(db, chatId) || {};

        // ── ON ──
        if (action === 'on') {
            saveSettings(db, chatId, { welcome_enabled: 1 });
            return ctx.replyHTML(`✅ <b>Welcome messages ON!</b>

I'll greet new members${settings.welcome_channel_id ? ' in the configured channel' : ' here'}.

🦅 ARCHON CG-223`);
        }

        // ── OFF ──
        if (action === 'off') {
            saveSettings(db, chatId, { welcome_enabled: 0 });
            return ctx.replyHTML(`🔴 <b>Welcome messages OFF.</b>

🦅 ARCHON CG-223`);
        }

        // ── SET TEXT ──
        if (action === 'set') {
            const text = ctx.args.slice(1).join(' ');
            if (!text) return ctx.replyHTML(
                `💡 <b>Set welcome text:</b>
<code>/welcome set Hello {name}! Welcome to {group}!</code>

` +
                `Variables: <code>{name}</code> <code>{group}</code>`
            );
            saveSettings(db, chatId, { welcome_text: text });
            return ctx.replyHTML(`✅ Welcome text updated!

<b>Preview:</b>
${text.replace(/{name}/g, 'Friend').replace(/{group}/g, ctx.message?.chat?.title || 'Group')}

🦅 ARCHON CG-223`);
        }

        // ── SET GOODBYE TEXT ──
        if (action === 'setgoodbye' || action === 'goodbye') {
            const sub = ctx.args[1]?.toLowerCase();
            if (sub === 'on') {
                saveSettings(db, chatId, { goodbye_enabled: 1 });
                return ctx.replyHTML(`✅ <b>Goodbye messages ON!</b>

🦅 ARCHON CG-223`);
            }
            if (sub === 'off') {
                saveSettings(db, chatId, { goodbye_enabled: 0 });
                return ctx.replyHTML(`🔴 <b>Goodbye messages OFF.</b>`);
            }
            const text = ctx.args.slice(1).join(' ');
            if (!text) return ctx.replyHTML(`💡 Usage: <code>/welcome setgoodbye Goodbye {name}! 👋</code>`);
            saveSettings(db, chatId, { goodbye_text: text, goodbye_enabled: 1 });
            return ctx.replyHTML(`✅ Goodbye text set!

<b>Preview:</b>
${text.replace(/{name}/g, 'Friend')}

🦅 ARCHON CG-223`);
        }

        // ── SET CHANNEL ──
        if (action === 'setchannel') {
            console.log('[SETCHANNEL] chatId:', ctx.chatId, 'threadId:', ctx.message?.message_thread_id);
            const threadId = ctx.message?.message_thread_id;
            const chatTitle = ctx.message?.chat?.title || 'this group';
            saveSettings(db, chatId, {
                welcome_channel_id: chatId,
                welcome_thread_id: threadId ? String(threadId) : null,
            });
            const where = threadId
                ? `<b><i>this topic</i></b>`
                : `<b><i>${escapeHTML(chatTitle)}</i></b>`;

            console.log('[SETCHANNEL] sending...');
            const tgBody = {
                chat_id: ctx.chatId,
                text: '📌 Welcome channel set!\n\nNew members will be greeted in ' + (threadId ? 'this topic' : chatTitle) + ' 🎉\n\n🦅 ARCHON CG-223',
                parse_mode: 'HTML'
            };
            if (threadId) tgBody.message_thread_id = parseInt(threadId);
            const sent = await tgApi(ctx.bridge.token, 'sendMessage', tgBody);
            console.log('[SETCHANNEL] result:', sent && sent.ok, sent && sent.description);
            const msgId = sent && sent.result && sent.result.message_id;
            if (msgId) {
                setTimeout(() => {
                    tgApi(ctx.bridge.token, 'deleteMessage', { chat_id: ctx.chatId, message_id: msgId }).catch(() => {});
                }, 2 * 60 * 1000);
            }
            return;
        }

        // ── SET GOODBYE CHANNEL ──
        if (action === 'setgoodbyechannel') {
            const threadId = ctx.message?.message_thread_id;
            saveSettings(db, chatId, {
                goodbye_channel_id: chatId,
                goodbye_thread_id: threadId ? String(threadId) : null,
            });
            return ctx.replyHTML(`📌 <b>Goodbye channel set!</b>

Goodbye messages will be sent here.

🦅 ARCHON CG-223`);
        }

        // ── SET GIF ──
        if (action === 'setgif') {
            const reply = ctx.message?.reply_to_message;
            const gif = reply?.animation || reply?.document;
            if (!gif) return ctx.replyHTML(
                `💡 <b>How to set a welcome GIF:</b>

` +
                `1. Find a GIF you like in Telegram
` +
                `2. Reply to it with <code>/welcome setgif</code>

` +
                `The bot will use that GIF for all welcome messages! 🎬`
            );
            saveSettings(db, chatId, { welcome_gif_id: gif.file_id });
            return ctx.replyHTML(`✅ <b>Welcome GIF set!</b>

I'll send this GIF when new members join.

🦅 ARCHON CG-223`);
        }

        // ── SET GOODBYE GIF ──
        if (action === 'setgoodbyegif') {
            const reply = ctx.message?.reply_to_message;
            const gif = reply?.animation || reply?.document;
            if (!gif) return ctx.replyHTML(`💡 Reply to a GIF with <code>/welcome setgoodbyegif</code>`);
            saveSettings(db, chatId, { goodbye_gif_id: gif.file_id });
            return ctx.replyHTML(`✅ <b>Goodbye GIF set!</b>

🦅 ARCHON CG-223`);
        }

        // ── CLEAR GIF ──
        if (action === 'cleargif') {
            saveSettings(db, chatId, { welcome_gif_id: null });
            return ctx.replyHTML(`✅ Welcome GIF removed — text only mode.`);
        }

        // ── TEST ──
        if (action === 'test') {
            const fakeMember = { id: ctx.userId, first_name: ctx.username };
            const chatTitle = ctx.message?.chat?.title || 'Test Group';
            
            // Use sendWelcome function
            const welcomePlugin = require('./welcome.js');
            await welcomePlugin.sendWelcome(ctx.bridge, db, chatId, fakeMember, chatTitle);
            return ctx.replyHTML(`✅ Welcome test sent!`);
        }

        // ── STATUS / HELP ──
        const s = settings;
        await ctx.replyHTML(
            `👋 <b>Welcome & Goodbye Settings</b>
━━━━━━━━━━━━━━━━

` +
            `<b>Welcome:</b> ${s.welcome_enabled ? '🟢 ON' : '🔴 OFF'}
` +
            `<b>GIF:</b> ${s.welcome_gif_id ? '✅ Set' : '❌ None'}
` +
            `<b>Channel:</b> ${s.welcome_thread_id ? `Topic #${s.welcome_thread_id}` : s.welcome_channel_id ? 'Custom channel' : 'Default (here)'}
` +
            `<b>Text:</b> ${s.welcome_text ? s.welcome_text.substring(0,50)+'...' : 'Random default'}

` +
            `<b>Goodbye:</b> ${s.goodbye_enabled ? '🟢 ON' : '🔴 OFF'}
` +
            `<b>Goodbye GIF:</b> ${s.goodbye_gif_id ? '✅ Set' : '❌ None'}

` +
            `━━━━━━━━━━━━━━━━
` +
            `<code>/welcome on/off</code> — Toggle
` +
            `<code>/welcome set {name} welcome!</code> — Custom text
` +
            `<code>/welcome setchannel</code> — Run IN the target topic
` +
            `<code>/welcome setgif</code> — Reply to GIF to set it
` +
            `<code>/welcome cleargif</code> — Remove GIF
` +
            `<code>/welcome setgoodbye on/off</code> — Goodbye toggle
` +
            `<code>/welcome setgoodbyegif</code> — Reply to GIF
` +
            `<code>/welcome test</code> — Preview

` +
            `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
        );
    }
};
