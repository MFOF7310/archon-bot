const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'server',
    description: 'Displays detailed information about this community.',
    category: 'Information',
    run: async (client, message, args, database) => {
        const { guild } = message;
        const icon = guild.iconURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const infoEmbed = new EmbedBuilder()
            .setColor('#ffcc00')
            .setTitle(`🏛️ ${guild.name} | INTERNAL REGISTRY`)
            .setThumbnail(icon)
            .addFields(
                { name: '🆔 Node ID', value: `\`${guild.id}\``, inline: false },
                { name: '👑 Founder', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Population', value: `\`${guild.memberCount}\` Members`, inline: true },
                { name: '🛠️ Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🌟 Boost Level', value: `Level ${guild.premiumTier}`, inline: true }
            )
            .setFooter({ text: 'Eagle Community • Digital Engine' })
            .setTimestamp();

        message.reply({ embeds: [infoEmbed] });
    },
};
