const { performance } = require('perf_hooks');

module.exports = {
    name: 'ping',
    description: 'Check the digital engine latency and API heartbeat.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        const start = performance.now();
        const msg = await message.reply('🛰️ **Pinging satellite node...**');
        const latency = Math.round(performance.now() - start);
        const apiLatency = client.ws.ping;
        
        let signal = latency < 200 ? '🟢 Excellent' : latency < 500 ? '🟡 Average' : '🔴 Critical';

        await msg.edit(
            `📡 **NODE LATENCY:** \`${latency}ms\`\n` +
            `🧠 **API HEARTBEAT:** \`${apiLatency}ms\`\n` +
            `📶 **SIGNAL:** ${signal}`
        );
    },
};