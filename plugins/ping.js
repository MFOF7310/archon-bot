const { performance } = require('perf_hooks'); // Ensure this is at the top!

module.exports = {
    name: 'ping',
    description: 'Check the latency of the Digital Engine.',
    category: 'System',
    async execute(message, args, client) {
        const start = performance.now();
        const msg = await message.reply('🛰️ **Pinging satellite node...**');
        
        // Use Math.round to turn 516.994... into 517
        const latency = Math.round(performance.now() - start);

        const apiLatency = client.ws.ping;
        const apiDisplay = apiLatency > 0 ? `${Math.round(apiLatency)}ms` : 'Synchronizing...';

        let signal;
        if (latency < 100) signal = '🟢 Excellent';
        else if (latency < 200) signal = '🟡 Good';
        else if (latency < 500) signal = '🟡 Average';
        else signal = '🔴 Critical Lag';

        await msg.edit(
            `📡 **NODE LATENCY:** \`${latency}ms\`\n` +
            `🧠 **API HEARTBEAT:** \`${apiDisplay}\`\n` +
            `📶 **SIGNAL:** ${signal}`
        );
    },
};
