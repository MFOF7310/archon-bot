const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'profile',
    aliases: ['p'],
    category: 'GENERAL',
    run: async (client, message, args, database) => {
        const target = message.mentions.users.first() || message.author;
        const user = database[target.id] || { name: target.username, xp: 0, level: 1, gaming: { game: "NOT SET", rank: "Unranked" }};

        // Progress Bar calculation
        const percent = Math.floor(((user.xp % 1000) / 1000) * 100);
        const bar = '▰'.repeat(Math.floor(percent / 10)) + '▱'.repeat(10 - Math.floor(percent / 10));

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle(`🪪 AGENT PROFILE: ${user.name.toUpperCase()}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '⚡ Level', value: `\`${user.level}\``, inline: true },
                { name: '✨ Total XP', value: `\`${user.xp.toLocaleString()}\``, inline: true },
                { name: '📈 Evolution', value: `${bar} \`${percent}%\`` },
                { name: '🎮 Primary Game', value: `\`${user.gaming?.game || 'N/A'}\``, inline: true },
                { name: '🏆 Skill Tier', value: `\`${user.gaming?.rank || 'Unranked'}\``, inline: true }
            )
            .setFooter({ text: `Node: Bamako-223 | Secure ID: ${target.id.slice(0,8)}...` });

        await message.reply({ embeds: [embed] });
    },
};
