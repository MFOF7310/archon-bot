// ═══════════════════════════════════════════
//  TG COMMAND: Ping
// ═══════════════════════════════════════════

module.exports = {
    name: 'ping',
    description: 'Test bot response latency',
    category: 'Utility',
    aliases: ['pong', 'latency'],

    handler: async (ctx) => {
        const start = Date.now();
        await ctx.replyHTML(`📡 <i>Measuring...</i>`);
        const latency = Date.now() - start;
        const wsPing = Math.round(ctx.client?.ws?.ping || 0);

        let emoji, rating;
        if (latency < 100) { emoji = '🔥'; rating = 'LEGENDARY!'; }
        else if (latency < 200) { emoji = '⚡'; rating = 'ELITE!'; }
        else if (latency < 300) { emoji = '🌟'; rating = 'GOOD'; }
        else { emoji = '🐢'; rating = 'SLOW'; }

        await ctx.replyHTML(
            `📡 <b>PING RESULT</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
            `${emoji} <b>${rating}</b>\n` +
            `📡 Latency: <b>${latency}ms</b>\n` +
            `📡 Discord: <b>${wsPing}ms</b>\n` +
            `📍 Node: BAMAKO_223 🇲🇱`
        );
    }
};
