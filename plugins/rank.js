const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp', 'dossier', 'profile'],
    description: 'Access an agent\'s neural synchronization level and combat matrix.',
    category: 'PROFILE',
    run: async (client, message, args, database) => {
        const target = message.mentions.users.first() || message.author;
        
        const userData = database[target.id] || { xp: 0, level: 1, gaming: null };
        const xp = userData.xp || 0;
        const level = userData.level || 1;
        const gameData = userData.gaming;

        const sorted = Object.entries(database)
            .filter(([id]) => !isNaN(id)) 
            .sort(([, a], [, b]) => (b.xp || 0) - (a.xp || 0));
        
        const rankIndex = sorted.findIndex(([id]) => id === target.id);
        const rank = rankIndex === -1 ? 'PENDING' : `#${rankIndex + 1}`;
        const totalUsers = sorted.length;

        const progressXP = xp % 1000; 
        const percent = Math.floor((progressXP / 1000) * 100);

        const createBar = (p) => {
            const size = 12;
            const filled = Math.round((size * p) / 100);
            return '▰'.repeat(filled) + '▱'.repeat(size - filled);
        };

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
                    value: `\`\`\`ansi\n\u001b[1;33m${createBar(percent)}\u001b[0m ${percent}%\`\`\`\n*Sync gap: ${1000 - progressXP} XP.*`, 
                    inline: false 
                }
            );

        // --- ENHANCED COMBAT MATRIX WITH LAST SYNC ---
        if (gameData && gameData.game) {
            const lastSync = gameData.timestamp ? `<t:${Math.floor(gameData.timestamp / 1000)}:R>` : '`UNKNOWN`';
            
            dossierEmbed.addFields({ 
                name: '🎮 COMBAT MATRIX', 
                value: `**Sector:** \`${gameData.game}\`\n**Theater:** \`${gameData.mode || 'N/A'}\`\n**Rank:** \`${gameData.rank || 'UNRANKED'}\`\n**Last Sync:** ${lastSync}`, 
                inline: false 
            });
        } else {
            dossierEmbed.addFields({ 
                name: '🎮 COMBAT MATRIX', 
                value: `\`\`\`fix\nSTATUS: NO_COMBAT_DATA\nRegister with .setgame [Game] | [Mode] | [Rank]\`\`\``, 
                inline: false 
            });
        }

        dossierEmbed.setFooter({ text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223' })
            .setTimestamp();

        message.reply({ 
            content: `> **Decrypting agent profile... synchronization complete.**`,
            embeds: [dossierEmbed] 
        });
    },
};
