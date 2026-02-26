const { EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'alive',
    description: 'Ultra-advanced system diagnostics',
    async execute(message, args, client) {
        // Calculate Uptime
        const totalSeconds = (client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const uptimeString = `${days}d ${hours}h ${minutes}m`;

        // Regional Bamako Time
        const bamakoTime = new Date().toLocaleTimeString('en-GB', { 
            timeZone: 'Africa/Bamako', 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        // Memory Usage Calculation
        const usedMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

        const statusEmbed = new EmbedBuilder()
            .setColor('#e67e22') // AES Orange Theme
            .setTitle('📡 AES FRAMEWORK | SYSTEM STATUS')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`**Fof223** is currently monitoring the Sahel region with high-precision AI.`)
            .addFields(
                { name: '🟢 Status', value: '`OPERATIONAL`', inline: true },
                { name: '⏱️ Uptime', value: `\`${uptimeString}\``, inline: true },
                { name: '🛰️ Network', value: '`Starlink 4G/5G`', inline: true },
                { name: '🧠 Model', value: '`Gemini 2.0 Flash`', inline: true },
                { name: '💾 Memory', value: `\`${usedMem}MB / ${totalMem}GB\``, inline: true },
                { name: '⚡ Latency', value: `\`${client.ws.ping}ms\``, inline: true },
                { name: '🌍 Region', value: '`Bamako, Mali`', inline: true },
                { name: '📂 Modules', value: `\`${client.commands.size} Active\``, inline: true }
            )
            .setImage('https://i.imgur.com/your-aes-banner.png') // Optional: Add a cool banner URL here
            .setFooter({ text: `System Time: ${bamakoTime} GMT`, iconURL: 'https://i.imgur.com/mali-flag.png' })
            .setTimestamp();

        return message.reply({ embeds: [statusEmbed] });
    }
};
