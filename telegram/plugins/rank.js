const { sendTelegramMessage } = require('../bot');

const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: "🌱 NEURAL RECRUIT", color: "#2ecc71" },
    { minLevel: 6, maxLevel: 15, title: "🔹 FIELD AGENT", color: "#3498db" },
    { minLevel: 16, maxLevel: 30, title: "💠 CYBER SPECIALIST", color: "#9b59b6" },
    { minLevel: 31, maxLevel: 50, title: "⚜️ BKO COMMANDER", color: "#e67e22" },
    { minLevel: 51, maxLevel: Infinity, title: "👑 SYSTEM ARCHITECT", color: "#e74c3c" }
];

function getRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[0];
}

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1;
}

module.exports = {
    name: 'rank',
    aliases: ['level', 'lvl'],
    handler: async (ctx) => {
        const db = ctx.client.db;
        const userId = ctx.userId.toString();
        const version = ctx.client.version || '1.7.0';
        
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        
        if (!user) {
            await sendTelegramMessage(ctx.token, ctx.chatId,
                `👤 <b>${ctx.username}</b>\n\n` +
                `⚠️ Account not linked!\n\n` +
                `Use <code>/link &lt;discord_id&gt;</code> to link your account.`
            );
            return;
        }
        
        const level = user.level || calculateLevel(user.xp);
        const rank = getRank(level);
        const currentRankIndex = AGENT_RANKS.findIndex(r => r.title === rank.title);
        const nextRank = AGENT_RANKS[currentRankIndex + 1];
        
        const currentXP = user.xp || 0;
        const currentLevelMinXP = Math.pow((level - 1) / 0.1, 2);
        const nextLevelXP = Math.pow(level / 0.1, 2);
        const xpForNextLevel = nextLevelXP - currentXP;
        const progress = ((currentXP - currentLevelMinXP) / (nextLevelXP - currentLevelMinXP)) * 100;
        
        const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
        
        let message = `${rank.title}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `👤 <b>${ctx.username}</b>\n`;
        message += `📊 Level: <b>${level}</b>\n`;
        message += `✨ XP: <b>${currentXP.toLocaleString()}</b> / ${Math.floor(nextLevelXP).toLocaleString()}\n`;
        message += `${progressBar} ${progress.toFixed(1)}%\n\n`;
        message += `📈 <b>Next Level:</b> +${Math.floor(xpForNextLevel).toLocaleString()} XP needed\n`;
        
        if (nextRank) {
            const levelsToNextRank = nextRank.minLevel - level;
            message += `🏆 <b>Next Rank:</b> ${nextRank.title}\n`;
            message += `📌 ${levelsToNextRank} level${levelsToNextRank > 1 ? 's' : ''} away\n`;
        } else {
            message += `🏆 <b>Max Rank Achieved!</b> 🎉\n`;
        }
        
        message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📍 BAMAKO_223 🇲🇱 • v${version}`;
        
        await sendTelegramMessage(ctx.token, ctx.chatId, message);
    }
};
