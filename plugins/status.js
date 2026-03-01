const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'status',
    description: 'Check the Digital Engine system health and uptime.',
    category: 'System',
    async execute(message) {
        const uptimeVal = process.uptime();
        const d = Math.floor(uptimeVal / 86400);
        const h = Math.floor((uptimeVal % 86400) / 3600);
        const m = Math.floor((uptimeVal % 3600) / 60);

        // RSS Memory is the most accurate "real" RAM usage
        const usedMemory = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

        const statusEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle('🖥️ ENGINE OPERATIONAL STATUS')
            .addFields(
                { name: '🛰️ Connection', value: '`Starlink (Bamako)`', inline: true },
                { name: '⚙️ Engine', value: '`v2.6 AES Edition`', inline: true },
                { name: '⏱️ Uptime', value: `\`${d}d ${h}h ${m}m\``, inline: false },
                { name: '🧠 RAM Usage', value: `\`${usedMemory} MB\``, inline: true },
                { name: '📡 Ping', value: `\`${message.client.ws.ping}ms\``, inline: true }
            )
            .setFooter({ text: 'CLOUD GAMING-223 | DIGITAL ENGINE' })
            .setTimestamp();

        message.reply({ embeds: [statusEmbed] });
    },
};
