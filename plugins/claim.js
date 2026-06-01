const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp)) + 1; 
}

// ================= BILINGUAL TRANSLATIONS =================
const claimTranslations = {
    en: {
        title: '⚡ NEURAL CLAIM PROTOCOL',
        successTitle: '✅ RESOURCES INJECTED',
        cooldownTitle: '🔒 ACCESS DENIED',
        cooldownDesc: (name, time, prefix) => `**Agent ${name}**, your neural cycle is still processing.\n\n⏳ **Cooldown Remaining:** \`${time}\`\n\n💡 Use \`${prefix}daily\` to view your full dashboard.`,
        successDesc: (credits, xp, streak) => 
            `**Agent**, your daily resources have been successfully injected.\n\n` +
            `┌─ 📦 **REWARDS RECEIVED** ─────────\n` +
            `│  💰 **Credits:** +${credits.toLocaleString()}\n` +
            `│  📈 **XP:** +${xp.toLocaleString()}\n` +
            `│  🔥 **Streak:** ${streak} day${streak > 1 ? 's' : ''}\n` +
            `└──────────────────────────────────`,
        streakBonus: '🔥 STREAK BONUS ACTIVE',
        streakInfo: (streak, bonusXP, bonusCredits) => 
            `┌─ ✨ **${streak} Day Streak!** ─────────\n` +
            `│  ⚡ **Bonus XP:** +${bonusXP}\n` +
            `│  💎 **Bonus Credits:** +${bonusCredits}\n` +
            `└──────────────────────────────────`,
        nextClaim: '⏰ NEXT CLAIM AVAILABLE',
        currentStats: '📊 CURRENT STATISTICS',
        viewDashboard: '📊 Dashboard',
        myProfile: '👤 My Profile',
        error: '❌ An error occurred during claim processing.',
        accessDenied: '❌ These controls are locked to your session.',
        channelRestricted: (channelId) => `📊 The claim protocol is restricted to <#${channelId}>.`,
        dashboardOpened: '📊 Dashboard displayed above!',
        profileOpened: '👤 Profile displayed above!'
    },
    fr: {
        title: '⚡ PROTOCOLE DE RÉCLAMATION NEURALE',
        successTitle: '✅ RESSOURCES INJECTÉES',
        cooldownTitle: '🔒 ACCÈS REFUSÉ',
        cooldownDesc: (name, time, prefix) => `**Agent ${name}**, votre cycle neural est toujours en cours.\n\n⏳ **Temps restant:** \`${time}\`\n\n💡 Utilisez \`${prefix}daily\` pour voir votre tableau de bord.`,
        successDesc: (credits, xp, streak) => 
            `**Agent**, vos ressources quotidiennes ont été injectées.\n\n` +
            `┌─ 📦 **RÉCOMPENSES REÇUES** ─────────\n` +
            `│  💰 **Crédits:** +${credits.toLocaleString()}\n` +
            `│  📈 **XP:** +${xp.toLocaleString()}\n` +
            `│  🔥 **Série:** ${streak} jour${streak > 1 ? 's' : ''}\n` +
            `└──────────────────────────────────`,
        streakBonus: '🔥 BONUS DE SÉRIE ACTIF',
        streakInfo: (streak, bonusXP, bonusCredits) => 
            `┌─ ✨ **Série de ${streak} Jours!** ─────────\n` +
            `│  ⚡ **Bonus XP:** +${bonusXP}\n` +
            `│  💎 **Bonus Crédits:** +${bonusCredits}\n` +
            `└──────────────────────────────────`,
        nextClaim: '⏰ PROCHAINE RÉCLAMATION',
        currentStats: '📊 STATISTIQUES ACTUELLES',
        viewDashboard: '📊 Tableau de Bord',
        myProfile: '👤 Mon Profil',
        error: '❌ Une erreur est survenue lors de la réclamation.',
        accessDenied: '❌ Ces commandes sont verrouillées à votre session.',
        channelRestricted: (channelId) => `📊 Le protocole est restreint au canal <#${channelId}>.`,
        dashboardOpened: '📊 Tableau de bord affiché !',
        profileOpened: '👤 Profil affiché !'
    }
};

