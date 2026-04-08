const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionsBitField } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        // Warn Command
        warnTitle: '⚠️ WARNING ISSUED',
        warnedBy: 'Warned by',
        reason: 'Reason',
        warningCount: 'Warning Count',
        warningId: 'Warning ID',
        dmTitle: '⚠️ WARNING RECEIVED',
        dmDescription: (guild, reason) => `You have been warned in **${guild}**.\n\n**Reason:** ${reason}`,
        warnSuccess: (user, count) => `✅ **${user}** has been warned. They now have **${count}** warning(s).`,
        cannotWarnSelf: '❌ You cannot warn yourself.',
        cannotWarnBot: '❌ You cannot warn bots.',
        cannotWarnHigher: '❌ You cannot warn someone with a higher or equal role.',
        noReason: 'No reason provided.',
        
        // Warnings Command
        warningsTitle: (user) => `📋 WARNINGS FOR ${user.toUpperCase()}`,
        noWarnings: (user) => `✅ **${user}** has no warnings.`,
        totalWarnings: 'Total Warnings',
        activeWarnings: 'Active Warnings',
        expiredWarnings: 'Expired Warnings',
        issuedBy: 'Issued by',
        issuedAt: 'Issued at',
        expires: 'Expires',
        expired: 'EXPIRED',
        active: 'ACTIVE',
        never: 'Never',
        
        // Clear Command
        clearTitle: '🧹 CLEAR WARNINGS',
        clearSuccess: (user, count) => `✅ Cleared **${count}** warning(s) from **${user}**.`,
        clearAllSuccess: (user) => `✅ Cleared all warnings from **${user}**.`,
        confirmClear: '⚠️ Are you sure you want to clear all warnings?',
        confirm: '✅ Confirm',
        cancel: '❌ Cancel',
        
        // Remove Command
        removeSuccess: (id) => `✅ Warning \`${id}\` has been removed.`,
        removeNotFound: '❌ Warning not found.',
        
        // Modlogs Command
        modlogsTitle: (user) => `📋 MODERATION LOGS FOR ${user.toUpperCase()}`,
        noModlogs: (user) => `✅ **${user}** has no moderation history.`,
        type: 'Type',
        moderator: 'Moderator',
        date: 'Date',
        actions: {
            warn: '⚠️ Warn',
            clear: '🧹 Clear',
            remove: '🗑️ Remove',
            mute: '🔇 Mute',
            kick: '👢 Kick',
            ban: '🔨 Ban',
            unban: '🔓 Unban'
        },
        
        // General
        accessDenied: '❌ This menu is not yours.',
        noPermission: '❌ You need **Moderate Members** permission.',
        footer: 'ARCHITECT CG-223 • Neural Moderation System',
        page: 'Page',
        of: 'of',
        next: 'Next ▶',
        prev: '◀ Previous',
        delete: '🗑️ Delete'
    },
    fr: {
        // Warn Command
        warnTitle: '⚠️ AVERTISSEMENT ÉMIS',
        warnedBy: 'Averti par',
        reason: 'Raison',
        warningCount: 'Nombre d\'Avertissements',
        warningId: 'ID Avertissement',
        dmTitle: '⚠️ AVERTISSEMENT REÇU',
        dmDescription: (guild, reason) => `Vous avez reçu un avertissement sur **${guild}**.\n\n**Raison:** ${reason}`,
        warnSuccess: (user, count) => `✅ **${user}** a été averti. Il a maintenant **${count}** avertissement(s).`,
        cannotWarnSelf: '❌ Vous ne pouvez pas vous avertir vous-même.',
        cannotWarnBot: '❌ Vous ne pouvez pas avertir les bots.',
        cannotWarnHigher: '❌ Vous ne pouvez pas avertir quelqu\'un avec un rôle supérieur ou égal.',
        noReason: 'Aucune raison fournie.',
        
        // Warnings Command
        warningsTitle: (user) => `📋 AVERTISSEMENTS POUR ${user.toUpperCase()}`,
        noWarnings: (user) => `✅ **${user}** n'a aucun avertissement.`,
        totalWarnings: 'Total Avertissements',
        activeWarnings: 'Avertissements Actifs',
        expiredWarnings: 'Avertissements Expirés',
        issuedBy: 'Émis par',
        issuedAt: 'Émis le',
        expires: 'Expire',
        expired: 'EXPIRÉ',
        active: 'ACTIF',
        never: 'Jamais',
        
        // Clear Command
        clearTitle: '🧹 EFFACER AVERTISSEMENTS',
        clearSuccess: (user, count) => `✅ **${count}** avertissement(s) effacé(s) de **${user}**.`,
        clearAllSuccess: (user) => `✅ Tous les avertissements de **${user}** ont été effacés.`,
        confirmClear: '⚠️ Êtes-vous sûr de vouloir effacer tous les avertissements ?',
        confirm: '✅ Confirmer',
        cancel: '❌ Annuler',
        
        // Remove Command
        removeSuccess: (id) => `✅ Avertissement \`${id}\` a été supprimé.`,
        removeNotFound: '❌ Avertissement introuvable.',
        
        // Modlogs Command
        modlogsTitle: (user) => `📋 HISTORIQUE DE MODÉRATION POUR ${user.toUpperCase()}`,
        noModlogs: (user) => `✅ **${user}** n'a aucun historique de modération.`,
        type: 'Type',
        moderator: 'Modérateur',
        date: 'Date',
        actions: {
            warn: '⚠️ Avertir',
            clear: '🧹 Effacer',
            remove: '🗑️ Supprimer',
            mute: '🔇 Mute',
            kick: '👢 Expulser',
            ban: '🔨 Bannir',
            unban: '🔓 Débannir'
        },
        
        // General
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        noPermission: '❌ Vous avez besoin de la permission **Modérer les Membres**.',
        footer: 'ARCHITECT CG-223 • Système de Modération Neural',
        page: 'Page',
        of: 'sur',
        next: 'Suivant ▶',
        prev: '◀ Précédent',
        delete: '🗑️ Supprimer'
    }
};

