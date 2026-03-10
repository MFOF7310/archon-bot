const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'profile',
    aliases: ['p', 'stats'],
    category: 'GENERAL',
    run: async (client, message, args, database) => {
        const target = message.mentions.users.first() || message.author;
        // Check database or provide default
        const user = database[target.id] || { name: target.username, xp: 0, level: 1, gaming: { game: "NOT SET", rank: "Unranked" }};

        const sortedList = Object.entries(database).sort(([, a], [, b]) => b.xp - a.xp);
        const rank = sortedList.findIndex(([id]) => id === target.id) + 1;

        const currentLevelXP = user.xp % 1000;
        const percent = Math.floor((currentLevelXP / 1000) * 100);
        const progress = '▰'.repeat(Math.floor(percent / 10)) + '▱'.repeat(10 - Math.floor(percent / 10));

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: 'DIGITAL ENGINE PROFILE', iconURL: client.user.displayAvatarURL() })
            .setTitle(`📡 AGENT: ${user.name.toUpperCase()}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🎖️ Rank', value: `\`#${rank || '?'}\``, inline: true },
                { name: '✨ Level', value: `\`Lvl ${user.level}\``, inline: true },
                { name: '🔥 XP', value: `\`${user.xp.toLocaleString()}\``, inline: true },
                { name: '📈 Progress', value: `${progress} \`${percent}%\``, inline: false },
                { name: '🕹️ Game', value: `**${user.gaming?.game || 'N/A'}**`, inline: true },
                { name: '🏆 Skill', value: `*${user.gaming?.rank || 'Unranked'}*`, inline: true }
            )
            .setFooter({ text: `Bamako Node | ID: ${target.id}` });

        await message.reply({ embeds: [embed] });
    },
};
