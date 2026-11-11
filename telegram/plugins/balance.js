// /balance — credits, level and streak in two lines
const E = require('../econ');
const { tr, esc } = require('../lang/play');

module.exports = {
    name: 'balance',
    description: 'Your credits, level and streak',
    category: 'Economy',
    usage: '/balance',
    aliases: ['credits', 'money', 'bal', 'wallet'],

    handler: async (ctx) => {
        const T = tr(ctx), db = ctx.client?.db;
        if (!db) return ctx.replyHTML(T('no_db'));
        const u = E.getUser(db, ctx.userId) || {};
        return ctx.replyHTML(T('balance', { name_html: esc(ctx.username), credits: T.num(u.credits), level: u.level || 1, streak: u.streak_days || 0 }));
    },
};
