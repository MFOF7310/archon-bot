const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp'],
    description: 'Check your or another member’s rank, level, and XP progress.',
    category: 'PROFILE',
    run: async (client, message, args, database) => {
        const target = message.mentions.users.first() || message.author;
        
        // Get user data (or create default if not exists)
        let userData = database[target.id];
        if (!userData) {
            // Create a temporary entry for display, but don't save
            userData = { xp: 0, level: 1, gaming: { game: 'NOT SET', rank: 'Unranked' } };
        }

        const xp = userData.xp || 0;
        const level = userData.level || 1;

        // Calculate rank among all users
        const sorted = Object.entries(database)
            .filter(([id]) => !isNaN(id)) // exclude non-user entries
            .sort(([, a], [, b]) => (b.xp || 0) - (a.xp || 0));
        const rank = sorted.findIndex(([id]) => id === target.id) + 1;
        const totalUsers = sorted.length;

        // Progress to next level (level = floor(xp/1000) + 1)
        const xpForCurrentLevel = (level - 1) * 1000;
        const xpForNextLevel = level * 1000;
        const progressXP = xp - xpForCurrentLevel;
        const neededXP = xpForNextLevel - xpForCurrentLevel;
        const percent = Math.min(100, Math.floor((progressXP / neededXP) * 100));

        // Progress bar (10 blocks)
        const barLength = 10;
        const filled = Math.floor((progressXP / neededXP) * barLength);
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

        const embed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
            .setTitle('📊 AGENT RANK')
            .addFields(
                { name: '⚡ Level', value: `\`${level}\``, inline: true },
                { name: '✨ Total XP', value: `\`${xp.toLocaleString()}\``, inline: true },
                { name: '🏆 Global Rank', value: rank ? `#${rank} / ${totalUsers}` : 'Unranked', inline: true },
                { name: '📈 Progress', value: `\`${bar}\` ${percent}% (${progressXP} / ${neededXP} XP)`, inline: false }
            )
            .setFooter({ text: 'Bamako Node • Eagle Community' })
            .setTimestamp();

        // Add gaming info if set
        if (userData.gaming && userData.gaming.game !== 'NOT SET') {
            embed.addFields({ name: '🎮 Primary Game', value: `${userData.gaming.game} – ${userData.gaming.rank}`, inline: false });
        }

        message.reply({ embeds: [embed] });
    },
};