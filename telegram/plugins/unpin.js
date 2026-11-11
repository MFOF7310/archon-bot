// /unpin — the replied message, or the latest pin
const { api, guard, fail } = require('../mod');
const { tr } = require('../lang/mod');
const RIGHT = 'can_pin_messages';

module.exports = {
    name: 'unpin', aliases: ['unpinmsg'], description: 'Unpin a message', category: 'Moderation',
    usage: '/unpin (reply, or latest pin)', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!(await guard(ctx, t, RIGHT))) return;
        const id = ctx.message?.reply_to_message?.message_id;
        const r = await api(ctx.bridge.token, 'unpinChatMessage', id ? { chat_id: ctx.chatId, message_id: id } : { chat_id: ctx.chatId });
        if (!r.ok) return ctx.replyHTML(fail(t, r, RIGHT));
        return ctx.replyHTML(t('unpinned'));
    },
};
