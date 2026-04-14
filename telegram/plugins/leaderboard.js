const { sendTelegramMessage } = require('../bot');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'leaders'],
    handler: async (ctx) => {
        const db = ctx.client.db;
        const args = ctx.args || [];
        const version = ctx.client.version || '1.7.0';
        
        const type = args[0]?.toLowerCase() || 'level';
        const validTypes = ['level', 'xp', 'credits', 'streak'];
        
        if (!validTypes.includes(type)) {
            await sendTelegramMessage(ctx.token, ctx.chatId,
                `📊 <b>Leaderboard Usage</b>\n\n` +
                `<code>/lb [type]</code>\n\n` +
                `<b>Types:</b>\n` +
                `• level - Top by level\n` +
                `• xp - Top by XP\n` +
                `• credits - Richest players\n` +
                `• streak - Longest daily streaks\n\n` +
                `Example: <code>/lb credits</code>`
            );
            return;
        }
        
        let orderBy = 'level DESC, xp DESC';
        let title = '🏆 LEVEL LEADERBOARD';
        
        if (type === 'xp') {
            orderBy = 'xp DESC';
            title = '✨ XP LEADERBOARD';
        } else if (type === 'credits') {
            orderBy = 'credits DESC';
            title = '💰 RICHEST PLAYERS';
        } else if (type === 'streak') {
            orderBy = 'streak_days DESC';
            title = '🔥 DAILY STREAK LEADERS';
        }
        
        const users = db.prepare(`SELECT username, level, xp, credits, streak_days FROM users WHERE xp > 0 ORDER BY ${orderBy} LIMIT 10`).all();
        
        if (users.length === 0) {
            await sendTelegramMessage(ctx.token, ctx.chatId,
                `📊 <b>${title}</b>\n\n` +
                `No data available yet!\n\n` +
                `Be the first to appear!`
            );
            return;
        }
        
        let message = `<b>${title}</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        
        users.forEach((user, index) => {
            let value = '';
            if (type === 'level') value = `Lvl ${user.level} (${user.xp.toLocaleString()} XP)`;
            else if (type === 'xp') value = `${user.xp.toLocaleString()} XP (Lvl ${user.level})`;
            else if (type === 'credits') value = `${user.credits.toLocaleString()} 🪙`;
            else if (type === 'streak') value = `${user.streak_days} day${user.streak_days > 1 ? 's' : ''}`;
            
            message += `${medals[index]} <b>${user.username}</b>\n`;
            message += `   ${value}\n\n`;
        });
        
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📍 BAMAKO_223 🇲🇱 • v${version}\n`;
        message += `💡 <i>Use /lb [level|xp|credits|streak]</i>`;
        
        await sendTelegramMessage(ctx.token, ctx.chatId, message);
    }
};