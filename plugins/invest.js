// ================= BAMAKO INVESTMENT SYSTEM (BILINGUAL) =================
const { EmbedBuilder } = require('discord.js');
const { getMarketState, getTimeUntilUpdate, processInvestment, TRENDS } = require('../market-manager');

// ================= BILINGUAL TRANSLATIONS =================
const t = {
    en: {
        dashboardTitle: '📊 BAMAKO MARKETPLACE',
        invested: 'Invested',
        returned: 'Returned',
        profit: 'Profit',
        newBalance: 'New Balance',
        thankYou: 'Thank you for investing!',
        noInvestments: '❌ You have no active investments! Use `.invest <amount>` first.',
        minInvestment: '❌ Minimum investment is **100 🪙**! Usage: `.invest <amount>`',
        insufficient: '❌ Insufficient credits! You have',
        investmentMade: '📈 INVESTMENT MADE',
        currentMultiplier: 'Current Multiplier',
        investedAmount: 'Invested',
        useClaim: 'Use `.invest claim` after 6+ hours to withdraw!',
        returnsGrow: 'Returns grow with market trends and holding time!',
        nextMarketUpdate: 'Next market update',
        investmentClaimed: '💰 INVESTMENT CLAIMED',
        activeInvestments: 'Active Investments',
        yourBalance: 'Your Balance',
        investCommand: '.invest <amount> - Stake credits',
        claimCommand: '.invest claim - Withdraw profits',
        historyCommand: '.invest history - Past trends',
        statusTitle: '📊 BAMAKO MARKETPLACE'
    },
    fr: {
        dashboardTitle: '📊 MARCHÉ DE BAMAKO',
        invested: 'Investi',
        returned: 'Retourné',
        profit: 'Profit',
        newBalance: 'Nouveau Solde',
        thankYou: 'Merci d\'investir !',
        noInvestments: '❌ Vous n\'avez pas d\'investissements actifs ! Utilisez `.invest <montant>` d\'abord.',
        minInvestment: '❌ Investissement minimum de **100 🪙** ! Usage : `.invest <montant>`',
        insufficient: '❌ Crédits insuffisants ! Vous avez',
        investmentMade: '📈 INVESTISSEMENT EFFECTUÉ',
        currentMultiplier: 'Multiplicateur Actuel',
        investedAmount: 'Investi',
        useClaim: 'Utilisez `.invest claim` après 6+ heures pour retirer !',
        returnsGrow: 'Les rendements augmentent avec les tendances du marché !',
        nextMarketUpdate: 'Prochaine mise à jour',
        investmentClaimed: '💰 INVESTISSEMENT RÉCUPÉRÉ',
        activeInvestments: 'Investissements Actifs',
        yourBalance: 'Votre Solde',
        investCommand: '.invest <montant> - Miser des crédits',
        claimCommand: '.invest claim - Retirer les profits',
        historyCommand: '.invest history - Tendances passées',
        statusTitle: '📊 MARCHÉ DE BAMAKO'
    }
};

function getLang(message) {
    if (message.client.detectLanguage) {
        const usedCommand = message.content.split(' ')[0]?.toLowerCase() || '';
        return message.client.detectLanguage(usedCommand) || 'en';
    }
    const content = message.content.toLowerCase();
    if (/[àâäéèêëîïôöùûüÿçœæ]/i.test(content)) return 'fr';
    if (content.includes('invest') && content.includes('claim')) return 'en';
    return 'en';
}

