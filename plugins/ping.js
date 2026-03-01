module.exports = {
    name: 'ping',
    description: 'Check the latency of the Digital Engine.',
    category: 'System',
    async execute(message, args, client) {
        // Initial heartbeat message
        const msg = await message.reply('🛰️ **Pinging satellite node...**');

        // 1. Calculate Roundtrip Latency
        const latency = msg.createdTimestamp - message.createdTimestamp;

        // 2. Get API Latency (WebSocket)
        // Fallback to 'Connecting...' if heartbeat hasn't finished
        const apiLatency = client.ws.ping > 0 ? `${Math.round(client.ws.ping)}ms` : 'Synchronizing...';

        // 3. Update with final data
        await msg.edit(`📡 **Node Latency:** \`${latency}ms\` | 🧠 **API Heartbeat:** \`${apiLatency}\``);
    },
};
