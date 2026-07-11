const https = require('https');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function tgApi(token, method, params) {
    return new Promise((res) => {
        const body = JSON.stringify(params);
        const req = https.request('https://api.telegram.org/bot' + token + '/' + method,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 },
            (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d));}catch{res({ok:false});} }); }
        );
        req.on('error',()=>res({ok:false})); req.write(body); req.end();
    });
}

if (!global._settingsPanels) global._settingsPanels = new Map();
const PANEL_TIMEOUT = 2 * 60 * 1000;

function clearPanel(chatId, bridge) {
    const panel = global._settingsPanels.get(String(chatId));
    if (!panel) return;
    clearTimeout(panel.timer);
    global._settingsPanels.delete(String(chatId));
    if (panel.msgId && bridge) {
        tgApi(bridge.token, 'deleteMessage', { chat_id: chatId, message_id: panel.msgId }).catch(() => {});
    }
}

function resetTimer(chatId, bridge) {
    const panel = global._settingsPanels.get(String(chatId));
    if (!panel) return;
    clearTimeout(panel.timer);
    panel.lastActivity = Date.now();
    panel.timer = setTimeout(() => {
        tgApi(bridge.token, 'editMessageText', {
            chat_id: chatId, message_id: panel.msgId,
            text: '💤 Settings panel closed — no activity for 2 minutes.\n\nType /settings to reopen anytime! 😊\n\n🦅 ARCHON CG-223',
            parse_mode: 'HTML'
        }).catch(() => {});
        setTimeout(() => clearPanel(chatId, bridge), 5000);
    }, PANEL_TIMEOUT);
    global._settingsPanels.set(String(chatId), panel);
}

function getSettings(db, chatId) {
    try {
        const cols = ['antilink_enabled','antiflood_enabled','antiflood_limit','slowmode_seconds','rules_text','welcome_channel_id','welcome_thread_id','welcome_gif_id','goodbye_enabled','goodbye_text','goodbye_gif_id','goodbye_channel_id','goodbye_thread_id'];
        for (const col of cols) {
            try { db.prepare('ALTER TABLE group_settings ADD COLUMN ' + col + ' TEXT').run(); } catch(e) {}
        }
        return db.prepare('SELECT * FROM group_settings WHERE chat_id = ?').get(String(chatId)) || {};
    } catch(e) { return {}; }
}

function saveSettings(db, chatId, updates) {
    try {
        const existing = db.prepare('SELECT chat_id FROM group_settings WHERE chat_id = ?').get(String(chatId));
        if (existing) {
            const keys = Object.keys(updates);
            const set = keys.map(k => k + ' = ?').join(', ');
            db.prepare('UPDATE group_settings SET ' + set + ' WHERE chat_id = ?').run(...Object.values(updates), String(chatId));
        } else {
            const keys = Object.keys(updates);
            db.prepare('INSERT INTO group_settings (chat_id, ' + keys.join(', ') + ') VALUES (?, ' + keys.map(()=>'?').join(', ') + ')').run(String(chatId), ...Object.values(updates));
        }
    } catch(e) {}
}

function getFilterCount(chatId) {
    try {
        const fs = require('fs');
        const db = JSON.parse(fs.readFileSync('/tmp/archon_filters.json', 'utf8'));
        return [`c:${chatId}`,`g:${chatId}`].reduce((s,k) => s + Object.keys(db[k]||{}).length, 0);
    } catch { return 0; }
}

