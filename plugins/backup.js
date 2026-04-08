const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, PermissionsBitField, ChannelType } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '💾 NEURAL BACKUP SYSTEM',
        creating: '📦 CREATING BACKUP',
        created: '✅ BACKUP CREATED',
        loading: '🔄 RESTORING BACKUP',
        loaded: '✅ BACKUP RESTORED',
        deleting: '🗑️ DELETING BACKUP',
        deleted: '✅ BACKUP DELETED',
        listing: '📋 BACKUP LIST',
        info: 'ℹ️ BACKUP DETAILS',
        
        backupId: 'Backup ID',
        backupName: 'Name',
        createdBy: 'Created By',
        createdAt: 'Created At',
        size: 'Size',
        roles: 'Roles',
        channels: 'Channels',
        categories: 'Categories',
        textChannels: 'Text Channels',
        voiceChannels: 'Voice Channels',
        serverName: 'Server Name',
        
        create: '📦 Create Backup',
        list: '📋 List Backups',
        load: '🔄 Restore',
        delete: '🗑️ Delete',
        info_button: 'ℹ️ Info',
        confirm: '✅ CONFIRM',
        cancel: '❌ Cancel',
        auto: '⏰ Auto Backup',
        
        creatingBackup: '🔍 Scanning server structure...',
        backupSuccess: (id, name, count) => `✅ Backup **${name || id}** created successfully!\n\n📊 **Stats:**\n• Roles: ${count.roles}\n• Categories: ${count.categories}\n• Text Channels: ${count.text}\n• Voice Channels: ${count.voice}`,
        noBackups: '📭 No backups found for this server.\n\nCreate one with `.backup create [name]`',
        backupList: '📋 Available Backups',
        confirmRestore: (name, date) => `⚠️ **WARNING: This will DELETE all current channels, roles, and settings!**\n\n**Backup:** ${name}\n**Created:** ${date}\n\nThis action is **IRREVERSIBLE**. Are you absolutely sure?`,
        confirmDelete: (name) => `⚠️ Are you sure you want to delete backup **${name}**?`,
        restoreSuccess: (name) => `✅ Server successfully restored from backup **${name}**!`,
        deleteSuccess: (id) => `✅ Backup \`${id}\` has been deleted.`,
        autoEnabled: '✅ Automatic daily backups **enabled**.',
        autoDisabled: '❌ Automatic daily backups **disabled**.',
        maxBackupsReached: (max) => `❌ Maximum of **${max}** backups reached. Delete old backups first.`,
        restoring: '🔄 Restoring server structure... This may take a minute.',
        
        ownerOnly: '❌ Only the **Server Owner** can manage backups.',
        adminOnly: '❌ You need **Administrator** permission.',
        noPermission: '❌ Insufficient permissions.',
        accessDenied: '❌ This menu is not yours.',
        
        seconds: 'seconds',
        minutes: 'minutes',
        hours: 'hours',
        days: 'days',
        autoBackup: 'Daily Auto-Backup',
        
        footer: 'NEURAL BACKUP',
        processing: 'Processing...',
        page: 'Page',
        back: '◀ Back',
        selectBackup: 'Select a backup...',
        currentStatus: 'Current status',
        use: 'Use',
        availableCommands: 'Available Commands'
    },
    fr: {
        title: '💾 SYSTÈME DE SAUVEGARDE NEURAL',
        creating: '📦 CRÉATION SAUVEGARDE',
        created: '✅ SAUVEGARDE CRÉÉE',
        loading: '🔄 RESTAURATION',
        loaded: '✅ SAUVEGARDE RESTAURÉE',
        deleting: '🗑️ SUPPRESSION',
        deleted: '✅ SAUVEGARDE SUPPRIMÉE',
        listing: '📋 LISTE DES SAUVEGARDES',
        info: 'ℹ️ DÉTAILS SAUVEGARDE',
        
        backupId: 'ID Sauvegarde',
        backupName: 'Nom',
        createdBy: 'Créé par',
        createdAt: 'Créé le',
        size: 'Taille',
        roles: 'Rôles',
        channels: 'Salons',
        categories: 'Catégories',
        textChannels: 'Salons Texte',
        voiceChannels: 'Salons Vocaux',
        serverName: 'Nom du Serveur',
        
        create: '📦 Créer',
        list: '📋 Liste',
        load: '🔄 Restaurer',
        delete: '🗑️ Supprimer',
        info_button: 'ℹ️ Infos',
        confirm: '✅ CONFIRMER',
        cancel: '❌ Annuler',
        auto: '⏰ Auto Sauvegarde',
        
        creatingBackup: '🔍 Analyse de la structure du serveur...',
        backupSuccess: (id, name, count) => `✅ Sauvegarde **${name || id}** créée avec succès!\n\n📊 **Statistiques:**\n• Rôles: ${count.roles}\n• Catégories: ${count.categories}\n• Salons Texte: ${count.text}\n• Salons Vocaux: ${count.voice}`,
        noBackups: '📭 Aucune sauvegarde trouvée pour ce serveur.\n\nCréez-en une avec `.backup create [nom]`',
        backupList: '📋 Sauvegardes Disponibles',
        confirmRestore: (name, date) => `⚠️ **ATTENTION: Cela va SUPPRIMER tous les salons, rôles et paramètres actuels!**\n\n**Sauvegarde:** ${name}\n**Créée:** ${date}\n\nCette action est **IRRÉVERSIBLE**. Êtes-vous absolument sûr?`,
        confirmDelete: (name) => `⚠️ Êtes-vous sûr de vouloir supprimer la sauvegarde **${name}**?`,
        restoreSuccess: (name) => `✅ Serveur restauré avec succès depuis la sauvegarde **${name}**!`,
        deleteSuccess: (id) => `✅ Sauvegarde \`${id}\` a été supprimée.`,
        autoEnabled: '✅ Sauvegardes automatiques quotidiennes **activées**.',
        autoDisabled: '❌ Sauvegardes automatiques quotidiennes **désactivées**.',
        maxBackupsReached: (max) => `❌ Maximum de **${max}** sauvegardes atteint. Supprimez d\'anciennes sauvegardes d\'abord.`,
        restoring: '🔄 Restauration de la structure du serveur... Cela peut prendre une minute.',
        
        ownerOnly: '❌ Seul le **Propriétaire du Serveur** peut gérer les sauvegardes.',
        adminOnly: '❌ Vous avez besoin de la permission **Administrateur**.',
        noPermission: '❌ Permissions insuffisantes.',
        accessDenied: '❌ Ce menu ne vous appartient pas.',
        
        seconds: 'secondes',
        minutes: 'minutes',
        hours: 'heures',
        days: 'jours',
        autoBackup: 'Sauvegarde Auto Quotidienne',
        
        footer: 'SAUVEGARDE NEURALE',
        processing: 'Traitement...',
        page: 'Page',
        back: '◀ Retour',
        selectBackup: 'Sélectionner une sauvegarde...',
        currentStatus: 'Statut actuel',
        use: 'Utilisez',
        availableCommands: 'Commandes disponibles'
    }
};

