module.exports = {
    name: 'ping',
    description: 'Check the latency of the Digital Engine.',
    async execute(message, args, client) {
        const msg = await message.reply('🛰️ Pinging satellite...');
        const latency = msg.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        msg.edit(`📡 **Starlink Latency:** ${latency}ms | 🧠 **API Ping:** ${apiLatency}ms`);
    },
};
