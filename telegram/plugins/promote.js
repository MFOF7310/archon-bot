// /promote (reply) — makes someone admin. They get at most the rights the promoter has, and never the right to
// promote others, so an admin can't use the bot to hand out more than they hold.
const { api, target, guard, fail, logAction, link } = require('../mod');
const { tr } = require('../lang/mod');
const RIGHT = 'can_promote_members';
const GIVE = ['can_manage_chat', 'can_delete_messages', 'can_restrict_members', 'can_pin_messages', 'can_invite_users', 'can_manage_video_chats'];

module.exports = {
    name: 'promote', aliases: ['makeadmin'], description: 'Make a member admin', category: 'Moderation',
    usage: '/promote (reply)', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!(await guard(ctx, t, RIGHT))) return;
        const who = target(ctx);
        if (!who) return ctx.replyHTML(t('need_target', { cmd: '/promote' }));
        if (who.bot) return ctx.replyHTML(t('no_bots'));
        const me = (await api(ctx.bridge.token, 'getChatMember', { chat_id: ctx.chatId, user_id: ctx.userId })).result || {};
        const rights = Object.fromEntries(GIVE.map((k) => [k, me.status === 'creator' || me[k] === true]));
        rights.can_manage_chat = true;
        const r = await api(ctx.bridge.token, 'promoteChatMember', { chat_id: ctx.chatId, user_id: who.id, ...rights, can_promote_members: false });
        if (!r.ok) return ctx.replyHTML(fail(t, r, RIGHT));
        logAction(ctx, 'promote', who.id);
        return ctx.replyHTML(t('promoted', { who_html: link(who) }));
    },
};
