const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database.json');

module.exports = {
    name: 'leaderboard',
    description: 'Displays the top 10 players by XP',
    async execute(message, args) {
        // 1. Check if database exists
        if (!fs.existsSync(dbPath)) {
            return message.reply("❌ No player data found yet. Start chatting!");
        }

        const database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        // 2. Convert database object to an array and sort by XP (Highest first)
        const sorted = Object.entries(database)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.xp - a.xp)
            .slice(0, 10); // Take top 10

        if (sorted.length === 0) {
            return message.reply("📊 The leaderboard is currently empty.");
        }

        // 3. Format the list
        const leaderboardList = sorted.map((user, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
            return `${medal} **${user.name || 'Unknown User'}**\n╰ Level: \`${user.level}\` | XP: \`${user.xp}\``;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor('#f1c40f') // Gold Color
            .setTitle('🏆 DIGITAL ENGINE | GLOBAL RANKINGS')
            .setThumbnail('https://i.imgur.com/v8S7z87.png') // Optional trophy icon
            .setDescription(leaderboardList)
            .setFooter({ text: 'Keep chatting to climb the ranks!' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