// ================= GENERATE WARNING ID =================
function generateWarningId() {
    return `WARN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ================= LOG MODERATION ACTION =================
function logModAction(db, guildId, userId, moderatorId, action, reason = null, warningId = null) {
    try {
        db.prepare(`
            INSERT INTO moderation_logs (guild_id, user_id, moderator_id, action, reason, warning_id, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
        `).run(guildId, userId, moderatorId, action, reason, warningId);
        
        return true;
    } catch (err) {
        console.error('[MODLOG] Error logging action:', err);
        return false;
    }
}

// ================= GET USER WARNINGS =================
function getUserWarnings(db, guildId, userId, includeExpired = true) {
    const now = Math.floor(Date.now() / 1000);
    
    let query = `
        SELECT * FROM warnings 
        WHERE guild_id = ? AND user_id = ?
    `;
    
    if (!includeExpired) {
        query += ` AND (expires_at IS NULL OR expires_at > ?)`;
        return db.prepare(query).all(guildId, userId, now);
    }
    
    return db.prepare(query).all(guildId, userId);
}

// ================= CREATE WARNINGS EMBED =================
function createWarningsEmbed(user, warnings, page, totalPages, lang, client, guild) {
    const t = translations[lang];
    
    const pageSize = 5;
    const start = page * pageSize;
    const pageWarnings = warnings.slice(start, start + pageSize);
    
    let description = '';
    
    if (pageWarnings.length === 0) {
        description = lang === 'fr' ? '*Aucun avertissement à afficher.*' : '*No warnings to display.*';
    } else {
        for (const warn of pageWarnings) {
            const now = Math.floor(Date.now() / 1000);
            const isExpired = warn.expires_at && warn.expires_at < now;
            const status = isExpired ? `🔴 ${t.expired}` : `🟢 ${t.active}`;
            
            description += `**⚠️ ${warn.id}**\n`;
            description += `└─ ${t.reason}: ${warn.reason || t.noReason}\n`;
            description += `└─ ${t.issuedBy}: <@${warn.moderator_id}>\n`;
            description += `└─ ${t.issuedAt}: <t:${warn.created_at}:R>\n`;
            if (warn.expires_at) {
                description += `└─ ${t.expires}: <t:${warn.expires_at}:R>\n`;
            }
            description += `└─ ${status}\n\n`;
        }
    }
    
    const activeCount = warnings.filter(w => {
        const now = Math.floor(Date.now() / 1000);
        return !w.expires_at || w.expires_at > now;
    }).length;
    
    const expiredCount = warnings.length - activeCount;
    
    const embed = new EmbedBuilder()
        .setColor(activeCount > 0 ? '#e74c3c' : '#95a5a6')
        .setAuthor({ 
            name: t.warningsTitle(user.username), 
            iconURL: user.displayAvatarURL() 
        })
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setDescription(description)
        .addFields(
            { name: t.totalWarnings, value: `\`${warnings.length}\``, inline: true },
            { name: t.activeWarnings, value: `\`${activeCount}\``, inline: true },
            { name: t.expiredWarnings, value: `\`${expiredCount}\``, inline: true }
        )
        .setFooter({ 
            text: `${guild.name} • ${t.footer} • ${t.page} ${page + 1}/${Math.max(1, totalPages)} • v1.5.0`,
            iconURL: guild.iconURL() || client.user.displayAvatarURL()
        })
        .setTimestamp();
    
    return embed;
}

