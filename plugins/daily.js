const mentions = require('../lib/mentions');
const i18n = require('../lib/i18n');
const { ns } = require('../lib/lang');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const EMOJIS = require('../config/emojis');

// ================= BILINGUAL TRANSLATIONS =================

module.exports = {
    name: 'daily',
    aliases: ['dailyreward', 'quotidien'],
    description: '📅 View your daily status and statistics.',
    category: 'ECONOMY',
    cooldown: 5000,
    usage: '.daily [stats]',
    examples: ['.daily', '.daily stats', '/daily', '/daily stats'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('📅 View your daily status and statistics')
    .addSubcommand(sub =>
        sub.setName('check').setDescription('✅ Check if your daily reward is ready')
    )
    .addSubcommand(sub =>
        sub.setName('stats').setDescription('📊 View your daily streak statistics')
    ),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        // Priority: 1) French aliases (quotidien, journalier), 2) guild locale, 3) detectLanguage
        const frenchAliases = ['quotidien', 'journalier', 'journalière', 'qotd'];
        const isFrenchAlias = usedCommand && frenchAliases.some(a => usedCommand.toLowerCase().includes(a));
        const guildId = message.guild?.id || 'DM';
        const OKL = ['en', 'fr', 'bm', 'zh', 'ar'];
        lang = OKL.includes(serverSettings?.language) ? serverSettings.language : (isFrenchAlias ? 'fr' : 'en');
        const t = (k, v) => i18n.t('daily.' + k, lang, v);
        const prefix = serverSettings?.prefix || '.';

        if (args[0]?.toLowerCase() === 'stats') {
            return module.exports.showStats(client, message, db, prefix, lang, t, false);
        }

        return module.exports.showCheck(client, message, db, prefix, lang, t, false);
    },

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        await interaction.deferReply().catch(() => {});

        // Use Discord's locale for slash commands (respects user's client language)
        // Fallback to detectLanguage for prefix-style detection
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr', 'bm', 'zh', 'ar']);
        const t = (k, v) => i18n.t('daily.' + k, lang, v);
        const prefix = interaction.guild ? (client.getServerSettings(interaction.guild.id)?.prefix || '.') : '.';
        const subcommand = interaction.options.getSubcommand(false);

        try {
            if (subcommand === 'stats') {
                return await module.exports.showStats(client, interaction, client.db, prefix, lang, t, true);
            }
            return await module.exports.showCheck(client, interaction, client.db, prefix, lang, t, true);
        } catch (err) {
            throw err; // Let the global error handler catch it
        }
    },

    // ================= SHOW CHECK (Dashboard) =================
    showCheck: async (client, context, db, prefix, lang, t, isSlash) => {
        const user = isSlash ? context.user : context.author;
        const userId = user.id;
        const username = user.username;
        const guild = context.guild;
        const version = client.version || '2.0.0';
        const guildName = guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = guild?.iconURL() || client.user.displayAvatarURL();

        // PER-SERVER: Composite key requires guildId
        const guildId = guild?.id || 'DM';

        const reply = async (options) => {
            if (isSlash) {
                // execute() calls deferReply() first, so always use editReply
                return context.editReply(options).catch(() => context.followUp(options));
            }
            return context.reply(options);
        };

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        // COMPOSITE KEY LOOKUP: WHERE id = ? AND guild_id = ?
        let userData = client.getUserData
            ? client.getUserData(userId, guildId)
            : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);

        if (!userData) {
            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setAuthor({ name: `👏 Daily Check: @${username}`, iconURL: user.displayAvatarURL() })
                .setDescription(`## ${resolveEmoji('error', context)} ${t('noAccount')}`)
                .setFooter({ text: `${guildName} • ${t('footer')} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return reply({ embeds: [embed] });
        }

        let lastDaily = parseInt(userData.last_daily) || 0;
        if (lastDaily > 0 && lastDaily < 10000000000) lastDaily *= 1000;

        const streakDays = parseInt(userData.streak_days) || 0;
        const balance = parseInt(userData.credits) || 0;
        const totalDailies = parseInt(userData.total_dailies) || 0;
        const streakProtections = parseInt(userData.streak_protections) || 0;

        const canClaim = lastDaily === 0 || (now - lastDaily) >= oneDay;

        let statusEmoji, statusText, timeInfo;
        if (canClaim) {
            statusEmoji = '✅';
            statusText = t('readyToClaim');
            timeInfo = t('useClaim');
        } else {
            statusEmoji = '✅';
            statusText = t('onCooldown');
            const timeLeft = oneDay - (now - lastDaily);
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            timeInfo = `${t('comeBack')} ${hours}h ${minutes}m`;
        }

        const statusAnsi = canClaim ? '\u001b[1;32m' : '\u001b[1;31m';
        const embed = new EmbedBuilder()
            .setColor(canClaim ? '#2ecc71' : '#e74c3c')
            .setAuthor({ name: `📅 NEURAL DAILY · @${username}`, iconURL: user.displayAvatarURL() })
            .setDescription(
                '```ansi\n' +
                statusAnsi + '\u25b8 STATUS   \u001b[0m' + statusEmoji + ' ' + statusText + '\n' +
                '\u001b[1;36m\u25b8 STREAK   \u001b[0m' + streakDays + ' ' + (streakDays === 1 ? t('day') : t('days')) + ' \uD83D\uDD25\n' +
                '\u001b[1;36m\u25b8 DAILIES  \u001b[0m' + totalDailies + '\n' +
                '\u001b[1;36m\u25b8 BALANCE  \u001b[0m' + balance.toLocaleString() + ' \uD83E\uDE99\n' +
                '\u001b[1;36m\u25b8 SHIELDS  \u001b[0m' + streakProtections + '\n' +
                '```\n\n**Ready to claim?** Use ' + mentions(client, 'claim')
            )
            .setFooter({ text: `${guildName} · NEURAL DAILY · BAMAKO_223 \uD83C\uDDF2\uD83C\uDDF1` })
            .setTimestamp();

        await reply({ embeds: [embed] });
    },

    // ================= SHOW STATS =================
    showStats: async (client, context, db, prefix, lang, t, isSlash) => {
        const user = isSlash ? context.user : context.author;
        const userId = user.id;
        const username = user.username;
        const guild = context.guild;
        const version = client.version || '2.0.0';
        const guildName = guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = guild?.iconURL() || client.user.displayAvatarURL();

        // PER-SERVER: Composite key requires guildId
        const guildId = guild?.id || 'DM';

        const reply = async (options) => {
            if (isSlash) {
                // execute() calls deferReply() first, so always use editReply
                return context.editReply(options).catch(() => context.followUp(options));
            }
            return context.reply(options);
        };

        // COMPOSITE KEY LOOKUP: WHERE id = ? AND guild_id = ?
        let userData = client.getUserData
            ? client.getUserData(userId, guildId)
            : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);

        if (!userData) {
            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setAuthor({ name: `👏 Daily Stats: @${username}`, iconURL: user.displayAvatarURL() })
                .setDescription(`${resolveEmoji('error', context)} ${t('noAccount')}`)
                .setFooter({ text: `${guildName} • ${t('footer')} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return reply({ embeds: [embed] });
        }

        const streakDays = parseInt(userData.streak_days) || 0;
        const highestStreak = parseInt(userData.highest_streak) || 0;
        const totalDailies = parseInt(userData.total_dailies) || 0;
        const streakProtections = parseInt(userData.streak_protections) || 0;
        let lastDaily = parseInt(userData.last_daily) || 0;
        if (lastDaily > 0 && lastDaily < 10000000000) lastDaily *= 1000;

        let lastDailyText = t('never');
        if (lastDaily > 0) lastDailyText = `<t:${Math.floor(lastDaily / 1000)}:R>`;

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: `📊 DAILY STATS · @${username}`, iconURL: user.displayAvatarURL() })
            .setDescription(
                '```ansi\n' +
                '\u001b[1;36m\u25b8 TOTAL    \u001b[0m' + totalDailies + ' dailies\n' +
                '\u001b[1;33m\u25b8 STREAK   \u001b[0m' + streakDays + ' ' + (streakDays === 1 ? t('day') : t('days')) + ' \uD83D\uDD25\n' +
                '\u001b[1;33m\u25b8 BEST     \u001b[0m' + highestStreak + ' ' + (highestStreak === 1 ? t('day') : t('days')) + '\n' +
                '\u001b[1;35m\u25b8 SHIELDS  \u001b[0m' + streakProtections + ' \uD83D\uDEE1\uFE0F\n' +
                '```' +
                '\n\uD83D\uDCC5 **Last claim:** ' + lastDailyText
            )
            .setFooter({ text: `${guildName} \u00b7 NEURAL DAILY \u00b7 BAMAKO_223 \uD83C\uDDF2\uD83C\uDDF1` })
            .setTimestamp();

        await reply({ embeds: [embed] });
    }
};
