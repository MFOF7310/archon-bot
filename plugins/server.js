const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'server',
    description: 'Display information about this server.',
    async execute(message, args, client) {
        const { guild } = message;
        const serverEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle(`🎮 ${guild.name} Stats`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Cloud Gaming-223 Engine' });

        message.reply({ embeds: [serverEmbed] });
    },
};
