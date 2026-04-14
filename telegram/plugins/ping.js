const { sendLiveMessage } = require('../bot');

module.exports = {
    name: 'ping',
    aliases: ['pong', 'latency'],
    handler: async (ctx) => {
        const start = Date.now();
        const version = ctx.client?.version || '1.7.0';
        
        // Show typing indicator
        await ctx.replyWithHTML('📡 *Measuring latency...*');
        
        const latency = Date.now() - start;
        
        let statusEmoji, statusText;
        if (latency < 100) {
            statusEmoji = '🟢';
            statusText = 'EXCELLENT';
        } else if (latency < 200) {
            statusEmoji = '🟡';
            statusText = 'GOOD';
        } else {
            statusEmoji = '🔴';
            statusText = 'SLOW';
        }
        
        await ctx.replyWithHTML(
            `╔══════════════════════════════════╗\n` +
            `║        📡 NETWORK STATUS         ║\n` +
            `╚══════════════════════════════════╝\n\n` +
            `${statusEmoji} <b>${statusText}</b>\n` +
            `📡 Latency: <b>${latency}ms</b>\n` +
            `📍 Node: BAMAKO_223 🇲🇱\n` +
            `📦 Version: v${version}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `<i>Discord ↔ Telegram Bridge Active</i>`
        );
    }
};