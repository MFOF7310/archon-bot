// /admins — who runs this group. Anyone can ask.
const { api, esc } = require('../mod');
const { tr } = require('../lang/mod');

module.exports = {
    name: 'admins', aliases: ['admin', 'adminlist', 'staff'], description: 'List the group admins', category: 'Moderation',
    usage: '/admins',
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!ctx.isGroup) return ctx.replyHTML(t('groups_only'));
        const r = await api(ctx.bridge.token, 'getChatAdministrators', { chat_id: ctx.chatId });
        if (!r.ok) return ctx.replyHTML(t('failed'));
        const people = r.result.filter((a) => !a.user.is_bot && !a.is_anonymous);
        const name = (a) => esc(a.user.first_name || a.user.username || a.user.id);
        const lines = people.sort((a, b) => (a.status === 'creator' ? -1 : b.status === 'creator' ? 1 : 0)).map((a) =>
            a.status === 'creator' ? `🌟 <b>${name(a)}</b> · ${t('owner')}` : `• ${name(a)}${a.custom_title ? ` · <i>${esc(a.custom_title)}</i>` : ''}`);
        return ctx.replyHTML(`${t('admins_t')}\n\n${lines.join('\n')}\n\n<i>${t('admins_n', { n: people.length })}</i>`);
    },
};