// ================= CREATE MODLOGS EMBED =================
function createModlogsEmbed(user, logs, page, totalPages, lang, client, guild) {
    const t = translations[lang];
    
    const pageSize = 5;
    const start = page * pageSize;
    const pageLogs = logs.slice(start, start + pageSize);
    
    let description = '';
    
    if (pageLogs.length === 0) {
        description = lang === 'fr' ? '*Aucun historique à afficher.*' : '*No history to display.*';
    } else {
        for (const log of pageLogs) {
            const actionEmoji = {
                warn: '⚠️', clear: '🧹', remove: '🗑️',
                mute: '🔇', kick: '👢', ban: '🔨', unban: '🔓'
            };
            
            const emoji = actionEmoji[log.action] || '📋';
            description += `${emoji} **${t.actions[log.action] || log.action.toUpperCase()}**\n`;
            description += `└─ ${t.moderator}: <@${log.moderator_id}>\n`;
            if (log.reason) description += `└─ ${t.reason}: ${log.reason}\n`;
            if (log.warning_id) description += `└─ ID: \`${log.warning_id}\`\n`;
            description += `└─ ${t.date}: <t:${log.timestamp}:R>\n\n`;
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setAuthor({ 
            name: t.modlogsTitle(user.username), 
            iconURL: user.displayAvatarURL() 
        })
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setDescription(description)
        .addFields(
            { name: t.totalWarnings, value: `\`${logs.length}\``, inline: true }
        )
        .setFooter({ 
            text: `${guild.name} • ${t.footer} • ${t.page} ${page + 1}/${Math.max(1, totalPages)} • v1.5.0`,
            iconURL: guild.iconURL() || client.user.displayAvatarURL()
        })
        .setTimestamp();
    
    return embed;
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'warn',
    aliases: ['w', 'warning', 'warnings', 'modlogs', 'clearwarn', 'removewarn', 'avertir', 'avertissement', 'historique'],
    description: '🛡️ Neural Moderation System - Manage warnings and view moderation history.',
    category: 'MODERATION',
    cooldown: 3000,
    userPermissions: ['ModerateMembers'],
    usage: '.warn [@user] [reason] | .warnings [@user] | .clearwarn [@user] | .modlogs [@user]',
    examples: [
        '.warn @user Spamming',
        '.warnings @user',
        '.clearwarn @user',
        '.removewarn WARN-123',
        '.modlogs @user',
        '.avertir @user Spam'
    ],

    run: async (client, message, args, database, serverSettings) => {
        
        // ================= LANGUAGE SETUP =================
        const lang = serverSettings?.language || 'en';
        const t = translations[lang];
        const prefix = serverSettings?.prefix || '.';
        
        const db = database;
        const guildId = message.guild.id;
        
        // ================= ENSURE TABLES EXIST =================
        try {
            // Warnings table
            db.prepare(`
                CREATE TABLE IF NOT EXISTS warnings (
                    id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    moderator_id TEXT NOT NULL,
                    reason TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    expires_at INTEGER,
                    active BOOLEAN DEFAULT 1
                )
            `).run();
            
            // Moderation logs table
            db.prepare(`
                CREATE TABLE IF NOT EXISTS moderation_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    moderator_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    reason TEXT,
                    warning_id TEXT,
                    timestamp INTEGER DEFAULT (strftime('%s', 'now'))
                )
            `).run();
            
            // Indexes
            db.prepare(`CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id)`).run();
            db.prepare(`CREATE INDEX IF NOT EXISTS idx_modlogs_guild_user ON moderation_logs(guild_id, user_id)`).run();
            
        } catch (err) {
            console.error('[WARN] Table creation error:', err);
            return message.reply({ content: '❌ Database error. Please try again.', ephemeral: true });
        }
        
        const subCommand = args[0]?.toLowerCase();
        
        // ================= VIEW WARNINGS =================
        if (!subCommand || subCommand === 'warnings' || subCommand === 'list' || subCommand === 'avertissements') {
            const target = message.mentions.users.first() || message.author;
            
            if (target.bot) {
                return message.reply({ content: t.cannotWarnBot, ephemeral: true });
            }
            
            const warnings = getUserWarnings(db, guildId, target.id, true);
            
            if (warnings.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setAuthor({ name: t.warningsTitle(target.username), iconURL: target.displayAvatarURL() })
                    .setDescription(t.noWarnings(target.username))
                    .setFooter({ text: `${message.guild.name} • ${t.footer}` });
                
                return message.reply({ embeds: [embed] });
            }
            
            const pageSize = 5;
            const totalPages = Math.ceil(warnings.length / pageSize);
            let currentPage = 0;
            
            const embed = createWarningsEmbed(target, warnings, currentPage, totalPages, lang, client, message.guild);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('warn_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('warn_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1),
                new ButtonBuilder().setCustomId('warn_delete').setLabel(t.delete).setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(true)
            );
            
            const reply = await message.reply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
            
            if (totalPages <= 1) return;
            
            const collector = reply.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 60000 
            });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                if (i.customId === 'warn_prev') currentPage--;
                if (i.customId === 'warn_next') currentPage++;
                
                const newEmbed = createWarningsEmbed(target, warnings, currentPage, totalPages, lang, client, message.guild);
                const newRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('warn_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('warn_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder().setCustomId('warn_delete').setLabel(t.delete).setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(true)
                );
                
                await i.update({ embeds: [newEmbed], components: [newRow] });
            });
            
            return;
        }
        
        // ================= CLEAR WARNINGS =================
        if (subCommand === 'clear' || subCommand === 'clearwarn' || subCommand === 'effacer') {
            const target = message.mentions.users.first();
            if (!target) {
                return message.reply({ content: lang === 'fr' ? '❌ Veuillez mentionner un utilisateur.' : '❌ Please mention a user.', ephemeral: true });
            }
            
            // Permission check for clearing others
            if (target.id !== message.author.id && !message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return message.reply({ content: t.noPermission, ephemeral: true });
            }
            
            const warnings = getUserWarnings(db, guildId, target.id, true);
            const activeWarnings = warnings.filter(w => {
                const now = Math.floor(Date.now() / 1000);
                return !w.expires_at || w.expires_at > now;
            });
            
            if (activeWarnings.length === 0) {
                return message.reply({ content: t.noWarnings(target.username), ephemeral: true });
            }
            
            // Confirm row
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('clear_confirm').setLabel(t.confirm).setStyle(ButtonStyle.Danger).setEmoji('✅'),
                new ButtonBuilder().setCustomId('clear_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Secondary).setEmoji('❌')
            );
            
            const confirmEmbed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setTitle(t.clearTitle)
                .setDescription(`${t.confirmClear}\n\n${target.username}: **${activeWarnings.length}** ${lang === 'fr' ? 'avertissement(s) actif(s)' : 'active warning(s)'}`)
                .setFooter({ text: t.footer });
            
            const reply = await message.reply({ embeds: [confirmEmbed], components: [confirmRow] });
            
            const collector = reply.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 30000 
            });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                if (i.customId === 'clear_confirm') {
                    // Deactivate warnings
                    const now = Math.floor(Date.now() / 1000);
                    db.prepare(`
                        UPDATE warnings SET active = 0 
                        WHERE guild_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)
                    `).run(guildId, target.id, now);
                    
                    // Log action
                    logModAction(db, guildId, target.id, message.author.id, 'clear', `Cleared ${activeWarnings.length} warnings`);
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setDescription(t.clearSuccess(target.username, activeWarnings.length))
                        .setFooter({ text: t.footer });
                    
                    await i.update({ embeds: [successEmbed], components: [] });
                } else {
                    const cancelEmbed = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setDescription(t.cancel)
                        .setFooter({ text: t.footer });
                    
                    await i.update({ embeds: [cancelEmbed], components: [] });
                }
            });
            
            return;
        }
        
        // ================= REMOVE SPECIFIC WARNING =================
        if (subCommand === 'remove' || subCommand === 'removewarn' || subCommand === 'supprimer') {
            const warningId = args[1];
            if (!warningId) {
                return message.reply({ content: lang === 'fr' ? '❌ Veuillez fournir un ID d\'avertissement.' : '❌ Please provide a warning ID.', ephemeral: true });
            }
            
            const warning = db.prepare(`SELECT * FROM warnings WHERE id = ? AND guild_id = ?`).get(warningId, guildId);
            
            if (!warning) {
                return message.reply({ content: t.removeNotFound, ephemeral: true });
            }
            
            db.prepare(`UPDATE warnings SET active = 0 WHERE id = ?`).run(warningId);
            logModAction(db, guildId, warning.user_id, message.author.id, 'remove', `Removed warning ${warningId}`, warningId);
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setDescription(t.removeSuccess(warningId))
                .setFooter({ text: t.footer });
            
            return message.reply({ embeds: [embed] });
        }
        
        // ================= VIEW MODLOGS =================
        if (subCommand === 'modlogs' || subCommand === 'history' || subCommand === 'historique') {
            const target = message.mentions.users.first() || message.author;
            
            const logs = db.prepare(`
                SELECT * FROM moderation_logs 
                WHERE guild_id = ? AND user_id = ?
                ORDER BY timestamp DESC
                LIMIT 50
            `).all(guildId, target.id);
            
            if (logs.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#95a5a6')
                    .setAuthor({ name: t.modlogsTitle(target.username), iconURL: target.displayAvatarURL() })
                    .setDescription(t.noModlogs(target.username))
                    .setFooter({ text: `${message.guild.name} • ${t.footer}` });
                
                return message.reply({ embeds: [embed] });
            }
            
            const pageSize = 5;
            const totalPages = Math.ceil(logs.length / pageSize);
            let currentPage = 0;
            
            const embed = createModlogsEmbed(target, logs, currentPage, totalPages, lang, client, message.guild);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('log_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('log_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
            );
            
            const reply = await message.reply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
            
            if (totalPages <= 1) return;
            
            const collector = reply.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 60000 
            });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                if (i.customId === 'log_prev') currentPage--;
                if (i.customId === 'log_next') currentPage++;
                
                const newEmbed = createModlogsEmbed(target, logs, currentPage, totalPages, lang, client, message.guild);
                const newRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('log_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('log_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
                );
                
                await i.update({ embeds: [newEmbed], components: [newRow] });
            });
            
            return;
        }
        
        // ================= ISSUE WARNING =================
        const target = message.mentions.users.first();
        if (!target) {
            return message.reply({ 
                content: lang === 'fr' 
                    ? '❌ Veuillez mentionner un utilisateur.\nUsage: `' + prefix + 'warn @user [raison]`'
                    : '❌ Please mention a user.\nUsage: `' + prefix + 'warn @user [reason]`', 
                ephemeral: true 
            });
        }
        
        // Validation
        if (target.id === message.author.id) {
            return message.reply({ content: t.cannotWarnSelf, ephemeral: true });
        }
        
        if (target.bot) {
            return message.reply({ content: t.cannotWarnBot, ephemeral: true });
        }
        
        const targetMember = message.guild.members.cache.get(target.id);
        if (targetMember) {
            if (message.member.roles.highest.position <= targetMember.roles.highest.position) {
                return message.reply({ content: t.cannotWarnHigher, ephemeral: true });
            }
        }
        
        const reason = args.slice(1).join(' ') || t.noReason;
        
        // Create warning
        const warningId = generateWarningId();
        const expiresAt = Math.floor(Date.now() / 1000) + (30 * 86400); // 30 days
        
        db.prepare(`
            INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, expires_at, active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(warningId, guildId, target.id, message.author.id, reason, expiresAt);
        
        // Log action
        logModAction(db, guildId, target.id, message.author.id, 'warn', reason, warningId);
        
        // Get warning count
        const warningCount = db.prepare(`
            SELECT COUNT(*) as count FROM warnings 
            WHERE guild_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
        `).get(guildId, target.id).count;
        
        // Send DM to target
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setAuthor({ name: t.dmTitle, iconURL: message.guild.iconURL() })
                .setDescription(t.dmDescription(message.guild.name, reason))
                .addFields(
                    { name: t.warningId, value: `\`${warningId}\``, inline: true },
                    { name: t.warningCount, value: `\`${warningCount}\``, inline: true }
                )
                .setFooter({ text: t.footer })
                .setTimestamp();
            
            await target.send({ embeds: [dmEmbed] });
        } catch (err) {
            // DM closed
        }
        
        // Send to log channel if configured
        if (serverSettings?.logChannel) {
            const logChannel = message.guild.channels.cache.get(serverSettings.logChannel);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setAuthor({ name: t.warnTitle, iconURL: target.displayAvatarURL() })
                    .addFields(
                        { name: '👤 User', value: `${target.tag} (<@${target.id}>)`, inline: true },
                        { name: '🛡️ Moderator', value: `${message.author.tag}`, inline: true },
                        { name: '📋 Warning ID', value: `\`${warningId}\``, inline: true },
                        { name: '📝 Reason', value: reason, inline: false },
                        { name: '📊 Total Warnings', value: `\`${warningCount}\``, inline: true }
                    )
                    .setFooter({ text: t.footer })
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            }
        }
        
        // Success embed
        const successEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setAuthor({ name: t.warnTitle, iconURL: target.displayAvatarURL() })
            .setDescription(t.warnSuccess(target.username, warningCount))
            .addFields(
                { name: t.warningId, value: `\`${warningId}\``, inline: true },
                { name: t.reason, value: reason, inline: true }
            )
            .setFooter({ text: t.footer })
            .setTimestamp();
        
        return message.reply({ embeds: [successEmbed] });
    }
};