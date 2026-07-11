const https = require('https');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function tgApi(token, method, params) {
    return new Promise((res) => {
        const body = JSON.stringify(params);
        const req = https.request(`https://api.telegram.org/bot${token}/${method}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 },
            (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d));}catch{res({ok:false});} }); }
        );
        req.on('error',()=>res({ok:false})); req.write(body); req.end();
    });
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
            goodbye_thread_id TEXT,
            antilink_enabled INTEGER DEFAULT 0,
            antiflood_enabled INTEGER DEFAULT 0,
            antiflood_limit INTEGER DEFAULT 5,
            slowmode_seconds INTEGER DEFAULT 0,
            rules_text TEXT,
            auto_delete_joins INTEGER DEFAULT 0
        )`).run();

        const cols = ['antilink_enabled','antiflood_enabled','antiflood_limit','slowmode_seconds','rules_text','auto_delete_joins','welcome_channel_id','welcome_thread_id','welcome_gif_id','goodbye_enabled','goodbye_text','goodbye_gif_id','goodbye_channel_id','goodbye_thread_id'];
        for (const col of cols) {
            try { db.prepare(`ALTER TABLE group_settings ADD COLUMN ${col} TEXT`).run(); } catch(e) {}
        }

        return db.prepare('SELECT * FROM group_settings WHERE chat_id = ?').get(String(chatId)) || {};
    } catch(e) { return {}; }
}

function saveSettings(db, chatId, updates) {
    try {
        const existing = db.prepare('SELECT chat_id FROM group_settings WHERE chat_id = ?').get(String(chatId));
        if (existing) {
            const keys = Object.keys(updates);
            const set = keys.map(k => `${k} = ?`).join(', ');
            db.prepare(`UPDATE group_settings SET ${set} WHERE chat_id = ?`).run(...Object.values(updates), String(chatId));
        } else {
            const keys = Object.keys(updates);
            db.prepare(`INSERT INTO group_settings (chat_id, ${keys.join(', ')}) VALUES (?, ${keys.map(()=>'?').join(', ')})`).run(String(chatId), ...Object.values(updates));
        }
    } catch(e) { console.error('[SETTINGS]', e.message); }
}

function buildMainMenu(s, groupName) {
    const w = s.welcome_enabled ? '✅' : '❌';
    const al = s.antilink_enabled ? '✅' : '❌';
    const af = s.antiflood_enabled ? '✅' : '❌';
    const gb = s.goodbye_enabled ? '✅' : '❌';
    const rl = s.rules_text ? '✅' : '❌';

    const text =
        `⚙️ <b>Group Settings</b>\n` +
        `📍 ${escapeHTML(groupName)}\n━━━━━━━━━━━━━━━━\n\n` +
        `Here's what I'm managing right now 👇\n\n` +
        `👋 Welcome messages  ${w}\n` +
        `👋 Goodbye messages  ${gb}\n` +
        `🔗 Antilink          ${al}\n` +
        `⚡ Antiflood         ${af}\n` +
        `📋 Rules             ${rl}\n\n` +
        `Tap anything to change it 😊\n\n` +
        `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: `👋 Welcome ${w}`, callback_data: 'gs_welcome' },
                { text: `👋 Goodbye ${gb}`, callback_data: 'gs_goodbye' },
            ],
            [
                { text: `🔗 Antilink ${al}`, callback_data: 'gs_antilink' },
                { text: `⚡ Antiflood ${af}`, callback_data: 'gs_antiflood' },
            ],
            [
                { text: `📋 Rules ${rl}`, callback_data: 'gs_rules' },
                { text: `👮 Admins`, callback_data: 'gs_admins' },
            ],
            [
                { text: `🤖 Auto-Reply`, callback_data: 'gs_autoreply' },
                { text: `📊 Group Stats`, callback_data: 'gs_stats' },
            ],
            [
                { text: '🔄 Refresh', callback_data: 'gs_refresh' },
            ]
        ]
    };

    return { text, keyboard };
}

module.exports = {
    name: 'settings',
    aliases: ['panel', 'config', 'manage', 'setup'],
    description: 'Group management panel',
    category: 'Moderation',
    usage: '/settings',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ This command only works in groups!`);
        if (!await ctx.isAdmin() && !ctx.isOwner()) return ctx.replyHTML(`⛔ You need to be an admin to use this!`);

        const db = ctx.client?.db;
        if (!db) return ctx.replyHTML(`❌ Database not available.`);

        const s = getSettings(db, ctx.chatId);
        const groupName = ctx.message?.chat?.title || 'this group';
        const { text, keyboard } = buildMainMenu(s, groupName);

        await ctx.bridge.sendTo(ctx.chatId, text, {
            parse_mode: 'HTML',
            extra: { reply_markup: keyboard }
        });
    },

    // Exported for callback handler
    handleCallback: async (ctx, data, bridge, db, chatId, msgId, groupName) => {
        const s = getSettings(db, chatId);

        // ── REFRESH ──
        if (data === 'gs_refresh') {
            const { text, keyboard } = buildMainMenu(s, groupName);
            await bridge.editMessage(chatId, msgId, text, { parse_mode: 'HTML', reply_markup: keyboard });
            return;
        }

        // ── WELCOME ──
        if (data === 'gs_welcome') {
            const newVal = s.welcome_enabled ? 0 : 1;
            saveSettings(db, chatId, { welcome_enabled: newVal });
            const status = newVal ? 'ON ✅' : 'OFF ❌';
            const msg =
                `👋 <b>Welcome Messages</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `Status: <b>${status}</b>\n\n` +
                (newVal ?
                    `New members will be greeted when they join!\n\n` +
                    `💡 Customize with:\n` +
                    `<code>/welcome set Hey {name}! Welcome!</code>\n` +
                    `<code>/welcome setgif</code> — Add a GIF\n` +
                    `<code>/welcome setchannel</code> — Set topic` :
                    `Welcome messages are now off.`
                ) + `\n\n🦅 ARCHON CG-223`;
            await bridge.editMessage(chatId, msgId, msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [{ text: newVal ? '🔴 Turn OFF' : '🟢 Turn ON', callback_data: 'gs_welcome' }],
                    [{ text: '← Back to Settings', callback_data: 'gs_main' }]
                ]}
            });
            return;
        }

        // ── GOODBYE ──
        if (data === 'gs_goodbye') {
            const newVal = s.goodbye_enabled ? 0 : 1;
            saveSettings(db, chatId, { goodbye_enabled: newVal });
            const status = newVal ? 'ON ✅' : 'OFF ❌';
            const msg =
                `👋 <b>Goodbye Messages</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `Status: <b>${status}</b>\n\n` +
                (newVal ?
                    `I'll say goodbye when members leave!\n\n` +
                    `💡 Customize with:\n` +
                    `<code>/welcome setgoodbye Bye {name}! 👋</code>\n` +
                    `<code>/welcome setgoodbyegif</code> — Add a GIF` :
                    `Goodbye messages are now off.`
                ) + `\n\n🦅 ARCHON CG-223`;
            await bridge.editMessage(chatId, msgId, msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [{ text: newVal ? '🔴 Turn OFF' : '🟢 Turn ON', callback_data: 'gs_goodbye' }],
                    [{ text: '← Back to Settings', callback_data: 'gs_main' }]
                ]}
            });
            return;
        }

        // ── ANTILINK ──
        if (data === 'gs_antilink') {
            const newVal = s.antilink_enabled ? 0 : 1;
            saveSettings(db, chatId, { antilink_enabled: newVal });
            const status = newVal ? 'ON ✅' : 'OFF ❌';
            const msg =
                `🔗 <b>Antilink</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `Status: <b>${status}</b>\n\n` +
                (newVal ?
                    `Links from non-admins will be automatically deleted! 🛡️\n\n` +
                    `Admins are exempt from this rule.` :
                    `Links are now allowed in this group.`
                ) + `\n\n🦅 ARCHON CG-223`;
            await bridge.editMessage(chatId, msgId, msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [{ text: newVal ? '🔴 Turn OFF' : '🟢 Turn ON', callback_data: 'gs_antilink' }],
                    [{ text: '← Back to Settings', callback_data: 'gs_main' }]
                ]}
            });
            return;
        }

        // ── ANTIFLOOD ──
        if (data === 'gs_antiflood') {
            const newVal = s.antiflood_enabled ? 0 : 1;
            saveSettings(db, chatId, { antiflood_enabled: newVal });
            const limit = s.antiflood_limit || 5;
            const status = newVal ? 'ON ✅' : 'OFF ❌';
            const msg =
                `⚡ <b>Antiflood</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `Status: <b>${status}</b>\n` +
                `Limit: <b>${limit} messages</b> in 10 seconds\n\n` +
                (newVal ?
                    `Spammers will be muted automatically! ⚡\n\n` +
                    `💡 Adjust limit:\n` +
                    `<code>/antiflood 3</code> — Strict\n` +
                    `<code>/antiflood 10</code> — Relaxed` :
                    `Flood protection is now off.`
                ) + `\n\n🦅 ARCHON CG-223`;
            await bridge.editMessage(chatId, msgId, msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [{ text: newVal ? '🔴 Turn OFF' : '🟢 Turn ON', callback_data: 'gs_antiflood' }],
                    [{ text: '← Back to Settings', callback_data: 'gs_main' }]
                ]}
            });
            return;
        }

        // ── RULES ──
        if (data === 'gs_rules') {
            const rules = s.rules_text;
            const msg =
                `📋 <b>Group Rules</b>\n━━━━━━━━━━━━━━━━\n\n` +
                (rules ?
                    `Current rules:\n\n${escapeHTML(rules)}\n\n` +
                    `💡 Update with:\n<code>/rules set Your rules here</code>` :
                    `No rules set yet!\n\n💡 Add rules:\n<code>/rules set Be respectful!\nNo spam!\nNo links!</code>`
                ) + `\n\n🦅 ARCHON CG-223`;
            await bridge.editMessage(chatId, msgId, msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [{ text: '← Back to Settings', callback_data: 'gs_main' }]
                ]}
            });
            return;
        }

        // ── ADMINS ──
        if (data === 'gs_admins') {
            const msg =
                `👮 <b>Admin Commands</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `<code>/kick</code> — Reply to kick someone\n` +
                `<code>/ban</code> — Reply to ban someone\n` +
                `<code>/unban &lt;id&gt;</code> — Unban a user\n` +
                `<code>/mute</code> — Reply to mute someone\n` +
                `<code>/warn</code> — Reply to warn someone\n` +
                `<code>/pin</code> — Reply to pin a message\n` +
                `<code>/admins</code> — List all admins\n` +
                `<code>/promote</code> — Promote to admin\n` +
                `<code>/demote</code> — Remove admin rights\n\n` +
                `🦅 ARCHON CG-223`;
            await bridge.editMessage(chatId, msgId, msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [{ text: '← Back to Settings', callback_data: 'gs_main' }]
                ]}
            });
            return;
        }

        // ── AUTO-REPLY ──
        if (data === 'gs_autoreply') {
            const msg =
                `🤖 <b>Auto-Reply Filters</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `Auto-reply responds when someone says a keyword!\n\n` +
                `<code>/filter &lt;keyword&gt; &lt;response&gt;</code>\n` +
                `↳ This chat only\n\n` +
                `<code>/gfilter &lt;keyword&gt; &lt;response&gt;</code>\n` +
                `↳ All groups\n\n` +
                `<code>/filters</code> — See active filters\n` +
                `<code>/stop &lt;keyword&gt;</code> — Remove filter\n\n` +
                `💡 Example:\n` +
                `<code>/filter website Check bamako-steel-dev.xyz!</code>\n\n` +
                `🦅 ARCHON CG-223`;
            await bridge.editMessage(chatId, msgId, msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [{ text: '← Back to Settings', callback_data: 'gs_main' }]
                ]}
            });
            return;
        }

        // ── STATS ──
        if (data === 'gs_stats') {
            const msg =
                `📊 <b>Group Stats</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `👋 Welcome: ${s.welcome_enabled ? 'ON ✅' : 'OFF ❌'}\n` +
                `👋 Goodbye: ${s.goodbye_enabled ? 'ON ✅' : 'OFF ❌'}\n` +
                `🔗 Antilink: ${s.antilink_enabled ? 'ON ✅' : 'OFF ❌'}\n` +
                `⚡ Antiflood: ${s.antiflood_enabled ? `ON (${s.antiflood_limit||5} msgs) ✅` : 'OFF ❌'}\n` +
                `📋 Rules: ${s.rules_text ? 'Set ✅' : 'Not set ❌'}\n` +
                `🎬 Welcome GIF: ${s.welcome_gif_id ? 'Set ✅' : 'None ❌'}\n` +
                `📍 Welcome Channel: ${s.welcome_thread_id ? `Topic #${s.welcome_thread_id}` : 'Default ✅'}\n\n` +
                `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;
            await bridge.editMessage(chatId, msgId, msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [
                    [{ text: '← Back to Settings', callback_data: 'gs_main' }]
                ]}
            });
            return;
        }

        // ── BACK TO MAIN ──
        if (data === 'gs_main') {
            const fresh = getSettings(db, chatId);
            const { text, keyboard } = buildMainMenu(fresh, groupName);
            await bridge.editMessage(chatId, msgId, text, { parse_mode: 'HTML', reply_markup: keyboard });
            return;
        }
    }
};
