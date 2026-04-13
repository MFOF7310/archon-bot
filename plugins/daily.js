const { EmbedBuilder } = require('discord.js');

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
        checkBalance: 'Check your balance anytime with `.bal` or `.credits`',
        footer: 'NEURAL DAILY • CLAIM EVERY 24H',
        streakMilestone: '🔥 STREAK MILESTONE!',
        bonusAdded: 'Bonus added',
        levelUp: '🎉 LEVEL UP!',
        reachedLevel: 'You reached level'
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
        checkBalance: 'Vérifiez votre solde avec `.bal` ou `.credits`',
        footer: 'NEURAL DAILY • RÉCLAMEZ TOUTES LES 24H',
        streakMilestone: '🔥 JALON DE SÉRIE !',
        bonusAdded: 'Bonus ajouté',
        levelUp: '🎉 NIVEAU SUPÉRIEUR !',
        reachedLevel: 'Vous avez atteint le niveau'
    }
};

module.exports = {
    name: 'daily',
    aliases: ['claim', 'reward', 'dailyreward', 'quotidien', 'reclamer'],
    description: '📅 Claim your daily neural credits reward.',
    category: 'ECONOMY',
    cooldown: 5000,
    usage: '.daily',
    examples: ['.daily', '.claim'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        const t = dailyTranslations[lang];
        
        const version = client.version || '1.7.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const userId = message.author.id;
        const username = message.author.username;
        const now = Math.floor(Date.now() / 1000);
        const oneDay = 86400;

        // Get user data - FORCE FRESH READ
        try { db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run(); } catch (e) {}
        if (client.userDataCache) client.userDataCache.delete(userId);
        
        let userData = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

        if (!userData) {
            db.prepare("INSERT INTO users (id, username, xp, level, credits, streak_days, last_daily) VALUES (?, ?, 0, 1, 0, 0, 0)").run(userId, username);
            userData = { credits: 0, xp: 0, level: 1, streak_days: 0, last_daily: 0 };
        }

        const lastDaily = userData.last_daily || 0;
        const streakDays = userData.streak_days || 0;
        const oldBalance = userData.credits || 0;
        const oldXP = userData.xp || 0;
        const oldLevel = userData.level || 1;

        // 🔥 FIXED: Only check if actually claimed today (not first time)
        if (lastDaily > 0 && (now - lastDaily) < oneDay) {
            const timeLeft = oneDay - (now - lastDaily);
            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setAuthor({ name: t.alreadyClaimed, iconURL: message.author.displayAvatarURL() })
                .setDescription(
                    `⏰ **${t.comeBack} ${hours} ${t.hours} ${minutes} ${t.minutes}**\n\n` +
                    `🔥 **${t.currentStreak}:** ${streakDays} ${streakDays === 1 ? t.day : t.days}\n` +
                    `💰 **${t.newBalance}:** ${oldBalance.toLocaleString()} 🪙\n\n` +
                    `💡 *${t.checkBalance}*`
                )
                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // Calculate rewards
        let newStreak = streakDays + 1;
        if (lastDaily === 0) {
            newStreak = 1; // First time claiming
        } else if (now - lastDaily > oneDay * 2) {
            newStreak = 1; // Streak broken
        }

        const baseReward = 100;
        const streakBonus = Math.min(newStreak * 10, 200);
        const totalReward = baseReward + streakBonus;
        const xpReward = 50 + (newStreak * 5);

        // Apply rewards
        const newCredits = oldBalance + totalReward;
        const newXP = oldXP + xpReward;
        const newLevel = Math.floor(0.1 * Math.sqrt(newXP)) + 1;

        // Update database
        if (client.queueUserUpdate) {
            client.queueUserUpdate(userId, {
                ...userData,
                credits: newCredits,
                xp: newXP,
                level: newLevel,
                streak_days: newStreak,
                last_daily: now,
                username: username
            });
        } else {
            db.prepare("UPDATE users SET credits = ?, xp = ?, level = ?, streak_days = ?, last_daily = ? WHERE id = ?")
                .run(newCredits, newXP, newLevel, newStreak, now, userId);
        }

        // 🔥 FORCE WAL SYNC + CACHE INVALIDATION
        try { db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run(); } catch (e) {}
        if (client.userDataCache) client.userDataCache.delete(userId);

        // Check for streak milestones
        let bonusAdded = 0;
        let finalCredits = newCredits;
        
        if (newStreak === 7) {
            bonusAdded = 500;
            finalCredits = newCredits + bonusAdded;
            db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(finalCredits, userId);
        } else if (newStreak === 30) {
            bonusAdded = 2000;
            finalCredits = newCredits + bonusAdded;
            db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(finalCredits, userId);
        }

        // Build success embed
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: t.claimed, iconURL: message.author.displayAvatarURL() })
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.baseReward}: ${baseReward} 🪙\n` +
                `${t.streakBonus}: +${streakBonus} 🪙\n` +
                `${t.xpEarned}: +${xpReward} XP\n` +
                (bonusAdded > 0 ? `🎁 ${t.streakMilestone}: +${bonusAdded} 🪙\n` : '') +
                `\`\`\`\n` +
                `## 💰 **${t.totalEarned}: ${totalReward + bonusAdded} 🪙**\n` +
                `## 📊 **${t.newBalance}: ${finalCredits.toLocaleString()} 🪙**\n` +
                `## 🔥 **${t.currentStreak}: ${newStreak} ${newStreak === 1 ? t.day : t.days}**\n\n` +
                `---\n` +
                `💡 **${t.verifyWith} \`.bal\` or \`.credits\`**`
            )
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();

        if (newLevel > oldLevel) {
            embed.addFields({
                name: t.levelUp,
                value: `🎉 ${t.reachedLevel} **${newLevel}**!`,
                inline: false
            });
        }

        await message.reply({ embeds: [embed] }).catch(() => {});

        // Level up announcement
        if (newLevel > oldLevel) {
            await message.channel.send({ 
                content: `🎉 **LEVEL UP!** <@${userId}> ${t.reachedLevel} **${newLevel}**!` 
            }).catch(() => {});
        }

        console.log(`[DAILY] ${username} claimed daily: +${totalReward} credits, streak: ${newStreak} | Lang: ${lang}`);
    }
};