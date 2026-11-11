// /kick — removes a member; they can come back with an invite
const { api, target, guard, fail, logAction, link } = require('../mod');
const { tr } = require('../lang/mod');
const RIGHT = 'can_restrict_members';

module.exports = {
    name: 'kick', aliases: ['remove'], description: 'Remove a member (they can rejoin)', category: 'Moderation',
    usage: '/kick (reply) [reason]', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!(await guard(ctx, t, RIGHT))) return;
        const who = target(ctx);
        if (!who) return ctx.replyHTML(t('need_target', { cmd: '/kick' }));
        if (who.bot) return ctx.replyHTML(t('no_bots'));
        const reason = ctx.args.slice(who.fromArg ? 1 : 0).join(' ') || t('no_reason');
        const tok = ctx.bridge.token;
        const r = await api(tok, 'banChatMember', { chat_id: ctx.chatId, user_id: who.id, until_date: Math.floor(Date.now() / 1000) + 40 });
        if (!r.ok) return ctx.replyHTML(fail(t, r, RIGHT));
        await api(tok, 'unbanChatMember', { chat_id: ctx.chatId, user_id: who.id, only_if_banned: true });
        logAction(ctx, 'kick', who.id, reason);
        return ctx.replyHTML(t('kicked', { who_html: link(who), reason }));
    },
};
