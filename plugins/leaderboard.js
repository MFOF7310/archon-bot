const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { getMarketState, TRENDS } = require('./market-manager');

function getMarketStatus(guildId) { 
    try { const ms = getMarketState(guildId); const t = TRENDS[ms.trend] || TRENDS.STEADY; return `${t.emoji} ${t.name}`; } 
    catch (e) { return '📊 Steady'; } 
}

function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; 
}

const lbTranslations = {
    en: {
        title: '🏆 NEURAL LEADERBOARD',
        subtitle: 'Top Synchronized Agents', yourRank: 'Your Rank', notRanked: 'Not Ranked',
        xpColumn: 'XP', levelColumn: 'LVL', creditsColumn: 'CREDITS', messagesColumn: 'MSG', rankColumn: 'RANK', nameColumn: 'AGENT',
        leaderboardFor: 'Leaderboard for', overall: 'Overall', refreshBtn: 'REFRESH', myRankBtn: 'MY RANK', profileBtn: 'PROFILE',
        firstPlace: '🥇', secondPlace: '🥈', thirdPlace: '🥉', otherPlace: (n) => `\`#${n}\``, totalAgents: 'Total Agents', serverStats: 'Server Stats', marketStatus: 'Market Status', nextMarket: 'Next Market Update', avgLevel: 'Avg Level', serverName: 'Server',
        page: 'PAGE', of: 'OF', topWinners: '🏆 TOP WINNERS', topGainers: '📈 TOP GAINERS', topDaily: '🔥 DAILY STREAK', topMessages: '💬 MESSAGES',
        loading: '⏳ Loading leaderboard...', error: '❌ Error loading leaderboard.', noData: 'No data available for this leaderboard.', notInGuild: '❌ This command must be used in a server.',
        verifyWith: 'Verify with', checkBalance: (prefix) => `Check your balance with \`${prefix}bal\` or \`${prefix}credits\``,
        navLabel: 'NAVIGATION', viewServer: '🖥️ VIEW SERVER', footer: 'NEURAL LEADERBOARD', rankUp: 'RANK UP',
        topActive: '🔥 TOP ACTIVE', topInvestors: '📈 TOP INVESTORS', topGamers: '🎮 TOP GAMERS', topRich: '💰 TOP RICH'
    },
    fr: {
        title: '🏆 CLASSEMENT NEURAL', subtitle: 'Meilleurs Agents Synchronisés', yourRank: 'Votre Rang', notRanked: 'Non Classé',
        xpColumn: 'XP', levelColumn: 'NIV', creditsColumn: 'CRÉDITS', messagesColumn: 'MSG', rankColumn: 'RANG', nameColumn: 'AGENT',
        leaderboardFor: 'Classement pour', overall: 'Général', refreshBtn: 'RAFRAÎCHIR', myRankBtn: 'MON RANG', profileBtn: 'PROFIL',
        firstPlace: '🥇', secondPlace: '🥈', thirdPlace: '🥉', otherPlace: (n) => `\`#${n}\``, totalAgents: 'Agents Totaux', serverStats: 'Stats du Serveur', marketStatus: 'État du Marché', nextMarket: 'Prochaine MàJ', avgLevel: 'Niv Moy', serverName: 'Serveur',
        page: 'PAGE', of: 'SUR', topWinners: '🏆 TOP GAGNANTS', topGainers: '📈 TOP GAINS', topDaily: '🔥 SÉRIE QUOTIDIENNE', topMessages: '💬 MESSAGES',
        loading: '⏳ Chargement du classement...', error: '❌ Erreur de chargement.', noData: 'Aucune donnée pour ce classement.', notInGuild: '❌ Cette commande doit être utilisée dans un serveur.',
        verifyWith: 'Vérifiez avec', checkBalance: (prefix) => `Vérifiez avec \`${prefix}bal\` ou \`${prefix}credits\``,
        navLabel: 'NAVIGATION', viewServer: '🖥️ VOIR SERVEUR', footer: 'CLASSEMENT NEURAL', rankUp: 'PROMOTION',
        topActive: '🔥 PLUS ACTIFS', topInvestors: '📈 TOP INVESTISSEURS', topGamers: '🎮 TOP JOUEURS', topRich: '💰 PLUS RICHES'
    }
};

const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

function getRank(level) { 
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1]; 
}

