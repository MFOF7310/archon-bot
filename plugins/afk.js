const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= 🔥 STOCKAGE AFK (RAM) - DÉFINI EN HAUT =================
const afkUsers = new Map(); // userId -> { reason, timestamp, username, avatar, originalNickname }

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        // AFK Set
        afkSet: (user, reason) => `✅ **${user}** is now AFK: *${reason}*`,
        afkSetWithTime: (user, reason, time) => `✅ **${user}** is now AFK: *${reason}*\n⏰ Will auto-return in **${time}**`,
        afkRemoved: (user) => `👋 Welcome back **${user}**! Your AFK status has been removed.`,
        afkAutoRemoved: (user) => `⏰ **${user}**'s AFK timer expired. Welcome back!`,
        justNow: 'just now',
        minutes: 'minutes',
        hours: 'hours',
        
        // Mentions
        userIsAfk: (user, reason, time) => `💤 **${user}** is currently AFK (${time}): *${reason}*`,
        userIsAfkNoReason: (user, time) => `💤 **${user}** is currently AFK (${time})`,
        
        // Buttons
        remindButton: '🔔 Remind Them',
        clearAfkButton: '✅ Clear AFK',
        extendButton: '⏰ Extend',
        
        // Messages
        remindSent: '🔔 Reminder sent! They\'ll see it when they return.',
        afkCleared: '✅ AFK status cleared!',
        afkExtended: (time) => `⏰ AFK extended by **${time}**!`,
        cannotClearOwn: '❌ You cannot clear your own AFK status!',
        cannotClearOthers: '❌ You cannot clear someone else\'s AFK status!',
        
        // Embed
        afkStatus: '💤 AFK STATUS',
        reason: 'Reason',
        since: 'Since',
        autoReturn: 'Auto-Return',
        none: 'None',
        permanent: 'Permanent',
        
        // Slash
        slashDescription: 'Set your AFK status',
        reasonOption: 'Reason for being AFK',
        timeOption: 'Auto-return time (e.g., 30m, 2h)',
        ephemeralReply: 'Only visible to you',
        publicReply: 'Visible to everyone'
    },
    fr: {
        // AFK Set
        afkSet: (user, reason) => `✅ **${user}** est maintenant AFK: *${reason}*`,
        afkSetWithTime: (user, reason, time) => `✅ **${user}** est maintenant AFK: *${reason}*\n⏰ Retour automatique dans **${time}**`,
        afkRemoved: (user) => `👋 Bon retour **${user}**! Votre statut AFK a été retiré.`,
        afkAutoRemoved: (user) => `⏰ Le minuteur AFK de **${user}** a expiré. Bon retour !`,
        justNow: 'à l\'instant',
        minutes: 'minutes',
        hours: 'heures',
        
        // Mentions
        userIsAfk: (user, reason, time) => `💤 **${user}** est actuellement AFK (${time}): *${reason}*`,
        userIsAfkNoReason: (user, time) => `💤 **${user}** est actuellement AFK (${time})`,
        
        // Buttons
        remindButton: '🔔 Rappeler',
        clearAfkButton: '✅ Retirer AFK',
        extendButton: '⏰ Prolonger',
        
        // Messages
        remindSent: '🔔 Rappel envoyé ! Ils le verront à leur retour.',
        afkCleared: '✅ Statut AFK retiré !',
        afkExtended: (time) => `⏰ AFK prolongé de **${time}** !`,
        cannotClearOwn: '❌ Vous ne pouvez pas retirer votre propre statut AFK !',
        cannotClearOthers: '❌ Vous ne pouvez pas retirer le statut AFK de quelqu\'un d\'autre !',
        
        // Embed
        afkStatus: '💤 STATUT AFK',
        reason: 'Raison',
        since: 'Depuis',
        autoReturn: 'Retour Auto',
        none: 'Aucun',
        permanent: 'Permanent',
        
        // Slash
        slashDescription: 'Définir votre statut AFK',
        reasonOption: 'Raison de l\'absence',
        timeOption: 'Temps de retour auto (ex: 30m, 2h)',
        ephemeralReply: 'Visible uniquement par vous',
        publicReply: 'Visible par tous'
    }
};

