const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

// ================= SYNCED HELPERS (FIXED - MATCHES rank.js & games.js) =================

// Level formula - NOW MATCHES rank.js EXACTLY (+1 added)
function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

// XP curve inverse - FIXED to match rank.js
function calculateProgress(xp, level) {
    // Level 1 starts at 0 XP (since (1-1)/0.1 = 0, squared = 0)
    const xpCurrent = Math.pow((level - 1) / 0.1, 2);
    const xpNext = Math.pow(level / 0.1, 2);
    
    const percent = Math.floor(((xp - xpCurrent) / (xpNext - xpCurrent)) * 100);
    
    return Math.max(0, Math.min(percent, 100));
}

// Progress bar
function createProgressBar(percent, length = 12) {
    const filled = Math.floor((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// Rank icons
function getRankIcon(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= 10) return '🔹';
    if (rank <= 50) return '▪️';
    return '▫️';
}

// ================= LANGUAGE PACK =================

const LANG = {
    fr: {
        scanning: "🔍 Analyse des fréquences neurales... classement acquis.",
        totalAgents: "AGENTS TOTAUX",
        syncStatus: "STATUT SYNC",
        pos: "VOTRE POSITION",
        next: "pour dépasser",
        apex: "👑 **AGENT APEX:** Vous dominez actuellement le secteur.",
        empty: "📊 **BASE VIDE:** Aucune donnée détectée.",
        gaming: "📊 CLASSEMENTS GAMING",
        xp: "XP",
        level: "Niveau",
        rank: "Rang"
    },
    en: {
        scanning: "🔍 Scanning neural frequencies... standings acquired.",
        totalAgents: "TOTAL AGENTS",
        syncStatus: "SYNC STATUS",
        pos: "YOUR POSITION",
        next: "to overtake",
        apex: "👑 **APEX AGENT:** You are currently leading the sector.",
        empty: "📊 **DATABASE EMPTY:** No data detected.",
        gaming: "📊 GAMING LEADERBOARDS",
        xp: "XP",
        level: "Level",
        rank: "Rank"
    }
};

// ================= MAIN COMMAND =================

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'rankings', 'classement', 'paliers'],
    category: 'SYSTEM',
    description: '📊 Display neural synchronization leaderboard with gaming stats.',
    usage: '.leaderboard [games/wins/winnings]',
    cooldown: 5000,
    examples: ['.leaderboard', '.leaderboard games', '.leaderboard winnings'],

    run: async (client, message, args, db) => {
        // Detect language
        const cmdUsed = message.content.split(' ')[0].toLowerCase();
        const isFrench = cmdUsed.includes('classement') || cmdUsed.includes('paliers');
        const lang = isFrench ? 'fr' : 'en';
        const t = LANG[lang];
        const version = client.version || '1.3.2';

        // Gaming triggers
        const sub = args[0]?.toLowerCase();
        const gamingTriggers = [
            'games', 'wins', 'gaming', 'played', 'winnings',
            'gains', 'victoires', 'argent', 'wr', 'taux'
        ];

        if (gamingTriggers.includes(sub)) {
            return showGameLeaderboard(client, message, sub, db, lang);
        }

        // Fetch leaderboard (Top 100 by XP)
        const entries = db.prepare(`
            SELECT id, username, xp
            FROM users
            ORDER BY xp DESC
            LIMIT 100
        `).all();

        if (entries.length === 0) return message.reply(t.empty);

        // Total users (single query)
        const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;

        // Current user data
        const userData = db.prepare(`SELECT xp FROM users WHERE id = ?`).get(message.author.id);
        const userXP = userData?.xp || 0;
        const userLevel = calculateLevel(userXP);

        const rankData = db.prepare(`SELECT COUNT(*) as rank FROM users WHERE xp > ?`).get(userXP);
        const userRank = (rankData?.rank || 0) + 1;

        // Gap calculation
        let motive = "";
        const aheadUser = db.prepare(`
            SELECT xp, username
            FROM users
            WHERE xp > ?
            ORDER BY xp ASC
            LIMIT 1
        `).get(userXP);

        if (aheadUser && userRank > 1) {
            const gap = aheadUser.xp - userXP;
            motive = `▫️ ${t.next} **${aheadUser.username}** (#${userRank - 1}): **+${gap.toLocaleString()} ${t.xp}**`;
        } else if (userRank === 1) {
            motive = t.apex;
        }

        // Pagination
        const pageSize = 5;
        const maxPage = Math.ceil(entries.length / pageSize) - 1;
        let currentPage = 0;

        // Generate Embed
        const generateEmbed = (page) => {
            const start = page * pageSize;
            const pageEntries = entries.slice(start, start + pageSize);
            
            let desc = `**NODE:** \`BKO-223\`\n`;
            desc += `**${t.totalAgents}:** \`${totalUsers}\`\n`;
            desc += `**${t.syncStatus}:** \`🟢 ACTIVE\`\n`;
            desc += `**Core:** \`Groq LPU™ 70B\`\n\n`;

            pageEntries.forEach((user, idx) => {
                const globalRank = start + idx + 1;
                const icon = getRankIcon(globalRank);
                const level = calculateLevel(user.xp);
                const percent = calculateProgress(user.xp, level);
                const bar = createProgressBar(percent, 10);

                desc += `${icon} **${user.username || 'Unknown'}**\n`;
                desc += `╰ \`${t.level} ${level}\` • \`${user.xp.toLocaleString()} ${t.xp}\`\n`;
                desc += `╰ \`[${bar}]\` **${percent}%**\n\n`;
            });

            return new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({
                    name: `📊 ARCHITECT | ${isFrench ? 'CLASSEMENT SYNC' : 'HIGH-SYNC STANDINGS'}`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setDescription(desc)
                .addFields({
                    name: `🛰️ ${t.pos}`,
                    value: `\`\`\`prolog\n` +
                           `${t.rank}: #${userRank} | ${t.level}: ${userLevel}\n` +
                           `${t.xp}: ${userXP.toLocaleString()}\n` +
                           `${motive}\`\`\``
                })
                .setFooter({
                    text: `Page ${page + 1}/${maxPage + 1} • Eagle Community • v${version}`
                })
                .setTimestamp();
        };

        // Buttons
        const generateButtons = (page) => {
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === maxPage)
                );
        };

        const lbMsg = await message.reply({
            content: `> **${t.scanning}**`,
            embeds: [generateEmbed(0)],
            components: [generateButtons(0)]
        });

        // Collector
        const collector = lbMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === message.author.id,
            time: 60000
        });

        collector.on('collect', async (i) => {
            if (i.customId === 'prev') currentPage--;
            if (i.customId === 'next') currentPage++;
            
            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });

        collector.on('end', () => {
            lbMsg.edit({ components: [] }).catch(() => null);
        });
    }
};

