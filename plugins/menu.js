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

            // 2. Build modules list as ONE big string
            let modulesText = '';

            if (!client.commands || client.commands.size === 0) {
                modulesText = '> No commands are currently registered.';
            } else {
                modulesText = [...client.commands.values()]
                    .map(cmd => `🔹 ,${cmd.name} — ${cmd.description || 'No description provided.'}`)
                    .join('\n');
            }

            const menuEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('🛰️ CLOUD GAMING-223 | DYNAMIC DASHBOARD')
                .setThumbnail(client.user ? client.user.displayAvatarURL() : null)
                // System Info Row (4 fields)
                .addFields(
                    { name: '👤 ARCHITECT', value: `\`${message.author.username}\``, inline: true },
                    { name: '🔋 UPTIME', value: `\`${h}h ${m}m\``, inline: true },
                    { name: '📡 PING', value: `\`${client.ws.ping}ms\``, inline: true },
                    { name: '💾 RAM', value: `\`${usedRAM}MB\``, inline: true }
                )
                // Divider + ONE field that contains ALL modules
                .addFields(
                    { name: '\u200B', value: '📂 **ACTIVE MODULES**' },
                    { name: 'Modules', value: modulesText, inline: false }
                )
                .setFooter({ text: 'AES Digital Engine | Auto-Sync Active' })
                .setTimestamp();

            await message.reply({ embeds: [menuEmbed] });

        } catch (error) {
            console.error('Dashboard Error:', error);
            try {
                await message.reply('⚠️ An error occurred while building the dashboard.');
            } catch (_) {}
        }
    }
};
