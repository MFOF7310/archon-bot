const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database.json');

module.exports = {
    name: 'setgame',
    description: 'Permanently sets your game and stats',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('❌ **Format:** `,setgame Game | Rank | Stats`');
        }

        // 1. Parse the input
        const details = args.join(' ').split('|').map(item => item.trim());
        const gameData = {
            game: details[0] || "Unknown",
            rank: details[1] || "Unranked",
            stats: details[2] || "N/A"
        };

        // 2. Read the current database
        let database = {};
        if (fs.existsSync(dbPath)) {
            database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        }

        // 3. Save user data using their Discord ID
        database[message.author.id] = gameData;
        fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));

        // 4. Send Success Embed
        const embed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setTitle('💾 DATA ARCHIVED')
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { name: '🎮 Game', value: gameData.game, inline: true },
                { name: '🏆 Rank', value: gameData.rank, inline: true },
                { name: '📊 Stats', value: `\`${gameData.stats}\``, inline: false }
            )
            .setFooter({ text: 'Data saved to Digital Engine Core' });

        await message.reply({ embeds: [embed] });
    },
};
