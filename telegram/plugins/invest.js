// ═══════════════════════════════════════════
//  TG COMMAND: Investment System
// ═══════════════════════════════════════════

const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

// Simulated market
let marketState = {
    trend: 'bull',
    multiplier: 1.15,
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

const TRENDS = { bull: { emoji: '🐂', name: 'Bull Run' }, bear: { emoji: '🐻', name: 'Bear Market' }, crab: { emoji: '🦀', name: 'Crab Market' } };

module.exports = {
    name: 'invest',
    description: 'Invest credits in the Bamako Market',
    category: 'Economy',
    usage: '/invest <amount> | /invest claim | /invest status',
    aliases: ['stake', 'market'],

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const args = ctx.args;
        const action = args[0]?.toLowerCase();
        const userId = ctx.userId.toString();

        if (!db) return ctx.replyHTML(`❌ Database not connected.`);

        // Status
        if (!action || action === 'status') {
            const trend = TRENDS[marketState.trend];
            const userData = db.prepare("SELECT credits FROM users WHERE id = ?").get(userId);
            const invested = db.prepare("SELECT SUM(amount) as total FROM investments WHERE user_id = ? AND claimed = 0").get(userId);
            return ctx.replyHTML(
                `📊 <b>BAMAKO MARKET</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `${trend.emoji} <b>${trend.name}</b>\n` +
                `Multiplier: <b>${(marketState.multiplier * 100).toFixed(1)}%</b>\n\n` +
                `💰 Balance: ${formatNumber(userData?.credits || 0)} 🪙\n` +
                `📈 Invested: ${formatNumber(invested?.total || 0)} 🪙\n\n` +
                `<code>/invest &lt;amount&gt;</code> · Stake\n` +
                `<code>/invest claim</code> · Withdraw`
            );
        }

        // Claim
        if (action === 'claim') {
            const investments = db.prepare("SELECT * FROM investments WHERE user_id = ? AND claimed = 0").all(userId);
            if (investments.length === 0) return ctx.replyHTML(`❌ No active investments!`);

            let totalReturn = 0, totalInvested = 0;
            for (const inv of investments) {
                totalInvested += inv.amount;
                const hours = (Date.now() - inv.invested_at) / 3600000;
                if (hours < 6) return ctx.replyHTML(`⏳ Only ${Math.floor(hours)}h old. Wait 6h.`);
                const multiplier = Math.max(0.5, marketState.multiplier * (1 + hours / 100));
                totalReturn += Math.floor(inv.amount * multiplier);
            }

            const profit = totalReturn - totalInvested;
            const userData = db.prepare("SELECT credits FROM users WHERE id = ?").get(userId);
            const newBalance = (userData?.credits || 0) + totalReturn;
            db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(newBalance, userId);
            db.prepare("UPDATE investments SET claimed = 1 WHERE user_id = ? AND claimed = 0").run(userId);

            return ctx.replyHTML(
                `💰 <b>CLAIMED!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Invested: ${formatNumber(totalInvested)} 🪙\n` +
                `Returned: ${formatNumber(totalReturn)} 🪙\n` +
                `Profit: ${profit >= 0 ? '+' : ''}${formatNumber(profit)} 🪙\n\n` +
                `New Balance: ${formatNumber(newBalance)} 🪙`
            );
        }

        // Invest
        const amount = parseInt(action);
        if (isNaN(amount) || amount < 100) return ctx.replyHTML(`❌ Min investment: <b>100 🪙</b>.\n<code>/invest 500</code>`);

        const userData = db.prepare("SELECT credits FROM users WHERE id = ?").get(userId);
        if (!userData || userData.credits < amount) return ctx.replyHTML(`❌ Insufficient credits! You have ${formatNumber(userData?.credits || 0)} 🪙.`);

        const newBalance = userData.credits - amount;
        db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(newBalance, userId);
        db.prepare("INSERT INTO investments (id, user_id, amount, invested_at, claimed) VALUES (?, ?, ?, ?, 0)")
            .run(`${userId}_${Date.now()}`, userId, amount, Date.now());

        const trend = TRENDS[marketState.trend];
        ctx.replyHTML(
            `📈 <b>INVESTED!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
            `${trend.emoji} ${trend.name}\n` +
            `Amount: <b>${formatNumber(amount)}</b> 🪙\n` +
            `Multiplier: <b>${(marketState.multiplier * 100).toFixed(1)}%</b>\n` +
            `New Balance: ${formatNumber(newBalance)} 🪙\n\n` +
            `<code>/invest claim</code> after 6h`
        );
    }
};
