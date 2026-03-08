const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    async execute(message, args, client, model, lydiaChannels, database) {
        // 1. Process Database into a sorted array
        const leaderboardArray = Object.entries(database)
            .map(([id, data]) => ({
                id,
                name: data.name || "Unknown Agent",
                xp: data.xp || 0,
                level: data.level || 1
            }))
            .sort((a, b) => b.xp - a.xp) // Sort by highest XP
            .slice(0, 10); // Top 10

        if (leaderboardArray.length === 0) {
            return message.reply("📊 **SYSTEM LOG:** No agent data found in database.");
        }

        // 2. Build the ranking list
        const list = leaderboardArray.map((user, index) => {
            let badge = `**#${index + 1}**`;
            if (index === 0) badge = '🥇';
            if (index === 1) badge = '🥈';
            if (index === 2) badge = '🥉';

            return `${badge} **${user.name}**\n╰ ⚡ Lvl: \`${user.level}\` | ✨ XP: \`${user.xp.toLocaleString()}\``;
        }).join('\n\n');

        // 3. Construct the "Digital Engine" Embed
        const lbEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ 
                name: 'CLOUD_GAMING-223 NETWORK', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle('🏆 TOP-TIER AGENTS | RANKINGS')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png')
            .setDescription(list)
            .setFooter({ 
                text: `Node: Bamako-223 | v${client.version}`, 
                iconURL: message.guild.iconURL() 
            })
            .setTimestamp();

        message.reply({ embeds: [lbEmbed] });
    }
};
