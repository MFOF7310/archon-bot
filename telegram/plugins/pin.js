// /pin (reply) [silent]
const { api, guard, fail } = require('../mod');
const { tr } = require('../lang/mod');
const RIGHT = 'can_pin_messages';

module.exports = {
    name: 'pin', aliases: ['pinmsg'], description: 'Pin the replied message', category: 'Moderation',
    usage: '/pin (reply) [silent]', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!(await guard(ctx, t, RIGHT))) return;
        const msg = ctx.message?.reply_to_message;
        if (!msg) return ctx.replyHTML(t('pin_help'));
        const silent = /^(silent|quiet)$/i.test(ctx.args[0] || '');
        const r = await api(ctx.bridge.token, 'pinChatMessage', { chat_id: ctx.chatId, message_id: msg.message_id, disable_notification: silent });
        if (!r.ok) return ctx.replyHTML(fail(t, r, RIGHT));
        return ctx.replyHTML(t('pinned'));
    },
};
