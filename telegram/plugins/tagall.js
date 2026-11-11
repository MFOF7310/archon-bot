// /tagall message — notifies the group's admins (Telegram doesn't let bots list every member)
const { api, guard, esc } = require('../mod');
const { tr } = require('../lang/mod');

module.exports = {
    name: 'tagall', aliases: ['mentionall', 'everyone'], description: 'Notify all admins', category: 'Moderation',
    usage: '/tagall <message>', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!(await guard(ctx, t))) return;
        const text = ctx.args.join(' ').trim();
        if (!text) return ctx.replyHTML(t('tag_help'));
        const r = await api(ctx.bridge.token, 'getChatAdministrators', { chat_id: ctx.chatId });
        if (!r.ok) return ctx.replyHTML(t('failed'));
        const tags = r.result.filter((a) => !a.user.is_bot && String(a.user.id) !== String(ctx.userId))
            .map((a) => `<a href="tg://user?id=${a.user.id}">${esc(a.user.first_name || a.user.username)}</a>`);
        return ctx.replyHTML(`📢 <b>${esc(text.slice(0, 500))}</b>\n\n${tags.join(' · ')}`);
    },
};
