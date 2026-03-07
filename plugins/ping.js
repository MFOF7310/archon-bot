module.exports = {
    name: 'ping',
    description: 'Check the latency of the Digital Engine.',
    category: 'System',
    async execute(message, args, client) {
        // Initial heartbeat message
        const msg = await message.reply('🛰️ **Pinging satellite node...**');

        // 1. Calculate Roundtrip Latency (Message delay)
        const latency = msg.createdTimestamp - message.createdTimestamp;

        // 2. Get API Latency (Discord WebSocket)
        const apiLatency = client.ws.ping;
        const apiDisplay = apiLatency > 0 ? `${Math.round(apiLatency)}ms` : 'Synchronizing...';

        // 3. Determine Signal Strength Emoji
        let signal = '🟢 Excellent';
        if (latency > 200) signal = '🟡 Average';
        if (latency > 500) signal = '🔴 Critical Lag';

        // 4. Update with final system data
        await msg.edit(
            `📡 **NODE LATENCY:** \`${latency}ms\`\n` +
            `🧠 **API HEARTBEAT:** \`${apiDisplay}\`\n` +
            `📶 **SIGNAL:** ${signal}`
        );
    },
};
