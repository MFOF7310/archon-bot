// ═══════════════════════════════════════════
//  TG COMMAND: Leaderboard
// ═══════════════════════════════════════════

const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
    name: 'leaderboard',
    description: 'Top players leaderboard',
    category: 'Economy',
    usage: '/leaderboard [level|xp|credits|streak]',
    aliases: ['lb', 'top', 'leaders'],

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const type = ctx.args[0]?.toLowerCase() || 'level';
        const valid = ['level', 'xp', 'credits', 'streak'];

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);

        if (!valid.includes(type)) {
            return ctx.replyHTML(
                `📊 <b>Leaderboard</b>\n\n` +
                `<code>/lb level</code> · By level\n` +
                `<code>/lb xp</code> · By XP\n` +
                `<code>/lb credits</code> · Richest\n` +
                `<code>/lb streak</code> · Streaks`
            );
        }

        const orderMap = { level: 'level DESC, xp DESC', xp: 'xp DESC', credits: 'credits DESC', streak: 'streak_days DESC' };
        const titles = { level: '🏆 LEVEL', xp: '✨ XP', credits: '💰 RICHEST', streak: '🔥 STREAK' };

        const users = db.prepare(
            `SELECT username, level, xp, credits, streak_days FROM users WHERE xp > 0 ORDER BY ${orderMap[type]} LIMIT 10`
        ).all();

        if (users.length === 0) return ctx.replyHTML(`📊 <b>${titles[type]}</b>\n\nNo data yet!`);

        let msg = `<b>${titles[type]} LEADERBOARD</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        users.forEach((u, i) => {
            let val = '';
            if (type === 'level') val = `Lvl ${u.level} (${formatNumber(u.xp)} XP)`;
            else if (type === 'xp') val = `${formatNumber(u.xp)} XP`;
            else if (type === 'credits') val = `${formatNumber(u.credits)} 🪙`;
            else val = `${u.streak_days} day${u.streak_days > 1 ? 's' : ''}`;
            msg += `${MEDALS[i] || '•'} <b>${escapeHTML(u.username)}</b>\n   ${val}\n\n`;
        });

        msg += `━━━━━━━━━━━━━━━━━━━━\n📍 BAMAKO_223 🇲🇱`;
        await ctx.replyHTML(msg);
    }
};
