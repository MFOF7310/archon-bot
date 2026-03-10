const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'ban',
    description: 'Permanently bans a member from the node.',
    run: async (client, message, args, database) => {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply("❌ **Access Denied.** Authority level insufficient.");
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const reason = args.slice(1).join(' ') || 'Breach of conduct.';

        if (!target) return message.reply("⚠️ **System Error:** Mention a user or provide an ID.");
        if (target.id === message.author.id) return message.reply("❌ Self-termination is not allowed.");
        if (!target.bannable) return message.reply("❌ **Error:** Target authority exceeds system permissions.");

        try {
            await target.ban({ reason });
            const banEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('⚖️ JUDGMENT RENDERED')
                .setThumbnail(target.user.displayAvatarURL())
                .addFields(
                    { name: '👤 ENTITY', value: `${target.user.tag}`, inline: true },
                    { name: '🛡️ AUTHORIZED BY', value: `${message.author.tag}`, inline: true },
                    { name: '📝 LOG', value: `*${reason}*` }
                )
                .setFooter({ text: 'Eagle Community Security | Protocol: Ban' })
                .setTimestamp();

            await message.channel.send({ embeds: [banEmbed] });
        } catch (error) {
            message.reply("❌ **Critical Failure.** Could not execute ban.");
        }
    },
};
