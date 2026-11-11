// /leaderboard — the Telegram players (it used to mix in every Discord server's rows). Buttons switch the board in place.
const E = require('../econ');
const { tr, esc } = require('../lang/play');
const { show } = require('../ui');

const ORDER = { level: 'level DESC, xp DESC', xp: 'xp DESC', credits: 'credits DESC', streak: 'streak_days DESC' };
const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
    name: 'leaderboard',
    description: 'Top Telegram players by level, credits or streak',
    category: 'Economy',
    usage: '/leaderboard [level|credits|streak]',
    aliases: ['lb', 'top', 'leaders'],

    handler: async (ctx) => {
        const T = tr(ctx), db = ctx.client?.db;
        if (!db) return ctx.replyHTML(T('no_db'));
        const type = ORDER[String(ctx.args[0] || '').toLowerCase()] ? String(ctx.args[0]).toLowerCase() : 'level';
        const rows = db.prepare(`SELECT username, level, xp, credits, streak_days FROM users WHERE guild_id = ? AND (xp > 0 OR credits > 0) ORDER BY ${ORDER[type]} LIMIT 10`).all(E.G);
        const val = (u) => type === 'credits' ? `${T.num(u.credits)} 🪙` : type === 'streak' ? T('lb_days', { n: u.streak_days || 0 }) : type === 'xp' ? `${T.num(u.xp)} XP` : T('lb_level', { level: u.level || 1 });
        const body = rows.length ? rows.map((u, i) => `${MEDALS[i] || `${i + 1}.`} ${esc(u.username || '?')} · ${val(u)}`).join('\n') : T('lb_empty');
        const b = (k, t) => ({ text: (t === type ? '• ' : '') + T(k), callback_data: `cmdx:leaderboard:${t}` });
        return show(ctx, `<b>${T('lb_t')[type]}</b>\n\n${body}`, { inline_keyboard: [[b('b_level', 'level'), b('b_credits', 'credits'), b('b_streak', 'streak')]] });
    },
};
