// /unban <id> — lets a banned member join again
const { api, target, guard, fail, logAction } = require('../mod');
const { tr } = require('../lang/mod');
const RIGHT = 'can_restrict_members';

module.exports = {
    name: 'unban', aliases: [], description: 'Let a banned member rejoin', category: 'Moderation',
    usage: '/unban <user id>', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!(await guard(ctx, t, RIGHT))) return;
        const who = target(ctx);
        if (!who) return ctx.replyHTML(t('unban_help'));
        const r = await api(ctx.bridge.token, 'unbanChatMember', { chat_id: ctx.chatId, user_id: who.id, only_if_banned: true });
        if (!r.ok) return ctx.replyHTML(fail(t, r, RIGHT));
        logAction(ctx, 'unban', who.id);
        return ctx.replyHTML(t('unbanned', { id: who.id }));
    },
};
