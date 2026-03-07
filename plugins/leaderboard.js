const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    category: 'General',
    description: 'Displays the top 10 players in the Digital Engine.',
    async execute(message, args, client, model, lydiaChannels, database) {
        // 1. Convert Database Object to a Sorted Array
        const sorted = Object.entries(database)
            .map(([id, data]) => ({ id, ...data }))
            .filter(user => user.xp !== undefined) 
            .sort((a, b) => b.xp - a.xp)
            .slice(0, 10); 

        if (sorted.length === 0) {
            return message.reply("📊 **SYSTEM LOG:** Leaderboard is currently empty.");
        }

        // 2. Format the List
        const leaderboardList = sorted.map((user, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
            // Use the stored name but fallback to 'Unknown Agent'
            const displayName = user.name || "Unknown Agent";
            return `${medal} **${displayName}**\n╰ ⚡ Lvl: \`${user.level}\` | ✨ XP: \`${user.xp.toLocaleString()}\``;
        }).join('\n\n');

        // 3. Create the Embed
        const embed = new EmbedBuilder()
            .setColor('#f1c40f') 
            .setAuthor({ 
                name: 'CLOUD_GAMING-223 RANKINGS', 
                iconURL: message.guild.iconURL() || client.user.displayAvatarURL() 
            })
            .setTitle('🏆 DIGITAL ENGINE | TOP AGENTS')
            .setDescription(leaderboardList)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png')
            .setFooter({ text: 'Global Ranks | West Africa Node 🇲🇱' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
