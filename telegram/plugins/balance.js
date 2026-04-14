module.exports = {
    name: 'balance',
    aliases: ['credits', 'money', 'bal'],
    run: async (ctx) => {
        const db = ctx.client?.db;
        const userId = ctx.message?.from?.id?.toString();
        const username = ctx.message?.from?.first_name || 'User';
        const version = ctx.client?.version || '1.7.0';
        
        if (!db) {
            await ctx.replyWithHTML(`❌ Database not connected`);
            return;
        }
        
        // Check for linked account
        const linked = db.prepare("SELECT discord_id FROM user_links WHERE telegram_id = ?").get(userId);
        const lookupId = linked ? linked.discord_id : userId;
        
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(lookupId);
        
        if (user) {
            await ctx.replyWithHTML(
                `💰 <b>${username}'s BALANCE</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🪙 Credits: <b>${user.credits?.toLocaleString() || 0}</b>\n` +
                `📊 Level: <b>${user.level || 1}</b>\n` +
                `✨ XP: <b>${user.xp?.toLocaleString() || 0}</b>\n` +
                `🔥 Streak: <b>${user.streak_days || 0}</b> days\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `📍 BAMAKO_223 🇲🇱 • v${version}`
            );
        } else {
            await ctx.replyWithHTML(
                `👤 <b>${username}</b>\n\n` +
                `⚠️ Account not linked!\n\n` +
                `🔗 Link your Discord account:\n` +
                `<code>/link &lt;discord_id&gt;</code>`
            );
        }
    }
};