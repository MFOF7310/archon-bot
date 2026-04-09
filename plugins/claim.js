const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
        cooldownDesc: (name, time) => `**Agent ${name}**, your neural cycle is still processing.\n\n⏳ **Cooldown Remaining:** \`${time}\`\n\n💡 Use \`.daily\` to view your full dashboard.`,
        successDesc: (credits, xp, streak) => 
            `**Agent**, your daily resources have been successfully injected into your neural interface.\n\n` +
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
        reminderActive: (time) => `🔔 **Reminder Active!** You'll be notified ${time}. Use \`.daily\` to view your dashboard.`,
        claimed: '✅ Claimed!',
        levelUp: '🎉 LEVEL UP!',
        channelRestricted: (channelId) => `📊 The claim protocol is restricted to the <#${channelId}> channel.`,
        tip: '💡 TIP',
        dashboardOpened: '📊 Dashboard displayed above!',
        profileOpened: '👤 Profile displayed above!'
    },
    fr: {
        title: '⚡ PROTOCOLE DE RÉCLAMATION NEURALE',
        successTitle: '✅ RESSOURCES INJECTÉES',
        cooldownTitle: '🔒 ACCÈS REFUSÉ',
        cooldownDesc: (name, time) => `**Agent ${name}**, votre cycle neural est toujours en cours.\n\n⏳ **Temps restant:** \`${time}\`\n\n💡 Utilisez \`.daily\` pour voir votre tableau de bord complet.`,
        successDesc: (credits, xp, streak) => 
            `**Agent**, vos ressources quotidiennes ont été injectées avec succès dans votre interface neurale.\n\n` +
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
        reminderActive: (time) => `🔔 **Rappel Actif!** Vous serez notifié ${time}. Utilisez \`.daily\` pour voir votre tableau de bord.`,
        claimed: '✅ Réclamé!',
        levelUp: '🎉 NIVEAU SUPÉRIEUR!',
        channelRestricted: (channelId) => `📊 Le protocole de réclamation est restreint au canal <#${channelId}>.`,
        tip: '💡 ASTUCE',
        dashboardOpened: '📊 Tableau de bord affiché ci-dessus !',
        profileOpened: '👤 Profil affiché ci-dessus !'
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

function createProgressBar(percentage, length = 15) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

// ================= LEVEL UP EMBED =================
async function sendLevelUpEmbed(channel, username, oldLevel, newLevel, currentXP, lang, version, guildName, guildIcon) {
    const rank = getRank(newLevel);
    const nextLevelXP = Math.pow(newLevel / 0.1, 2);
    const prevLevelXP = Math.pow((newLevel - 1) / 0.1, 2);
    const xpInLevel = currentXP - prevLevelXP;
    const xpNeeded = nextLevelXP - prevLevelXP;
    const progressPercent = xpNeeded > 0 ? Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100)) : 100;
    const progressBar = createProgressBar(progressPercent, 12);
    
    const embed = new EmbedBuilder()
        .setColor(rank.color)
        .setTitle(`${lang === 'fr' ? '🎊 PROMOTION ! 🎊' : '🎊 LEVEL UP! 🎊'}`)
        .setDescription(
            `**${username}** ${lang === 'fr' ? 'est promu' : 'reached'} **Level ${newLevel}**!\n\n` +
            `${rank.emoji} **${rank.title[lang]}**\n` +
            `\`${progressBar}\` ${progressPercent.toFixed(1)}%\n` +
            `└─ ${lang === 'fr' ? 'Prochain niveau' : 'Next level'}: ${Math.ceil(xpNeeded - xpInLevel).toLocaleString()} XP`
        )
        .setFooter({ text: `${guildName} • ARCHITECT CG-223 • v${version}`, iconURL: guildIcon })
        .setTimestamp();
    
    await channel.send({ embeds: [embed] });
}

