const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'server',
    aliases: ['si', 'sector', 'guild'],
    description: 'Execute a deep-scan of the current Sector (Server) intelligence.',
    category: 'SYSTEM', // Changed to SYSTEM to align with your Help Menu
    run: async (client, message, args, database) => {
        const { guild } = message;
        const icon = guild.iconURL({ dynamic: true, size: 512 }) || client.user.displayAvatarURL();

        // Verification & Boost Tier Data
        const vLevels = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
        const bTiers = ['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'];

        // ARCHITECT Style Embed
        const infoEmbed = new EmbedBuilder()
            .setColor('#00fbff') // Signature Architect Cyan
            .setAuthor({ 
                name: `SECTOR DATA_SCAN: ${guild.name.toUpperCase()}`, 
                iconURL: icon 
            })
            .setTitle('─ ARCHITECT GUILD TELEMETRY ─')
            .setThumbnail(icon)
            .setDescription(
                `**Commander:** <@${guild.ownerId}>\n` +
                `**Established:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)\n` +
                `**Sector ID:** \`${guild.id}\``
            )
            .addFields(
                { 
                    name: '📊 POPULATION METRICS', 
                    value: `\`\`\`ansi\n\u001b[1;32m▣\u001b[0m Total: ${guild.memberCount}\n\u001b[1;34m▣\u001b[0m Roles: ${guild.roles.cache.size}\n\u001b[1;36m▣\u001b[0m Emojis: ${guild.emojis.cache.size}\`\`\``, 
                    inline: true 
                },
                { 
                    name: '🛰️ NETWORK GRID', 
                    value: `\`\`\`ansi\n\u001b[1;35m▣\u001b[0m Channels: ${guild.channels.cache.size}\n\u001b[1;35m▣\u001b[0m Boosts: ${guild.premiumSubscriptionCount || 0}\n\u001b[1;35m▣\u001b[0m Tier: ${bTiers[guild.premiumTier]}\`\`\``, 
                    inline: true 
                },
                { 
                    name: '🛡️ SECURITY PROTOCOLS', 
                    value: `\`\`\`prolog\nVerification: ${vLevels[guild.verificationLevel]}\nIntegrity: SYNCHRONIZED\nNode: Bamako-223\`\`\``, 
                    inline: false 
                }
            )
            .setFooter({ text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • v2.1.0' })
            .setTimestamp();

        // Add description if the server has one
        if (guild.description) {
            infoEmbed.addFields({ name: '📝 SECTOR INTEL', value: `*"${guild.description}"*` });
        }

        message.reply({ 
            content: `> **Accessing sector registry... signal locked.**`,
            embeds: [infoEmbed] 
        });
    }
};
