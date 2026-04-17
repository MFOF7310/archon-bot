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
        cooldownDesc: (name, time) => `**Agent ${name}**, your neural cycle is still processing.\n\n⏳ **Cooldown Remaining:** \`${time}\`\n\n💡 Use \`.daily\` to view your full dashboard.`,
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
        cooldownDesc: (name, time) => `**Agent ${name}**, votre cycle neural est toujours en cours.\n\n⏳ **Temps restant:** \`${time}\`\n\n💡 Utilisez \`.daily\` pour voir votre tableau de bord.`,
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

run: async (client, message, args, db, serverSettings, usedCommand) => {
        try {
            // 🔥 ALIAS-BASED LANGUAGE DETECTION
            const lang = client.detectLanguage 
                ? client.detectLanguage(usedCommand, serverSettings?.language || 'en')
                : serverSettings?.language || 'en';
            const t = claimTranslations[lang];
            
            const version = client.version || '1.6.0';
            const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
            const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
            
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
            
            // 🔥 RAM-FIRST CACHE
            let userData = client.getUserData 
                ? client.getUserData(userId) 
                : db.prepare(`SELECT last_daily, xp, credits, streak_days, level FROM users WHERE id = ?`).get(userId);
            
            if (!userData) {
                db.prepare(`INSERT INTO users (id, username, xp, level, credits, streak_days, last_daily) 
                    VALUES (?, ?, 0, 1, 0, 0, 0)`).run(userId, userName);
                userData = { last_daily: 0, xp: 0, credits: 0, streak_days: 0, level: 1 };
            }
            
            const lastClaim = parseInt(userData.last_daily || 0);
            const now = Date.now();
            const timePassed = now - lastClaim;
            const canClaim = timePassed >= oneDay || lastClaim === 0;
            
            // Cooldown handling
            if (!canClaim) {
                const timeLeft = oneDay - timePassed;
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                const timeString = `${hours}h ${minutes}m ${seconds}s`;
                
                const cooldownEmbed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setAuthor({ name: t.cooldownTitle, iconURL: avatarURL })
                    .setDescription(t.cooldownDesc(userName, timeString))
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
                
                const reply = await message.reply({ embeds: [cooldownEmbed], components: [row] });
                
                const collector = reply.createMessageComponentCollector({ time: 30000 });
                collector.on('collect', async (i) => {
                    if (i.user.id !== userId) {
                        return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                    }
                    
                    // 🛡️ LA LIGNE CRITIQUE
                    await i.deferUpdate().catch(() => {});
                    
                    if (i.customId === 'claim_goto_daily') {
                        const dailyCmd = client.commands.get('daily');
                        if (dailyCmd) {
                            await dailyCmd.run(client, message, [], db, serverSettings, usedCommand);
                            await i.followUp({ content: t.dashboardOpened, ephemeral: true }).catch(() => {});
                        }
                    }
                });
                return;
            }
            
            // Streak calculation
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
            
            // 🔥 BATCH WRITE SYSTEM
            const currentUserData = client.getUserData 
                ? client.getUserData(userId) 
                : db.prepare(`SELECT xp, credits FROM users WHERE id = ?`).get(userId);
            
            const nowTimestamp = Date.now();
            
            if (client.queueUserUpdate && currentUserData) {
                client.queueUserUpdate(userId, {
                    ...currentUserData,
                    username: userName,
                    xp: (currentUserData.xp || 0) + totalXP,
                    credits: (currentUserData.credits || 0) + totalCredits,
                    streak_days: streak,
                    last_daily: nowTimestamp
                });
            } else {
                db.prepare(`UPDATE users SET xp = COALESCE(xp, 0) + ?, credits = COALESCE(credits, 0) + ?, streak_days = ?, last_daily = ? WHERE id = ?`)
                    .run(totalXP, totalCredits, streak, nowTimestamp, userId);
            }
            
            // Get updated stats
            const updatedUser = client.getUserData 
                ? client.getUserData(userId) 
                : db.prepare(`SELECT xp, credits, streak_days, level FROM users WHERE id = ?`).get(userId);
            
            const currentXP = updatedUser.xp;
            const currentCredits = updatedUser.credits;
            const currentLevel = updatedUser.level || calculateLevel(currentXP);
            
            // Success embed
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
            
            const reply = await message.reply({ embeds: [successEmbed], components: [actionRow] });
            
            // 🔥 BUTTON COLLECTOR CORRIGÉ
            const buttonCollector = reply.createMessageComponentCollector({ time: 60000 });
            
            buttonCollector.on('collect', async (i) => {
                if (i.user.id !== userId) {
                    return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }
                
                // 🛡️ LA LIGNE CRITIQUE
                await i.deferUpdate().catch(() => {});
                
                if (i.customId === 'claim_view_daily') {
                    const dailyCmd = client.commands.get('daily');
                    if (dailyCmd) {
                        await dailyCmd.run(client, message, [], db, serverSettings, usedCommand);
                        await i.followUp({ content: t.dashboardOpened, ephemeral: true }).catch(() => {});
                    }
                } else if (i.customId === 'claim_view_profile') {
                    const rankCmd = client.commands.get('rank') || client.commands.get('profile');
                    if (rankCmd) {
                        await rankCmd.run(client, message, [], db, serverSettings, usedCommand);
                        await i.followUp({ content: t.profileOpened, ephemeral: true }).catch(() => {});
                    }
                }
            });
            
        } catch (error) {
            console.error(`[CLAIM] FATAL ERROR:`, error);
            const lang = client.detectLanguage 
                ? client.detectLanguage(usedCommand, 'en')
                : 'en';
                        return message.reply({ content: claimTranslations[lang].error }).catch(() => {});
        }
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        // Simulate message object
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            reply: async (options) => {
                if (interaction.deferred) return interaction.editReply(options);
                return interaction.reply(options);
            },
            react: () => Promise.resolve()
        };
        
        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };
        
        await module.exports.run(client, fakeMessage, [], client.db, serverSettings, 'claim');
    }
};