module.exports = {
    name: 'leaderboard', aliases: ['lb', 'top', 'classement', 'rich', 'richest', 'winners', 'gainers'],
    description: '🏆 View the neural leaderboard — XP, levels, credits, messages, and more!',
    category: 'ECONOMY', usage: '.leaderboard [type]', examples: ['.lb', '.lb xp', '.lb credits', '.lb messages'], cooldown: 5000,

    data: new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Neural Leaderboard')
        .addStringOption(o => o.setName('type').setDescription('Leaderboard type').setRequired(false)
            .addChoices({ name: 'XP', value: 'xp' }, { name: 'Credits', value: 'credits' }, { name: 'Messages', value: 'messages' }, { name: 'Daily Streak', value: 'streak' }, { name: 'Games Won', value: 'wins' })),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = lbTranslations[lang];
        const prefix = serverSettings?.prefix || '.';
        const version = client.version || '2.0.0';

        if (!message.guild) return message.reply(t.notInGuild);

        // PER-SERVER: Extract guildId for composite key filtering
        const guildId = message.guild.id;
        const guildName = message.guild.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
        const userId = message.author.id;

        const type = (args[0] || 'xp').toLowerCase();
        const validTypes = ['xp', 'credits', 'messages', 'msg', 'streak', 'daily', 'wins', 'games'];
        const sortType = validTypes.includes(type) ? type : 'xp';

        let orderCol = 'xp';
        if (sortType === 'credits') orderCol = 'credits';
        else if (sortType === 'messages' || sortType === 'msg') orderCol = 'total_messages';
        else if (sortType === 'streak' || sortType === 'daily') orderCol = 'streak_days';
        else if (sortType === 'wins' || sortType === 'games') orderCol = 'games_won';

        // ================= PER-SERVER QUERY: WHERE guild_id = ? =================
        const entries = db.prepare(`SELECT username, xp, credits, level, total_messages, streak_days, games_won, id 
            FROM users WHERE guild_id = ? ORDER BY ${orderCol} DESC LIMIT 20`).all(guildId);

        if (entries.length === 0) {
            const embed = new EmbedBuilder().setColor('#ED4245').setDescription(t.noData)
                .setFooter({ text: `${t.footer} • ${guildName} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // Server stats
        const stats = db.prepare("SELECT COUNT(*) as count, AVG(level) as avg_level, SUM(xp) as total_xp FROM users WHERE guild_id = ?").get(guildId);

        // Build leaderboard list
        const medals = [t.firstPlace, t.secondPlace, t.thirdPlace];
        let list = '';
        entries.slice(0, 15).forEach((entry, i) => {
            const medal = medals[i] || t.otherPlace(i + 1);
            const level = entry.level || calculateLevel(entry.xp);
            const rank = getRank(level);
            const xpVal = entry.xp || 0;
            const creditsVal = entry.credits || 0;
            const msgsVal = entry.total_messages || 0;
            const streakVal = entry.streak_days || 0;
            const winsVal = entry.games_won || 0;

            let extra = '';
            if (sortType === 'credits') extra = `💰 ${(creditsVal).toLocaleString()}`;
            else if (sortType === 'messages' || sortType === 'msg') extra = `💬 ${(msgsVal).toLocaleString()}`;
            else if (sortType === 'streak' || sortType === 'daily') extra = `🔥 ${streakVal}d`;
            else if (sortType === 'wins' || sortType === 'games') extra = `🏆 ${winsVal}`;
            else extra = `⭐ Lv.${level} • ${(xpVal).toLocaleString()} XP`;

            list += `${medal} **${entry.username || 'Unknown'}** ${rank.emoji} • ${extra}\n`;
        });

        // User's rank
        let userRank = t.notRanked;
        const allUsers = db.prepare(`SELECT id FROM users WHERE guild_id = ? ORDER BY ${orderCol} DESC`).all(guildId).map(r => r.id);
        const userIndex = allUsers.indexOf(userId);
        if (userIndex !== -1) userRank = `#${userIndex + 1} / ${allUsers.length}`;

        const embed = new EmbedBuilder().setColor('#FEE75C')
            .setAuthor({ name: `🏆 ${t.title}`, iconURL: guildIcon })
            .setTitle(`${t.subtitle}`)
            .setDescription(`\`\`\`yaml\n${list}\`\`\``)
            .addFields(
                { name: `📊 ${t.totalAgents}`, value: `${stats?.count || 0}`, inline: true },
                { name: `📈 ${t.avgLevel}`, value: `${(stats?.avg_level || 0).toFixed(1)}`, inline: true },
                { name: `📊 ${t.yourRank}`, value: `**${userRank}**`, inline: true }
            )
            .setFooter({ text: `${t.leaderboardFor} ${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lb_refresh').setLabel(t.refreshBtn).setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('lb_myrank').setLabel(t.myRankBtn).setStyle(ButtonStyle.Primary).setEmoji('📊'),
            new ButtonBuilder().setCustomId('lb_profile').setLabel(t.profileBtn).setStyle(ButtonStyle.Success).setEmoji('👤')
        );

        const sent = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
        if (!sent) return;

        const collector = sent.createMessageComponentCollector({ filter: (i) => i.user.id === userId, time: 60000 });
        collector.on('collect', async (i) => {
            await i.deferUpdate().catch(() => {});
            if (i.customId === 'lb_refresh') {
                return module.exports.run(client, message, args, db, serverSettings, usedCommand);
            } else if (i.customId === 'lb_myrank') {
                const uData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
                if (uData) {
                    const lv = uData.level || calculateLevel(uData.xp);
                    const rank = getRank(lv);
                    const rankEmbed = new EmbedBuilder().setColor(rank.color)
                        .setAuthor({ name: `📊 ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
                        .setDescription(`\`\`\`yaml\nRank: ${userRank}\nLevel: ${lv}\nXP: ${(uData.xp || 0).toLocaleString()}\nCredits: ${(uData.credits || 0).toLocaleString()}\nMessages: ${(uData.total_messages || 0).toLocaleString()}\nStreak: ${uData.streak_days || 0}d\nGames Won: ${uData.games_won || 0}\n\`\`\``)
                        .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
                    await i.followUp({ embeds: [rankEmbed], ephemeral: true }).catch(() => {});
                }
            } else if (i.customId === 'lb_profile') {
                const profileCmd = client.commands.get('profile') || client.commands.get('rank');
                if (profileCmd) profileCmd.run(client, message, [], db, serverSettings, 'profile');
            }
        });
    },

    execute: async (interaction, client) => {
        const type = interaction.options.getString('type') || 'xp';
        const fakeMsg = { author: interaction.user, guild: interaction.guild, channel: interaction.channel,
            reply: async (opts) => interaction.reply({ ...opts, fetchReply: true }).catch(() => null) };
        const settings = interaction.guild ? client.getServerSettings?.(interaction.guild.id) || {} : {};
        await module.exports.run(client, fakeMsg, [type], client.db, settings, 'leaderboard');
    }
};
