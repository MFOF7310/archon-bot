"use strict";
// Texts of the economy and game commands. Bambara falls back to English.
const { langOf } = require('./menu');

const T = {
    en: {
        no_db: 'The database is not reachable right now. Try again in a moment.',
        no_account: "You don't have an account yet. Claim your first reward with /daily.",
        daily_wait: '⏰ <b>Already claimed today</b>\nCome back in {time}. Your streak: {streak} days.',
        daily_done: '🎁 <b>+{total} credits</b>\nStreak {streak} days · +{xp} XP · balance {balance}',
        daily_bonus: '🏆 {days}-day streak: +{bonus} bonus credits!',
        balance: '💰 <b>{name}</b>\n{credits} credits · level {level} · streak {streak} days',
        rank_next: '{need} XP to level {next}', rank_title_next: 'Next title: {title} at level {lv}', rank_top: 'You have the top title.',
        profile_stats: '💰 {credits} credits · 🔥 streak {streak} days\n🎮 {played} games · 🏆 {won} wins · 💬 {msgs} messages',
        lb_t: { level: '🏆 Top levels', xp: '✨ Top XP', credits: '💰 Richest', streak: '🔥 Longest streaks' },
        lb_empty: 'Nobody on this board yet. Be the first with /daily.',
        lb_level: 'level {level}', lb_days: '{n} days',
        b_level: '🏆 Level', b_credits: '💰 Credits', b_streak: '🔥 Streak',
        shop_t: '🛒 Shop', shop_none: 'The shop is empty for now.', shop_note: 'Items are bought on Discord with /shop. Your Telegram credits stay here.', shop_more: '…and {n} more',
        inv_t: '📈 Bamako market', inv_status: '{trend} · returns {mult}%\nBalance {balance} · invested {invested}',
        inv_help: '/invest <amount> · invest (100 minimum)\n/invest claim · withdraw after 6 h',
        inv_min: 'The minimum is 100 credits. Example: /invest 500',
        inv_poor: 'You only have {balance} credits.',
        inv_done: '📈 <b>{amount} credits invested</b>\n{trend} · returns {mult}%\nBalance {balance}. Withdraw with /invest claim after 6 h.',
        inv_none: 'You have nothing invested right now.',
        inv_wait: 'Your investment is {h} h old. You can withdraw it after 6 h.',
        inv_claim: '💰 <b>{ret} credits back</b>\nInvested {inv} · {profit}\nBalance {balance}',
        trend: { bull: '🐂 Rising market', bear: '🐻 Falling market', crab: '🦀 Steady market' },
        ranks: ['🌱 Recruit', '🔹 Field agent', '💠 Cyber specialist', '⚜️ Bamako commander', '👑 System architect'],
    },
    fr: {
        no_db: "La base de données ne répond pas pour le moment. Réessaie dans un instant.",
        no_account: "Tu n'as pas encore de compte. Récupère ta première récompense avec /daily.",
        daily_wait: '⏰ <b>Déjà récupéré aujourd\'hui</b>\nReviens dans {time}. Ta série : {streak} jours.',
        daily_done: '🎁 <b>+{total} crédits</b>\nSérie de {streak} jours · +{xp} XP · solde {balance}',
        daily_bonus: '🏆 Série de {days} jours : +{bonus} crédits en bonus !',
        balance: '💰 <b>{name}</b>\n{credits} crédits · niveau {level} · série de {streak} jours',
        rank_next: 'Encore {need} XP pour le niveau {next}', rank_title_next: 'Prochain titre : {title} au niveau {lv}', rank_top: 'Tu as le titre le plus haut.',
        profile_stats: '💰 {credits} crédits · 🔥 série de {streak} jours\n🎮 {played} parties · 🏆 {won} victoires · 💬 {msgs} messages',
        lb_t: { level: '🏆 Meilleurs niveaux', xp: '✨ Le plus d\'XP', credits: '💰 Les plus riches', streak: '🔥 Plus longues séries' },
        lb_empty: 'Personne dans ce classement pour l\'instant. Sois le premier avec /daily.',
        lb_level: 'niveau {level}', lb_days: '{n} jours',
        b_level: '🏆 Niveau', b_credits: '💰 Crédits', b_streak: '🔥 Série',
        shop_t: '🛒 Boutique', shop_none: 'La boutique est vide pour le moment.', shop_note: 'Les articles s\'achètent sur Discord avec /shop. Tes crédits Telegram restent ici.', shop_more: '…et {n} de plus',
        inv_t: '📈 Marché de Bamako', inv_status: '{trend} · rendement {mult} %\nSolde {balance} · investi {invested}',
        inv_help: '/invest <montant> · investir (100 minimum)\n/invest claim · retirer après 6 h',
        inv_min: 'Le minimum est de 100 crédits. Exemple : /invest 500',
        inv_poor: 'Tu n\'as que {balance} crédits.',
        inv_done: '📈 <b>{amount} crédits investis</b>\n{trend} · rendement {mult} %\nSolde {balance}. Retire avec /invest claim après 6 h.',
        inv_none: 'Tu n\'as rien d\'investi pour le moment.',
        inv_wait: 'Ton investissement a {h} h. Tu pourras le retirer après 6 h.',
        inv_claim: '💰 <b>{ret} crédits récupérés</b>\nInvesti {inv} · {profit}\nSolde {balance}',
        trend: { bull: '🐂 Marché en hausse', bear: '🐻 Marché en baisse', crab: '🦀 Marché stable' },
        ranks: ['🌱 Recrue', '🔹 Agent de terrain', '💠 Cyber-spécialiste', '⚜️ Commandant de Bamako', '👑 Architecte système'],
    },
    zh: {
        no_db: '数据库暂时无法连接，请稍后再试。',
        no_account: '你还没有账户。用 /daily 领取第一份奖励吧。',
        daily_wait: '⏰ <b>今天已经领取过了</b>\n请在 {time} 后再来。连续签到：{streak} 天。',
        daily_done: '🎁 <b>+{total} 积分</b>\n连续 {streak} 天 · +{xp} 经验 · 余额 {balance}',
        daily_bonus: '🏆 连续 {days} 天：额外奖励 {bonus} 积分！',
        balance: '💰 <b>{name}</b>\n{credits} 积分 · 等级 {level} · 连续 {streak} 天',
        rank_next: '距离 {next} 级还差 {need} 经验', rank_title_next: '下一个称号：{title}（{lv} 级）', rank_top: '你已获得最高称号。',
        profile_stats: '💰 {credits} 积分 · 🔥 连续 {streak} 天\n🎮 {played} 局游戏 · 🏆 {won} 胜 · 💬 {msgs} 条消息',
        lb_t: { level: '🏆 等级排行', xp: '✨ 经验排行', credits: '💰 财富排行', streak: '🔥 连续签到排行' },
        lb_empty: '排行榜还没有人。用 /daily 成为第一个吧。',
        lb_level: '{level} 级', lb_days: '{n} 天',
        b_level: '🏆 等级', b_credits: '💰 积分', b_streak: '🔥 连续',
        shop_t: '🛒 商店', shop_none: '商店暂时是空的。', shop_note: '商品在 Discord 上用 /shop 购买。你的 Telegram 积分保留在这里。', shop_more: '……还有 {n} 件',
        inv_t: '📈 巴马科市场', inv_status: '{trend} · 回报 {mult}%\n余额 {balance} · 已投资 {invested}',
        inv_help: '/invest <数量> · 投资（最少 100）\n/invest claim · 6 小时后取回',
        inv_min: '最少投资 100 积分。例如：/invest 500',
        inv_poor: '你只有 {balance} 积分。',
        inv_done: '📈 <b>已投资 {amount} 积分</b>\n{trend} · 回报 {mult}%\n余额 {balance}。6 小时后用 /invest claim 取回。',
        inv_none: '你目前没有任何投资。',
        inv_wait: '你的投资已有 {h} 小时，满 6 小时后才能取回。',
        inv_claim: '💰 <b>取回 {ret} 积分</b>\n投资 {inv} · {profit}\n余额 {balance}',
        trend: { bull: '🐂 上涨行情', bear: '🐻 下跌行情', crab: '🦀 平稳行情' },
        ranks: ['🌱 新兵', '🔹 外勤特工', '💠 网络专家', '⚜️ 巴马科指挥官', '👑 系统架构师'],
    },
    ar: {
        no_db: 'قاعدة البيانات لا تستجيب حاليًا. حاول بعد قليل.',
        no_account: 'ليس لديك حساب بعد. احصل على مكافأتك الأولى عبر /daily.',
        daily_wait: '⏰ <b>استلمتها اليوم بالفعل</b>\nعد بعد {time}. سلسلتك: {streak} يومًا.',
        daily_done: '🎁 <b>+{total} رصيد</b>\nسلسلة {streak} يومًا · +{xp} خبرة · الرصيد {balance}',
        daily_bonus: '🏆 سلسلة {days} يومًا: +{bonus} رصيد إضافي!',
        balance: '💰 <b>{name}</b>\n{credits} رصيد · المستوى {level} · سلسلة {streak} يومًا',
        rank_next: 'تبقى {need} خبرة للمستوى {next}', rank_title_next: 'اللقب التالي: {title} في المستوى {lv}', rank_top: 'لديك أعلى لقب.',
        profile_stats: '💰 {credits} رصيد · 🔥 سلسلة {streak} يومًا\n🎮 {played} لعبة · 🏆 {won} فوز · 💬 {msgs} رسالة',
        lb_t: { level: '🏆 أعلى المستويات', xp: '✨ أكثر خبرة', credits: '💰 الأغنى', streak: '🔥 أطول السلاسل' },
        lb_empty: 'لا أحد في هذا الترتيب بعد. كن الأول عبر /daily.',
        lb_level: 'المستوى {level}', lb_days: '{n} يومًا',
        b_level: '🏆 المستوى', b_credits: '💰 الرصيد', b_streak: '🔥 السلسلة',
        shop_t: '🛒 المتجر', shop_none: 'المتجر فارغ حاليًا.', shop_note: 'تُشترى العناصر على Discord عبر /shop. يبقى رصيدك في Telegram هنا.', shop_more: '…و{n} أخرى',
        inv_t: '📈 سوق باماكو', inv_status: '{trend} · العائد {mult}%\nالرصيد {balance} · المستثمر {invested}',
        inv_help: '/invest <مبلغ> · استثمر (100 كحد أدنى)\n/invest claim · اسحب بعد 6 ساعات',
        inv_min: 'الحد الأدنى 100 رصيد. مثال: /invest 500',
        inv_poor: 'لديك {balance} رصيد فقط.',
        inv_done: '📈 <b>تم استثمار {amount} رصيد</b>\n{trend} · العائد {mult}%\nالرصيد {balance}. اسحب عبر /invest claim بعد 6 ساعات.',
        inv_none: 'ليس لديك أي استثمار حاليًا.',
        inv_wait: 'عمر استثمارك {h} ساعة. يمكنك سحبه بعد 6 ساعات.',
        inv_claim: '💰 <b>استرجعت {ret} رصيد</b>\nالمستثمر {inv} · {profit}\nالرصيد {balance}',
        trend: { bull: '🐂 سوق صاعد', bear: '🐻 سوق هابط', crab: '🦀 سوق مستقر' },
        ranks: ['🌱 مجنّد', '🔹 عميل ميداني', '💠 خبير رقمي', '⚜️ قائد باماكو', '👑 مهندس النظام'],
    },
};

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function tr(ctx) {
    const lang = langOf(ctx.userId, (ctx.message || ctx.callbackQuery)?.from?.language_code);
    const fn = (key, vars = {}) => {
        let v = (T[lang] && T[lang][key] !== undefined) ? T[lang][key] : (T.en[key] !== undefined ? T.en[key] : key);
        if (typeof v !== 'string') return v;
        for (const [k, x] of Object.entries(vars)) v = v.split(`{${k}}`).join(k.endsWith('_html') ? String(x) : esc(x));
        return v;
    };
    fn.lang = lang;
    fn.num = (n) => Number(n || 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
    return fn;
}
module.exports = { tr, esc, _T: T };
