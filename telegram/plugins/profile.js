const { sendTelegramMessage } = require('../bot');

// Level calculation (same as Discord)
function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1;
}

// Agent ranks
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: "🌱 NEURAL RECRUIT", color: "#2ecc71" },
    { minLevel: 6, maxLevel: 15, title: "🔹 FIELD AGENT", color: "#3498db" },
    { minLevel: 16, maxLevel: 30, title: "💠 CYBER SPECIALIST", color: "#9b59b6" },
    { minLevel: 31, maxLevel: 50, title: "⚜️ BKO COMMANDER", color: "#e67e22" },
    { minLevel: 51, maxLevel: Infinity, title: "👑 SYSTEM ARCHITECT", color: "#e74c3c" }
];

function getRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1];
}

module.exports = {
    name: 'profile',
    aliases: ['me', 'stats'],
    handler: async (ctx) => {
        const db = ctx.client.db;
        const userId = ctx.userId.toString();
        const version = ctx.client.version || '1.7.0';
        
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        
        if (user) {
            const level = user.level || calculateLevel(user.xp);
            const rank = getRank(level);
            const nextLevelXP = Math.pow((level) / 0.1, 2);
            const progress = Math.floor((user.xp / nextLevelXP) * 100);
            
            const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
            
            const profileText =
`👤 <b>${ctx.username}'s PROFILE</b>
━━━━━━━━━━━━━━━━━━━━━━

${rank.title}
📊 Level: <b>${level}</b>
✨ XP: <b>${user.xp.toLocaleString()}</b>
${progressBar} ${progress}%

💰 Credits: <b>${user.credits.toLocaleString()}</b> 🪙
📝 Messages: <b>${user.total_messages || 0}</b>
🔥 Streak: <b>${user.streak_days || 0}</b> days

🎮 Games Played: <b>${user.games_played || 0}</b>
🏆 Games Won: <b>${user.games_won || 0}</b>

━━━━━━━━━━━━━━━━━━━━━━
📍 BAMAKO_223 🇲🇱 • v${version}`;

            await sendTelegramMessage(ctx.token, ctx.chatId, profileText);
        } else {
            await sendTelegramMessage(ctx.token, ctx.chatId,
                `👤 <b>${ctx.username}</b>\n\n` +
                `⚠️ Account not linked!\n\n` +
                `🔗 Link your Discord account:\n` +
                `<code>/link &lt;discord_id&gt;</code>\n\n` +
                `Example: <code>/link 123456789012345678</code>\n\n` +
                `Find your Discord ID in Discord Settings > Advanced > Developer Mode`
            );
        }
    }
};