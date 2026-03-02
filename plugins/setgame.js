const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setgame',
    description: 'Sets your game, rank, and stats on your profile',
    async execute(message, args) {
        // Check if they actually typed something
        if (!args.length) {
            return message.reply('❌ **Format:** `,setgame Game Name | Rank | Extra Stats`');
        }

        // Join args and split by the pipe symbol "|"
        const details = args.join(' ').split('|').map(item => item.trim());
        
        const gameName = details[0] || "Unknown Game";
        const rank = details[1] || "Unranked";
        const stats = details[2] || "No stats provided";

        const embed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setTitle('🛰️ DIGITAL ENGINE | DATA UPDATED')
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { name: '🎮 Main Game', value: `**${gameName}**`, inline: true },
                { name: '🏆 Current Rank', value: `*${rank}*`, inline: true },
                { name: '📊 Combat Stats', value: `\`${stats}\``, inline: false }
            )
            .setFooter({ text: `Updated by ${message.author.username}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
        
        // Console log for the Architect (You)
        console.log(`[LOG]: ${message.author.tag} updated profile to ${gameName}.`);
    },
};
