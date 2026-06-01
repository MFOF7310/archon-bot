const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        scanning: (user) => `> **🔍 Initializing neural handshake... scanning \`${user}\`.**`,
        neuralScan: (user) => `NEURAL SCAN: ${user.toUpperCase()}`,
        nodeIdentification: 'Node Identification',
        clearance: 'Clearance Level',
        syncTelemetry: '📊 SYNC TELEMETRY',
        level: 'Level',
        rank: 'Server Rank',
        xp: 'Experience',
        messages: 'Messages',
        credits: 'Credits',
        wealthTier: 'Wealth Tier',
        streak: 'Daily Streak',
        temporalLogs: '📅 TEMPORAL LOGS',
        arrival: 'Server Arrival',
        account: 'Account Created',
        accountAge: 'Account Age',
        serverPosition: 'Server Position',
        combatMatrix: '🎮 COMBAT MATRIX',
        sector: 'Sector',
        mode: 'Mode',
        combatRank: 'Rank',
        noData: 'STATUS: NO_DATA',
        setGameHint: 'Use .setgame to register your game.',
        authorizations: '📜 AUTHORIZATIONS',
        noRoles: 'No active authorizations.',
        ownerTelemetry: '🛠️ OWNER TELEMETRY',
        flags: 'Account Flags',
        bot: 'Bot Account',
        none: 'None detected',
        progress: '🚀 LEVEL PROGRESS',
        xpNeeded: 'XP needed',
        neuralEfficiency: '🧠 Neural Efficiency',
        lastSeen: 'Last Activity',
        activityBadges: '🏆 ACHIEVEMENT BADGES',
        footer: 'ARCHITECT CG-223 • DIGITAL SOVEREIGNTY • BKO-223',
        clearanceLevels: { owner: '👑 ARCHITECT-01', admin: '🔴 ADMINISTRATOR', moderator: '🟡 MODERATOR', agent: '🔹 FIELD AGENT' },
        gamesPlayed: 'Games Played', winRate: 'Win Rate', totalWinnings: 'Total Winnings',
        // Account age tiers
        ageTiers: [
            { max: 1, label: '👶 Newborn', desc: 'Fresh from the neural hatchery' },
            { max: 7, label: '🌱 Sprout', desc: 'Taking first steps in the network' },
            { max: 30, label: '🌿 Growing', desc: 'Building neural connections' },
            { max: 90, label: '🌳 Rooted', desc: 'Well established in the community' },
            { max: 365, label: '🏛️ Veteran', desc: 'A year of service to the network' },
            { max: Infinity, label: '👴 Ancient', desc: 'Legendary presence since the early days' }
        ],
        // Server join tiers
        joinTiers: [
            { max: 10, label: '💎 FOUNDER', color: '#ffd700' },
            { max: 50, label: '🏅 PIONEER', color: '#e91e63' },
            { max: 100, label: '⚔️ VETERAN', color: '#9b59b6' },
            { max: 500, label: '🛡️ ELITE', color: '#3498db' },
            { max: 1000, label: '🌟 GUARDIAN', color: '#2ecc71' },
            { max: Infinity, label: '👑 LEGEND', color: '#f39c12' }
        ],
        badges: {
            dailyStreak7: '🔥 Week Warrior', dailyStreak30: '⚡ Month Master', dailyStreak100: '🌟 Century Streaker',
            games10: '🎮 Gamer', games50: '🏆 Pro Gamer', games100: '👑 Gaming Legend',
            rich1k: '💰 Thousandaire', rich10k: '🏦 Millionaire', rich100k: '💎 Tycoon',
            level10: '🔹 Neural Knight', level25: '💠 Cyber Specialist', level50: '👑 System Architect',
            active: '📡 Active Agent', investor: '📈 Elite Investor'
        },
        noBadges: 'No badges earned yet. Start engaging to unlock achievements!'
    },
    fr: {
        scanning: (user) => `> **🔍 Initialisation de la poignée neurale... analyse de \`${user}\`.**`,
        neuralScan: (user) => `ANALYSE NEURALE: ${user.toUpperCase()}`,
        nodeIdentification: 'Identification Nœud',
        clearance: "Niveau d'Autorisation",
        syncTelemetry: '📊 TÉLÉMÉTRIE SYNC',
        level: 'Niveau',
        rank: 'Classement Serveur',
        xp: 'Expérience',
        messages: 'Messages',
        credits: 'Crédits',
        wealthTier: 'Niveau Richesse',
        streak: 'Série Quotidienne',
        temporalLogs: '📅 JOURNAUX TEMPORELS',
        arrival: 'Arrivée Serveur',
        account: 'Compte Créé',
        accountAge: 'Âge du Compte',
        serverPosition: 'Position Serveur',
        combatMatrix: '🎮 MATRICE DE COMBAT',
        sector: 'Secteur',
        mode: 'Mode',
        combatRank: 'Rang',
        noData: 'STATUT: AUCUNE DONNÉE',
        setGameHint: 'Utilisez .setgame pour enregistrer votre jeu.',
        authorizations: '📜 AUTORISATIONS',
        noRoles: 'Aucune autorisation active.',
        ownerTelemetry: '🛠️ TÉLÉMÉTRIE PROPRIÉTAIRE',
        flags: 'Drapeaux du Compte',
        bot: 'Compte Bot',
        none: 'Aucun détecté',
        progress: '🚀 PROGRESSION NIVEAU',
        xpNeeded: 'XP requis',
        neuralEfficiency: '🧠 Efficacité Neurale',
        lastSeen: 'Dernière Activité',
        activityBadges: '🏆 BADGES DE RÉUSSITE',
        footer: 'ARCHITECT CG-223 • SOUVERAINETÉ NUMÉRIQUE • BKO-223',
        clearanceLevels: { owner: '👑 ARCHITECTE-01', admin: '🔴 ADMINISTRATEUR', moderator: '🟡 MODÉRATEUR', agent: '🔹 AGENT DE TERRAIN' },
        gamesPlayed: 'Parties Jouées', winRate: 'Taux Victoire', totalWinnings: 'Gains Totaux',
        ageTiers: [
            { max: 1, label: '👶 Nouveau-né', desc: 'Frais sorti de la couveuse neurale' },
            { max: 7, label: '🌱 Jeune pousse', desc: 'Premiers pas dans le réseau' },
            { max: 30, label: '🌿 En croissance', desc: 'Construction des connexions neuronales' },
            { max: 90, label: '🌳 Enraciné', desc: 'Bien établi dans la communauté' },
            { max: 365, label: '🏛️ Vétéran', desc: 'Un an de service au réseau' },
            { max: Infinity, label: '👴 Ancien', desc: 'Présence légendaire depuis les débuts' }
        ],
        joinTiers: [
            { max: 10, label: '💎 FONDATEUR', color: '#ffd700' },
            { max: 50, label: '🏅 PIONNIER', color: '#e91e63' },
            { max: 100, label: '⚔️ VÉTÉRAN', color: '#9b59b6' },
            { max: 500, label: '🛡️ ÉLITE', color: '#3498db' },
            { max: 1000, label: '🌟 GARDIEN', color: '#2ecc71' },
            { max: Infinity, label: '👑 LÉGENDE', color: '#f39c12' }
        ],
        badges: {
            dailyStreak7: '🔥 Guerrier de la Semaine', dailyStreak30: '⚡ Maître du Mois', dailyStreak100: '🌟 Centurion',
            games10: '🎮 Joueur', games50: '🏆 Joueur Pro', games100: '👑 Légende du Jeu',
            rich1k: '💰 Millier', rich10k: '🏦 Millionnaire', rich100k: '💎 Magnat',
            level10: '🔹 Chevalier Neural', level25: '💠 Spécialiste Cyber', level50: '👑 Architecte Système',
            active: '📡 Agent Actif', investor: '📈 Investisseur Élite'
        },
        noBadges: "Aucun badge encore débloqué. Commencez à interagir pour déverrouiller des succès !"
    }
};

