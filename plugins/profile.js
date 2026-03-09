const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'profile',
    category: 'General',
    aliases: ['p', 'stats', 'rank'],
    description: 'Check your Digital Engine status, XP, and Game Stats',
    run: async (client, message, args, database) => {
        const target = message.mentions.users.first() || message.author;
        const user = database[target.id] || {
            name: target.username,
            xp: 0,
            level: 1,
            gaming: { game: "NOT SET", rank: "Unranked", stats: "No data" }
        };

        const gaming = user.gaming || { game: "NOT SET", rank: "Unranked", stats: "No data" };
        const sortedList = Object.entries(database).sort(([, a], [, b]) => b.xp - a.xp);
        const rank = sortedList.findIndex(([id]) => id === target.id) + 1;
        const totalUsers = Object.keys(database).length;

        const currentLevelXP = user.xp % 1000;
        const percent = Math.floor((currentLevelXP / 1000) * 100);
        const progress = '▰'.repeat(Math.floor(percent / 10)) + '▱'.repeat(10 - Math.floor(percent / 10));

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: 'DIGITAL ENGINE PROFILE', iconURL: client.user.displayAvatarURL() })
            .setTitle(`📡 AGENT: ${target.username.toUpperCase()}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🎖️ Global Rank', value: `\`#${rank || 'N/A'} / ${totalUsers}\``, inline: true },
                { name: '✨ Engine Level', value: `\`Lvl ${user.level}\``, inline: true },
                { name: '🔥 Total XP', value: `\`${user.xp.toLocaleString()}\``, inline: true },
                { name: '📈 Progress', value: `${progress} \`${percent}%\``, inline: false },
                { name: '🕹️ Primary Game', value: `**${gaming.game}**`, inline: true },
                { name: '🏆 Current Rank', value: `*${gaming.rank}*`, inline: true }
            )
            .setFooter({ text: `Node: Bamako-223 | Mali 🇲🇱` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
