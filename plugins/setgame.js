const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setgame',
    category: 'Gaming',
    description: 'Sync your gaming profile to the Digital Engine.',
    async execute(message, args, client, model, lydiaChannels, database) {
        // 1. Validation
        if (!args.length || !message.content.includes('|')) {
            const helpEmbed = new EmbedBuilder()
                .setColor('#ffcc00')
                .setTitle('⌨️ INPUT REQUIRED')
                .setDescription('Use the vertical bar `|` to separate your info.')
                .addFields(
                    { name: '📝 Format', value: '`,setgame Game | Rank | Stats`' },
                    { name: '💡 Example', value: '`,setgame CODM | Legendary | 2.5 KD`' }
                );
            return message.reply({ embeds: [helpEmbed] });
        }

        // 2. Parse Input
        const details = args.join(' ').split('|').map(item => item.trim());
        const gameData = {
            game: details[0] || "Unknown",
            rank: details[1] || "Unranked",
            stats: details[2] || "N/A"
        };

        // 3. Update the Live Database (Core handles saving)
        const uid = message.author.id;
        if (!database[uid]) {
            database[uid] = { xp: 0, level: 1, name: message.author.username };
        }
        
        database[uid].gaming = gameData;

        // 4. Success Embed
        const successEmbed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setTitle('🎮 PROFILE SYNCED')
            .addFields(
                { name: '🕹️ Game', value: `\`${gameData.game}\``, inline: true },
                { name: '🏅 Rank', value: `\`${gameData.rank}\``, inline: true },
                { name: '📈 Stats', value: `\`${gameData.stats}\``, inline: false }
            )
            .setFooter({ text: 'Data archived in Digital Engine Core' });

        await message.reply({ embeds: [successEmbed] });
    },
};
