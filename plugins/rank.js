const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp', 'dossier', 'profile'],
    description: 'Access an agent\'s neural synchronization level and XP telemetry.',
    category: 'PROFILE',
    run: async (client, message, args, database) => {
        const target = message.mentions.users.first() || message.author;
        
        // 1. DATA RETRIEVAL (Default fallback for new agents)
        const userData = database[target.id] || { xp: 0, level: 1, gaming: { game: 'NOT SET', rank: 'UNRANKED' } };
        const xp = userData.xp || 0;
        const level = userData.level || 1;

        // 2. GLOBAL RANK CALCULATION
        const sorted = Object.entries(database)
            .filter(([id]) => !isNaN(id)) 
            .sort(([, a], [, b]) => (b.xp || 0) - (a.xp || 0));
        
        const rankIndex = sorted.findIndex(([id]) => id === target.id);
        const rank = rankIndex === -1 ? 'PENDING' : `#${rankIndex + 1}`;
        const totalUsers = sorted.length;

        // 3. XP PROGRESS LOGIC (1000 XP per level)
        const xpForNextLevel = level * 1000;
        const progressXP = xp % 1000; 
        const percent = Math.floor((progressXP / 1000) * 100);

        // Architect Style Progress Bar (12 units)
        const createBar = (p) => {
            const size = 12;
            const filled = Math.round((size * p) / 100);
            return '▰'.repeat(filled) + '▱'.repeat(size - filled);
        };

        // 4. THE DOSSIER EMBED
        const dossierEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ 
                name: `AGENT DOSSIER: ${target.username.toUpperCase()}`, 
                iconURL: target.displayAvatarURL({ dynamic: true }) 
            })
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(`**Node:** \`Bamako-223\`\n**Status:** \`🟢 NEURAL_SYNC_STABLE\``)
            .addFields(
                { 
                    name: '📊 SYNC TELEMETRY', 
                    value: `\`\`\`ansi\n\u001b[1;36m▣\u001b[0m Level: ${level}\n\u001b[1;34m▣\u001b[0m Rank:  ${rank} / ${totalUsers}\n\u001b[1;32m▣\u001b[0m Total: ${xp.toLocaleString()} XP\`\`\``, 
                    inline: false 
                },
                { 
                    name: `🚀 PROGRESS TO LEVEL ${level + 1}`, 
                    value: `\`\`\`ansi\n\u001b[1;33m${createBar(percent)}\u001b[0m ${percent}%\`\`\`\n*Next update at ${1000 - progressXP} XP.*`, 
                    inline: false 
                }
            );

        // 5. GAMING INTEL (Only if set)
        if (userData.gaming && userData.gaming.game !== 'NOT SET') {
            dossierEmbed.addFields({ 
                name: '🎮 COMBAT SPECIALIZATION', 
                value: `\`\`\`prolog\nPrimary: ${userData.gaming.game}\nRank: ${userData.gaming.rank}\`\`\``, 
                inline: false 
            });
        }

        dossierEmbed.setFooter({ text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY' })
            .setTimestamp();

        message.reply({ 
            content: `> **Decrypting agent profile... synchronization complete.**`,
            embeds: [dossierEmbed] 
        });
    },
};
