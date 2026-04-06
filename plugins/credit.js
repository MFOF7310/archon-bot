const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// --- BILINGUAL TRANSLATIONS ---
const walletTranslations = {
    en: {
        title: '◈ NEURAL WALLET: DATA ASSETS ◈',
        balance: 'Available Credits',
        totalGains: 'Lifetime Winnings',
        totalSpent: 'Total Spent',
        agentRank: 'Agent Rank',
        wealthTier: 'Wealth Tier',
        level: 'Level',
        vaultStatus: 'VAULT STATUS: SECURE',
        footer: (v) => `Mali Node • Archon v${v} • Neural Ledger`,
        shopBtn: 'Marketplace',
        dailyBtn: 'Daily Claim',
        refreshBtn: 'Refresh',
        loading: '🔄 Synchronizing with Neural Ledger...',
        noUser: '❌ Subject not found in database.',
        ownWallet: (name) => `💰 **${name}'s Neural Wallet**`,
        otherWallet: (name) => `💰 **${name}'s Neural Wallet**`,
        nextTier: 'Next Tier',
        tierProgress: 'Wealth Progress',
        creditsPerDay: 'Daily Earning Rate',
        gamesPlayed: 'Games Played',
        winRate: 'Win Rate',
        lowCredits: '⚠️ LOW CREDITS WARNING',
        lowCreditsMsg: 'Your credits are running low! Use `.daily` to claim your daily reward or visit the `.shop` to see what you can afford.',
        maxTier: 'MAXIMUM WEALTH TIER ACHIEVED!',
        maxTierMsg: 'You have reached the highest wealth tier possible. Impressive!'
    },
    fr: {
        title: '◈ PORTEFEUILLE NEURAL : ACTIFS ◈',
        balance: 'Crédits Disponibles',
        totalGains: 'Gains Totaux',
        totalSpent: 'Dépenses Totales',
        agentRank: 'Rang d\'Agent',
        wealthTier: 'Niveau de Richesse',
        level: 'Niveau',
        vaultStatus: 'ÉTAT DU COFFRE : SÉCURISÉ',
        footer: (v) => `Nœud Mali • Archon v${v} • Registre Neural`,
        shopBtn: 'Marché',
        dailyBtn: 'Quotidien',
        refreshBtn: 'Actualiser',
        loading: '🔄 Synchronisation avec le Registre Neural...',
        noUser: '❌ Sujet introuvable dans la base de données.',
        ownWallet: (name) => `💰 **Portefeuille Neural de ${name}**`,
        otherWallet: (name) => `💰 **Portefeuille Neural de ${name}**`,
        nextTier: 'Prochain Niveau',
        tierProgress: 'Progression de Richesse',
        creditsPerDay: 'Gain Quotidien Moyen',
        gamesPlayed: 'Parties Jouées',
        winRate: 'Taux de Victoire',
        lowCredits: '⚠️ CRÉDITS FAIBLES',
        lowCreditsMsg: 'Vos crédits sont faibles! Utilisez `.daily` pour réclamer votre récompense quotidienne ou visitez le `.shop` pour voir ce que vous pouvez acheter.',
        maxTier: 'NIVEAU DE RICHESSE MAXIMUM ATTEINT!',
        maxTierMsg: 'Vous avez atteint le plus haut niveau de richesse possible. Impressionnant!'
    }
};

// --- AGENT RANKS (XP-BASED - Primary) ---
// This matches your game.js exactly
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

// --- WEALTH TIERS (Credit-Based - Secondary/Display Only) ---
// These are SEPARATE from agent ranks - just for financial status
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
    const rank = AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel);
    return rank || AGENT_RANKS[AGENT_RANKS.length - 1];
}

function getWealthTier(credits) {
    // Find the highest tier the user qualifies for
    const tier = [...WEALTH_TIERS].reverse().find(t => credits >= t.minCredits);
    return tier || WEALTH_TIERS[0];
}

function getNextWealthTier(credits) {
    // Find the next tier above current credits
    return WEALTH_TIERS.find(t => t.minCredits > credits);
}

