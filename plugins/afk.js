const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, parseEmoji } = require('discord.js');
const EMOJIS = require('../config/emojis');

// ================= 🔥 STOCKAGE AFK (RAM) - DÉFINI EN HAUT =================
const afkUsers = new Map(); // userId -> { reason, timestamp, username, avatar, originalNickname }

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["afkSet", "afkSetWithTime", "afkRemoved", "afkAutoRemoved", "justNow", "minutes", "hours", "userIsAfk", "userIsAfkNoReason", "remindButton", "clearAfkButton", "extendButton", "remindSent", "afkCleared", "afkExtended", "cannotClearOwn", "cannotClearOthers", "afkStatus", "reason", "since", "autoReturn", "none", "permanent", "slashDescription", "reasonOption", "timeOption", "ephemeralReply", "publicReply"];
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`afk.${k}`, lang);
    return o;
}

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
    const t = loadT(lang);
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
    const t = loadT(lang);
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
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        const t = loadT(lang);
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
                .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
                .setDescription(`${EMOJIS.away} **${message.author.username} is back!** Welcome back 👋`)
                .setFooter({ text: `ARCHON CG-223 • v${version}` })
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
                        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
                        .setDescription(`${EMOJIS.zzz} **${message.author.username}'s AFK has expired** — they should be back soon!`)
                        .setFooter({ text: `ARCHON CG-223 • v${version}` })
                        .setTimestamp();
                    
                    message.channel.send({ embeds: [autoEmbed] }).catch(() => {});
                    console.log(`[AFK] ${message.author.tag} auto-returned after ${timeDisplay}`);
                }
            }, timeMs);
        }
        
        afkUsers.set(message.author.id, afkData);
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
            .setDescription(
                `${EMOJIS.afk} **${message.author.username} is now AFK**\n\n` +
                `**Reason:** ${reason}\n` +
                `**Returns:** ${timeDisplay || 'When they come back'}`
            )
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `ARCHON CG-223 • v${version}` })
            .setTimestamp();
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`afk_remind_${message.author.id}`)
                .setLabel(t.remindButton)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(parseEmoji(EMOJIS.sleep)),
            new ButtonBuilder()
                .setCustomId(`afk_extend_${message.author.id}`)
                .setLabel(t.extendButton)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(parseEmoji(EMOJIS.moon))
        );
        
        const reply = await message.reply({ embeds: [embed], components: [buttonRow] });
        
        // Button collector
        const collector = reply.createMessageComponentCollector({ time: 300000 });
        
        collector.on('collect', async (i) => {
            const targetId = i.customId.split('_')[2];
            const currentAfk = afkUsers.get(targetId);
            
            if (!currentAfk) {
                return i.reply({ content: '❌ This user is no longer AFK.', flags: 64 });
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
                
                await i.reply({ content: t.remindSent, flags: 64 });
            }
            
            if (i.customId.startsWith('afk_extend')) {
                if (i.user.id !== targetId) {
                    return i.reply({ content: t.cannotClearOthers, flags: 64 });
                }
                
                // Extend by 30 minutes
                const extendMs = 30 * 60 * 1000;
                if (currentAfk.timer) clearTimeout(currentAfk.timer);
                
                currentAfk.timer = setTimeout(() => {
                    if (afkUsers.has(targetId)) {
                        afkUsers.delete(targetId);
                        i.channel.send({ content: t.afkAutoRemoved.replace('{user}', currentAfk.username) }).catch(() => {});
                    }
                }, extendMs);
                
                afkUsers.set(targetId, currentAfk);
                await i.reply({ content: t.afkExtended.replace('{time}', '30 ' + t.minutes), flags: 64 });
            }
        });
        
        console.log(`[AFK] ${message.author.tag} set AFK: ${reason}${timeDisplay ? ` (auto-return: ${timeDisplay})` : ''}`);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        // Check if AFK system is enabled for this server
        const afkServerSettings = client.getServerSettings?.(interaction.guild?.id);
        if (afkServerSettings?.afk_enabled === 0 || afkServerSettings?.afkEnabled === false) {
            return interaction.reply({ content: lang === 'fr' ? '❌ Le système AFK est désactivé sur ce serveur.' : '❌ The AFK system is disabled on this server.', flags: 64 });
        }
        const t = loadT(lang);
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
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`${EMOJIS.away} **${interaction.user.username} is back!** Welcome back 👋`)
                .setFooter({ text: `ARCHON CG-223 • v${version}` })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], flags: ephemeral ? 1 << 6 : 0 });
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
            .setColor('#5865F2')
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(
                `${EMOJIS.afk} **${interaction.user.username} is now AFK**\n\n` +
                `**Reason:** ${reason}\n` +
                `**Returns:** ${timeDisplay || 'When they come back'}`
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `ARCHON CG-223 • v${version}` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: ephemeral ? 1 << 6 : 0 });
        
        console.log(`[AFK] ${interaction.user.tag} set AFK: ${reason}${timeDisplay ? ` (auto-return: ${timeDisplay})` : ''}`);
    },

    // ================= 🔥 CRITIQUE : EXPORT DE LA MAP =================
    afkUsers: afkUsers
};