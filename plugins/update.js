const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Terminal colors (optional, for server logs)
const green = "\x1b[32m";
const reset = "\x1b[0m";

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

        const statusMsg = await message.reply("📡 **ESTABLISHING UPLINK TO GITHUB...**");

        try {
            // 2. Fetch remote version and metadata
            const versionUrl = `https://raw.githubusercontent.com/MFOF7310/cloud-gaming-223-digital-engine/main/version.txt`;
            const changelogUrl = `https://raw.githubusercontent.com/MFOF7310/cloud-gaming-223-digital-engine/main/changelog.txt`;
            const commitUrl = `https://api.github.com/repos/MFOF7310/cloud-gaming-223-digital-engine/commits/main`;

            const [versionRes, changelogRes, commitRes] = await Promise.allSettled([
                axios.get(versionUrl),
                axios.get(changelogUrl),
                axios.get(commitUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } })
            ]);

            if (versionRes.status !== 'fulfilled') {
                throw new Error('Could not fetch version.txt from repository.');
            }

            const remoteVersion = versionRes.value.data.toString().trim();
            const oldVersion = client.version;

            // 3. Compare versions
            if (remoteVersion === oldVersion) {
                const upToDateEmbed = new EmbedBuilder()
                    .setColor('#f1c40f')
                    .setTitle('✅ SYSTEM CURRENT')
                    .setDescription(`Your local engine is already synchronized with the Master Node (v${oldVersion}).`)
                    .addFields(
                        { name: '📦 Current Version', value: `v${oldVersion}`, inline: true },
                        { name: '🌐 Remote Version', value: `v${remoteVersion}`, inline: true }
                    )
                    .setFooter({ text: 'No update required' })
                    .setTimestamp();
                return statusMsg.edit({ content: null, embeds: [upToDateEmbed] });
            }

            // 4. Prepare dynamic data
            let changelogText = "No changelog available.";
            if (changelogRes.status === 'fulfilled' && changelogRes.value.data) {
                changelogText = changelogRes.value.data.slice(0, 1024);
            }

            let commitHash = "unknown";
            let commitDate = "unknown";
            if (commitRes.status === 'fulfilled' && commitRes.value.data) {
                commitHash = commitRes.value.data.sha.slice(0, 7);
                commitDate = new Date(commitRes.value.data.commit.author.date).toLocaleString();
            }

            const moduleCountBefore = client.commands.size;
            
            // 5. Perform hot-reload of plugins
            if (typeof client.loadPlugins === 'function') {
                await client.loadPlugins();
            } else {
                throw new Error('loadPlugins function not found on client.');
            }

            const moduleCountAfter = client.commands.size;
            client.version = remoteVersion; // Update in-memory version

            // 6. Save new version to local version.txt (robust try/catch)
            try {
                const versionFilePath = path.join(__dirname, '..', 'version.txt'); // Correctly moves from /plugins to /root
                fs.writeFileSync(versionFilePath, remoteVersion, 'utf8');
                console.log(`${green}[SYSTEM]${reset} version.txt synchronized to v${remoteVersion}`);
            } catch (fsErr) {
                console.error("Failed to write version.txt:", fsErr);
                // We don't throw here so the user still sees the success embed
            }

            // 7. Build intelligent embed
            const updateEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🚀 ENGINE SYNCHRONIZATION SUCCESSFUL')
                .setAuthor({ 
                    name: 'CLOUD GAMING-223 MASTER NODE', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setDescription(`The Digital Engine has been migrated from **v${oldVersion}** → **v${remoteVersion}**.`)
                .addFields(
                    { name: '📍 Source', value: '[GitHub Repository](https://github.com/MFOF7310/cloud-gaming-223-digital-engine)', inline: true },
                    { name: '🔖 Commit', value: `\`${commitHash}\``, inline: true },
                    { name: '📅 Released', value: commitDate, inline: true },
                    { name: '📦 Modules Before', value: `${moduleCountBefore} loaded`, inline: true },
                    { name: '🚀 Modules After', value: `${moduleCountAfter} loaded`, inline: true },
                    { name: '📊 Delta', value: `${moduleCountAfter - moduleCountBefore > 0 ? '+' : ''}${moduleCountAfter - moduleCountBefore}`, inline: true },
                    { name: '📋 Changelog', value: `\`\`\`diff\n${changelogText}\n\`\`\``, inline: false }
                )
                .addFields({
                    name: '🔄 Update Steps',
                    value: '✅ Version check\n✅ Fetch changelog\n✅ Plugin reload\n✅ Version saved',
                    inline: false
                })
                .setFooter({ text: 'Bamako-223 • Hot reload complete' })
                .setTimestamp();

            await statusMsg.edit({ content: null, embeds: [updateEmbed] });

            // 8. Log to database (optional)
            try {
                database.prepare(`
                    INSERT OR REPLACE INTO lydia_memory (user_id, memory_key, memory_value, updated_at)
                    VALUES (?, 'last_update', ?, strftime('%s', 'now'))
                `).run(message.author.id, `v${oldVersion} → v${remoteVersion}`);
            } catch (dbErr) {
                console.warn('Could not log update to database:', dbErr.message);
            }

        } catch (error) {
            console.error("Update Sync Error:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ UPLINK FAILURE')
                .setDescription('Master Node rejected the synchronization request.')
                .addFields(
                    { name: 'Error Details', value: `\`\`\`\n${error.message}\n\`\`\``, inline: false },
                    { name: 'Possible Causes', value: '• Invalid GitHub URL\n• Missing changelog.txt\n• Network issues\n• Rate limiting', inline: false }
                )
                .setFooter({ text: 'Check console for full stack trace' })
                .setTimestamp();
            await statusMsg.edit({ content: null, embeds: [errorEmbed] });
        }
    }
};