module.exports = {
    name: 'alive',
    aliases: ['status', 'ping', 'uptime'],
    // 🔥 Use 'handler' instead of 'run' (or both for compatibility)
    handler: async (ctx) => {
        const uptimeVal = process.uptime();
        const h = Math.floor(uptimeVal / 3600);
        const m = Math.floor((uptimeVal % 3600) / 60);
        const s = Math.floor(uptimeVal % 60);
        
        const msgLatency = Date.now() - (ctx.message.date * 1000);
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const version = ctx.client?.version || '1.7.0';

        const statusReport = `
<code>╭───────── SYSTEM STATUS ──────────
│ 🟢 STATE   : ACTIVE / ONLINE
│ ⚡ ENGINE  : ARCHITECT-CG-223
│ 📍 NODE    : BAMAKO-ML 🇲🇱
│ 📡 LATENCY : ${msgLatency}ms
│ ⏳ UPTIME  : ${h}h ${m}m ${s}s
│ 💾 MEMORY  : ${memoryUsage} MB
│ 📦 VERSION : v${version}
╰──────────────────────────────────</code>
<b>« DIGITAL ENGINE SYNCED »</b>`;

        // 🔥 Use ctx.replyWithHTML (now available!)
        await ctx.replyWithHTML(statusReport);
    },
    // 🔥 Add 'run' as alias for backward compatibility
    run: async (ctx) => {
        return module.exports.handler(ctx);
    }
};