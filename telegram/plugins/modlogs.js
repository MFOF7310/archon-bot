// ═══════════════════════════════════════════
//  TG COMMAND: Mod Logs
// ═══════════════════════════════════════════

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const ACTION_EMOJI = { warn: '⚠️', kick: '👢', ban: '🚫', mute: '🔇', unmute: '🔊' };

module.exports = {
    name: 'modlogs',
    description: 'View moderation action history',
    category: 'Moderation',
    usage: '/modlogs [@user]',
    aliases: ['logs', 'audit'],
    adminOnly: true,

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const chatId = ctx.chatId;

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);

        const logs = db.prepare(
            `SELECT user_id, moderator_id, action, reason, timestamp FROM moderation_logs
             WHERE guild_id = ? ORDER BY timestamp DESC LIMIT 15`
        ).all(`tg_${chatId}`);

        if (logs.length === 0) return ctx.replyHTML(`📋 No mod actions in this chat yet.`);

        let msg = `📋 <b>RECENT MOD ACTIONS</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        logs.forEach(log => {
            const emoji = ACTION_EMOJI[log.action] || '📝';
            const date = new Date(log.timestamp * 1000).toLocaleDateString();
            msg += `${emoji} <b>${log.action.toUpperCase()}</b> · ${date}\n`;
            msg += `   👤 <code>${log.user_id}</code> · ${escapeHTML(log.reason || 'No reason')}\n\n`;
        });
        await ctx.replyHTML(msg);
    }
};
