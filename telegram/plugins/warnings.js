module.exports = {
    name: 'warnings',
    aliases: ['warns', 'infractions'],
    handler: async (ctx) => {
        const args = ctx.args || [];
        const chatId = ctx.chatId;
        const client = ctx.client;
        const version = client.version || '1.7.0';
        const botName = client.user?.username || 'Architect CG-223';
        
        const targetUser = await parseTargetUser(ctx, args[0]);
        if (!targetUser) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        📋 WARNINGS VIEWER         ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>Usage:</b> <code>/warnings @user</code>\n` +
                `<code>/warnings reply_to_message</code>\n` +
                `<code>/warnings 5076150691</code>`
            );
            return;
        }
        
        const targetId = targetUser.id.toString();
        const targetName = targetUser.first_name || targetUser.username || 'Unknown';
        
        const db = client.db;
        if (!db) {
            await ctx.replyWithHTML(`❌ Database not connected.`);
            return;
        }
        
        const warnings = db.prepare(`
            SELECT reason, moderator_id, timestamp 
            FROM moderation_logs 
            WHERE user_id = ? AND action = 'warn'
            ORDER BY timestamp DESC
            LIMIT 10
        `).all(targetId);
        
        if (warnings.length === 0) {
            await ctx.replyWithHTML(
                `╔══════════════════════════════════╗\n` +
                `║        ✅ CLEAN RECORD ✅          ║\n` +
                `╚══════════════════════════════════╝\n\n` +
                `<b>👤 User:</b> ${targetName}\n` +
                `<b>🆔 ID:</b> <code>${targetId}</code>\n\n` +
                `✅ This user has <b>no warnings</b>.\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🛡️ ${botName} • v${version}`
            );
            return;
        }
        
        let warningText = 
            `╔══════════════════════════════════╗\n` +
            `║        ⚠️ WARNING HISTORY ⚠️        ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `<b>👤 User:</b> ${targetName}\n` +
            `<b>🆔 ID:</b> <code>${targetId}</code>\n` +
            `<b>📊 Total:</b> ${warnings.length} warning(s)\n\n` +
            `<b>📋 Recent Warnings:</b>\n`;
        
        warnings.forEach((w, i) => {
            const date = new Date(w.timestamp * 1000).toLocaleDateString();
            warningText += `\n<b>${i + 1}.</b> ${w.reason}\n`;
            warningText += `   📅 ${date} | 👮 ${w.moderator_id}\n`;
        });
        
        warningText += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🛡️ ${botName} • v${version}`;
        
        await ctx.replyWithHTML(warningText);
    }
};

// Reuse parseTargetUser from warn.js
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