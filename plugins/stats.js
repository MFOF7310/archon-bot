const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['st', 'stat'],
    description: 'Display detailed agent statistics and global rank with combat intelligence.',
    category: 'PROFILE',
    run: async (client, message, args, db) => {
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

        // 2. DATA SYNCHRONIZATION (Using passed db parameter)
        let targetData = db.prepare("SELECT * FROM users WHERE id = ?").get(target.id);
        
        if (!targetData) {
            return message.reply(`❌ **Agent ${target.username}** has no recorded data in the neural network. Send a few messages to initialize!`);
        }
        
        // Parse gaming data if it exists
        let gameData = null;
        if (targetData?.gaming) {
            try {
                gameData = typeof targetData.gaming === 'string' 
                    ? JSON.parse(targetData.gaming) 
                    : targetData.gaming;
            } catch (e) {
                // Invalid JSON, ignore
            }
        }
        
        const xp = targetData?.xp || 0;
        const level = targetData?.level || 1;
        const totalMessages = targetData?.total_messages || 0;

        // 3. OPTIMIZED GLOBAL RANKING CALCULATION (Lightning Fast!)
        // Instead of fetching all users, we just count how many have more XP
        const rankData = db.prepare("SELECT COUNT(*) as rank FROM users WHERE xp > ?").get(xp);
        const globalRank = (rankData?.rank || 0) + 1;
        const totalUsersData = db.prepare("SELECT COUNT(*) as count FROM users").get();
        const totalUsers = totalUsersData?.count || 1;
        
        const xpInLevel = xp % 1000;
        const xpNeeded = 1000 - xpInLevel;
        const progressPercent = Math.floor((xpInLevel / 1000) * 100);
        
        const createBar = (percent) => {
            const size = 15;
            const progress = Math.round((size * percent) / 100);
            return '█'.repeat(progress) + '░'.repeat(size - progress);
        };

        // 4. DYNAMIC TIER LOGIC
        let tierColor = '#5865F2';
        let tierLabel = 'RECRUIT';
        let accessLevel = 'BETA';
        let tierEmoji = '🌱';
        let tierBadge = '⬤';

        if (level >= 5) { 
            tierColor = '#57F287'; 
            tierLabel = 'OPERATIVE'; 
            accessLevel = 'ALPHA';
            tierEmoji = '⚡';
            tierBadge = '⬤';
        }
        if (level >= 10) { 
            tierColor = '#FEE75C'; 
            tierLabel = 'ELITE AGENT'; 
            accessLevel = 'DELTA';
            tierEmoji = '✨';
            tierBadge = '⬤⬤';
        }
        if (level >= 25) { 
            tierColor = '#EB459E'; 
            tierLabel = 'SPECIALIST'; 
            accessLevel = 'GAMMA';
            tierEmoji = '💠';
            tierBadge = '⬤⬤⬤';
        }
        if (level >= 50) { 
            tierColor = '#ED4245'; 
            tierLabel = 'COMMANDER'; 
            accessLevel = 'OMEGA';
            tierEmoji = '🔱';
            tierBadge = '⬤⬤⬤⬤';
        }
        if (level >= 75) { 
            tierColor = '#9B59B6'; 
            tierLabel = 'WARLORD'; 
            accessLevel = 'MASTER';
            tierEmoji = '👑';
            tierBadge = '⬤⬤⬤⬤⬤';
        }
        if (level >= 100) { 
            tierColor = '#F1C40F'; 
            tierLabel = 'LEGEND'; 
            accessLevel = 'TRANSCENDENT';
            tierEmoji = '🏆';
            tierBadge = '★ LEGEND ★';
        }

        // 5. NEXT MILESTONE CALCULATION
        let nextMilestone = 5;
        if (level < 5) nextMilestone = 5;
        else if (level < 10) nextMilestone = 10;
        else if (level < 25) nextMilestone = 25;
        else if (level < 50) nextMilestone = 50;
        else if (level < 75) nextMilestone = 75;
        else if (level < 100) nextMilestone = 100;
        else nextMilestone = 100;
        
        const xpToMilestone = Math.max(0, nextMilestone * 1000 - xp);
        
        // 6. MAIN STATS EMBED
        const statsEmbed = new EmbedBuilder()
            .setColor(tierColor)
            .setAuthor({ 
                name: `${tierEmoji} AGENT DOSSIER: ${target.username.toUpperCase()} ${tierEmoji}`, 
                iconURL: target.displayAvatarURL({ dynamic: true, size: 1024 }) 
            })
            .setTitle('═ ARCHITECT NEURAL PROFILE ═')
            .setDescription(
                `**Classification:** \`${tierLabel}\` ${tierBadge}\n` +
                `**Node:** \`BAMAKO-223\` • **Status:** \`🟢 ACTIVE\`\n` +
                `**Agent ID:** \`${target.id}\``
            )
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { 
                    name: '📊 GLOBAL HIERARCHY', 
                    value: `\`\`\`yaml\nRank: #${globalRank} / ${totalUsers}\nLevel: ${level}\nMessages: ${totalMessages.toLocaleString()}\nTotal XP: ${xp.toLocaleString()}\`\`\``, 
                    inline: false 
                },
                { 
                    name: '🌀 NEURAL SYNC (XP PROGRESS)', 
                    value: `\`\`\`\n${createBar(progressPercent)} ${progressPercent}%\n[${xpInLevel.toLocaleString()} / 1000 XP]\n└─ ${xpNeeded} XP to Level ${level + 1}\`\`\``, 
                    inline: false 
                }
            );

        // 7. COMBAT MATRIX SECTION (Enhanced with gaming data from schema)
        if (gameData && gameData.game) {
            const lastSync = gameData.timestamp 
                ? `<t:${Math.floor(gameData.timestamp / 1000)}:R>` 
                : '`N/A`';
            
            // Get rank tier emoji based on rank name
            let rankEmoji = '🎖️';
            const rankLower = (gameData.rank || '').toLowerCase();
            if (rankLower.includes('bronze')) rankEmoji = '🥉';
            else if (rankLower.includes('silver')) rankEmoji = '🥈';
            else if (rankLower.includes('gold')) rankEmoji = '🥇';
            else if (rankLower.includes('platinum')) rankEmoji = '💎';
            else if (rankLower.includes('diamond')) rankEmoji = '💠';
            else if (rankLower.includes('master')) rankEmoji = '👑';
            else if (rankLower.includes('legend')) rankEmoji = '🏆';
            
            statsEmbed.addFields({ 
                name: '🎮 COMBAT MATRIX', 
                value: `\`\`\`prolog\n┌─ PRIMARY SECTOR: ${gameData.game}\n├─ COMBAT MODE: ${gameData.mode || 'Standard'}\n└─ RANK/TIER: ${rankEmoji} ${gameData.rank}\`\`\`\n**Last Synchronization:** ${lastSync}`, 
                inline: false 
            });
        } else {
            statsEmbed.addFields({ 
                name: '🎮 COMBAT MATRIX', 
                value: `\`\`\`fix\n┌─ STATUS: NO_DATA_SYNCED\n├─ Use: .setgame [Game] | [Mode] | [Rank]\n└─ Example: .setgame Valorant | Ranked | Diamond II\`\`\``, 
                inline: false 
            });
        }

        // 8. MILESTONE & REWARDS SECTION
        statsEmbed.addFields({ 
            name: '🎯 NEXT MILESTONE', 
            value: `\`\`\`yaml\nLevel ${nextMilestone} Achievement\n${xpToMilestone.toLocaleString()} XP remaining\nReward: ${getMilestoneReward(nextMilestone)}\`\`\``, 
            inline: true 
        });

        // 9. CORE STATUS (Added gaming stats from schema)
        const gamesPlayed = targetData?.games_played || 0;
        const gamesWon = targetData?.games_won || 0;
        const winRate = gamesPlayed > 0 ? Math.floor((gamesWon / gamesPlayed) * 100) : 0;
        
        statsEmbed.addFields({ 
            name: '🛡️ CORE STATUS', 
            value: `\`\`\`prolog\nIdentity: VERIFIED\nAccess: LVL_${accessLevel}\nGames: ${gamesPlayed} (${winRate}% WR)\nCombat Ready: ${gameData ? 'ACTIVE' : 'STANDBY'}\`\`\``, 
            inline: true 
        })
        .setFooter({ 
            text: `EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223 • ${tierLabel} TIER`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setTimestamp();

        // 10. RANK-BASED RESPONSE MESSAGE
        let responseMessage = '';
        if (target.id === message.author.id) {
            if (level >= 100) responseMessage = `🏆 **TRANSCENDENT AGENT DETECTED!** You stand among legends, Commander. 🏆`;
            else if (level >= 50) responseMessage = `🔱 **Commander ${target.username}** - Your tactical supremacy is noted. 🔱`;
            else if (level >= 25) responseMessage = `💠 **Elite Agent** - Neural synchronization at ${progressPercent}% to next tier. 💠`;
            else if (level >= 10) responseMessage = `✨ **Agent ${target.username}** - Progressing steadily toward elite status. ✨`;
            else responseMessage = `🌱 **Agent ${target.username}** - Every journey begins with a single step. Continue your training. 🌱`;
        } else {
            if (level >= 100) responseMessage = `🏆 **LEGENDARY AGENT DETECTED!** ${target.username} has achieved transcendence. 🏆`;
            else if (level >= 50) responseMessage = `🔱 **High-Value Asset:** ${target.username} - Commander tier operative. 🔱`;
            else if (level >= 25) responseMessage = `💠 **Elite Asset:** ${target.username} - Specialist classification. 💠`;
            else responseMessage = `📡 **Agent Profile:** ${target.username} - ${tierLabel} classification. 📡`;
        }

        message.reply({ 
            content: `> **${responseMessage}**`,
            embeds: [statsEmbed] 
        });
    }
};

// Helper function for milestone rewards
function getMilestoneReward(level) {
    const rewards = {
        5: "✨ Level 5 Role Unlocked",
        10: "🎁 VIP Access + Alpha Tier",
        25: "🏆 Elite Status + Gamma Access",
        50: "💎 Commander Role + Omega Tier",
        75: "👑 Warlord Status",
        100: "🏆 Legendary Achievement + Transcendent Access"
    };
    return rewards[level] || "🌟 Continue the grind!";
}