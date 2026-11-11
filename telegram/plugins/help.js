// /help — without a command: the same menu as /start. With a command: what it does and how to use it.
const { m: M, langOf, startMenu, esc } = require('../lang/menu');

module.exports = {
    name: 'help',
    description: 'The menu, or the details of one command',
    category: 'System',
    usage: '/help [command]',
    aliases: ['h', 'cmd'], // 'menu' and 'commands' open the list (list.js)

    handler: async (ctx) => {
        const lang = langOf(ctx.userId, ctx.message?.from?.language_code);
        const asked = String(ctx.args[0] || '').replace(/^\//, '').toLowerCase();

        if (asked) {
            const cmd = ctx.bridge.getCommand(asked);
            if (!cmd) return ctx.replyHTML(M(lang, 'help_unknown', { cmd: esc(asked) }), { extra: { reply_markup: { inline_keyboard: [[{ text: M(lang, 'b_all'), callback_data: 'm:cmds' }]] } } });
            const lines = [`<b>/${esc(cmd.name)}</b>`, esc(cmd.description || ''), '', `<code>${esc(cmd.usage || '/' + cmd.name)}</code>`];
            if (cmd.aliases?.length) lines.push(`<i>${M(lang, 'help_also', { list: cmd.aliases.map((a) => '/' + esc(a)).join(' ') })}</i>`);
            if (cmd.ownerOnly) lines.push(M(lang, 'help_owner'));
            else if (cmd.adminOnly) lines.push(M(lang, 'help_admin'));
            return ctx.replyHTML(lines.join('\n'));
        }

        const menu = startMenu(ctx.message?.from?.first_name || ctx.username, lang);
        return ctx.bridge.sendTo(ctx.chatId, menu.text, { parse_mode: 'HTML', extra: { reply_markup: menu.markup } });
    },
};
