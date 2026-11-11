// /demote (reply) — takes admin away. Telegram only lets the bot demote admins it promoted itself.
const { api, target, guard, fail, logAction, link } = require('../mod');
const { tr } = require('../lang/mod');
const RIGHT = 'can_promote_members';
const ALL = ['can_manage_chat', 'can_delete_messages', 'can_restrict_members', 'can_pin_messages', 'can_invite_users',
    'can_manage_video_chats', 'can_change_info', 'can_promote_members', 'can_post_stories', 'can_edit_stories', 'can_delete_stories', 'can_manage_topics'];

module.exports = {
    name: 'demote', aliases: ['removeadmin'], description: 'Remove admin from a member', category: 'Moderation',
    usage: '/demote (reply)', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!(await guard(ctx, t, RIGHT))) return;
        const who = target(ctx);
        if (!who) return ctx.replyHTML(t('need_target', { cmd: '/demote' }));
        if (String(who.id) === String(ctx.userId)) return ctx.replyHTML(t('target_admin'));
        const r = await api(ctx.bridge.token, 'promoteChatMember', { chat_id: ctx.chatId, user_id: who.id, ...Object.fromEntries(ALL.map((k) => [k, false])) });
        if (!r.ok) return ctx.replyHTML(fail(t, r, RIGHT));
        logAction(ctx, 'demote', who.id);
        return ctx.replyHTML(t('demoted', { who_html: link(who) }));
    },
};
