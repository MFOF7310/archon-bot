const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['level', 'rank', 'st'],
    description: 'Display detailed agent statistics and global rank.',
    category: 'PROFILE',
    run: async (client, message, args, database) => {
        let target = message.mentions.users.first();
        
        if (!target && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                target = repliedMsg.author;
            } catch {
                return message.reply("❌ Could not fetch replied message.");
            }
        }
        if (!target) target = message.author;

        const userData = database[target.id];
        if (!userData) {
            return message.reply(`⚠️ **ERROR:** No data found for ${target.username}. They need to chat first.`);
        }

        // Calculate global rank
        const sortedUsers = Object.entries(database).sort(([, a], [, b]) => b.xp - a.xp);
        const globalRank = sortedUsers.findIndex(([id]) => id === target.id) + 1;
        
        // Progress bar (1000 XP per level)
        const xpInLevel = userData.xp % 1000;
        const progressPercent = Math.floor((xpInLevel / 1000) * 100);
        const filledBlocks = Math.floor(progressPercent / 10);
        const progressBar = "🟦".repeat(filledBlocks) + "⬛".repeat(10 - filledBlocks);

        const statsEmbed = new EmbedBuilder()
            .setColor(userData.level > 10 ? '#ff9900' : '#00ffcc')
            .setAuthor({ name: `${target.username}`, iconURL: target.displayAvatarURL({ dynamic: true }) })
            .setTitle('🛰️ AGENT STATISTICS')
            .addFields(
                { name: '📊 Global Rank', value: `\`#${globalRank} / ${sortedUsers.length}\``, inline: true },
                { name: '⚡ Level', value: `\`${userData.level}\``, inline: true },
                { name: '🌀 Progress', value: `${progressBar} **${progressPercent}%**`, inline: false },
                { name: '🎮 Primary Game', value: `\`${userData.gaming?.game || 'NOT SET'}\``, inline: true },
                { name: '🏆 Skill Tier', value: `\`${userData.gaming?.rank || 'Unranked'}\``, inline: true }
            )
            .setFooter({ text: `Cloud Gaming-223 • Bamako Node 🇲🇱` })
            .setTimestamp();

        message.reply({ embeds: [statsEmbed] });
    }
};