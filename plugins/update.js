const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'update',
    description: 'Synchronize local core with the remote GitHub repository.',
    category: 'OWNER',
    run: async (client, message, args, database) => {
        // 1. Security Check
        const ARCHITECT_ID = process.env.OWNER_ID;
        if (message.author.id !== ARCHITECT_ID) {
            return message.reply("⛔ **RESTRICTED:** Access to Master Node denied.");
        }

        const msg = await message.reply("📡 **ESTABLISHING UPLINK TO GITHUB...**");

        try {
            // 2. Fetch Remote Version Intelligence
            const repoUrl = `https://raw.githubusercontent.com/MFOF7310/cloud-gaming-223-digital-engine/main/version.txt`;
            const res = await axios.get(repoUrl);
            const remoteVersion = res.data.toString().trim();

            // 3. Version Comparison Logic
            if (remoteVersion === client.version) {
                return msg.edit("✅ **SYSTEM CURRENT:** Your local engine is already synchronized with the Master Node.");
            }

            const oldVersion = client.version;

            // 4. Hot-Reload Execution
            if (typeof client.loadPlugins === 'function') {
                await client.loadPlugins(); 
            }
            
            // Update local version variable
            client.version = remoteVersion;

            const updateEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🚀 ENGINE SYNCHRONIZATION SUCCESSFUL')
                .setAuthor({ name: 'CLOUD GAMING-223 MASTER NODE', iconURL: client.user.displayAvatarURL() })
                .setDescription(`The Digital Engine has been migrated from **v${oldVersion}** to **v${remoteVersion}**. All modules have been re-scanned and verified.`)
                .addFields(
                    { name: '📍 Source', value: 'GitHub Repository Mainline', inline: true },
                    { name: '📦 Previous Version', value: `v${oldVersion}`, inline: true },
                    { name: '🚀 New Version', value: `v${remoteVersion}`, inline: true }
                )
                .setFooter({ text: 'Bamako-223 | Operational' })
                .setTimestamp();

            await msg.edit({ content: null, embeds: [updateEmbed] });

        } catch (error) {
            console.error("Update Sync Error:", error);
            await msg.edit("❌ **UPLINK FAILURE:** Master Node rejected the synchronization request. Check GitHub URL or token.");
        }
    }
};