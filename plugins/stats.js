const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['engine', 'level'],
    run: async (client, message, args, database) => {
        let target = message.mentions.users.first();
        if (!target && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            target = repliedMsg.author;
        }
        if (!target) target = message.author;

        const userData = database[target.id];
        if (!userData) return message.reply("⚠️ **ERROR:** Sujet non répertorié.");

        const sortedUsers = Object.entries(database).sort(([, a], [, b]) => b.xp - a.xp);
        const rank = sortedUsers.findIndex(([id]) => id === target.id) + 1;
        
        const xpInCurrentLevel = userData.xp % 1000;
        const progressPercent = Math.floor((xpInCurrentLevel / 1000) * 100);
        const filledBlocks = Math.floor(progressPercent / 10);
        const progressBar = "🟦".repeat(filledBlocks) + "⬛".repeat(10 - filledBlocks);

        const statsEmbed = new EmbedBuilder()
            .setColor(userData.level > 15 ? '#ff9900' : '#00ffcc')
            .setTitle(`🛰️ DIAGNOSTICS: ${target.username.toUpperCase()}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '📊 Rank', value: `\`#${rank} / ${sortedUsers.length}\``, inline: true },
                { name: '⚡ Sync', value: `${progressBar} **${progressPercent}%**` },
                { name: '🎮 Sector', value: `**${userData.gaming?.game || "Unknown"}** | \`${userData.gaming?.rank || "Unranked"}\`` }
            )
            .setFooter({ text: `Bamako Node 🇲🇱` })
            .setTimestamp();

        message.reply({ embeds: [statsEmbed] });
    }
};
