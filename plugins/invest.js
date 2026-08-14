const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { ns } = require('../lib/lang');
const EMOJIS = require('../config/emojis');

// ================= FIXED RETURN RATE =================
// 8% per 6 hours held, capped at 48% (24h max bonus)
function calculateReturn(amount, investedAt) {
    const hoursHeld = Math.max(0, (Date.now() - investedAt) / (1000 * 60 * 60));
    const periods = Math.floor(hoursHeld / 6);
    const rate = Math.min(0.08 * periods, 0.48);
    const bonus = Math.floor(amount * rate);
    return {
        returnAmount: amount + bonus,
        profit: bonus,
        hoursHeld: Math.floor(hoursHeld),
        rate: (rate * 100).toFixed(0),
        periods
    };
}

// ================= ENSURE TABLE EXISTS WITH guild_id =================
function ensureInvestTable(db) {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS investments (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL DEFAULT 'DM',
            amount INTEGER NOT NULL,
            invested_at INTEGER NOT NULL,
            claimed INTEGER DEFAULT 0,
            total_profit INTEGER DEFAULT 0,
            platform TEXT DEFAULT 'discord'
        )
    `).run();
    // Add guild_id column if missing (migration for existing tables)
    try {
        db.prepare("ALTER TABLE investments ADD COLUMN guild_id TEXT NOT NULL DEFAULT 'DM'").run();
    } catch(e) {} // Column already exists
}

module.exports = {
    name: 'invest',
    aliases: ['stake', 'investir', 'miser'],
    description: 'Invest your credits for fixed returns.',
    category: 'ECONOMY',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('invest')
        .setDescription('Invest your credits for fixed returns')
        .addSubcommand(sub => sub
            .setName('stake')
            .setDescription('Invest credits (min 100)')
            .addIntegerOption(o => o
                .setName('amount')
                .setDescription('Amount to invest (min 100)')
                .setRequired(true)
                .setMinValue(100)
            )
        )
        .addSubcommand(sub => sub
            .setName('claim')
            .setDescription('Claim your investment returns')
        )
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('View your active investments')
        ),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        ensureInvestTable(db);

        const t = ns('invest', lang);
        const version = client.version || '3.1.0';
        const guildName = message.guild?.name || 'ARCHON';
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
            const investments = db.prepare(
                'SELECT * FROM investments WHERE user_id = ? AND guild_id = ? AND claimed = 0 ORDER BY invested_at DESC'
            ).all(userId, guildId);
            const totalInvested = investments.reduce((s, i) => s + i.amount, 0);

            if (investments.length === 0) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#f1c40f')
                        .setAuthor({ name: t.statusTitle || 'Your Investments', iconURL: client.user.displayAvatarURL() })
                        .setDescription(
                            `${EMOJIS.invest} **${t.noInvestYet || 'No active investments yet!'}**\n\n` +
                            `${EMOJIS.coins} ${t.noInvestHint || 'Use .invest <amount> to start earning returns.'}`
                        )
                        .setFooter({ text: `${guildName} • ${t.footer || 'BAMAKO INVEST'}` })]
                }).catch(() => {});
            }

            const lines = investments.slice(0, 5).map(inv => {
                const r = calculateReturn(inv.amount, inv.invested_at);
                return `${EMOJIS.charts} **${inv.amount.toLocaleString()}** ${EMOJIS.coins} · ${r.hoursHeld}h · **+${r.rate}%**`;
            }).join('\n');

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#00f0ff')
                    .setAuthor({ name: t.statusTitle || 'Active Investments', iconURL: client.user.displayAvatarURL() })
                    .setDescription(
                        lines + '\n\n' +
                        `${EMOJIS.coins} **${t.total || 'Total'}:** ${totalInvested.toLocaleString()}\n` +
                        `${EMOJIS.warning} ${t.tip || 'Hold longer for higher returns (8% per 6h, max 48%)'}`
                    )
                    .setFooter({ text: `${guildName} • ${t.footer || 'BAMAKO INVEST'} • v${version}`, iconURL: guildIcon })
                    .setTimestamp()]
            }).catch(() => {});
        }

        // ── CLAIM ──
        if (action === 'claim' || action === 'réclamer' || action === 'reclamer') {
            const investments = db.prepare(
                'SELECT * FROM investments WHERE user_id = ? AND guild_id = ? AND claimed = 0'
            ).all(userId, guildId);
            if (investments.length === 0) return message.reply(t.noInvest || 'No active investments!');

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
                    .setAuthor({ name: t.claimTitle || 'Investment Claimed!', iconURL: message.author.displayAvatarURL() })
                    .setDescription(
                        `${EMOJIS.invest} **${t.invested || 'Invested'}:** ${totalInvested.toLocaleString()} ${EMOJIS.coins}\n` +
                        `${EMOJIS.charts} **${t.returned || 'Returned'}:** ${totalReturn.toLocaleString()} ${EMOJIS.coins}\n` +
                        (profit >= 0
                            ? `${EMOJIS.check} **${t.profit || 'Profit'}:** +${profit.toLocaleString()} ${EMOJIS.coins}\n`
                            : `${EMOJIS.error} **${t.loss || 'Loss'}:** ${profit.toLocaleString()} ${EMOJIS.coins}\n`) +
                        `⏱️ **${t.held || 'Time Held'}:** ${hoursHeld}h\n` +
                        `📊 **${t.roi || 'ROI'}:** ${roi}%\n\n` +
                        `${EMOJIS.coins} **${t.oldBal || 'Previous'}:** ${oldBalance.toLocaleString()}\n` +
                        `${EMOJIS.check} **${t.newBal || 'New Balance'}:** ${newCredits.toLocaleString()}`
                    )
                    .setFooter({ text: `${guildName} • ${t.footer || 'BAMAKO INVEST'} • v${version}`, iconURL: guildIcon })
                    .setTimestamp()]
            }).catch(() => {});
        }

        // ── STAKE ──
        const amount = parseInt(action);
        if (isNaN(amount) || amount < 100) return message.reply(t.minInvest || 'Minimum investment is **100** credits.');
        if (oldBalance < amount) return message.reply(
            t.insufficient
                ? (typeof t.insufficient === 'function' ? t.insufficient(oldBalance) : t.insufficient.replace('{bal}', oldBalance.toLocaleString()))
                : `You only have **${oldBalance.toLocaleString()}** credits.`
        );

        const newCredits = oldBalance - amount;
        db.prepare('UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?').run(newCredits, userId, guildId);
        if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, credits: newCredits });
        if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);

        db.prepare('INSERT INTO investments (id, user_id, guild_id, amount, invested_at, claimed, platform) VALUES (?, ?, ?, ?, ?, 0, \'discord\')'
        ).run(`${userId}_${guildId}_${Date.now()}`, userId, guildId, amount, Date.now());

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
            } catch(e) {}
        }

        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: t.stakeTitle || 'Investment Confirmed!', iconURL: message.author.displayAvatarURL() })
                .setDescription(
                    `${EMOJIS.invest} **${t.invested || 'Invested'}:** ${amount.toLocaleString()} ${EMOJIS.coins}\n` +
                    `${EMOJIS.coins} **${t.oldBal || 'Previous Balance'}:** ${oldBalance.toLocaleString()}\n` +
                    `${EMOJIS.warning} **${t.newBal || 'New Balance'}:** ${newCredits.toLocaleString()}\n\n` +
                    `${EMOJIS.charts} **${t.rate || 'Rate'}:** 8% per 6h · max 48% at 24h\n` +
                    `${EMOJIS.check} ${t.useClaim ? (typeof t.useClaim === 'function' ? t.useClaim(prefix) : t.useClaim.replace('{prefix}', prefix)) : `Use \`${prefix}invest claim\` after 6h to collect returns.`}`
                )
                .setFooter({ text: `${guildName} • ${t.footer || 'BAMAKO INVEST'} • v${version}`, iconURL: guildIcon })
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

        const guildId = interaction.guild?.id || 'DM';
        const lang = client.detectLanguage ? client.detectLanguage('invest', guildId) : 'en';

        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => interaction.editReply(options).catch(() => interaction.followUp(options)),
            react: () => Promise.resolve()
        };
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        await module.exports.run(client, fakeMessage, args, client.db, serverSettings, 'invest', lang);
    }
};
