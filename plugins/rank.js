const { EmbedBuilder } = require('discord.js');

// --- UNIFIED AGENT RANKS (Matches games.js & profile.js) ---
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

function getAgentRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1];
}

function createProgressBar(percent, length = 12) {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    fr: {
        title: (name) => `📜 DOSSIER AGENT: ${name.toUpperCase()}`,
        node: 'Nœud',
        status: 'Statut',
        syncOk: '🟢 SYNC_OK',
        classification: 'Classification',
        syncTelemetry: '📊 TÉLÉMÉTRIE NEURALE',
        level: 'Niveau',
        rank: 'Classement',
        total: 'Total',
        xp: 'XP',
        messages: 'Messages',
        games: 'Parties',
        winRate: '% VICTOIRES',
        progress: '🚀 PROGRESSION',
        syncGap: 'XP requis',
        combat: '🎮 MATRICE DE COMBAT',
        primarySector: 'SECTEUR PRINCIPAL',
        combatMode: 'MODE COMBAT',
        rankTier: 'RANG/ÉCHELON',
        awaiting: 'EN_ATTENTE_DE_DONNÉES',
        setGame: 'Utilisez .setgame',
        noData: (name) => `❌ **Agent ${name}** n'a aucune donnée enregistrée dans le système.`,
        agentSince: 'Agent depuis',
        neuralEfficiency: 'Efficacité Neurale',
        commandStats: 'STATS COMMANDES',
        dailyStreak: 'Série Quotidienne',
        credits: 'Crédits',
        wealthTier: 'Niveau de Richesse',
        architectTitle: '🏛️ RECONNAISSANCE ARCHITECTE',
        architectValue: 'Le Créateur marche parmi nous. Le Système honore son Architecte.',
        digitalSovereignty: 'SOUVERAINETÉ NUMÉRIQUE'
    },
    en: {
        title: (name) => `📜 AGENT DOSSIER: ${name.toUpperCase()}`,
        node: 'Node',
        status: 'Status',
        syncOk: '🟢 SYNC_OK',
        classification: 'Classification',
        syncTelemetry: '📊 NEURAL TELEMETRY',
        level: 'Level',
        rank: 'Rank',
        total: 'Total',
        xp: 'XP',
        messages: 'Messages',
        games: 'Games',
        winRate: 'WIN %',
        progress: '🚀 PROGRESS',
        syncGap: 'XP needed',
        combat: '🎮 COMBAT MATRIX',
        primarySector: 'PRIMARY SECTOR',
        combatMode: 'COMBAT MODE',
        rankTier: 'RANK/TIER',
        awaiting: 'AWAITING_DATA',
        setGame: 'Use .setgame',
        noData: (name) => `❌ **Agent ${name}** has no recorded data in the system.`,
        agentSince: 'Agent Since',
        neuralEfficiency: 'Neural Efficiency',
        commandStats: 'COMMAND STATS',
        dailyStreak: 'Daily Streak',
        credits: 'Credits',
        wealthTier: 'Wealth Tier',
        architectTitle: '🏛️ ARCHITECT RECOGNITION',
        architectValue: 'The Creator walks among us. System honors its Architect.',
        digitalSovereignty: 'DIGITAL SOVEREIGNTY'
    }
};

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp', 'rang', 'niveau', 'dossier', 'agent'],
    description: '📊 Display neural synchronization level and agent dossier.',
    category: 'PROFILE',
    usage: '.rank [@user]',
    cooldown: 3000,
    examples: ['.rank', '.rank @user'],

    // ✅ MODIFIED: Added serverSettings as 5th argument
    run: async (client, message, args, db, serverSettings) => {

        // ✅ MODIFIED: Use server-specific language from settings
        const lang = serverSettings?.language || 'en';
        const t = translations[lang];
        
        // ✅ MODIFIED: Dynamic version from client
        const version = client.version || '1.5.0';
        
        // ✅ MODIFIED: Dynamic node name (Global Identity Rule)
        const nodeName = message.guild?.name || 'NEURAL_NODE';

        const target = message.mentions.users.first() || message.author;

        const userData = db.prepare(`
            SELECT id, xp, credits, streak_days, created_at, 
                   games_played, games_won, total_messages, total_winnings, gaming
            FROM users WHERE id = ?
        `).get(target.id);

        if (!userData) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.noData(target.username))
                .setFooter({
                    text: `${nodeName.toUpperCase()} • v${version}`,
                    iconURL: message.guild?.iconURL() || client.user.displayAvatarURL()
                })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }

        const xp = userData.xp || 0;
        const level = calculateLevel(xp);
        const agentRank = getAgentRank(level);
        
        const credits = userData.credits || 0;
        const streakDays = userData.streak_days || 0;
        const totalWinnings = userData.total_winnings || 0;
        const gamesPlayed = userData.games_played || 0;
        const gamesWon = userData.games_won || 0;
        const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
        const totalMessages = userData.total_messages || 0;
        
        const createdAt = userData.created_at ? new Date(userData.created_at) : new Date();
        const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        const rankData = db.prepare("SELECT COUNT(*) as rank FROM users WHERE xp > ?").get(xp);
        const rank = (rankData?.rank || 0) + 1;
        const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get()?.count || 1;
        
        const currentLevelXP = Math.pow((level - 1) / 0.1, 2);
        const nextLevelXP = Math.pow(level / 0.1, 2);
        const xpForCurrentLevel = xp - currentLevelXP;
        const xpNeededForNext = nextLevelXP - currentLevelXP;
        const percent = Math.min(100, Math.max(0, (xpForCurrentLevel / xpNeededForNext) * 100));
        const xpRemaining = Math.ceil(nextLevelXP - xp);
        const progressBar = createProgressBar(percent, 15);
        
        const neuralEfficiency = Math.min(100, Math.floor((gamesPlayed * 0.5) + (totalMessages * 0.1) + (streakDays * 2)));
        
        let gamingData = { game: "CODM", rank: "Unranked", mode: "Standard" };
        if (userData.gaming) {
            try { gamingData = JSON.parse(userData.gaming); } catch (e) { }
        }
        
        const combatMatrixValue = `\`\`\`yaml\n${t.primarySector}: ${gamingData.game}\n${t.combatMode}: ${gamingData.mode}\n${t.rankTier}: ${gamingData.rank}\`\`\``;
        
        const dossierEmbed = new EmbedBuilder()
            .setColor(agentRank.color)
            .setAuthor({
                name: t.title(target.username),
                iconURL: target.displayAvatarURL({ dynamic: true })
            })
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(
                `\`\`\`prolog\n` +
                // ✅ MODIFIED: Using dynamic node name (Global Identity Rule)
                `${t.node}: ${nodeName.toUpperCase()} • ${t.status}: ${t.syncOk}\n` +
                `${t.classification}: ${agentRank.emoji} ${agentRank.title[lang]}\n` +
                `Core: Groq LPU™ 70B\`\`\``
            )
            .addFields(
                {
                    name: t.syncTelemetry,
                    value: `\`\`\`ansi\n` +
                           `\u001b[1;36m▣\u001b[0m ${t.level}: ${level}\n` +
                           `\u001b[1;34m▣\u001b[0m ${t.rank}: #${rank}/${totalUsers}\n` +
                           `\u001b[1;32m▣\u001b[0m ${t.total}: ${xp.toLocaleString()} ${t.xp}\n` +
                           `\u001b[1;33m▣\u001b[0m ${t.messages}: ${totalMessages.toLocaleString()}\n` +
                           `\u001b[1;35m▣\u001b[0m ${t.games}: ${gamesPlayed.toLocaleString()} (${winRate}% ${t.winRate})\`\`\``,
                    inline: false
                },
                {
                    name: `💰 ${t.credits}`,
                    value: `**${credits.toLocaleString()}** 🪙`,
                    inline: true
                },
                {
                    name: `🔥 ${t.dailyStreak}`,
                    value: `**${streakDays}** ${lang === 'fr' ? 'jours' : 'days'}`,
                    inline: true
                },
                {
                    name: `🏆 ${t.total}`,
                    value: `**${totalWinnings.toLocaleString()}** 🪙 ${lang === 'fr' ? 'gagnés' : 'won'}`,
                    inline: true
                },
                {
                    name: `🚀 ${t.progress}`,
                    value: `\`\`\`\n${progressBar} ${percent.toFixed(1)}%\n└─ ${t.syncGap}: ${xpRemaining.toLocaleString()} XP\`\`\``,
                    inline: false
                },
                {
                    name: `🧠 ${t.neuralEfficiency}`,
                    value: `**${neuralEfficiency}%** ${lang === 'fr' ? '• Niveau optimal' : '• Optimal level'}`,
                    inline: true
                },
                {
                    name: `📅 ${t.agentSince}`,
                    value: `<t:${Math.floor(createdAt.getTime() / 1000)}:R>\n└─ ${accountAgeDays} ${lang === 'fr' ? 'jours' : 'days'}`,
                    inline: true
                },
                {
                    name: t.combat,
                    value: combatMatrixValue,
                    inline: false
                }
            )
            // ✅ MODIFIED: Dynamic footer with server identity (Global Identity Rule)
            .setFooter({
                text: `${nodeName.toUpperCase()} • ${t.digitalSovereignty} • v${version}`,
                iconURL: message.guild?.iconURL() || client.user.displayAvatarURL()
            })
            .setTimestamp();

        const ARCHITECT_ID = process.env.OWNER_ID;
        if (target.id === ARCHITECT_ID) {
            dossierEmbed.addFields({
                name: t.architectTitle,
                value: t.architectValue,
                inline: false
            });
        }

        message.reply({ embeds: [dossierEmbed] });
    }
};