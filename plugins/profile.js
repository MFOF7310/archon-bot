Const { EmbedBuilder } = require('discord.js');

// --- UNIFIED CONFIGURATION (Matches games.js & rank.js) ---
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

const WEALTH_TIERS = [
    { minCredits: 0, title: { fr: "SANS LE SOU", en: "BROKE" }, emoji: "💀", color: "#95a5a6" },
    { minCredits: 100, title: { fr: "PETIT PORTEFEUILLE", en: "SMALL WALLET" }, emoji: "🪙", color: "#7f8c8d" },
    { minCredits: 1000, title: { fr: "COLLECTIONNEUR", en: "COLLECTOR" }, emoji: "💰", color: "#f1c40f" },
    { minCredits: 5000, title: { fr: "INVESTISSEUR", en: "INVESTOR" }, emoji: "📈", color: "#e67e22" },
    { minCredits: 15000, title: { fr: "BARON", en: "BARON" }, emoji: "🏦", color: "#3498db" },
    { minCredits: 50000, title: { fr: "MAGNAT", en: "MAGNATE" }, emoji: "👑", color: "#9b59b6" },
    { minCredits: 100000, title: { fr: "LÉGENDE FINANCIÈRE", en: "FINANCIAL LEGEND" }, emoji: "🏆", color: "#e74c3c" }
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

function getNextWealthTier(credits) {
    return WEALTH_TIERS.find(t => t.minCredits > credits);
}

function createProgressBar(percentage, length = 12) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

module.exports = {
    name: 'profile',
    aliases: ['p', 'id', 'userinfo', 'agent'], // REMOVED 'stats' and 'rank'
    description: '📊 Complete Agent Dossier with unified neural statistics.',
    category: 'PROFILE',
    usage: '.profile [@user]',
    cooldown: 3000,
    examples: ['.profile', '.profile @user'],

    run: async (client, message, args, db) => {
        try {
            const target = message.mentions.users.first() || message.author;
            const version = client.version || '1.3.2';

            // --- BILINGUAL DETECTION ---
            let lang = 'en';
            const guildSettings = client.settings?.get(message.guild?.id);
            if (guildSettings?.language) {
                lang = guildSettings.language;
            } else {
                const frenchKeywords = ['fr', 'francais', 'français', 'french', 'profil'];
                const content = message.content.toLowerCase();
                if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                    lang = 'fr';
                }
            }

            const t = {
                fr: {
                    title: (name) => `📜 DOSSIER AGENT: ${name.toUpperCase()}`,
                    node: 'Nœud',
                    core: 'Noyau',
                    rank: 'Rang',
                    statsTelemetry: '📊 TÉLÉMÉTRIE STATS',
                    level: 'Niveau',
                    xp: 'XP',
                    credits: 'Crédits',
                    wealth: 'Richesse',
                    progress: '🚀 PROGRESSION',
                    complete: 'Complet',
                    next: 'Prochain',
                    combatMatrix: '🎮 MATRICE DE COMBAT',
                    sector: 'Secteur',
                    played: 'Parties',
                    won: 'Victoires',
                    winRate: 'Taux',
                    dailyStreak: '🔥 Série Quotidienne',
                    messages: '💬 Messages',
                    gamesPlayed: '🎮 Parties Jouées',
                    totalWinnings: '🏆 Gains Totaux',
                    globalRank: '📈 Classement Global',
                    days: 'jours',
                    footer: 'Communauté Eagle 🇲🇱 • Nœud Bamako',
                    noData: (name) => `❌ **Agent ${name}** n'a aucune donnée enregistrée.`,
                    wealthProgress: 'Progression de Richesse',
                    required: 'requis'
                },
                en: {
                    title: (name) => `📜 AGENT DOSSIER: ${name.toUpperCase()}`,
                    node: 'Node',
                    core: 'Core',
                    rank: 'Rank',
                    statsTelemetry: '📊 STATS TELEMETRY',
                    level: 'Level',
                    xp: 'XP',
                    credits: 'Credits',
                    wealth: 'Wealth',
                    progress: '🚀 PROGRESS',
                    complete: 'Complete',
                    next: 'Next',
                    combatMatrix: '🎮 COMBAT MATRIX',
                    sector: 'Sector',
                    played: 'Played',
                    won: 'Won',
                    winRate: 'Rate',
                    dailyStreak: '🔥 Daily Streak',
                    messages: '💬 Messages',
                    gamesPlayed: '🎮 Games Played',
                    totalWinnings: '🏆 Total Winnings',
                    globalRank: '📈 Global Rank',
                    days: 'days',
                    footer: 'Eagle Community 🇲🇱 • Bamako Node',
                    noData: (name) => `❌ **Agent ${name}** has no recorded data.`,
                    wealthProgress: 'Wealth Progress',
                    required: 'required'
                }
            }[lang];

            const userData = db.prepare(`
                SELECT id, xp, credits, streak_days, total_messages, 
                       games_played, games_won, total_winnings, gaming 
                FROM users WHERE id = ?
            `).get(target.id);

            if (!userData) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setDescription(t.noData(target.username))
                    .setTimestamp();
                return message.reply({ embeds: [errorEmbed] });
            }

            const xp = userData.xp || 0;
            const credits = userData.credits || 0;
            const streakDays = userData.streak_days || 0;
            const totalMessages = userData.total_messages || 0;
            
            const level = calculateLevel(xp);
            const agentRank = getAgentRank(level);
            const wealthTier = getWealthTier(credits);
            const nextWealthTier = getNextWealthTier(credits);
            
            const gamesPlayed = userData.games_played || 0;
            const gamesWon = userData.games_won || 0;
            const totalWinnings = userData.total_winnings || 0;
            const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
            
            const rankData = db.prepare("SELECT COUNT(*) as rank FROM users WHERE xp > ?").get(xp);
            const globalRank = (rankData?.rank || 0) + 1;
            const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get()?.count || 1;
            
            const currentLevelXP = Math.pow((level - 1) / 0.1, 2);
            const nextLevelXP = Math.pow(level / 0.1, 2);
            const xpForCurrentLevel = xp - currentLevelXP;
            const xpNeededForNext = nextLevelXP - currentLevelXP;
            const progressPercent = Math.min(100, Math.max(0, (xpForCurrentLevel / xpNeededForNext) * 100));
            const xpRemaining = Math.ceil(nextLevelXP - xp);
            
            let wealthProgress = 0;
            let creditsToNextTier = 0;
            if (nextWealthTier) {
                creditsToNextTier = nextWealthTier.minCredits - credits;
                const prevTierMin = WEALTH_TIERS[WEALTH_TIERS.indexOf(nextWealthTier) - 1]?.minCredits || 0;
                const tierRange = nextWealthTier.minCredits - prevTierMin;
                const creditsInRange = credits - prevTierMin;
                wealthProgress = Math.min(100, Math.max(0, (creditsInRange / tierRange) * 100));
            }
            
            const levelProgressBar = createProgressBar(progressPercent, 15);
            const wealthProgressBar = createProgressBar(wealthProgress, 15);
            
            let gamingData = { game: "CODM", rank: "Unranked", mode: "Standard" };
            if (userData.gaming) {
                try { 
                    gamingData = JSON.parse(userData.gaming); 
                } catch (e) { }
            }
            
            const member = message.guild?.members.cache.get(target.id);
            const highestRole = member?.roles.highest.name !== '@everyone' ? member.roles.highest.name : 'Member';
            const joinedAt = member?.joinedAt ? new Date(member.joinedAt) : new Date();
            const memberDays = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
            
            const embed = new EmbedBuilder()
                .setColor(agentRank.color)
                .setAuthor({ 
                    name: t.title(target.username), 
                    iconURL: target.displayAvatarURL({ dynamic: true }) 
                })
                .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setDescription(
                    `\`\`\`prolog\n` +
                    `${t.node}: BKO-223 • ${t.core}: Groq LPU™ 70B\n` +
                    `${t.rank}: ${agentRank.emoji} ${agentRank.title[lang]} • ${t.level} ${level}\`\`\``
                )
                .addFields(
                    { 
                        name: t.statsTelemetry, 
                        value: `\`\`\`yaml\n` +
                               `${t.xp}: ${xp.toLocaleString()}\n` +
                               `${t.credits}: ${credits.toLocaleString()} 🪙\n` +
                               `${t.wealth}: ${wealthTier.emoji} ${wealthTier.title[lang]}\n` +
                               `${t.globalRank}: #${globalRank}/${totalUsers}\n` +
                               `${t.messages}: ${totalMessages.toLocaleString()}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: t.progress, 
                        value: `\`\`\`\n${levelProgressBar} ${progressPercent.toFixed(1)}%\n` +
                               `└─ ${t.next}: ${xpRemaining.toLocaleString()} ${t.xp}\`\`\``, 
                        inline: true 
                    }
                );
            
            if (nextWealthTier) {
                embed.addFields({
                    name: `💎 ${t.wealthProgress}`,
                    value: `\`${wealthProgressBar}\` **${wealthProgress.toFixed(1)}%**\n└─ ${creditsToNextTier.toLocaleString()} 🪙 ${t.required}`,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: `🏆 ${t.wealth}`,
                    value: `**MAXIMUM ${t.wealth.toUpperCase()} ACHIEVED!**\n└─ ${credits.toLocaleString()} 🪙`,
                    inline: false
                });
            }
            
            embed.addFields(
                { 
                    name: t.combatMatrix, 
                    value: `\`\`\`prolog\n` +
                           `${t.sector}: ${gamingData.game}\n` +
                           `Mode: ${gamingData.mode}\n` +
                           `Rank: ${gamingData.rank}\n` +
                           `${t.played}: ${gamesPlayed.toLocaleString()} • ${t.won}: ${gamesWon} (${winRate}%)\n` +
                           `${t.totalWinnings}: ${totalWinnings.toLocaleString()} 🪙\`\`\``, 
                    inline: false 
                },
                { 
                    name: `🔥 ${t.dailyStreak}`, 
                    value: `**${streakDays}** ${t.days}`, 
                    inline: true 
                },
                { 
                    name: `🎮 ${t.gamesPlayed}`, 
                    value: `**${gamesPlayed.toLocaleString()}**`, 
                    inline: true 
                },
                { 
                    name: `🏆 ${t.totalWinnings}`, 
                    value: `**${totalWinnings.toLocaleString()}** 🪙`, 
                    inline: true 
                },
                { 
                    name: `🕹️ DISCORD`, 
                    value: `**Role:** ${highestRole}\n**Member:** ${memberDays} ${t.days}\n**ID:** \`${target.id.slice(0, 8)}...\``, 
                    inline: false 
                }
            )
            .setFooter({ 
                text: `${t.footer} • v${version}`, 
                iconURL: message.guild?.iconURL() || client.user.displayAvatarURL() 
            })
            .setTimestamp();

            const ARCHITECT_ID = process.env.OWNER_ID;
            if (target.id === ARCHITECT_ID) {
                embed.addFields({
                    name: '🏛️ ARCHITECT RECOGNITION',
                    value: `The Creator walks among us. System honors its Architect.`,
                    inline: false
                });
            }

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error("PROFILE_ERROR:", error);
            message.reply("⚠️ **Neural Link Error:** Database mismatch detected. Please contact the Architect.");
        }
    }
};