module.exports = {
    name: 'credits',
    aliases: ['bal', 'balance', 'money', 'argent', 'solde', 'wallet', 'credit'],
    description: '💰 Check your current Archon Credits and financial status.',
    category: 'ECONOMY',
    usage: '.credits [@user]',
    cooldown: 3000,
    examples: ['.credits', '.credits @user'],

    run: async (client, message, args, database) => {
        
        // --- INTELLIGENT LANGUAGE DETECTION ---
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else {
            const frenchKeywords = ['fr', 'francais', 'français', 'french', 'solde', 'argent'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }
        const t = walletTranslations[lang];
        const version = client.version || '1.3.2';

        // --- TARGET USER (self or mentioned) ---
        const target = message.mentions.users.first() || message.author;
        const isSelf = target.id === message.author.id;
        
        // --- FETCH DATA FROM UNIFIED DATABASE ---
        const userData = database.prepare(`
            SELECT credits, xp, total_winnings, games_played, games_won 
            FROM users 
            WHERE id = ?
        `).get(target.id);

        if (!userData) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.noUser)
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }

        const credits = userData.credits || 0;
        const winnings = userData.total_winnings || 0;
        const xp = userData.xp || 0;
        const gamesPlayed = userData.games_played || 0;
        const gamesWon = userData.games_won || 0;
        
        // Calculate level and AGENT rank (XP-based)
        const level = calculateLevel(xp);
        const agentRank = getAgentRank(level);
        
        // Calculate WEALTH tier (Credit-based - separate system)
        const wealthTier = getWealthTier(credits);
        const nextWealthTier = getNextWealthTier(credits);
        
        // Calculate win rate
        const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
        
        // Calculate estimated daily earnings (based on games played)
        const estimatedDailyEarnings = Math.min(Math.floor(gamesPlayed * 0.5) * 100, 5000);
        
        // Calculate wealth tier progress
        let progressToNextTier = 0;
        let creditsToNextTier = 0;
        
        if (nextWealthTier) {
            creditsToNextTier = nextWealthTier.minCredits - credits;
            const prevTierMin = WEALTH_TIERS[WEALTH_TIERS.indexOf(nextWealthTier) - 1]?.minCredits || 0;
            const tierRange = nextWealthTier.minCredits - prevTierMin;
            const creditsInRange = credits - prevTierMin;
            progressToNextTier = Math.min(100, Math.max(0, (creditsInRange / tierRange) * 100));
        }
        
        // Create progress bar for wealth tier
        const progressBarLength = 15;
        const filledBars = Math.floor(progressToNextTier / (100 / progressBarLength));
        const emptyBars = progressBarLength - filledBars;
        const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
        
        // --- BUILD WALLET EMBED ---
        const walletEmbed = new EmbedBuilder()
            .setColor(agentRank.color)
            .setAuthor({ 
                name: isSelf ? t.ownWallet(target.username) : t.otherWallet(target.username), 
                iconURL: target.displayAvatarURL({ dynamic: true, size: 256 }) 
            })
            .setTitle(t.title)
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(`\`\`\`yaml\n${t.vaultStatus}\nNode: BAMAKO-223\nCore: Groq LPU™\n\`\`\``)
            .addFields(
                { 
                    name: `💰 ${t.balance}`, 
                    value: `**${credits.toLocaleString()}** 🪙`, 
                    inline: true 
                },
                { 
                    name: `🏆 ${t.totalGains}`, 
                    value: `**${winnings.toLocaleString()}** 🪙`, 
                    inline: true 
                },
                { 
                    name: `📈 ${t.agentRank}`, 
                    value: `${agentRank.emoji} **${agentRank.title[lang]}**\n${t.level}: ${level}`, 
                    inline: true 
                }
            );
        
        // Add Wealth Tier (separate from agent rank)
        walletEmbed.addFields({
            name: `💎 ${t.wealthTier}`,
            value: `${wealthTier.emoji} **${wealthTier.title[lang]}**`,
            inline: true
        });
        
        // Add wealth tier progress if not at max
        if (nextWealthTier) {
            walletEmbed.addFields({
                name: `🎯 ${t.nextTier}: ${nextWealthTier.emoji} ${nextWealthTier.title[lang]}`,
                value: `\`${progressBar}\` **${progressToNextTier.toFixed(1)}%**\n└─ ${creditsToNextTier.toLocaleString()} 🪙 ${lang === 'fr' ? 'requis' : 'required'}`,
                inline: false
            });
        } else {
            walletEmbed.addFields({
                name: `🏆 ${t.maxTier}`,
                value: t.maxTierMsg,
                inline: false
            });
        }
        
        // Add game stats if available
        if (gamesPlayed > 0) {
            walletEmbed.addFields({
                name: `🎮 ${t.gamesPlayed}`,
                value: `**${gamesPlayed.toLocaleString()}** ${lang === 'fr' ? 'parties' : 'games'}\n└─ 🏆 ${t.winRate}: **${winRate}%** (${gamesWon} ${lang === 'fr' ? 'victoires' : 'wins'})`,
                inline: true
            });
        }
        
        // Add daily earning estimate
        if (estimatedDailyEarnings > 0) {
            walletEmbed.addFields({
                name: `⚡ ${t.creditsPerDay}`,
                value: `**${estimatedDailyEarnings.toLocaleString()}** 🪙\n└─ ${lang === 'fr' ? 'Basé sur votre activité' : 'Based on your activity'}`,
                inline: true
            });
        }
        
        walletEmbed
            .setFooter({ text: t.footer(version), iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        // --- ADD WARNING FOR LOW CREDITS (only for self) ---
        if (credits < 100 && isSelf) {
            walletEmbed.addFields({
                name: t.lowCredits,
                value: t.lowCreditsMsg,
                inline: false
            });
        }
        
        // --- NAVIGATION BUTTONS (Only for the message author) ---
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('go_shop')
                .setLabel(t.shopBtn)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🏪'),
            new ButtonBuilder()
                .setCustomId('go_daily')
                .setLabel(t.dailyBtn)
                .setStyle(ButtonStyle.Success)
                .setEmoji('⚡'),
            new ButtonBuilder()
                .setCustomId('refresh_balance')
                .setLabel(t.refreshBtn)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄')
        );
        
        const reply = await message.reply({ 
            embeds: [walletEmbed], 
            components: isSelf ? [row] : [] 
        });
        
        // --- INTERACTIVE NAVIGATION COLLECTOR ---
        if (isSelf) {
            const collector = reply.createMessageComponentCollector({ time: 60000 });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ 
                        content: lang === 'fr' ? '❌ Ces contrôles sont verrouillés à votre session.' : '❌ These controls are locked to your session.', 
                        ephemeral: true 
                    });
                }
                
                await i.deferUpdate();
                
                switch (i.customId) {
                    case 'go_shop':
                        const shopCmd = client.commands.get('shop');
                        if (shopCmd) {
                            await shopCmd.run(client, message, [], database);
                        } else {
                            await i.followUp({ 
                                content: lang === 'fr' ? '❌ Commande de boutique introuvable.' : '❌ Shop command not found.', 
                                ephemeral: true 
                            });
                        }
                        break;
                        
                    case 'go_daily':
                        const dailyCmd = client.commands.get('daily');
                        if (dailyCmd) {
                            await dailyCmd.run(client, message, [], database);
                        } else {
                            await i.followUp({ 
                                content: lang === 'fr' ? '❌ Commande quotidienne introuvable.' : '❌ Daily command not found.', 
                                ephemeral: true 
                            });
                        }
                        break;
                        
                    case 'refresh_balance':
                        // Refresh the balance display
                        const freshData = database.prepare(`
                            SELECT credits, xp, total_winnings, games_played, games_won 
                            FROM users WHERE id = ?
                        `).get(message.author.id);
                        
                        if (freshData) {
                            const freshCredits = freshData.credits || 0;
                            const freshLevel = calculateLevel(freshData.xp || 0);
                            const freshAgentRank = getAgentRank(freshLevel);
                            const freshWealthTier = getWealthTier(freshCredits);
                            
                            const refreshedEmbed = new EmbedBuilder(walletEmbed)
                                .setColor(freshAgentRank.color)
                                .spliceFields(0, 4,
                                    { name: `💰 ${t.balance}`, value: `**${freshCredits.toLocaleString()}** 🪙`, inline: true },
                                    { name: `🏆 ${t.totalGains}`, value: `**${freshData.total_winnings?.toLocaleString() || 0}** 🪙`, inline: true },
                                    { name: `📈 ${t.agentRank}`, value: `${freshAgentRank.emoji} **${freshAgentRank.title[lang]}**\n${t.level}: ${freshLevel}`, inline: true },
                                    { name: `💎 ${t.wealthTier}`, value: `${freshWealthTier.emoji} **${freshWealthTier.title[lang]}**`, inline: true }
                                )
                                .setTimestamp();
                            
                            await i.editReply({ embeds: [refreshedEmbed] });
                        }
                        break;
                }
            });
            
            collector.on('end', () => {
                reply.edit({ components: [] }).catch(() => {});
            });
        }
        
        // --- LOG THE COMMAND ---
        console.log(`[CREDITS] ${message.author.tag} checked ${isSelf ? 'their own' : `${target.tag}'s`} balance: ${credits} credits | Wealth: ${wealthTier.title.en} | Lang: ${lang}`);
    }
};