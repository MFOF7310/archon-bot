module.exports = {
    name: 'id',
    aliases: ['chatid', 'myid'],
    handler: async (ctx) => {
        const chatId = ctx.chatId;
        const userId = ctx.userId;
        const chatType = ctx.message.chat.type;

        const response = `
<code>╔═════ IDENTIFICATION ═════╗</code>
<b>📡 CHAT ID :</b> <code>${chatId}</code>
<b>👤 USER ID :</b> <code>${userId}</code>
<b>📁 TYPE    :</b> <code>${chatType}</code>
<code>╚══════════════════════════╝</code>
<i>Use this ID in your .env for TELEGRAM_CHAT_ID</i>`;

        await ctx.replyWithHTML(response);
    }
};
