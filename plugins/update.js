const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    name: 'update',
    description: 'Check for and apply Digital Engine updates.',
    async execute(message, args, client) {
        // Security check: Only Moussa (you) can run this
        if (message.author.id !== "YOUR_DISCORD_ID") return message.reply("⛔ Access Denied.");

        const msg = await message.reply("📡 **Checking Remote Update Node...**");

        try {
            // Replace with your RAW GitHub version.txt link
            const url = "https://raw.githubusercontent.com/YourUser/YourRepo/main/version.txt";
            const res = await axios.get(url);
            const remoteVersion = res.data.trim();

            if (remoteVersion === client.version) {
                // SURPRISE: No update found logic
                return msg.edit({ 
                    content: `✅ **No Update Required.**\nYour Engine is currently running the latest stable version (**v${client.version}**).` 
                });
            }

            // If versions are different
            await msg.edit(`📥 **New Update Found: v${remoteVersion}**\nApplying hot-reload...`);
            
            client.loadPlugins(); // Refresh the brain
            client.version = remoteVersion; // Update local tag

            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('⚙️ ENGINE SYNC COMPLETE')
                .setDescription(`Successfully migrated to **v${remoteVersion}**.\nAll systems are operational.`)
                .setTimestamp();

            await msg.edit({ content: '', embeds: [successEmbed] });

        } catch (err) {
            msg.edit("❌ **Update Node Offline:** Check your GitHub link or Pterodactyl internet connection.");
        }
    }
};
