const cmdSlash = require('../lib/cmd').slash;
const i18n = require('../lib/i18n');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, SlashCommandBuilder } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const { pickLang } = require('../lib/pick-lang');

module.exports = {
    name: 'daily',
    aliases: ['dailyreward', 'quotidien'],
    description: '📅 View your daily status and statistics.',
    category: 'ECONOMY',
    cooldown: 5000,
    usage: '.daily [stats]',
    examples: ['.daily', '.daily stats', '/daily', '/daily stats'],

    data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('📅 View your daily status and statistics')
    .addSubcommand(sub => sub.setName('check').setDescription('✅ Check if your daily reward is ready'))
    .addSubcommand(sub => sub.setName('stats').setDescription('📊 View your daily streak statistics')),

    run: async (client, message, args, db, serverSettings) => {
        const lang = pickLang(client, message.guild?.id, message, message.author.id);
        const t = (k, v) => i18n.t('daily.' + k, lang, v);
        const prefix = serverSettings?.prefix || '.';

        if (args[0]?.toLowerCase() === 'stats') {
            return module.exports.showStats(client, message, db, prefix, lang, t, false);
        }
        return module.exports.showCheck(client, message, db, prefix, lang, t, false);
    },

    execute: async (interaction, client) => {
        await interaction.deferReply({ flags: 64 }).catch(() => {});
        const lang = pickLang(client, interaction.guildId, interaction, interaction.user.id);
        const t = (k, v) => i18n.t('daily.' + k, lang, v);
        const prefix = interaction.guild ? (client.getServerSettings(interaction.guild.id)?.prefix || '.') : '.';
        const subcommand = interaction.options.getSubcommand(false);

        if (subcommand === 'stats') {
            return await module.exports.showStats(client, interaction, client.db, prefix, lang, t, true);
        }
        return await module.exports.showCheck(client, interaction, client.db, prefix, lang, t, true);
    },

    showCheck: async (client, context, db, prefix, lang, t, isSlash) => {
        const user = isSlash ? context.user : context.author;
        const userId = user.id;
        const guild = context.guild;
        const guildId = guild?.id || 'DM';

        const reply = async (options) => {
            if (isSlash) return context.editReply(options);
            return context.reply(options);
        };

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        let userData = client.getUserData
            ? client.getUserData(userId, guildId)
            : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);

        const c = new ContainerBuilder().setAccentColor(0xf1c40f);

        if (!userData) {
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${resolveEmoji('error', context) || em('ic_off', '❌')} ${t('noAccount')}`));
            return reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
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
            statusEmoji = em('ic_ok', '✅');
            statusText = t('readyToClaim');
            timeInfo = t('useClaim');
            c.setAccentColor(0x2ecc71);
        } else {
            statusEmoji = em('ic_ok', '✅');
            statusText = t('onCooldown');
            const timeLeft = oneDay - (now - lastDaily);
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            timeInfo = `${t('comeBack')} **${hours}h ${minutes}m**`;
            c.setAccentColor(0xe74c3c);
        }

        const statusAnsi = canClaim ? '\u001b[1;32m' : '\u001b[1;31m';
        
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_chart', '📅')} Daily reward · @${user.username}`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        
        const statusLine = canClaim 
            ? `${em('ic_ok', '✅')} **${statusText}**` 
            : `${em('ic_off', '❌')} **${statusText}** - ${timeInfo}`;

        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `${statusLine}\n\n` +
            `${em('ic_streak', '🔥')} **${t('streak') || 'Streak'}:** ${streakDays} ${streakDays === 1 ? t('day') : t('days')}\n` +
            `${em('ic_calendar', '🗓️')} **${t('totalDailies') || 'Total'}:** ${totalDailies}\n` +
            `${em('ic_credit', '🪙')} **${t('balance') || 'Balance'}:** ${balance.toLocaleString()}\n` +
            `${em('ic_shield', '🛡️')} **${t('shields') || 'Shields'}:** ${streakProtections}`
        ));
        
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Ready to claim?** Use ${cmdSlash(client, 'claim', { guild: context.guild })}\n-# ${guild?.name?.toUpperCase() || 'DM'} · Daily reward · BAMAKO_223 🇲🇱`));

        await reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    },

    showStats: async (client, context, db, prefix, lang, t, isSlash) => {
        const user = isSlash ? context.user : context.author;
        const userId = user.id;
        const guild = context.guild;
        const guildId = guild?.id || 'DM';

        const reply = async (options) => {
            if (isSlash) return context.editReply(options);
            return context.reply(options);
        };

        let userData = client.getUserData
            ? client.getUserData(userId, guildId)
            : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);

        const c = new ContainerBuilder().setAccentColor(0x3498db);

        if (!userData) {
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${resolveEmoji('error', context) || em('ic_off', '❌')} ${t('noAccount')}`));
            return reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        const streakDays = parseInt(userData.streak_days) || 0;
        const highestStreak = parseInt(userData.highest_streak) || 0;
        const totalDailies = parseInt(userData.total_dailies) || 0;
        const streakProtections = parseInt(userData.streak_protections) || 0;
        let lastDaily = parseInt(userData.last_daily) || 0;
        if (lastDaily > 0 && lastDaily < 10000000000) lastDaily *= 1000;

        let lastDailyText = t('never');
        if (lastDaily > 0) lastDailyText = `<t:${Math.floor(lastDaily / 1000)}:R>`;

        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('charts', '📊')} DAILY STATS · @${user.username}`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `${em('ic_calendar', '🗓️')} **${t('totalDailies') || 'Total Dailies'}:** ${totalDailies}\n` +
            `${em('ic_streak', '🔥')} **${t('streak') || 'Streak'}:** ${streakDays} ${streakDays === 1 ? t('day') : t('days')}\n` +
            `🏆 **${t('bestStreak') || 'Best Streak'}:** ${highestStreak} ${highestStreak === 1 ? t('day') : t('days')}\n` +
            `${em('ic_shield', '🛡️')} **${t('shields') || 'Shields'}:** ${streakProtections}\n\n` +
            `📅 **${t('lastClaim') || 'Last claim'}:** ${lastDailyText}`
        ));
        
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${guild?.name?.toUpperCase() || 'DM'} · Daily reward · BAMAKO_223 🇲🇱`));

        await reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    }
};
