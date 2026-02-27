const { EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'status',
    description: 'Check the Digital Engine system health and uptime.',
    async execute(message) {
        // Calculate Uptime
        const totalSeconds = (message.client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const seconds = Math.floor(totalSeconds % 60);

        // Memory Usage
        const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

        const statusEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle('🖥️ SYSTEM OPERATIONAL STATUS')
            .addFields(
                { name: '🛰️ Connection', value: 'Starlink (Bamako)', inline: true },
                { name: '⚙️ Engine', value: 'v2.5 Modular', inline: true },
                { name: '⏱️ Uptime', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: false },
                { name: '🧠 RAM Usage', value: `${usedMemory} MB / ${totalMemory} GB`, inline: true },
                { name: '📡 Ping', value: `${message.client.ws.ping}ms`, inline: true }
            )
            .setFooter({ text: 'CLOUD GAMING-223 | DIGITAL ENGINE' })
            .setTimestamp();

        message.reply({ embeds: [statusEmbed] });
    },
};
