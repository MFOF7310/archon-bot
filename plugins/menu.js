const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'menu',
    description: 'Cloud Gaming-223 Main Dashboard',
    async execute(message, args, client) {
        try {
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);

            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const uptimeStr = `${h}h ${m}m`;

            // Limit plugin display to prevent Embed crashes
            const modulesList = client.commands.map(cmd => `\`${cmd.name}\``).join(' ') || 'None';
            const displayList = modulesList.length > 500 ? modulesList.substring(0, 500) + "..." : modulesList;

            const menuEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('🛰️ CLOUD GAMING-223 | DASHBOARD')
                .setThumbnail(client.user.displayAvatarURL())
                .addFields(
                    { name: '👤 ARCHITECT', value: `\`${message.author.username}\``, inline: true },
                    { name: '🔋 UPTIME', value: `\`${uptimeStr}\``, inline: true },
                    { name: '📡 LATENCY', value: `\`${client.ws.ping}ms\``, inline: true },
                    { name: '💾 RAM USAGE', value: `\`${usedRAM}MB\``, inline: true },
                    { name: '📂 PLUGINS', value: displayList }
                )
                .setFooter({ text: 'AES Digital Engine | Sovereignty Edition' })
                .setTimestamp();

            await message.reply({ embeds: [menuEmbed] });
        } catch (error) {
            console.error("Dashboard Error:", error);
        }
    }
};
