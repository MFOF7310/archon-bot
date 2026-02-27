const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'serverinfo',
    description: 'Displays a high-tech summary of the current node (server).',
    async execute(message, args, client) {
        const { guild } = message;
        const { members, channels, roles, emojis } = guild;

        const infoEmbed = new EmbedBuilder()
            .setColor('#3498db') // Tech Blue
            .setTitle(`🛰️ NODE SUMMARY: ${guild.name.toUpperCase()}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '🆔 Node ID', value: `\`${guild.id}\``, inline: true },
                { name: '👑 Administrator', value: `<@${guild.ownerId}>`, inline: true },
                { name: '📅 Initialized', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Connected Users', value: `**${guild.memberCount}** members`, inline: true },
                { name: '💬 Communication', value: `**${channels.cache.size}** channels`, inline: true },
                { name: '🛡️ Security Levels', value: `**${roles.cache.size}** roles`, inline: true },
                { name: '🎭 Assets', value: `**${emojis.cache.size}** emojis`, inline: true },
                { name: '🚀 Boost Tier', value: `Tier **${guild.premiumTier}**`, inline: true }
            )
            .setFooter({ text: 'Cloud Gaming-223 | Network Diagnostics' })
            .setTimestamp();

        message.channel.send({ embeds: [infoEmbed] });
    },
};
