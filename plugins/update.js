const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'update',
    aliases: ['up', 'sync'], // Quick shortcuts
    description: 'Syncs with the public GitHub repo and hot-reloads plugins.',
    async execute(message, args, client) {
        // 🔒 SECURITY: Replace with your actual Discord User ID
        if (message.author.id !== "YOUR_DISCORD_ID") return;

        // 🔗 CONFIGURATION (Change these to match your GitHub)
        const user = "YourGitHubUsername";
        const repo = "YourRepoName";
        const url = `https://raw.githubusercontent.com/${user}/${repo}/main/version.txt`;

        const msg = await message.reply("📡 **Engine: Connecting to Public GitHub Node...**");

        try {
            const res = await axios.get(url);
            const remoteVersion = res.data.toString().trim();

            // Check if already updated
            if (remoteVersion === client.version) {
                return msg.edit(`✅ **No Update Required.** Current: \`v${client.version}\` is optimal.`);
            }

            // If a new version exists
            await msg.edit(`📥 **New Patch Found: v${remoteVersion}**\nApplying hot-reload to all modules...`);

            // ⚡ This calls the GLOBAL function from your index.js
            client.loadPlugins(); 
            
            // Update the local version tag
            const oldVersion = client.version;
            client.version = remoteVersion;

            const upEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🚀 ENGINE UPGRADED')
                .addFields(
                    { name: 'Previous State', value: `\`v${oldVersion}\``, inline: true },
                    { name: 'Current State', value: `\`v${remoteVersion}\``, inline: true },
                    { name: 'Status', value: 'All plugins reloaded successfully.' }
                )
                .setFooter({ text: 'Cloud Gaming-223 | Zero-Downtime Update' })
                .setTimestamp();

            await msg.edit({ content: '', embeds: [upEmbed] });

        } catch (error) {
            console.error(error);
            msg.edit("❌ **Sync Failed:** Could not reach GitHub. Verify repo/file names.");
        }
    }
};
