const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { getMarketState, getTimeUntilUpdate, processInvestment, TRENDS } = require('./market-manager');

const investTranslations = {
    en: {
        invested: 'Invested', returned: 'Returned', profit: 'Profit', loss: 'Loss',
        newBalance: 'New Balance', previousBalance: 'Previous Balance', thankYou: 'Thank you for investing!',
        noInvestments: '❌ You have no active investments! Use `.invest <amount>` first.',
        minInvestment: '❌ Minimum investment is **100 🪙**!',
        insufficient: '❌ Insufficient credits! You have',
        investmentMade: '📈 INVESTMENT MADE', currentMultiplier: 'Current Multiplier',
        investedAmount: 'Invested', useClaim: (prefix) => `Use \`${prefix}invest claim\` after 6+ hours to withdraw!`,
        returnsGrow: 'Returns grow with market trends and holding time!',
        nextMarketUpdate: 'Next market update', investmentClaimed: '💰 INVESTMENT CLAIMED',
        activeInvestments: 'Active Investments', yourBalance: 'Your Balance',
        statusTitle: '📊 BAMAKO MARKETPLACE', verifyWith: 'Verify with',
        checkBalance: (prefix) => `Check your balance anytime with \`${prefix}bal\` or \`${prefix}credits\``,
        footer: 'BAMAKO MARKET • INVESTMENT RECEIPT',
        holdingPeriod: 'Holding Period', hours: 'hours', marketTrend: 'Market Trend', roi: 'ROI'
    },
    fr: {
        invested: 'Investi', returned: 'Retourné', profit: 'Profit', loss: 'Perte',
        newBalance: 'Nouveau Solde', previousBalance: 'Solde Précédent', thankYou: 'Merci d\'investir !',
        noInvestments: '❌ Vous n\'avez pas d\'investissements actifs ! Utilisez `.invest <montant>` d\'abord.',
        minInvestment: '❌ Investissement minimum de **100 🪙** !',
        insufficient: '❌ Crédits insuffisants ! Vous avez',
        investmentMade: '📈 INVESTISSEMENT EFFECTUÉ', currentMultiplier: 'Multiplicateur Actuel',
        investedAmount: 'Investi', useClaim: (prefix) => `Utilisez \`${prefix}invest claim\` après 6+ heures pour retirer !`,
        returnsGrow: 'Les rendements augmentent avec les tendances du marché !',
        nextMarketUpdate: 'Prochaine mise à jour', investmentClaimed: '💰 INVESTISSEMENT RÉCUPÉRÉ',
        activeInvestments: 'Investissements Actifs', yourBalance: 'Votre Solde',
        statusTitle: '📊 MARCHÉ DE BAMAKO', verifyWith: 'Vérifiez avec',
        checkBalance: (prefix) => `Vérifiez votre solde avec \`${prefix}bal\` ou \`${prefix}credits\``,
        footer: 'MARCHÉ BAMAKO • REÇU D\'INVESTISSEMENT',
        holdingPeriod: 'Période de Détention', hours: 'heures', marketTrend: 'Tendance du Marché', roi: 'ROI'
    }
};

