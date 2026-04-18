const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, SlashCommandBuilder } = require('discord.js');

// ================= SYNCED HELPERS =================

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

function calculateProgress(xp, level) {
    const xpCurrent = Math.pow((level - 1) / 0.1, 2);
    const xpNext = Math.pow(level / 0.1, 2);
    const percent = Math.floor(((xp - xpCurrent) / (xpNext - xpCurrent)) * 100);
    return Math.max(0, Math.min(percent, 100));
}

function createProgressBar(percent, length = 12) {
    const filled = Math.floor((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function getRankIcon(rank, useAnimated = true) {
    // ===== CUSTOM ANIMATED EMOJIS (Replace with your IDs later) =====
    const ANIMATED = {
        1: '<a:gold1:000000000000000000>',      // Will fallback to 🥇
        2: '<a:silver2:000000000000000000>',    // Will fallback to 🥈
        3: '<a:bronze3:000000000000000000>',    // Will fallback to 🥉
        top10: '<a:elite:000000000000000000>',  // Will fallback to 💠
        top50: '<a:veteran:000000000000000000>', // Will fallback to 🔹
        default: '<a:agent:000000000000000000>'  // Will fallback to ▪️
    };
    
    // ===== UNICODE FALLBACKS (Always works) =====
    const UNICODE = {
        1: '🥇',
        2: '🥈', 
        3: '🥉',
        top10: '💠',
        top50: '🔹',
        default: '▪️'
    };
    
    // Smart selection with fallback detection
    const getEmoji = (key) => {
        const animated = ANIMATED[key];
        // If emoji ID is all zeros (placeholder), use unicode
        if (!useAnimated || animated.includes('000000000000000000')) {
            return UNICODE[key];
        }
        return animated;
    };
    
    if (rank === 1) return getEmoji(1);
    if (rank === 2) return getEmoji(2);
    if (rank === 3) return getEmoji(3);
    if (rank <= 10) return getEmoji('top10');
    if (rank <= 50) return getEmoji('top50');
    return getEmoji('default');
}

// ================= AGENT RANKS (For display consistency) =================
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

function getAgentRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1];
}

// ================= BILINGUAL TRANSLATIONS =================

const LANG = {
    fr: {
        dmError: "❌ **ERREUR:** Cette commande ne peut être utilisée qu'en serveur. Les classements sont liés à la synergie collective.",
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
        rank: "Rang",
        page: "Page",
        highSync: "HAUTE-SYNC",
        active: "ACTIF",
        noData: "Aucune donnée de jeu disponible.",
        bestWinRates: "Meilleurs taux de victoire dans l'arcade neurale",
        top10Agents: "Top 10 agents de l'arcade neurale",
        wins: "victoires",
        credits: "Crédits",
        rankTitle: "Titre",
        progress: "Progression"
    },
    en: {
        dmError: "❌ **ERROR:** This command can only be used in a server. Leaderboards are tied to collective synergy.",
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
        rank: "Rank",
        page: "Page",
        highSync: "HIGH-SYNC",
        active: "ACTIVE",
        noData: "No gaming data available.",
        bestWinRates: "Best win rates in the neural arcade",
        top10Agents: "Top 10 neural arcade agents",
        wins: "wins",
        credits: "Credits",
        rankTitle: "Title",
        progress: "Progress"
    }
};

// ================= GAMING LEADERBOARD FUNCTION =================

async function showGameLeaderboard(client, message, type, db, lang, t, guildName, guildIcon, version) {
    
    let orderBy = 'games_won DESC';
    let title = lang === 'fr' ? '═ CLASSEMENT DES VICTOIRES ═' : '═ WINS LEADERBOARD ═';
    let icon = '🏆';
    
    if (['winnings', 'gains', 'argent'].includes(type)) {
        orderBy = 'total_winnings DESC';
        title = lang === 'fr' ? '═ CLASSEMENT DES GAINS ═' : '═ WINNINGS LEADERBOARD ═';
        icon = '💰';
    } else if (['wr', 'taux', 'winrate'].includes(type)) {
        title = lang === 'fr' ? '═ CLASSEMENT DU TAUX DE VICTOIRE ═' : '═ WIN RATE LEADERBOARD ═';
        icon = '📈';
    }

    let players;
    
    // ===== WIN RATE LEADERBOARD =====
    if (type === 'wr' || type === 'taux' || type === 'winrate') {
        players = db.prepare(`
            SELECT username, games_played, games_won, total_winnings, xp
            FROM users
            WHERE games_played > 0
        `).all();
        
        if (players.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.noData)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [emptyEmbed] }).catch(() => {});
        }
        
        players = players.map(p => ({
            ...p,
            winRate: Math.round((p.games_won / p.games_played) * 100)
        })).sort((a, b) => b.winRate - a.winRate).slice(0, 10);
        
        const list = players.map((p, i) => {
            const rank = i + 1;
            const medal = getRankIcon(rank);
            const spacing = rank === 1 ? '  ' : rank <= 3 ? ' ' : '';
            const usernameDisplay = rank === 1 ? `**${p.username || 'Unknown'}**` : p.username || 'Unknown';
            const level = calculateLevel(p.xp || 0);
            const rankObj = getAgentRank(level);
            
            return `${medal}${spacing}${usernameDisplay} ${rankObj.emoji} • 📊 ${p.winRate}% WR (${p.games_won}/${p.games_played})`;
        }).join('\n');
        
        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(title)
            .setDescription(`\`\`\`yaml\n${list || 'No data available'}\`\`\``)
            .setFooter({ 
                text: `${guildName} • ${icon} ${t.bestWinRates} • v${version}`,
                iconURL: guildIcon
            })
            .setTimestamp();
        
        return message.reply({ embeds: [embed] }).catch(() => {});
    }
    
    // ===== WINS & WINNINGS LEADERBOARD =====
    players = db.prepare(`
        SELECT username, games_played, games_won, total_winnings, xp
        FROM users
        WHERE games_played > 0
        ORDER BY ${orderBy}
        LIMIT 10
    `).all();

    if (players.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setDescription(t.noData)
            .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        return message.reply({ embeds: [emptyEmbed] }).catch(() => {});
    }

    const list = players.map((p, i) => {
        const rank = i + 1;
        const medal = getRankIcon(rank);
        const spacing = rank === 1 ? '  ' : rank <= 3 ? ' ' : '';
        const usernameDisplay = rank === 1 ? `**${p.username || 'Unknown'}**` : p.username || 'Unknown';
        const level = calculateLevel(p.xp || 0);
        const rankObj = getAgentRank(level);
        const winRate = p.games_played > 0 ? Math.round((p.games_won / p.games_played) * 100) : 0;
        
        if (type === 'winnings' || type === 'gains' || type === 'argent') {
            return `${medal}${spacing}${usernameDisplay} ${rankObj.emoji} • 💰 ${(p.total_winnings || 0).toLocaleString()} 🪙`;
        }
        return `${medal}${spacing}${usernameDisplay} ${rankObj.emoji} • 🏆 ${p.games_won} ${t.wins} • 📊 ${winRate}% WR`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle(title)
        .setDescription(`\`\`\`yaml\n${list}\`\`\``)
        .setFooter({ 
            text: `${guildName} • ${icon} ${t.top10Agents} • v${version}`,
            iconURL: guildIcon
        })
        .setTimestamp();

    return message.reply({ embeds: [embed] }).catch(() => {});
}

// ================= MAIN COMMAND =================

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'rankings', 'classement', 'paliers'],
    category: 'SYSTEM',
    description: '📊 Display neural synchronization leaderboard with gaming stats.',
    usage: '.leaderboard [games/wins/winnings]',
    cooldown: 5000,
    examples: ['.leaderboard', '.leaderboard games', '.leaderboard winnings'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('📊 Display neural synchronization leaderboard with gaming stats')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of leaderboard')
                .setRequired(false)
                .addChoices(
                    { name: '🏆 XP (Default)', value: 'xp' },
                    { name: '🎮 Games Won', value: 'wins' },
                    { name: '💰 Winnings', value: 'winnings' },
                    { name: '📈 Win Rate', value: 'wr' }
                )
        ),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // ===== DM FALLBACK PROTECTION =====
        if (!message.guild) {
            const lang = client.detectLanguage 
                ? client.detectLanguage(usedCommand, 'en')
                : 'en';
            const t = LANG[lang];
            
            const dmErrorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🏰 SERVER ONLY')
                .setDescription(t.dmError)
                .setFooter({ text: `Neural Core • v${client.version || '1.6.0'}`, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
            
            return message.reply({ embeds: [dmErrorEmbed] }).catch(() => {});
        }
        
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        const t = LANG[lang];
        
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();

        // Gaming triggers
        const sub = args[0]?.toLowerCase();
        const gamingTriggers = [
            'games', 'wins', 'gaming', 'played', 'winnings',
            'gains', 'victoires', 'argent', 'wr', 'taux'
        ];

        if (gamingTriggers.includes(sub)) {
            return showGameLeaderboard(client, message, sub, db, lang, t, guildName, guildIcon, version);
        }

        // 🔥 USE RAM-FIRST CACHE for current user
        const userData = client.getUserData 
            ? client.getUserData(message.author.id) 
            : db.prepare(`SELECT xp FROM users WHERE id = ?`).get(message.author.id);
        
        const userXP = userData?.xp || 0;
        const userLevel = userData?.level || calculateLevel(userXP);
        const userRankData = getAgentRank(userLevel);

        // Fetch leaderboard (Top 100 by XP)
        const entries = db.prepare(`
            SELECT id, username, xp, level
            FROM users
            ORDER BY xp DESC
            LIMIT 100
        `).all();

        if (entries.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.empty)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [emptyEmbed] }).catch(() => {});
        }

        // Total users
        const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;

        // Current user rank
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
            
            let desc = `**NODE:** \`${guildName}\`\n`;
            desc += `**${t.totalAgents}:** \`${totalUsers}\`\n`;
            desc += `**${t.syncStatus}:** \`🟢 ${t.active}\`\n`;
            desc += `**Core:** \`Groq LPU™ 70B\`\n\n`;

            pageEntries.forEach((user, idx) => {
                const globalRank = start + idx + 1;
                const icon = getRankIcon(globalRank);
                const level = user.level || calculateLevel(user.xp);
                const percent = calculateProgress(user.xp, level);
                const bar = createProgressBar(percent, 10);
                const rankObj = getAgentRank(level);

                // Enhanced rank display with proper spacing
                let rankDisplay;
                if (globalRank === 1) {
                    rankDisplay = `${icon}  `;  // Double space for gold
                } else if (globalRank <= 3) {
                    rankDisplay = `${icon} `;    // Single space for silver/bronze
                } else {
                    rankDisplay = `\`#${globalRank.toString().padStart(2, '0')}\` ${icon}`;
                }
                
                // Bold only the #1 spot for extra emphasis
                const usernameDisplay = globalRank === 1 
                    ? `**${user.username || 'Unknown'}**` 
                    : user.username || 'Unknown';

                desc += `${rankDisplay}${usernameDisplay} ${rankObj.emoji}\n`;
                desc += `╰ \`${t.level} ${level}\` • \`${user.xp.toLocaleString()} ${t.xp}\`\n`;
                desc += `╰ \`[${bar}]\` **${percent}%**\n\n`;
            });

            return new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({
                    name: `📊 ARCHITECT | ${lang === 'fr' ? 'CLASSEMENT SYNC' : 'HIGH-SYNC STANDINGS'}`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setDescription(desc)
                .addFields({
                    name: `🛰️ ${t.pos}`,
                    value: `\`\`\`prolog\n` +
                           `${t.rank}: #${userRank} | ${t.level}: ${userLevel}\n` +
                           `${t.rankTitle}: ${userRankData.emoji} ${userRankData.title[lang]}\n` +
                           `${t.xp}: ${userXP.toLocaleString()}\n` +
                           `${motive}\`\`\``
                })
                .setFooter({
                    text: `${guildName} • ${t.highSync} • v${version} • ${t.page} ${page + 1}/${maxPage + 1}`,
                    iconURL: guildIcon
                })
                .setTimestamp();
        };

        // Buttons
        const generateButtons = (page) => {
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('lb_prev')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('lb_page')
                        .setLabel(`${page + 1}/${maxPage + 1}`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('lb_next')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === maxPage)
                );
        };

        const lbMsg = await message.reply({
            content: `> **${t.scanning}**`,
            embeds: [generateEmbed(0)],
            components: [generateButtons(0)]
        }).catch(() => {});

        if (!lbMsg) return;

        // ================= COLLECTOR =================
        const collector = lbMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === message.author.id,
            time: 60000
        });

        collector.on('collect', async (i) => {
            await i.deferUpdate().catch(() => {});
            
            if (i.customId === 'lb_prev') currentPage--;
            if (i.customId === 'lb_next') currentPage++;
            
            await i.editReply({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            }).catch(() => {});
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('lb_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('lb_page').setLabel(`${currentPage + 1}/${maxPage + 1}`).setStyle(ButtonStyle.Primary).setDisabled(true),
                new ButtonBuilder().setCustomId('lb_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(true)
            );
            lbMsg.edit({ components: [disabledRow] }).catch(() => {});
        });
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        
        // ===== DM FALLBACK PROTECTION FOR SLASH =====
        if (!interaction.guild) {
            const lang = client.detectLanguage 
                ? client.detectLanguage('leaderboard', 'en')
                : 'en';
            const t = LANG[lang];
            
            const dmErrorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🏰 SERVER ONLY')
                .setDescription(t.dmError)
                .setFooter({ text: `Neural Core • v${client.version || '1.6.0'}`, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
            
            return interaction.reply({ embeds: [dmErrorEmbed], ephemeral: true }).catch(() => {});
        }
        
        await interaction.deferReply().catch(() => {});
        
        const type = interaction.options.getString('type') || 'xp';
        
        // Map type to args
        let args = [];
        if (type === 'wins') args = ['wins'];
        else if (type === 'winnings') args = ['winnings'];
        else if (type === 'wr') args = ['wr'];
        else args = [];
        
        // Simulate message object for run function
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => {
                if (interaction.deferred) return interaction.editReply(options);
                return interaction.reply(options);
            },
            react: () => Promise.resolve()
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        
        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, 'leaderboard');
    }
};