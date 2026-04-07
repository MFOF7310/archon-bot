const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// --- BILINGUAL TRANSLATIONS ---
const dailyTranslations = {
    en: {
        cooldownTitle: '◈ SYSTEM LOCKOUT ACTIVE ◈',
        cooldownAuthor: '🔒 NEURAL LINK ON COOLDOWN',
        successTitle: '◈ DAILY REWARDS INITIALIZED ◈',
        successAuthor: '⚡ NEURAL SYNC SUCCESSFUL',
        cooldownDesc: (name, time) => `**Agent ${name}**, your daily synchronization is still processing.\n\n⏳ **Time Remaining:** \`${time}\``,
        successDesc: (credits, xp) => 
            `**Agent**, your daily resource injection has been processed.\n\n` +
            `┌─ 📦 **REWARDS RECEIVED** ─────────\n` +
            `│  💰 **Credits:** +${credits.toLocaleString()}\n` +
            `│  📈 **XP Boost:** +${xp.toLocaleString()}\n` +
            `└──────────────────────────────────\n\n`,
        tip: '💡 TIP',
        tipText: 'Claim at the same time daily to maintain your streak bonus!',
        currentStreak: '🎯 CURRENT STREAK',
        streakBonus: '⚡ STREAK BONUS',
        nextSync: '🎯 NEXT SYNC',
        currentStats: '🎯 CURRENT STATISTICS',
        levelProgress: '📊 LEVEL PROGRESS',
        streakActive: '🔥 STREAK BONUS ACTIVE',
        milestoneAchieved: 'MILESTONE ACHIEVED!',
        leaderboard: 'Leaderboard',
        profile: 'My Profile',
        remindMe: 'Remind Me',
        reminder: (hours) => `⏰ I'll remind you in ${hours} hours! Use \`.daily\` then to claim your next reward.`,
        footer: 'Mali Node • Archon v{version} • Claim tomorrow for streak bonus!',
        error: '❌ An error occurred while processing your daily claim. Please try again later.',
        errorReport: '⚠️ **System Error**\nPlease contact the Architect with this error code:',
        accessDenied: '❌ These controls are locked to your session.',
        leaderboardNotFound: '❌ Leaderboard command not found.',
        profileNotFound: '❌ Profile command not found.',
        weekWarrior: 'Week Warrior',
        fortnightChampion: 'Fortnight Champion',
        monthlyLegend: 'Monthly Legend',
        centuryMaster: 'Century Master',
        bonusAwarded: 'Bonus +{bonus} XP awarded for your dedication!'
    },
    fr: {
        cooldownTitle: '◈ VERROUILLAGE SYSTÈME ACTIF ◈',
        cooldownAuthor: '🔒 LIEN NEURAL EN REFROIDISSEMENT',
        successTitle: '◈ RÉCOMPENSES JOURNALIÈRES INITIALISÉES ◈',
        successAuthor: '⚡ SYNCHRO NEURAL RÉUSSIE',
        cooldownDesc: (name, time) => `**Agent ${name}**, votre synchronisation quotidienne est en cours de traitement.\n\n⏳ **Temps restant:** \`${time}\``,
        successDesc: (credits, xp) =>
            `**Agent**, votre injection de ressources quotidienne a été traitée.\n\n` +
            `┌─ 📦 **RÉCOMPENSES REÇUES** ─────────\n` +
            `│  💰 **Crédits:** +${credits.toLocaleString()}\n` +
            `│  📈 **XP:** +${xp.toLocaleString()}\n` +
            `└──────────────────────────────────\n\n`,
        tip: '💡 ASTUCE',
        tipText: 'Réclamez à la même heure chaque jour pour maintenir votre bonus de série!',
        currentStreak: '🎯 SÉRIE ACTUELLE',
        streakBonus: '⚡ BONUS DE SÉRIE',
        nextSync: '🎯 PROCHAINE SYNCHRO',
        currentStats: '🎯 STATISTIQUES ACTUELLES',
        levelProgress: '📊 PROGRESSION DE NIVEAU',
        streakActive: '🔥 BONUS DE SÉRIE ACTIF',
        milestoneAchieved: 'ÉTAPE IMPORTANTE ATTEINTE!',
        leaderboard: 'Classement',
        profile: 'Mon Profil',
        remindMe: 'Rappeler',
        reminder: (hours) => `⏰ Je vous rappellerai dans ${hours} heures! Utilisez \`.daily\` pour réclamer votre prochaine récompense.`,
        footer: 'Nœud Mali • Archon v{version} • Réclamez demain pour le bonus de série!',
        error: '❌ Une erreur est survenue lors du traitement de votre réclamation quotidienne. Veuillez réessayer plus tard.',
        errorReport: '⚠️ **Erreur Système**\nVeuillez contacter l\'Architecte avec ce code d\'erreur:',
        accessDenied: '❌ Ces commandes sont verrouillées à votre session.',
        leaderboardNotFound: '❌ Commande de classement introuvable.',
        profileNotFound: '❌ Commande de profil introuvable.',
        weekWarrior: 'Guerrier de la Semaine',
        fortnightChampion: 'Champion de Quinze Jours',
        monthlyLegend: 'Légende Mensuelle',
        centuryMaster: 'Maître du Centenaire',
        bonusAwarded: 'Bonus +{bonus} XP attribué pour votre dévouement!'
    }
};

