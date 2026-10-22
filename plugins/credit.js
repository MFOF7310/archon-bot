const i18n = require('../lib/i18n');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { PermissionFlagsBits } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

// ================= AGENT RANKS =================
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT", zh: "神经新兵", ar: "مجند عصبي" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT", zh: "外勤特工", ar: "وكيل ميداني" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST", zh: "网络专家", ar: "مختص سيبراني" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER", zh: "BKO 指挥官", ar: "قائد BKO" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT", zh: "系统架构师", ar: "مهندس النظام" }, color: "#e74c3c", emoji: "👑" }
];

function getRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1];
}

// ================= PER-SERVER ECONOMY HELPERS =================
function getEconomySettings(guildId) {
    if (!guildId) return { currencyName: 'credits', currencyEmoji: '🪙' };
    try {
        const Database = require('better-sqlite3');
        const db = new Database('./database.sqlite', { readonly: true });
        const settings = db.prepare('SELECT currency_name, currency_emoji FROM server_economy_settings WHERE guild_id = ?').get(guildId);
        db.close();
        return {
            currencyName: settings?.currency_name || 'credits',
            currencyEmoji: settings?.currency_emoji || '🪙'
        };
    } catch (e) {
        return { currencyName: 'credits', currencyEmoji: '🪙' };
    }
}

// ================= CURRENCY HELPER =================
const fmt = (amt, emoji) => `${(amt || 0).toLocaleString()} ${emoji}`;

// ================= BILINGUAL TRANSLATIONS =================

module.exports = {
    name: 'credit',
    aliases: ['credits', 'bal', 'balance', 'crédits', 'solde', 'pay', 'transfer', 'donate', 'send'],
    description: '💰 Access the Neural Bank of Bamako — check balances, transfer, and view leaderboards.',
    category: 'ECONOMY',
    usage: '.bal [@user] | .pay @user <amount>',
    examples: ['.bal', '.bal @user', '.pay @user 500'],
    cooldown: 2000,

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('credit')
        .setDescription('💰 Access the Neural Bank of Bamako')
        .addSubcommand(sub => sub.setName('balance').setDescription('Check balance').addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false)))
        .addSubcommand(sub => sub.setName('pay').setDescription('Transfer credits').addUserOption(o => o.setName('recipient').setDescription('Recipient').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
        .addSubcommand(sub => sub.setName('leaderboard').setDescription('View top agents')),

    // ================= TEXT COMMAND HANDLER =================
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const OKL = ['en', 'fr', 'bm', 'zh', 'ar'];
        lang = OKL.includes(serverSettings?.language) ? serverSettings.language : (OKL.includes(lang) ? lang : 'en');
        const t = (k, v) => i18n.t('credit.' + k, lang, v);
        const prefix = serverSettings?.prefix || '.';

        // PER-SERVER: Extract guildId for composite key lookups
        const guildId = message.guild?.id || 'DM';
        const economySettings = getEconomySettings(guildId);
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const version = client.version || '2.0.0';

        // Command routing
        const payAliases = ['pay', 'transfer', 'donate', 'send', 'envoyer', 'payer', 'transférer'];
        const balAliases = ['credit', 'credits', 'bal', 'balance', 'crédits', 'solde'];
        const lbAliases = ['lb', 'leaderboard', 'top', 'classement', 'rich'];
        const cmd = usedCommand ? String(usedCommand).toLowerCase() : '';
        if (payAliases.includes(cmd)) return handlePay(message, args, client, db, serverSettings, lang, t, prefix, guildId, economySettings, guildName, guildIcon, version);
        if (lbAliases.includes(cmd)) return handleLeaderboard(message, client, db, lang, t, guildId, economySettings, guildName, guildIcon, version);
        return handleBalance(message, args, client, db, lang, t, guildId, economySettings, guildName, guildIcon, version);
    },

    // ================= SLASH EXECUTION =================
    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const _l = (interaction.guild ? client.getServerSettings(interaction.guild.id) : { language: 'en' })?.language || 'en';
        const lang = ['en','fr','bm','zh','ar'].includes(_l) ? _l : 'en';
        const t = (k, v) => i18n.t('credit.' + k, lang, v);
        const prefix = interaction.guild ? (client.getServerSettings?.(interaction.guild.id)?.prefix || '.') : '.';
        const guildId = interaction.guild?.id || 'DM';
        const economySettings = getEconomySettings(guildId);
        const guildName = interaction.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = interaction.guild?.iconURL() || client.user.displayAvatarURL();
        const version = client.version || '2.0.0';
        const serverSettings = interaction.guild ? client.getServerSettings?.(interaction.guild.id) || {} : {};
        const db = client.db;

        // Collection-compatible mentions helper for slash commands
        const buildMentions = (targetUser) => {
            const userMap = targetUser ? new Map([[targetUser.id, targetUser]]) : new Map();
            return {
                users: {
                    _map: userMap,
                    first() { return this._map.values().next().value || null; },
                    get(id) { return this._map.get(id); },
                    has(id) { return this._map.has(id); },
                    get size() { return this._map.size; },
                    [Symbol.iterator]() { return this._map.values(); }
                },
                members: { first: () => null },
                roles: { first: () => null },
                channels: { first: () => null },
                everyone: false,
                repliedUser: null
            };
        };

        if (sub === 'pay') {
            const target = interaction.options.getUser('recipient');
            const amount = interaction.options.getInteger('amount');
            const fakeArgs = ['', target?.toString(), amount?.toString()];
            const fakeMessage = {
                author: interaction.user, guild: interaction.guild, channel: interaction.channel,
                mentions: buildMentions(target),
                reply: async (opts) => interaction.reply({ ...opts }).catch(() => null),
                react: () => Promise.resolve()
            };
            return handlePay(fakeMessage, fakeArgs, client, db, serverSettings, lang, t, prefix, guildId, economySettings, guildName, guildIcon, version);
        }
        if (sub === 'leaderboard') {
            const fakeMessage = {
                author: interaction.user, guild: interaction.guild, channel: interaction.channel,
                mentions: buildMentions(),
                reply: async (opts) => interaction.reply({ ...opts }).catch(() => null)
            };
            return handleLeaderboard(fakeMessage, client, db, lang, t, guildId, economySettings, guildName, guildIcon, version);
        }
        const targetUser = interaction.options.getUser('user');
        const fakeMessage = {
            author: interaction.user, guild: interaction.guild, channel: interaction.channel,
            mentions: buildMentions(targetUser),
            reply: async (opts) => interaction.reply({ ...opts }).catch(() => null)
        };
        return handleBalance(fakeMessage, [], client, db, lang, t, guildId, economySettings, guildName, guildIcon, version);
    }
};

