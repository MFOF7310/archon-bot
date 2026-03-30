const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'rankings'],
    category: 'SYSTEM',
    description: 'Display the top-tier agents by neural synchronization (XP) and gaming achievements.',
    run: async (client, message, args, userData) => {
        const db = require('better-sqlite3')('database.sqlite');
        
        // Get all users sorted by XP
        let entries = db.prepare("SELECT * FROM users ORDER BY xp DESC").all();
        db.close();
        
        if (entries.length === 0) {
            return message.reply("📊 **DATABASE EMPTY:** No agent telemetry detected.");
        }
        
        // Check if user wants gaming leaderboard
        const subCommand = args[0]?.toLowerCase();
        if (subCommand === 'games' || subCommand === 'wins' || subCommand === 'gaming') {
            return showGameLeaderboard(client, message, args[1]);
        }
        
        // Get user's rank
        const userIndex = entries.findIndex(e => e.id === message.author.id);
        const userRank = userIndex === -1 ? 'UNRANKED' : userIndex + 1;
        const userXP = userIndex === -1 ? 0 : entries[userIndex].xp;
        const userLevel = userIndex === -1 ? 0 : entries[userIndex].level;
        
        // Calculate progress to next rank
        let motivationalQuote = "";
        let rankProgress = "";
        
        if (userIndex > 0) {
            const gap = entries[userIndex - 1].xp - userXP;
            motivationalQuote = `▫️ Need **${gap.toLocaleString()} XP** to overtake Rank #${userIndex}.`;
            
            // Progress bar to next rank
            const progressPercent = Math.min(100, Math.floor((userXP / entries[userIndex - 1].xp) * 100));
            const progressBar = createProgressBar(progressPercent, 20);
            rankProgress = `\n**Progress to #${userIndex}:** \`${progressBar} ${progressPercent}%\``;
        } else if (userIndex === 0) {
            motivationalQuote = "👑 **APEX AGENT:** You are currently leading the sector.";
            rankProgress = "\n**Status:** `🏆 SUPREME COMMANDER`";
        } else {
            const topXP = entries[0].xp;
            const gap = topXP - userXP;
            motivationalQuote = `▫️ Need **${gap.toLocaleString()} XP** to enter the leaderboard.`;
        }
        
        // Get user's gaming stats
        const userGamesWon = userIndex === -1 ? 0 : (entries[userIndex].games_won || 0);
        const userTotalWinnings = userIndex === -1 ? 0 : (entries[userIndex].total_winnings || 0);
        
        const pageSize = 5;
        const maxPage = Math.ceil(entries.length / pageSize) - 1;
        let currentPage = 0;
        
        const generateEmbed = (page) => {
            const start = page * pageSize;
            const pageEntries = entries.slice(start, start + pageSize);
            const statusIcons = ['🥇', '🥈', '🥉', '🔹', '🔹'];
            
            let description = `**NODE:** \`BAMAKO-223\`\n**TOTAL AGENTS:** \`${entries.length}\`\n**SYNC STATUS:** \`🟢 ACTIVE\`\n\n`;
            
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
                        value: `\`🔹 .lb games wins\` - Most victories\n\`🔹 .lb games winnings\` - Richest agents\n\`🔹 .lb games played\` - Most active\n\nUse these commands to see specialized rankings!`,
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
async function showGameLeaderboard(client, message, type = 'wins') {
    const db = require('better-sqlite3')('database.sqlite');
    
    // Add game stats columns if they don't exist
    try {
        db.prepare(`ALTER TABLE users ADD COLUMN games_played INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN games_won INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN total_winnings INTEGER DEFAULT 0`).run();
    } catch (e) {}
    
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
            orderBy = 'win_rate DESC';
            title = 'HIGHEST WIN RATE';
            icon = '📈';
            color = '#9B59B6';
            // Special handling for win rate
            const allUsers = db.prepare(`SELECT id, username, games_played, games_won, total_winnings FROM users WHERE games_played > 5 ORDER BY CAST(games_won AS FLOAT) / games_played DESC LIMIT 10`).all();
            db.close();
            
            if (allUsers.length === 0) {
                return message.reply('📊 No game data available yet. Play at least 5 games to appear on win rate leaderboard!');
            }
            
            const winRateText = allUsers.map((user, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                const winRate = Math.round((user.games_won / user.games_played) * 100);
                return `${medal} **${user.username}** • 🏆 ${winRate}% (${user.games_won}/${user.games_played})`;
            }).join('\n');
            
            const winRateEmbed = new EmbedBuilder()
                .setColor(color)
                .setAuthor({ name: `${icon} GLOBAL LEADERBOARD: ${title}`, iconURL: client.user.displayAvatarURL() })
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
        db.close();
    }
    
    if (topPlayers.length === 0) {
        return message.reply('📊 No game data available yet. Start playing to appear on leaderboards!');
    }
    
    const leaderboardText = topPlayers.map((player, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        const winRate = Math.round((player.games_won / player.games_played) * 100);
        
        if (type === 'wins' || type === 'win') {
            return `${medal} **${player.username}** • 🏆 ${player.games_won} wins (${winRate}% WR)`;
        } else if (type === 'winnings' || type === 'money') {
            return `${medal} **${player.username}** • 💰 ${player.total_winnings.toLocaleString()} 🪙 (${player.games_won} wins)`;
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
                value: `\`\`\`prolog\nUse .game stats to view your personal gaming profile\`\`\``,
                inline: false 
            }
        )
        .setFooter({ text: 'Play more games to climb the ranks! • .game menu to start', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// ================= HELPER FUNCTION =================
function createProgressBar(percent, length = 12) {
    const filled = Math.floor((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}