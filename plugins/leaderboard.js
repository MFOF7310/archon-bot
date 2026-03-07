const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database.json');

module.exports = {
    name: 'leaderboard',
    category: 'General',
    description: 'Displays the top 10 players in the Digital Engine.',
    async execute(message, args) {
        // 1. Check if database exists
        if (!fs.existsSync(dbPath)) {
            return message.reply("❌ **Database Offline:** No player data recorded yet.");
        }

        let database = {};
        try {
            database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        } catch (err) {
            return message.reply("⚠️ **Error:** Could not access the database.");
        }

        // 2. Sort Players (Highest XP first)
        const sorted = Object.entries(database)
            .filter(([id, data]) => data.xp !== undefined) // Skip any corrupted entries
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.xp - a.xp)
            .slice(0, 10); 

        if (sorted.length === 0) {
            return message.reply("📊 **SYSTEM LOG:** Leaderboard is currently empty.");
        }

        // 3. Format with Medals & Visual Hierarchy
        const leaderboardList = sorted.map((user, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
            return `${medal} **${user.name || 'Unknown Agent'}**\n╰ ⚡ Level: \`${user.level}\` | ✨ XP: \`${user.xp.toLocaleString()}\``;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor('#f1c40f') 
            .setAuthor({ name: 'CLOUD_GAMING-223 RANKINGS', iconURL: message.guild.iconURL() })
            .setTitle('🏆 DIGITAL ENGINE | TOP AGENTS')
            .setDescription(leaderboardList)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png') // Trophy icon
            .setFooter({ text: 'Daily active users climb faster | Bamako 🇲🇱' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
