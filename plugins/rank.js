const { EmbedBuilder } = require('discord.js');
// Note: In a full build, we would connect this to a database like 'quick.db'
// For now, this displays the UI for your gamers.

module.exports = {
    name: 'rank',
    description: 'Check your gaming rank and set your main game.',
    category: 'Gaming',
    async execute(message, args) {
        const gameChoice = args[1] ? args.slice(1).join(' ').toUpperCase() : 'NOT SET';
        
        if (args[0] === 'set') {
            return message.reply(`🎮 **Profile Updated:** Your main game is now set to **${gameChoice}**!`);
        }

        const rankEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`🎮 GAMER PROFILE: ${message.author.username}`)
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { name: '🔥 Current Level', value: '`Level 5`', inline: true },
                { name: '✨ Experience', value: '`1,250 XP`', inline: true },
                { name: '🕹️ Main Game', value: `\`${gameChoice}\``, inline: false },
                { name: '🏆 Server Rank', value: '#4', inline: true }
            )
            .setFooter({ text: 'Cloud Gaming-223 | Gaming Registry' })
            .setTimestamp();

        message.reply({ embeds: [rankEmbed] });
    }
};