// ================= RANK TITLES =================
const AGENT_RANKS = [
    { minLevel: 1, maxLevel: 5, title: { fr: "RECRUE NEURALE", en: "NEURAL RECRUIT" }, color: "#2ecc71", emoji: "🌱" },
    { minLevel: 6, maxLevel: 15, title: { fr: "AGENT DE TERRAIN", en: "FIELD AGENT" }, color: "#3498db", emoji: "🔹" },
    { minLevel: 16, maxLevel: 30, title: { fr: "SPÉCIALISTE CYBER", en: "CYBER SPECIALIST" }, color: "#9b59b6", emoji: "💠" },
    { minLevel: 31, maxLevel: 50, title: { fr: "COMMANDANT BKO", en: "BKO COMMANDER" }, color: "#e67e22", emoji: "⚜️" },
    { minLevel: 51, maxLevel: Infinity, title: { fr: "ARCHITECTE SYSTÈME", en: "SYSTEM ARCHITECT" }, color: "#e74c3c", emoji: "👑" }
];

function getRank(level) { 
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1]; 
}

// ================= INLINE MINI DASHBOARD =================
// Builds a quick dashboard embed directly — avoids calling daily.js with stale context
function buildMiniDashboard(userData, lang, prefix, guildName, guildIcon, version) {
    const t = claimTranslations[lang];
    const streak = userData.streak_days || 0;
    const credits = userData.credits || 0;
    const xp = userData.xp || 0;
    const level = userData.level || calculateLevel(xp);
    const rank = getRank(level);
    const nextClaim = (userData.last_daily || 0) + (24 * 60 * 60 * 1000);
    const timeLeft = Math.max(0, nextClaim - Date.now());
    const hours = Math.floor(timeLeft / 3600000);
    const mins = Math.floor((timeLeft % 3600000) / 60000);

    return new EmbedBuilder()
        .setColor(rank.color)
        .setAuthor({ name: t.viewDashboard, iconURL: guildIcon })
        .setTitle(`${rank.emoji} ${rank.title[lang]}`)
        .setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;36mLevel:\u001b[0m    ${level}\n` +
            `\u001b[1;33mXP:\u001b[0m       ${xp.toLocaleString()}\n` +
            `\u001b[1;32mCredits:\u001b[0m  ${credits.toLocaleString()} 🪙\n` +
            `\u001b[1;31mStreak:\u001b[0m   ${streak} ${lang === 'fr' ? 'jours' : 'days'} 🔥\n` +
            `\u001b[1;35mNext:\u001b[0m     ${hours}h ${mins}m\n` +
            `\`\`\`\n` +
            `💡 **${lang === 'fr' ? 'Conseil' : 'Tip'}:** ` +
            (lang === 'fr'
                ? `Utilisez \`${prefix}daily\` pour un tableau complet.`
                : `Use \`${prefix}daily\` for a full dashboard.`)
        )
        .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
        .setTimestamp();
}

// ================= DAILY DM REMINDER SYSTEM =================
// Sends a DM to users when their daily is ready again. Persists across restarts.

function setupDailyReminderDB(database) {
    try {
        database.prepare(`
            CREATE TABLE IF NOT EXISTS daily_reminders (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                user_tag TEXT,
                guild_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                lang TEXT DEFAULT 'en',
                execute_at INTEGER NOT NULL,
                delivered INTEGER DEFAULT 0
            )
        `).run();
        database.prepare(`CREATE INDEX IF NOT EXISTS idx_daily_reminders_user ON daily_reminders(user_id, guild_id)`).run();
        database.prepare(`CREATE INDEX IF NOT EXISTS idx_daily_reminders_execute ON daily_reminders(execute_at)`).run();
    } catch (e) {
        console.error('[DAILY REMINDER DB] Setup failed:', e.message);
    }
}

function saveDailyReminder(database, reminder) {
    try {
        // Delete any existing pending reminder for this user+guild to avoid duplicates
        database.prepare(`DELETE FROM daily_reminders WHERE user_id = ? AND guild_id = ? AND delivered = 0`).run(reminder.userId, reminder.guildId);
        database.prepare(`
            INSERT INTO daily_reminders (id, user_id, user_tag, guild_id, channel_id, lang, execute_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(reminder.id, reminder.userId, reminder.userTag, reminder.guildId, reminder.channelId, reminder.lang, reminder.executeAt);
    } catch (e) {
        console.error('[DAILY REMINDER DB] Save failed:', e.message);
    }
}

function markDailyReminderDelivered(database, id) {
    try {
        database.prepare(`UPDATE daily_reminders SET delivered = 1 WHERE id = ?`).run(id);
    } catch (e) {}
}

function loadPendingDailyReminders(database) {
    try {
        const now = Math.floor(Date.now() / 1000);
        return database.prepare(`SELECT * FROM daily_reminders WHERE delivered = 0 AND execute_at > ?`).all(now);
    } catch (e) {
        console.error('[DAILY REMINDER DB] Load failed:', e.message);
        return [];
    }
}

// Deliver DM reminder — tries DM first, falls back to channel mention
async function deliverDailyReminder(client, reminder, database) {
    const lang = reminder.lang || 'en';
    const dmT = {
        en: {
            title: '⏰ Daily Reward Ready!',
            desc: (guild) => `Your daily reward is now available in **${guild}**!\n\nUse \`/claim\` or \`.claim\` to collect it.\n🔥 Don't break your streak!`,
            footer: 'Architect CG-223 • Daily Reminder'
        },
        fr: {
            title: '⏰ Récompense Quotidienne Prête !',
            desc: (guild) => `Votre récompense quotidienne est disponible sur **${guild}** !\n\nUtilisez \`/claim\` ou \`.claim\` pour la réclamer.\n🔥 Ne cassez pas votre série !`,
            footer: 'Architect CG-223 • Rappel Quotidien'
        }
    };
    const t = dmT[lang] || dmT['en'];

    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: t.title, iconURL: client.user?.displayAvatarURL() })
        .setDescription(t.desc(reminder.guildName || 'the server'))
        .setFooter({ text: t.footer })
        .setTimestamp();

    let delivered = false;

    // Try DM
    try {
        const user = await client.users.fetch(reminder.user_id).catch(() => null);
        if (user) {
            await user.send({ embeds: [embed] });
            delivered = true;
            console.log(`[DAILY REMINDER] ✅ DM sent to ${reminder.user_tag || reminder.user_id}`);
        }
    } catch (dmErr) {
        console.log(`[DAILY REMINDER] ❌ DM failed for ${reminder.user_tag || reminder.user_id}: ${dmErr.message}`);
    }

    // Fallback: channel mention
    if (!delivered && reminder.channel_id) {
        try {
            const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
            if (channel && channel.send) {
                const fbEmbed = EmbedBuilder.from(embed)
                    .setDescription(`<@${reminder.user_id}> ${t.desc(reminder.guildName || 'the server')}`);
                await channel.send({ content: `<@${reminder.user_id}>`, embeds: [fbEmbed] });
                delivered = true;
                console.log(`[DAILY REMINDER] 📢 Channel fallback for ${reminder.user_tag || reminder.user_id}`);
            }
        } catch (chErr) {
            console.log(`[DAILY REMINDER] ❌ Channel fallback failed: ${chErr.message}`);
        }
    }

    if (database) markDailyReminderDelivered(database, reminder.id);

    // Cleanup old delivered reminders
    try {
        const weekAgo = Math.floor(Date.now() / 1000) - 604800;
        database.prepare(`DELETE FROM daily_reminders WHERE delivered = 1 AND execute_at < ?`).run(weekAgo);
    } catch (e) {}

    return delivered;
}

// Schedule a daily reminder after successful claim
function scheduleDailyReminder(client, db, userId, userTag, guildId, channelId, guildName, lang) {
    if (!db) return;
    setupDailyReminderDB(db);

    const oneDay = 24 * 60 * 60 * 1000;
    const executeAt = Math.floor((Date.now() + oneDay) / 1000);
    const reminderId = `dr_${userId}_${guildId}_${Date.now()}`;

    saveDailyReminder(db, {
        id: reminderId,
        userId,
        userTag,
        guildId,
        channelId,
        guildName,
        lang: lang || 'en',
        executeAt
    });

    // Set in-memory timeout
    setTimeout(async () => {
        await deliverDailyReminder(client, {
            id: reminderId,
            user_id: userId,
            user_tag: userTag,
            guild_id: guildId,
            channel_id: channelId,
            guildName,
            lang: lang || 'en'
        }, db);
    }, oneDay);

    console.log(`[DAILY REMINDER] Scheduled for ${userTag || userId} in ${guildName || guildId} — <t:${executeAt}:R>`);
}

// Rehydrate reminders on bot startup (survives restarts)
async function rehydrateDailyReminders(client, database) {
    const pending = loadPendingDailyReminders(database);
    if (pending.length === 0) return;

    console.log(`[DAILY REMINDER] Rehydrating ${pending.length} pending reminders...`);

    for (const row of pending) {
        const executeAtMs = row.execute_at * 1000;
        const msUntil = executeAtMs - Date.now();

        // Get guild name for the DM
        let guildName = 'the server';
        try {
            const guild = await client.guilds.fetch(row.guild_id).catch(() => null);
            if (guild) guildName = guild.name;
        } catch (e) {}

        if (msUntil <= 0) {
            // Overdue — deliver immediately
            console.log(`[DAILY REMINDER] Delivering overdue reminder for ${row.user_tag || row.user_id}`);
            await deliverDailyReminder(client, {
                id: row.id,
                user_id: row.user_id,
                user_tag: row.user_tag,
                guild_id: row.guild_id,
                channel_id: row.channel_id,
                guildName,
                lang: row.lang
            }, database);
        } else {
            // Re-arm timeout
            setTimeout(async () => {
                await deliverDailyReminder(client, {
                    id: row.id,
                    user_id: row.user_id,
                    user_tag: row.user_tag,
                    guild_id: row.guild_id,
                    channel_id: row.channel_id,
                    guildName,
                    lang: row.lang
                }, database);
            }, msUntil);
        }
    }
}

module.exports = {
    name: 'claim',
    aliases: ['reclamer', 'reclaim', 'collect', 'recolter', 'réclamer'],
    description: '⚡ Claim your daily rewards when the neural cycle is complete.',
    category: 'ECONOMY',
    usage: '.claim',
    cooldown: 3000,

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('⚡ Claim your daily rewards when the neural cycle is complete'),

    // ================= TEXT COMMAND HANDLER =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        try {
            // PER-SERVER: Extract guildId for composite key lookups
            const guildId = message.guild?.id || 'DM';
            const prefix = serverSettings?.prefix || '.';
            const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();

            // Language detection
            const lang = client.detectLanguage 
                ? client.detectLanguage(usedCommand, serverSettings?.language || 'en')
                : serverSettings?.language || 'en';
            const t = claimTranslations[lang];
            const version = client.version || '2.0.0';
            
            // Channel restriction
            if (serverSettings?.dailyChannel && message.channel.id !== serverSettings.dailyChannel) {
                return message.reply({ content: t.channelRestricted(serverSettings.dailyChannel) });
            }
            
            const userId = message.author.id;
            const userName = message.author.username;
            const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
            
            const baseXP = 250;
            const baseCredits = 100;
            const oneDay = 24 * 60 * 60 * 1000;
            
            // ================= PER-SERVER USER LOOKUP =================
            // Must use composite key (userId, guildId) for partitioned schema
            let userData = client.getUserData 
                ? client.getUserData(userId, guildId) 
                : db.prepare(`SELECT last_daily, xp, credits, streak_days, level, total_dailies, highest_streak, guild_id 
                              FROM users WHERE id = ? AND guild_id = ?`).get(userId, guildId);
            
            if (!userData) {
                // Create per-server user record with composite PK
                db.prepare(`INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_dailies, highest_streak) 
                    VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0)`).run(userId, guildId, userName);
                userData = { last_daily: 0, xp: 0, credits: 0, streak_days: 0, level: 1, total_dailies: 0, highest_streak: 0, guild_id: guildId };
            }
            
            const lastClaim = parseInt(userData.last_daily || 0);
            const now = Date.now();
            const timePassed = now - lastClaim;
            const canClaim = timePassed >= oneDay || lastClaim === 0;
            
            // ================= COOLDOWN HANDLING =================
            if (!canClaim) {
                const timeLeft = oneDay - timePassed;
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                const timeString = `${hours}h ${minutes}m ${seconds}s`;
                
                const cooldownEmbed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setAuthor({ name: t.cooldownTitle, iconURL: avatarURL })
                    .setDescription(t.cooldownDesc(userName, timeString, prefix))
                    .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('claim_goto_daily')
                            .setLabel(t.viewDashboard)
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📊')
                    );
                
                const cooldownReply = await message.reply({ embeds: [cooldownEmbed], components: [row] });

                const filter = (i) => i.user.id === userId;
                const collector = cooldownReply.createMessageComponentCollector({ filter, time: 30000 });

                collector.on('collect', async (i) => {
                    try {
                        await i.deferUpdate().catch(() => {});
                        if (i.customId === 'claim_goto_daily') {
                            // Build inline dashboard directly — avoids stale message context
                            const dash = buildMiniDashboard(userData, lang, prefix, guildName, guildIcon, version);
                            await i.followUp({ embeds: [dash], ephemeral: true });
                        }
                    } catch (err) {
                        console.error(`[CLAIM BUTTON ERROR]`, err);
                    }
                });

                return;
            }
            
            // ================= STREAK CALCULATION =================
            let streak = 1;
            let streakBonusXP = 25;
            let streakBonusCredits = 10;
            
            if (lastClaim > 0) {
                const daysPassed = Math.floor(timePassed / oneDay);
                if (daysPassed === 1) {
                    streak = (userData.streak_days || 0) + 1;
                    streakBonusXP = Math.min(streak * 25, 250);
                    streakBonusCredits = Math.min(streak * 10, 100);
                }
            }
            
            const totalXP = baseXP + streakBonusXP;
            const totalCredits = baseCredits + streakBonusCredits;
            
            // ================= PER-SERVER BATCH WRITE =================
            const currentTotalDailies = (userData?.total_dailies || 0) + 1;
            const currentHighestStreak = Math.max(streak, (userData?.highest_streak || 0));
            
            // Build the update payload with guild_id explicitly set
            const updatePayload = {
                ...userData,
                username: userName,
                xp: (userData.xp || 0) + totalXP,
                credits: (userData.credits || 0) + totalCredits,
                streak_days: streak,
                last_daily: now,
                last_reminder: now,
                total_dailies: currentTotalDailies,
                highest_streak: currentHighestStreak,
                guild_id: guildId
            };
            
            if (client.queueUserUpdate) {
                // queueUserUpdate requires (userId, guildId, data) — composite key aware
                client.queueUserUpdate(userId, guildId, updatePayload);
            } else {
                // Fallback: direct DB write with per-server WHERE clause
                db.prepare(`UPDATE users 
                    SET xp = COALESCE(xp, 0) + ?, 
                        credits = COALESCE(credits, 0) + ?, 
                        streak_days = ?, 
                        last_daily = ?, 
                        last_reminder = ?, 
                        total_dailies = COALESCE(total_dailies, 0) + 1, 
                        highest_streak = MAX(COALESCE(highest_streak, 0), ?) 
                    WHERE id = ? AND guild_id = ?`)
                    .run(totalXP, totalCredits, streak, now, now, streak, userId, guildId);
            }

            // ================= SCHEDULE DAILY DM REMINDER =================
            try {
                scheduleDailyReminder(client, db, userId, message.author.tag, guildId, message.channel.id, message.guild?.name, lang);
            } catch (e) {
                console.error(`[DAILY REMINDER] Schedule failed:`, e.message);
            }
            
            // ================= ASSIGN DAILY STREAK ROLE =================
            if (message.guild) {
                try {
                    const settings = serverSettings || client.getServerSettings(message.guild.id);
                    
                    let streakRoleId = null;
                    if (streak === 3) streakRoleId = settings?.dailyInitiateRoleId || process.env.DAILY_INITIATE_ROLE;
                    else if (streak === 7) streakRoleId = settings?.dailyWarriorRoleId || process.env.DAILY_WARRIOR_ROLE;
                    else if (streak === 30) streakRoleId = settings?.dailyChampionRoleId || process.env.DAILY_CHAMPION_ROLE;
                    else if (streak === 100) streakRoleId = settings?.dailyLegendRoleId || process.env.DAILY_LEGEND_ROLE;
                    
                    if (streakRoleId) {
                        const member = await message.guild.members.fetch(userId).catch(() => null);
                        if (member) {
                            const role = message.guild.roles.cache.get(streakRoleId);
                            if (role && !member.roles.cache.has(streakRoleId)) {
                                await member.roles.add(role, `Daily streak: ${streak} days!`).catch(() => {});
                            }
                        }
                    }
                } catch (e) {}
            }
            
            // ================= GET UPDATED STATS (COMPOSITE KEY) =================
            const updatedUser = client.getUserData 
                ? client.getUserData(userId, guildId) 
                : db.prepare(`SELECT xp, credits, streak_days, level 
                              FROM users WHERE id = ? AND guild_id = ?`).get(userId, guildId);
            
            const currentXP = updatedUser?.xp || 0;
            const currentCredits = updatedUser?.credits || 0;
            const currentLevel = updatedUser?.level || calculateLevel(currentXP);
            
            // ================= SUCCESS EMBED =================
            const successEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: t.successTitle, iconURL: avatarURL })
                .setDescription(t.successDesc(totalCredits, totalXP, streak))
                .addFields(
                    { name: t.nextClaim, value: `<t:${Math.floor((now + oneDay) / 1000)}:R>`, inline: true },
                    { name: t.currentStats, value: `\`\`\`yaml\n${lang === 'fr' ? 'Niveau' : 'Level'}: ${currentLevel}\n${lang === 'fr' ? 'XP Total' : 'Total XP'}: ${currentXP.toLocaleString()}\n${lang === 'fr' ? 'Crédits' : 'Credits'}: ${currentCredits.toLocaleString()}\`\`\``, inline: true }
                );
            
            if (streakBonusXP > 25 || streakBonusCredits > 10) {
                successEmbed.addFields({
                    name: t.streakBonus,
                    value: t.streakInfo(streak, streakBonusXP, streakBonusCredits),
                    inline: false
                });
            }
            
            successEmbed
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_view_daily')
                        .setLabel(t.viewDashboard)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📊'),
                    new ButtonBuilder()
                        .setCustomId('claim_view_profile')
                        .setLabel(t.myProfile)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('👤')
                );
            
            const successReply = await message.reply({ embeds: [successEmbed], components: [actionRow] });

            const buttonFilter = (i) => i.user.id === userId;
            const buttonCollector = successReply.createMessageComponentCollector({ filter: buttonFilter, time: 60000 });

            buttonCollector.on('collect', async (i) => {
                try {
                    await i.deferUpdate().catch(() => {});
                    
                    if (i.customId === 'claim_view_daily') {
                        const dash = buildMiniDashboard(userData, lang, prefix, guildName, guildIcon, version);
                        await i.followUp({ embeds: [dash], ephemeral: true });
                    } else if (i.customId === 'claim_view_profile') {
                        // Build inline profile directly
                        const rank = getRank(currentLevel);
                        const profileEmbed = new EmbedBuilder()
                            .setColor(rank.color)
                            .setAuthor({ name: `${rank.emoji} ${rank.title[lang]}`, iconURL: avatarURL })
                            .setThumbnail(avatarURL)
                            .setDescription(`**${userName}**\n\`\`\`yaml\nLevel: ${currentLevel}\nXP: ${currentXP.toLocaleString()}\nCredits: ${currentCredits.toLocaleString()}\nStreak: ${userData.streak_days || 0} days\n\`\`\``)
                            .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                            .setTimestamp();
                        await i.followUp({ embeds: [profileEmbed], ephemeral: true });
                    }
                } catch (err) {
                    console.error(`[CLAIM BUTTON ERROR]`, err);
                }
            });
            
        } catch (error) {
            console.error(`[CLAIM] FATAL ERROR:`, error);
            const lang = client.detectLanguage 
                ? client.detectLanguage(usedCommand || 'claim', 'en')
                : 'en';
            return message.reply({ content: claimTranslations[lang].error }).catch(() => {});
        }
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        try {
            // PER-SERVER: Extract guildId for composite key lookups
            const guildId = interaction.guild?.id || 'DM';
            const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
            
            const lang = client.detectLanguage 
                ? client.detectLanguage('claim', serverSettings?.language || 'en')
                : serverSettings?.language || 'en';
            const t = claimTranslations[lang];
            
            const version = client.version || '2.0.0';
            const guildName = interaction.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const guildIcon = interaction.guild?.iconURL() || client.user.displayAvatarURL();
            const prefix = serverSettings?.prefix || '.';
            
            // Channel restriction
            if (serverSettings?.dailyChannel && interaction.channel.id !== serverSettings.dailyChannel) {
                return interaction.reply({ content: t.channelRestricted(serverSettings.dailyChannel), ephemeral: true });
            }
            
            const userId = interaction.user.id;
            const userName = interaction.user.username;
            const avatarURL = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });
            
            const baseXP = 250;
            const baseCredits = 100;
            const oneDay = 24 * 60 * 60 * 1000;
            
            // ================= PER-SERVER USER LOOKUP =================
            let userData = client.getUserData 
                ? client.getUserData(userId, guildId) 
                : client.db.prepare(`SELECT last_daily, xp, credits, streak_days, level, total_dailies, highest_streak, guild_id 
                                     FROM users WHERE id = ? AND guild_id = ?`).get(userId, guildId);
            
            if (!userData) {
                client.db.prepare(`INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_dailies, highest_streak) 
                    VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0)`).run(userId, guildId, userName);
                userData = { last_daily: 0, xp: 0, credits: 0, streak_days: 0, level: 1, total_dailies: 0, highest_streak: 0, guild_id: guildId };
            }
            
            const lastClaim = parseInt(userData.last_daily || 0);
            const now = Date.now();
            const timePassed = now - lastClaim;
            const canClaim = timePassed >= oneDay || lastClaim === 0;
            
            // ================= COOLDOWN HANDLING =================
            if (!canClaim) {
                const timeLeft = oneDay - timePassed;
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                const timeString = `${hours}h ${minutes}m ${seconds}s`;
                
                const cooldownEmbed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setAuthor({ name: t.cooldownTitle, iconURL: avatarURL })
                    .setDescription(t.cooldownDesc(userName, timeString, prefix))
                    .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('claim_slash_goto_daily')
                            .setLabel(t.viewDashboard)
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📊')
                    );
                
                await interaction.reply({ embeds: [cooldownEmbed], components: [row], ephemeral: true });
                
                try {
                    const buttonResponse = await interaction.channel.awaitMessageComponent({
                        filter: (i) => i.user.id === userId && i.customId === 'claim_slash_goto_daily',
                        time: 30000
                    });

                    await buttonResponse.deferUpdate().catch(() => {});
                    // Build inline dashboard directly — avoids calling daily with stale interaction
                    const dash = buildMiniDashboard(userData, lang, prefix, guildName, guildIcon, version);
                    await buttonResponse.followUp({ embeds: [dash], ephemeral: true });
                } catch (e) {
                    // Timeout - button expired
                }
                return;
            }

            // ================= STREAK CALCULATION =================
            let streak = 1;
            let streakBonusXP = 25;
            let streakBonusCredits = 10;
            
            if (lastClaim > 0) {
                const daysPassed = Math.floor(timePassed / oneDay);
                if (daysPassed === 1) {
                    streak = (userData.streak_days || 0) + 1;
                    streakBonusXP = Math.min(streak * 25, 250);
                    streakBonusCredits = Math.min(streak * 10, 100);
                }
            }
            
            const totalXP = baseXP + streakBonusXP;
            const totalCredits = baseCredits + streakBonusCredits;
            
            // ================= PER-SERVER BATCH WRITE =================
            const currentTotalDailies = (userData?.total_dailies || 0) + 1;
            const currentHighestStreak = Math.max(streak, (userData?.highest_streak || 0));

            const updatePayload = {
                ...userData,
                username: userName,
                xp: (userData.xp || 0) + totalXP,
                credits: (userData.credits || 0) + totalCredits,
                streak_days: streak,
                last_daily: now,
                last_reminder: now,
                total_dailies: currentTotalDailies,
                highest_streak: currentHighestStreak,
                guild_id: guildId
            };

            if (client.queueUserUpdate) {
                client.queueUserUpdate(userId, guildId, updatePayload);
            } else {
                client.db.prepare(`UPDATE users 
                    SET xp = COALESCE(xp, 0) + ?, 
                        credits = COALESCE(credits, 0) + ?, 
                        streak_days = ?, 
                        last_daily = ?, 
                        last_reminder = ?, 
                        total_dailies = COALESCE(total_dailies, 0) + 1, 
                        highest_streak = MAX(COALESCE(highest_streak, 0), ?) 
                    WHERE id = ? AND guild_id = ?`)
                    .run(totalXP, totalCredits, streak, now, now, streak, userId, guildId);
            }

            // ================= SCHEDULE DAILY DM REMINDER =================
            try {
                scheduleDailyReminder(client, client.db, userId, interaction.user.tag, guildId, interaction.channel.id, interaction.guild?.name, lang);
            } catch (e) {
                console.error(`[DAILY REMINDER] Schedule failed:`, e.message);
            }

            // ================= ASSIGN DAILY STREAK ROLE =================
            if (interaction.guild) {
                try {
                    const settings = serverSettings || client.getServerSettings(interaction.guild.id);
                    let streakRoleId = null;
                    if (streak === 3) streakRoleId = settings?.dailyInitiateRoleId || process.env.DAILY_INITIATE_ROLE;
                    else if (streak === 7) streakRoleId = settings?.dailyWarriorRoleId || process.env.DAILY_WARRIOR_ROLE;
                    else if (streak === 30) streakRoleId = settings?.dailyChampionRoleId || process.env.DAILY_CHAMPION_ROLE;
                    else if (streak === 100) streakRoleId = settings?.dailyLegendRoleId || process.env.DAILY_LEGEND_ROLE;
                    
                    if (streakRoleId) {
                        const member = await interaction.guild.members.fetch(userId).catch(() => null);
                        if (member) {
                            const role = interaction.guild.roles.cache.get(streakRoleId);
                            if (role && !member.roles.cache.has(streakRoleId)) {
                                await member.roles.add(role, `Daily streak: ${streak} days!`).catch(() => {});
                            }
                        }
                    }
                } catch (e) {}
            }

            // ================= GET UPDATED STATS (COMPOSITE KEY) =================
            const updatedUser = client.getUserData 
                ? client.getUserData(userId, guildId) 
                : client.db.prepare(`SELECT xp, credits, streak_days, level 
                                     FROM users WHERE id = ? AND guild_id = ?`).get(userId, guildId);
            
            const currentXP = updatedUser?.xp || 0;
            const currentCredits = updatedUser?.credits || 0;
            const currentLevel = updatedUser?.level || calculateLevel(currentXP);
            
            // ================= SUCCESS EMBED =================
            const successEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: t.successTitle, iconURL: avatarURL })
                .setDescription(t.successDesc(totalCredits, totalXP, streak))
                .addFields(
                    { name: t.nextClaim, value: `<t:${Math.floor((now + oneDay) / 1000)}:R>`, inline: true },
                    { name: t.currentStats, value: `\`\`\`yaml\n${lang === 'fr' ? 'Niveau' : 'Level'}: ${currentLevel}\n${lang === 'fr' ? 'XP Total' : 'Total XP'}: ${currentXP.toLocaleString()}\n${lang === 'fr' ? 'Crédits' : 'Credits'}: ${currentCredits.toLocaleString()}\`\`\``, inline: true }
                );
            
            if (streakBonusXP > 25 || streakBonusCredits > 10) {
                successEmbed.addFields({
                    name: t.streakBonus,
                    value: t.streakInfo(streak, streakBonusXP, streakBonusCredits),
                    inline: false
                });
            }
            
            successEmbed
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_slash_view_daily')
                        .setLabel(t.viewDashboard)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📊'),
                    new ButtonBuilder()
                        .setCustomId('claim_slash_view_profile')
                        .setLabel(t.myProfile)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('👤')
                );
            
            await interaction.reply({ embeds: [successEmbed], components: [actionRow], ephemeral: false });
            
            // Handle button clicks
            try {
                const buttonResponse = await interaction.channel.awaitMessageComponent({
                    filter: (i) => i.user.id === userId &&
                        (i.customId === 'claim_slash_view_daily' || i.customId === 'claim_slash_view_profile'),
                    time: 60000
                });

                await buttonResponse.deferUpdate().catch(() => {});

                if (buttonResponse.customId === 'claim_slash_view_daily') {
                    const dash = buildMiniDashboard(userData, lang, prefix, guildName, guildIcon, version);
                    await buttonResponse.followUp({ embeds: [dash], ephemeral: true });
                } else if (buttonResponse.customId === 'claim_slash_view_profile') {
                    const rank = getRank(currentLevel);
                    const profileEmbed = new EmbedBuilder()
                        .setColor(rank.color)
                        .setAuthor({ name: `${rank.emoji} ${rank.title[lang]}`, iconURL: avatarURL })
                        .setThumbnail(avatarURL)
                        .setDescription(`**${userName}**\n\`\`\`yaml\nLevel: ${currentLevel}\nXP: ${currentXP.toLocaleString()}\nCredits: ${currentCredits.toLocaleString()}\nStreak: ${userData.streak_days || 0} days\n\`\`\``)
                        .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon })
                        .setTimestamp();
                    await buttonResponse.followUp({ embeds: [profileEmbed], ephemeral: true });
                }
            } catch (e) {
                // Timeout - button expired
            }
            
        } catch (error) {
            console.error(`[CLAIM SLASH] FATAL ERROR:`, error);
            const errorMsg = { content: '❌ An error occurred during claim processing.', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply(errorMsg).catch(() => {});
            }
            return interaction.reply(errorMsg).catch(() => {});
        }
    },

    // Daily DM reminder exports for index.js initialization
    setupDailyReminderDB,
    rehydrateDailyReminders
};
