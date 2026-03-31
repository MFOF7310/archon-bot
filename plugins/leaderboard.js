const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// ================= HELPER FUNCTIONS (Hoisted for availability) =================
function createProgressBar(percent, length = 12) {
    const filled = Math.floor((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'rankings'],
    category: 'SYSTEM',
    description: 'Display the top-tier agents by neural synchronization (XP) and gaming achievements.',
    run: async (client, message, args, db) => {
        // Get all users sorted by XP (optimized with LIMIT for large servers)
        let entries = db.prepare("SELECT * FROM users ORDER BY xp DESC LIMIT 100").all();
        
        if (entries.length === 0) {
            return message.reply("📊 **DATABASE EMPTY:** No agent telemetry detected.");
        }
        
        // Check if user wants gaming leaderboard
        const subCommand = args[0]?.toLowerCase();
        if (subCommand === 'games' || subCommand === 'wins' || subCommand === 'gaming' || subCommand === 'played' || subCommand === 'winnings') {
            return showGameLeaderboard(client, message, args[1] || subCommand, db);
        }
        
        // Get user's rank using optimized query
        const userData = db.prepare("SELECT xp, level, games_played, games_won, total_winnings FROM users WHERE id = ?").get(message.author.id);
        
        let userRank = 'UNRANKED';
        let userXP = 0;
        let userLevel = 0;
        let userGamesWon = 0;
        let userTotalWinnings = 0;
        
        if (userData) {
            userXP = userData.xp || 0;
            userLevel = userData.level || 1;
            userGamesWon = userData.games_won || 0;
            userTotalWinnings = userData.total_winnings || 0;
            
            // Optimized rank calculation
            const rankData = db.prepare("SELECT COUNT(*) as rank FROM users WHERE xp > ?").get(userXP);
            userRank = (rankData?.rank || 0) + 1;
        }
        
        // Calculate progress to next rank
        let motivationalQuote = "";
        let rankProgress = "";
        
        if (userRank !== 'UNRANKED' && userRank > 1) {
            // Get the XP of the user ahead
            const aheadUser = db.prepare("SELECT xp FROM users WHERE xp > ? ORDER BY xp ASC LIMIT 1").get(userXP);
            if (aheadUser) {
                const gap = aheadUser.xp - userXP;
                motivationalQuote = `▫️ Need **${gap.toLocaleString()} XP** to overtake Rank #${userRank - 1}.`;
                
                // Progress bar to next rank
                const progressPercent = Math.min(100, Math.floor((userXP / aheadUser.xp) * 100));
                const progressBar = createProgressBar(progressPercent, 20);
                rankProgress = `\n**Progress to #${userRank - 1}:** \`${progressBar} ${progressPercent}%\``;
            }
        } else if (userRank === 1 && userRank !== 'UNRANKED') {
            motivationalQuote = "👑 **APEX AGENT:** You are currently leading the sector.";
            rankProgress = "\n**Status:** `🏆 SUPREME COMMANDER`";
        } else {
            const topXP = entries[0]?.xp || 0;
            const gap = topXP - userXP;
            if (gap > 0) {
                motivationalQuote = `▫️ Need **${gap.toLocaleString()} XP** to enter the leaderboard.`;
            }
        }
        
        const pageSize = 5;
        const maxPage = Math.ceil(Math.min(entries.length, 100) / pageSize) - 1;
        let currentPage = 0;
        
        const generateEmbed = (page) => {
            const start = page * pageSize;
            const pageEntries = entries.slice(start, start + pageSize);
            const statusIcons = ['🥇', '🥈', '🥉', '🔹', '🔹'];
            
            let description = `**NODE:** \`BAMAKO-223\`\n**TOTAL AGENTS:** \`${db.prepare("SELECT COUNT(*) as count FROM users").get().count}\`\n**SYNC STATUS:** \`🟢 ACTIVE\`\n\n`;
            
            pageEntries.forEach((user, idx) => {
                const globalRank = start + idx + 1;
                const icon = globalRank <= 3 ? statusIcons[globalRank - 1] : '▪️';
                const percent = Math.floor((user.xp % 1000) / 10);
                const bar = createProgressBar(percent, 12);
                
                // Get win rate if available
                const gamesPlayed = user.games_played || 0;
                const gamesWon = user.games_won || 0;
                const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
                
                description += `${icon} **${user.username}**\n`;
                description += `╰ \`LVL ${user.level}\` • \`${user.xp.toLocaleString()} XP\`\n`;
                description += `╰ \`[${bar}]\` **${percent}**% to next level\n`;
                
                if (gamesPlayed > 0) {
                    description += `╰ 🎮 \`${gamesPlayed} games\` • 🏆 \`${winRate}% WR\` • 💰 \`${(user.total_winnings || 0).toLocaleString()}\`\n`;
                }
                description += `\n`;
            });
            
            return new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: '📊 ARCHITECT | HIGH-SYNC LEADERBOARD', iconURL: client.user.displayAvatarURL() })
                .setThumbnail(message.guild.iconURL({ dynamic: true, size: 512 }))
                .setDescription(description)
                .addFields(
                    { 
                        name: '🛰️ YOUR POSITION', 
                        value: `\`\`\`prolog\nRank: #${userRank} | Level: ${userLevel}\nXP: ${userXP.toLocaleString()}\n🎮 Games Won: ${userGamesWon}\n💰 Winnings: ${userTotalWinnings.toLocaleString()} 🪙\n${motivationalQuote}${rankProgress}\`\`\``,
                        inline: false 
                    },
                    { 
                        name: '🎮 GAMING LEADERBOARDS', 
                        value: `\`🔹 .lb wins\` - Most victories\n\`🔹 .lb winnings\` - Richest agents\n\`🔹 .lb played\` - Most active\n\`🔹 .lb winrate\` - Highest win rate\n\nUse these commands to see specialized rankings!`,
                        inline: false 
                    }
                )
                .setFooter({ text: `Page ${page + 1}/${maxPage + 1} • Eagle Community • BKO-223 • ${new Date().getFullYear()}`, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
        };
        
        const generateButtons = (page) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_lb').setLabel('◀ PREV').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId('next_lb').setLabel('NEXT ▶').setStyle(ButtonStyle.Primary).setDisabled(page === maxPage)
            );
        };
        
        const lbMessage = await message.reply({
            content: `> **🔍 Scanning neural frequencies... standings acquired.**`,
            embeds: [generateEmbed(currentPage)],
            components: [generateButtons(currentPage)]
        });
        
        const collector = lbMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: "⛔ Access denied. This leaderboard is locked to the requesting agent.", ephemeral: true });
            }
            if (i.customId === 'prev_lb') currentPage--;
            if (i.customId === 'next_lb') currentPage++;
            await i.update({ embeds: [generateEmbed(currentPage)], components: [generateButtons(currentPage)] });
        });
        
        collector.on('end', () => lbMessage.edit({ components: [] }).catch(() => null));
    }
};

