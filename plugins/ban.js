const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'ban',
    description: 'Permanently bans a member from the server.',
    category: 'Moderation',
    async execute(message, args, client) {
        // 1. Check if the user has permission to ban
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply("❌ **Access Denied:** You don't have the 'Ban Members' permission.");
        }

        // 2. Identify the target
        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const reason = args.slice(1).join(' ') || 'No reason provided by the Digital Engine.';

        if (!target) {
            return message.reply("⚠️ **System Error:** Please mention a valid user or provide a User ID.");
        }

        // 3. Security Checks
        if (target.id === message.author.id) return message.reply("❌ You cannot ban yourself.");
        if (!target.bannable) return message.reply("❌ **Error:** I cannot ban this user. They might have a higher role than me.");

        try {
            // 4. Execute the Ban
            await target.ban({ reason });

            // 5. Send Success Embed
            const banEmbed = new EmbedBuilder()
                .setColor('#ff4757') // Alert Red
                .setTitle('⚖️ JUDGMENT RENDERED')
                .setThumbnail(target.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Banned User', value: `${target.user.tag}`, inline: true },
                    { name: '🆔 User ID', value: `\`${target.id}\``, inline: true },
                    { name: '🛡️ Responsible Mod', value: `${message.author.tag}`, inline: false },
                    { name: '📝 Reason', value: `*${reason}*` }
                )
                .setFooter({ text: 'Cloud Gaming-223 | Security Module' })
                .setTimestamp();

            await message.channel.send({ embeds: [banEmbed] });

        } catch (error) {
            console.error(error);
            message.reply("❌ **Critical Failure:** An error occurred while trying to execute the ban.");
        }
    },
};
