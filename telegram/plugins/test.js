const { sendTelegramMessage } = require('../bot');

module.exports = {
    name: 'test',
    aliases: ['t'],
    handler: async (ctx) => {
        await sendTelegramMessage(ctx.token, ctx.chatId, 
            `✅ <b>Test Successful!</b>\n\n` +
            `User: ${ctx.username}\n` +
            `Chat ID: ${ctx.chatId}\n` +
            `Args: ${ctx.args.join(' ') || 'none'}`
        );
    }
};