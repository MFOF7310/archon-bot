const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'kick',
    description: 'Kicks a member from the server.',
    category: 'Moderation',
    async execute(message, args, client) {
        // 1. Permission Check
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply("❌ **Access Denied:** You don't have the 'Kick Members' permission.");
        }

        // 2. Target Identification
        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const reason = args.slice(1).join(' ') || 'No reason provided.';

        if (!target) {
            return message.reply("⚠️ **System Error:** Mention a user or provide a valid ID.");
        }

        // 3. Security Checks
        if (target.id === message.author.id) return message.reply("❌ You cannot kick yourself.");
        if (!target.kickable) return message.reply("❌ **Error:** I cannot kick this user (Higher role/Permissions).");

        try {
            // 4. Execute the Kick
            await target.kick(reason);

            // 5. Send Success Embed
            const kickEmbed = new EmbedBuilder()
                .setColor('#ffa502') // Alert Orange
                .setTitle('👢 MEMBER REMOVED')
                .setThumbnail(target.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Kicked User', value: `${target.user.tag}`, inline: true },
                    { name: '🛡️ Moderator', value: `${message.author.tag}`, inline: true },
                    { name: '📝 Reason', value: `*${reason}*` }
                )
                .setFooter({ text: 'Cloud Gaming-223 | Security Module' })
                .setTimestamp();

            await message.channel.send({ embeds: [kickEmbed] });

        } catch (error) {
            console.error(error);
            message.reply("❌ **Failure:** Something went wrong while executing the kick.");
        }
    },
};