function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

module.exports = {
    name: 'daily',
    aliases: ['claim', 'recompense', 'dailyreward', 'checkin', 'quotidien','journalier','cadeau'],
    description: '⚡ Claim your daily Archon Credits and XP boost with streak bonuses.',
    category: 'ECONOMY',
    usage: '.daily',
    cooldown: 5000,
    examples: ['.daily'],

    run: async (client, message, args, database) => {
        
        try {
            // --- INTELLIGENT LANGUAGE DETECTION ---
            let lang = 'en';
            const guildSettings = client.settings?.get(message.guild?.id);
            if (guildSettings?.language) {
                lang = guildSettings.language;
            } else {
                const frenchKeywords = ['fr', 'francais', 'français', 'french', 'bonjour', 'salut', 'merci','cadeau','journalier','quotidien'];
                const content = message.content.toLowerCase();
                if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                    lang = 'fr';
                }
            }
            const t = dailyTranslations[lang];
            const version = client.version || '1.3.2';
            
            const userId = message.author.id;
            const userName = message.author.username;
            const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
            
            const baseXP = 250;
            const baseCredits = 100;
            
            // --- EMERGENCY DATABASE FIX ---
            try {
                // Ensure all required columns exist
                const columns = ['credits', 'streak_days', 'last_streak_date', 'last_seen'];
                for (const col of columns) {
                    try {
                        database.prepare(`ALTER TABLE users ADD COLUMN ${col} INTEGER DEFAULT 0`).run();
                        console.log(`[DAILY] Added missing column: ${col}`);
                    } catch (e) {
                        // Column already exists, ignore
                    }
                }
                // Add last_streak_date as DATETIME if not exists
                try {
                    database.prepare(`ALTER TABLE users ADD COLUMN last_streak_date DATETIME`).run();
                } catch (e) {}
            } catch (err) {
                console.log(`[DAILY] Column check error: ${err.message}`);
            }
            
            let userData = null;
            let streak = 0;
            let streakBonusXP = 0;
            let streakBonusCredits = 0;
            
            try {
                userData = database.prepare(`
                    SELECT last_seen, xp, credits, streak_days, last_streak_date 
                    FROM users 
                    WHERE id = ?
                `).get(userId);
            } catch (err) {
                console.error(`[DAILY] Fetch error: ${err.message}`);
                return message.reply(t.error);
            }
            
            // --- STREAK CALCULATION ---
            if (userData && userData.last_seen) {
                const now = new Date();
                const lastClaim = new Date(userData.last_seen).getTime();
                const oneDay = 24 * 60 * 60 * 1000;
                const timePassed = now.getTime() - lastClaim;
                const daysPassed = Math.floor(timePassed / oneDay);
                
                if (daysPassed === 1) {
                    streak = (userData.streak_days || 0) + 1;
                    streakBonusXP = Math.min(streak * 25, 250);
                    streakBonusCredits = Math.min(streak * 10, 100);
                } else if (daysPassed === 0) {
                    streak = userData.streak_days || 0;
                    streakBonusXP = Math.min(streak * 25, 250);
                    streakBonusCredits = Math.min(streak * 10, 100);
                } else {
                    streak = 1;
                    streakBonusXP = 25;
                    streakBonusCredits = 10;
                }
            } else {
                streak = 1;
                streakBonusXP = 25;
                streakBonusCredits = 10;
            }
            
            const totalXP = baseXP + streakBonusXP;
            const totalCredits = baseCredits + streakBonusCredits;
            
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            
            // --- COOLDOWN CHECK ---
            if (userData && userData.last_seen) {
                const lastClaim = new Date(userData.last_seen).getTime();
                const timePassed = now - lastClaim;
                
                if (timePassed < oneDay && timePassed > 0) {
                    const timeLeft = oneDay - timePassed;
                    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                    const timeString = `${hours}h ${minutes}m ${seconds}s`;
                    const nextReset = new Date(lastClaim + oneDay);
                    
                    const cooldownEmbed = new EmbedBuilder()
                        .setColor('#ff4444')
                        .setAuthor({ name: t.cooldownAuthor, iconURL: avatarURL })
                        .setTitle(t.cooldownTitle)
                        .setDescription(t.cooldownDesc(userName, timeString))
                        .addFields(
                            { name: t.nextSync, value: `<t:${Math.floor(nextReset.getTime() / 1000)}:R>`, inline: true },
                            { name: t.tip, value: t.tipText, inline: false },
                            { name: t.currentStreak, value: streak > 0 ? `\`${streak} ${lang === 'fr' ? 'jours' : 'days'}\`` : '`No active streak`', inline: true },
                            { name: t.streakBonus, value: `\`+${streakBonusXP} XP | +${streakBonusCredits} ${lang === 'fr' ? 'Crédits' : 'Credits'}\``, inline: true }
                        )
                        .setFooter({ text: 'ARCHITECT CG-223 • Neural Lockdown Protocol • v' + version })
                        .setTimestamp();
                    
                    return message.reply({ embeds: [cooldownEmbed] });
                }
            }
            
            // --- PROCESS CLAIM (FIXED SQL) ---
            try {
                // First, ensure user exists
                const exists = database.prepare("SELECT id FROM users WHERE id = ?").get(userId);
                if (!exists) {
                    database.prepare(`INSERT INTO users (id, username, xp, level, credits, streak_days, total_messages, last_xp_gain, games_played, games_won, total_winnings, gaming) 
                        VALUES (?, ?, 0, 1, 0, 0, 0, 0, 0, 0, 0, '{"game":"CODM","rank":"Unranked"}')`)
                        .run(userId, message.author.username);
                }
                
                // Update user with daily rewards
                const updateStmt = database.prepare(`
                    UPDATE users 
                    SET xp = COALESCE(xp, 0) + ?,
                        credits = COALESCE(credits, 0) + ?,
                        streak_days = ?,
                        last_streak_date = CURRENT_TIMESTAMP,
                        last_seen = CURRENT_TIMESTAMP
                    WHERE id = ?
                `);
                
                const result = updateStmt.run(totalXP, totalCredits, streak, userId);
                
                if (result.changes === 0) {
                    throw new Error("No rows updated - user may not exist");
                }
                
                console.log(`[DAILY] ${message.author.tag} claimed: +${totalXP} XP, +${totalCredits} credits, streak: ${streak}`);
                
            } catch (err) {
                console.error(`[DAILY] Update error: ${err.message}`);
                return message.reply(t.error);
            }
            
            // --- GET UPDATED STATS ---
            const updatedUser = database.prepare(`SELECT xp, credits, streak_days FROM users WHERE id = ?`).get(userId);
            const currentXP = updatedUser?.xp || totalXP;
            const currentCredits = updatedUser?.credits || totalCredits;
            const currentStreak = updatedUser?.streak_days || streak;
            
            const currentLevel = calculateLevel(currentXP);
            const nextLevelXP = Math.pow(currentLevel / 0.1, 2);
            const xpRemaining = Math.ceil(nextLevelXP - currentXP);
            const currentLevelStartXP = Math.pow((currentLevel - 1) / 0.1, 2);
            const progressPercent = Math.min(100, Math.max(0, ((currentXP - currentLevelStartXP) / (nextLevelXP - currentLevelStartXP)) * 100));
            
            const progressBarLength = 20;
            const filledBars = Math.floor(progressPercent / 5);
            const emptyBars = progressBarLength - filledBars;
            const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
            
            const successEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: t.successAuthor, iconURL: avatarURL })
                .setTitle(t.successTitle)
                .setDescription(t.successDesc(totalCredits, totalXP))
                .addFields(
                    { name: t.nextSync, value: `<t:${Math.floor((now + oneDay) / 1000)}:R>`, inline: true },
                    { name: t.currentStats, value: `\`\`\`yaml\n${lang === 'fr' ? 'Niveau' : 'Level'}: ${currentLevel}\n${lang === 'fr' ? 'XP Total' : 'Total XP'}: ${currentXP.toLocaleString()}\n${lang === 'fr' ? 'Crédits' : 'Credits'}: ${currentCredits.toLocaleString()}\n${lang === 'fr' ? 'Série' : 'Streak'}: ${currentStreak} ${lang === 'fr' ? 'jours' : 'days'}\`\`\``, inline: true },
                    { name: t.levelProgress, value: `\`\`\`\n${progressBar} ${progressPercent.toFixed(1)}%\n└─ ${xpRemaining.toLocaleString()} XP to Level ${currentLevel + 1}\`\`\``, inline: true }
                );
            
            if (streakBonusXP > 0 || streakBonusCredits > 0) {
                successEmbed.addFields({
                    name: t.streakActive,
                    value: `┌─ ✨ **${streak} ${lang === 'fr' ? 'Jour' : 'Day'} ${streak > 1 ? (lang === 'fr' ? 'Série' : 'Streak') : ''}!** ─────────\n` +
                           `│  ⚡ **Bonus XP:** +${streakBonusXP}\n` +
                           `│  💎 **Bonus Credits:** +${streakBonusCredits}\n` +
                           `└──────────────────────────────────`,
                    inline: false
                });
            }
            
            if (streak === 7 || streak === 14 || streak === 30 || streak === 100) {
                const milestoneRewards = {
                    7: { emoji: '🌟', name: t.weekWarrior, bonus: 100 },
                    14: { emoji: '⚡', name: t.fortnightChampion, bonus: 250 },
                    30: { emoji: '🏆', name: t.monthlyLegend, bonus: 500 },
                    100: { emoji: '👑', name: t.centuryMaster, bonus: 1000 }
                };
                const milestone = milestoneRewards[streak];
                if (milestone) {
                    successEmbed.addFields({
                        name: `${milestone.emoji} ${t.milestoneAchieved} ${milestone.emoji}`,
                        value: `**${milestone.name}**\n└─ ${t.bonusAwarded.replace('{bonus}', milestone.bonus)}`,
                        inline: false
                    });
                    try {
                        database.prepare(`UPDATE users SET xp = xp + ? WHERE id = ?`).run(milestone.bonus, userId);
                    } catch (err) {
                        console.log(`[DAILY] Milestone bonus failed: ${err.message}`);
                    }
                }
            }
            
            successEmbed
                .setFooter({ text: t.footer.replace('{version}', version), iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('view_leaderboard').setLabel(t.leaderboard).setStyle(ButtonStyle.Primary).setEmoji('🏆'),
                    new ButtonBuilder().setCustomId('view_profile').setLabel(t.profile).setStyle(ButtonStyle.Secondary).setEmoji('👤'),
                    new ButtonBuilder().setCustomId('remind_me').setLabel(t.remindMe).setStyle(ButtonStyle.Success).setEmoji('⏰')
                );
            
            const reply = await message.reply({ embeds: [successEmbed], components: [row] });
            
            const buttonCollector = reply.createMessageComponentCollector({ time: 60000 });
            
            buttonCollector.on('collect', async (interaction) => {
                if (interaction.user.id !== message.author.id) {
                    return interaction.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                switch (interaction.customId) {
                    case 'view_leaderboard':
                        const lbCommand = client.commands.get('lb') || client.commands.get('leaderboard');
                        if (lbCommand) {
                            await lbCommand.run(client, message, [], database);
                            await interaction.reply({ content: `🏆 ${lang === 'fr' ? 'Classement affiché ci-dessus!' : 'Leaderboard displayed above!'}`, ephemeral: true });
                        } else {
                            await interaction.reply({ content: t.leaderboardNotFound, ephemeral: true });
                        }
                        break;
                    case 'view_profile':
                        const rankCommand = client.commands.get('rank') || client.commands.get('profile');
                        if (rankCommand) {
                            await rankCommand.run(client, message, [], database);
                            await interaction.reply({ content: `👤 ${lang === 'fr' ? 'Profil affiché ci-dessus!' : 'Profile displayed above!'}`, ephemeral: true });
                        } else {
                            await interaction.reply({ content: t.profileNotFound, ephemeral: true });
                        }
                        break;
                    case 'remind_me':
                        const nextClaimTime = new Date(now + oneDay);
                        const timeUntil = Math.floor((nextClaimTime - now) / 1000 / 60 / 60);
                        await interaction.reply({ content: t.reminder(timeUntil), ephemeral: true });
                        break;
                }
            });
            
            console.log(`[DAILY] ✅ ${message.author.tag} claimed ${totalXP} XP and ${totalCredits} credits (Streak: ${streak}) | Lang: ${lang} | Version: ${version}`);
            
        } catch (error) {
            console.error(`[DAILY] FATAL ERROR:`, error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('❌ SYSTEM ERROR')
                .setDescription(`An error occurred while processing your daily claim.\n\n**Error:** \`${error.message.substring(0, 100)}\`\n\nPlease contact the Architect.`)
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }
    }
};