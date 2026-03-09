const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'ban',
    description: 'Permanently bans a member.',
    run: async (client, message, args, database) => {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply("❌ **Access Denied.**");
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const reason = args.slice(1).join(' ') || 'No reason provided.';

        if (!target) return message.reply("⚠️ **System Error:** Mention a user or provide an ID.");
        if (target.id === message.author.id) return message.reply("❌ You cannot ban yourself.");
        if (!target.bannable) return message.reply("❌ **Error:** Insufficient permissions to ban this user.");

        try {
            await target.ban({ reason });
            const banEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('⚖️ JUDGMENT RENDERED')
                .setThumbnail(target.user.displayAvatarURL())
                .addFields(
                    { name: '👤 User', value: `${target.user.tag}`, inline: true },
                    { name: '🛡️ Moderator', value: `${message.author.tag}`, inline: true },
                    { name: '📝 Reason', value: `*${reason}*` }
                )
                .setFooter({ text: 'Eagle Community Security' })
                .setTimestamp();

            await message.channel.send({ embeds: [banEmbed] });
        } catch (error) {
            message.reply("❌ **Critical Failure.**");
        }
    },
};
