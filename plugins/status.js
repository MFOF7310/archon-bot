const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'status',
    description: 'Check the system health.',
    run: async (client, message, args, database) => {
        const uptimeVal = process.uptime();
        const h = Math.floor(uptimeVal / 3600);
        const m = Math.floor((uptimeVal % 3600) / 60);
        const usedMemory = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

        const statusEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle('🖥️ ENGINE OPERATIONAL STATUS')
            .addFields(
                { name: '📡 Ping', value: `\`${client.ws.ping}ms\``, inline: true },
                { name: '⏱️ Uptime', value: `\`${h}h ${m}m\``, inline: true },
                { name: '🧠 RAM', value: `\`${usedMemory} MB\``, inline: true },
                { name: '👥 Agents', value: `\`${Object.keys(database).length}\``, inline: true }
            )
            .setFooter({ text: 'Eagle Community • Digital Engine' });

        return message.reply({ embeds: [statusEmbed] });
    }
};
