// ================= BAMAKO MARKET CONTROL (BILINGUAL) =================
const { EmbedBuilder } = require('discord.js');
const { getMarketState, updateMarketTrend, getTimeUntilUpdate, TRENDS } = require('../market-manager');

// ================= BILINGUAL TRANSLATIONS =================
const t = {
    en: {
        dashboardTitle: '📊 BAMAKO MARKETPLACE',
        neuralOverride: '🌪️ NEURAL OVERRIDE',
        marketForceShifted: 'Market Force-Shifted',
        newTrend: 'New Trend',
        multiplier: 'Multiplier',
        overrideBy: 'Override by',
        architectSpoken: 'The Architect has spoken. The market bends to your will.',
        nextUpdate: 'Next natural update in 6 hours',
        marketHistory: '📈 MARKET HISTORY',
        last10Trends: 'Last 10 Market Trends',
        noHistory: 'No history yet',
        newTrendEvery: 'New trend every 6 hours',
        currentMultiplier: 'Current Multiplier',
        marketSentiment: 'Market Sentiment',
        lydiaTip: 'Lydia\'s Tip',
        bullChance: '📈 Bull (30%)',
        steadyChance: '📊 Steady (40%)',
        bearChance: '📉 Bear (20%)',
        volatileChance: '🌪️ Volatile (10%)',
        architectControls: '👑 ARCHITECT CONTROLS',
        forceCommand: '.market force - Override trend',
        historyCommand: '.market history - View all trends',
        investPrompt: '.invest to stake credits',
        extremelyBullish: '🔥 EXTREMELY BULLISH - Buy! Buy! Buy!',
        bullish: '📈 Bullish - Good time to invest',
        neutral: '📊 Neutral - Steady as she goes',
        bearish: '📉 Bearish - Proceed with caution',
        volatile: '🌪️ VOLATILE - High risk, high reward!',
        bullDesc: 'Strong growth - Best time to invest!',
        steadyDesc: 'Stable and predictable - Safe investments',
        bearDesc: 'Declining - Proceed with caution',
        volatileDesc: 'Extreme swings - High risk, high reward!',
        // Lydia tips
        bullTips: [
            "The Niger River is flowing strong! 📈",
            "My neural pathways detect growth in Bamako!",
            "The Architect smiles upon this market!",
            "Buy low, sell high - the ancient wisdom holds true!",
            "Prosperity flows like the Niger!"
        ],
        steadyTips: [
            "Steady like the Malian sun. ☀️",
            "Consistency is the Bamako way.",
            "Nothing flashy, but reliable as the dawn.",
            "The market breathes steadily today.",
            "Patience rewards the wise."
        ],
        bearTips: [
            "Even the Niger has low tides. 📉",
            "Patience, Elite Friends. Markets breathe.",
            "A good time to hold and observe.",
            "The storm will pass. It always does.",
            "Wise investors know when to wait."
        ],
        volatileTips: [
            "🌪️ Sandstorm in the market!",
            "High risk, high reward - like crossing the Sahara!",
            "My circuits are buzzing with uncertainty!",
            "Only the brave invest now!",
            "Fortune favors the bold... sometimes!"
        ]
    },
    fr: {
        dashboardTitle: '📊 MARCHÉ DE BAMAKO',
        neuralOverride: '🌪️ CONTRÔLE NEURAL',
        marketForceShifted: 'Marché Forcé',
        newTrend: 'Nouvelle Tendance',
        multiplier: 'Multiplicateur',
        overrideBy: 'Forcé par',
        architectSpoken: 'L\'Architecte a parlé. Le marché se plie à votre volonté.',
        nextUpdate: 'Prochaine mise à jour naturelle dans 6 heures',
        marketHistory: '📈 HISTORIQUE DU MARCHÉ',
        last10Trends: '10 Dernières Tendances',
        noHistory: 'Pas encore d\'historique',
        newTrendEvery: 'Nouvelle tendance toutes les 6 heures',
        currentMultiplier: 'Multiplicateur Actuel',
        marketSentiment: 'Sentiment du Marché',
        lydiaTip: 'Conseil de Lydia',
        bullChance: '📈 Haussier (30%)',
        steadyChance: '📊 Stable (40%)',
        bearChance: '📉 Baissier (20%)',
        volatileChance: '🌪️ Volatil (10%)',
        architectControls: '👑 CONTRÔLES ARCHITECTE',
        forceCommand: '.market force - Forcer la tendance',
        historyCommand: '.market history - Voir l\'historique',
        investPrompt: '.invest pour miser des crédits',
        extremelyBullish: '🔥 EXTRÊMEMENT HAUSSIER - Achetez !',
        bullish: '📈 Haussier - Bon moment pour investir',
        neutral: '📊 Neutre - Stable',
        bearish: '📉 Baissier - Prudence',
        volatile: '🌪️ VOLATIL - Haut risque, haute récompense !',
        bullDesc: 'Forte croissance - Meilleur moment pour investir !',
        steadyDesc: 'Stable et prévisible - Investissements sûrs',
        bearDesc: 'En baisse - Procédez avec prudence',
        volatileDesc: 'Variations extrêmes - Haut risque, haute récompense !',
        // Lydia tips
        bullTips: [
            "Le fleuve Niger coule avec force ! 📈",
            "Mes circuits neuronaux détectent la croissance à Bamako !",
            "L'Architecte sourit à ce marché !",
            "Achetez bas, vendez haut - la sagesse ancienne !",
            "La prospérité coule comme le Niger !"
        ],
        steadyTips: [
            "Stable comme le soleil malien. ☀️",
            "La constance est la voie de Bamako.",
            "Rien de tape-à-l'œil, mais fiable comme l'aube.",
            "Le marché respire calmement aujourd'hui.",
            "La patience récompense les sages."
        ],
        bearTips: [
            "Même le Niger a ses marées basses. 📉",
            "Patience, Amis d'Élite. Les marchés respirent.",
            "Bon moment pour observer et attendre.",
            "La tempête passera. Elle passe toujours.",
            "Les investisseurs sages savent attendre."
        ],
        volatileTips: [
            "🌪️ Tempête de sable sur le marché !",
            "Haut risque, haute récompense - comme traverser le Sahara !",
            "Mes circuits bourdonnent d'incertitude !",
            "Seuls les courageux investissent maintenant !",
            "La fortune sourit aux audacieux... parfois !"
        ]
    }
};