function buildMainPanel(s, groupName, chatId) {
    const w  = s.welcome_enabled   ? '🟢' : '🔴';
    const gb = s.goodbye_enabled   ? '🟢' : '🔴';
    const al = s.antilink_enabled  ? '🟢' : '🔴';
    const af = s.antiflood_enabled ? '🟢' : '🔴';
    const rl = s.rules_text        ? '✅' : '➕';
    const filters = getFilterCount(chatId);
    const gif = s.welcome_gif_id   ? '🎬' : '📝';
    const channel = s.welcome_thread_id ? 'Topic #' + s.welcome_thread_id : 'Default';

    const text =
        '⚙️ <b>Group Settings</b>\n' +
        '📍 <b>' + escapeHTML(groupName) + '</b>\n' +
        '━━━━━━━━━━━━━━━━\n\n' +
        'Here\'s what I\'m managing right now 👇\n\n' +
        w + ' <b>Welcome</b>  ' + gif + ' ' + channel + '\n' +
        gb + ' <b>Goodbye</b>\n' +
        al + ' <b>Antilink</b>\n' +
        af + ' <b>Antiflood</b>  ' + (s.antiflood_enabled ? '(' + (s.antiflood_limit||5) + ' msgs/10s)' : '') + '\n' +
        rl + ' <b>Rules</b>  ' + (s.rules_text ? '(set)' : '(not set)') + '\n' +
        '🤖 <b>Auto-Reply</b>  ' + (filters > 0 ? filters + ' active' : 'none') + '\n\n' +
        '💡 Tap anything to toggle or configure\n' +
        '⏱ Closes after 2min inactivity\n\n' +
        '🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱';

    const keyboard = {
        inline_keyboard: [
            [{ text: w + ' Welcome', callback_data: 'gs_welcome' }, { text: gb + ' Goodbye', callback_data: 'gs_goodbye' }],
            [{ text: al + ' Antilink', callback_data: 'gs_antilink' }, { text: af + ' Antiflood', callback_data: 'gs_antiflood' }],
            [{ text: rl + ' Rules', callback_data: 'gs_rules' }, { text: '👮 Admins', callback_data: 'gs_admins' }],
            [{ text: '🤖 Auto-Reply (' + filters + ')', callback_data: 'gs_autoreply' }, { text: '📊 Full Stats', callback_data: 'gs_stats' }],
            [{ text: '🔄 Refresh', callback_data: 'gs_refresh' }, { text: '❌ Close', callback_data: 'gs_close' }]
        ]
    };
    return { text, keyboard };
}

