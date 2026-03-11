const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setgame',
    aliases: ['updategame', 'sg'],
    category: 'GAMING',
    description: 'Set your primary game and rank (e.g., .setgame CODM | Legendary).',
    run: async (client, message, args, database) => {
        const input = args.join(' ').split('|');
        const gameName = input[0]?.trim();
        const rankName = input[1]?.trim() || 'Pro';

        if (!gameName) {
            return message.reply(`❌ **Usage:** \`${process.env.PREFIX || '.'}setgame [Game] | [Rank]\`\n*Example: .setgame CODM | Legendary*`);
        }

        // Truncate to avoid abuse
        const safeGame = gameName.slice(0, 30);
        const safeRank = rankName.slice(0, 20);

        // Ensure user entry exists
        if (!database[message.author.id]) {
            database[message.author.id] = {
                name: message.author.username,
                xp: 0,
                level: 1,
                gaming: {}
            };
        }

        // Update gaming info
        database[message.author.id].gaming = {
            game: safeGame.toUpperCase(),
            rank: safeRank,
            lastUpdate: Date.now()
        };

        // Save to file
        client.saveDatabase();

        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
            .setTitle('🎮 GAME PROFILE UPDATED')
            .addFields(
                { name: 'Primary Game', value: safeGame.toUpperCase(), inline: true },
                { name: 'Rank', value: safeRank, inline: true },
                { name: 'Last Updated', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: false }
            )
            .setFooter({ text: 'Eagle Community | Database Synchronized' })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};