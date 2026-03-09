const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    description: 'Check your current level and XP status.',
    category: 'Gaming',
    run: async (client, message, args, database) => {
        const target = message.mentions.users.first() || message.author;
        const userData = database[target.id] || { xp: 0, level: 1, name: target.username };
        
        // Calculate progress to next level (1000 XP per level)
        const currentLevelXP = userData.xp % 1000;
        const progressPercent = Math.floor((currentLevelXP / 1000) * 100);

        const rankEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: `RANK: ${userData.name || target.username}`, iconURL: target.displayAvatarURL() })
            .setDescription(`Progress: **${progressPercent}%** to Level ${userData.level + 1}`)
            .addFields(
                { name: '🔥 Level', value: `\`${userData.level}\``, inline: true },
                { name: '✨ Total XP', value: `\`${userData.xp.toLocaleString()}\``, inline: true },
                { name: '🕹️ Main Game', value: `\`${userData.gaming?.game || 'Not Set'}\``, inline: false }
            )
            .setFooter({ text: 'Eagle Community | Gaming Registry' });

        message.reply({ embeds: [rankEmbed] });
    }
};
