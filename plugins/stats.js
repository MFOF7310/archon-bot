const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['st', 'stat'], // Removed 'level'/'rank' to avoid conflict with your other command files
    description: 'Display detailed agent statistics and global rank.',
    category: 'PROFILE',
    run: async (client, message, args, database) => {
        let target = message.mentions.users.first();
        
        // 1. INTELLIGENT SIGNAL INTERCEPTION (Reply detection)
        if (!target && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                target = repliedMsg.author;
            } catch {
                // Silent fallback if fetch fails
            }
        }
        if (!target) target = message.author;

        // 2. DATA SYNCHRONIZATION
        const userData = database[target.id] || { xp: 0, level: 1, gaming: null };
        const gameData = userData.gaming;

        // 3. CALCULATION HIERARCHY
        const sortedUsers = Object.entries(database)
            .filter(([id]) => !isNaN(id))
            .sort(([, a], [, b]) => (b.xp || 0) - (a.xp || 0));
        
        const globalRank = sortedUsers.findIndex(([id]) => id === target.id) + 1 || 'PENDING';
        
        const xpInLevel = userData.xp % 1000;
        const progressPercent = Math.floor((xpInLevel / 1000) * 100);
        
        const createBar = (percent) => {
            const size = 12;
            const progress = Math.round((size * percent) / 100);
            return '▰'.repeat(progress) + '▱'.repeat(size - progress);
        };

        // 4. DYNAMIC TIER LOGIC
        let tierColor = '#00fbff';
        let tierLabel = 'RECRUIT';
        let accessLevel = 'BETA';

        if (userData.level >= 10) { 
            tierColor = '#f1c40f'; 
            tierLabel = 'ELITE AGENT'; 
            accessLevel = 'ALPHA';
        }
        if (userData.level >= 50) { 
            tierColor = '#e74c3c'; 
            tierLabel = 'COMMANDER'; 
            accessLevel = 'OMEGA';
        }

        const statsEmbed = new EmbedBuilder()
            .setColor(tierColor)
            .setAuthor({ 
                name: `AGENT DOSSIER: ${target.username.toUpperCase()}`, 
                iconURL: target.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle('─ ARCHITECT NEURAL PROFILE ─')
            .setDescription(`**Classification:** \`${tierLabel}\`\n**Current Node:** \`Bamako-223\``)
            .addFields(
                { 
                    name: '📊 GLOBAL HIERARCHY', 
                    value: `\`\`\`ansi\n\u001b[1;36mRank:\u001b[0m #${globalRank} / ${sortedUsers.length}\n\u001b[1;36mLevel:\u001b[0m ${userData.level}\`\`\``, 
                    inline: false 
                },
                { 
                    name: '🌀 NEURAL SYNC (XP PROGRESS)', 
                    value: `\`${createBar(progressPercent)}\` **${progressPercent}%**\n*\`${xpInLevel} / 1000 XP until next sync upgrade*\``, 
                    inline: false 
                }
            );

        // 5. MULTIMODAL COMBAT INTEL (Game | Mode | Rank)
        if (gameData && gameData.game) {
            const lastSync = gameData.timestamp ? `<t:${Math.floor(gameData.timestamp / 1000)}:R>` : '`N/A`';
            statsEmbed.addFields({ 
                name: '🎮 COMBAT INTEL', 
                value: `\`\`\`prolog\nSector: ${gameData.game}\nTheater: ${gameData.mode || 'N/A'}\nTier: ${gameData.rank || 'Unranked'}\`\`\`\n**Last Sync:** ${lastSync}`, 
                inline: true 
            });
        } else {
            statsEmbed.addFields({ 
                name: '🎮 COMBAT INTEL', 
                value: `\`\`\`fix\nNO_DATA_SYNCED\nRegister via .setgame\`\`\``, 
                inline: true 
            });
        }

        statsEmbed.addFields({ 
            name: '🛡️ CORE STATUS', 
            value: `\`\`\`prolog\nIdentity: VERIFIED\nAccess: LVL_${accessLevel}\nXP_Total: ${userData.xp.toLocaleString()}\`\`\``, 
            inline: true 
        })
        .setFooter({ 
            text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223', 
            iconURL: client.user.displayAvatarURL() 
        })
        .setTimestamp();

        message.reply({ 
            content: `> **Deciphering neural signature for ${target.username}...**`,
            embeds: [statsEmbed] 
        });
    }
};