// ================= GAMING LEADERBOARD =================
async function showGameLeaderboard(client, message, type = 'wins', db) {
    let orderBy = '';
    let title = '';
    let icon = '';
    let color = '';
    
    switch(type) {
        case 'wins':
        case 'win':
            orderBy = 'games_won DESC';
            title = 'MOST VICTORIES';
            icon = '🏆';
            color = '#FEE75C';
            break;
        case 'winnings':
        case 'money':
        case 'rich':
            orderBy = 'total_winnings DESC';
            title = 'RICHEST AGENTS';
            icon = '💰';
            color = '#57F287';
            break;
        case 'played':
        case 'active':
            orderBy = 'games_played DESC';
            title = 'MOST ACTIVE';
            icon = '🎮';
            color = '#EB459E';
            break;
        case 'winrate':
        case 'wr':
            // Special handling for win rate
            const allUsers = db.prepare(`SELECT id, username, games_played, games_won, total_winnings FROM users WHERE games_played > 5 ORDER BY CAST(games_won AS FLOAT) / games_played DESC LIMIT 10`).all();
            
            if (allUsers.length === 0) {
                return message.reply('📊 No game data available yet. Play at least 5 games to appear on win rate leaderboard!');
            }
            
            const winRateText = allUsers.map((user, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                const winRate = Math.round((user.games_won / user.games_played) * 100);
                return `${medal} **${user.username}** • 🏆 ${winRate}% (${user.games_won}/${user.games_played})`;
            }).join('\n');
            
            const winRateEmbed = new EmbedBuilder()
                .setColor(color || '#9B59B6')
                .setAuthor({ name: `${icon || '📈'} GLOBAL LEADERBOARD: ${title || 'HIGHEST WIN RATE'}`, iconURL: client.user.displayAvatarURL() })
                .setTitle('═ NEURAL ARCADE RANKINGS ═')
                .setDescription(`\`\`\`yaml\n${winRateText}\`\`\``)
                .setFooter({ text: 'Requires minimum 5 games played • Win rate reflects strategic skill' })
                .setTimestamp();
            
            return message.reply({ embeds: [winRateEmbed] });
        default:
            orderBy = 'games_won DESC';
            title = 'MOST VICTORIES';
            icon = '🏆';
            color = '#FEE75C';
    }
    
    let topPlayers;
    if (type !== 'winrate') {
        topPlayers = db.prepare(`SELECT id, username, games_played, games_won, total_winnings FROM users WHERE games_played > 0 ORDER BY ${orderBy} LIMIT 10`).all();
    }
    
    if (!topPlayers || topPlayers.length === 0) {
        return message.reply('📊 No game data available yet. Start playing to appear on leaderboards!');
    }
    
    const leaderboardText = topPlayers.map((player, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        const winRate = player.games_played > 0 ? Math.round((player.games_won / player.games_played) * 100) : 0;
        
        if (type === 'wins' || type === 'win') {
            return `${medal} **${player.username}** • 🏆 ${player.games_won} wins (${winRate}% WR)`;
        } else if (type === 'winnings' || type === 'money') {
            return `${medal} **${player.username}** • 💰 ${(player.total_winnings || 0).toLocaleString()} 🪙 (${player.games_won} wins)`;
        } else if (type === 'played' || type === 'active') {
            return `${medal} **${player.username}** • 🎮 ${player.games_played} games • 🏆 ${player.games_won} wins`;
        }
        return `${medal} **${player.username}** • 🏆 ${player.games_won} wins`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${icon} GLOBAL LEADERBOARD: ${title}`, iconURL: client.user.displayAvatarURL() })
        .setTitle('═ NEURAL ARCADE RANKINGS ═')
        .setDescription(`\`\`\`yaml\n${leaderboardText}\`\`\``)
        .addFields(
            { 
                name: '📊 YOUR STATS', 
                value: `\`\`\`prolog\nUse .profile to view your personal gaming profile\`\`\``,
                inline: false 
            }
        )
        .setFooter({ text: 'Play more games to climb the ranks!', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}