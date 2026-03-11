const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp'],
    description: 'Check your or another member’s rank and XP progress.',
    category: 'PROFILE',
    run: async (client, message, args, database) => {
        const target = message.mentions.users.first() || message.author;
        const userData = database[target.id] || { xp: 0, level: 1, gaming: { game: 'NOT SET', rank: 'Unranked' } };

        const xp = userData.xp || 0;
        const level = userData.level || 1;
        const xpForNext = level * 1000;
        const xpInLevel = xp % 1000;
        const progress = Math.floor((xpInLevel / 1000) * 100);
        const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));

        const embed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
            .setTitle('📊 AGENT RANK')
            .addFields(
                { name: '⚡ Level', value: `\`${level}\``, inline: true },
                { name: '✨ Total XP', value: `\`${xp.toLocaleString()}\``, inline: true },
                { name: '📈 Progress', value: `\`${bar}\` ${progress}%`, inline: false }
            )
            .setFooter({ text: 'Bamako Node • Eagle Community' })
            .setTimestamp();

        if (userData.gaming && userData.gaming.game !== 'NOT SET') {
            embed.addFields({ name: '🎮 Primary Game', value: `${userData.gaming.game} – ${userData.gaming.rank}`, inline: false });
        }

        message.reply({ embeds: [embed] });
    },
};