// ================= AGENT RANKS =================
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

// ================= WEALTH TIERS =================
const WEALTH_TIERS = [
    { minCredits: 0,      title: { fr: "SANS LE SOU", en: "BROKE" },             emoji: "💀", color: "#95a5a6" },
    { minCredits: 100,    title: { fr: "PETIT PORTEFEUILLE", en: "SMALL WALLET" }, emoji: "🪙", color: "#7f8c8d" },
    { minCredits: 1000,   title: { fr: "COLLECTIONNEUR", en: "COLLECTOR" },       emoji: "💰", color: "#f1c40f" },
    { minCredits: 5000,   title: { fr: "INVESTISSEUR", en: "INVESTOR" },          emoji: "📈", color: "#e67e22" },
    { minCredits: 15000,  title: { fr: "BARON", en: "BARON" },                   emoji: "🏦", color: "#3498db" },
    { minCredits: 50000,  title: { fr: "MAGNAT", en: "MAGNATE" },                 emoji: "👑", color: "#9b59b6" },
    { minCredits: 100000, title: { fr: "LÉGENDE", en: "LEGEND" },                 emoji: "🏆", color: "#e74c3c" }
];

// ================= HELPERS =================
function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; }
function getAgentRank(level) { return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1]; }
function getWealthTier(credits) { return [...WEALTH_TIERS].reverse().find(t => (credits || 0) >= t.minCredits) || WEALTH_TIERS[0]; }
function createProgressBar(percent, length = 15) { const f = Math.round((percent / 100) * length); return '█'.repeat(Math.max(0, f)) + '░'.repeat(Math.max(0, length - f)); }
function getAccountAgeTier(days, tiers) { return tiers.find(t => days <= t.max) || tiers[tiers.length - 1]; }
function getJoinTier(position, tiers) { return tiers.find(t => position <= t.max) || tiers[tiers.length - 1]; }

