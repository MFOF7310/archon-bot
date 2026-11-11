// /daily — the Telegram reward: credits and XP every 24 h, more with a streak, a bonus at 7 and 30 days.
const E = require('../econ');
const { tr } = require('../lang/play');

module.exports = {
    name: 'daily',
    description: 'Claim your daily credits; a streak gives more',
    category: 'Economy',
    aliases: ['claim', 'reward', 'collect'],

    handler: async (ctx) => {
        const T = tr(ctx), db = ctx.client?.db;
        if (!db) return ctx.replyHTML(T('no_db'));
        const user = E.ensureUser(db, ctx.userId, ctx.username);
        if (!user) return ctx.replyHTML(T('no_db'));
        const now = Math.floor(Date.now() / 1000), last = user.last_daily || 0, streak = user.streak_days || 0;

        if (now - last < 86400) {
            const left = 86400 - (now - last);
            return ctx.replyHTML(T('daily_wait', { time: `${Math.floor(left / 3600)} h ${String(Math.floor((left % 3600) / 60)).padStart(2, '0')}`, streak }));
        }
        const newStreak = now - last > 172800 ? 1 : streak + 1;
        // The 7- and 30-day bonuses were announced but never added to the balance
        const bonus = newStreak === 7 ? 500 : newStreak === 30 ? 2000 : 0;
        const total = 100 + Math.min(newStreak * 10, 200) + bonus;
        const xpGain = 50 + newStreak * 5;
        const xp = (user.xp || 0) + xpGain, credits = (user.credits || 0) + total;
        E.update(db, ctx.userId, { credits, xp, level: E.levelOf(xp), streak_days: newStreak, last_daily: now, total_dailies: (user.total_dailies || 0) + 1, highest_streak: Math.max(user.highest_streak || 0, newStreak) });

        let msg = T('daily_done', { total: T.num(total), streak: newStreak, xp: xpGain, balance: T.num(credits) });
        if (bonus) msg += '\n' + T('daily_bonus', { days: newStreak, bonus: T.num(bonus) });
        return ctx.replyHTML(msg);
    },
};
