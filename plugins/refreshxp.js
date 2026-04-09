const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: 'SYSTEM OVERRIDE: NEURAL WIPE',
        title: '◈ CONFIRM GLOBAL DATA PURGE ◈',
        description: '**WARNING:** You are about to initiate a total reset of all Agent XP and Levels.\n\n• All Agent XP will be set to **0**.\n• All Synchronization Levels will return to **1**.\n• A backup will be sent to your DMs automatically.',
        footer: 'Status: Awaiting Owner Authorization',
        confirm: 'CONFIRM PURGE',
        abort: 'ABORT MISSION',
        securityBreach: '⛔ **SECURITY BREACH:** Master Node access restricted to the system Owner.',
        abortSuccess: '✅ **Purge aborted.** Database integrity maintained.',
        timeout: '⚠️ **Auth handshake timed out.** Command revoked.',
        successTitle: '🚀 DATABASE PURGE SUCCESSFUL',
        successDesc: (count) => `\`\`\`yaml\nSUCCESS: ${count} Agent dossiers synchronized to zero.\nSTATUS: Backup sent to Owner DMs.\n\`\`\``,
        backupSent: '📡 **ARCHITECT BACKUP:** Here is the database state prior to the wipe.',
        backupFailed: '⚠️ Could not send backup to DMs. Proceeding with wipe...',
        securityLock: '⛔ Security lock active.',
        flushed: 'Flushed pending updates before wipe',
        cacheCleared: 'Cache cleared'
    },
    fr: {
        author: 'OUTREPASSEMENT SYSTÈME: EFFACEMENT NEURAL',
        title: '◈ CONFIRMER LA PURGE GLOBALE ◈',
        description: '**ATTENTION:** Vous êtes sur le point de réinitialiser tous les XP et Niveaux des Agents.\n\n• Tous les XP seront mis à **0**.\n• Tous les Niveaux reviendront à **1**.\n• Une sauvegarde sera envoyée dans vos MPs.',
        footer: 'Statut: En attente d\'autorisation du Propriétaire',
        confirm: 'CONFIRMER LA PURGE',
        abort: 'ANNULER LA MISSION',
        securityBreach: '⛔ **VIOLATION DE SÉCURITÉ:** Accès au Nœud Maître limité au Propriétaire.',
        abortSuccess: '✅ **Purge annulée.** Intégrité de la base de données maintenue.',
        timeout: '⚠️ **Authentification expirée.** Commande révoquée.',
        successTitle: '🚀 PURGE DE LA BASE RÉUSSIE',
        successDesc: (count) => `\`\`\`yaml\nSUCCÈS: ${count} dossiers d'Agents synchronisés à zéro.\nSTATUT: Sauvegarde envoyée aux MPs du Propriétaire.\n\`\`\``,
        backupSent: '📡 **SAUVEGARDE ARCHITECT:** État de la base de données avant effacement.',
        backupFailed: '⚠️ Impossible d\'envoyer la sauvegarde en MP. Poursuite de la purge...',
        securityLock: '⛔ Verrouillage de sécurité actif.',
        flushed: 'Écritures en attente vidées avant la purge',
        cacheCleared: 'Cache effacé'
    }
};