// ================= BADGE ENGINE =================
function computeBadges(userData, lang) {
    const t = translations[lang];
    const b = [];
    const s = userData || {};
    const streak = s.streak_days || 0;
    const games = s.games_played || 0;
    const credits = s.credits || 0;
    const level = s.level || calculateLevel(s.xp || 0);

    if (streak >= 100) b.push(t.badges.dailyStreak100);
    else if (streak >= 30) b.push(t.badges.dailyStreak30);
    else if (streak >= 7) b.push(t.badges.dailyStreak7);

    if (games >= 100) b.push(t.badges.games100);
    else if (games >= 50) b.push(t.badges.games50);
    else if (games >= 10) b.push(t.badges.games10);

    if (credits >= 100000) b.push(t.badges.rich100k);
    else if (credits >= 10000) b.push(t.badges.rich10k);
    else if (credits >= 1000) b.push(t.badges.rich1k);

    if (level >= 50) b.push(t.badges.level50);
    else if (level >= 25) b.push(t.badges.level25);
    else if (level >= 10) b.push(t.badges.level10);

    if ((s.total_messages || 0) > 100) b.push(t.badges.active);
    if ((s.games_won || 0) > 0) b.push(t.badges.investor);

    return b.length > 0 ? b.join('  ') : t.noBadges;
}

// ================= OWNER FLAGS (safe) =================
function getAccountFlags(user) {
    try {
        const flags = user.flags?.toArray() || [];
        return flags.length > 0 ? flags.join(', ') : 'None';
    } catch (e) { return 'None'; }
}

