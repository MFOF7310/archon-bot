const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'servericon',
    aliases: ['icon', 'icone', 'serveuricon'],
    description: '🖼️ Display the server icon.',
    category: 'UTILITY',
    run: async (client, message) => {
        const icon = message.guild.iconURL({ dynamic: true, size: 1024 });
        if (!icon) return message.reply('❌ This server has no icon.');
        
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(`🖼️ ${message.guild.name}`)
            .setImage(icon)
            .setDescription(`[PNG](${message.guild.iconURL({ extension: 'png', size: 1024 })}) • [JPG](${message.guild.iconURL({ extension: 'jpg', size: 1024 })}) • [WEBP](${message.guild.iconURL({ extension: 'webp', size: 1024 })})`)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }
};