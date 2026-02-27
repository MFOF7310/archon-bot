const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'server',
    description: 'Displays detailed information about this gaming community.',
    async execute(message, args, client) {
        const { guild } = message;

        const infoEmbed = new EmbedBuilder()
            .setColor('#ffcc00')
            .setTitle(`🏛️ ${guild.name} | Internal Registry`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: false },
                { name: '👑 Founder', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Population', value: `${guild.memberCount} Members`, inline: true },
                { name: '🛠️ Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🌟 Boost Level', value: `Level ${guild.premiumTier}`, inline: true }
            )
            .setFooter({ text: 'Cloud Gaming-223 Digital Engine' })
            .setTimestamp();

        message.reply({ embeds: [infoEmbed] });
    },
};
