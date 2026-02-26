module.exports = {
    name: 'ping',
    description: 'Check bot latency',
    async execute(message) {
        const msg = await message.reply("🏓 **Pinging...**");
        const latency = msg.createdTimestamp - message.createdTimestamp;
        return msg.edit(`🏓 **Pong!**\n📡 API Latency: \`${message.client.ws.ping}ms\`\n⏱️ Bot Response: \`${latency}ms\``);
    }
};
