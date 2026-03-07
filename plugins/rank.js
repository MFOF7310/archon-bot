const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    description: 'Check your current level and XP status.',
    category: 'Gaming',
    async execute(message, args, client, model, lydiaChannels, database) {
        const target = message.mentions.users.first() || message.author;
        const userData = database[target.id] || { xp: 0, level: 1 };
        
        // Calculate progress to next level (assuming 1000 XP per level)
        const nextLevelXP = userData.level * 1000;
        const progress = Math.floor((userData.xp % 1000) / 10); // Simple % bar

        const rankEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: `RANK: ${target.username}`, iconURL: target.displayAvatarURL() })
            .setDescription(`Current progress: **${progress}%** to Level ${userData.level + 1}`)
            .addFields(
                { name: '🔥 Level', value: `\`${userData.level}\``, inline: true },
                { name: '✨ Experience', value: `\`${userData.xp.toLocaleString()} XP\``, inline: true },
                { name: '🕹️ Main Game', value: `\`${userData.gaming?.game || 'Not Set'}\``, inline: false }
            )
            .setFooter({ text: 'Cloud Gaming-223 | Gaming Registry' });

        message.reply({ embeds: [rankEmbed] });
    }
};
