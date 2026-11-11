// /purge N — deletes the N messages above the command. Only real deletions are counted, and the short
// confirmation removes itself, so the chat ends up clean.
const { guard } = require('../mod');
const { tr } = require('../lang/mod');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
    name: 'purge', aliases: ['clear', 'clean', 'wipe'], description: 'Delete the last messages (1-100)', category: 'Moderation',
    usage: '/purge [1-100]', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!(await guard(ctx, t, 'can_delete_messages'))) return;
        const n = parseInt(ctx.args[0], 10);
        if (!(n >= 1 && n <= 100)) return ctx.replyHTML(t('purge_help'));
        const base = ctx.message.message_id;
        await ctx.bridge.deleteMessage(ctx.chatId, base);
        let deleted = 0;
        // Message ids aren't contiguous (service messages, other chats' threads), so look a bit further back
        for (let i = 1; i <= n * 2 && deleted < n; i++) {
            const r = await ctx.bridge.deleteMessage(ctx.chatId, base - i).catch(() => null);
            if (r?.success) deleted++;
            await sleep(40);
        }
        const done = await ctx.bridge.sendTo(ctx.chatId, t('purged', { n: deleted }), { parse_mode: 'HTML' }).catch(() => null);
        const id = done?.data?.message_id;
        if (id) setTimeout(() => ctx.bridge.deleteMessage(ctx.chatId, id).catch(() => {}), 4000);
    },
};