// ================= HELPER FUNCTIONS =================
function parseTime(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d+)([mh])$/i);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    if (unit === 'm') return value * 60 * 1000; // minutes to ms
    if (unit === 'h') return value * 60 * 60 * 1000; // hours to ms
    return null;
}

function formatTime(ms, lang) {
    const t = translations[lang];
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        const remainingMins = minutes % 60;
        if (remainingMins > 0) {
            return `${hours} ${t.hours} ${remainingMins} ${t.minutes}`;
        }
        return `${hours} ${t.hours}`;
    }
    return `${minutes} ${t.minutes}`;
}

function formatTimeAgo(timestamp, lang) {
    const t = translations[lang];
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    if (hours > 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    if (minutes > 0) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    return t.justNow;
}

// ================= MAIN EXPORT =================
module.exports = {
    name: 'afk',
    aliases: ['away', 'absent', 'brb'],
    description: '📌 Set your AFK status with auto-return and reminders',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.afk [reason] [time]',
    examples: ['.afk Eating', '.afk Sleeping 30m', '.afk In meeting 2h', '.afk'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('📌 Set your AFK status / Définir votre statut AFK')
        .addStringOption(opt => opt
            .setName('reason')
            .setDescription('Reason for being AFK / Raison de l\'absence')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('time')
            .setDescription('Auto-return time (e.g., 30m, 2h) / Temps de retour auto (ex: 30m, 2h)')
            .setRequired(false))
        .addBooleanOption(opt => opt
            .setName('ephemeral')
            .setDescription('Only visible to you / Visible uniquement par vous')
            .setRequired(false)),

    // ================= COMMANDE PRINCIPALE =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        
        // Parse time if present
        let timeMs = null;
        let timeDisplay = null;
        let reason = args.join(' ');
        
        const timeMatch = reason.match(/\s+(\d+[mh])\s*$/i);
        if (timeMatch) {
            const timeStr = timeMatch[1];
            timeMs = parseTime(timeStr);
            if (timeMs) {
                timeDisplay = formatTime(timeMs, lang);
                reason = reason.replace(timeMatch[0], '').trim();
            }
        }
        
        reason = reason || (lang === 'fr' ? 'Indisponible' : 'AFK');
        
        // Toggle off if already AFK
        if (afkUsers.has(message.author.id)) {
            const afkData = afkUsers.get(message.author.id);
            if (afkData.timer) clearTimeout(afkData.timer);
            afkUsers.delete(message.author.id);
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: t.afkStatus, iconURL: message.author.displayAvatarURL() })
                .setDescription(t.afkRemoved(message.author.username))
                .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        // Store AFK
        const afkData = {
            reason,
            timestamp: Date.now(),
            username: message.author.username,
            avatar: message.author.displayAvatarURL(),
            timer: null
        };
        
        // Set auto-return timer
        if (timeMs) {
            afkData.timer = setTimeout(() => {
                if (afkUsers.has(message.author.id)) {
                    afkUsers.delete(message.author.id);
                    
                    const autoEmbed = new EmbedBuilder()
                        .setColor('#3498db')
                        .setAuthor({ name: t.afkStatus, iconURL: message.author.displayAvatarURL() })
                        .setDescription(t.afkAutoRemoved(message.author.username))
                        .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                        .setTimestamp();
                    
                    message.channel.send({ embeds: [autoEmbed] }).catch(() => {});
                    console.log(`[AFK] ${message.author.tag} auto-returned after ${timeDisplay}`);
                }
            }, timeMs);
        }
        
        afkUsers.set(message.author.id, afkData);
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: t.afkStatus, iconURL: message.author.displayAvatarURL() })
            .setDescription(timeDisplay 
                ? t.afkSetWithTime(message.author.username, reason, timeDisplay)
                : t.afkSet(message.author.username, reason))
            .addFields(
                { name: `📝 ${t.reason}`, value: reason, inline: true },
                { name: `⏰ ${t.autoReturn}`, value: timeDisplay || t.permanent, inline: true }
            )
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
            .setTimestamp();
        
        // Create buttons for others to interact
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`afk_remind_${message.author.id}`)
                .setLabel(t.remindButton)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔔'),
            new ButtonBuilder()
                .setCustomId(`afk_extend_${message.author.id}`)
                .setLabel(t.extendButton)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏰')
        );
        
        const reply = await message.reply({ embeds: [embed], components: [buttonRow] });
        
        // Button collector
        const collector = reply.createMessageComponentCollector({ time: 300000 });
        
        collector.on('collect', async (i) => {
            const targetId = i.customId.split('_')[2];
            const currentAfk = afkUsers.get(targetId);
            
            if (!currentAfk) {
                return i.reply({ content: '❌ This user is no longer AFK.', ephemeral: true });
            }
            
            if (i.customId.startsWith('afk_remind')) {
                // Store reminder for when they return
                if (!currentAfk.reminders) currentAfk.reminders = [];
                currentAfk.reminders.push({
                    from: i.user.id,
                    fromName: i.user.username,
                    timestamp: Date.now()
                });
                afkUsers.set(targetId, currentAfk);
                
                await i.reply({ content: t.remindSent, ephemeral: true });
            }
            
            if (i.customId.startsWith('afk_extend')) {
                if (i.user.id !== targetId) {
                    return i.reply({ content: t.cannotClearOthers, ephemeral: true });
                }
                
                // Extend by 30 minutes
                const extendMs = 30 * 60 * 1000;
                if (currentAfk.timer) clearTimeout(currentAfk.timer);
                
                currentAfk.timer = setTimeout(() => {
                    if (afkUsers.has(targetId)) {
                        afkUsers.delete(targetId);
                        i.channel.send({ content: t.afkAutoRemoved(currentAfk.username) }).catch(() => {});
                    }
                }, extendMs);
                
                afkUsers.set(targetId, currentAfk);
                await i.reply({ content: t.afkExtended('30 ' + t.minutes), ephemeral: true });
            }
        });
        
        console.log(`[AFK] ${message.author.tag} set AFK: ${reason}${timeDisplay ? ` (auto-return: ${timeDisplay})` : ''}`);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = translations[lang];
        const version = client.version || '1.8.0';
        
        const reason = interaction.options.getString('reason') || (lang === 'fr' ? 'Indisponible' : 'AFK');
        const timeStr = interaction.options.getString('time');
        const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;
        
        let timeMs = null;
        let timeDisplay = null;
        
        if (timeStr) {
            timeMs = parseTime(timeStr);
            if (timeMs) {
                timeDisplay = formatTime(timeMs, lang);
            }
        }
        
        // Toggle off if already AFK
        if (afkUsers.has(interaction.user.id)) {
            const afkData = afkUsers.get(interaction.user.id);
            if (afkData.timer) clearTimeout(afkData.timer);
            afkUsers.delete(interaction.user.id);
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: t.afkStatus, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(t.afkRemoved(interaction.user.username))
                .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral });
        }
        
        // Store AFK
        const afkData = {
            reason,
            timestamp: Date.now(),
            username: interaction.user.username,
            avatar: interaction.user.displayAvatarURL(),
            timer: null
        };
        
        if (timeMs) {
            afkData.timer = setTimeout(async () => {
                if (afkUsers.has(interaction.user.id)) {
                    afkUsers.delete(interaction.user.id);
                    console.log(`[AFK] ${interaction.user.tag} auto-returned after ${timeDisplay}`);
                }
            }, timeMs);
        }
        
        afkUsers.set(interaction.user.id, afkData);
        
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setAuthor({ name: t.afkStatus, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(timeDisplay 
                ? t.afkSetWithTime(interaction.user.username, reason, timeDisplay)
                : t.afkSet(interaction.user.username, reason))
            .addFields(
                { name: `📝 ${t.reason}`, value: reason, inline: true },
                { name: `⏰ ${t.autoReturn}`, value: timeDisplay || t.permanent, inline: true }
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral });
        
        console.log(`[AFK] ${interaction.user.tag} set AFK: ${reason}${timeDisplay ? ` (auto-return: ${timeDisplay})` : ''}`);
    },

    // ================= 🔥 CRITIQUE : EXPORT DE LA MAP =================
    afkUsers: afkUsers
};