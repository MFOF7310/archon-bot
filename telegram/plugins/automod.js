const https = require('https');
const fs = require('fs');

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

// Flood tracking: { chatId_userId: { count, timer } }
if (!global._floodMap) global._floodMap = new Map();
if (!global._verifyMap) global._verifyMap = new Map();
if (!global._warnMap) global._warnMap = new Map();

const LINK_REGEX = /(https?:\/\/|www\.|t\.me\/|@[\w]+\.\w{2,})/i;
const BOT_REGEX = /bot$/i;

const WARN_MSGS = [
    "Aye {name}, next time you pull that link stunt — you walk. 🚪",
    "Respectfully {name}, read the rules or catch a ban. Your call. 😌",
    "{name} testing the waters huh? The water is HOT. 🔥",
    "We see you {name}. ARCHON sees everything. Don't try it again. 🦅",
    "{name} this is your sign to calm down. Final warning energy. ⚠️",
    "Bold move {name}. Let's see if the next one is your last. 😏",
    "{name} — one more time and we skip the warning. 🔨",
];

const FLOOD_MSGS = [
    "Slow down {name}! You are not a printer. 🖨️",
    "{name} relax, the chat is not going anywhere! 😅",
    "Flooding detected! {name} has been temporarily silenced. 🔇",
    "Easy {name}, one message at a time! This is not Twitter. 🐦",
];

function randomMsg(arr, name) {
    return arr[Math.floor(Math.random() * arr.length)].replace(/{name}/g, name);
}

function getSettings(db, chatId) {
    try {
        const cols = [
            'antilink_enabled', 'antiflood_enabled', 'antiflood_limit',
            'anti_bot_enabled', 'verification_enabled', 'max_warnings'
        ];
        for (const col of cols) {
            try { db.prepare(`ALTER TABLE group_settings ADD COLUMN ${col} TEXT`).run(); } catch(e) {}
        }
        return db.prepare('SELECT * FROM group_settings WHERE chat_id = ?').get(String(chatId)) || {};
    } catch(e) { return {}; }
}

function getWarnings(chatId, userId) {
    const key = `${chatId}:${userId}`;
    return global._warnMap.get(key) || 0;
}

function addWarning(chatId, userId) {
    const key = `${chatId}:${userId}`;
    const count = (global._warnMap.get(key) || 0) + 1;
    global._warnMap.set(key, count);
    return count;
}

function resetWarnings(chatId, userId) {
    global._warnMap.delete(`${chatId}:${userId}`);
}

