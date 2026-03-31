const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp', 'dossier'],  // REMOVED 'profile' to avoid conflict
    description: 'Access an agent\'s neural synchronization level and combat matrix.',
    category: 'PROFILE',
    run: async (client, message, args, db) => {
        const target = message.mentions.users.first() || message.author;
        
        // Query the database for the target user
        let targetData = db.prepare("SELECT * FROM users WHERE id = ?").get(target.id);
        
        if (!targetData) {
            return message.reply(`❌ **Agent ${target.username}** has no recorded data in the neural network. Send a few messages to initialize!`);
        }
        
        const xp = targetData?.xp || 0;
        const level = targetData?.level || 1;
        const totalMessages = targetData?.total_messages || 0;
        const gamesPlayed = targetData?.games_played || 0;
        const gamesWon = targetData?.games_won || 0;
        const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

        // OPTIMIZED: Use COUNT(*) instead of fetching all users
        const rankData = db.prepare("SELECT COUNT(*) as rank FROM users WHERE xp > ?").get(xp);
        const rank = (rankData?.rank || 0) + 1;
        const totalUsersData = db.prepare("SELECT COUNT(*) as count FROM users").get();
        const totalUsers = totalUsersData?.count || 1;

        const progressXP = xp % 1000; 
        const percent = Math.floor((progressXP / 1000) * 100);
        const xpNeeded = 1000 - progressXP;

        const createBar = (p) => {
            const size = 12;
            const filled = Math.round((size * p) / 100);
            return '▰'.repeat(filled) + '▱'.repeat(size - filled);
        };
        
        // Parse gaming data if it exists
        let gameData = null;
        let combatMatrixValue = '';
        
        if (targetData?.gaming) {
            try {
                gameData = typeof targetData.gaming === 'string' 
                    ? JSON.parse(targetData.gaming) 
                    : targetData.gaming;
            } catch (e) {
                // Invalid JSON, ignore
            }
        }
        
        if (gameData && gameData.game) {
            let rankEmoji = '🎖️';
            const rankLower = (gameData.rank || '').toLowerCase();
            if (rankLower.includes('bronze')) rankEmoji = '🥉';
            else if (rankLower.includes('silver')) rankEmoji = '🥈';
            else if (rankLower.includes('gold')) rankEmoji = '🥇';
            else if (rankLower.includes('platinum')) rankEmoji = '💎';
            else if (rankLower.includes('diamond')) rankEmoji = '💠';
            else if (rankLower.includes('master')) rankEmoji = '👑';
            else if (rankLower.includes('legend')) rankEmoji = '🏆';
            
            combatMatrixValue = `\`\`\`prolog\n┌─ PRIMARY SECTOR: ${gameData.game}\n├─ COMBAT MODE: ${gameData.mode || 'Standard'}\n└─ RANK/TIER: ${rankEmoji} ${gameData.rank}\`\`\``;
        } else {
            combatMatrixValue = `\`\`\`fix\nSTATUS: AWAITING_DATA\nUse .setgame to register combat stats\`\`\``;
        }

        // Dynamic tier badge based on level
        let tierBadge = '';
        if (level >= 100) tierBadge = '🏆 LEGENDARY';
        else if (level >= 75) tierBadge = '👑 WARLORD';
        else if (level >= 50) tierBadge = '🔱 COMMANDER';
        else if (level >= 25) tierBadge = '💠 SPECIALIST';
        else if (level >= 10) tierBadge = '✨ ELITE AGENT';
        else if (level >= 5) tierBadge = '⚡ OPERATIVE';
        else tierBadge = '🌱 RECRUIT';

        const dossierEmbed = new EmbedBuilder()
            .setColor(getLevelColor(level))
            .setAuthor({ 
                name: `AGENT DOSSIER: ${target.username.toUpperCase()}`, 
                iconURL: target.displayAvatarURL({ dynamic: true }) 
            })
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(`**Node:** \`Bamako-223\`\n**Status:** \`🟢 NEURAL_SYNC_STABLE\`\n**Classification:** \`${tierBadge}\``)
            .addFields(
                { 
                    name: '📊 SYNC TELEMETRY', 
                    value: `\`\`\`ansi\n\u001b[1;36m▣\u001b[0m Level: ${level}\n\u001b[1;34m▣\u001b[0m Rank:  #${rank} / ${totalUsers}\n\u001b[1;32m▣\u001b[0m Total: ${xp.toLocaleString()} XP\n\u001b[1;33m▣\u001b[0m Messages: ${totalMessages.toLocaleString()}\n\u001b[1;35m▣\u001b[0m Games: ${gamesPlayed} (${winRate}% WR)\`\`\``, 
                    inline: false 
                },
                { 
                    name: `🚀 PROGRESS TO LEVEL ${level + 1}`, 
                    value: `\`\`\`ansi\n\u001b[1;33m${createBar(percent)}\u001b[0m ${percent}%\`\`\`\n*Sync gap: ${xpNeeded} XP to next level.*`, 
                    inline: false 
                },
                { 
                    name: '🎮 COMBAT MATRIX', 
                    value: combatMatrixValue, 
                    inline: false 
                }
            )
            .setFooter({ text: `EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223 • Agent ID: ${target.id.slice(0,8)}`, iconURL: message.guild.iconURL() || client.user.displayAvatarURL() })
            .setTimestamp();

        // Rank-based response message
        let responseMessage = '';
        if (target.id === message.author.id) {
            if (level >= 100) responseMessage = `🏆 **TRANSCENDENT AGENT DETECTED!** You stand among legends, Commander. 🏆`;
            else if (level >= 50) responseMessage = `🔱 **Commander ${target.username}** - Your tactical supremacy is noted. 🔱`;
            else if (level >= 25) responseMessage = `💠 **Elite Agent** - Neural synchronization at ${percent}% to next tier. 💠`;
            else if (level >= 10) responseMessage = `✨ **Agent ${target.username}** - Progressing steadily toward elite status. ✨`;
            else responseMessage = `🌱 **Agent ${target.username}** - Every journey begins with a single step. Continue your training. 🌱`;
        } else {
            if (level >= 100) responseMessage = `🏆 **LEGENDARY AGENT DETECTED!** ${target.username} has achieved transcendence. 🏆`;
            else if (level >= 50) responseMessage = `🔱 **High-Value Asset:** ${target.username} - Commander tier operative. 🔱`;
            else if (level >= 25) responseMessage = `💠 **Elite Asset:** ${target.username} - Specialist classification. 💠`;
            else responseMessage = `📡 **Agent Profile:** ${target.username} - ${tierBadge} classification. 📡`;
        }

        message.reply({ 
            content: `> **${responseMessage}**`,
            embeds: [dossierEmbed] 
        });
    },
};

// Helper function for level colors
function getLevelColor(level) {
    if (level >= 100) return '#F1C40F';
    if (level >= 75) return '#9B59B6';
    if (level >= 50) return '#ED4245';
    if (level >= 25) return '#EB459E';
    if (level >= 10) return '#FEE75C';
    if (level >= 5) return '#57F287';
    return '#5865F2';
}