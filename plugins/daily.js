const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// --- BILINGUAL TRANSLATIONS ---
const dailyTranslations = {
    en: {
        // System messages
        cooldownTitle: '◈ SYSTEM LOCKOUT ACTIVE ◈',
        cooldownAuthor: '🔒 NEURAL LINK ON COOLDOWN',
        successTitle: '◈ DAILY REWARDS INITIALIZED ◈',
        successAuthor: '⚡ NEURAL SYNC SUCCESSFUL',
        
        // Descriptions
        cooldownDesc: (name, time) => `**Agent ${name}**, your daily synchronization is still processing.\n\n⏳ **Time Remaining:** \`${time}\``,
        successDesc: (credits, xp) => 
            `**Agent**, your daily resource injection has been processed.\n\n` +
            `┌─ 📦 **REWARDS RECEIVED** ─────────\n` +
            `│  💰 **Credits:** +${credits.toLocaleString()}\n` +
            `│  📈 **XP Boost:** +${xp.toLocaleString()}\n` +
            `└──────────────────────────────────\n\n`,
        
        // Field labels
        tip: '💡 TIP',
        tipText: 'Claim at the same time daily to maintain your streak bonus!',
        currentStreak: '🎯 CURRENT STREAK',
        streakBonus: '⚡ STREAK BONUS',
        nextSync: '🎯 NEXT SYNC',
        currentStats: '🎯 CURRENT STATISTICS',
        levelProgress: '📊 LEVEL PROGRESS',
        streakActive: '🔥 STREAK BONUS ACTIVE',
        milestoneAchieved: 'MILESTONE ACHIEVED!',
        
        // Buttons
        leaderboard: 'Leaderboard',
        profile: 'My Profile',
        remindMe: 'Remind Me',
        
        // Reminder message
        reminder: (hours) => `⏰ I'll remind you in ${hours} hours! Use \`.daily\` then to claim your next reward.`,
        
        // Footer
        footer: 'Mali Node • Archon v1.3.2-STABLE • Claim tomorrow for streak bonus!',
        
        // Errors
        error: '❌ An error occurred while processing your daily claim. Please try again later.',
        accessDenied: '❌ These controls are locked to your session.',
        leaderboardNotFound: '❌ Leaderboard command not found.',
        profileNotFound: '❌ Profile command not found.',
        
        // Milestones
        weekWarrior: 'Week Warrior',
        fortnightChampion: 'Fortnight Champion',
        monthlyLegend: 'Monthly Legend',
        centuryMaster: 'Century Master',
        bonusAwarded: 'Bonus +{bonus} XP awarded for your dedication!'
    },
    fr: {
        // System messages
        cooldownTitle: '◈ VERROUILLAGE SYSTÈME ACTIF ◈',
        cooldownAuthor: '🔒 LIEN NEURAL EN REFROIDISSEMENT',
        successTitle: '◈ RÉCOMPENSES JOURNALIÈRES INITIALISÉES ◈',
        successAuthor: '⚡ SYNCHRO NEURAL RÉUSSIE',
        
        // Descriptions
        cooldownDesc: (name, time) => `**Agent ${name}**, votre synchronisation quotidienne est en cours de traitement.\n\n⏳ **Temps restant:** \`${time}\``,
        successDesc: (credits, xp) =>
            `**Agent**, votre injection de ressources quotidienne a été traitée.\n\n` +
            `┌─ 📦 **RÉCOMPENSES REÇUES** ─────────\n` +
            `│  💰 **Crédits:** +${credits.toLocaleString()}\n` +
            `│  📈 **XP:** +${xp.toLocaleString()}\n` +
            `└──────────────────────────────────\n\n`,
        
        // Field labels
        tip: '💡 ASTUCE',
        tipText: 'Réclamez à la même heure chaque jour pour maintenir votre bonus de série!',
        currentStreak: '🎯 SÉRIE ACTUELLE',
        streakBonus: '⚡ BONUS DE SÉRIE',
        nextSync: '🎯 PROCHAINE SYNCHRO',
        currentStats: '🎯 STATISTIQUES ACTUELLES',
        levelProgress: '📊 PROGRESSION DE NIVEAU',
        streakActive: '🔥 BONUS DE SÉRIE ACTIF',
        milestoneAchieved: 'ÉTAPE IMPORTANTE ATTEINTE!',
        
        // Buttons
        leaderboard: 'Classement',
        profile: 'Mon Profil',
        remindMe: 'Rappeler',
        
        // Reminder message
        reminder: (hours) => `⏰ Je vous rappellerai dans ${hours} heures! Utilisez \`.daily\` pour réclamer votre prochaine récompense.`,
        
        // Footer
        footer: 'Nœud Mali • Archon v1.3.2-STABLE • Réclamez demain pour le bonus de série!',
        
        // Errors
        error: '❌ Une erreur est survenue lors du traitement de votre réclamation quotidienne. Veuillez réessayer plus tard.',
        accessDenied: '❌ Ces commandes sont verrouillées à votre session.',
        leaderboardNotFound: '❌ Commande de classement introuvable.',
        profileNotFound: '❌ Commande de profil introuvable.',
        
        // Milestones
        weekWarrior: 'Guerrier de la Semaine',
        fortnightChampion: 'Champion de Quinze Jours',
        monthlyLegend: 'Légende Mensuelle',
        centuryMaster: 'Maître du Centenaire',
        bonusAwarded: 'Bonus +{bonus} XP attribué pour votre dévouement!'
    }
};

