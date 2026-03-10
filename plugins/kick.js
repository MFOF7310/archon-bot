const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'kick',
    description: 'Removes a member from the current node.',
    category: 'Moderation',
    run: async (client, message, args, database) => {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply("❌ **Access Denied.** Minimum clearance not met.");
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const reason = args.slice(1).join(' ') || 'Operational necessity.';

        if (!target) return message.reply("⚠️ **System Error:** Provide a valid target signature.");
        if (target.id === message.author.id) return message.reply("❌ Cannot disconnect own session.");
        if (!target.kickable) return message.reply("❌ **Error:** Target has administrative protection.");

        try {
            await target.kick(reason);
            const kickEmbed = new EmbedBuilder()
                .setColor('#ffa502')
                .setTitle('👢 MEMBER DISCONNECTED')
                .setThumbnail(target.user.displayAvatarURL())
                .addFields(
                    { name: '👤 ENTITY', value: `${target.user.tag}`, inline: true },
                    { name: '🛡️ MODERATOR', value: `${message.author.tag}`, inline: true },
                    { name: '📝 LOG', value: `*${reason}*` }
                )
                .setFooter({ text: 'Eagle Community | Security Module' })
                .setTimestamp();

            await message.channel.send({ embeds: [kickEmbed] });
        } catch (error) {
            message.reply("❌ **Failure:** Execution error during disconnect.");
        }
    },
};