// Get translation based on language detection
function getLang(message) {
    // Use client's detectLanguage if available
    if (message.client.detectLanguage) {
        const usedCommand = message.content.split(' ')[0]?.toLowerCase() || '';
        return message.client.detectLanguage(usedCommand) || 'en';
    }
    // Fallback: check for French indicators
    const content = message.content.toLowerCase();
    if (/[àâäéèêëîïôöùûüÿçœæ]/i.test(content)) return 'fr';
    if (content.includes('marché') || content.includes('force') || content.includes('historique')) return 'fr';
    return 'en';
}

// Get Lydia tip based on trend and language
function getLydiaTip(trend, lang) {
    const tips = t[lang];
    const tipList = tips[`${trend.toLowerCase()}Tips`] || tips.steadyTips;
    return tipList[Math.floor(Math.random() * tipList.length)];
}

// Get sentiment text
function getSentimentText(multiplier, lang) {
    const texts = t[lang];
    if (multiplier >= 1.15) return texts.extremelyBullish;
    if (multiplier >= 1.05) return texts.bullish;
    if (multiplier >= 0.98) return texts.neutral;
    if (multiplier >= 0.90) return texts.bearish;
    return texts.volatile;
}

module.exports = {
    name: 'market',
    aliases: ['trend', 'economy', 'marché', 'bourse'],
    description: '📊 View and control the Bamako Market / Voir et contrôler le Marché de Bamako',
    category: 'ECONOMY',
    usage: '[force|history]',
    cooldown: 3000,
    
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = getLang(message);
        const texts = t[lang];
        const marketState = getMarketState();
        const trend = TRENDS[marketState.trend];
        const isOwner = message.author.id === process.env.OWNER_ID;
        
        // Owner force override
        if (args[0] === 'force' && isOwner) {
            const newState = updateMarketTrend();
            const newTrend = TRENDS[newState.trend];
            
            const embed = new EmbedBuilder()
                .setColor(newTrend.color)
                .setAuthor({ name: texts.neuralOverride, iconURL: client.user.displayAvatarURL() })
                .setTitle(texts.marketForceShifted)
                .setDescription(
                    `**${texts.newTrend}:** ${newTrend.emoji} ${newTrend.name}\n` +
                    `**${texts.multiplier}:** ${(newState.multiplier * 100).toFixed(1)}%\n` +
                    `**${texts.overrideBy}:** ${message.author.username}\n\n` +
                    `*${texts.architectSpoken}*`
                )
                .setFooter({ text: `BAMAKO_223 🇲🇱 • ${texts.nextUpdate}` })
                .setTimestamp();
            
            // Announce to Telegram if bridge is active
            if (client.telegramBridge?.enabled) {
                const tgLang = lang === 'fr' ? 'fr' : 'en';
                const tgTexts = t[tgLang];
                client.telegramBridge.send(
                    `🌪️ <b>${tgTexts.neuralOverride}</b>\n\n` +
                    `${tgTexts.architectSpoken}\n\n` +
                    `<b>${tgTexts.newTrend}:</b> ${newTrend.emoji} ${newTrend.name}\n` +
                    `<b>${tgTexts.multiplier}:</b> ${(newState.multiplier * 100).toFixed(1)}%`
                ).catch(() => {});
            }
            
            return message.reply({ embeds: [embed] });
        }
        
        // Full history
        if (args[0] === 'history' || args[0] === 'historique') {
            const embed = new EmbedBuilder()
                .setColor(trend.color)
                .setAuthor({ name: texts.marketHistory, iconURL: client.user.displayAvatarURL() })
                .setTitle(texts.last10Trends);
            
            let historyText = '';
            marketState.history.slice(-10).reverse().forEach((h, i) => {
                const t = TRENDS[h.trend];
                const date = new Date(h.timestamp).toLocaleString();
                const arrow = i === 0 ? '➡️' : '';
                historyText += `${arrow} ${t?.emoji || '📊'} **${t?.name}** - ${(h.multiplier * 100).toFixed(1)}%\n`;
                historyText += `   └─ ${date}\n`;
            });
            
            embed.setDescription(historyText || texts.noHistory);
            embed.setFooter({ text: `BAMAKO_223 🇲🇱 • ${texts.newTrendEvery}` });
            
            return message.reply({ embeds: [embed] });
        }
        
        // Main dashboard
        const nextUpdate = getTimeUntilUpdate();
        const lydiaTip = getLydiaTip(marketState.trend, lang);
        const sentiment = getSentimentText(marketState.multiplier, lang);
        
        const embed = new EmbedBuilder()
            .setColor(trend.color)
            .setAuthor({ name: texts.dashboardTitle, iconURL: client.user.displayAvatarURL() })
            .setTitle(`${trend.emoji} ${trend.name}`)
            .setDescription(
                `**${texts.currentMultiplier}:** ${(marketState.multiplier * 100).toFixed(1)}%\n` +
                `**${texts.marketSentiment}:** ${sentiment}\n` +
                `**${texts.nextUpdate.replace('natural update', 'update')}:** ${nextUpdate}\n\n` +
                `💬 *"${lydiaTip}"*`
            )
            .addFields(
                { name: texts.bullChance, value: '1.05x - 1.20x', inline: true },
                { name: texts.steadyChance, value: '0.98x - 1.08x', inline: true },
                { name: texts.bearChance, value: '0.85x - 0.98x', inline: true },
                { name: texts.volatileChance, value: '0.70x - 1.40x', inline: true }
            );
        
        if (isOwner) {
            embed.addFields({
                name: texts.architectControls,
                value: `\`${texts.forceCommand}\`\n\`${texts.historyCommand}\``,
                inline: false
            });
        }
        
        embed.setFooter({ text: `BAMAKO_223 🇲🇱 • ${texts.investPrompt}` })
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
};