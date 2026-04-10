const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= UNIFIED LEVEL CALCULATION =================
function calculateLevel(xp) { 
    return Math.floor(0.1 * Math.sqrt(xp)) + 1; 
}

// ================= BILINGUAL TRANSLATIONS =================
const dailyTranslations = {
    en: {
        title: '📊 NEURAL DASHBOARD',
        statusActive: '🟢 READY TO CLAIM',
        statusCooldown: '🔴 NEURAL CYCLE ACTIVE',
        countdown: '⏳ COUNTDOWN',
        readyMessage: '✨ **System Ready!** Use `.claim` or click the button below to inject your resources!',
        cooldownMessage: (time) => `⏳ **Cooldown Active:** \`${time}\` remaining until next claim.`,
        reminderStatus: '🔔 REMINDER STATUS',
        reminderActive: (time) => `✅ **Active!** You'll be notified <t:${time}:R>`,
        reminderInactive: '❌ No active reminder',
        streakInfo: '🔥 CURRENT STREAK',
        streakValue: (streak) => `${streak} day${streak > 1 ? 's' : ''}`,
        nextReward: '🎁 NEXT REWARD',
        baseReward: 'Base: 250 XP + 100 Credits',
        bonusReward: (xp, credits) => `Bonus: +${xp} XP +${credits} Credits`,
        stats: '📊 YOUR STATS',
        claimNow: '⚡ Claim Now',
        remindMe: '⏰ Remind Me',
        reminderSet: '✅ Reminder Set',
        myProfile: '👤 My Profile',
        leaderboard: '🏆 Leaderboard',
        tip: '💡 TIP',
        tipText: 'Claim daily to build your streak and earn bonus rewards!',
        accessDenied: '❌ These controls are locked to your session.',
        reminderSuccess: (hours) => `🔔 **Reminder Set!** I'll notify you in ${hours} hours. Then use \`.claim\` to collect your rewards!`,
        reminderAlreadyActive: (h, m) => `⚠️ **Protocol already active!** Your reminder triggers in \`${h}h ${m}m\`.`,
        footer: 'ARCHITECT CG-223 • v{version} • Use .claim to collect rewards',
        channelRestricted: (channelId) => `📊 The dashboard is restricted to the <#${channelId}> channel.`,
        claimNotFound: '❌ Claim command not found.',
        profileNotFound: '❌ Profile command not found.',
        leaderboardNotFound: '❌ Leaderboard command not found.',
        error: '❌ An error occurred.',
        profileOpened: '👤 Profile displayed above!',
        leaderboardOpened: '🏆 Leaderboard displayed above!',
        claimProcessed: '⚡ Claim processed!'
    },
    fr: {
        title: '📊 TABLEAU DE BORD NEURAL',
        statusActive: '🟢 PRÊT À RÉCLAMER',
        statusCooldown: '🔴 CYCLE NEURAL ACTIF',
        countdown: '⏳ COMPTE À REBOURS',
        readyMessage: '✨ **Système Prêt!** Utilisez `.claim` ou cliquez sur le bouton ci-dessous pour injecter vos ressources!',
        cooldownMessage: (time) => `⏳ **Refroidissement Actif:** \`${time}\` restant avant la prochaine réclamation.`,
        reminderStatus: '🔔 ÉTAT DU RAPPEL',
        reminderActive: (time) => `✅ **Actif!** Vous serez notifié <t:${time}:R>`,
        reminderInactive: '❌ Aucun rappel actif',
        streakInfo: '🔥 SÉRIE ACTUELLE',
        streakValue: (streak) => `${streak} jour${streak > 1 ? 's' : ''}`,
        nextReward: '🎁 PROCHAINE RÉCOMPENSE',
        baseReward: 'Base: 250 XP + 100 Crédits',
        bonusReward: (xp, credits) => `Bonus: +${xp} XP +${credits} Crédits`,
        stats: '📊 VOS STATISTIQUES',
        claimNow: '⚡ Réclamer',
        remindMe: '⏰ Rappeler',
        reminderSet: '✅ Rappel Défini',
        myProfile: '👤 Mon Profil',
        leaderboard: '🏆 Classement',
        tip: '💡 ASTUCE',
        tipText: 'Réclamez quotidiennement pour augmenter votre série et gagner des bonus!',
        accessDenied: '❌ Ces commandes sont verrouillées à votre session.',
        reminderSuccess: (hours) => `🔔 **Rappel Défini!** Je vous notifierai dans ${hours} heures. Utilisez ensuite \`.claim\` pour réclamer vos récompenses!`,
        reminderAlreadyActive: (h, m) => `⚠️ **Protocole déjà actif!** Votre rappel se déclenche dans \`${h}h ${m}m\`.`,
        footer: 'ARCHITECT CG-223 • v{version} • Utilisez .claim pour réclamer',
        channelRestricted: (channelId) => `📊 Le tableau de bord est restreint au canal <#${channelId}>.`,
        claimNotFound: '❌ Commande de réclamation introuvable.',
        profileNotFound: '❌ Commande de profil introuvable.',
        leaderboardNotFound: '❌ Commande de classement introuvable.',
        error: '❌ Une erreur est survenue.',
        profileOpened: '👤 Profil affiché ci-dessus !',
        leaderboardOpened: '🏆 Classement affiché ci-dessus !',
        claimProcessed: '⚡ Réclamation effectuée !'
    }
};

