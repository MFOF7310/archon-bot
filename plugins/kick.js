const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'kick',
    description: 'Kick a member from the server',
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return message.reply("❌ You don't have permission to use this command!");
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Please mention a user to kick.');

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            await target.kick(reason);
            const kickEmbed = new EmbedBuilder()
                .setColor('#ffa502') // Warning Orange
                .setTitle('⚖️ User Kicked')
                .setDescription(`**${target.user.tag}** has been kicked.`)
                .addFields({ name: 'Reason', value: `\`${reason}\`` })
                .setTimestamp();

            return message.reply({ embeds: [kickEmbed] });
        } catch (error) {
            return message.reply('❌ I cannot kick this user. Check my permissions.');
        }
    }
};
