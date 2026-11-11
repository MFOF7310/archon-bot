// /shop — what the shop sells. Buying happens on Discord.
const { tr, esc } = require('../lang/play');

module.exports = {
    name: 'shop',
    description: 'See what the shop sells',
    category: 'Economy',
    usage: '/shop',
    aliases: ['store', 'market', 'buy'],

    handler: async (ctx) => {
        const T = tr(ctx);
        const items = (ctx.client?.shopItems || []).filter((i) => !ctx.args[0] || i.type === String(ctx.args[0]).toLowerCase());
        if (!items.length) return ctx.replyHTML(`<b>${T('shop_t')}</b>\n${T('shop_none')}`);
        const loc = (i) => i[T.lang] || i.en || {};
        const lines = items.slice(0, 12).map((i) => `${i.emoji || '📦'} <b>${esc(loc(i).name || i.id)}</b> · ${T.num(i.price)} 🪙${(loc(i).perk || loc(i).desc) ? `\n<i>${esc(loc(i).perk || loc(i).desc)}</i>` : ''}`);
        if (items.length > 12) lines.push(`<i>${T('shop_more', { n: items.length - 12 })}</i>`);
        return ctx.replyHTML(`<b>${T('shop_t')}</b>\n\n${lines.join('\n')}\n\n<i>${T('shop_note')}</i>`);
    },
};
