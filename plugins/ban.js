const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ban',
    description: 'Permanently ban a member from the server',
    async execute(message, args) {
        // Check if the user has permission to ban
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply("❌ You don't have permission to use this command!");
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Please mention a user to ban.');
        
        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            await target.ban({ reason });
            const banEmbed = new EmbedBuilder()
                .setColor('#ff4757') // Danger Red
                .setTitle('⚖️ User Banned')
                .setDescription(`**${target.user.tag}** has been banned.`)
                .addFields({ name: 'Reason', value: `\`${reason}\`` })
                .setTimestamp();

            return message.reply({ embeds: [banEmbed] });
        } catch (error) {
            return message.reply('❌ I cannot ban this user. Check my permissions.');
        }
    }
};