module.exports = {
    name: 'daily',
    aliases: ['claim', 'recompense', 'dailyreward', 'checkin', 'quotidien'],
    description: '⚡ Claim your daily Archon Credits and XP boost with streak bonuses.',
    category: 'ECONOMY',
    usage: '.daily',
    cooldown: 5000,
    examples: ['.daily'],

    run: async (client, message, args, database) => {
        
        // --- INTELLIGENT LANGUAGE DETECTION ---
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else {
            const frenchKeywords = ['fr', 'francais', 'français', 'french', 'bonjour', 'salut', 'merci'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }
        const t = dailyTranslations[lang];
        
        const userId = message.author.id;
        const userName = message.author.username;
        const avatarURL = message.author.displayAvatarURL({ dynamic: true, size: 256 });
        
        // --- BASE REWARDS ---
        const baseXP = 250;
        const baseCredits = 100;
        
        // --- FETCH USER DATA ONCE (Single database trip) ---
        let userData = null;
        let streak = 0;
        let streakBonusXP = 0;
        let streakBonusCredits = 0;
        
        try {
            // Ensure streak columns exist
            try {
                database.prepare(`ALTER TABLE users ADD COLUMN streak_days INTEGER DEFAULT 0`).run();
                database.prepare(`ALTER TABLE users ADD COLUMN last_streak_date DATETIME`).run();
                database.prepare(`ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0`).run();
            } catch (e) {
                // Columns already exist - ignore
            }
            
            // Single fetch for all user data
            userData = database.prepare(`
                SELECT last_seen, xp, credits, streak_days, last_streak_date 
                FROM users 
                WHERE id = ?
            `).get(userId);
            
            // --- STREAK CALCULATION (Only if user exists and has claimed before) ---
            if (userData && userData.last_seen) {
                const now = new Date();
                const lastClaim = new Date(userData.last_seen).getTime();
                const oneDay = 24 * 60 * 60 * 1000;
                const timePassed = now.getTime() - lastClaim;
                const daysPassed = Math.floor(timePassed / oneDay);
                
                // Calculate streak based on time between claims
                if (daysPassed === 1) {
                    // Consecutive day - increase streak
                    streak = (userData.streak_days || 0) + 1;
                    streakBonusXP = Math.min(streak * 25, 250); // Cap at 250 bonus XP
                    streakBonusCredits = Math.min(streak * 10, 100); // Cap at 100 bonus credits
                } else if (daysPassed === 0) {
                    // Already claimed today - will be caught by cooldown check
                    streak = userData.streak_days || 0;
                    streakBonusXP = Math.min(streak * 25, 250);
                    streakBonusCredits = Math.min(streak * 10, 100);
                } else {
                    // Streak broken - reset to day 1
                    streak = 1;
                    streakBonusXP = 25;
                    streakBonusCredits = 10;
                }
            } else {
                // First time claim
                streak = 1;
                streakBonusXP = 25;
                streakBonusCredits = 10;
            }
        } catch (err) {
            console.error('Streak calculation error:', err);
            streak = 1;
            streakBonusXP = 25;
            streakBonusCredits = 10;
        }
        
        const totalXP = baseXP + streakBonusXP;
        const totalCredits = baseCredits + streakBonusCredits;
        
        // --- CHECK IF ALREADY CLAIMED TODAY (Using the data we already fetched) ---
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (userData && userData.last_seen) {
            const lastClaim = new Date(userData.last_seen).getTime();
            const timePassed = now - lastClaim;
            
            // Check if claimed in last 24 hours
            if (timePassed < oneDay) {
                const timeLeft = oneDay - timePassed;
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                const timeString = `${hours}h ${minutes}m ${seconds}s`;
                
                // Get next reset time
                const nextReset = new Date(lastClaim + oneDay);
                
                const cooldownEmbed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setAuthor({ name: t.cooldownAuthor, iconURL: avatarURL })
                    .setTitle(t.cooldownTitle)
                    .setDescription(t.cooldownDesc(userName, timeString))
                    .addFields(
                        { 
                            name: t.nextSync, 
                            value: `<t:${Math.floor(nextReset.getTime() / 1000)}:R>`, 
                            inline: true 
                        },
                        { 
                            name: t.tip, 
                            value: t.tipText, 
                            inline: false 
                        },
                        { 
                            name: t.currentStreak, 
                            value: streak > 0 ? `\`${streak} ${lang === 'fr' ? 'jours' : 'days'}\`` : '`No active streak`', 
                            inline: true 
                        },
                        { 
                            name: t.streakBonus, 
                            value: `\`+${streakBonusXP} XP | +${streakBonusCredits} ${lang === 'fr' ? 'Crédits' : 'Credits'}\``, 
                            inline: true 
                        }
                    )
                    .setFooter({ text: 'ARCHITECT CG-223 • Neural Lockdown Protocol • v1.3.2' })
                    .setTimestamp();
                
                return message.reply({ embeds: [cooldownEmbed] });
            }
        }
        
        // --- UPDATE DATABASE WITH ATOMIC TRANSACTION (Single operation) ---
        try {
            const updateStmt = database.prepare(`
                INSERT INTO users (id, xp, credits, last_seen, streak_days, last_streak_date) 
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP) 
                ON CONFLICT(id) DO UPDATE SET 
                    xp = COALESCE(xp, 0) + ?,
                    credits = COALESCE(credits, 0) + ?,
                    last_seen = CURRENT_TIMESTAMP,
                    streak_days = ?,
                    last_streak_date = CURRENT_TIMESTAMP
            `);
            
            updateStmt.run(userId, totalXP, totalCredits, streak, totalXP, totalCredits, streak);
            
        } catch (err) {
            console.error('Daily claim error:', err);
            return message.reply(t.error);
        }
        
        // --- GET UPDATED STATS (Single fetch after update) ---
        const updatedUser = database.prepare(`
            SELECT xp, credits, streak_days FROM users WHERE id = ?
        `).get(userId);
        
        const currentXP = updatedUser?.xp || totalXP;
        const currentCredits = updatedUser?.credits || totalCredits;
        const currentStreak = updatedUser?.streak_days || streak;
        
        // Calculate next level progress
        const currentLevel = Math.floor(currentXP / 1000);
        const nextLevelXP = (currentLevel + 1) * 1000;
        const xpToNextLevel = nextLevelXP - currentXP;
        const progressPercent = ((currentXP % 1000) / 1000) * 100;
        
        // Create progress bar
        const progressBarLength = 20;
        const filledBars = Math.floor(progressPercent / 5);
        const emptyBars = progressBarLength - filledBars;
        const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
        
        // --- SUCCESS EMBED WITH STREAK BONUS ---
        const successEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: t.successAuthor, iconURL: avatarURL })
            .setTitle(t.successTitle)
            .setDescription(t.successDesc(totalCredits, totalXP))
            .addFields(
                { 
                    name: t.nextSync, 
                    value: `<t:${Math.floor((now + oneDay) / 1000)}:R>`, 
                    inline: true 
                },
                { 
                    name: t.currentStats, 
                    value: `\`\`\`yaml\n${lang === 'fr' ? 'Niveau' : 'Level'}: ${currentLevel}\n${lang === 'fr' ? 'XP Total' : 'Total XP'}: ${currentXP.toLocaleString()}\n${lang === 'fr' ? 'Crédits' : 'Credits'}: ${currentCredits.toLocaleString()}\n${lang === 'fr' ? 'Série' : 'Streak'}: ${currentStreak} ${lang === 'fr' ? 'jours' : 'days'}\`\`\``,
                    inline: true 
                },
                { 
                    name: t.levelProgress, 
                    value: `\`\`\`\n${progressBar} ${progressPercent.toFixed(1)}%\n└─ ${xpToNextLevel} XP to Level ${currentLevel + 1}\`\`\``,
                    inline: true 
                }
            );
        
        // Add streak bonus section if applicable
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
        
        // Add milestone celebration for streaks
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
                
                // Add milestone bonus XP
                database.prepare(`UPDATE users SET xp = xp + ? WHERE id = ?`).run(milestone.bonus, userId);
            }
        }
        
        successEmbed
            .setFooter({ text: t.footer, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        // --- ADD INTERACTIVE BUTTONS ---
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('view_leaderboard')
                    .setLabel(t.leaderboard)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🏆'),
                new ButtonBuilder()
                    .setCustomId('view_profile')
                    .setLabel(t.profile)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👤'),
                new ButtonBuilder()
                    .setCustomId('remind_me')
                    .setLabel(t.remindMe)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('⏰')
            );
        
        const reply = await message.reply({ embeds: [successEmbed], components: [row] });
        
        // --- HANDLE BUTTON INTERACTIONS ---
        const buttonCollector = reply.createMessageComponentCollector({ time: 60000 });
        
        buttonCollector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: t.accessDenied, ephemeral: true });
            }
            
            switch (interaction.customId) {
                case 'view_leaderboard':
                    const lbCommand = client.commands.get('lb');
                    if (lbCommand) {
                        await lbCommand.run(client, message, [], database);
                        await interaction.reply({ content: `🏆 ${lang === 'fr' ? 'Classement affiché ci-dessus!' : 'Leaderboard displayed above!'}`, ephemeral: true });
                    } else {
                        await interaction.reply({ content: t.leaderboardNotFound, ephemeral: true });
                    }
                    break;
                    
                case 'view_profile':
                    const rankCommand = client.commands.get('rank');
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
                    await interaction.reply({ 
                        content: t.reminder(timeUntil),
                        ephemeral: true 
                    });
                    break;
            }
        });
        
        // --- LOG THE CLAIM ---
        console.log(`[DAILY] ${message.author.tag} claimed ${totalXP} XP and ${totalCredits} credits (Streak: ${streak}) | Lang: ${lang}`);
    }
};