// ================= AUTO-BACKUP SETTINGS =================
const autoBackupSettings = new Map();

// ================= GENERATE BACKUP ID =================
function generateBackupId() {
    return `BK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ================= SCAN SERVER =================
async function scanServer(guild) {
    const data = {
        name: guild.name,
        icon: guild.iconURL(),
        roles: [],
        categories: [],
        channels: [],
        bans: []
    };
    
    const roles = guild.roles.cache
        .filter(r => r.id !== guild.id && !r.managed)
        .sort((a, b) => b.position - a.position);
    
    for (const role of roles) {
        data.roles.push({
            name: role.name,
            color: role.hexColor,
            hoist: role.hoist,
            mentionable: role.mentionable,
            permissions: role.permissions.bitfield.toString(),
            position: role.position
        });
    }
    
    const categories = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position);
    
    for (const category of categories) {
        const categoryData = {
            name: category.name,
            position: category.position,
            channels: []
        };
        
        const channels = guild.channels.cache
            .filter(c => c.parentId === category.id)
            .sort((a, b) => a.position - b.position);
        
        for (const channel of channels) {
            categoryData.channels.push({
                name: channel.name,
                type: channel.type,
                position: channel.position,
                topic: channel.topic,
                nsfw: channel.nsfw,
                bitrate: channel.bitrate,
                userLimit: channel.userLimit,
                rateLimitPerUser: channel.rateLimitPerUser,
                permissionOverwrites: channel.permissionOverwrites.cache.map(po => ({
                    id: po.id,
                    type: po.type,
                    allow: po.allow.bitfield.toString(),
                    deny: po.deny.bitfield.toString()
                }))
            });
        }
        
        data.categories.push(categoryData);
    }
    
    const uncategorized = guild.channels.cache
        .filter(c => !c.parentId && c.type !== ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position);
    
    if (uncategorized.size > 0) {
        const uncategorizedData = {
            name: null,
            position: 999,
            channels: []
        };
        
        for (const channel of uncategorized) {
            uncategorizedData.channels.push({
                name: channel.name,
                type: channel.type,
                position: channel.position,
                topic: channel.topic,
                nsfw: channel.nsfw,
                bitrate: channel.bitrate,
                userLimit: channel.userLimit,
                rateLimitPerUser: channel.rateLimitPerUser,
                permissionOverwrites: channel.permissionOverwrites.cache.map(po => ({
                    id: po.id,
                    type: po.type,
                    allow: po.allow.bitfield.toString(),
                    deny: po.deny.bitfield.toString()
                }))
            });
        }
        
        data.categories.push(uncategorizedData);
    }
    
    try {
        const bans = await guild.bans.fetch();
        for (const ban of bans.values()) {
            data.bans.push({
                userId: ban.user.id,
                reason: ban.reason
            });
        }
    } catch (err) {}
    
    return data;
}

// ================= RESTORE SERVER =================
async function restoreServer(guild, backupData, progressCallback) {
    const channels = guild.channels.cache.filter(c => c.deletable);
    for (const channel of channels.values()) {
        await channel.delete().catch(() => {});
        await sleep(500);
    }
    
    const roles = guild.roles.cache.filter(r => r.id !== guild.id && !r.managed && r.editable);
    for (const role of roles.values()) {
        await role.delete().catch(() => {});
        await sleep(300);
    }
    
    if (progressCallback) progressCallback('channels_deleted');
    
    const roleMap = new Map();
    const sortedRoles = [...backupData.roles].sort((a, b) => b.position - a.position);
    
    for (const roleData of sortedRoles) {
        try {
            const role = await guild.roles.create({
                name: roleData.name,
                color: roleData.color,
                hoist: roleData.hoist,
                mentionable: roleData.mentionable,
                permissions: BigInt(roleData.permissions),
                position: roleData.position
            });
            roleMap.set(roleData.name, role);
            await sleep(300);
        } catch (err) {}
    }
    
    if (progressCallback) progressCallback('roles_created');
    
    const sortedCategories = [...backupData.categories].sort((a, b) => a.position - b.position);
    
    for (const catData of sortedCategories) {
        let category = null;
        
        if (catData.name) {
            try {
                category = await guild.channels.create({
                    name: catData.name,
                    type: ChannelType.GuildCategory,
                    position: catData.position
                });
                await sleep(300);
            } catch (err) {}
        }
        
        for (const chanData of catData.channels) {
            try {
                const channel = await guild.channels.create({
                    name: chanData.name,
                    type: chanData.type,
                    topic: chanData.topic,
                    nsfw: chanData.nsfw,
                    bitrate: chanData.bitrate,
                    userLimit: chanData.userLimit,
                    rateLimitPerUser: chanData.rateLimitPerUser,
                    parent: category,
                    position: chanData.position
                });
                
                for (const po of chanData.permissionOverwrites) {
                    try {
                        if (po.type === 0) {
                            const role = roleMap.get(po.id) || guild.roles.cache.get(po.id);
                            if (role) {
                                await channel.permissionOverwrites.create(role, {
                                    Allow: BigInt(po.allow),
                                    Deny: BigInt(po.deny)
                                });
                            }
                        } else {
                            const member = await guild.members.fetch(po.id).catch(() => null);
                            if (member) {
                                await channel.permissionOverwrites.create(member, {
                                    Allow: BigInt(po.allow),
                                    Deny: BigInt(po.deny)
                                });
                            }
                        }
                    } catch (err) {}
                }
                
                await sleep(300);
            } catch (err) {}
        }
    }
    
    if (progressCallback) progressCallback('channels_created');
    
    return true;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ================= CREATE BACKUP EMBED =================
function createBackupEmbed(backups, page, totalPages, lang, guild, client) {
    const t = translations[lang];
    const version = client.version || '1.5.0';
    
    const pageSize = 5;
    const start = page * pageSize;
    const pageBackups = backups.slice(start, start + pageSize);
    
    let description = '';
    
    if (pageBackups.length === 0) {
        description = t.noBackups;
    } else {
        for (const backup of pageBackups) {
            const date = new Date(backup.created_at * 1000);
            description += `**📦 ${backup.name || backup.id}**\n`;
            description += `└─ 🆔 \`${backup.id}\`\n`;
            description += `└─ 👤 <@${backup.created_by}>\n`;
            description += `└─ 📅 <t:${backup.created_at}:R>\n`;
            description += `└─ 📊 ${backup.roles || 0}r • ${backup.channels || 0}c\n\n`;
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setAuthor({ 
            name: `${t.title} • ${guild.name}`, 
            iconURL: guild.iconURL() || client.user.displayAvatarURL() 
        })
        .setTitle(t.listing)
        .setDescription(description)
        .setFooter({ 
            text: `${guild.name.toUpperCase()} • ${t.footer} • ${t.page} ${page + 1}/${Math.max(1, totalPages)} • v${version}`,
            iconURL: guild.iconURL() || client.user.displayAvatarURL()
        })
        .setTimestamp();
    
    return embed;
}

