const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// ================= UNIFIED AGENT RANKS =================
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

// ================= WEALTH TIERS =================
const WEALTH_TIERS = [
    { minCredits: 0, title: { fr: "SANS LE SOU", en: "BROKE" }, emoji: "💀", color: "#95a5a6" },
    { minCredits: 100, title: { fr: "PETIT PORTEFEUILLE", en: "SMALL WALLET" }, emoji: "🪙", color: "#7f8c8d" },
    { minCredits: 1000, title: { fr: "COLLECTIONNEUR", en: "COLLECTOR" }, emoji: "💰", color: "#f1c40f" },
    { minCredits: 5000, title: { fr: "INVESTISSEUR", en: "INVESTOR" }, emoji: "📈", color: "#e67e22" },
    { minCredits: 15000, title: { fr: "BARON", en: "BARON" }, emoji: "🏦", color: "#3498db" },
    { minCredits: 50000, title: { fr: "MAGNAT", en: "MAGNATE" }, emoji: "👑", color: "#9b59b6" },
    { minCredits: 100000, title: { fr: "LÉGENDE", en: "LEGEND" }, emoji: "🏆", color: "#e74c3c" }
];

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

function getAgentRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1];
}

function getWealthTier(credits) {
    return [...WEALTH_TIERS].reverse().find(t => credits >= t.minCredits) || WEALTH_TIERS[0];
}

function createProgressBar(percent, length = 15) {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
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
        awaiting: 'EN_ATTENTE',
        setGame: 'Utilisez .setgame',
        noData: (name) => `❌ **Agent ${name}** n'a aucune donnée enregistrée.`,
        agentSince: 'Agent depuis',
        neuralEfficiency: 'Efficacité Neurale',
        dailyStreak: '🔥 Série Quotidienne',
        credits: '💰 Crédits',
        wealthTier: 'Niveau de Richesse',
        architectTitle: '🏛️ RECONNAISSANCE ARCHITECTE',
        architectValue: 'Le Créateur marche parmi nous. Le Système honore son Architecte.',
        digitalSovereignty: 'SOUVERAINETÉ NUMÉRIQUE',
        totalWinnings: 'Gains Totaux',
        winLoss: 'Victoires/Défaites'
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
        awaiting: 'AWAITING',
        setGame: 'Use .setgame',
        noData: (name) => `❌ **Agent ${name}** has no recorded data.`,
        agentSince: 'Agent Since',
        neuralEfficiency: 'Neural Efficiency',
        dailyStreak: '🔥 Daily Streak',
        credits: '💰 Credits',
        wealthTier: 'Wealth Tier',
        architectTitle: '🏛️ ARCHITECT RECOGNITION',
        architectValue: 'The Creator walks among us. System honors its Architect.',
        digitalSovereignty: 'DIGITAL SOVEREIGNTY',
        totalWinnings: 'Total Winnings',
        winLoss: 'Wins/Losses'
    }
};

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp', 'rang', 'niveau', 'dossier', 'agent', 'profil'],
    description: '📊 Display neural synchronization level and agent dossier.',
    category: 'PROFILE',
    usage: '.rank [@user]',
    cooldown: 3000,
    examples: ['.rank', '.rank @user'],

// ================= SLASH COMMAND DATA =================
data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('📊 Display neural synchronization level and agent dossier')
    .addUserOption(option =>
        option.setName('agent')
            .setDescription('Agent to inspect (leave empty for your own dossier)')
            .setRequired(false)
    ),

