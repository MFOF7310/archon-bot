const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['profile', 'engine'],
    async execute(message, args, client, model, lydiaChannels, database) {
        const target = message.mentions.users.first() || message.author;
        const userData = database[target.id];

        if (!userData) {
            return message.reply("⚠️ Engine not initialized for this user.");
        }

        // Logic: Calculate progress based on your 1000 XP per level system
        const currentXP = userData.xp || 0;
        const level = userData.level || 1;
        const xpInCurrentLevel = currentXP % 1000;
        const progressPercent = Math.floor((xpInCurrentLevel / 1000) * 100);
        
        // Intelligent "Status" based on Level
        let systemStatus = "🟢 STABLE";
        if (level > 10) systemStatus = "🔥 OVERCLOCKED";
        if (level > 25) systemStatus = "💎 ELITE CORE";

        const progressBar = "🟦".repeat(Math.floor(progressPercent / 10)) + "⬛".repeat(10 - Math.floor(progressPercent / 10));

        const statsEmbed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setTitle(`🛰️ SYSTEM DIAGNOSTICS: ${userData.name}`) // Using the stored name
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: '👤 Identity', value: `\`${userData.name}\``, inline: true },
                { name: '📊 Level', value: `\`${level}\``, inline: true },
                { name: '🔌 System Status', value: `\`${systemStatus}\``, inline: true },
                { name: '🎮 Game Profile', value: `**${userData.gaming.game}** (${userData.gaming.rank})`, inline: false },
                { name: '⚡ Core Progress', value: `${progressBar} ${progressPercent}%\n*${1000 - xpInCurrentLevel} XP to next synchronization*` }
            )
            .setFooter({ text: `Digital Engine | Node: Bamako-223`, iconURL: client.user.displayAvatarURL() });

        message.reply({ embeds: [statsEmbed] });
    }
};
