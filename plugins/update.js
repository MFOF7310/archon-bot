const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'update',
    aliases: ['up', 'sync'],
    description: 'Syncs the bot with the Master GitHub repo.',
    async execute(message, args, client) {
        // 🛡️ SMART SECURITY: Only the person who owns the Bot Token can run this
        const app = await client.application.fetch();
        if (message.author.id !== app.owner.id) {
            return message.reply("⛔ **Access Denied:** Only the Bot Owner can trigger a system sync.");
        }

        const user = "MFOF7310"; // Your Master GitHub
        const repo = "cloud-gaming-223-digital-engine";
        const url = `https://raw.githubusercontent.com/${user}/${repo}/main/version.txt`;

        const msg = await message.reply("📡 **Engine: Connecting to Master Repository...**");

        try {
            const res = await axios.get(url);
            const remoteVersion = res.data.toString().trim();

            if (remoteVersion === client.version) {
                return msg.edit(`✅ **Up-to-Date.** Current: \`v${client.version}\`.`);
            }

            await msg.edit(`📥 **Update Detected: v${remoteVersion}**\nHot-reloading modules...`);

            client.loadPlugins(); 
            client.version = remoteVersion;

            const upEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🚀 ENGINE SYNCED')
                .setDescription(`Successfully updated to the latest Master Version: **v${remoteVersion}**`)
                .setFooter({ text: 'Digital Engine | Global Update System' });

            await msg.edit({ content: '', embeds: [upEmbed] });

        } catch (error) {
            msg.edit("❌ **Sync Failed:** Could not reach the Master Node.");
        }
    }
};