module.exports = {
    name: 'refreshxp',
    aliases: ['wipe', 'resetxp', 'nuclear', 'purge', 'effacer'],
    description: '⚠️ CRITICAL: Wipe all neural synchronization data (XP/Levels) from the database.',
    category: 'OWNER',
    cooldown: 30000,
    usage: '.refreshxp',
    examples: ['.refreshxp', '.wipe'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const ARCHITECT_ID = process.env.OWNER_ID;
        
        // ================= SECURITY CHECK =================
        if (message.author.id !== ARCHITECT_ID) {
            console.log(`[SECURITY] Unauthorized refreshxp attempt by ${message.author.tag} (${message.author.id})`);
            return message.reply({ 
                content: t.securityBreach, 
                ephemeral: true 
            }).catch(() => {});
        }

        // ================= CONFIRMATION UI =================
        const confirmEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setAuthor({ name: t.author, iconURL: client.user.displayAvatarURL() })
            .setTitle(t.title)
            .setDescription(t.description)
            .setFooter({ text: t.footer })
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_wipe').setLabel(t.confirm).setStyle(ButtonStyle.Danger).setEmoji('☢️'),
            new ButtonBuilder().setCustomId('cancel_wipe').setLabel(t.abort).setStyle(ButtonStyle.Secondary).setEmoji('❌')
        );

        const response = await message.reply({
            embeds: [confirmEmbed],
            components: [buttons]
        }).catch(() => {});

        if (!response) return;

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: t.securityLock, ephemeral: true }).catch(() => {});
            }

            if (i.customId === 'cancel_wipe') {
                const abortEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setDescription(t.abortSuccess)
                    .setTimestamp();
                return i.update({ content: null, embeds: [abortEmbed], components: [] }).catch(() => {});
            }

            if (i.customId === 'confirm_wipe') {
                await i.deferUpdate().catch(() => {});
                
                try {
                    // ================= FLUSH PENDING UPDATES =================
                    if (client.pendingUserUpdates && client.pendingUserUpdates.size > 0) {
                        await client.flushUserUpdates();
                        console.log(`[WIPE] ${t.flushed}: ${client.pendingUserUpdates.size} updates`);
                    }
                    
                    // ================= CREATE BACKUP =================
                    let backupSent = false;
                    try {
                        const dbPath = path.join(__dirname, '..', 'database.sqlite');
                        const dbBuffer = fs.readFileSync(dbPath);
                        const attachment = new AttachmentBuilder(dbBuffer, { 
                            name: `database_backup_${Date.now()}.sqlite` 
                        });
                        
                        await message.author.send({ 
                            content: t.backupSent,
                            files: [attachment] 
                        });
                        backupSent = true;
                        console.log(`[WIPE] Backup sent to owner`);
                    } catch (err) {
                        console.log(`[WIPE] ${t.backupFailed}`, err.message);
                    }
                    
                    // ================= WIPE EXECUTION =================
                    // Reset all users XP and Level
                    const result = db.prepare("UPDATE users SET xp = 0, level = 1").run();
                    const affectedAgents = result.changes;
                    
                    // Clear cache
                    if (client.userDataCache) {
                        client.userDataCache.clear();
                    }
                    if (client.pendingUserUpdates) {
                        client.pendingUserUpdates.clear();
                    }
                    
                    console.log(`[WIPE] Reset ${affectedAgents} agents | Cache cleared`);
                    
                    // ================= SUCCESS EMBED =================
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle(t.successTitle)
                        .setDescription(t.successDesc(affectedAgents))
                        .addFields({
                            name: '📋 OPERATION DETAILS',
                            value: `\`\`\`yaml\nBackup: ${backupSent ? '✅ Sent' : '⚠️ Failed'}\nCache: ✅ Cleared\nPending: ✅ Flushed\nTimestamp: ${new Date().toISOString()}\`\`\``,
                            inline: false
                        })
                        .setFooter({ text: `ARCHITECT CG-223 • v${version}` })
                        .setTimestamp();
                    
                    await response.edit({ content: null, embeds: [successEmbed], components: [] }).catch(() => {});
                    
                } catch (error) {
                    console.error('[WIPE] Error:', error);
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('❌ WIPE FAILED')
                        .setDescription(`\`\`\`\n${error.message}\n\`\`\``)
                        .setTimestamp();
                    await response.edit({ content: null, embeds: [errorEmbed], components: [] }).catch(() => {});
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setDescription(t.timeout)
                    .setTimestamp();
                response.edit({ content: null, embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
        
        console.log(`[WIPE] ${message.author.tag} initiated wipe confirmation | Lang: ${lang}`);
    }
};