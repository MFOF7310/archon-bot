// telegram/mod.js — shared by the Telegram moderation commands.
// The bot checks that the admin who asks has the matching Telegram right (it only checked "is an admin", so an
// admin without the right to ban could ban, or promote people, through the bot). Results are checked before
// saying "done", and Telegram's refusals are explained in plain words.
const https = require('https');

function api(token, method, params) {
    return new Promise((res) => {
        const body = JSON.stringify(params);
        const req = https.request(`https://api.telegram.org/bot${token}/${method}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 },
            (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch { res({ ok: false }); } }); });
        req.on('error', () => res({ ok: false })); req.on('timeout', () => { req.destroy(); res({ ok: false }); });
        req.write(body); req.end();
    });
}

// Does the member who typed the command have this right? The group owner has them all.
async function can(ctx, right) {
    const r = await api(ctx.bridge.token, 'getChatMember', { chat_id: ctx.chatId, user_id: ctx.userId });
    const m = r.ok ? r.result : null;
    if (!m) return false;
    if (m.status === 'creator') return true;
    return m.status === 'administrator' && (!right || m[right] === true);
}

// The member to act on: the author of the replied message, or a numeric user id
function target(ctx) {
    const r = ctx.message?.reply_to_message?.from;
    if (r) return { id: r.id, name: r.first_name || r.username || String(r.id), bot: !!r.is_bot };
    const a = String(ctx.args?.[0] || '');
    if (/^\d{5,15}$/.test(a)) return { id: Number(a), name: a, fromArg: true };
    return null;
}

// Telegram's refusal → the key of a plain explanation
function why(desc = '') {
    const d = String(desc).toLowerCase();
    if (/not enough rights|need administrator rights|have no rights|chat_admin_required/.test(d)) return 'bot_rights';
    if (/administrator|chat owner|creator/.test(d)) return 'target_admin';
    if (/user not found|participant_id_invalid|user_not_participant/.test(d)) return 'not_found';
    return 'failed';
}

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const link = (u) => `<a href="tg://user?id=${u.id}">${esc(u.name)}</a>`;

module.exports = { api, can, target, why, esc, link };

// Stop early with a plain reason when the command can't run here. Returns true when the caller may go on.
async function guard(ctx, t, right) {
    if (!ctx.isGroup) { await ctx.replyHTML(t('groups_only')); return false; }
    if (right && !(await can(ctx, right))) { await ctx.replyHTML(t('no_right', { right: t('rights')[right] })); return false; }
    return true;
}

// Telegram's answer → the plain sentence to show
function fail(t, res, right) {
    const k = why(res?.description);
    return t(k, right ? { right: t('rights')[right] } : {});
}

// Every action goes in moderation_logs so /modlogs shows the full history, not only warnings
function logAction(ctx, action, userId, reason) {
    try {
        ctx.client?.db?.prepare(`INSERT INTO moderation_logs (id, guild_id, user_id, moderator_id, action, reason, timestamp) VALUES (?,?,?,?,?,?,?)`)
            .run(`${action}_${Date.now()}_${userId}`, `tg_${ctx.chatId}`, String(userId), String(ctx.userId), action, reason || null, Math.floor(Date.now() / 1000));
    } catch {}
}

module.exports.guard = guard;
module.exports.fail = fail;
module.exports.logAction = logAction;
