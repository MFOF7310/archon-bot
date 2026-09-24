const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionsBitField, SlashCommandBuilder } = require('discord.js');
const EMOJIS = require('../config/emojis');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["warnTitle", "warnedBy", "reason", "warningCount", "warningId", "dmTitle", "dmDescription", "warnSuccess", "cannotWarnSelf", "cannotWarnBot", "cannotWarnHigher", "noReason", "warningsTitle", "noWarnings", "totalWarnings", "activeWarnings", "expiredWarnings", "issuedBy", "issuedAt", "expires", "expired", "active", "never", "clearTitle", "clearSuccess", "confirmClear", "confirm", "cancel", "removeSuccess", "removeNotFound", "modlogsTitle", "noModlogs", "type", "moderator", "date", "actions", "accessDenied", "noPermission", "footer", "page", "of", "delete", "logChannel", "loggedTo"];
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`warn.${k}`, lang);
    return o;
}

// ================= HELPER FUNCTIONS =================
function generateWarningId() {
    return `WARN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function logModAction(db, guildId, userId, moderatorId, action, reason = null, warningId = null) {
    try {
        db.prepare(`
            INSERT INTO moderation_logs (guild_id, user_id, moderator_id, action, reason, warning_id, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
        `).run(guildId, userId, moderatorId, action, reason, warningId);
        return true;
    } catch (err) {
        console.error('[MODLOG] Error:', err);
        return false;
    }
}

function getUserWarnings(db, guildId, userId) {
    const now = Math.floor(Date.now() / 1000);
    return db.prepare(`SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`).all(guildId, userId);
}

function createWarningsEmbed(user, warnings, page, totalPages, lang, client, guild, version) {
    const t = loadT(lang);
    const pageSize = 5;
    const start = page * pageSize;
    const pageWarnings = warnings.slice(start, start + pageSize);
    const now = Math.floor(Date.now() / 1000);
    
    const activeCount = warnings.filter(w => !w.expires_at || w.expires_at > now).length;
    const expiredCount = warnings.length - activeCount;
    
    let description = '';
    if (pageWarnings.length === 0) {
        description = lang === 'fr' ? '*Aucun avertissement.*' : '*No warnings.*';
    } else {
        for (const w of pageWarnings) {
            const isExpired = w.expires_at && w.expires_at < now;
            description += `\`\`\`yaml\n⚠️ ${w.id}\n${t.reason}: ${w.reason || t.noReason}\n${t.issuedBy}: ${w.moderator_id}\n${t.issuedAt}: ${new Date(w.created_at * 1000).toLocaleDateString()}\n${isExpired ? t.expired : t.active}\`\`\`\n`;
        }
    }
    
    return new EmbedBuilder()
        .setColor(activeCount > 0 ? '#e74c3c' : '#95a5a6')
        .setAuthor({ name: i18n.t('warn.warningsTitle', lang, { user: user.username }), iconURL: user.displayAvatarURL() })
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setDescription(description)
        .addFields(
            { name: t.totalWarnings, value: `\`${warnings.length}\``, inline: true },
            { name: t.activeWarnings, value: `\`${activeCount}\``, inline: true },
            { name: t.expiredWarnings, value: `\`${expiredCount}\``, inline: true }
        )
        .setFooter({ text: `${guild.name} • ${t.footer} • ${t.page} ${page + 1}/${totalPages} • v${version}`, iconURL: guild.iconURL() || client.user.displayAvatarURL() })
        .setTimestamp();
}

