// /list (also /menu, /commands) — every command by area, with one button per area.
// Built from the commands already loaded: it used to reload every plugin file on each use.
const { m: M, langOf, catName, esc } = require('../lang/menu');

function areas(bridge) {
    const map = new Map();
    for (const [, c] of bridge.commands) {
        if (!c || c.hidden || c.ownerOnly) continue;
        const cat = c.category || 'General';
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat).push(c);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

// The overview: one button per area
function overview(bridge, lang, note = '') {
    const all = areas(bridge);
    const total = all.reduce((n, [, c]) => n + c.length, 0);
    const rows = [];
    for (let i = 0; i < all.length; i += 2) {
        rows.push(all.slice(i, i + 2).map(([cat, cmds]) => ({ text: `${catName(lang, cat)} · ${cmds.length}`, callback_data: `list_cat_${String(cat).toLowerCase()}` })));
    }
    return { text: `<b>${M(lang, 'list_t')}</b>\n${note ? note + '\n' : ''}${M(lang, 'list_d', { n: total })}`, markup: { inline_keyboard: rows } };
}

// One area: each command with what it does
function area(bridge, lang, cat, cmds) {
    const lines = cmds.map((c) => `<code>/${esc(c.name)}</code> · ${esc(String(c.description || '').slice(0, 70))}`);
    return { text: `<b>${catName(lang, cat)}</b>\n\n${lines.join('\n')}\n\n<i>${M(lang, 'all_hint')}</i>`, markup: { inline_keyboard: [[{ text: M(lang, 'b_areas'), callback_data: 'list_main' }]] } };
}

module.exports = {
    name: 'list',
    aliases: ['menu', 'commands', 'help2', 'cmds'],
    description: 'Browse all commands by area',
    category: 'System',
    usage: '/list [area]',
    overview, area, areas,

    handler: async (ctx) => {
        const lang = langOf(ctx.userId, (ctx.message || ctx.callbackQuery)?.from?.language_code);
        const q = String(ctx.args[0] || '').toLowerCase();
        let view;
        if (q) {
            const found = areas(ctx.bridge).find(([cat]) => cat.toLowerCase().includes(q));
            view = found ? area(ctx.bridge, lang, found[0], found[1]) : overview(ctx.bridge, lang, M(lang, 'list_none', { q: esc(q) }));
        } else view = overview(ctx.bridge, lang);
        // From a button: change the card in place; from a command: send it
        const msgId = ctx.callbackQuery?.message?.message_id;
        if (msgId) return ctx.edit(msgId, view.text, { parse_mode: 'HTML', extra: { reply_markup: view.markup } });
        return ctx.bridge.sendTo(ctx.chatId, view.text, { parse_mode: 'HTML', extra: { reply_markup: view.markup } });
    },
};
