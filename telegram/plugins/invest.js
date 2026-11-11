// ═══════════════════════════════════════════
//  TG COMMAND: Investment System
// ═══════════════════════════════════════════

const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

// Simulated market
// Picked at random on start-up too: it always started as a rising market, so investing right after a restart paid
const START = [{ name: 'bull', multiplier: 1.1 + Math.random() * 0.3 }, { name: 'bear', multiplier: 0.7 + Math.random() * 0.3 }, { name: 'crab', multiplier: 0.95 + Math.random() * 0.1 }][Math.floor(Math.random() * 3)];
let marketState = {
    trend: START.name,
    multiplier: START.multiplier,
    lastUpdate: Date.now(),
    history: [],
};

setInterval(() => {
    const trends = [
        { name: 'bull', multiplier: 1.1 + Math.random() * 0.3 },
        { name: 'bear', multiplier: 0.7 + Math.random() * 0.3 },
        { name: 'crab', multiplier: 0.95 + Math.random() * 0.1 },
    ];
    const t = trends[Math.floor(Math.random() * trends.length)];
    marketState = { ...t, lastUpdate: Date.now(), history: [...marketState.history, { ...t, time: Date.now() }].slice(-20) };
}, 6 * 3600 * 1000);

const E = require('../econ');
const { tr } = require('../lang/play');

module.exports = {
    name: 'invest',
    description: 'Invest credits in the Bamako market and withdraw after 6 hours',
    category: 'Economy',
    usage: '/invest <amount> | /invest claim',
    aliases: ['stake'], // 'market' opens the shop

    handler: async (ctx) => {
        const T = tr(ctx), db = ctx.client?.db;
        if (!db) return ctx.replyHTML(T('no_db'));
        const action = String(ctx.args[0] || '').toLowerCase();
        const userId = String(ctx.userId);
        const trend = T('trend')[marketState.trend];
        const mult = (marketState.multiplier * 100).toFixed(0);
        const balanceOf = () => E.getUser(db, userId)?.credits || 0;

        if (!action || action === 'status') {
            const invested = db.prepare('SELECT SUM(amount) AS total FROM investments WHERE user_id = ? AND claimed = 0').get(userId)?.total || 0;
            return ctx.replyHTML(`<b>${T('inv_t')}</b>\n${T('inv_status', { trend, mult, balance: T.num(balanceOf()), invested: T.num(invested) })}\n\n<code>${T('inv_help').split('\n').join('</code>\n<code>')}</code>`);
        }

        if (action === 'claim') {
            const list = db.prepare('SELECT * FROM investments WHERE user_id = ? AND claimed = 0').all(userId);
            if (!list.length) return ctx.replyHTML(T('inv_none'));
            let ret = 0, inv = 0;
            for (const i of list) {
                const hours = (Date.now() - i.invested_at) / 3600000;
                if (hours < 6) return ctx.replyHTML(T('inv_wait', { h: Math.floor(hours) }));
                inv += i.amount;
                // Time adds at most 24 % (it grew 1 % an hour with no end, so an old investment became endless money)
                ret += Math.floor(i.amount * Math.max(0.5, marketState.multiplier * (1 + Math.min(hours, 48) / 200)));
            }
            const balance = balanceOf() + ret;
            E.update(db, userId, { credits: balance });
            db.prepare('UPDATE investments SET claimed = 1 WHERE user_id = ? AND claimed = 0').run(userId);
            const profit = ret - inv;
            return ctx.replyHTML(T('inv_claim', { ret: T.num(ret), inv: T.num(inv), profit: (profit >= 0 ? '+' : '') + T.num(profit), balance: T.num(balance) }));
        }

        const amount = parseInt(action, 10);
        if (!Number.isFinite(amount) || amount < 100) return ctx.replyHTML(T('inv_min'));
        const have = balanceOf();
        if (have < amount) return ctx.replyHTML(T('inv_poor', { balance: T.num(have) }));
        E.update(db, userId, { credits: have - amount });
        db.prepare('INSERT INTO investments (id, user_id, amount, invested_at, claimed) VALUES (?, ?, ?, ?, 0)').run(`${userId}_${Date.now()}`, userId, amount, Date.now());
        return ctx.replyHTML(T('inv_done', { amount: T.num(amount), trend, mult, balance: T.num(have - amount) }));
    },
};
