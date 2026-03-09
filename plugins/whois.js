const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'whois',
    aliases: ['scan'],
    run: async (client, message, args, database) => {
        let member = message.mentions.members.first() || (message.reference ? await message.guild.members.fetch((await message.channel.messages.fetch(message.reference.messageId)).author.id) : message.member);
        const userData = database[member.id] || { xp: 0, level: 1 };

        const embed = new EmbedBuilder()
            .setColor(member.displayHexColor)
            .setTitle(`🛰️ AGENT DOSSIER: ${member.user.username.toUpperCase()}`)
            .addFields(
                { name: '🆔 ID', value: `\`${member.id}\``, inline: true },
                { name: '📈 Level', value: `${userData.level}`, inline: true },
                { name: '📅 Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` }
            )
            .setFooter({ text: 'CLOUD GAMING-223 SCAN' });

        message.reply({ embeds: [embed] });
    }
};
