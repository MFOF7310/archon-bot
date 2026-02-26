const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'alive',
    description: 'Check if the Cloud Gaming-223 engine is online',
    async execute(message) {
        // Simple math for a fake "System Load" bar
        const load = Math.floor(Math.random() * 20) + 70; // Random 70-90%
        const progressBar = "█".repeat(Math.floor(load / 10)) + "░".repeat(10 - Math.floor(load / 10));

        const aliveEmbed = new EmbedBuilder()
            .setColor('#3498db') // Electric Blue
            .setTitle('🛰️ CLOUD GAMING-223 | SYSTEM STATUS')
            .addFields(
                { name: '🌐 Engine Status', value: '`RUNNING (STABLE)`', inline: true },
                { name: '🛰️ Connection', value: '`Starlink (Bamako)`', inline: true },
                { name: '⚡ System Load', value: `\`${progressBar} ${load}%\`` }
            )
            .setFooter({ text: 'Cloud Gaming-223 | AES Digital sovereignty' })
            .setTimestamp();

        message.reply({ embeds: [aliveEmbed] });
    }
};
