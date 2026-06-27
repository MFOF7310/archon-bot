const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const dailyTranslations = {
    en: {
        title: '📅 DAILY REWARD',
        claimed: '✅ DAILY REWARD CLAIMED!',
        alreadyClaimed: '⏰ ALREADY CLAIMED',
        comeBack: 'Come back in',
        hours: 'hours',
        minutes: 'minutes',
        baseReward: 'Base Reward',
        streakBonus: 'Streak Bonus',
        totalEarned: 'Total Earned',
        xpEarned: 'XP Earned',
        newBalance: 'New Balance',
        currentStreak: 'Current Streak',
        days: 'days',
        day: 'day',
        verifyWith: 'Verify with',
        checkBalance: (prefix) => `Check your balance anytime with \`${prefix}bal\` or \`${prefix}credits\``,
        footer: 'NEURAL DAILY • CLAIM EVERY 24H',
        streakMilestone: '🔥 STREAK MILESTONE!',
        bonusAdded: 'Bonus added',
        levelUp: '🎉 LEVEL UP!',
        reachedLevel: 'You reached level',
        noAccount: '❌ No data found. Use /claim to start!',
        readyToClaim: 'Ready to claim!',
        onCooldown: 'On cooldown',
        useClaim: 'Use `/claim`',
        totalDailies: 'Total Dailies',
        lastDaily: 'Last Daily',
        highestStreak: 'Highest Streak',
        streakProtections: 'Streak Protections',
        never: 'Never'
    },
    fr: {
        title: '📅 RÉCOMPENSE QUOTIDIENNE',
        claimed: '✅ RÉCOMPENSE QUOTIDIENNE RÉCLAMÉE !',
        alreadyClaimed: '⏰ DÉJÀ RÉCLAMÉ',
        comeBack: 'Revenez dans',
        hours: 'heures',
        minutes: 'minutes',
        baseReward: 'Récompense de Base',
        streakBonus: 'Bonus de Série',
        totalEarned: 'Total Gagné',
        xpEarned: 'XP Gagnés',
        newBalance: 'Nouveau Solde',
        currentStreak: 'Série Actuelle',
        days: 'jours',
        day: 'jour',
        verifyWith: 'Vérifiez avec',
        checkBalance: (prefix) => `Vérifiez votre solde avec \`${prefix}bal\` ou \`${prefix}credits\``,
        footer: 'NEURAL DAILY • RÉCLAMEZ TOUTES LES 24H',
        streakMilestone: '🔥 JALON DE SÉRIE !',
        bonusAdded: 'Bonus ajouté',
        levelUp: '🎉 NIVEAU SUPÉRIEUR !',
        reachedLevel: 'Vous avez atteint le niveau',
        noAccount: '❌ Aucune donnée trouvée. Utilisez /claim pour commencer!',
        readyToClaim: 'Prêt à réclamer!',
        onCooldown: 'En cooldown',
        useClaim: 'Utilisez `/claim`',
        totalDailies: 'Total Réclamations',
        lastDaily: 'Dernière Réclamation',
        highestStreak: 'Meilleure Série',
        streakProtections: 'Protections',
        never: 'Jamais'
    }
};

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
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        // Priority: 1) French aliases (quotidien, journalier), 2) guild locale, 3) detectLanguage
        const frenchAliases = ['quotidien', 'journalier', 'journalière', 'qotd'];
        const isFrenchAlias = usedCommand && frenchAliases.some(a => usedCommand.toLowerCase().includes(a));
        const lang = isFrenchAlias ? 'fr' :
                     (message.guild?.preferredLocale?.startsWith('fr') ? 'fr' :
                     (client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en'));
        const t = dailyTranslations[lang];
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
        const lang = interaction.locale?.startsWith('fr') ? 'fr' :
                     (client.detectLanguage ? client.detectLanguage('daily', 'en') : 'en');
        const t = dailyTranslations[lang];
        const prefix = interaction.guild ? (client.getServerSettings(interaction.guild.id)?.prefix || '.') : '.';
        const subcommand = interaction.options.getSubcommand(false);

        try {
            if (subcommand === 'stats') {
                return await module.exports.showStats(client, interaction, client.db, prefix, lang, t, true);
            }
            return await module.exports.showCheck(client, interaction, client.db, prefix, lang, t, true);
        } catch (err) {
            console.error(`[DAILY SLASH ERROR] ${err.message}`);
            return interaction.editReply({
                content: '❌ Something went wrong. Try again in a moment.',
                flags: 64
            }).catch(() => {});
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
                .setDescription(`## ❌ ${t.noAccount}`)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
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
            statusText = t.readyToClaim;
            timeInfo = t.useClaim;
        } else {
            statusEmoji = '⏰';
            statusText = t.onCooldown;
            const timeLeft = oneDay - (now - lastDaily);
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            timeInfo = `${t.comeBack} ${hours}h ${minutes}m`;
        }

        const embed = new EmbedBuilder()
            .setColor(canClaim ? '#2ecc71' : '#e74c3c')
            .setAuthor({ name: `👏 Bon Clay: @${username}, here are your daily stats:`, iconURL: user.displayAvatarURL() })
            .setDescription(
                `## ${statusEmoji} ${statusText}\n` +
                `### ${timeInfo}\n` +
                `---\n` +
                `📊 **${t.totalDailies}:** ${totalDailies}\n` +
                `🔥 **${t.currentStreak}:** ${streakDays} ${streakDays === 1 ? t.day : t.days}\n` +
                `💰 **${t.newBalance}:** ${balance.toLocaleString()} 🪙\n` +
                `🛡️ **${t.streakProtections}:** ${streakProtections}\n\n` +
                `💡 *${t.checkBalance(prefix)}*`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
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
                .setDescription(`❌ ${t.noAccount}`)
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            return reply({ embeds: [embed] });
        }

        const streakDays = parseInt(userData.streak_days) || 0;
        const highestStreak = parseInt(userData.highest_streak) || 0;
        const totalDailies = parseInt(userData.total_dailies) || 0;
        const streakProtections = parseInt(userData.streak_protections) || 0;
        let lastDaily = parseInt(userData.last_daily) || 0;
        if (lastDaily > 0 && lastDaily < 10000000000) lastDaily *= 1000;

        let lastDailyText = t.never;
        if (lastDaily > 0) lastDailyText = `<t:${Math.floor(lastDaily / 1000)}:R>`;

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: `👏 Daily Stats: @${username}`, iconURL: user.displayAvatarURL() })
            .setDescription(
                `📊 **${t.totalDailies}:** ${totalDailies}\n` +
                `📅 **${t.lastDaily}:** ${lastDailyText}\n\n` +
                `🔥 **${t.currentStreak}:** ${streakDays} ${streakDays === 1 ? t.day : t.days}\n` +
                `🔥 **${t.highestStreak}:** ${highestStreak} ${highestStreak === 1 ? t.day : t.days}\n` +
                `🛡️ **${t.streakProtections}:** ${streakProtections}`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        await reply({ embeds: [embed] });
    }
};
