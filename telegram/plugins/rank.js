// /rank — level, title and progress to the next level
const E = require('../econ');
const { tr, esc } = require('../lang/play');

module.exports = {
    name: 'rank',
    description: 'Your level, title and progress',
    category: 'Economy',
    usage: '/rank',
    aliases: ['level', 'lvl'],

    handler: async (ctx) => {
        const T = tr(ctx), db = ctx.client?.db;
        if (!db) return ctx.replyHTML(T('no_db'));
        const u = E.getUser(db, ctx.userId);
        if (!u) return ctx.replyHTML(T('no_account'));
        const level = u.level || E.levelOf(u.xp), ranks = T('ranks'), ri = E.rankIndex(level);
        const p = E.progress(u.xp, level);
        const lines = [
            `<b>${ranks[ri]}</b> · ${esc(ctx.username)}`,
            `${E.bar(p.pct)} ${p.pct}%`,
            T('rank_next', { need: T.num(p.need), next: level + 1 }),
            ri < ranks.length - 1 ? T('rank_title_next', { title: ranks[ri + 1], lv: E.RANK_LV[ri + 1] }) : T('rank_top'),
        ];
        return ctx.replyHTML(lines.join('\n'));
    },
};