// 🔥 NEW SIGNATURE: 6 parameters with usedCommand
run: async (client, message, args, db, serverSettings, usedCommand) => {

        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        const t = translations[lang];
        
        const version = client.version || '1.6.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();

        const target = message.mentions.users.first() || message.author;

        // 🔥 RAM-FIRST CACHE
        let userData = client.getUserData 
            ? client.getUserData(target.id) 
            : db.prepare(`SELECT id, xp, credits, streak_days, created_at, games_played, games_won, total_messages, total_winnings, gaming, level FROM users WHERE id = ?`).get(target.id);

        if (!userData) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.noData(target.username))
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }

        const xp = userData.xp || 0;
        const level = userData.level || calculateLevel(xp);
        const agentRank = getAgentRank(level);
        
        const credits = userData.credits || 0;
        const wealthTier = getWealthTier(credits);
        const streakDays = userData.streak_days || 0;
        const totalWinnings = userData.total_winnings || 0;
        const gamesPlayed = userData.games_played || 0;
        const gamesWon = userData.games_won || 0;
        const gamesLost = gamesPlayed - gamesWon;
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
            try { gamingData = JSON.parse(userData.gaming); } catch (e) {}
        }
        
        const dossierEmbed = new EmbedBuilder()
            .setColor(agentRank.color)
            .setAuthor({
                name: t.title(target.username),
                iconURL: target.displayAvatarURL({ dynamic: true })
            })
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.node}: ${guildName}\n` +
                `${t.status}: ${t.syncOk}\n` +
                `${t.classification}: ${agentRank.emoji} ${agentRank.title[lang]}\n` +
                `Core: Groq LPU™ 70B\`\`\``
            )
            .addFields(
                {
                    name: t.syncTelemetry,
                    value: `\`\`\`yaml\n` +
                           `${t.level}: ${level}\n` +
                           `${t.rank}: #${rank}/${totalUsers}\n` +
                           `${t.xp}: ${xp.toLocaleString()}\n` +
                           `${t.messages}: ${totalMessages.toLocaleString()}\n` +
                           `${t.games}: ${gamesPlayed.toLocaleString()} (${winRate}%)\`\`\``,
                    inline: true
                },
                {
                    name: `💰 ${t.credits}`,
                    value: `\`\`\`yaml\n${t.credits}: ${credits.toLocaleString()} 🪙\n${t.wealthTier}: ${wealthTier.emoji} ${wealthTier.title[lang]}\n${t.totalWinnings}: ${totalWinnings.toLocaleString()} 🪙\`\`\``,
                    inline: true
                },
                {
                    name: t.progress,
                    value: `\`\`\`\n${progressBar} ${percent.toFixed(1)}%\n└─ ${xpRemaining.toLocaleString()} XP ${t.syncGap}\`\`\``,
                    inline: false
                },
                {
                    name: `🔥 ${t.dailyStreak}`,
                    value: `\`${streakDays}\` ${lang === 'fr' ? 'jours' : 'days'}`,
                    inline: true
                },
                {
                    name: `🧠 ${t.neuralEfficiency}`,
                    value: `\`${neuralEfficiency}%\``,
                    inline: true
                },
                {
                    name: `⚔️ ${t.winLoss}`,
                    value: `\`${gamesWon}/${gamesLost}\``,
                    inline: true
                },
                {
                    name: `📅 ${t.agentSince}`,
                    value: `<t:${Math.floor(createdAt.getTime() / 1000)}:R>\n└─ ${accountAgeDays} ${lang === 'fr' ? 'jours' : 'days'}`,
                    inline: true
                },
                {
                    name: t.combat,
                    value: `\`\`\`yaml\n${t.primarySector}: ${gamingData.game}\n${t.combatMode}: ${gamingData.mode}\n${t.rankTier}: ${gamingData.rank}\`\`\``,
                    inline: false
                }
            )
            .setFooter({
                text: `${guildName} • ${t.digitalSovereignty} • v${version}`,
                iconURL: guildIcon
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

                return message.reply({ embeds: [dossierEmbed] }).catch(() => {});
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const targetUser = interaction.options.getUser('agent') || interaction.user;
        const args = targetUser.id !== interaction.user.id ? [targetUser.id] : [];
        
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            mentions: {
                users: targetUser.id !== interaction.user.id ? new Map([[targetUser.id, targetUser]]) : new Map()
            },
            reply: async (options) => {
                if (interaction.deferred) return interaction.editReply(options);
                return interaction.reply(options);
            },
            react: () => Promise.resolve()
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        
        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, 'rank');
    }
};