// ================= CREATE BACKUP INFO EMBED =================
function createBackupInfoEmbed(backup, lang, guild, client) {
    const t = translations[lang];
    const version = client.version || '1.5.0';
    
    const data = JSON.parse(backup.data);
    const date = new Date(backup.created_at * 1000);
    
    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setAuthor({ 
            name: `${t.title} • ${t.info}`, 
            iconURL: guild.iconURL() || client.user.displayAvatarURL() 
        })
        .setTitle(`📦 ${backup.name || backup.id}`)
        .addFields(
            { name: `🆔 ${t.backupId}`, value: `\`${backup.id}\``, inline: true },
            { name: `👤 ${t.createdBy}`, value: `<@${backup.created_by}>`, inline: true },
            { name: `📅 ${t.createdAt}`, value: `<t:${backup.created_at}:F>`, inline: true },
            { name: `🏷️ ${t.serverName}`, value: data.name || 'Unknown', inline: true },
            { name: `🎭 ${t.roles}`, value: `\`${data.roles?.length || 0}\``, inline: true },
            { name: `📁 ${t.categories}`, value: `\`${data.categories?.length || 0}\``, inline: true },
            { name: `💬 ${t.textChannels}`, value: `\`${data.categories?.reduce((sum, c) => sum + c.channels.filter(ch => ch.type === 0).length, 0) || 0}\``, inline: true },
            { name: `🔊 ${t.voiceChannels}`, value: `\`${data.categories?.reduce((sum, c) => sum + c.channels.filter(ch => ch.type === 2).length, 0) || 0}\``, inline: true }
        )
        .setFooter({ 
            text: `${guild.name.toUpperCase()} • ${t.footer} • v${version}`,
            iconURL: guild.iconURL() || client.user.displayAvatarURL()
        })
        .setTimestamp();
    
    return embed;
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'backup',
    aliases: ['backups', 'save', 'restore', 'sauvegarde', 'sauvegardes', 'restaurer'],
    description: '💾 Create and restore server backups (Owner Only).',
    category: 'SYSTEM',
    cooldown: 10000,
    usage: '.backup [create/list/load/delete/info/auto]',
    examples: [
        '.backup create MyBackup',
        '.backup list',
        '.backup load BK-123',
        '.backup delete BK-123',
        '.backup info BK-123',
        '.backup auto on',
        '.sauvegarde create MaSauvegarde'
    ],

    run: async (client, message, args, database, serverSettings) => {
        
        // ================= LANGUAGE SETUP =================
        const lang = serverSettings?.language || 'en';
        const t = translations[lang];
        const prefix = serverSettings?.prefix || '.';
        const version = client.version || '1.5.0';
        const guildName = message.guild.name.toUpperCase();
        const guildIcon = message.guild.iconURL() || client.user.displayAvatarURL();
        
        const db = database;
        const guildId = message.guild.id;
        
        // ================= PERMISSION CHECK =================
        if (message.author.id !== message.guild.ownerId && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ content: t.ownerOnly, ephemeral: true });
        }
        
        // ================= ENSURE TABLE EXISTS =================
        try {
            db.prepare(`
                CREATE TABLE IF NOT EXISTS server_backups (
                    id TEXT PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    name TEXT,
                    data TEXT NOT NULL,
                    created_by TEXT NOT NULL,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    roles INTEGER,
                    channels INTEGER
                )
            `).run();
            
            db.prepare(`
                CREATE TABLE IF NOT EXISTS auto_backup_settings (
                    guild_id TEXT PRIMARY KEY,
                    enabled BOOLEAN DEFAULT 0,
                    last_backup INTEGER,
                    channel_id TEXT
                )
            `).run();
            
        } catch (err) {
            console.error('[BACKUP] Table creation error:', err);
            return message.reply({ content: '❌ Database error.', ephemeral: true });
        }
        
        const subCommand = args[0]?.toLowerCase();
        
        // ================= CREATE BACKUP =================
        if (!subCommand || subCommand === 'create' || subCommand === 'créer') {
            const maxBackups = 10;
            const existingCount = db.prepare(`SELECT COUNT(*) as count FROM server_backups WHERE guild_id = ?`).get(guildId).count;
            
            if (existingCount >= maxBackups) {
                return message.reply({ content: t.maxBackupsReached(maxBackups), ephemeral: true });
            }
            
            const processingMsg = await message.reply({ content: `🔄 ${t.creatingBackup}` });
            
            try {
                const serverData = await scanServer(message.guild);
                const backupId = generateBackupId();
                const backupName = args.slice(1).join(' ') || `Backup-${new Date().toISOString().split('T')[0]}`;
                
                const rolesCount = serverData.roles.length;
                const channelsCount = serverData.categories.reduce((sum, c) => sum + c.channels.length, 0);
                
                db.prepare(`
                    INSERT INTO server_backups (id, guild_id, name, data, created_by, roles, channels)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(backupId, guildId, backupName, JSON.stringify(serverData), message.author.id, rolesCount, channelsCount);
                
                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setAuthor({ name: t.created, iconURL: message.guild.iconURL() })
                    .setTitle(`📦 ${backupName}`)
                    .setDescription(t.backupSuccess(backupId, backupName, {
                        roles: rolesCount,
                        categories: serverData.categories.length,
                        text: serverData.categories.reduce((sum, c) => sum + c.channels.filter(ch => ch.type === 0).length, 0),
                        voice: serverData.categories.reduce((sum, c) => sum + c.channels.filter(ch => ch.type === 2).length, 0)
                    }))
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
                    .setTimestamp();
                
                await processingMsg.edit({ content: null, embeds: [embed] });
                
            } catch (err) {
                console.error('[BACKUP] Create error:', err);
                await processingMsg.edit({ content: `❌ ${lang === 'fr' ? 'Erreur lors de la création.' : 'Error creating backup.'}` });
            }
            
            return;
        }
        
        // ================= LIST BACKUPS =================
        if (subCommand === 'list' || subCommand === 'liste') {
            const backups = db.prepare(`
                SELECT * FROM server_backups WHERE guild_id = ? ORDER BY created_at DESC
            `).all(guildId);
            
            if (backups.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#95a5a6')
                    .setAuthor({ name: t.title, iconURL: message.guild.iconURL() })
                    .setDescription(t.noBackups)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                
                return message.reply({ embeds: [embed] });
            }
            
            const pageSize = 5;
            const totalPages = Math.ceil(backups.length / pageSize);
            let currentPage = 0;
            
            const embed = createBackupEmbed(backups, currentPage, totalPages, lang, message.guild, client);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('backup_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('backup_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
            );
            
            const selectRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('backup_select')
                    .setPlaceholder(t.selectBackup)
                    .addOptions(backups.slice(0, 25).map(b => ({
                        label: (b.name || b.id).substring(0, 100),
                        value: b.id,
                        description: `${new Date(b.created_at * 1000).toLocaleDateString()}`.substring(0, 100)
                    })))
            );
            
            const reply = await message.reply({ 
                embeds: [embed], 
                components: totalPages > 1 ? [selectRow, row] : [selectRow] 
            });
            
            const collector = reply.createMessageComponentCollector({ 
                componentType: [ComponentType.Button, ComponentType.StringSelect], 
                time: 120000 
            });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: t.accessDenied, ephemeral: true });
                }
                
                if (i.isStringSelectMenu() && i.customId === 'backup_select') {
                    const backupId = i.values[0];
                    const backup = db.prepare(`SELECT * FROM server_backups WHERE id = ?`).get(backupId);
                    
                    if (!backup) {
                        return i.reply({ content: '❌ Backup not found.', ephemeral: true });
                    }
                    
                    const infoEmbed = createBackupInfoEmbed(backup, lang, message.guild, client);
                    
                    const actionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`load_${backupId}`).setLabel(t.load).setStyle(ButtonStyle.Danger).setEmoji('🔄'),
                        new ButtonBuilder().setCustomId(`delete_${backupId}`).setLabel(t.delete).setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
                        new ButtonBuilder().setCustomId('backup_back').setLabel(t.back).setStyle(ButtonStyle.Primary)
                    );
                    
                    await i.update({ embeds: [infoEmbed], components: [actionRow] });
                }
                
                if (i.isButton()) {
                    if (i.customId === 'backup_prev') currentPage--;
                    if (i.customId === 'backup_next') currentPage++;
                    
                    if (i.customId === 'backup_prev' || i.customId === 'backup_next') {
                        const newEmbed = createBackupEmbed(backups, currentPage, totalPages, lang, message.guild, client);
                        const newRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('backup_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                            new ButtonBuilder().setCustomId('backup_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
                        );
                        
                        await i.update({ embeds: [newEmbed], components: [selectRow, newRow] });
                    }
                    
                    if (i.customId === 'backup_back') {
                        const backEmbed = createBackupEmbed(backups, currentPage, totalPages, lang, message.guild, client);
                        await i.update({ embeds: [backEmbed], components: totalPages > 1 ? [selectRow, row] : [selectRow] });
                    }
                    
                    if (i.customId.startsWith('load_')) {
                        const backupId = i.customId.replace('load_', '');
                        const backup = db.prepare(`SELECT * FROM server_backups WHERE id = ?`).get(backupId);
                        
                        if (!backup) {
                            return i.reply({ content: '❌ Backup not found.', ephemeral: true });
                        }
                        
                        const confirmRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`confirm_load_${backupId}`).setLabel(t.confirm).setStyle(ButtonStyle.Danger).setEmoji('✅'),
                            new ButtonBuilder().setCustomId('backup_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Secondary).setEmoji('❌')
                        );
                        
                        const confirmEmbed = new EmbedBuilder()
                            .setColor('#e74c3c')
                            .setTitle('⚠️ CONFIRM RESTORE')
                            .setDescription(t.confirmRestore(backup.name || backup.id, new Date(backup.created_at * 1000).toLocaleString()))
                            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                        
                        await i.update({ embeds: [confirmEmbed], components: [confirmRow] });
                    }
                    
                    if (i.customId.startsWith('confirm_load_')) {
                        const backupId = i.customId.replace('confirm_load_', '');
                        const backup = db.prepare(`SELECT * FROM server_backups WHERE id = ?`).get(backupId);
                        
                        if (!backup) {
                            return i.update({ content: '❌ Backup not found.', embeds: [], components: [] });
                        }
                        
                        await i.update({ content: `🔄 ${t.restoring}`, embeds: [], components: [] });
                        
                        try {
                            const backupData = JSON.parse(backup.data);
                            await restoreServer(message.guild, backupData, null);
                            
                            const successEmbed = new EmbedBuilder()
                                .setColor('#2ecc71')
                                .setTitle(t.loaded)
                                .setDescription(t.restoreSuccess(backup.name || backup.id))
                                .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                            
                            await i.editReply({ content: null, embeds: [successEmbed], components: [] });
                            
                        } catch (err) {
                            console.error('[BACKUP] Restore error:', err);
                            await i.editReply({ content: `❌ ${lang === 'fr' ? 'Erreur lors de la restauration.' : 'Error restoring backup.'}`, embeds: [] });
                        }
                    }
                    
                    if (i.customId.startsWith('delete_')) {
                        const backupId = i.customId.replace('delete_', '');
                        const backup = db.prepare(`SELECT * FROM server_backups WHERE id = ?`).get(backupId);
                        
                        if (!backup) {
                            return i.reply({ content: '❌ Backup not found.', ephemeral: true });
                        }
                        
                        const confirmRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`confirm_delete_${backupId}`).setLabel(t.confirm).setStyle(ButtonStyle.Danger).setEmoji('✅'),
                            new ButtonBuilder().setCustomId('backup_cancel').setLabel(t.cancel).setStyle(ButtonStyle.Secondary).setEmoji('❌')
                        );
                        
                        const confirmEmbed = new EmbedBuilder()
                            .setColor('#e74c3c')
                            .setTitle('⚠️ CONFIRM DELETE')
                            .setDescription(t.confirmDelete(backup.name || backup.id))
                            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                        
                        await i.update({ embeds: [confirmEmbed], components: [confirmRow] });
                    }
                    
                    if (i.customId.startsWith('confirm_delete_')) {
                        const backupId = i.customId.replace('confirm_delete_', '');
                        
                        db.prepare(`DELETE FROM server_backups WHERE id = ?`).run(backupId);
                        
                        const successEmbed = new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setDescription(t.deleteSuccess(backupId))
                            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                        
                        await i.update({ embeds: [successEmbed], components: [] });
                    }
                    
                    if (i.customId === 'backup_cancel') {
                        const backEmbed = createBackupEmbed(backups, currentPage, totalPages, lang, message.guild, client);
                        await i.update({ embeds: [backEmbed], components: totalPages > 1 ? [selectRow, row] : [selectRow] });
                    }
                }
            });
            
            return;
        }
        
        // ================= BACKUP INFO =================
        if (subCommand === 'info' || subCommand === 'details') {
            const backupId = args[1];
            if (!backupId) {
                return message.reply({ content: lang === 'fr' ? '❌ Veuillez fournir un ID de sauvegarde.' : '❌ Please provide a backup ID.', ephemeral: true });
            }
            
            const backup = db.prepare(`SELECT * FROM server_backups WHERE id = ? AND guild_id = ?`).get(backupId, guildId);
            
            if (!backup) {
                return message.reply({ content: '❌ Backup not found.', ephemeral: true });
            }
            
            const embed = createBackupInfoEmbed(backup, lang, message.guild, client);
            
            return message.reply({ embeds: [embed] });
        }
        
        // ================= AUTO BACKUP =================
        if (subCommand === 'auto') {
            const setting = args[1]?.toLowerCase();
            
            if (!setting || (setting !== 'on' && setting !== 'off')) {
                const current = db.prepare(`SELECT enabled FROM auto_backup_settings WHERE guild_id = ?`).get(guildId);
                const status = current?.enabled ? '🟢 ON' : '🔴 OFF';
                
                const embed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(t.autoBackup)
                    .setDescription(`${t.currentStatus}: **${status}**\n\n${t.use} \`${prefix}backup auto on/off\``)
                    .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon });
                
                return message.reply({ embeds: [embed] });
            }
            
            if (setting === 'on') {
                db.prepare(`
                    INSERT OR REPLACE INTO auto_backup_settings (guild_id, enabled, channel_id)
                    VALUES (?, 1, ?)
                `).run(guildId, message.channel.id);
                
                return message.reply({ content: t.autoEnabled });
            }
            
            if (setting === 'off') {
                db.prepare(`UPDATE auto_backup_settings SET enabled = 0 WHERE guild_id = ?`).run(guildId);
                
                return message.reply({ content: t.autoDisabled });
            }
        }
        
        // ================= DEFAULT: SHOW HELP =================
        const helpEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
            .setDescription(lang === 'fr' 
                ? `**${t.availableCommands}:**\n\n` +
                  `\`${prefix}backup create [nom]\` - Créer une sauvegarde\n` +
                  `\`${prefix}backup list\` - Lister les sauvegardes\n` +
                  `\`${prefix}backup info <id>\` - Détails d'une sauvegarde\n` +
                  `\`${prefix}backup load <id>\` - Restaurer une sauvegarde\n` +
                  `\`${prefix}backup delete <id>\` - Supprimer une sauvegarde\n` +
                  `\`${prefix}backup auto on/off\` - Sauvegarde automatique`
                : `**${t.availableCommands}:**\n\n` +
                  `\`${prefix}backup create [name]\` - Create a backup\n` +
                  `\`${prefix}backup list\` - List all backups\n` +
                  `\`${prefix}backup info <id>\` - View backup details\n` +
                  `\`${prefix}backup load <id>\` - Restore a backup\n` +
                  `\`${prefix}backup delete <id>\` - Delete a backup\n` +
                  `\`${prefix}backup auto on/off\` - Automatic daily backup`)
            .setFooter({ text: `${guildName} • ${t.footer} • v${version}`, iconURL: guildIcon })
            .setTimestamp();
        
        return message.reply({ embeds: [helpEmbed] });
    }
};