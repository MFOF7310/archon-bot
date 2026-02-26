const { EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'alive',
    description: 'Check if the Cloud Gaming-223 engine is online',
    async execute(message, args, client) {
        // 🕒 Calculate Uptime
        const totalSeconds = (client.uptime / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        // 📊 Create the Status Bar (10 Blocks)
        // We use memory usage to determine the 'load' for a realistic look
        const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        const totalMemory = os.totalmem() / 1024 / 1024 / 1024; // GB
        const loadPercent = Math.min(Math.floor((usedMemory / 500) * 100), 100); // Scaled to 500MB
        
        const filledBlocks = Math.floor(loadPercent / 10);
        const emptyBlocks = 10 - filledBlocks;
        const statusBar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);

        const aliveEmbed = new EmbedBuilder()
            .setColor('#3498db') // Electric Blue
            .setTitle('🛰️ CLOUD GAMING-223 | SYSTEM ONLINE')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '🌐 Engine Status', value: '`🟢 OPERATIONAL`', inline: true },
                { name: '🛰️ Network', value: '`Starlink (Bamako)`', inline: true },
                { name: '⏳ Uptime', value: `\`${hours}h ${minutes}m\``, inline: true },
                { name: '⚡ System Load', value: `\`[${statusBar}] ${loadPercent}%\`` },
                { name: '🧠 RAM Usage', value: `\`${usedMemory.toFixed(2)} MB / ${totalMemory.toFixed(1)} GB\``, inline: false }
            )
            .setFooter({ text: 'Cloud Gaming-223 | AES Digital sovereignty' })
            .setTimestamp();

        return message.reply({ embeds: [aliveEmbed] });
    }
};
