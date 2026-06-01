// ═══════════════════════════════════════════
//  TG COMMAND: Balance
// ═══════════════════════════════════════════

const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

module.exports = {
    name: 'balance',
    description: 'Check your credit balance',
    category: 'Economy',
    usage: '/balance [user]',
    aliases: ['credits', 'money', 'bal', 'wallet'],

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const userId = ctx.userId.toString();
        const username = ctx.username;

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);

        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        if (user) {
            await ctx.replyHTML(
                `💰 <b>${username}'s BALANCE</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🪙 Credits: <b>${formatNumber(user.credits || 0)}</b>\n` +
                `📊 Level: <b>${user.level || 1}</b>\n` +
                `✨ XP: <b>${formatNumber(user.xp || 0)}</b>\n` +
                `🔥 Streak: <b>${user.streak_days || 0}</b> days\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n📍 BAMAKO_223 🇲🇱`
            );
        } else {
            await ctx.replyHTML(
                `👤 <b>${username}</b>\n\n` +
                `⚠️ No account! Use <code>/daily</code> to create one.`
            );
        }
    }
};
