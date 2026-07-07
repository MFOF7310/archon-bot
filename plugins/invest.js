const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// ================= FIXED RETURN RATE (no market dependency) =================
// 8% per 6 hours held, capped at 48% (24h max bonus)
function calculateReturn(amount, investedAt) {
    const hoursHeld = Math.max(0, (Date.now() - investedAt) / (1000 * 60 * 60));
    const periods = Math.floor(hoursHeld / 6);
    const rate = Math.min(0.08 * periods, 0.48); // 8% per 6h, max 48%
    const bonus = Math.floor(amount * rate);
    return {
        returnAmount: amount + bonus,
        profit: bonus,
        hoursHeld: Math.floor(hoursHeld),
        rate: (rate * 100).toFixed(0),
        periods
    };
}

// ================= BILINGUAL =================
const T = {
    en: {
        stakeTitle: '📈 INVESTMENT CONFIRMED',
        claimTitle: '💰 INVESTMENT CLAIMED',
        noInvest: '❌ No active investments. Use `.invest <amount>` first.',
        minInvest: '❌ Minimum investment is **100 🪙**.',
        insufficient: (bal) => `❌ Insufficient credits. You have **${bal.toLocaleString()} 🪙**.`,
        useClaim: (prefix) => `Use \`${prefix}invest claim\` after 6h for returns.`,
        footer: 'BAMAKO INVEST • NEURAL ECONOMY',
        hours: 'hours',
        rate: 'Return Rate',
        held: 'Time Held',
        invested: 'Invested',
        returned: 'Returned',
        profit: 'Profit',
        loss: 'Loss',
        oldBal: 'Previous Balance',
        newBal: 'New Balance',
        roi: 'ROI',
        tip: 'Hold longer for higher returns (8% per 6h, max 48%)',
    },
    fr: {
        stakeTitle: '📈 INVESTISSEMENT CONFIRMÉ',
        claimTitle: '💰 INVESTISSEMENT RÉCUPÉRÉ',
        noInvest: '❌ Aucun investissement actif. Utilisez `.invest <montant>` d\'abord.',
        minInvest: '❌ Investissement minimum de **100 🪙**.',
        insufficient: (bal) => `❌ Crédits insuffisants. Vous avez **${bal.toLocaleString()} 🪙**.`,
        useClaim: (prefix) => `Utilisez \`${prefix}invest claim\` après 6h pour les rendements.`,
        footer: 'BAMAKO INVEST • ÉCONOMIE NEURALE',
        hours: 'heures',
        rate: 'Taux de Rendement',
        held: 'Durée',
        invested: 'Investi',
        returned: 'Retourné',
        profit: 'Profit',
        loss: 'Perte',
        oldBal: 'Solde Précédent',
        newBal: 'Nouveau Solde',
        roi: 'ROI',
        tip: 'Maintenez plus longtemps pour plus de rendement (8% par 6h, max 48%)',
    }
};

