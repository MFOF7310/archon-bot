const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['level', 'rank', 'st'],
    category: 'GAMING',
    description: 'Check your Digital Engine status and Game Stats.',
    run: async (client, message, args, database) => {
        let target = message.mentions.users.first();
        
        // If no mention, check if replying to someone, otherwise target author
        if (!target && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            target = repliedMsg.author;
        }
        if (!target) target = message.author;

        const userData = database[target.id];
        if (!userData) return message.reply("⚠️ **ERROR:** Subject not listed in active database.");

        // Calculate Global Rank
        const sortedUsers = Object.entries(database).sort(([, a], [, b]) => b.xp - a.xp);
        const globalRank = sortedUsers.findIndex(([id]) => id === target.id) + 1;
        
        // Progress Bar Logic (Based on 1000 XP per level)
        const xpInCurrentLevel = userData.xp % 1000;
        const progressPercent = Math.floor((xpInCurrentLevel / 1000) * 100);
        const filledBlocks = Math.floor(progressPercent / 10);
        const progressBar = "🟦".repeat(filledBlocks) + "⬛".repeat(10 - filledBlocks);

        const statsEmbed = new EmbedBuilder()
            .setColor(userData.level > 10 ? '#ff9900' : '#00ffcc') // Color changes as they level up
            .setTitle(`🛰️ DIAGNOSTICS: ${userData.name?.toUpperCase() || target.username.toUpperCase()}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '📊 GLOBAL RANK', value: `\`#${globalRank} / ${sortedUsers.length}\``, inline: true },
                { name: '⚡ ENGINE LEVEL', value: `\`Lv. ${userData.level}\``, inline: true },
                { name: '🌀 SYNC PROGRESS', value: `${progressBar} **${progressPercent}%**`, inline: false },
                { name: '🕹️ SECTOR', value: `**${userData.gaming?.game || "NOT SET"}**`, inline: true },
                { name: '🏆 RANK', value: `\`${userData.gaming?.rank || "Unranked"}\``, inline: true }
            )
            .setFooter({ text: `Cloud Gaming-223 | Bamako Node 🇲🇱` })
            .setTimestamp();

        message.reply({ embeds: [statsEmbed] });
    }
};
