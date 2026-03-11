const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'whois',
    aliases: ['scan'],
    description: 'Display detailed information about a user.',
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        let member = message.mentions.members.first() || message.member;
        const userData = database[member.id] || { xp: 0, level: 1 };

        const embed = new EmbedBuilder()
            .setColor(member.displayHexColor)
            .setTitle(`🛰️ AGENT DOSSIER: ${member.user.username.toUpperCase()}`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '🆔 ID', value: `\`${member.id}\``, inline: true },
                { name: '📈 Level', value: `Lvl ${userData.level}`, inline: true },
                { name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: false },
                { name: '📆 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: false }
            )
            .setFooter({ text: 'CLOUD GAMING-223 INTERNAL SCAN' })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};