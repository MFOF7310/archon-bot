// /profile — everything about you in one card
const E = require('../econ');
const { tr, esc } = require('../lang/play');

module.exports = {
    name: 'profile',
    description: 'Your full profile',
    category: 'Economy',
    usage: '/profile',
    aliases: ['me', 'stats', 'user'],

    handler: async (ctx) => {
        const T = tr(ctx), db = ctx.client?.db;
        if (!db) return ctx.replyHTML(T('no_db'));
        const u = E.getUser(db, ctx.userId);
        if (!u) return ctx.replyHTML(T('no_account'));
        const level = u.level || E.levelOf(u.xp), p = E.progress(u.xp, level);
        return ctx.replyHTML([
            `👤 <b>${esc(ctx.username)}</b>`,
            `${T('ranks')[E.rankIndex(level)]} · ${T('lb_level', { level })}`,
            `${E.bar(p.pct)} ${p.pct}%`,
            '',
            T('profile_stats', { credits: T.num(u.credits), streak: u.streak_days || 0, played: T.num(u.games_played), won: T.num(u.games_won), msgs: T.num(u.total_messages) }),
        ].join('\n'));
    },
};