module.exports = {
    name: 'invest',
    aliases: ['market', 'stake', 'investir', 'miser'],
    description: '📈 Invest your credits in the Bamako Market / Investissez vos crédits dans le Marché de Bamako',
    category: 'ECONOMY',
    usage: '<amount|status|claim>',
    cooldown: 3000,
    
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = getLang(message);
        const texts = t[lang];
        const userId = message.author.id;
        const username = message.author.username;
        const action = args[0]?.toLowerCase();
        const marketState = getMarketState();
        const trend = TRENDS[marketState.trend];
        
        // Get user data
        let userData = client.getUserData ? client.getUserData(userId) : db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        if (!userData) {
            userData = { credits: 0, level: 1 };
        }
        
        // Status command
        if (!action || action === 'status' || action === 'statut') {
            const investments = db.prepare("SELECT * FROM investments WHERE user_id = ? AND claimed = 0").all(userId);
            const totalInvested = investments.reduce((sum, i) => sum + i.amount, 0);
            
            const embed = new EmbedBuilder()
                .setColor(trend.color)
                .setAuthor({ name: texts.statusTitle, iconURL: client.user.displayAvatarURL() })
                .setTitle(`${trend.emoji} ${trend.name}`)
                .setDescription(
                    `**${texts.currentMultiplier}:** ${(marketState.multiplier * 100).toFixed(1)}%\n` +
                    `**${texts.nextMarketUpdate}:** ${getTimeUntilUpdate()}\n\n` +
                    `**${texts.yourBalance}:** ${userData.credits.toLocaleString()} 🪙\n` +
                    `**${texts.activeInvestments}:** ${totalInvested.toLocaleString()} 🪙\n`
                )
                .addFields(
                    { name: '📈 ' + (lang === 'fr' ? 'Investir' : 'Invest'), value: `\`${texts.investCommand}\``, inline: true },
                    { name: '💰 ' + (lang === 'fr' ? 'Récupérer' : 'Claim'), value: `\`${texts.claimCommand}\``, inline: true },
                    { name: '📊 ' + (lang === 'fr' ? 'Historique' : 'History'), value: `\`${texts.historyCommand}\``, inline: true }
                )
                .setFooter({ text: 'BAMAKO_223 🇲🇱 • ' + (lang === 'fr' ? 'Mise à jour toutes les 6h' : 'Market updates every 6 hours') })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        // History command
        if (action === 'history' || action === 'historique') {
            const embed = new EmbedBuilder()
                .setColor(trend.color)
                .setAuthor({ name: '📈 ' + (lang === 'fr' ? 'HISTORIQUE DU MARCHÉ' : 'MARKET HISTORY'), iconURL: client.user.displayAvatarURL() })
                .setTitle(lang === 'fr' ? '10 Dernières Tendances' : 'Last 10 Market Trends');
            
            let historyText = '';
            marketState.history.slice(-5).reverse().forEach(h => {
                const t = TRENDS[h.trend];
                const date = new Date(h.timestamp).toLocaleTimeString();
                historyText += `${t?.emoji || '📊'} ${(h.multiplier * 100).toFixed(1)}% - ${date}\n`;
            });
            
            embed.setDescription(historyText || (lang === 'fr' ? 'Pas encore d\'historique' : 'No history yet'));
            embed.setFooter({ text: 'BAMAKO_223 🇲🇱 • ' + (lang === 'fr' ? 'Nouvelle tendance toutes les 6h' : 'New trend every 6 hours') });
            
            return message.reply({ embeds: [embed] });
        }
        
        // Claim command
        if (action === 'claim' || action === 'réclamer' || action === 'reclamer') {
            const investments = db.prepare("SELECT * FROM investments WHERE user_id = ? AND claimed = 0").all(userId);
            
            if (investments.length === 0) {
                return message.reply(texts.noInvestments);
            }
            
            let totalReturn = 0;
            let totalInvested = 0;
            
            const updateStmt = db.prepare("UPDATE investments SET claimed = 1, total_profit = ? WHERE id = ?");
            
            for (const inv of investments) {
                totalInvested += inv.amount;
                const returnAmount = processInvestment(inv.amount, inv.invested_at);
                totalReturn += returnAmount;
                const profit = returnAmount - inv.amount;
                updateStmt.run(profit, inv.id);
            }
            
            const profit = totalReturn - totalInvested;
            const newCredits = userData.credits + totalReturn;
            
            db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(newCredits, userId);
            if (client.queueUserUpdate) {
                client.queueUserUpdate(userId, { ...userData, credits: newCredits });
            }
            
            const embed = new EmbedBuilder()
                .setColor(profit >= 0 ? '#2ecc71' : '#e74c3c')
                .setAuthor({ name: texts.investmentClaimed, iconURL: message.author.displayAvatarURL() })
                .setDescription(
                    `**${texts.invested}:** ${totalInvested.toLocaleString()} 🪙\n` +
                    `**${texts.returned}:** ${totalReturn.toLocaleString()} 🪙\n` +
                    `**${texts.profit}:** ${profit >= 0 ? '+' : ''}${profit.toLocaleString()} 🪙\n\n` +
                    `**${texts.newBalance}:** ${newCredits.toLocaleString()} 🪙`
                )
                .setFooter({ text: `BAMAKO_223 🇲🇱 • ${texts.thankYou}` });
            
            return message.reply({ embeds: [embed] });
        }
        
        // Invest command
        const amount = parseInt(action);
        if (isNaN(amount) || amount < 100) {
            return message.reply(texts.minInvestment);
        }
        
        if (userData.credits < amount) {
            return message.reply(`${texts.insufficient} **${userData.credits.toLocaleString()} 🪙**.`);
        }
        
        // Deduct credits and create investment
        const newCredits = userData.credits - amount;
        db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(newCredits, userId);
        if (client.queueUserUpdate) {
            client.queueUserUpdate(userId, { ...userData, credits: newCredits });
        }
        
        const investmentId = `${userId}_${Date.now()}`;
        db.prepare("INSERT INTO investments (id, user_id, amount, invested_at, claimed, platform) VALUES (?, ?, ?, ?, 0, 'discord')")
            .run(investmentId, userId, amount, Date.now());
        
        const embed = new EmbedBuilder()
            .setColor(trend.color)
            .setAuthor({ name: texts.investmentMade, iconURL: message.author.displayAvatarURL() })
            .setTitle(`${trend.emoji} ${trend.name}`)
            .setDescription(
                `**${texts.investedAmount}:** ${amount.toLocaleString()} 🪙\n` +
                `**${texts.currentMultiplier}:** ${(marketState.multiplier * 100).toFixed(1)}%\n` +
                `**${texts.newBalance}:** ${newCredits.toLocaleString()} 🪙\n\n` +
                `${texts.useClaim}\n` +
                `*${texts.returnsGrow}*`
            )
            .setFooter({ text: `BAMAKO_223 🇲🇱 • ${texts.nextMarketUpdate}: ${getTimeUntilUpdate()}` });
        
        return message.reply({ embeds: [embed] });
    }
};