// ═══════════════════════════════════════════
//  TG COMMAND: Daily Reward
// ═══════════════════════════════════════════

const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

function calcLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; }

module.exports = {
    name: 'daily',
    description: 'Claim daily reward with streak bonuses',
    category: 'Economy',
    aliases: ['claim', 'reward', 'collect'],

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const userId = ctx.userId.toString();
        const username = ctx.username;
        const now = Math.floor(Date.now() / 1000);

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);

        let user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        if (!user) {
            // Telegram users have no guild — use 'telegram' as default
            try {
                db.prepare(`INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_messages, games_played, games_won, total_winnings, gaming, last_xp_gain, total_dailies, highest_streak, streak_protections) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0, 0, 0, '{"game":"CODM","rank":"Unranked"}', 0, 0, 0, 0)`)
                    .run(userId, 'telegram', username);
            } catch (err) {
                // Fallback: guild_id may not exist in schema, try without it
                db.prepare(`INSERT INTO users (id, username, xp, level, credits, streak_days, last_daily, total_messages, games_played, games_won, total_winnings, gaming, last_xp_gain, total_dailies, highest_streak, streak_protections) VALUES (?, ?, 0, 1, 0, 0, 0, 0, 0, 0, 0, '{"game":"CODM","rank":"Unranked"}', 0, 0, 0, 0)`)
                    .run(userId, username);
            }
            user = { credits: 0, xp: 0, level: 1, streak_days: 0, last_daily: 0 };
        }

        const lastDaily = user.last_daily || 0;
        const streak = user.streak_days || 0;
        const COOLDOWN = 86400;

        if (now - lastDaily < COOLDOWN) {
            const left = COOLDOWN - (now - lastDaily);
            const hrs = Math.floor(left / 3600);
            const mins = Math.floor((left % 3600) / 60);
            return ctx.replyHTML(`⏰ <b>Daily Claimed!</b>\n\nCome back in <b>${hrs}h ${mins}m</b>\n🔥 Streak: <b>${streak}</b> days`);
        }

        let newStreak = streak + 1;
        if (now - lastDaily > 172800) newStreak = 1;

        const base = 100;
        const bonus = Math.min(newStreak * 10, 200);
        const total = base + bonus;
        const xpGain = 50 + (newStreak * 5);
        const newXP = (user.xp || 0) + xpGain;
        const newLevel = calcLevel(newXP);
        const newCredits = (user.credits || 0) + total;

        db.prepare("UPDATE users SET credits=?, xp=?, level=?, streak_days=?, last_daily=?, total_dailies=total_dailies+1 WHERE id=?")
            .run(newCredits, newXP, newLevel, newStreak, now, userId);

        let msg = `✅ <b>DAILY REWARD!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
            `💰 Base: <b>${base}</b> 🪙\n` +
            `🔥 Streak: <b>+${bonus}</b> 🪙\n` +
            `✨ XP: <b>+${xpGain}</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🎁 Total: <b>${total}</b> 🪙\n` +
            `📅 Streak: <b>${newStreak}</b> day${newStreak > 1 ? 's' : ''}\n` +
            `💰 Balance: <b>${formatNumber(newCredits)}</b> 🪙\n` +
            `📊 Level: <b>${newLevel}</b>\n`;

        if (newStreak === 7) msg += `\n🏆 <b>7 DAY STREAK!</b> +500 🪙 bonus!`;
        if (newStreak === 30) msg += `\n👑 <b>30 DAY STREAK!</b> +2000 🪙 bonus!`;

        await ctx.replyHTML(msg);
    }
};
