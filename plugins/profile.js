const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database.json');

module.exports = {
    name: 'profile',
    category: 'General',
    description: 'Check your Digital Engine status, XP, and Game Stats',
    async execute(message, args) {
        const target = message.mentions.users.first() || message.author;

        // 1. Load database data
        let database = {};
        if (fs.existsSync(dbPath)) {
            try {
                database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            } catch (err) {
                console.error("Database Read Error:", err);
            }
        }

        // 2. Get User Data or Set Defaults
        const user = database[target.id] || {
            name: target.username,
            xp: 0,
            level: 1,
            gaming: { game: "NOT SET", rank: "Unranked", stats: "No data" }
        };

        // 3. Handle cases where user has XP but hasn't run ,setgame yet
        const gaming = user.gaming || { game: "NOT SET", rank: "Unranked", stats: "No data" };

        // 4. Create the Dashboard Embed
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: 'DIGITAL ENGINE PROFILE', iconURL: client.user.displayAvatarURL() })
            .setTitle(`${target.username.toUpperCase()}'S STATUS`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '✨ Engine Level', value: `\`Lvl ${user.level}\``, inline: true },
                { name: '🔥 Total XP', value: `\`${user.xp.toLocaleString()}\``, inline: true },
                { name: '\u200B', value: '\u200B', inline: true }, // Spacer
                { name: '🕹️ Primary Game', value: `**${gaming.game}**`, inline: true },
                { name: '🏆 Current Rank', value: `*${gaming.rank}*`, inline: true },
                { name: '📊 Combat Stats', value: `\`${gaming.stats}\``, inline: false }
            )
            .setFooter({ text: 'CLOUD_GAMING-223 | Optimized for Mali 🇲🇱' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