// ================= MAIN EMBED BUILDER =================
async function buildWhoisEmbed({ client, db, member, targetUser, guild, lang, isOwner }) {
    const t = translations[lang];
    const guildId = guild?.id || 'DM';
    const guildName = guild?.name?.toUpperCase() || 'NEURAL NODE';
    const guildIcon = guild?.iconURL() || client.user.displayAvatarURL();
    const version = client.version || '2.0.0';
    const memberCount = guild?.memberCount || 0;

    // ========== PER-SERVER USER DATA (composite key) ==========
    let userData = null;
    try {
        if (client.getUserData) {
            userData = client.getUserData(targetUser.id, guildId);
        }
    } catch (e) {}

    if (!userData && db) {
        try {
            userData = db.prepare(
                `SELECT xp, level, credits, total_messages, streak_days, games_played, games_won,
                 total_winnings, gaming, created_at, last_seen, username
                 FROM users WHERE id = ? AND guild_id = ?`
            ).get(targetUser.id, guildId);
        } catch (e) {}
    }

    if (!userData && client.getOrCreateUser) {
        try { userData = client.getOrCreateUser(targetUser.id, guildId, targetUser.username); } catch (e) {}
    }

    if (!userData) {
        userData = { xp: 0, level: 1, credits: 0, total_messages: 0, streak_days: 0,
                      games_played: 0, games_won: 0, total_winnings: 0, gaming: null };
    }

    // ========== CORE DATA ==========
    const xp = userData.xp || 0;
    const level = userData.level || calculateLevel(xp);
    const agentRank = getAgentRank(level);
    const credits = userData.credits || 0;
    const wealthTier = getWealthTier(credits);
    const gamesPlayed = userData.games_played || 0;
    const gamesWon = userData.games_won || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const totalMessages = userData.total_messages || 0;

    // ========== PROGRESS BAR ==========
    const currentLevelXP = Math.pow((level - 1) / 0.1, 2);
    const nextLevelXP = Math.pow(level / 0.1, 2);
    const xpForCurrentLevel = xp - currentLevelXP;
    const xpNeededForNext = nextLevelXP - currentLevelXP;
    const percent = xpNeededForNext > 0 ? Math.min(100, Math.max(0, (xpForCurrentLevel / xpNeededForNext) * 100)) : 0;
    const xpRemaining = Math.ceil(nextLevelXP - xp);
    const progressBar = createProgressBar(percent, 15);

    // ========== ACCOUNT AGE ==========
    const accountAgeDays = Math.floor((Date.now() - targetUser.createdTimestamp) / 86400000);
    const accountAgeTier = getAccountAgeTier(accountAgeDays, t.ageTiers);

    // ========== CLEARANCE ==========
    let clearance = t.clearanceLevels.agent;
    if (targetUser.id === process.env.OWNER_ID) clearance = t.clearanceLevels.owner;
    else if (member?.permissions?.has(PermissionFlagsBits.Administrator)) clearance = t.clearanceLevels.admin;
    else if (member?.permissions?.has(PermissionFlagsBits.ManageMessages)) clearance = t.clearanceLevels.moderator;

    // ========== SERVER POSITION ==========
    let joinPosition = 'N/A';
    let joinTier = null;
    if (member?.joinedTimestamp && guild) {
        const allMembers = await guild.members.fetch();
        let pos = 1;
        allMembers.forEach(m => {
            if (m.joinedTimestamp && m.joinedTimestamp < member.joinedTimestamp) pos++;
        });
        joinPosition = `#${pos.toLocaleString()}`;
        joinTier = getJoinTier(pos, t.joinTiers);
    }

    // ========== RANK IN SERVER ==========
    let serverRank = 'N/A';
    let totalUsers = 0;
    try {
        if (db) {
            const rankData = db.prepare('SELECT COUNT(*) as rank FROM users WHERE xp > ? AND guild_id = ?').get(xp, guildId);
            serverRank = `#${(rankData?.rank || 0) + 1}`;
            totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE guild_id = ?').get(guildId)?.count || 1;
        }
    } catch (e) {}

    // ========== GAMING DATA ==========
    let gamingData = { game: null, rank: 'UNRANKED', mode: 'STANDARD' };
    if (userData.gaming) { try { gamingData = JSON.parse(userData.gaming); } catch (e) {} }

    // ========== ROLES ==========
    let rolesDisplay = t.noRoles;
    if (member?.roles?.cache) {
        const roleList = member.roles.cache
            .filter(r => r.id !== guild?.id)
            .sort((a, b) => b.position - a.position)
            .map(r => `<@&${r.id}>`)
            .slice(0, 20)
            .join('  ') || t.noRoles;
        rolesDisplay = roleList;
    }

    // ========== LAST SEEN ==========
    let lastSeen = 'Never';
    if (userData.last_seen) {
        try {
            const lastSeenDate = new Date(userData.last_seen);
            const mins = Math.floor((Date.now() - lastSeenDate) / 60000);
            if (mins < 1) lastSeen = 'Just now';
            else if (mins < 60) lastSeen = `${mins}m ago`;
            else if (mins < 1440) lastSeen = `${Math.floor(mins / 60)}h ago`;
            else lastSeen = `${Math.floor(mins / 1440)}d ago`;
        } catch (e) {}
    }

    // ========== NEURAL EFFICIENCY ==========
    const neuralEfficiency = Math.min(100, Math.floor(
        (gamesPlayed * 0.5) + (totalMessages * 0.05) + ((userData.streak_days || 0) * 1.5)
    ));

    // ========== BUILD LEGENDARY EMBED ==========
    const embedColor = joinTier?.color || agentRank.color;

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({
            name: t.neuralScan(targetUser.username),
            iconURL: targetUser.displayAvatarURL({ dynamic: true })
        })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
        .setDescription(
            `### ${agentRank.emoji} ${agentRank.title[lang]}${joinTier ? `  •  ${joinTier.label}` : ''}\n` +
            `> *${accountAgeTier.label}* — ${accountAgeTier.desc}\n` +
            `\`\`\`ansi\n` +
            `\u001b[1;36m${t.nodeIdentification}:\u001b[0m \`${targetUser.id}\`\n` +
            `\u001b[1;33m${t.clearance}:\u001b[0m ${clearance}\n` +
            `\u001b[1;35m${t.lastSeen}:\u001b[0m ${lastSeen}\n` +
            `\`\`\``
        );

    // ========== SYNC TELEMETRY ==========
    embed.addFields({
        name: t.syncTelemetry,
        value:
            `\`\`\`yaml\n` +
            `${t.level}: ${level}  (${agentRank.emoji} ${agentRank.title[lang]})\n` +
            `${t.rank}: ${serverRank} / ${totalUsers.toLocaleString()}\n` +
            `${t.xp}: ${xp.toLocaleString()}\n` +
            `${t.messages}: ${totalMessages.toLocaleString()}\n` +
            `💰 ${t.credits}: ${credits.toLocaleString()} 🪙\n` +
            `  (${wealthTier.emoji} ${wealthTier.title[lang]})\n` +
            `${t.streak}: ${userData.streak_days || 0} ${lang === 'fr' ? 'jours' : 'days'}\n` +
            `${t.neuralEfficiency}: ${neuralEfficiency}%\n` +
            `\`\`\``,
        inline: true
    });

    // ========== TEMPORAL LOGS ==========
    const temporalValue = guild && member?.joinedTimestamp
        ? `${t.arrival}: <t:${Math.floor(member.joinedTimestamp / 1000)}:f>\n` +
          `${t.serverPosition}: ${joinPosition}\n` +
          `${t.account}: <t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>\n` +
          `${t.accountAge}: ${accountAgeTier.label} (${accountAgeDays}d)`
        : `${t.account}: <t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>\n` +
          `${t.accountAge}: ${accountAgeTier.label} (${accountAgeDays}d)`;

    embed.addFields({
        name: t.temporalLogs,
        value: temporalValue,
        inline: true
    });

    // ========== LEVEL PROGRESS ==========
    embed.addFields({
        name: t.progress,
        value:
            `${progressBar} \`${percent.toFixed(1)}%\`\n` +
            `└─ **${xpRemaining.toLocaleString()}** ${t.xpNeeded}`,
        inline: false
    });

    // ========== COMBAT MATRIX ==========
    if (gamingData.game) {
        embed.addFields({
            name: t.combatMatrix,
            value:
                `\`\`\`yaml\n` +
                `${t.sector}: ${gamingData.game}\n` +
                `${t.mode}: ${gamingData.mode || 'STANDARD'}\n` +
                `${t.combatRank}: ${gamingData.rank || 'UNRANKED'}\n` +
                `${t.gamesPlayed}: ${gamesPlayed}  (${t.winRate}: ${winRate}%)\n` +
                `${t.totalWinnings}: ${(userData.total_winnings || 0).toLocaleString()} 🪙\n` +
                `\`\`\``,
            inline: false
        });
    } else {
        embed.addFields({
            name: t.combatMatrix,
            value: `\`\`\`yaml\n${t.noData}\n${t.setGameHint}\n\`\`\``,
            inline: false
        });
    }

    // ========== ACHIEVEMENT BADGES ==========
    const badges = computeBadges(userData, lang);
    embed.addFields({
        name: t.activityBadges,
        value: badges,
        inline: false
    });

    // ========== AUTHORIZATIONS (ROLES) ==========
    embed.addFields({
        name: `${t.authorizations} (${member?.roles?.cache?.size - 1 || 0})`,
        value: rolesDisplay,
        inline: false
    });

    // ========== BOT STATS (when target is the bot) ==========
    if (targetUser.bot && targetUser.id === client.user.id && client.botStats) {
        try {
            const botStats = client.botStats.getOrCreateBotStats(db, guildId);
            const progress = client.botStats.buildProgressBar(botStats.xp, botStats.level);
            const uptime = client.botStats.formatUptime(process.uptime());

            embed.addFields({
                name: '🤖 BOT NEURAL STATS',
                value:
                    `\`\`\`ansi\n` +
                    `\u001b[1;36mLevel:\u001b[0m    ${botStats.level}\n` +
                    `\u001b[1;36mXP:\u001b[0m       ${botStats.xp.toLocaleString()}\n` +
                    `\u001b[1;36mProgress:\u001b[0m ${progress.bar} ${progress.percent}%\n` +
                    `\u001b[1;36mNext LV:\u001b[0m  ${progress.toNext.toLocaleString()} XP\n` +
                    `\u001b[1;36mUptime:\u001b[0m   ${uptime}\n` +
                    `\u001b[1;36mCommands:\u001b[0m ${botStats.commands_served.toLocaleString()}\n` +
                    `\u001b[1;36mSlash:\u001b[0m    ${botStats.slash_commands_served.toLocaleString()}\n` +
                    `\u001b[1;36mAI Chats:\u001b[0m ${botStats.ai_chats.toLocaleString()}\n` +
                    `\u001b[1;36mButtons:\u001b[0m  ${botStats.buttons_clicked.toLocaleString()}\n` +
                    `\u001b[1;36mMessages:\u001b[0m ${botStats.messages_handled.toLocaleString()}\n` +
                    `\u001b[1;36mTop Cmd:\u001b[0m  ${botStats.top_command || 'N/A'}\n` +
                    `\u001b[1;36mJoined:\u001b[0m   <t:${botStats.join_date}:R>\n` +
                    `\`\`\``,
                inline: false
            });
        } catch (e) {
            // Bot stats section is best-effort
        }
    }

    // ========== OWNER TELEMETRY ==========
    if (isOwner) {
        embed.addFields({
            name: t.ownerTelemetry,
            value:
                `\`\`\`yaml\n` +
                `${t.flags}: ${getAccountFlags(targetUser)}\n` +
                `${t.bot}: ${targetUser.bot ? '✅ YES' : '❌ NO'}\n` +
                `Email: ${targetUser.email || 'N/A'}\n` +
                `MFA: ${targetUser.mfaEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                `Premium: ${targetUser.premiumType || 'None'}\n` +
                `\`\`\``,
            inline: false
        });
    }

    embed.setFooter({
        text: `${guildName} • ${t.footer} • v${version}`,
        iconURL: guildIcon
    }).setTimestamp();

    return { embed, agentRank };
}

