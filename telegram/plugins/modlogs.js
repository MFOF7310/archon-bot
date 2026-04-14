module.exports = {
    name: 'modlogs',
    aliases: ['modlog', 'history', 'audit'],
    handler: async (ctx) => {
        const args = ctx.args || [];
        const chatId = ctx.chatId;
        const client = ctx.client;
        const version = client.version || '1.7.0';
        const botName = client.user?.username || 'Architect CG-223';
        
        const db = client.db;
        if (!db) {
            await ctx.replyWithHTML(`❌ Database not connected.`);
            return;
        }
        
        const targetUser = await parseTargetUser(ctx, args[0]);
        let targetId = targetUser?.id?.toString();
        let targetName = targetUser?.first_name || targetUser?.username || 'Unknown';
        
        if (!targetId) {
            // Show recent moderation actions in this chat
            const logs = db.prepare(`
                SELECT user_id, moderator_id, action, reason, timestamp 
                FROM moderation_logs 
                WHERE guild_id = ?
                ORDER BY timestamp DESC
                LIMIT 15
            `).all(`tg_${chatId}`);
            
            if (logs.length === 0) {
                await ctx.replyWithHTML(
                    `╔══════════════════════════════════╗\n` +
                    `║        📋 MODERATION LOGS          ║\n` +
                    `╚══════════════════════════════════╝\n\n` +
                    `📭 No moderation actions in this chat.\n\n` +
                    `Use <code>/modlogs @user</code> for specific user.`
                );
                return;
            }
            
            let logText = 
                `╔══════════════════════════════════╗\n` +
                `║        📋 RECENT MOD ACTIONS        ║\n` +
                `╚══════════════════════════════════╝\n\n`;
            
            logs.forEach((log, i) => {
                const actionEmoji = {
                    'warn': '⚠️', 'kick': '👢', 'ban': '🚫', 'mute': '🔇', 'unmute': '🔊', 'unban': '✅'
                }[log.action] || '📝';
                
                const date = new Date(log.timestamp * 1000).toLocaleString();
                logText += `${actionEmoji} <b>${log.action.toUpperCase()}</b>\n`;
                logText += `👤 User: ${log.user_id}\n`;
                logText += `👮 Mod: ${log.moderator_id}\n`;
                logText += `📋 ${log.reason || 'No reason'}\n`;
                logText += `⏰ ${date}\n\n`;
            });
            
            await ctx.replyWithHTML(logText);
            return;
        }
        
        // Show logs for specific user
        const logs = db.prepare(`
            SELECT action, reason, moderator_id, timestamp 
            FROM moderation_logs 
            WHERE user_id = ? AND guild_id = ?
            ORDER BY timestamp DESC
            LIMIT 20
        `).all(targetId, `tg_${chatId}`);
        
        if (logs.length === 0) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        ✅ CLEAN RECORD ✅          ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>👤 ${targetName}</b>\n` +
                `No moderation history found.`
            );
            return;
        }
        
        const actionCounts = {};
        logs.forEach(l => actionCounts[l.action] = (actionCounts[l.action] || 0) + 1);
        
        let logText = 
            `╔══════════════════════════════════╗\n` +
            `║        📋 MODERATION HISTORY       ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `<b>👤 User:</b> ${targetName}\n` +
            `<b>🆔 ID:</b> <code>${targetId}</code>\n\n` +
            `<b>📊 Summary:</b>\n`;
        
        Object.entries(actionCounts).forEach(([action, count]) => {
            const emoji = { 'warn': '⚠️', 'kick': '👢', 'ban': '🚫', 'mute': '🔇' }[action] || '📝';
            logText += `${emoji} ${action}: ${count}\n`;
        });
        
        logText += `\n<b>📋 Recent Actions:</b>\n`;
        logs.slice(0, 10).forEach((log, i) => {
            const date = new Date(log.timestamp * 1000).toLocaleDateString();
            logText += `\n${i + 1}. ${log.action.toUpperCase()}: ${log.reason || 'No reason'}\n`;
            logText += `   👮 ${log.moderator_id} • ${date}\n`;
        });
        
        logText += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🛡️ ${botName} • v${version}`;
        
        await ctx.replyWithHTML(logText);
    }
};

async function parseTargetUser(ctx, arg) {
    const message = ctx.message;
    if (message.reply_to_message) return message.reply_to_message.from;
    if (message.entities) {
        for (const entity of message.entities) {
            if (entity.type === 'text_mention') return entity.user;
        }
    }
    if (arg && /^\d+$/.test(arg)) return { id: arg, first_name: `User ${arg}` };
    return null;
}