// ================= GAMING LEADERBOARD (Fixed with correct rank icons) =================

async function showGameLeaderboard(client, message, type, db, lang) {
    const isFrench = lang === 'fr';
    
    // Determine sorting order
    let orderBy = 'games_won DESC';
    let title = isFrench ? '═ CLASSEMENT DES VICTOIRES ═' : '═ WINS LEADERBOARD ═';
    let icon = '🏆';
    
    if (['winnings', 'gains', 'argent'].includes(type)) {
        orderBy = 'total_winnings DESC';
        title = isFrench ? '═ CLASSEMENT DES GAINS ═' : '═ WINNINGS LEADERBOARD ═';
        icon = '💰';
    } else if (['wr', 'taux', 'winrate'].includes(type)) {
        orderBy = 'games_won DESC'; // We'll calculate WR manually
        title = isFrench ? '═ CLASSEMENT DU TAUX DE VICTOIRE ═' : '═ WIN RATE LEADERBOARD ═';
        icon = '📈';
    }

    let players;
    
    if (type === 'wr' || type === 'taux' || type === 'winrate') {
        // Fetch all players with games played and calculate WR
        players = db.prepare(`
            SELECT username, games_played, games_won, total_winnings
            FROM users
            WHERE games_played > 0
        `).all();
        
        // Calculate win rate and sort
        players = players.map(p => ({
            ...p,
            winRate: Math.round((p.games_won / p.games_played) * 100)
        })).sort((a, b) => b.winRate - a.winRate).slice(0, 10);
        
        const list = players.map((p, i) => {
            const medal = getRankIcon(i + 1);
            return `${medal} **${p.username || 'Unknown'}** • 📊 ${p.winRate}% WR (${p.games_won}/${p.games_played})`;
        }).join('\n');
        
        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(title)
            .setDescription(`\`\`\`yaml\n${list || 'No data available'}\`\`\``)
            .setFooter({ text: `${icon} Best win rates in the neural arcade` })
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
    
    // Standard gaming leaderboard (wins or winnings)
    players = db.prepare(`
        SELECT username, games_played, games_won, total_winnings
        FROM users
        WHERE games_played > 0
        ORDER BY ${orderBy}
        LIMIT 10
    `).all();

    if (players.length === 0) {
        return message.reply(isFrench ? "📊 Aucune donnée de jeu disponible." : "📊 No gaming data available.");
    }

    const list = players.map((p, i) => {
        const medal = getRankIcon(i + 1);
        const winRate = Math.round((p.games_won / p.games_played) * 100);
        
        if (type === 'winnings' || type === 'gains' || type === 'argent') {
            return `${medal} **${p.username || 'Unknown'}** • 💰 ${(p.total_winnings || 0).toLocaleString()} 🪙`;
        }
        return `${medal} **${p.username || 'Unknown'}** • 🏆 ${p.games_won} wins • 📊 ${winRate}% WR`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle(title)
        .setDescription(`\`\`\`yaml\n${list}\`\`\``)
        .setFooter({ text: `${icon} Top 10 neural arcade agents` })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}