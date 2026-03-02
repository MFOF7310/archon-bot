const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database.json');

module.exports = {
    name: 'profile',
    description: 'Check your Digital Engine status',
    async execute(message, args) {
        const target = message.mentions.users.first() || message.author;

        // Load database data
        let database = {};
        if (fs.existsSync(dbPath)) {
            database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        }

        // Get saved data or use defaults if they haven't set a game yet
        const userData = database[target.id] || {
            game: "NOT SET",
            rank: "Unranked",
            stats: "No data"
        };

        const embed = new EmbedBuilder()
            .setColor('#3498db') // Matching the blue in your screenshot
            .setTitle(`USER PROFILE | ${target.username.toUpperCase()}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🕹️ Main Game', value: `**${userData.game}**`, inline: true },
                { name: '🏆 Rank', value: `*${userData.rank}*`, inline: true },
                { name: '📊 Game Stats', value: `\`${userData.stats}\``, inline: false },
                { name: '✨ Level', value: '5', inline: true },
                { name: '🔥 XP', value: '1,250', inline: true }
            )
            .setFooter({ text: 'CLOUD GAMING-223 | DIGITAL ENGINE' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