// ================= MODULE EXPORTS =================
module.exports = {
    name: 'whois',
    aliases: ['scan', 'user', 'dossier', 'info', 'qui', 'userinfo', 'ui', 'agent'],
    description: '🔍 Execute a deep neural scan on any agent — decrypt their full dossier, badges, clearance & server telemetry.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.whois [@user]',
    examples: ['.whois', '.whois @user', '.scan', '.dossier'],

    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('🔍 Deep-scan an agent — full dossier, badges, clearance & telemetry')
        .addUserOption(opt => opt
            .setName('target')
            .setDescription('Agent to deep-scan')
            .setRequired(false)),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        try {
            const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
            const targetMember = message.mentions.members.first() || message.member;
            const isOwner = message.author.id === process.env.OWNER_ID;

            const { embed } = await buildWhoisEmbed({
                client, db, member: targetMember,
                targetUser: targetMember.user,
                guild: message.guild, lang, isOwner
            });

            await message.reply({
                content: translations[lang].scanning(targetMember.user.username),
                embeds: [embed]
            }).catch(() => {});

            console.log(`[WHOIS] ${message.author.tag} scanned ${targetMember.user.tag} | Lang: ${lang}`);

        } catch (err) {
            console.error('[WHOIS PREFIX ERROR]', err);
            message.reply('❌ Neural scan failed. Try again.').catch(() => {});
        }
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        try {
            const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const isOwner = interaction.user.id === process.env.OWNER_ID;
            const db = client.db;

            // ========== DM FALLBACK ==========
            if (!interaction.guild) {
                const t = translations[lang];
                const xp = 0; // No per-server data in DM
                const level = 1;
                const agentRank = getAgentRank(level);

                const dmEmbed = new EmbedBuilder()
                    .setColor(agentRank.color)
                    .setAuthor({
                        name: lang === 'fr' ? '📡 SCAN NEURAL DIRECT' : '📡 DIRECT NEURAL SCAN',
                        iconURL: client.user.displayAvatarURL()
                    })
                    .setTitle(`🔍 ${targetUser.username.toUpperCase()}`)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
                    .setDescription(
                        `> *${lang === 'fr' ? 'Scan neural en mode direct (hors serveur)' : 'Neural scan in direct mode (no server)'}*\n\n` +
                        `\`\`\`yaml\n` +
                        `ID: ${targetUser.id}\n` +
                        `Username: ${targetUser.username}\n` +
                        `Display: ${targetUser.displayName}\n` +
                        `Bot: ${targetUser.bot ? 'YES' : 'NO'}\n` +
                        `Created: <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>\n` +
                        `\`\`\`\n\n` +
                        `⚠️ **${lang === 'fr' ? 'Scan limité en DM' : 'Limited DM Scan'}**\n` +
                        `*${lang === 'fr'
                            ? 'Les données de serveur (XP, crédits, rang) ne sont disponibles que dans un serveur.'
                            : 'Server data (XP, credits, rank) is only available inside a server.'}*\n\n` +
                        `💡 **${lang === 'fr' ? 'Conseil' : 'Tip'}:** ${lang === 'fr'
                            ? 'Utilisez `/whois @user` dans un serveur pour un scan complet!'
                            : 'Use `/whois @user` in a server for a full scan!'}`
                    )
                    .setFooter({
                        text: `BAMAKO-223 NODE • LIMITED DM SCAN`,
                        iconURL: client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                return interaction.reply({ embeds: [dmEmbed], flags: MessageFlags.Ephemeral });
            }

            // ========== SERVER EXECUTION ==========
            await interaction.deferReply();

            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) {
                return interaction.editReply({
                    content: lang === 'fr' ? '❌ Agent introuvable dans ce nœud.' : '❌ Agent not found in this node.'
                });
            }

            const { embed } = await buildWhoisEmbed({
                client, db, member,
                targetUser, guild: interaction.guild, lang, isOwner
            });

            await interaction.editReply({
                content: translations[lang].scanning(targetUser.username),
                embeds: [embed]
            });

            console.log(`[WHOIS SLASH] ${interaction.user.tag} scanned ${targetUser.tag} | Lang: ${lang}`);

        } catch (err) {
            console.error('[WHOIS SLASH ERROR]', err);
            interaction.editReply({ content: '❌ Neural scan failed. Try again.' }).catch(() => {});
        }
    }
};
