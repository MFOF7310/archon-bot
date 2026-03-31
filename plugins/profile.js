const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'profile',
    aliases: ['p', 'id', 'rank', 'stats'],
    description: 'Intelligent agent dossier with dynamic stats',
    cooldown: 3000,
    
    run: async (client, message, args, db) => {
        try {
            const target = message.mentions.users.first() || message.author;
            
            // 1. SAFE DATA RETRIEVAL
            const userData = db.prepare("SELECT * FROM users WHERE id = ?").get(target.id);
            
            if (!userData) {
                return message.reply(`❌ **Agent ${target.username}** has no data yet. Send a few messages to initialize!`);
            }
            
            // 2. SAFE RANK CALCULATION
            const rankData = db.prepare("SELECT COUNT(*) as rank FROM users WHERE xp > ?").get(userData.xp || 0);
            const serverRank = (rankData?.rank || 0) + 1;
            const totalUsersData = db.prepare("SELECT COUNT(*) as count FROM users").get();
            const totalUsers = totalUsersData?.count || 1;
            
            // 3. COLUMN SYNC (Matching index.js exactly)
            const messageCount = userData.total_messages || 0;
            const currentLevel = userData.level || 1;
            const currentXP = userData.xp || 0;
            
            // 4. GAMING STATS (from your database schema)
            const gamesPlayed = userData.games_played || 0;
            const gamesWon = userData.games_won || 0;
            const totalWinnings = userData.total_winnings || 0;
            const winRate = gamesPlayed > 0 ? Math.floor((gamesWon / gamesPlayed) * 100) : 0;
            
            // 5. XP MATH
            const xpForCurrentLevel = (currentLevel - 1) * 1000;
            const xpProgress = Math.max(0, currentXP - xpForCurrentLevel);
            const xpNeeded = 1000;
            const progressPercent = Math.min(Math.floor((xpProgress / xpNeeded) * 100), 100);
            const xpToNextLevel = xpNeeded - xpProgress;
            
            // 6. PROGRESS BAR
            const barSize = 10;
            const filled = Math.round((progressPercent / 100) * barSize);
            const progressBar = '🟩'.repeat(filled) + '⬛'.repeat(barSize - filled);
            
            // 7. LEVEL TITLE
            const getLevelTitle = (level) => {
                if (level >= 100) return '👑 LEGENDARY';
                if (level >= 75) return '💎 MYTHIC';
                if (level >= 50) return '🌟 ELITE';
                if (level >= 25) return '⚔️ VETERAN';
                if (level >= 10) return '⭐ SKILLED';
                return '🌱 NOVICE';
            };
            
            // 8. GAMING DATA PARSING (for the gaming TEXT column)
            let gamingData = { game: "CODM", rank: "Unranked" };
            if (userData.gaming) {
                try {
                    gamingData = JSON.parse(userData.gaming);
                } catch (e) { /* use default */ }
            }

            // 9. GUILD ROLE
            const member = message.guild.members.cache.get(target.id);
            const highestRole = member?.roles.highest.name !== '@everyone' ? member.roles.highest.name : 'Member';

            // 10. EMBED
            const embed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: `🎮 ${getLevelTitle(currentLevel)} AGENT DOSSIER: ${target.username}`, iconURL: target.displayAvatarURL() })
                .setThumbnail(target.displayAvatarURL({ size: 1024 }))
                .addFields(
                    { 
                        name: '📊 STATS', 
                        value: `\`\`\`yml\nLevel: ${currentLevel}\nXP: ${currentXP.toLocaleString()}\nRank: #${serverRank}/${totalUsers}\nMessages: ${messageCount.toLocaleString()}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: '🎯 PROGRESS', 
                        value: `${progressBar} \`${progressPercent}%\`\n\`${xpProgress}/${xpNeeded} XP\`\n*(Need ${xpToNextLevel} more)*`, 
                        inline: true 
                    },
                    { 
                        name: '🎮 GAMING STATS', 
                        value: `\`\`\`yml\n🎯 Game: ${gamingData.game}\n🏆 Rank: ${gamingData.rank}\n🎮 Played: ${gamesPlayed}\n🏅 Won: ${gamesWon}\n📊 Win Rate: ${winRate}%\n💰 Winnings: ${totalWinnings.toLocaleString()}\`\`\``, 
                        inline: false 
                    },
                    { 
                        name: '🕹️ DISCORD', 
                        value: `**Role:** ${highestRole}\n**ID:** \`${target.id.slice(0,8)}...\``, 
                        inline: true 
                    }
                )
                .setFooter({ text: `Eagle Community 🇲🇱 • BKO-223 • Requested by ${message.author.username}` })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error("PROFILE_ERROR:", error);
            message.reply("⚠️ **Neural Link Error:** Database column mismatch. Please tell the Admin to check the console.");
        }
    }
};