const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

module.exports = {
    name: 'balance',
    description: 'Check your credit balance',
    category: 'Economy',
    usage: '/balance',
    aliases: ['credits', 'money', 'bal', 'wallet'],

    handler: async (ctx) => {
        const db = ctx.client?.db;
        const userId = ctx.userId.toString();
        const username = ctx.username;

        if (!db) return ctx.replyHTML(ctx.t('no_db'));

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        const balanceLabels = {
            en: { title: 'BALANCE', credits: 'Credits', level: 'Level', xp: 'XP', streak: 'Streak', days: 'days' },
            fr: { title: 'SOLDE', credits: 'Crédits', level: 'Niveau', xp: 'XP', streak: 'Série', days: 'jours' },
            bm: { title: 'WARI', credits: 'Wari', level: 'Hakɛ', xp: 'XP', streak: 'Tile', days: 'tile' },
            zh: { title: '余额', credits: '积分', level: '等级', xp: '经验', streak: '连续', days: '天' },
        };

        const l = balanceLabels[ctx.lang] || balanceLabels.en;

        if (user) {
            await ctx.replyHTML(
                `💰 <b>${username}'s ${l.title}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🪙 ${l.credits}: <b>${formatNumber(user.credits || 0)}</b>\n` +
                `📊 ${l.level}: <b>${user.level || 1}</b>\n` +
                `✨ ${l.xp}: <b>${formatNumber(user.xp || 0)}</b>\n` +
                `🔥 ${l.streak}: <b>${user.streak_days || 0}</b> ${l.days}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n📍 BAMAKO_223 🇲🇱`
            );
        } else {
            await ctx.replyHTML(
                `💰 <b>${username}'s ${l.title}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🪙 ${l.credits}: <b>0</b>\n` +
                `📊 ${l.level}: <b>1</b>\n` +
                `✨ ${l.xp}: <b>0</b>\n` +
                `🔥 ${l.streak}: <b>0</b> ${l.days}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n📍 BAMAKO_223 🇲🇱`
            );
        }
    }
};
