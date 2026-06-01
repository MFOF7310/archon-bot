// ═══════════════════════════════════════════
//  TG COMMAND: Mention System
// ═══════════════════════════════════════════

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
    name: 'mention',
    description: 'Mention active users in chat',
    category: 'Utility',
    usage: '/mention all [message] | /mention @user [message]',
    aliases: ['tag', 'notify'],

    handler: async (ctx) => {
        const args = ctx.args;
        if (args.length === 0) {
            return ctx.replyHTML(
                `📢 <b>Mention</b>\n\n` +
                `<code>/mention all Hello!</code> · Tag everyone\n` +
                `<code>/mention @user Hey!</code> · Tag someone`
            );
        }

        const target = args[0].toLowerCase();
        const text = args.slice(1).join(' ') || 'You were mentioned!';

        if (target === 'all' || target === 'everyone' || target === '@all') {
            let members = [];
            try {
                const db = ctx.client?.db;
                if (db) {
                    members = db.prepare(
                        `SELECT DISTINCT username FROM lydia_conversations WHERE channel_id = ? ORDER BY timestamp DESC LIMIT 20`
                    ).all(`tg_${ctx.chatId}`);
                }
            } catch { /* silent */ }

            if (members.length === 0) {
                return ctx.replyHTML(`⚠️ No active users found. Try <code>/mention @username</code>.`);
            }

            let msg = `📢 <b>${escapeHTML(ctx.username)} mentioned everyone:</b>\n\n${escapeHTML(text)}\n\n`;
            members.slice(0, 10).forEach(m => { if (m.username) msg += `• @${escapeHTML(m.username)}\n`; });
            await ctx.replyHTML(msg);
        } else {
            const clean = target.replace('@', '');
            await ctx.replyHTML(`📢 <b>${escapeHTML(ctx.username)} mentioned @${escapeHTML(clean)}:</b>\n\n${escapeHTML(text)}`);
        }
    }
};
