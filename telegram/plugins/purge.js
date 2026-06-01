// ═══════════════════════════════════════════
//  TG COMMAND: Purge
// ═══════════════════════════════════════════

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = {
    name: 'purge',
    description: 'Delete multiple messages (admin only)',
    category: 'Moderation',
    usage: '/purge [1-100]',
    aliases: ['clear', 'clean', 'wipe'],
    adminOnly: true,

    handler: async (ctx) => {
        const amount = parseInt(ctx.args[0]) || 10;
        if (amount < 1 || amount > 100) {
            return ctx.replyHTML(`🧹 <b>Purge</b>\n\n<code>/purge [1-100]</code>\nExample: <code>/purge 50</code>`);
        }

        await ctx.bridge.deleteMessage(ctx.chatId, ctx.message.message_id);
        const proc = await ctx.replyHTML(`🧹 <i>Deleting ${amount} messages...</i>`);

        let deleted = 0;
        const baseId = ctx.message.message_id;
        for (let i = 1; i <= amount + 2; i++) {
            try {
                await ctx.bridge.deleteMessage(ctx.chatId, baseId - i);
                deleted++;
                await sleep(80);
            } catch { /* might be too old */ }
        }

        await ctx.bridge.deleteMessage(ctx.chatId, proc.result?.message_id || proc);
        const done = await ctx.replyHTML(`✅ <b>${deleted}</b> messages deleted`);
        setTimeout(() => ctx.bridge.deleteMessage(ctx.chatId, done.result?.message_id || done).catch(() => {}), 3000);
    }
};
