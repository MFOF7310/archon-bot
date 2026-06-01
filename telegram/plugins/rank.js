// ═══════════════════════════════════════════
//  TG COMMAND: Rank / Level
// ═══════════════════════════════════════════

const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

function calcLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; }

const RANKS = [
    { minLv: 1, title: '🌱 NEURAL RECRUIT' },
    { minLv: 6, title: '🔹 FIELD AGENT' },
    { minLv: 16, title: '💠 CYBER SPECIALIST' },
    { minLv: 31, title: '⚜️ BKO COMMANDER' },
    { minLv: 51, title: '👑 SYSTEM ARCHITECT' }
];

function getRank(level) { return [...RANKS].reverse().find(r => level >= r.minLv) || RANKS[0]; }

module.exports = {
    name: 'rank',
    description: 'View your rank and XP progress',
    category: 'Economy',
    usage: '/rank [user]',
    aliases: ['level', 'lvl'],

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const userId = ctx.userId.toString();

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);

        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        if (!user) return ctx.replyHTML(`⚠️ No account! Use <code>/daily</code>.`);

        const level = user.level || calcLevel(user.xp);
        const rank = getRank(level);
        const xp = user.xp || 0;
        const currentMin = Math.pow((level - 1) / 0.1, 2);
        const nextMin = Math.pow(level / 0.1, 2);
        const progress = ((xp - currentMin) / (nextMin - currentMin)) * 100;
        const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
        const needed = Math.floor(nextMin - xp);
        const nextRank = RANKS.find(r => r.minLv > level);

        let msg = `${rank.title}\n━━━━━━━━━━━━━━━━━━━━\n\n` +
            `👤 <b>${ctx.username}</b>\n` +
            `📊 Level: <b>${level}</b>\n` +
            `✨ XP: <b>${formatNumber(xp)}</b> / ${formatNumber(Math.floor(nextMin))}\n` +
            `${bar} ${progress.toFixed(1)}%\n\n` +
            `📈 Next: +${formatNumber(needed)} XP\n`;

        if (nextRank) msg += `🏆 Next: ${nextRank.title} (${nextRank.minLv - level} lvls)\n`;
        else msg += `🏆 <b>Max Rank!</b> 🎉\n`;

        msg += `\n━━━━━━━━━━━━━━━━━━━━\n📍 BAMAKO_223 🇲🇱`;
        await ctx.replyHTML(msg);
    }
};
