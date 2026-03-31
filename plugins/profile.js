// plugins/profile.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'profile',
    aliases: ['p', 'id', 'rank', 'stats'],
    description: 'Intelligent agent dossier with dynamic stats',
    cooldown: 3000,
    
    run: async (client, message, args) => {
        const target = message.mentions.users.first() || message.author;
        
        // --- GET DATA FROM SQLITE ---
        const userData = client.db.prepare("SELECT * FROM users WHERE id = ?").get(target.id);
        
        if (!userData) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ AGENT NOT FOUND')
                .setDescription(`${target.username} has no recorded data in the neural network.`)
                .addFields(
                    { name: '💡 Tip', value: 'Send a few messages to initialize your dossier!', inline: true }
                )
                .setFooter({ text: 'ARCHITECT CG-223 • Database Query' })
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }
        
        // --- CALCULATE RANK USING SQL (FAST!) ---
        const rankData = client.db.prepare("SELECT COUNT(*) as rank FROM users WHERE xp > ?").get(userData.xp);
        const serverRank = rankData.rank + 1;
        const totalUsers = client.db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        
        // Get user's total messages (you might need to add this column)
        const messageCount = client.db.prepare("SELECT total_messages FROM users WHERE id = ?").get(target.id)?.total_messages || 0;
        
        // Get join date (add this column if you don't have it)
        const joinDate = userData.join_date || Date.now();
        const lastSeen = userData.last_seen || Date.now();
        
        // Parse gaming data from JSON string (if stored as JSON)
        let gamingData = { game: "CODM", rank: "Unranked" };
        if (userData.gaming) {
            try {
                gamingData = typeof userData.gaming === 'string' 
                    ? JSON.parse(userData.gaming) 
                    : userData.gaming;
            } catch (e) {
                gamingData = { game: "CODM", rank: "Unranked" };
            }
        }
        
        // Parse achievements from JSON string
        let achievements = [];
        if (userData.achievements) {
            try {
                achievements = typeof userData.achievements === 'string' 
                    ? JSON.parse(userData.achievements) 
                    : userData.achievements;
            } catch (e) {
                achievements = [];
            }
        }
        
        // --- XP CALCULATION (Matching index.js) ---
        // In index.js: newLevel = Math.floor(xp / 1000) + 1
        // So level 1 = 0-999 XP, level 2 = 1000-1999 XP, etc.
        const currentLevel = userData.level;
        const currentXP = userData.xp;
        const xpForCurrentLevel = (currentLevel - 1) * 1000;
        const xpForNextLevel = currentLevel * 1000;
        const xpProgress = currentXP - xpForCurrentLevel;
        const xpNeeded = 1000;
        const progressPercent = Math.min(Math.floor((xpProgress / xpNeeded) * 100), 100);
        const xpToNextLevel = xpNeeded - xpProgress;
        
        // --- DYNAMIC PROGRESS BAR ---
        const barSize = 10;
        const filled = Math.round((progressPercent / 100) * barSize);
        const empty = barSize - filled;
        
        const getProgressChar = (percent) => {
            if (percent >= 75) return '🟩';
            if (percent >= 50) return '🟨';
            if (percent >= 25) return '🟧';
            return '🟥';
        };
        
        const progressChar = getProgressChar(progressPercent);
        const progressBar = progressChar.repeat(filled) + '⬛'.repeat(empty);
        
        // --- LEVEL TITLE SYSTEM ---
        const getLevelTitle = (level) => {
            if (level >= 100) return '👑 LEGENDARY';
            if (level >= 75) return '💎 MYTHIC';
            if (level >= 50) return '🌟 ELITE';
            if (level >= 25) return '⚔️ VETERAN';
            if (level >= 10) return '⭐ SKILLED';
            return '🌱 NOVICE';
        };
        
        // --- MEDALS & ACHIEVEMENTS SYSTEM ---
        const medalIcons = { 
            "sniper": "🎯", 
            "veteran": "🎖️", 
            "elite": "🔥",
            "talkative": "💬",
            "helper": "🤝",
            "loyal": "⭐"
        };
        
        // Auto-unlock medals based on stats
        let updated = false;
        
        if (messageCount >= 100 && !achievements.includes('talkative')) {
            achievements.push('talkative');
            updated = true;
        }
        if (currentLevel >= 10 && !achievements.includes('veteran')) {
            achievements.push('veteran');
            updated = true;
        }
        if (currentLevel >= 25 && !achievements.includes('elite')) {
            achievements.push('elite');
            updated = true;
        }
        if (serverRank <= 10 && !achievements.includes('loyal')) {
            achievements.push('loyal');
            updated = true;
        }
        
        // Update database with new medals
        if (updated) {
            client.db.prepare("UPDATE users SET achievements = ? WHERE id = ?").run(JSON.stringify(achievements), target.id);
        }
        
        const medals = achievements.length > 0 
            ? achievements.map(m => `${medalIcons[m] || '🏅'} \`${m.toUpperCase()}\``).join('\n')
            : "*No medals yet. Keep grinding!*";
        
        // --- TIMESTAMP FORMATTING ---
        const validLastSeen = !isNaN(lastSeen) ? Math.floor(lastSeen / 1000) : Math.floor(Date.now() / 1000);
        const validJoinDate = !isNaN(joinDate) ? Math.floor(joinDate / 1000) : Math.floor(Date.now() / 1000);
        
        // --- RANK PERCENTAGE ---
        const rankPercentile = ((totalUsers - serverRank) / totalUsers * 100).toFixed(1);
        
        // --- GUILD RANK (Discord roles based) ---
        const member = message.guild.members.cache.get(target.id);
        const highestRole = member?.roles.highest.name !== '@everyone' ? member.roles.highest.name : 'Member';
        
        // --- CALCULATE MESSAGES PER DAY ---
        const daysSinceJoin = Math.max(1, (Date.now() - validJoinDate * 1000) / 86400000);
        const messagesPerDay = Math.floor(messageCount / daysSinceJoin);
        
        // --- CREATE MAIN EMBED ---
        const embed = new EmbedBuilder()
            .setColor(getLevelColor(currentLevel))
            .setAuthor({ 
                name: `🎮 ${getLevelTitle(currentLevel)} AGENT DOSSIER`, 
                iconURL: target.displayAvatarURL({ dynamic: true })
            })
            .setTitle(`${target.username.toUpperCase()} | LEVEL ${currentLevel}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setDescription(`*${getRankQuote(serverRank, totalUsers)}*`)
            .addFields(
                { 
                    name: '📊 COMBAT STATISTICS', 
                    value: `\`\`\`yml\n⚡ Level: ${currentLevel}\n✨ Total XP: ${currentXP.toLocaleString()}\n💬 Messages: ${messageCount.toLocaleString()}\n🏆 Server Rank: #${serverRank} of ${totalUsers}\`\`\``,
                    inline: false 
                },
                { 
                    name: `📈 PROGRESS → LEVEL ${currentLevel + 1}`, 
                    value: `${progressBar} \`${progressPercent}%\`\n\`${xpProgress.toLocaleString()}/${xpNeeded.toLocaleString()} XP\`\n*(Need ${xpToNextLevel.toLocaleString()} more XP)*`,
                    inline: false 
                },
                { 
                    name: '🎮 GAMING PROFILE', 
                    value: `**Main Game:** \`${gamingData.game}\`\n**Rank:** \`${gamingData.rank}\`\n**Guild Role:** \`${highestRole}\``,
                    inline: true 
                },
                { 
                    name: '📈 PERFORMANCE', 
                    value: `**Top ${rankPercentile}%** of server\n**Messages/Day:** ~${messagesPerDay}`,
                    inline: true 
                },
                { 
                    name: '🏅 MEDALS & HONORS', 
                    value: medals,
                    inline: false 
                },
                { 
                    name: '🕒 ACTIVITY', 
                    value: `**Joined:** <t:${validJoinDate}:D>\n**Last Active:** <t:${validLastSeen}:R>`,
                    inline: true 
                }
            )
            .setFooter({ 
                text: `Agent ID: ${target.id.slice(0,8)} • ${message.guild.name} • Eagle Community 🇲🇱`,
                iconURL: message.guild.iconURL() || client.user.displayAvatarURL()
            })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};

// Helper function for level colors
function getLevelColor(level) {
    if (level >= 100) return '#FF0000';
    if (level >= 75) return '#FF69B4';
    if (level >= 50) return '#FFD700';
    if (level >= 25) return '#00AAFF';
    if (level >= 10) return '#00FF00';
    return '#95a5a6';
}

// Helper function for rank quotes
function getRankQuote(rank, total) {
    const percentile = ((total - rank) / total) * 100;
    
    if (rank === 1) return "👑 **THE LEGEND** - Top of the leaderboard!";
    if (rank <= 3) return "⚡ **ELITE FORCE** - Among the server's finest!";
    if (rank <= 10) return "🌟 **MASTER TIER** - Respected veteran member";
    if (rank <= 25) return "⭐ **SKILLED AGENT** - Proven warrior";
    if (percentile >= 50) return "📈 **ACTIVE MEMBER** - On the rise!";
    return "🌱 **RECRUIT** - Every legend starts somewhere";
}