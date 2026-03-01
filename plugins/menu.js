const os = require('os');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'menu',
    description: 'Cloud Gaming-223 Main Dashboard',
    async execute(message, args, client, model) {
        try {
            // 1. Calculate Uptime
            const uptimeVal = process.uptime();
            const d = Math.floor(uptimeVal / 86400).toString().padStart(2, '0');
            const h = Math.floor((uptimeVal % 86400) / 3600).toString().padStart(2, '0');
            const m = Math.floor((uptimeVal % 3600) / 60).toString().padStart(2, '0');
            const s = Math.floor(uptimeVal % 60).toString().padStart(2, '0');

            // 2. System Stats
            const usedRAM = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const totalRAM = Math.round(os.totalmem() / 1024 / 1024);
            const uptimeStr = `${d}d ${h}h ${m}m ${s}s`;

            // 3. Dynamic Plugin List (Pulls all 19+ active plugins)
            const modulesList = client.commands.map(cmd => `\`${cmd.name.toUpperCase()}\``).join('  ');

            // 4. Create the Professional Embed
            const menuEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('🛰️ CLOUD GAMING-223 | DASHBOARD')
                .setThumbnail(client.user.displayAvatarURL())
                .addFields(
                    { name: '👤 ARCHITECT', value: `\`${message.author.username}\``, inline: true },
                    { name: '📟 PLATFORM', value: `\`${os.platform()}\``, inline: true },
                    { name: '🔋 UPTIME', value: `\`${uptimeStr}\``, inline: false },
                    { name: '💾 MEMORY', value: `\`${usedRAM}MB / ${totalRAM}MB\``, inline: true },
                    { name: '📡 LATENCY', value: `\`${client.ws.ping}ms\``, inline: true },
                    { name: '📂 ACTIVE PLUGINS', value: modulesList || 'No plugins loaded' }
                )
                .setFooter({ text: 'Cloud Gaming-223 Digital Engine | AES Sovereignty Edition' })
                .setTimestamp();

            await message.reply({ embeds: [menuEmbed] });

        } catch (error) {
            console.error("❌ Menu Error:", error);
            message.reply("⚠️ Dashboard failed to load. Check console for details.");
        }
    }
};
