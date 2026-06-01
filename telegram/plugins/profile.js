// ═══════════════════════════════════════════
//  TG COMMAND: Profile
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

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

module.exports = {
    name: 'profile',
    description: 'View your full profile',
    category: 'Economy',
    usage: '/profile [user]',
    aliases: ['me', 'stats', 'user'],

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const userId = ctx.userId.toString();

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);

        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        if (user) {
            const level = user.level || calcLevel(user.xp);
            const rank = getRank(level);
            const nextXP = Math.pow(level / 0.1, 2);
            const progress = Math.floor(((user.xp || 0) / nextXP) * 100);
            const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));

            await ctx.replyHTML(
                `👤 <b>${escapeHTML(ctx.username)}'s PROFILE</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `${rank.title}\n` +
                `📊 Level: <b>${level}</b>\n` +
                `✨ XP: <b>${formatNumber(user.xp || 0)}</b>\n` +
                `${bar} ${progress}%\n\n` +
                `💰 Credits: <b>${formatNumber(user.credits || 0)}</b> 🪙\n` +
                `📝 Messages: <b>${user.total_messages || 0}</b>\n` +
                `🔥 Streak: <b>${user.streak_days || 0}</b> days\n` +
                `🎮 Games: <b>${user.games_played || 0}</b> played\n` +
                `🏆 Wins: <b>${user.games_won || 0}</b>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n📍 BAMAKO_223 🇲🇱`
            );
        } else {
            ctx.replyHTML(`⚠️ No account! Use <code>/daily</code>.`);
        }
    }
};
