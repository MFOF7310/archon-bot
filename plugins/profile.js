const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'profile',
    category: 'General',
    aliases: ['p', 'stats', 'rank'],
    description: 'Check your Digital Engine status, XP, and Game Stats',
    // ✨ Added 'client' and 'database' to the arguments
    async execute(message, args, client, model, lydiaChannels, database) {
        const target = message.mentions.users.first() || message.author;

        // 1. Get User Data from the live database passed from index.js
        const user = database[target.id] || {
            name: target.username,
            xp: 0,
            level: 1,
            gaming: { game: "NOT SET", rank: "Unranked", stats: "No data" }
        };

        const gaming = user.gaming || { game: "NOT SET", rank: "Unranked", stats: "No data" };

        // 2. Create the Dashboard Embed
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ 
                name: 'DIGITAL ENGINE PROFILE', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle(`${target.username.toUpperCase()}'S STATUS`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '✨ Engine Level', value: `\`Lvl ${user.level}\``, inline: true },
                { name: '🔥 Total XP', value: `\`${user.xp.toLocaleString()}\``, inline: true },
                { name: '📡 Version', value: `\`v${client.version}\``, inline: true }, // Dynamic version
                { name: '🕹️ Primary Game', value: `**${gaming.game}**`, inline: true },
                { name: '🏆 Current Rank', value: `*${gaming.rank}*`, inline: true },
                { name: '📊 Combat Stats', value: `\`${gaming.stats}\``, inline: false }
            )
            .setFooter({ text: 'CLOUD_GAMING-223 | Optimized for Mali 🇲🇱' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
