const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'server',
    description: 'Display information about the current server.',
    category: 'INFORMATION',
    run: async (client, message, args, database) => {
        const { guild } = message;
        const icon = guild.iconURL({ dynamic: true, size: 256 }) || client.user.displayAvatarURL();

        const infoEmbed = new EmbedBuilder()
            .setColor('#ffcc00')
            .setTitle(`🏛️ ${guild.name.toUpperCase()} | REGISTRY`)
            .setThumbnail(icon)
            .addFields(
                { name: '🆔 Node ID', value: `\`${guild.id}\``, inline: false },
                { name: '👑 Founder', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Population', value: `\`${guild.memberCount}\` Members`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '💬 Channels', value: `\`${guild.channels.cache.size}\` Total`, inline: true },
                { name: '😎 Emojis', value: `\`${guild.emojis.cache.size}\` Custom`, inline: true }
            )
            .setFooter({ text: 'Eagle Community • Digital Engine' })
            .setTimestamp();

        message.reply({ embeds: [infoEmbed] });
    }
};