module.exports = {
    name: 'invest',
    aliases: ['stake', 'investir', 'miser'],
    description: '📈 Invest your credits in the Bamako Market.',
    category: 'ECONOMY',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('invest')
        .setDescription('📈 Invest your credits in the Bamako Market')
        .addSubcommand(sub => sub.setName('stake').setDescription('Invest credits').addIntegerOption(o => o.setName('amount').setDescription('Amount (min 100)').setRequired(true).setMinValue(100)))
        .addSubcommand(sub => sub.setName('status').setDescription('View investments and market'))
        .addSubcommand(sub => sub.setName('claim').setDescription('Claim your returns'))
        .addSubcommand(sub => sub.setName('history').setDescription('Market trend history')),

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = investTranslations[lang];
        const version = client.version || '2.0.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const prefix = serverSettings?.prefix || '.';
        const userId = message.author.id;
        const action = args[0]?.toLowerCase();
        const marketState = getMarketState(message.guild?.id);
        const trend = TRENDS[marketState.trend] || TRENDS.STEADY;

        // PER-SERVER: Extract guildId for composite key lookups
        const guildId = message.guild?.id || 'DM';

        // PER-SERVER: Composite key lookup (userId, guildId)
        let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
        if (!userData) userData = { credits: 0, level: 1 };
        const oldBalance = userData.credits || 0;

        // STATUS
        if (!action || action === 'status' || action === 'statut') {
            const investments = db.prepare("SELECT * FROM investments WHERE user_id = ? AND claimed = 0").all(userId);
            const totalInvested = investments.reduce((sum, i) => sum + i.amount, 0);
            const embed = new EmbedBuilder()
                .setColor(trend.color)
                .setAuthor({ name: t.statusTitle, iconURL: client.user.displayAvatarURL() })
                .setTitle(`${trend.emoji} ${trend.name}`)
                .setDescription(
                    '```ansi\n' +
                    '\u001b[1;33m\u25b8 TREND    \u001b[0m' + trend.emoji + ' ' + trend.name + '\n' +
                    '\u001b[1;36m\u25b8 MULT     \u001b[0m' + (marketState.multiplier * 100).toFixed(1) + '%\n' +
                    '\u001b[1;36m\u25b8 NEXT     \u001b[0m' + getTimeUntilUpdate(message.guild?.id) + '\n' +
                    '\u001b[1;32m\u25b8 BALANCE  \u001b[0m' + oldBalance.toLocaleString() + ' \uD83E\uDE99\n' +
                    '\u001b[1;35m\u25b8 INVESTED \u001b[0m' + totalInvested.toLocaleString() + ' \uD83E\uDE99\n' +
                    '```'
                )
                .addFields(
                    { name: '📈 ' + (lang === 'fr' ? 'Investir' : 'Invest'), value: `\`${prefix}invest <amount>\``, inline: true },
                    { name: '💰 ' + (lang === 'fr' ? 'Récupérer' : 'Claim'), value: `\`${prefix}invest claim\``, inline: true },
                    { name: '📊 ' + (lang === 'fr' ? 'Historique' : 'History'), value: `\`${prefix}invest history\``, inline: true }
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // HISTORY
        if (action === 'history' || action === 'historique') {
            const embed = new EmbedBuilder()
                .setColor(trend.color)
                .setAuthor({ name: '📈 ' + (lang === 'fr' ? 'HISTORIQUE DU MARCHÉ' : 'MARKET HISTORY'), iconURL: client.user.displayAvatarURL() })
                .setTitle(lang === 'fr' ? '10 Dernières Tendances' : 'Last 10 Market Trends');
            let historyText = '';
            if (marketState.history && marketState.history.length > 0) {
                marketState.history.slice(-5).reverse().forEach(h => {
                    const tr = TRENDS[h.trend] || TRENDS.STEADY;
                    const date = new Date(h.timestamp).toLocaleTimeString();
                    historyText += `${tr?.emoji || '📊'} ${(h.multiplier * 100).toFixed(1)}% - ${date}\n`;
                });
            }
            embed.setDescription(historyText || (lang === 'fr' ? 'Pas encore d\'historique' : 'No history yet'));
            embed.setFooter({ text: `${guildName} • BAMAKO MARKET • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // CLAIM
        if (action === 'claim' || action === 'réclamer' || action === 'reclamer') {
            const investments = db.prepare("SELECT * FROM investments WHERE user_id = ? AND claimed = 0").all(userId);
            if (investments.length === 0) return message.reply(t.noInvestments);

            let totalReturn = 0, totalInvested = 0, oldestInvestment = Date.now();
            const updateStmt = db.prepare("UPDATE investments SET claimed = 1, total_profit = ? WHERE id = ?");
            for (const inv of investments) {
                totalInvested += inv.amount;
                const returnAmount = processInvestment(inv.amount, inv.invested_at, message.guild?.id);
                totalReturn += returnAmount;
                updateStmt.run(returnAmount - inv.amount, inv.id);
                if (inv.invested_at < oldestInvestment) oldestInvestment = inv.invested_at;
            }

            const profit = totalReturn - totalInvested;
            const newCredits = oldBalance + totalReturn;
            const holdingHours = Math.floor((Date.now() - oldestInvestment) / (60 * 60 * 1000));
            const roi = ((totalReturn - totalInvested) / totalInvested * 100).toFixed(1);

            // PER-SERVER: UPDATE includes guild_id
            db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newCredits, userId, guildId);
            if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, credits: newCredits });
            // PER-SERVER: Cache delete uses composite key
            if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);

            const embed = new EmbedBuilder()
                .setColor(profit >= 0 ? '#2ecc71' : '#e74c3c')
                .setAuthor({ name: t.investmentClaimed, iconURL: message.author.displayAvatarURL() })
                .setDescription(
                    '```ansi\n' +
                    '\u001b[1;36m\u25b8 INVESTED \u001b[0m' + totalInvested.toLocaleString() + ' \uD83E\uDE99\n' +
                    '\u001b[1;36m\u25b8 RETURNED \u001b[0m' + totalReturn.toLocaleString() + ' \uD83E\uDE99\n' +
                    (profit >= 0
                        ? '\u001b[1;32m\u25b8 PROFIT   \u001b[0m\u001b[1;32m+' + profit.toLocaleString() + ' \uD83E\uDE99\u001b[0m\n'
                        : '\u001b[1;31m\u25b8 LOSS     \u001b[0m\u001b[1;31m' + profit.toLocaleString() + ' \uD83E\uDE99\u001b[0m\n') +
                    '\u001b[1;33m\u25b8 HELD     \u001b[0m' + holdingHours + ' ' + t.hours + '\n' +
                    '\u001b[1;33m\u25b8 TREND    \u001b[0m' + trend.emoji + ' ' + trend.name + '\n' +
                    '\u001b[1;35m\u25b8 ROI      \u001b[0m' + roi + '%\n' +
                    '\u001b[1;36m\u25b8 OLD BAL  \u001b[0m' + oldBalance.toLocaleString() + ' \uD83E\uDE99\n' +
                    '\u001b[1;32m\u25b8 NEW BAL  \u001b[0m\u001b[1;32m' + newCredits.toLocaleString() + ' \uD83E\uDE99\u001b[0m\n' +
                    '```'
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // INVEST
        const amount = parseInt(action);
        if (isNaN(amount) || amount < 100) return message.reply(t.minInvestment);
        if (oldBalance < amount) return message.reply(`${t.insufficient} **${oldBalance.toLocaleString()} 🪙**.`);

        const newCredits = oldBalance - amount;
        // PER-SERVER: UPDATE includes guild_id
        db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newCredits, userId, guildId);
        if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, credits: newCredits });
        // PER-SERVER: Cache delete uses composite key
        if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);
        db.prepare("INSERT INTO investments (id, user_id, amount, invested_at, claimed, platform) VALUES (?, ?, ?, ?, 0, 'discord')")
            .run(`${userId}_${Date.now()}`, userId, amount, Date.now());

        const embed = new EmbedBuilder()
            .setColor(trend.color)
            .setAuthor({ name: t.investmentMade, iconURL: message.author.displayAvatarURL() })
            .setTitle(`${trend.emoji} ${trend.name}`)
            .setDescription(
                .setDescription(
                    '```ansi\n' +
                    '\u001b[1;32m\u25b8 INVESTED \u001b[0m\u001b[1;32m' + amount.toLocaleString() + ' \uD83E\uDE99\u001b[0m\n' +
                    '\u001b[1;33m\u25b8 TREND    \u001b[0m' + trend.emoji + ' ' + trend.name + '\n' +
                    '\u001b[1;36m\u25b8 MULT     \u001b[0m' + (marketState.multiplier * 100).toFixed(1) + '%\n' +
                    '\u001b[1;36m\u25b8 OLD BAL  \u001b[0m' + oldBalance.toLocaleString() + ' \uD83E\uDE99\n' +
                    '\u001b[1;31m\u25b8 NEW BAL  \u001b[0m' + newCredits.toLocaleString() + ' \uD83E\uDE99\n' +
                    '\u001b[0;37m\u25b8 TIP      \u001b[0mClaim after 6+ hours for returns\n' +
                    '```'
                )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        // ================= ASSIGN INVESTOR ROLE =================
        if (message.guild) {
            try {
                const investorRoleId = serverSettings?.investorRoleId || process.env.INVESTOR_ROLE_ID;
                if (investorRoleId) {
                    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
                    if (member) {
                        const role = message.guild.roles.cache.get(investorRoleId);
                        if (role && !member.roles.cache.has(investorRoleId)) {
                            await member.roles.add(role, '📈 Investment portfolio activated').catch(() => {});
                        }
                    }
                }
            } catch (e) {}
        }

        return message.reply({ embeds: [embed] }).catch(() => {});
    },

    execute: async (interaction, client) => {
        const subcommand = interaction.options.getSubcommand();
        let args = [];
        if (subcommand === 'stake') args = [interaction.options.getInteger('amount').toString()];
        else if (subcommand === 'status') args = ['status'];
        else if (subcommand === 'claim') args = ['claim'];
        else if (subcommand === 'history') args = ['history'];

        const fakeMessage = {
            author: interaction.user, guild: interaction.guild, channel: interaction.channel,
            reply: async (options) => { if (interaction.deferred) return interaction.editReply(options); return interaction.reply(options); },
            react: () => Promise.resolve()
        };
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, 'invest');
    }
};