// ================= HANDLE BALANCE =================
async function handleBalance(message, args, client, db, lang, t, guildId, economySettings, guildName, guildIcon, version) {
    const target = message.mentions.users.first() || message.author;
    const userId = target.id;
    const userName = target.username;
    const avatarURL = target.displayAvatarURL({ dynamic: true, size: 256 });

    // PER-SERVER: Direct DB lookup (no cache)
let userData = db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);

    if (!userData) {
        // Create per-server user record with composite PK
        db.prepare("INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_dailies, highest_streak) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0)").run(userId, guildId, userName);
        userData = { credits: 0, xp: 0, level: 1 };
    }

    const credits = userData.credits || 0;
    const xp = userData.xp || 0;
    const level = calculateLevel(xp);
    const rank = getRank(level);

    const embed = new EmbedBuilder()
        .setColor(rank.color)
        .setAuthor({ name: `${rank.emoji} ${userName} • ${t('balanceTitle')}`, iconURL: avatarURL })
        .setDescription(
            `## ${rank.emoji} ${t('balanceOf', { name: userName })}\n` +
            `\`\`\`yaml\n💰 ${credits.toLocaleString()} ${economySettings.currencyEmoji}\n\`\`\``
        )
        .addFields(
            { name: `${resolveEmoji('level', message) || '📊'} ${t('levelField')}`, value: `${level}`, inline: true },
            { name: `${resolveEmoji('crown', message) || '🎖️'} ${t('rankField')}`, value: `${rank.emoji} ${rank.title[lang] || rank.title.en}`, inline: true },
            { name: `${resolveEmoji('xp', message) || '📈'} XP`, value: `${xp.toLocaleString()}`, inline: true }
        )
        .setFooter({ text: `${t('guildContext', { name: guildName })} • ${t('embedFooter')} • v${version}`, iconURL: guildIcon })
        .setTimestamp();

    // Button row
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('credit_lb').setLabel(t('leaderboardBtn')).setStyle(ButtonStyle.Secondary).setEmoji(resolveEmoji('trophy', message) || '🏆'),
        new ButtonBuilder().setCustomId('credit_pay').setLabel(t('transferBtn')).setStyle(ButtonStyle.Primary).setEmoji(resolveEmoji('cashmoney', message) || '💸'),
        new ButtonBuilder().setCustomId('credit_shop').setLabel(t('shopBtn')).setStyle(ButtonStyle.Success).setEmoji('🛒')
    );

    const sent = await message.reply({ embeds: [embed], components: [actionRow] }).catch(() => null);
    if (!sent) return;

    // Collector
    const collector = sent.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 60000 });
    collector.on('collect', async (i) => {
    await i.deferUpdate().catch(() => {});
    if (i.customId === 'credit_lb') {
        const lbMessage = {
            ...message,
            reply: (opts) => i.followUp({ ...opts }).catch(() => null)
        };
        await handleLeaderboard(lbMessage, client, db, lang, t, guildId, economySettings, guildName, guildIcon, version);
    } else if (i.customId === 'credit_pay') {
        await i.followUp({ content: `\`${t('transferPrompt')}\``, flags: 64 }).catch(() => {});
    } else if (i.customId === 'credit_shop') {
        const shopCmd = client.commands.get('shop');
        if (shopCmd) {
            const fakeMsg = { author: message.author, guild: message.guild, channel: message.channel, content: '.shop', reply: (opts) => message.channel.send(opts).catch(() => {}), react: () => Promise.resolve() };
            const srvSettings = message.guild ? client.getServerSettings?.(message.guild.id) || {} : {};
            shopCmd.run(client, fakeMsg, [], db, srvSettings, 'shop');
        }
    }
});
}

