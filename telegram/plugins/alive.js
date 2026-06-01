// ═══════════════════════════════════════════
//  TG COMMAND: Alive / Status
// ═══════════════════════════════════════════

const formatUptime = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`; };

module.exports = {
    name: 'alive',
    description: 'Check bot system status',
    category: 'Utility',
    aliases: ['status', 'uptime', 'sysinfo'],

    handler: async (ctx) => {
        const uptime = process.uptime();
        const latency = Date.now() - (ctx.message.date * 1000);
        const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const ping = Math.round(ctx.client?.ws?.ping || 0);

        const msg = `⚡ <b>SYSTEM STATUS</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
            `State    · 🟢 Active\n` +
            `Engine   · Architect-CG-223\n` +
            `Node     · BAMAKO_223 🇲🇱\n` +
            `Version  · v3.0.0\n` +
            `Latency  · ${latency}ms\n` +
            `Ping     · ${ping}ms\n` +
            `Uptime   · ${formatUptime(uptime)}\n` +
            `Memory   · ${memUsage} MB\n\n` +
            `🦅 Digital Engine Synced`;

        await ctx.reply(msg);
    }
};