module.exports = {
    name: 'automod',
    aliases: ['antimod', 'modset'],
    description: 'AutoMod — antilink, antiflood, anti-bot, verification',
    category: 'Moderation',
    usage: '/automod <setting> <on|off>',
    adminOnly: true,

    // ── Main message checker — called from bot.js ──
    checkMessage: async (ctx, bridge, db) => {
        if (!ctx.isGroup) return false;
        const chatId = String(ctx.chatId);
        const userId = String(ctx.userId);
        const text = ctx.text || '';
        const name = escapeHTML(ctx.username || 'Member');

        const settings = getSettings(db, chatId);

        // Skip admins
        try {
            const isAdmin = await ctx.isAdmin();
            if (isAdmin || ctx.isOwner()) return false;
        } catch(e) {}

        // ── ANTIFLOOD ──
        if (settings.antiflood_enabled) {
            const limit = parseInt(settings.antiflood_limit) || 5;
            const fKey = `${chatId}:${userId}`;
            const flood = global._floodMap.get(fKey) || { count: 0 };
            flood.count++;

            if (flood.timer) clearTimeout(flood.timer);
            flood.timer = setTimeout(() => global._floodMap.delete(fKey), 10000);
            global._floodMap.set(fKey, flood);

            if (flood.count >= limit) {
                flood.count = 0;
                // Mute for 5 minutes
                await tgApi(bridge.token, 'restrictChatMember', {
                    chat_id: chatId,
                    user_id: userId,
                    permissions: { can_send_messages: false },
                    until_date: Math.floor(Date.now() / 1000) + 300
                });
                // Delete message
                await tgApi(bridge.token, 'deleteMessage', {
                    chat_id: chatId,
                    message_id: ctx.message?.message_id
                });
                await tgApi(bridge.token, 'sendMessage', {
                    chat_id: chatId,
                    text: randomMsg(FLOOD_MSGS, name) + '\n\n🔇 Muted for 5 minutes.',
                    parse_mode: 'HTML'
                });
                return true;
            }
        }

        // ── ANTILINK ──
        if (settings.antilink_enabled && LINK_REGEX.test(text)) {
            // Delete the message
            await tgApi(bridge.token, 'deleteMessage', {
                chat_id: chatId,
                message_id: ctx.message?.message_id
            });

            const warnCount = addWarning(chatId, userId);
            const maxWarns = parseInt(settings.max_warnings) || 3;

            if (warnCount >= maxWarns) {
                // Ban
                await tgApi(bridge.token, 'banChatMember', { chat_id: chatId, user_id: userId });
                resetWarnings(chatId, userId);
                await tgApi(bridge.token, 'sendMessage', {
                    chat_id: chatId,
                    text: `🔨 <b>${name}</b> has been banned after ${maxWarns} warnings.\n\n<i>Actions have consequences.</i> 🦅`,
                    parse_mode: 'HTML'
                });
            } else {
                const msg = randomMsg(WARN_MSGS, `<b>${name}</b>`);
                await tgApi(bridge.token, 'sendMessage', {
                    chat_id: chatId,
                    text: `⚠️ ${msg}\n\n<i>Warning ${warnCount}/${maxWarns}</i>`,
                    parse_mode: 'HTML'
                });
            }
            return true;
        }

        return false;
    },

    // ── Verify new member (captcha) ──
    verifyMember: async (bridge, db, chatId, member, chatTitle) => {
        const settings = getSettings(db, String(chatId));
        if (!settings.verification_enabled) return;

        const name = escapeHTML(member.first_name || member.username || 'Friend');
        const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5).slice(0,4);
        const answer = nums[0];
        const question = `${nums[1]} + ${nums[2]}`;
        const correctAnswer = nums[1] + nums[2];

        // Restrict until verified
        await tgApi(bridge.token, 'restrictChatMember', {
            chat_id: chatId,
            user_id: member.id,
            permissions: { can_send_messages: false }
        });

        const options = [correctAnswer, correctAnswer+1, correctAnswer-1, correctAnswer+2]
            .sort(() => Math.random() - 0.5)
            .map(n => ({ text: String(n), callback_data: `verify_${member.id}_${n === correctAnswer ? 'ok' : 'fail'}` }));

        const result = await tgApi(bridge.token, 'sendMessage', {
            chat_id: chatId,
            text: `👋 Welcome <b>${name}</b>!\n\nTo join, please solve this:\n\n<b>${question} = ?</b>\n\n<i>You have 60 seconds ⏱</i>`,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [options] }
        });

        const msgId = result && result.result && result.result.message_id;

        // Store pending verification
        global._verifyMap.set(String(member.id), { chatId, msgId, answer: correctAnswer });

        // Auto-kick after 60s if not verified
        setTimeout(async () => {
            if (global._verifyMap.has(String(member.id))) {
                global._verifyMap.delete(String(member.id));
                await tgApi(bridge.token, 'banChatMember', { chat_id: chatId, user_id: member.id });
                await tgApi(bridge.token, 'unbanChatMember', { chat_id: chatId, user_id: member.id });
                if (msgId) await tgApi(bridge.token, 'deleteMessage', { chat_id: chatId, message_id: msgId });
                await tgApi(bridge.token, 'sendMessage', {
                    chat_id: chatId,
                    text: `⏰ <b>${name}</b> failed to verify in time and was removed.`,
                    parse_mode: 'HTML'
                });
            }
        }, 60000);
    },

    // ── Handle verify callback ──
    handleVerifyCallback: async (bridge, db, cbq) => {
        const data = cbq.data;
        const userId = String(cbq.from.id);
        const chatId = String(cbq.message.chat.id);
        const msgId = cbq.message.message_id;
        const name = escapeHTML(cbq.from.first_name || 'Member');

        if (!data.startsWith('verify_')) return false;
        const parts = data.split('_');
        const targetUserId = parts[1];
        const result = parts[2];

        // Only the member being verified can answer
        if (userId !== targetUserId) {
            await tgApi(bridge.token, 'answerCallbackQuery', {
                callback_query_id: cbq.id,
                text: 'This is not your verification!',
                show_alert: true
            });
            return true;
        }

        global._verifyMap.delete(userId);
        await tgApi(bridge.token, 'deleteMessage', { chat_id: chatId, message_id: msgId });

        if (result === 'ok') {
            // Restore permissions
            await tgApi(bridge.token, 'restrictChatMember', {
                chat_id: chatId,
                user_id: userId,
                permissions: {
                    can_send_messages: true,
                    can_send_media_messages: true,
                    can_send_polls: true,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true
                }
            });
            await tgApi(bridge.token, 'sendMessage', {
                chat_id: chatId,
                text: `✅ <b>${name}</b> verified! Welcome to the group 🦅`,
                parse_mode: 'HTML'
            });
        } else {
            // Wrong answer — kick
            await tgApi(bridge.token, 'banChatMember', { chat_id: chatId, user_id: userId });
            await tgApi(bridge.token, 'unbanChatMember', { chat_id: chatId, user_id: userId });
            await tgApi(bridge.token, 'sendMessage', {
                chat_id: chatId,
                text: `❌ <b>${name}</b> failed verification and was removed.\n\n<i>Bots are not welcome here.</i> 🤖`,
                parse_mode: 'HTML'
            });
        }
        return true;
    },

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML('⚠️ Groups only!');
        if (!await ctx.isAdmin() && !ctx.isOwner()) return ctx.replyHTML('⛔ Admins only!');

        const db = ctx.client && ctx.client.db;
        if (!db) return ctx.replyHTML('❌ Database not available.');

        const chatId = String(ctx.chatId);
        const sub = ctx.args[0]?.toLowerCase();
        const val = ctx.args[1]?.toLowerCase();

        if (!sub) {
            const s = getSettings(db, chatId);
            return ctx.replyHTML(
                `🛡️ <b>AutoMod Settings</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `🔗 Antilink: ${s.antilink_enabled ? '🟢 ON' : '🔴 OFF'}\n` +
                `⚡ Antiflood: ${s.antiflood_enabled ? `🟢 ON (${s.antiflood_limit||5} msgs/10s)` : '🔴 OFF'}\n` +
                `🤖 Anti-bot: ${s.anti_bot_enabled ? '🟢 ON' : '🔴 OFF'}\n` +
                `✅ Verification: ${s.verification_enabled ? '🟢 ON' : '🔴 OFF'}\n` +
                `⚠️ Max Warnings: ${s.max_warnings || 3}\n\n` +
                `<b>Commands:</b>\n` +
                `<code>/automod antilink on|off</code>\n` +
                `<code>/automod antiflood on|off</code>\n` +
                `<code>/automod antibot on|off</code>\n` +
                `<code>/automod verify on|off</code>\n` +
                `<code>/automod warnings 3</code>\n\n` +
                `🦅 ARCHON CG-223`
            );
        }

        const toggle = val === 'on' ? 1 : val === 'off' ? 0 : null;

        const updates = {};
        if (sub === 'antilink') updates.antilink_enabled = toggle;
        else if (sub === 'antiflood') updates.antiflood_enabled = toggle;
        else if (sub === 'antibot') updates.anti_bot_enabled = toggle;
        else if (sub === 'verify' || sub === 'verification') updates.verification_enabled = toggle;
        else if (sub === 'warnings' && val && !isNaN(val)) {
            db.prepare('INSERT OR REPLACE INTO group_settings (chat_id, max_warnings) VALUES (?,?) ON CONFLICT(chat_id) DO UPDATE SET max_warnings=?').run(chatId, parseInt(val), parseInt(val));
            return ctx.replyHTML(`⚠️ Max warnings set to <b>${val}</b>\n\n🦅 ARCHON CG-223`);
        }

        if (Object.keys(updates).length && toggle !== null) {
            const existing = db.prepare('SELECT chat_id FROM group_settings WHERE chat_id = ?').get(chatId);
            if (existing) {
                const key = Object.keys(updates)[0];
                db.prepare(`UPDATE group_settings SET ${key} = ? WHERE chat_id = ?`).run(toggle, chatId);
            } else {
                const key = Object.keys(updates)[0];
                db.prepare(`INSERT INTO group_settings (chat_id, ${key}) VALUES (?,?)`).run(chatId, toggle);
            }
            const status = toggle ? '🟢 ON' : '🔴 OFF';
            return ctx.replyHTML(`✅ <b>${sub}</b> is now ${status}\n\n🦅 ARCHON CG-223`);
        }

        return ctx.replyHTML(`💡 Usage: <code>/automod antilink on</code>`);
    }
};