function createModlogsEmbed(user, logs, page, totalPages, lang, client, guild, version) {
    const t = loadT(lang);
    const pageSize = 5;
    const start = page * pageSize;
    const pageLogs = logs.slice(start, start + pageSize);
    
    let description = '';
    if (pageLogs.length === 0) {
        description = lang === 'fr' ? '*Aucun historique.*' : '*No history.*';
    } else {
        for (const log of pageLogs) {
            const emoji = { warn: '⚠️', clear: '🧹', remove: '🗑️', mute: '🔇', kick: '👢', ban: '🔨', unban: '🔓' }[log.action] || '📋';
            description += `\`\`\`yaml\n${emoji} ${t.actions[log.action] || log.action}\n${t.moderator}: ${log.moderator_id}\n${log.reason ? t.reason + ': ' + log.reason + '\n' : ''}${t.date}: ${new Date(log.timestamp * 1000).toLocaleDateString()}\`\`\`\n`;
        }
    }
    
    return new EmbedBuilder()
        .setColor('#3498db')
        .setAuthor({ name: i18n.t('warn.modlogsTitle', lang, { user: user.username }), iconURL: user.displayAvatarURL() })
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setDescription(description)
        .addFields({ name: t.totalWarnings, value: `\`${logs.length}\``, inline: true })
        .setFooter({ text: `${guild.name} • ${t.footer} • ${t.page} ${page + 1}/${totalPages} • v${version}`, iconURL: guild.iconURL() || client.user.displayAvatarURL() })
        .setTimestamp();
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'warn',
    aliases: ['w', 'warning', 'warnings', 'modlogs', 'clearwarn', 'removewarn', 'avertir', 'avertissement', 'historique'],
    description: '🛡️ Neural Moderation System - Manage warnings and view history.',
    category: 'MODERATION',
    cooldown: 3000,
    userPermissions: ['ModerateMembers'],
    usage: '.warn [@user] [reason] | .warnings [@user] | .clearwarn [@user] | .modlogs [@user]',

data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('🛡️ Neural Moderation System / Système de Modération Neurale')
    .addSubcommand(sub => sub
        .setName('add')
        .setDescription('Warn a user / Avertir un utilisateur')
        .addUserOption(opt => opt.setName('target').setDescription('User to warn').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(sub => sub
        .setName('list')
        .setDescription('View warnings / Voir les avertissements')
        .addUserOption(opt => opt.setName('target').setDescription('User to check').setRequired(false)))
    .addSubcommand(sub => sub
        .setName('clear')
        .setDescription('Clear all warnings / Effacer tous les avertissements')
        .addUserOption(opt => opt.setName('target').setDescription('User to clear').setRequired(true)))
    .addSubcommand(sub => sub
        .setName('remove')
        .setDescription('Remove a specific warning / Supprimer un avertissement')
        .addStringOption(opt => opt.setName('id').setDescription('Warning ID').setRequired(true)))
    .addSubcommand(sub => sub
        .setName('modlogs')
        .setDescription('View moderation history / Voir l\'historique')
        .addUserOption(opt => opt.setName('target').setDescription('User to check').setRequired(false))),

run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        
        const t = loadT(lang);
        const version = client.version || '1.6.0';
        const guildId = message.guild.id;
        const guildName = message.guild.name;
        const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
        
        // ================= ENSURE TABLES =================
        try {
            db.prepare(`CREATE TABLE IF NOT EXISTS warnings (id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, moderator_id TEXT NOT NULL, reason TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')), expires_at INTEGER, active BOOLEAN DEFAULT 1)`).run();
            db.prepare(`CREATE TABLE IF NOT EXISTS moderation_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, moderator_id TEXT NOT NULL, action TEXT NOT NULL, reason TEXT, warning_id TEXT, timestamp INTEGER DEFAULT (strftime('%s', 'now')))`).run();
            db.prepare(`CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id)`).run();
            db.prepare(`CREATE INDEX IF NOT EXISTS idx_modlogs_guild_user ON moderation_logs(guild_id, user_id)`).run();
        } catch (err) {
            console.error('[WARN] Table error:', err);
            return message.reply({ content: `${EMOJIS.error} Something went wrong — try again in a moment.`, flags: 64 }).catch(() => {});
        }
        
        const subCommand = args[0]?.toLowerCase();
        
        // ================= VIEW WARNINGS =================
        if (!subCommand || subCommand === 'warnings' || subCommand === 'list' || subCommand === 'avertissements') {
            const target = message.mentions.users.first() || message.author;
            if (target.bot) return message.reply({ content: t.cannotWarnBot, flags: 64 }).catch(() => {});
            
            const warnings = getUserWarnings(db, guildId, target.id);
            
            if (warnings.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setAuthor({ name: i18n.t('warn.warningsTitle', lang, { user: target.username }), iconURL: target.displayAvatarURL() })
                    .setDescription(i18n.t('warn.noWarnings', lang, { user: target.username }))
                    .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
                return message.reply({ embeds: [embed] }).catch(() => {});
            }
            
            const pageSize = 5;
            const totalPages = Math.ceil(warnings.length / pageSize);
            let currentPage = 0;
            
            const embed = createWarningsEmbed(target, warnings, currentPage, totalPages, lang, client, message.guild, version);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('warn_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('warn_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1)
            );
            
            const reply = await message.reply({ embeds: [embed], components: totalPages > 1 ? [row] : [] }).catch(() => {});
            if (!reply || totalPages <= 1) return;
            
            // ================= 🔥 COLLECTOR CORRIGÉ =================
            const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) return i.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
                
                // 🛡️ LA LIGNE CRITIQUE
                await i.deferUpdate().catch(() => {});
                
                if (i.customId === 'warn_prev') currentPage--;
                if (i.customId === 'warn_next') currentPage++;
                
                const newEmbed = createWarningsEmbed(target, warnings, currentPage, totalPages, lang, client, message.guild, version);
                const newRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('warn_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('warn_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
                );
                await i.editReply({ embeds: [newEmbed], components: [newRow] }).catch(() => {});
            });
            return;
        }
        
        // ================= CLEAR WARNINGS =================
        if (subCommand === 'clear' || subCommand === 'clearwarn' || subCommand === 'effacer') {
            const target = message.mentions.users.first();
            if (!target) return message.reply({ content: lang === 'fr' ? '👤 Mentionnez un utilisateur à modérer.' : '👤 Mention a user to moderate.', flags: 64 }).catch(() => {});
            
            const warnings = getUserWarnings(db, guildId, target.id);
            const now = Math.floor(Date.now() / 1000);
            const activeWarnings = warnings.filter(w => !w.expires_at || w.expires_at > now);
            
            if (activeWarnings.length === 0) {
                return message.reply({ content: i18n.t('warn.noWarnings', lang, { user: target.username }), flags: 64 }).catch(() => {});
            }
            
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('clear_confirm').setLabel(t.confirm).setStyle(ButtonStyle.Danger).setEmoji('✅'),
                new ButtonBuilder().setCustomId('clear_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Secondary).setEmoji('❌')
            );
            
            const embed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setTitle(t.clearTitle)
                .setDescription(`${t.confirmClear}\n\n**${target.username}**: \`${activeWarnings.length}\` ${lang === 'fr' ? 'avertissement(s)' : 'warning(s)'}`)
                .setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
            
            const reply = await message.reply({ embeds: [embed], components: [confirmRow] }).catch(() => {});
            if (!reply) return;
            
            const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) return i.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
                
                // 🛡️ LA LIGNE CRITIQUE
                await i.deferUpdate().catch(() => {});
                
                if (i.customId === 'clear_confirm') {
                    db.prepare(`UPDATE warnings SET active = 0 WHERE guild_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)`).run(guildId, target.id, now);
                    logModAction(db, guildId, target.id, message.author.id, 'clear', `Cleared ${activeWarnings.length} warnings`);
                    
                    const successEmbed = new EmbedBuilder().setColor('#2ecc71').setDescription(i18n.t('warn.clearSuccess', lang, { user: target.username, count: activeWarnings.length })).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
                    await i.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});
                } else {
                    const cancelEmbed = new EmbedBuilder().setColor('#ED4245').setDescription(`❌ ${lang === 'fr' ? 'Annulé' : 'Cancelled'}`).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
                    await i.editReply({ embeds: [cancelEmbed], components: [] }).catch(() => {});
                }
            });
            return;
        }
        
        // ================= REMOVE WARNING =================
        if (subCommand === 'remove' || subCommand === 'removewarn' || subCommand === 'supprimer') {
            const warningId = args[1];
            if (!warningId) return message.reply({ content: lang === 'fr' ? '🔍 Fournissez l\'ID de l\'avertissement.' : '🔍 Provide the warning ID to remove.', flags: 64 }).catch(() => {});
            
            const warning = db.prepare(`SELECT * FROM warnings WHERE id = ? AND guild_id = ?`).get(warningId, guildId);
            if (!warning) return message.reply({ content: t.removeNotFound, flags: 64 }).catch(() => {});
            
            db.prepare(`UPDATE warnings SET active = 0 WHERE id = ?`).run(warningId);
            logModAction(db, guildId, warning.user_id, message.author.id, 'remove', `Removed ${warningId}`, warningId);
            
            const embed = new EmbedBuilder().setColor('#2ecc71').setDescription(i18n.t('warn.removeSuccess', lang, { id: warningId })).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
            return message.reply({ embeds: [embed] }).catch(() => {});
        }
        
        // ================= VIEW MODLOGS =================
        if (subCommand === 'modlogs' || subCommand === 'history' || subCommand === 'historique') {
            const target = message.mentions.users.first() || message.author;
            
            const logs = db.prepare(`SELECT * FROM moderation_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 50`).all(guildId, target.id);
            
            if (logs.length === 0) {
                const embed = new EmbedBuilder().setColor('#95a5a6').setAuthor({ name: i18n.t('warn.modlogsTitle', lang, { user: target.username }), iconURL: target.displayAvatarURL() }).setDescription(i18n.t('warn.noModlogs', lang, { user: target.username })).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
                return message.reply({ embeds: [embed] }).catch(() => {});
            }
            
            const pageSize = 5;
            const totalPages = Math.ceil(logs.length / pageSize);
            let currentPage = 0;
            
            const embed = createModlogsEmbed(target, logs, currentPage, totalPages, lang, client, message.guild, version);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('log_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('log_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1)
            );
            
            const reply = await message.reply({ embeds: [embed], components: totalPages > 1 ? [row] : [] }).catch(() => {});
            if (!reply || totalPages <= 1) return;
            
            const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) return i.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
                
                // 🛡️ LA LIGNE CRITIQUE
                await i.deferUpdate().catch(() => {});
                
                if (i.customId === 'log_prev') currentPage--;
                if (i.customId === 'log_next') currentPage++;
                
                const newEmbed = createModlogsEmbed(target, logs, currentPage, totalPages, lang, client, message.guild, version);
                const newRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('log_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('log_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
                );
                await i.editReply({ embeds: [newEmbed], components: [newRow] }).catch(() => {});
            });
            return;
        }
        
        // ================= ISSUE WARNING =================
        const target = message.mentions.users.first();
        if (!target) {
            return message.reply({ 
                content: lang === 'fr' ? '❌ Mentionnez un utilisateur.\nUsage: `.warn @user [raison]`' : '❌ Mention a user.\nUsage: `.warn @user [reason]`', 
                flags: 64 
            }).catch(() => {});
        }
        
        if (target.id === message.author.id) return message.reply({ content: t.cannotWarnSelf, flags: 64 }).catch(() => {});
        if (target.bot) return message.reply({ content: t.cannotWarnBot, flags: 64 }).catch(() => {});
        
        const targetMember = message.guild.members.cache.get(target.id);
        if (targetMember && message.member.roles.highest.position <= targetMember.roles.highest.position) {
            return message.reply({ content: t.cannotWarnHigher, flags: 64 }).catch(() => {});
        }
        
        const reason = args.slice(1).join(' ') || t.noReason;
        const warningId = generateWarningId();
        const expiresAt = Math.floor(Date.now() / 1000) + (30 * 86400);
        
        db.prepare(`INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, 1)`).run(warningId, guildId, target.id, message.author.id, reason, expiresAt);
        logModAction(db, guildId, target.id, message.author.id, 'warn', reason, warningId);
        
        const warningCount = db.prepare(`SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))`).get(guildId, target.id).count;
        
        // DM
        try {
            const dmEmbed = new EmbedBuilder().setColor('#e74c3c').setAuthor({ name: t.dmTitle, iconURL: message.guild.iconURL() }).setDescription(i18n.t('warn.dmDescription', lang, { guild: message.guild.name, reason })).addFields({ name: t.warningId, value: `\`${warningId}\``, inline: true }, { name: t.warningCount, value: `\`${warningCount}\``, inline: true }).setFooter({ text: t.footer }).setTimestamp();
            await target.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch (err) {}
        
        // Log channel
        if (serverSettings?.logChannel) {
            const logChannel = message.guild.channels.cache.get(serverSettings.logChannel);
            if (logChannel) {
                const logEmbed = new EmbedBuilder().setColor('#e74c3c').setAuthor({ name: t.warnTitle, iconURL: target.displayAvatarURL() }).addFields({ name: '👤 User', value: `${target.tag} (<@${target.id}>)`, inline: true }, { name: '🛡️ Moderator', value: message.author.tag, inline: true }, { name: '📋 ID', value: `\`${warningId}\``, inline: true }, { name: '📝 Reason', value: reason, inline: false }, { name: '📊 Total', value: `\`${warningCount}\``, inline: true }).setFooter({ text: t.footer }).setTimestamp();
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }
        
        const successEmbed = new EmbedBuilder().setColor('#FEE75C').setAuthor({ name: t.warnTitle, iconURL: target.displayAvatarURL() }).setDescription(i18n.t('warn.warnSuccess', lang, { user: target.username, count: warningCount })).addFields({ name: t.warningId, value: `\`${warningId}\``, inline: true }, { name: t.reason, value: reason, inline: true }).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon }).setTimestamp();
                return message.reply({ embeds: [successEmbed] }).catch(() => {});
    },

    execute: async (interaction, client) => {
        const db = client.db;
        const subcommand = interaction.options.getSubcommand();
        const lang = interaction.locale === 'fr' ? 'fr' : 'en';
        const t = loadT(lang);
        const version = client.version || '1.6.0';
        const guildId = interaction.guild.id;
        const guildName = interaction.guild.name;
        const guildIcon = interaction.guild.iconURL() || client.user.displayAvatarURL();
        
        // Ensure tables
        try {
            db.prepare(`CREATE TABLE IF NOT EXISTS warnings (id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, moderator_id TEXT NOT NULL, reason TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now')), expires_at INTEGER, active BOOLEAN DEFAULT 1)`).run();
            db.prepare(`CREATE TABLE IF NOT EXISTS moderation_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, moderator_id TEXT NOT NULL, action TEXT NOT NULL, reason TEXT, warning_id TEXT, timestamp INTEGER DEFAULT (strftime('%s', 'now')))`).run();
        } catch (err) {
            return interaction.reply({ content: `${EMOJIS.error} Something went wrong — try again in a moment.`, flags: 64 });
        }
        
        await interaction.deferReply().catch(() => {});
        
        // ================= ADD WARNING =================
        if (subcommand === 'add') {
            const target = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason') || t.noReason;
            
            if (target.id === interaction.user.id) return interaction.editReply({ content: t.cannotWarnSelf });
            if (target.bot) return interaction.editReply({ content: t.cannotWarnBot });
            
            const targetMember = interaction.guild.members.cache.get(target.id);
            if (targetMember && interaction.member.roles.highest.position <= targetMember.roles.highest.position) {
                return interaction.editReply({ content: t.cannotWarnHigher });
            }
            
            const warningId = generateWarningId();
            const expiresAt = Math.floor(Date.now() / 1000) + (30 * 86400);
            
            db.prepare(`INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, 1)`).run(warningId, guildId, target.id, interaction.user.id, reason, expiresAt);
            logModAction(db, guildId, target.id, interaction.user.id, 'warn', reason, warningId);
            
            const warningCount = db.prepare(`SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))`).get(guildId, target.id).count;
            
            // DM
            try {
                const dmEmbed = new EmbedBuilder().setColor('#e74c3c').setAuthor({ name: t.dmTitle, iconURL: interaction.guild.iconURL() }).setDescription(i18n.t('warn.dmDescription', lang, { guild: interaction.guild.name, reason })).addFields({ name: t.warningId, value: `\`${warningId}\``, inline: true }, { name: t.warningCount, value: `\`${warningCount}\``, inline: true }).setFooter({ text: t.footer }).setTimestamp();
                await target.send({ embeds: [dmEmbed] }).catch(() => {});
            } catch (err) {}
            
            const successEmbed = new EmbedBuilder().setColor('#FEE75C').setAuthor({ name: t.warnTitle, iconURL: target.displayAvatarURL() }).setDescription(i18n.t('warn.warnSuccess', lang, { user: target.username, count: warningCount })).addFields({ name: t.warningId, value: `\`${warningId}\``, inline: true }, { name: t.reason, value: reason, inline: true }).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon }).setTimestamp();
            return interaction.editReply({ embeds: [successEmbed] });
        }
        
        // ================= LIST WARNINGS =================
        if (subcommand === 'list') {
            const target = interaction.options.getUser('target') || interaction.user;
            const warnings = getUserWarnings(db, guildId, target.id);
            
            if (warnings.length === 0) {
                const embed = new EmbedBuilder().setColor('#2ecc71').setAuthor({ name: i18n.t('warn.warningsTitle', lang, { user: target.username }), iconURL: target.displayAvatarURL() }).setDescription(i18n.t('warn.noWarnings', lang, { user: target.username })).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
                return interaction.editReply({ embeds: [embed] });
            }
            
            const embed = createWarningsEmbed(target, warnings, 0, 1, lang, client, interaction.guild, version);
            return interaction.editReply({ embeds: [embed] });
        }
        
        // ================= CLEAR WARNINGS =================
        if (subcommand === 'clear') {
            const target = interaction.options.getUser('target');
            const warnings = getUserWarnings(db, guildId, target.id);
            const now = Math.floor(Date.now() / 1000);
            const activeWarnings = warnings.filter(w => !w.expires_at || w.expires_at > now);
            
            if (activeWarnings.length === 0) {
                return interaction.editReply({ content: i18n.t('warn.noWarnings', lang, { user: target.username }) });
            }
            
            db.prepare(`UPDATE warnings SET active = 0 WHERE guild_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)`).run(guildId, target.id, now);
            logModAction(db, guildId, target.id, interaction.user.id, 'clear', `Cleared ${activeWarnings.length} warnings`);
            
            const embed = new EmbedBuilder().setColor('#2ecc71').setDescription(i18n.t('warn.clearSuccess', lang, { user: target.username, count: activeWarnings.length })).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
            return interaction.editReply({ embeds: [embed] });
        }
        
        // ================= REMOVE WARNING =================
        if (subcommand === 'remove') {
            const warningId = interaction.options.getString('id');
            
            const warning = db.prepare(`SELECT * FROM warnings WHERE id = ? AND guild_id = ?`).get(warningId, guildId);
            if (!warning) return interaction.editReply({ content: t.removeNotFound });
            
            db.prepare(`UPDATE warnings SET active = 0 WHERE id = ?`).run(warningId);
            logModAction(db, guildId, warning.user_id, interaction.user.id, 'remove', `Removed ${warningId}`, warningId);
            
            const embed = new EmbedBuilder().setColor('#2ecc71').setDescription(i18n.t('warn.removeSuccess', lang, { id: warningId })).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
            return interaction.editReply({ embeds: [embed] });
        }
        
        // ================= MODLOGS =================
        if (subcommand === 'modlogs') {
            const target = interaction.options.getUser('target') || interaction.user;
            
            const logs = db.prepare(`SELECT * FROM moderation_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 50`).all(guildId, target.id);
            
            if (logs.length === 0) {
                const embed = new EmbedBuilder().setColor('#95a5a6').setAuthor({ name: i18n.t('warn.modlogsTitle', lang, { user: target.username }), iconURL: target.displayAvatarURL() }).setDescription(i18n.t('warn.noModlogs', lang, { user: target.username })).setFooter({ text: `${guildName} • v${version}`, iconURL: guildIcon });
                return interaction.editReply({ embeds: [embed] });
            }
            
            const embed = createModlogsEmbed(target, logs, 0, 1, lang, client, interaction.guild, version);
            return interaction.editReply({ embeds: [embed] });
        }
    }
};