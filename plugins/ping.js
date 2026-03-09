const { performance } = require('perf_hooks');

module.exports = {
    name: 'ping',
    description: 'Check the latency of the Digital Engine.',
    category: 'System',
    run: async (client, message, args, database) => {
        const start = performance.now();
        const msg = await message.reply('🛰️ **Pinging satellite node...**');
        const latency = Math.round(performance.now() - start);
        const apiLatency = client.ws.ping;
        const apiDisplay = apiLatency > 0 ? `${Math.round(apiLatency)}ms` : 'Syncing...';

        let signal = latency < 200 ? '🟢 Excellent' : latency < 500 ? '🟡 Average' : '🔴 Critical';

        await msg.edit(
            `📡 **NODE LATENCY:** \`${latency}ms\`\n` +
            `🧠 **API HEARTBEAT:** \`${apiDisplay}\`\n` +
            `📶 **SIGNAL:** ${signal}`
        );
    },
};
