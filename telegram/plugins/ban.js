// /ban — bans a member until /unban
const { api, target, guard, fail, logAction, link } = require('../mod');
const { tr } = require('../lang/mod');
const RIGHT = 'can_restrict_members';

module.exports = {
    name: 'ban', aliases: [], description: 'Ban a member from the group', category: 'Moderation',
    usage: '/ban (reply) [reason]', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!(await guard(ctx, t, RIGHT))) return;
        const who = target(ctx);
        if (!who) return ctx.replyHTML(t('need_target', { cmd: '/ban' }));
        if (who.bot) return ctx.replyHTML(t('no_bots'));
        const reason = ctx.args.slice(who.fromArg ? 1 : 0).join(' ') || t('no_reason');
        const r = await api(ctx.bridge.token, 'banChatMember', { chat_id: ctx.chatId, user_id: who.id });
        if (!r.ok) return ctx.replyHTML(fail(t, r, RIGHT));
        logAction(ctx, 'ban', who.id, reason);
        return ctx.replyHTML(t('banned', { who_html: link(who), reason, id: who.id }));
    },
};