// ================= HANDLE PAY (TRANSFER) =================
async function handlePay(message, args, client, db, serverSettings, lang, t, prefix, guildId, economySettings, guildName, guildIcon, version) {
    const senderId = message.author.id;
    const senderName = message.author.username;

    // PER-SERVER: Composite key lookup for sender
    let senderData = db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(senderId, guildId);

    if (!senderData) {
        db.prepare("INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_dailies, highest_streak) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0)").run(senderId, guildId, senderName);
        senderData = { credits: 0 };
    }

    const target = message.mentions.users.first();
    if (!target) return message.reply(`❌ ${t('mentionUser')}. ${t('transferPrompt')}`).catch(() => {});
    if (target.id === senderId) return message.reply(t('selfTransfer')).catch(() => {});

    const amount = parseInt(args[1]) || parseInt(args[2]);
    if (!amount || amount <= 0) return message.reply(t('invalidAmount')).catch(() => {});

    const taxRate = serverSettings?.transferTax || 0;
    const totalCost = Math.ceil(amount * (1 + taxRate));

    if ((senderData.credits || 0) < totalCost) {
        return message.reply(`${t('insufficient')} **${(senderData.credits || 0).toLocaleString()} ${economySettings.currencyEmoji}**.`).catch(() => {});
    }

    // PER-SERVER: Composite key lookup for receiver
    let receiverData = db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(target.id, guildId);

    if (!receiverData) {
        db.prepare("INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_dailies, highest_streak) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0)").run(target.id, guildId, target.username);
        receiverData = { credits: 0 };
    }

    const senderNewBal = (senderData.credits || 0) - totalCost;
    const receiverNewBal = (receiverData.credits || 0) + amount;

    try {
        // PER-SERVER: Both UPDATEs include guild_id
        db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(senderNewBal, senderId, guildId);
        db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(receiverNewBal, target.id, guildId);

        // Log transfer
        db.prepare("INSERT INTO transfers (sender_id, receiver_id, amount, timestamp, platform) VALUES (?, ?, ?, ?, 'discord')").run(senderId, target.id, amount, Date.now());

        // Update cache with composite keys
        const senderCacheKey = `${senderId}:${guildId}`;
        const receiverCacheKey = `${target.id}:${guildId}`;
        if (client.userDataCache) {
            client.userDataCache.delete(senderCacheKey);
            client.userDataCache.delete(receiverCacheKey);
        }

        // Transfer embed
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: `💸 ${t('transferSuccess')}`, iconURL: message.author.displayAvatarURL() })
            .setDescription(t('transferComplete', { from: senderName, to: target.username, amount: fmt(amount, economySettings.currencyEmoji) }))
            .addFields(
                { name: t('senderNewBal'), value: fmt(senderNewBal, economySettings.currencyEmoji), inline: true },
                { name: t('receiverNewBal'), value: fmt(receiverNewBal, economySettings.currencyEmoji), inline: true }
            )
            .setFooter({ text: `${guildName} • ${t('embedFooter')} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});

        // DM notification to receiver
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: t('transferReceived'), iconURL: message.author.displayAvatarURL() })
                .setDescription(t('transferReceivedFrom', { from: senderName, amount: fmt(amount, economySettings.currencyEmoji) }))
                .addFields({ name: t('newBalance'), value: fmt(receiverNewBal, economySettings.currencyEmoji), inline: true })
                .setFooter({ text: `${guildName} • ${t('embedFooter')}`, iconURL: guildIcon })
                .setTimestamp();
            await target.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch (e) {}

    } catch (err) {
        console.error('[PAY ERROR]', err);
        return message.reply(t('transactionFailed')).catch(() => {});
    }
}

// ================= HANDLE LEADERBOARD =================
async function handleLeaderboard(message, client, db, lang, t, guildId, economySettings, guildName, guildIcon, version) {
    // PER-SERVER: Only show users from this guild using composite key
    const entries = db.prepare("SELECT username, credits, xp, level FROM users WHERE guild_id = ? AND credits > 0 ORDER BY credits DESC LIMIT 15").all(guildId);

    if (entries.length === 0) {
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(t('noData')).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })] }).catch(() => {});
    }

    const medals = ['🥇', '🥈', '🥉'];
    const list = entries.map((e, i) => {
        const medal = medals[i] || `\`#${i + 1}\``;
        const rank = getRank(e.level || calculateLevel(e.xp || 0));
        return `${medal} **${e.username || 'Unknown'}** ${rank.emoji} • ${fmt(e.credits || 0, economySettings.currencyEmoji)}`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setAuthor({ name: t('leaderboardTitle'), iconURL: guildIcon })
        .setDescription(`\`\`\`yaml\n${list}\`\`\``)
        .setFooter({ text: `${guildName} • ${t('footer')} • v${version}`, iconURL: guildIcon })
        .setTimestamp();

    await message.reply({ embeds: [embed] }).catch(() => {});
}
