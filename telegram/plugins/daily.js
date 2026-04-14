const { sendTelegramMessage } = require('../bot');

module.exports = {
    name: 'daily',
    aliases: ['claim', 'reward'],
    handler: async (ctx) => {
        const db = ctx.client.db;
        const userId = ctx.userId.toString();
        const username = ctx.username;
        const version = ctx.client.version || '1.7.0';
        const now = Math.floor(Date.now() / 1000);
        const oneDay = 86400;
        
        let user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        
        if (!user) {
            db.prepare("INSERT INTO users (id, username, xp, level, credits, streak_days, last_daily) VALUES (?, ?, 0, 1, 0, 0, 0)").run(userId, username);
            user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        }
        
        const lastDaily = user.last_daily || 0;
        const streakDays = user.streak_days || 0;
        
        if (now - lastDaily < oneDay) {
            const timeLeft = oneDay - (now - lastDaily);
            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            
            await sendTelegramMessage(ctx.token, ctx.chatId,
                `⏰ <b>Daily Already Claimed!</b>\n\n` +
                `Come back in <b>${hours}h ${minutes}m</b>\n\n` +
                `🔥 Current Streak: <b>${streakDays}</b> days`
            );
            return;
        }
        
        let newStreak = streakDays + 1;
        if (now - lastDaily > oneDay * 2) {
            newStreak = 1;
        }
        
        const baseReward = 100;
        const streakBonus = Math.min(newStreak * 10, 200);
        const totalReward = baseReward + streakBonus;
        const xpReward = 50 + (newStreak * 5);
        
        const newXP = (user.xp || 0) + xpReward;
        const newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;
        const newCredits = (user.credits || 0) + totalReward;
        
        db.prepare("UPDATE users SET credits = ?, xp = ?, level = ?, streak_days = ?, last_daily = ? WHERE id = ?")
            .run(newCredits, newXP, newLevel, newStreak, now, userId);
        
        let message = `✅ <b>DAILY REWARD CLAIMED!</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `💰 Base Reward: <b>${baseReward}</b> 🪙\n`;
        message += `🔥 Streak Bonus: <b>+${streakBonus}</b> 🪙\n`;
        message += `✨ XP Gained: <b>+${xpReward}</b> XP\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `🎁 <b>Total:</b> ${totalReward} 🪙\n`;
        message += `📅 Streak: <b>${newStreak}</b> day${newStreak > 1 ? 's' : ''}\n`;
        message += `💰 New Balance: <b>${newCredits.toLocaleString()}</b> 🪙\n`;
        message += `📊 Level: <b>${newLevel}</b>\n\n`;
        
        if (newStreak === 7) {
            message += `🏆 <b>7 DAY STREAK ACHIEVED!</b> 🏆\n`;
            message += `Bonus: +500 🪙 added!\n`;
            db.prepare("UPDATE users SET credits = credits + 500 WHERE id = ?").run(userId);
        } else if (newStreak === 30) {
            message += `👑 <b>30 DAY STREAK ACHIEVED!</b> 👑\n`;
            message += `Bonus: +2000 🪙 added!\n`;
            db.prepare("UPDATE users SET credits = credits + 2000 WHERE id = ?").run(userId);
        }
        
        message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📍 BAMAKO_223 🇲🇱 • v${version}`;
        
        await sendTelegramMessage(ctx.token, ctx.chatId, message);
    }
};