function createProgressBar(percentage, length = 15) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

module.exports = {
    name: 'daily',
    aliases: ['dashboard', 'tableau', 'quotidien', 'journalier'],
    description: '📊 View your daily claim dashboard with countdown and reminder status.',
    category: 'ECONOMY',
    usage: '.daily',
    cooldown: 3000,
    examples: ['.daily'],

    // ✅ FIXED: Added usedCommand as 6th parameter
    run: async (client, message, args, database, serverSettings, usedCommand) => {
        
        try {
            // ✅ FIXED: Use the database parameter correctly
            const db = database;
            
            // ✅ NEURAL BRIDGE: Priority on alias, fallback to server default
            const lang = client.detectLanguage 
                ? client.detectLanguage(usedCommand, serverSettings?.language || 'en')
                : (serverSettings?.language || 'en');
                
            const t = dailyTranslations[lang];
            
            // ✅ DYNAMIC VERSION from client.version (reads from version.txt)
            const version = client.version || '1.5.0';
            const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
            
            // ✅ Channel Restriction Check
            if (serverSettings?.dailyChannel && message.channel.id !== serverSettings.dailyChannel) {
                return message.reply({ 
                    content: t.channelRestricted(serverSettings.dailyChannel), 
                    ephemeral: true 
                });
            }
            
            const userId = message.author.id;
            const userName = message.author.username;
            const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
            
            const baseXP = 250;
            const baseCredits = 100;
            const oneDay = 24 * 60 * 60 * 1000;
            const now = Date.now();
            
            // --- ENSURE REMINDERS TABLE EXISTS ---
            try {
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS reminders (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        channel_id TEXT NOT NULL,
                        message TEXT NOT NULL,
                        execute_at INTEGER NOT NULL,
                        status TEXT DEFAULT 'pending',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `).run();
            } catch (e) {
                console.log(`[DAILY] Reminders table check: ${e.message}`);
            }
            
            // --- GET USER DATA ---
            let userData = null;
            try {
                userData = db.prepare(`
                    SELECT last_daily, xp, credits, streak_days, level 
                    FROM users WHERE id = ?
                `).get(userId);
            } catch (err) {
                console.error(`[DAILY] Fetch error: ${err.message}`);
            }
            
            if (!userData) {
                db.prepare(`INSERT INTO users (id, username, xp, level, credits, streak_days, last_daily) 
                    VALUES (?, ?, 0, 1, 0, 0, 0)`).run(userId, userName);
                userData = { last_daily: 0, xp: 0, credits: 0, streak_days: 0, level: 1 };
            }
            
            // --- CALCULATE COOLDOWN STATUS ---
            const lastClaim = parseInt(userData.last_daily || 0);
            const timePassed = now - lastClaim;
            const canClaim = timePassed >= oneDay || lastClaim === 0;
            
            let countdownText = '';
            let statusText = '';
            let statusEmoji = '';
            
            if (canClaim) {
                statusText = t.statusActive;
                statusEmoji = '🟢';
                countdownText = t.readyMessage;
            } else {
                statusText = t.statusCooldown;
                statusEmoji = '🔴';
                const timeLeft = oneDay - timePassed;
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                const timeString = `${hours}h ${minutes}m ${seconds}s`;
                countdownText = t.cooldownMessage(timeString);
            }
            
            // --- CHECK FOR ACTIVE REMINDER ---
            const reminder = db.prepare(`
                SELECT execute_at FROM reminders 
                WHERE user_id = ? AND status = 'pending' AND message LIKE '%reward%'
            `).get(userId);
            
            let reminderStatusText = t.reminderInactive;
            let reminderActive = false;
            
            if (reminder) {
                reminderActive = true;
                reminderStatusText = t.reminderActive(reminder.execute_at);
            }
            
            // --- CALCULATE STREAK & BONUSES ---
            let streak = userData.streak_days || 0;
            if (!canClaim && lastClaim > 0) {
                const daysPassed = Math.floor(timePassed / oneDay);
                if (daysPassed === 1) {
                    streak = streak + 1;
                } else if (daysPassed > 1) {
                    streak = 1;
                }
            } else if (canClaim && lastClaim > 0) {
                const daysPassed = Math.floor(timePassed / oneDay);
                if (daysPassed === 1) {
                    streak = streak + 1;
                } else if (daysPassed > 1) {
                    streak = 1;
                }
            }
            
            const streakBonusXP = Math.min(streak * 25, 250);
            const streakBonusCredits = Math.min(streak * 10, 100);
            const totalXP = baseXP + streakBonusXP;
            const totalCredits = baseCredits + streakBonusCredits;
            
            // --- CURRENT STATS ---
            const currentXP = userData.xp || 0;
            const currentCredits = userData.credits || 0;
            const currentLevel = calculateLevel(currentXP);
            const nextLevelXP = Math.pow(currentLevel / 0.1, 2);
            const currentLevelStartXP = Math.pow((currentLevel - 1) / 0.1, 2);
            const progressPercent = Math.min(100, Math.max(0, ((currentXP - currentLevelStartXP) / (nextLevelXP - currentLevelStartXP)) * 100));
            const progressBar = createProgressBar(progressPercent, 12);
            
            // --- BUILD DASHBOARD EMBED ---
            const dashboardEmbed = new EmbedBuilder()
                .setColor(canClaim ? '#2ecc71' : '#e74c3c')
                .setAuthor({ name: `${statusEmoji} ${t.title}`, iconURL: avatarURL })
                .setTitle(`${userName}'s Neural Interface`)
                .setDescription(`**${statusText}**\n\n${countdownText}`)
                .addFields(
                    { name: t.countdown, value: canClaim ? '`00h 00m 00s`' : countdownText.match(/`[^`]+`/)?.[0] || '`--`', inline: true },
                    { name: t.reminderStatus, value: reminderStatusText, inline: true },
                    { name: t.streakInfo, value: `\`${t.streakValue(streak)}\`\n└─ Bonus: +${streakBonusXP} XP | +${streakBonusCredits} Credits`, inline: true },
                    { name: t.nextReward, value: `┌─ ${t.baseReward}\n└─ ${t.bonusReward(streakBonusXP, streakBonusCredits)}`, inline: false },
                    { name: t.stats, value: `\`\`\`yaml\n${lang === 'fr' ? 'Niveau' : 'Level'}: ${currentLevel}\n${lang === 'fr' ? 'XP' : 'XP'}: ${currentXP.toLocaleString()} / ${Math.ceil(nextLevelXP).toLocaleString()}\n${lang === 'fr' ? 'Crédits' : 'Credits'}: ${currentCredits.toLocaleString()}\n\`\`\`\n\`${progressBar}\` ${progressPercent.toFixed(1)}%`, inline: false },
                    { name: t.tip, value: t.tipText, inline: false }
                )
                .setFooter({ text: `${guildName} • ${t.footer.replace('{version}', version)}`, iconURL: guildIcon })
                .setTimestamp();
            
            // --- BUILD DYNAMIC BUTTON ROW ---
            const row = new ActionRowBuilder();
            
            // Always show Profile and Leaderboard
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('view_profile')
                    .setLabel(t.myProfile)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👤'),
                new ButtonBuilder()
                    .setCustomId('view_leaderboard')
                    .setLabel(t.leaderboard)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏆')
            );
            
            // Dynamic third button based on state
            if (canClaim) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('go_claim')
                        .setLabel(t.claimNow)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('⚡')
                );
            } else if (!reminderActive) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('remind_me')
                        .setLabel(t.remindMe)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⏰')
                );
            } else {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('reminder_active')
                        .setLabel(t.reminderSet)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✅')
                        .setDisabled(true)
                );
            }
            
            const reply = await message.reply({ embeds: [dashboardEmbed], components: [row] });
            
            // --- BUTTON COLLECTOR (FIXED - NO DOUBLE REPLY) ---
            const collector = reply.createMessageComponentCollector({ time: 120000 });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== userId) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                // ✅ Defer first to prevent "InteractionAlreadyReplied" errors
                await i.deferUpdate();
                
                switch (i.customId) {
                    case 'view_profile':
                        const rankCmd = client.commands.get('rank') || client.commands.get('profile');
                        if (rankCmd) {
                            await rankCmd.run(client, message, [], db, serverSettings, usedCommand);
                            await i.followUp({ content: t.profileOpened, ephemeral: true });
                        } else {
                            await i.followUp({ content: t.profileNotFound, ephemeral: true });
                        }
                        break;
                        
                    case 'view_leaderboard':
                        const lbCmd = client.commands.get('lb') || client.commands.get('leaderboard');
                        if (lbCmd) {
                            await lbCmd.run(client, message, [], db, serverSettings, usedCommand);
                            await i.followUp({ content: t.leaderboardOpened, ephemeral: true });
                        } else {
                            await i.followUp({ content: t.leaderboardNotFound, ephemeral: true });
                        }
                        break;
                        
                    case 'go_claim':
                        const claimCmd = client.commands.get('claim');
                        if (claimCmd) {
                            await claimCmd.run(client, message, [], db, serverSettings, usedCommand);
                            await i.followUp({ content: t.claimProcessed, ephemeral: true });
                        } else {
                            await i.followUp({ content: t.claimNotFound, ephemeral: true });
                        }
                        break;
                        
                    case 'remind_me':
                        // Double-check no reminder exists
                        const existing = db.prepare(`
                            SELECT execute_at FROM reminders 
                            WHERE user_id = ? AND status = 'pending' AND message LIKE '%reward%'
                        `).get(userId);
                        
                        if (existing) {
                            const timeLeft = (existing.execute_at * 1000) - Date.now();
                            const h = Math.floor(timeLeft / 3600000);
                            const m = Math.floor((timeLeft % 3600000) / 60000);
                            return i.followUp({ content: t.reminderAlreadyActive(h, m), ephemeral: true });
                        }
                        
                        // Create reminder
                        const nextClaimTime = new Date(lastClaim + oneDay);
                        const timeUntilHours = Math.floor((nextClaimTime - now) / 1000 / 60 / 60);
                        const executeAt = Math.floor(nextClaimTime.getTime() / 1000);
                        const reminderId = `daily_${userId}_${executeAt}`;
                        const reminderMsg = lang === 'fr' 
                            ? `**Agent ${userName}**, votre récompense quotidienne est prête! Utilisez \`.claim\` pour la réclamer.`
                            : `**Agent ${userName}**, your daily reward is ready! Use \`.claim\` to collect it.`;
                        
                        try {
                            db.prepare(`
                                INSERT INTO reminders (id, user_id, channel_id, message, execute_at, status) 
                                VALUES (?, ?, ?, ?, ?, 'pending')
                            `).run(reminderId, userId, i.channelId, reminderMsg, executeAt);
                            
                            await i.followUp({ content: t.reminderSuccess(timeUntilHours), ephemeral: true });
                            console.log(`[DAILY] Reminder set for ${message.author.tag}`);
                        } catch (e) {
                            await i.followUp({ content: t.error, ephemeral: true });
                        }
                        break;
                }
            });
            
        } catch (error) {
            console.error(`[DAILY] FATAL ERROR:`, error);
            return message.reply({ content: '❌ An error occurred.' });
        }
    }
};