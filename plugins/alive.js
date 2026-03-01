const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'alive',
    description: 'Check if the Cloud Gaming-223 engine is online',
    category: 'System',
    async execute(message, args, client) {
        const uptimeVal = process.uptime();
        const h = Math.floor(uptimeVal / 3600);
        const m = Math.floor((uptimeVal % 3600) / 60);

        // Accurate RAM Usage (RSS is the total memory allocated)
        const usedMemory = process.memoryUsage().rss / 1024 / 1024;
        const loadPercent = Math.min(Math.floor((usedMemory / 512) * 100), 100); 
        
        const filledBlocks = Math.floor(loadPercent / 10);
        const statusBar = "█".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);

        const aliveEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🛰️ CLOUD GAMING-223 | SYSTEM ONLINE')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '🌐 Engine Status', value: '`🟢 OPERATIONAL`', inline: true },
                { name: '🛰️ Network', value: '`AES Digital Node`', inline: true },
                { name: '⏳ Uptime', value: `\`${h}h ${m}m\``, inline: true },
                { name: '⚡ System Load', value: `\`[${statusBar}] ${loadPercent}%\`` },
                { name: '🧠 Total RAM', value: `\`${usedMemory.toFixed(2)} MB\``, inline: false }
            )
            .setFooter({ text: 'Cloud Gaming-223 | AES Sovereignty' })
            .setTimestamp();

        return message.reply({ embeds: [aliveEmbed] });
    }
};