module.exports = {
    name: 'invest',
    aliases: ['stake', 'investir', 'miser'],
    description: '📈 Invest your credits for fixed returns.',
    category: 'ECONOMY',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('invest')
        .setDescription('📈 Invest your credits for fixed returns')
        .addSubcommand(sub => sub
            .setName('stake')
            .setDescription('💰 Invest credits (min 100)')
            .addIntegerOption(o => o
                .setName('amount')
                .setDescription('Amount to invest (min 100)')
                .setRequired(true)
                .setMinValue(100)
            )
        )
        .addSubcommand(sub => sub
            .setName('claim')
            .setDescription('💸 Claim your investment returns')
        )
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('📊 View your active investments')
        ),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        const t = T[lang] || T.en;
        const version = client.version || '3.1.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const prefix = serverSettings?.prefix || '.';
        const userId = message.author.id;
        const guildId = message.guild?.id || 'DM';
        const action = args[0]?.toLowerCase();

        let userData = client.getUserData
            ? client.getUserData(userId, guildId)
            : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
        if (!userData) userData = { credits: 0, level: 1 };
        const oldBalance = userData.credits || 0;

        // ── STATUS ──
        if (!action || action === 'status' || action === 'statut') {
            const investments = db.prepare('SELECT * FROM investments WHERE user_id = ? AND claimed = 0 ORDER BY invested_at DESC').all(userId);
            const totalInvested = investments.reduce((s, i) => s + i.amount, 0);

            if (investments.length === 0) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#f1c40f')
                        .setDescription('```ansi\n\u001b[1;33m▸ No active investments\u001b[0m\n\u001b[0;37m▸ Use .invest <amount> to start\u001b[0m\n```')
                        .setFooter({ text: `${guildName} • ${t.footer}` })]
                }).catch(() => {});
            }

            const lines = investments.slice(0, 5).map(inv => {
                const r = calculateReturn(inv.amount, inv.invested_at);
                return `\u001b[1;36m▸\u001b[0m ${inv.amount.toLocaleString()} 🪙 · ${r.hoursHeld}h held · \u001b[1;32m+${r.rate}%\u001b[0m`;
            }).join('\n');

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#00f0ff')
                    .setAuthor({ name: '📊 ACTIVE INVESTMENTS', iconURL: client.user.displayAvatarURL() })
                    .setDescription(
                        '```ansi\n' + lines + '\n' +
                        `\u001b[1;35m▸ TOTAL    \u001b[0m${totalInvested.toLocaleString()} 🪙\n` +
                        `\u001b[0;37m▸ TIP      \u001b[0m${t.tip}\n` +
                        '```'
                    )
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp()]
            }).catch(() => {});
        }

        // ── CLAIM ──
        if (action === 'claim' || action === 'réclamer' || action === 'reclamer') {
            const investments = db.prepare('SELECT * FROM investments WHERE user_id = ? AND claimed = 0').all(userId);
            if (investments.length === 0) return message.reply(t.noInvest);

            let totalInvested = 0, totalReturn = 0, oldestAt = Date.now();
            const updateStmt = db.prepare('UPDATE investments SET claimed = 1, total_profit = ? WHERE id = ?');

            for (const inv of investments) {
                const r = calculateReturn(inv.amount, inv.invested_at);
                totalInvested += inv.amount;
                totalReturn += r.returnAmount;
                updateStmt.run(r.profit, inv.id);
                if (inv.invested_at < oldestAt) oldestAt = inv.invested_at;
            }

            const profit = totalReturn - totalInvested;
            const newCredits = oldBalance + totalReturn;
            const hoursHeld = Math.floor((Date.now() - oldestAt) / 3600000);
            const roi = ((profit / totalInvested) * 100).toFixed(1);

            db.prepare('UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?').run(newCredits, userId, guildId);
            if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, credits: newCredits });
            if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(profit >= 0 ? '#2ecc71' : '#e74c3c')
                    .setAuthor({ name: t.claimTitle, iconURL: message.author.displayAvatarURL() })
                    .setDescription(
                        '```ansi\n' +
                        `\u001b[1;36m▸ ${t.invested.padEnd(9)}\u001b[0m${totalInvested.toLocaleString()} 🪙\n` +
                        `\u001b[1;36m▸ ${t.returned.padEnd(9)}\u001b[0m${totalReturn.toLocaleString()} 🪙\n` +
                        (profit >= 0
                            ? `\u001b[1;32m▸ ${t.profit.padEnd(9)}\u001b[0m\u001b[1;32m+${profit.toLocaleString()} 🪙\u001b[0m\n`
                            : `\u001b[1;31m▸ ${t.loss.padEnd(9)}\u001b[0m\u001b[1;31m${profit.toLocaleString()} 🪙\u001b[0m\n`) +
                        `\u001b[1;33m▸ ${t.held.padEnd(9)}\u001b[0m${hoursHeld} ${t.hours}\n` +
                        `\u001b[1;35m▸ ${t.roi.padEnd(9)}\u001b[0m${roi}%\n` +
                        `\u001b[1;36m▸ ${t.oldBal.padEnd(9)}\u001b[0m${oldBalance.toLocaleString()} 🪙\n` +
                        `\u001b[1;32m▸ ${t.newBal.padEnd(9)}\u001b[0m\u001b[1;32m${newCredits.toLocaleString()} 🪙\u001b[0m\n` +
                        '```'
                    )
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp()]
            }).catch(() => {});
        }

        // ── STAKE ──
        const amount = parseInt(action);
        if (isNaN(amount) || amount < 100) return message.reply(t.minInvest);
        if (oldBalance < amount) return message.reply(t.insufficient(oldBalance));

        const newCredits = oldBalance - amount;
        db.prepare('UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?').run(newCredits, userId, guildId);
        if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, credits: newCredits });
        if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);
        db.prepare("INSERT INTO investments (id, user_id, amount, invested_at, claimed, platform) VALUES (?, ?, ?, ?, 0, 'discord')")
            .run(`${userId}_${Date.now()}`, userId, amount, Date.now());

        // Assign investor role
        if (message.guild) {
            try {
                const investorRoleId = serverSettings?.investorRoleId || process.env.INVESTOR_ROLE_ID;
                if (investorRoleId) {
                    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
                    if (member) {
                        const role = message.guild.roles.cache.get(investorRoleId);
                        if (role && !member.roles.cache.has(investorRoleId)) {
                            await member.roles.add(role, '📈 Investment activated').catch(() => {});
                        }
                    }
                }
            } catch (e) {}
        }

        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: t.stakeTitle, iconURL: message.author.displayAvatarURL() })
                .setDescription(
                    '```ansi\n' +
                    `\u001b[1;32m▸ INVESTED \u001b[0m\u001b[1;32m${amount.toLocaleString()} 🪙\u001b[0m\n` +
                    `\u001b[1;36m▸ OLD BAL  \u001b[0m${oldBalance.toLocaleString()} 🪙\n` +
                    `\u001b[1;31m▸ NEW BAL  \u001b[0m${newCredits.toLocaleString()} 🪙\n` +
                    `\u001b[0;37m▸ TIP      \u001b[0m${t.useClaim(prefix)}\n` +
                    `\u001b[0;37m▸ RATE     \u001b[0m8% per 6h · max 48% at 24h\n` +
                    '```'
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp()]
        }).catch(() => {});
    },

    execute: async (interaction, client) => {
        await interaction.deferReply().catch(() => {});
        const subcommand = interaction.options.getSubcommand();
        let args = [];
        if (subcommand === 'stake') args = [interaction.options.getInteger('amount').toString()];
        else if (subcommand === 'claim') args = ['claim'];
        else if (subcommand === 'status') args = ['status'];

        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => interaction.editReply(options).catch(() => interaction.followUp(options)),
            react: () => Promise.resolve()
        };
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, 'invest');
    }
};
