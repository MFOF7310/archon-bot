const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'server',
    description: 'Display information about the current server.',
    category: 'INFORMATION',
    run: async (client, message, args, database) => {
        const { guild } = message;
        const icon = guild.iconURL({ dynamic: true, size: 256 }) || client.user.displayAvatarURL();

        // Helper to get verification level as readable string
        const verificationLevels = {
            0: 'None',
            1: 'Low',
            2: 'Medium',
            3: 'High',
            4: 'Very High'
        };

        // Helper to get boost tier as readable string
        const boostTiers = {
            0: 'No Level',
            1: 'Tier 1',
            2: 'Tier 2',
            3: 'Tier 3'
        };

        // Build fields array dynamically
        const fields = [
            { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: false },
            { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
            { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '👥 Members', value: `\`${guild.memberCount}\` total`, inline: true },
            { name: '💬 Channels', value: `\`${guild.channels.cache.size}\` total`, inline: true },
            { name: '📜 Roles', value: `\`${guild.roles.cache.size}\` total`, inline: true },
            { name: '😎 Emojis', value: `\`${guild.emojis.cache.size}\` custom`, inline: true },
            { name: '🚀 Boosts', value: `\`${guild.premiumSubscriptionCount || 0}\` (${boostTiers[guild.premiumTier]})`, inline: true },
            { name: '🛡️ Verification', value: `\`${verificationLevels[guild.verificationLevel]}\``, inline: true }
        ];

        // Add server description if available
        if (guild.description) {
            fields.push({ name: '📝 Description', value: `"${guild.description}"`, inline: false });
        }

        // Create the embed with a welcoming description
        const infoEmbed = new EmbedBuilder()
            .setColor('#ffcc00')
            .setTitle(`🏛️ ${guild.name} — Server Registry`)
            .setDescription(`👋 Welcome to the **${guild.name}** information panel! Here's everything you need to know about our community.`)
            .setThumbnail(icon)
            .addFields(fields)
            .setFooter({ text: 'Eagle Community • Digital Engine' })
            .setTimestamp();

        message.reply({ embeds: [infoEmbed] });
    }
};