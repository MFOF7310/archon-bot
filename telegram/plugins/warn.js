// ═══════════════════════════════════════════
//  TG COMMAND: Warning System
// ═══════════════════════════════════════════

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
    name: 'warn',
    description: 'Warn a user or check warnings',
    category: 'Moderation',
    usage: '/warn @user [reason] | /warnings @user',
    aliases: ['warning', 'warnings'],
    adminOnly: true,

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const chatId = ctx.chatId;
        const args = ctx.args;
        const cmd = ctx.message.text?.split(' ')[0]?.toLowerCase();

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);

        // Check warnings
        if (cmd === '/warnings') {
            let targetId = String(ctx.userId);
            let targetName = 'User';
            if (ctx.message.reply_to_message) {
                targetId = String(ctx.message.reply_to_message.from.id);
                targetName = ctx.message.reply_to_message.from.first_name || 'User';
            } else if (args[0]) targetId = args[0].replace('@', '');

            const warnings = db.prepare(
                `SELECT reason, moderator_id, timestamp FROM moderation_logs
                 WHERE user_id = ? AND guild_id = ? AND action = 'warn' ORDER BY timestamp DESC LIMIT 10`
            ).all(targetId, `tg_${chatId}`);

            if (warnings.length === 0) return ctx.replyHTML(`✅ <b>${escapeHTML(targetName)}</b> has no warnings!`);

            let msg = `⚠️ <b>WARNINGS</b> · ${escapeHTML(targetName)}\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            warnings.forEach((w, i) => {
                const date = new Date(w.timestamp * 1000).toLocaleDateString();
                msg += `${i + 1}. ${escapeHTML(w.reason || 'No reason')} · ${date}\n`;
            });
            msg += `\nTotal: ${warnings.length}`;
            return ctx.replyHTML(msg);
        }

        // Issue warning
        let target = null;
        if (ctx.message.reply_to_message) target = ctx.message.reply_to_message.from;
        else if (args[0]) target = { id: args[0].replace('@', ''), first_name: args[0] };

        if (!target) {
            return ctx.replyHTML(`⚠️ <b>Warn</b>\n\n<code>/warn @user reason</code>\n<code>/warnings @user</code>\n\nReply to a message to warn that user.`);
        }

        const targetId = String(target.id);
        const targetName = escapeHTML(target.first_name || targetId);
        const reason = args.slice(1).join(' ') || 'No reason';

        db.prepare(`INSERT INTO moderation_logs (id, guild_id, user_id, moderator_id, action, reason, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
            `warn_${Date.now()}`, `tg_${chatId}`, targetId, String(ctx.userId), 'warn', reason, Math.floor(Date.now() / 1000)
        );

        const count = db.prepare(
            `SELECT COUNT(*) as c FROM moderation_logs WHERE user_id = ? AND guild_id = ? AND action = 'warn'`
        ).get(targetId, `tg_${chatId}`).c;

        let msg = `⚠️ <b>WARNING ISSUED</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
            `👤 ${targetName}\n` +
            `🆔 <code>${targetId}</code>\n` +
            `📋 ${escapeHTML(reason)}\n` +
            `📊 Total: <b>${count}</b>`;
        if (count >= 3) msg += `\n\n🔴 <b>3+ warnings!</b> Consider muting.`;

        await ctx.replyHTML(msg);
    }
};