module.exports = {
    name: 'settings',
    aliases: ['panel', 'config', 'manage', 'setup', 'grp'],
    description: 'Smart group management panel — auto-closing, live data',
    category: 'Moderation',
    usage: '/settings',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML('⚠️ This only works in groups!');
        if (!await ctx.isAdmin() && !ctx.isOwner()) return ctx.replyHTML('⛔ You need to be an admin to open settings!');

        const db = ctx.client && ctx.client.db;
        if (!db) return ctx.replyHTML('❌ Database not available right now.');

        const chatId = String(ctx.chatId);
        const groupName = ctx.message && ctx.message.chat && ctx.message.chat.title || 'this group';

        // Close existing panel
        const existing = global._settingsPanels.get(chatId);
        if (existing) {
            clearTimeout(existing.timer);
            tgApi(ctx.bridge.token, 'deleteMessage', { chat_id: chatId, message_id: existing.msgId }).catch(() => {});
            global._settingsPanels.delete(chatId);
            await new Promise(r => setTimeout(r, 400));
        }

        const s = getSettings(db, chatId);
        const { text, keyboard } = buildMainPanel(s, groupName, chatId);

        const result = await ctx.bridge.sendTo(ctx.chatId, text, {
            parse_mode: 'HTML',
            extra: { reply_markup: keyboard }
        });

        const msgId = result && result.data && result.data.message_id;
        if (!msgId) return;

        const timer = setTimeout(() => {
            tgApi(ctx.bridge.token, 'editMessageText', {
                chat_id: ctx.chatId, message_id: msgId,
                text: '💤 Settings panel closed — no activity for 2 minutes.\n\nType /settings anytime to reopen! 😊\n\n🦅 ARCHON CG-223',
                parse_mode: 'HTML'
            }).catch(() => {});
            setTimeout(() => {
                tgApi(ctx.bridge.token, 'deleteMessage', { chat_id: ctx.chatId, message_id: msgId }).catch(() => {});
                global._settingsPanels.delete(chatId);
            }, 5000);
        }, PANEL_TIMEOUT);

        global._settingsPanels.set(chatId, { msgId, userId: ctx.userId, timer, lastActivity: Date.now(), groupName });
    },

    handleCallback: async (ctx, data, bridge, db, chatId, msgId, groupName) => {
        const panel = global._settingsPanels.get(String(chatId));

        if (panel && String(ctx.userId) !== String(panel.userId) && !ctx.isOwner()) {
            await tgApi(bridge.token, 'answerCallbackQuery', {
                callback_query_id: ctx.callbackQueryId,
                text: '⛔ Only the admin who opened this can use it!',
                show_alert: true
            });
            return;
        }

        if (panel) resetTimer(chatId, bridge);

        const s = getSettings(db, chatId);
        const gName = (panel && panel.groupName) || groupName;
        const backRow = [{ text: '← Back', callback_data: 'gs_main' }, { text: '❌ Close', callback_data: 'gs_close' }];

        if (data === 'gs_close') {
            await tgApi(bridge.token, 'editMessageText', {
                chat_id: chatId, message_id: msgId,
                text: '✅ Settings closed!\n\nType /settings anytime 😊\n\n🦅 ARCHON CG-223',
                parse_mode: 'HTML'
            });
            setTimeout(() => {
                tgApi(bridge.token, 'deleteMessage', { chat_id: chatId, message_id: msgId }).catch(() => {});
            }, 5000);
            if (panel) { clearTimeout(panel.timer); global._settingsPanels.delete(String(chatId)); }
            return;
        }

        if (data === 'gs_refresh' || data === 'gs_main') {
            const fresh = getSettings(db, chatId);
            const { text, keyboard } = buildMainPanel(fresh, gName, chatId);
            await bridge.editMessage(chatId, msgId, text, { parse_mode: 'HTML', reply_markup: keyboard });
            return;
        }

        if (data === 'gs_welcome') {
            const newVal = s.welcome_enabled ? 0 : 1;
            saveSettings(db, chatId, { welcome_enabled: newVal });
            const status = newVal ? 'ON 🟢' : 'OFF 🔴';
            await bridge.editMessage(chatId, msgId,
                '👋 Welcome messages ' + status + '!\n\n' +
                (newVal ? 'Members will be greeted when they join 🎉' : 'No more welcome messages.') +
                '\n\n⏱ Refreshing...',
                { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
            );
            await new Promise(r => setTimeout(r, 1500));
            const fresh = getSettings(db, chatId);
            const { text, keyboard } = buildMainPanel(fresh, gName, chatId);
            await bridge.editMessage(chatId, msgId, text, { parse_mode: 'HTML', reply_markup: keyboard });
            return;
        }

        if (data === 'gs_goodbye') {
            const newVal = s.goodbye_enabled ? 0 : 1;
            saveSettings(db, chatId, { goodbye_enabled: newVal });
            await bridge.editMessage(chatId, msgId,
                '👋 Goodbye messages ' + (newVal ? 'ON 🟢' : 'OFF 🔴') + '!\n\n' +
                (newVal ? 'I\'ll say goodbye when members leave 👋' : 'No more goodbye messages.') +
                '\n\n⏱ Refreshing...',
                { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
            );
            await new Promise(r => setTimeout(r, 1500));
            const fresh2 = getSettings(db, chatId);
            const { text: t2, keyboard: k2 } = buildMainPanel(fresh2, gName, chatId);
            await bridge.editMessage(chatId, msgId, t2, { parse_mode: 'HTML', reply_markup: k2 });
            return;
        }

        if (data === 'gs_antilink') {
            const newVal = s.antilink_enabled ? 0 : 1;
            saveSettings(db, chatId, { antilink_enabled: newVal });
            await bridge.editMessage(chatId, msgId,
                '🔗 Antilink ' + (newVal ? 'ON 🟢 — Links will be deleted!' : 'OFF 🔴 — Links are allowed.') +
                '\n\n⏱ Refreshing...',
                { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
            );
            await new Promise(r => setTimeout(r, 1500));
            const fresh3 = getSettings(db, chatId);
            const { text: t3, keyboard: k3 } = buildMainPanel(fresh3, gName, chatId);
            await bridge.editMessage(chatId, msgId, t3, { parse_mode: 'HTML', reply_markup: k3 });
            return;
        }

        if (data === 'gs_antiflood') {
            const newVal = s.antiflood_enabled ? 0 : 1;
            saveSettings(db, chatId, { antiflood_enabled: newVal });
            const limit = s.antiflood_limit || 5;
            await bridge.editMessage(chatId, msgId,
                '⚡ Antiflood ' + (newVal ? 'ON 🟢 — Spammers get muted! (' + limit + ' msgs/10s)' : 'OFF 🔴 — No flood protection.') +
                '\n\n⏱ Refreshing...',
                { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
            );
            await new Promise(r => setTimeout(r, 1500));
            const fresh4 = getSettings(db, chatId);
            const { text: t4, keyboard: k4 } = buildMainPanel(fresh4, gName, chatId);
            await bridge.editMessage(chatId, msgId, t4, { parse_mode: 'HTML', reply_markup: k4 });
            return;
        }

        if (data.startsWith('gs_flood_')) {
            const limit = parseInt(data.replace('gs_flood_', ''));
            saveSettings(db, chatId, { antiflood_limit: limit, antiflood_enabled: 1 });
            await bridge.editMessage(chatId, msgId,
                '⚡ Flood limit set to ' + limit + ' msgs/10s ✅\n\n⏱ Refreshing...',
                { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
            );
            await new Promise(r => setTimeout(r, 1500));
            const fresh5 = getSettings(db, chatId);
            const { text: t5, keyboard: k5 } = buildMainPanel(fresh5, gName, chatId);
            await bridge.editMessage(chatId, msgId, t5, { parse_mode: 'HTML', reply_markup: k5 });
            return;
        }

        if (data === 'gs_rules') {
            const msg = '📋 <b>Group Rules</b>\n━━━━━━━━━━━━━━━━\n\n' +
                (s.rules_text ? '<b>Current:</b>\n\n' + escapeHTML(s.rules_text) + '\n\n💡 Update: /rules set New rules here' : 'No rules set yet!\n\n💡 Add them:\n/rules set Be respectful!\nNo spam!\n\nMembers can type /rules to see them 😊') +
                '\n\n🦅 ARCHON CG-223';
            await bridge.editMessage(chatId, msgId, msg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [backRow] } });
            return;
        }

        if (data === 'gs_admins') {
            const msg = '👮 <b>Admin Toolkit</b>\n━━━━━━━━━━━━━━━━\n\n/kick — Remove someone\n/ban — Ban someone\n/unban — Let someone back\n/mute — Silence a member\n/warn — Warning (3 = ban)\n/pin — Pin a message\n/promote — Make admin\n/demote — Remove admin\n/admins — List all admins\n/tagall — Mention everyone\n\n🦅 ARCHON CG-223';
            await bridge.editMessage(chatId, msgId, msg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [backRow] } });
            return;
        }

        if (data === 'gs_autoreply') {
            const fc = getFilterCount(chatId);
            const msg = '🤖 <b>Auto-Reply</b> — ' + fc + ' active filter' + (fc !== 1 ? 's' : '') + '\n━━━━━━━━━━━━━━━━\n\nWhen someone says a keyword, I reply automatically!\n\n/filter website Check our site!\n↳ Replies when someone says "website"\n\n/filters — See all active\n/stop keyword — Remove filter\n\n🦅 ARCHON CG-223';
            await bridge.editMessage(chatId, msgId, msg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [backRow] } });
            return;
        }

        if (data === 'gs_stats') {
            const fc = getFilterCount(chatId);
            const msg = '📊 <b>Full Overview</b>\n📍 <b>' + escapeHTML(gName) + '</b>\n━━━━━━━━━━━━━━━━\n\n' +
                '👋 Welcome: ' + (s.welcome_enabled ? 'ON 🟢' : 'OFF 🔴') + '\n' +
                '• GIF: ' + (s.welcome_gif_id ? '🎬 Set' : 'None') + '\n' +
                '• Channel: ' + (s.welcome_thread_id ? 'Topic #' + s.welcome_thread_id : 'Default') + '\n\n' +
                '👋 Goodbye: ' + (s.goodbye_enabled ? 'ON 🟢' : 'OFF 🔴') + '\n' +
                '🔗 Antilink: ' + (s.antilink_enabled ? 'ON 🟢' : 'OFF 🔴') + '\n' +
                '⚡ Antiflood: ' + (s.antiflood_enabled ? 'ON 🟢 (' + (s.antiflood_limit||5) + ' msgs/10s)' : 'OFF 🔴') + '\n' +
                '📋 Rules: ' + (s.rules_text ? 'Set ✅' : 'Not set') + '\n' +
                '🤖 Filters: ' + fc + ' active\n\n' +
                '🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱';
            await bridge.editMessage(chatId, msgId, msg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [backRow] } });
            return;
        }
    }
};
