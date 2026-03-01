const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'server',
    description: 'Display information about this server.',
    async execute(message, args, client) {
        const { guild } = message;
        
        // Fallback icon if server has none
        const icon = guild.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const serverEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setTitle(`🎮 ${guild.name} | NODE STATS`)
            .setThumbnail(icon)
            .addFields(
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Population', value: `\`${guild.memberCount}\` users`, inline: true },
                { name: '📅 Synchronized', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Cloud Gaming-223 | West African Edge' })
            .setTimestamp();

        message.reply({ embeds: [serverEmbed] });
    },
};
