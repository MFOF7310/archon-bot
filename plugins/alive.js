const { EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'alive',
    description: 'Check if the Cloud Gaming-223 engine is online',
    category: 'System',
    async execute(message, args, client) {
        // 🕒 Calculate Uptime
        const totalSeconds = (client.uptime / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        // 📊 Create the Status Bar
        const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        const loadPercent = Math.min(Math.floor((usedMemory / 500) * 100), 100); 
        
        const filledBlocks = Math.floor(loadPercent / 10);
        const emptyBlocks = 10 - filledBlocks;
        const statusBar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);

        const aliveEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🛰️ CLOUD GAMING-223 | SYSTEM ONLINE')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '🌐 Engine Status', value: '`🟢 OPERATIONAL`', inline: true },
                { name: '🛰️ Network', value: '`Starlink (Bamako)`', inline: true },
                { name: '⏳ Uptime', value: `\`${hours}h ${minutes}m\``, inline: true },
                { name: '⚡ System Load', value: `\`[${statusBar}] ${loadPercent}%\`` },
                { name: '🧠 RAM Usage', value: `\`${usedMemory.toFixed(2)} MB\``, inline: false }
            )
            .setFooter({ text: 'Cloud Gaming-223 | AES Digital sovereignty' })
            .setTimestamp();

        return message.reply({ embeds: [aliveEmbed] });
    }
};
