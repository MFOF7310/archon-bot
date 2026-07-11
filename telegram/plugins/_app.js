/*
module.exports = {
    name: 'app',
    aliases: ['miniapp', 'webapp', 'dashboard', 'dash'],
    description: 'Open ARCHON dashboard as Mini App',
    category: 'System',
    usage: '/app',

    handler: async (ctx) => {
        await ctx.bridge.sendTo(ctx.chatId,
            `🦅 <b>ARCHON Dashboard</b>\n━━━━━━━━━━━━━━━━\n\n` +
            `Your full server dashboard — stats, economy, leaderboard and more!\n\n` +
            `🌐 Tap below to open inside Telegram 👇`,
            {
                parse_mode: 'HTML',
                extra: {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🚀 Open Dashboard', web_app: { url: 'https://bamako-steel-dev.xyz' } }
                        ]]
                    }
                }
            }
        );
    }
};
*/
