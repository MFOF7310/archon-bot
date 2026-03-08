const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['profile', 'level'],
    async execute(message, args, client, model, lydiaChannels, database) {
        const target = message.mentions.users.first() || message.author;
        const data = database[target.id];

        if (!data) {
            return message.reply("❌ This user hasn't initialized their engine yet.");
        }

        // --- Intelligent Logic ---
        const xpToNextLevel = 1000 - (data.xp % 1000);
        const progressPercent = Math.floor(((data.xp % 1000) / 1000) * 100);
        
        // Dynamic Rank Titles
        let rankTitle = "Civilian";
        if (data.level >= 5) rankTitle = "Specialist";
        if (data.level >= 10) rankTitle = "Elite Operative";
        if (data.level >= 20) rankTitle = "Legendary Commander";

        // Generate progress bar string
        const progressBar = "🟩".repeat(Math.floor(progressPercent / 10)) + "⬜".repeat(10 - Math.floor(progressPercent / 10));

        const statsEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle(`📊 SESSION DATA: ${target.username}`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: '🎖️ Current Rank', value: `**${rankTitle}** (Lvl ${data.level})`, inline: true },
                { name: '⚡ Total XP', value: `${data.xp.toLocaleString()}`, inline: true },
                { name: '🛰️ Node Location', value: 'Bamako-223', inline: true },
                { name: '📈 Level Progress', value: `${progressBar} ${progressPercent}%\n*${xpToNextLevel} XP until next level up*` }
            )
            .setFooter({ text: 'Digital Engine v' + client.version, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        message.reply({ embeds: [statsEmbed] });
    }
};
