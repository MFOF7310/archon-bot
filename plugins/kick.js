const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'kick',
    description: 'Kicks a member from the server.',
    category: 'Moderation',
    run: async (client, message, args, database) => {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply("❌ **Access Denied.**");
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const reason = args.slice(1).join(' ') || 'No reason provided.';

        if (!target) return message.reply("⚠️ **System Error:** Mention a user or provide a valid ID.");
        if (target.id === message.author.id) return message.reply("❌ You cannot kick yourself.");
        if (!target.kickable) return message.reply("❌ **Error:** Insufficient permissions to kick this user.");

        try {
            await target.kick(reason);
            const kickEmbed = new EmbedBuilder()
                .setColor('#ffa502')
                .setTitle('👢 MEMBER REMOVED')
                .setThumbnail(target.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Kicked User', value: `${target.user.tag}`, inline: true },
                    { name: '🛡️ Moderator', value: `${message.author.tag}`, inline: true },
                    { name: '📝 Reason', value: `*${reason}*` }
                )
                .setFooter({ text: 'Eagle Community | Security Module' })
                .setTimestamp();

            await message.channel.send({ embeds: [kickEmbed] });
        } catch (error) {
            message.reply("❌ **Failure:** Execution error.");
        }
    },
};