module.exports = {
    name: 'claim',
    aliases: ['reclamer', 'reclaim', 'collect', 'recolter', 'réclamer'],
    description: '⚡ Claim your daily rewards when the neural cycle is complete.',
    category: 'ECONOMY',
    usage: '.claim',
    cooldown: 3000,
    examples: ['.claim'],

    // ✅ FIXED: Added usedCommand as 6th parameter for language bridge!
    run: async (client, message, args, database, serverSettings, usedCommand) => {
        
        try {
            // ✅ NEW LOGIC: Alias detection first (Neural Language Bridge!)
            const lang = client.detectLanguage 
                ? client.detectLanguage(usedCommand, serverSettings?.language || 'en')
                : serverSettings?.language || 'en';
            const t = claimTranslations[lang];
            
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
            
            // --- GET USER DATA ---
            let userData = null;
            try {
                userData = database.prepare(`
                    SELECT last_daily, xp, credits, streak_days, level 
                    FROM users WHERE id = ?
                `).get(userId);
            } catch (err) {
                console.error(`[CLAIM] Fetch error: ${err.message}`);
                return message.reply(t.error);
            }
            
            // Ensure user exists
            if (!userData) {
                database.prepare(`INSERT INTO users (id, username, xp, level, credits, streak_days, last_daily) 
                    VALUES (?, ?, 0, 1, 0, 0, 0)`).run(userId, userName);
                userData = { last_daily: 0, xp: 0, credits: 0, streak_days: 0, level: 1 };
            }
            
            // --- COOLDOWN VALIDATION ---
            const lastClaim = parseInt(userData.last_daily || 0);
            const now = Date.now();
            const timePassed = now - lastClaim;
            const canClaim = timePassed >= oneDay || lastClaim === 0;
            
            if (!canClaim) {
                const timeLeft = oneDay - timePassed;
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                const timeString = `${hours}h ${minutes}m ${seconds}s`;
                
                // Check for active reminder
                const reminder = database.prepare(`
                    SELECT execute_at FROM reminders 
                    WHERE user_id = ? AND status = 'pending' AND message LIKE '%reward%'
                `).get(userId);
                
                const cooldownEmbed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setAuthor({ name: t.cooldownTitle, iconURL: avatarURL })
                    .setTitle('🔒 NEURAL CYCLE INCOMPLETE')
                    .setDescription(t.cooldownDesc(userName, timeString))
                    .addFields(
                        { name: t.tip, value: lang === 'fr' ? 'Utilisez `.daily` pour voir votre tableau de bord complet.' : 'Use `.daily` to view your full dashboard.', inline: false }
                    )
                    .setFooter({ text: `${guildName} • ARCHITECT CG-223 • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('goto_daily')
                            .setLabel(t.viewDashboard)
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📊')
                    );
                
                if (reminder) {
                    cooldownEmbed.addFields({
                        name: '🔔 REMINDER STATUS',
                        value: lang === 'fr' 
                            ? `✅ Rappel actif pour <t:${reminder.execute_at}:R>`
                            : `✅ Reminder active for <t:${reminder.execute_at}:R>`,
                        inline: false
                    });
                }
                
                const reply = await message.reply({ embeds: [cooldownEmbed], components: [row] });
                
                // Button collector
                const collector = reply.createMessageComponentCollector({ time: 30000 });
                collector.on('collect', async (i) => {
                    if (i.user.id !== userId) {
                        return i.reply({ content: t.accessDenied, ephemeral: true });
                    }
                    if (i.customId === 'goto_daily') {
                        const dailyCmd = client.commands.get('daily');
                        if (dailyCmd) {
                            // ✅ Pass serverSettings AND usedCommand to daily
                            await dailyCmd.run(client, message, [], database, serverSettings, usedCommand);
                            await i.reply({ content: t.dashboardOpened, ephemeral: true });
                        }
                    }
                });
                
                return;
            }
            
            // --- STREAK CALCULATION ---
            let streak = 1;
            let streakBonusXP = 25;
            let streakBonusCredits = 10;
            
            if (lastClaim > 0) {
                const daysPassed = Math.floor(timePassed / oneDay);
                if (daysPassed === 1) {
                    streak = (userData.streak_days || 0) + 1;
                    streakBonusXP = Math.min(streak * 25, 250);
                    streakBonusCredits = Math.min(streak * 10, 100);
                } else if (daysPassed > 1) {
                    streak = 1;
                    streakBonusXP = 25;
                    streakBonusCredits = 10;
                }
            }
            
            const totalXP = baseXP + streakBonusXP;
            const totalCredits = baseCredits + streakBonusCredits;
            
            // --- PROCESS CLAIM ---
            try {
                const nowTimestamp = Date.now();
                
                database.prepare(`
                    UPDATE users 
                    SET xp = COALESCE(xp, 0) + ?,
                        credits = COALESCE(credits, 0) + ?,
                        streak_days = ?,
                        last_daily = ?
                    WHERE id = ?
                `).run(totalXP, totalCredits, streak, nowTimestamp, userId);
                
                console.log(`[CLAIM] ${message.author.tag} claimed: +${totalXP} XP, +${totalCredits} credits, streak: ${streak}`);
                
            } catch (err) {
                console.error(`[CLAIM] Update error: ${err.message}`);
                return message.reply(t.error);
            }
            
            // --- GET UPDATED STATS ---
            const updatedUser = database.prepare(`SELECT xp, credits, streak_days FROM users WHERE id = ?`).get(userId);
            const currentXP = updatedUser.xp;
            const currentCredits = updatedUser.credits;
            const currentLevel = calculateLevel(currentXP);
            const oldLevel = userData.level || 1;
            
            // --- SUCCESS EMBED ---
            const successEmbed = new EmbedBuilder()
                .setColor('#00fbff')
                .setAuthor({ name: t.successTitle, iconURL: avatarURL })
                .setTitle('⚡ NEURAL SYNC COMPLETE')
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
                .setFooter({ text: `${guildName} • ARCHITECT CG-223 • v${version} • ${lang === 'fr' ? 'Réclamez demain!' : 'Claim tomorrow!'}`, iconURL: guildIcon })
                .setTimestamp();
            
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('view_daily')
                        .setLabel(t.viewDashboard)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📊'),
                    new ButtonBuilder()
                        .setCustomId('view_profile')
                        .setLabel(t.myProfile)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('👤')
                );
            
            const reply = await message.reply({ embeds: [successEmbed], components: [actionRow] });
            
            // Level up check
            if (currentLevel > oldLevel) {
                database.prepare(`UPDATE users SET level = ? WHERE id = ?`).run(currentLevel, userId);
                await sendLevelUpEmbed(message.channel, userName, oldLevel, currentLevel, currentXP, lang, version, guildName, guildIcon);
            }
            
            // Button collector
            const buttonCollector = reply.createMessageComponentCollector({ time: 60000 });
            buttonCollector.on('collect', async (i) => {
                if (i.user.id !== userId) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                if (i.customId === 'view_daily') {
                    const dailyCmd = client.commands.get('daily');
                    if (dailyCmd) {
                        // ✅ Pass serverSettings AND usedCommand to daily
                        await dailyCmd.run(client, message, [], database, serverSettings, usedCommand);
                        await i.reply({ content: t.dashboardOpened, ephemeral: true });
                    }
                } else if (i.customId === 'view_profile') {
                    const rankCmd = client.commands.get('rank') || client.commands.get('profile');
                    if (rankCmd) {
                        // ✅ Pass serverSettings AND usedCommand to rank
                        await rankCmd.run(client, message, [], database, serverSettings, usedCommand);
                        await i.reply({ content: t.profileOpened, ephemeral: true });
                    }
                }
            });
            
        } catch (error) {
            console.error(`[CLAIM] FATAL ERROR:`, error);
            const lang = serverSettings?.language || 'en';
            return message.reply({ content: claimTranslations[lang].error });
        }
    }
};