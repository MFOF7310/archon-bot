const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'menu',
    description: 'Digital Engine System Dashboard & Plugin Directory',
    async execute(message, args, client) {
        try {
            // 1. Calculate System Stats
            const uptimeVal = process.uptime();
            const h = Math.floor(uptimeVal / 3600);
            const m = Math.floor((uptimeVal % 3600) / 60);
            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);

            const menuEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('🛰️ CLOUD GAMING-223 | DYNAMIC DASHBOARD')
                .setThumbnail(client.user.displayAvatarURL())
                // System Info Row
                .addFields(
                    { name: '👤 ARCHITECT', value: `\`${message.author.username}\``, inline: true },
                    { name: '🔋 UPTIME', value: `\`${h}h ${m}m\``, inline: true },
                    { name: '📡 PING', value: `\`${client.ws.ping}ms\``, inline: true },
                    { name: '💾 RAM', value: `\`${usedRAM}MB\``, inline: true }
                )
                .addFields({ name: '\u200B', value: '📂 **ACTIVE MODULES**' }); // Divider

            // 2. DYNAMICALLY Add every plugin
            // This loop replaces your old "modulesList" string
            client.commands.forEach((cmd) => {
                menuEmbed.addFields({
                    name: `🔹 ,${cmd.name}`,
                    value: `> ${cmd.description || 'No description provided.'}`,
                    inline: false
                });
            });

            menuEmbed.setFooter({ text: 'AES Digital Engine | Auto-Sync Active' })
                .setTimestamp();

            await message.reply({ embeds: [menuEmbed] });

        } catch (error) {
            console.error("Dashboard Error:", error);
        }
    }
};
