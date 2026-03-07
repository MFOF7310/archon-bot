const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'update',
    aliases: ['up', 'sync'],
    description: 'Syncs the bot with the Master GitHub repo.',
    async execute(message, args, client) {
        const app = await client.application.fetch();
        if (message.author.id !== app.owner.id) return message.reply("⛔ Access Denied.");

        const user = "MFOF7310"; 
        const repo = "cloud-gaming-223-digital-engine";
        const url = `https://raw.githubusercontent.com/${user}/${repo}/main/version.txt`;

        const msg = await message.reply("📡 **Engine: Connecting to Master Node...**");

        try {
            const res = await axios.get(url);
            const remoteVersion = res.data.toString().trim();

            if (remoteVersion === client.version) {
                return msg.edit(`✅ **Up-to-Date.** Running \`v${client.version}\`.`);
            }

            await msg.edit(`📥 **Update Detected: v${remoteVersion}**\nHot-reloading...`);
            client.loadPlugins(); 
            client.version = remoteVersion;

            const upEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🚀 ENGINE SYNCED')
                .setDescription(`Successfully updated to Master Version: **v${remoteVersion}**`)
                .setFooter({ text: 'Cloud Gaming-223 | Global Sync' });

            await msg.edit({ content: '', embeds: [upEmbed] });
        } catch (error) { msg.edit("❌ **Sync Failed.** Node unreachable."); }
    }
};
