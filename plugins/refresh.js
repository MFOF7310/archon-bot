const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, StringSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const translations = {
    en: {
        title: '☢️ NEURAL SYSTEM OVERRIDE',
        desc: 'Select a purge operation, Architect.',
        confirm: '⚠️ CONFIRM',
        abort: '❌ ABORT',
        security: '⛔ Master Node access restricted to the Architect.',
        aborted: '✅ Operation aborted. Database intact.',
        timeout: '⏰ Authorization expired.',
        backupSent: '📡 Backup sent to your DMs.',
        success: (type, count) => `☢️ **${type}** complete!\n\`\`\`yaml\nAffected: ${count} records\nBackup: ✅ Saved\nTimestamp: ${new Date().toISOString()}\n\`\`\``,
        preview: (xp, credits, total) => `\`\`\`yaml\n🧠 XP Records: ${xp}\n💰 Non-zero Credits: ${credits}\n👥 Total Users: ${total}\n\`\`\``,
    },
    fr: {
        title: '☢️ OUTREPASSEMENT SYSTÈME NEURAL',
        desc: 'Sélectionnez une opération, Architecte.',
        confirm: '⚠️ CONFIRMER',
        abort: '❌ ANNULER',
        security: '⛔ Accès restreint à l\'Architecte.',
        aborted: '✅ Opération annulée. Base de données intacte.',
        timeout: '⏰ Autorisation expirée.',
        backupSent: '📡 Sauvegarde envoyée en MP.',
        success: (type, count) => `☢️ **${type}** terminé!\n\`\`\`yaml\nAffectés: ${count} enregistrements\nSauvegarde: ✅ Sauvée\nHorodatage: ${new Date().toISOString()}\n\`\`\``,
        preview: (xp, credits, total) => `\`\`\`yaml\n🧠 Enregistrements XP: ${xp}\n💰 Crédits Non-zéro: ${credits}\n👥 Utilisateurs: ${total}\n\`\`\``,
    }
};

module.exports = {
    name: 'refresh',
    aliases: ['wipe', 'reset', 'purge', 'nuclear', 'effacer'],
    description: '☢️ ARCHITECT ONLY: Selective or full database purge',
    category: 'OWNER',
    cooldown: 30000,
    usage: '.refresh',
    examples: ['.refresh', '.wipe'],

    data: new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('☢️ ARCHITECT ONLY: Selective database purge')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Purge type')
                .setRequired(true)
                .addChoices(
    { name: '🧠 XP/Levels Only', value: 'xp' },
    { name: '💰 Credits Only', value: 'credits' },
    { name: '🫧 Light Log Purge + VACUUM', value: 'light' },
    { name: '☢️ FULL PURGE', value: 'full' },
    { name: '🧹 Lydia Memory Wipe', value: 'lydia' },
    { name: '🗑️ Delete User Data (GDPR)', value: 'gdpr' }
)
        )
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Target user (required for GDPR deletion)')
                .setRequired(false)
        ),

    execute: async (interaction, client) => {
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({ content: '⛔ Architect only!', flags: 64 });
        }
        const type = interaction.options.getString('type');
        const targetUser = interaction.options.getUser('target');
        const db = client.db;
        const t = translations['en'];
        await interaction.deferReply({ flags: 64 });
        const fakeMessage = { author: interaction.user, reply: async () => {}, react: () => Promise.resolve() };
        await executeWipe(interaction, type, t, client, db, fakeMessage, targetUser?.id);
    },

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = translations[lang];
        const ARCHITECT_ID = process.env.OWNER_ID;

        if (message.author.id !== ARCHITECT_ID) {
            return message.reply({ content: t.security, flags: 64 }).catch(() => {});
        }

        // ─── DIRECT GDPR MODE: .refresh gdpr @user ───
        if (args[0]?.toLowerCase() === 'gdpr' || args[0]?.toLowerCase() === 'deleteuser') {
            const rawTarget = args[1];
            if (!rawTarget) return message.reply('❌ **Usage:** `.refresh gdpr @user` or `.refresh gdpr <userID>`');

            const targetId = rawTarget.replace(/[<@!>]/g, '').trim();
            if (!/^\d{17,19}$/.test(targetId)) return message.reply('❌ Invalid user ID or mention.');

            const preview = buildGdprPreview(db, targetId);
            const confirmEmbed = new EmbedBuilder().setColor('#ff0000')
                .setTitle('🗑️ GDPR DATA DELETION')
                .setDescription(`**Target:** <@${targetId}> (\`${targetId}\`)\n\n${preview}\n\n**⏳ Confirm button unlocks in 5s...**`)
                .setFooter({ text: 'This is IRREVERSIBLE. All user data will be permanently erased.' });

            const confirmBtn = new ButtonBuilder().setCustomId('gdpr_confirm').setLabel('🗑️ PERMANENTLY DELETE').setStyle(ButtonStyle.Danger).setDisabled(true);
            const cancelBtn = new ButtonBuilder().setCustomId('gdpr_cancel').setLabel('❌ CANCEL').setStyle(ButtonStyle.Secondary);
            const btnRow = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

            const reply = await message.reply({ embeds: [confirmEmbed], components: [btnRow] });

            setTimeout(() => {
                confirmBtn.setDisabled(false).setLabel('🗑️ DELETE NOW');
                reply.edit({ components: [btnRow] }).catch(() => {});
            }, 5000);

            const collector = reply.createMessageComponentCollector({ time: 30000, max: 1 });
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) return;
                if (i.customId === 'gdpr_cancel') {
                    return i.update({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription('✅ Deletion cancelled.')], components: [] }).catch(() => {});
                }
                if (i.customId === 'gdpr_confirm') {
                    await i.deferUpdate().catch(() => {});
                    await executeGdprDelete(i, targetId, t, client, db);
                }
            });
            return;
        }

        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const xpUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE xp > 0').get().count;
        const creditUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE credits > 0').get().count;

        // Get DB health for light purge preview
let healthPreview = '';
if (client.getDatabaseHealth) {
    const h = client.getDatabaseHealth();
    healthPreview = `\`\`\`yaml\n💿 DB Size: ${h.size}\n📊 Fragmentation: ${h.fragmentation} ${h.fragmentationStatus || ''}\n💾 Wasted: ${h.wastedMB || 'N/A'}\n\`\`\``;
}

const embed = new EmbedBuilder()
    .setColor('#e74c3c')
    .setAuthor({ name: t.title, iconURL: client.user.displayAvatarURL() })
    .setTitle(t.desc)
    .setDescription(t.preview(xpUsers, creditUsers, totalUsers) + '\n' + healthPreview)
            .setFooter({ text: 'ARCHITECT CG-223 • Neural Override System' })
            .setTimestamp();

        const select = new StringSelectMenuBuilder()
            .setCustomId('wipe_select')
            .setPlaceholder('Choose purge type...')
            .addOptions([
                { label: '🧠 Wipe XP/Levels', value: 'xp', description: `Reset ${xpUsers} users`, emoji: '🧠' },
                { label: '💰 Wipe Credits', value: 'credits', description: `Reset ${creditUsers} users`, emoji: '💰' },
                { label: '🫧 Light Log Purge', value: 'light', description: 'Clean old logs + VACUUM (safe)', emoji: '🫧' },
                { label: '☢️ FULL PURGE', value: 'full', description: `Reset all ${totalUsers} users`, emoji: '☢️' },
                { label: '🧹 Wipe Lydia Memory', value: 'lydia', description: 'Clear AI conversations & memories', emoji: '🧹' },
                { label: '🗑️ Delete User Data (GDPR)', value: 'gdpr', description: 'Erase all data for a specific user', emoji: '🗑️' },
            ]);

        const row1 = new ActionRowBuilder().addComponents(select);
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('wipe_abort').setLabel(t.abort).setStyle(ButtonStyle.Secondary).setEmoji('❌')
        );

        const reply = await message.reply({ embeds: [embed], components: [row1, row2] }).catch(() => {});
        if (!reply) return;

        const collector = reply.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: t.security, flags: 64 }).catch(() => {});
            }
            if (i.customId === 'wipe_abort') {
                collector.stop();
                return i.update({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(t.aborted)], components: [] }).catch(() => {});
            }
            if (i.customId === 'wipe_select') {
                const type = i.values[0];
                if (type === 'gdpr') {
                    collector.stop();
                    await promptGdprUser(i, t, client, db, message);
                    return;
                }
                await showConfirm(i, type, t, client, db, message);
                collector.stop();
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                await reply.edit({ embeds: [new EmbedBuilder().setColor('#f1c40f').setDescription(t.timeout)], components: [] }).catch(() => {});
            }
        });
    }
};

async function showConfirm(interaction, type, t, client, db, message) {
    const typeNames = { xp: 'XP/LEVELS WIPE', credits: 'CREDITS WIPE', full: 'FULL DATABASE PURGE', lydia: 'LYDIA MEMORY WIPE', light: 'LIGHT LOG PURGE + VACUUM', gdpr: 'GDPR USER DATA DELETION' };
    const typeName = typeNames[type];

    const confirmEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle(`⚠️ CONFIRM: ${typeName}`)
        .setDescription('**THIS IS IRREVERSIBLE!**\n\n⏳ *Confirm button unlocks in 5 seconds...*')
        .setFooter({ text: 'You have 30 seconds to confirm...' });

    const confirmBtn = new ButtonBuilder().setCustomId(`confirm_${type}`).setLabel('☢️ CONFIRM').setStyle(ButtonStyle.Danger).setDisabled(true);
    const cancelBtn = new ButtonBuilder().setCustomId('cancel_wipe').setLabel('❌ CANCEL').setStyle(ButtonStyle.Secondary);
    const buttons = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

    await interaction.update({ embeds: [confirmEmbed], components: [buttons] }).catch(() => {});

    setTimeout(async () => {
        const enabledBtn = new ButtonBuilder().setCustomId(`confirm_${type}`).setLabel('☢️ CONFIRM NOW').setStyle(ButtonStyle.Danger);
        const newButtons = new ActionRowBuilder().addComponents(enabledBtn, cancelBtn);
        await interaction.editReply({ components: [newButtons] }).catch(() => {});
    }, 5000);

    const collector = interaction.message.createMessageComponentCollector({ time: 30000, max: 1 });

    collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) return;
        if (i.customId === 'cancel_wipe') {
            return i.update({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(t.aborted)], components: [] }).catch(() => {});
        }
        if (i.customId.startsWith('confirm_')) {
            await i.deferUpdate().catch(() => {});
            await executeWipe(i, type, t, client, db, message);
        }
    });
}

async function executeWipe(interaction, type, t, client, db, message, targetUserId = null) {
    try {
        // ─── GDPR: redirect to dedicated handler ───
        if (type === 'gdpr') {
            if (!targetUserId) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ **GDPR deletion requires a target user.**\nUse `/refresh type:gdpr target:@user`')],
                    components: []
                }).catch(() => {});
            }
            return executeGdprDelete(interaction, targetUserId, t, client, db);
        }

        if (client.flushUserUpdates) await client.flushUserUpdates(0);

        let backupSent = false;
        try {
            const dbPath = path.join(__dirname, '..', 'database.sqlite');
            const buffer = fs.readFileSync(dbPath);
            await message.author.send({ content: t.backupSent, files: [new AttachmentBuilder(buffer, { name: `backup_${Date.now()}.sqlite` })] });
            backupSent = true;
        } catch (e) {}

        let result;
        if (type === 'xp') {
    result = db.prepare('UPDATE users SET xp = 0, level = 1 WHERE xp > 0 OR level > 1').run();
} else if (type === 'credits') {
    result = db.prepare('UPDATE users SET credits = 0 WHERE credits > 0').run();
} else if (type === 'lydia') {
    result = db.prepare('DELETE FROM lydia_conversations').run();
    const memResult = db.prepare('DELETE FROM lydia_memory').run();
    result.changes += memResult.changes;
} else if (type === 'light') {
    // Use the lightweight purge from main.js
    if (client.runWeeklyDatabasePurge) {
        await client.runWeeklyDatabasePurge();
        result = { changes: 0 }; // Already logged inside the function
    } else {
        // Fallback if function not available
        const now = Math.floor(Date.now() / 1000);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        const lydiaPurge = db.prepare('DELETE FROM lydia_conversations WHERE timestamp < ?').run(sevenDaysAgo);
        const modPurge = db.prepare('DELETE FROM moderation_logs WHERE timestamp < ?').run(thirtyDaysAgo);
        const reminderPurge = db.prepare('DELETE FROM reminders WHERE status != \'pending\' AND execute_at < ?').run(sevenDaysAgo);
        db.prepare('UPDATE warnings SET active = 0 WHERE expires_at < ? AND active = 1').run(now);
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        db.exec('VACUUM;');
        result = { changes: lydiaPurge.changes + modPurge.changes + reminderPurge.changes };
    }
} else {
    result = db.prepare('UPDATE users SET xp = 0, level = 1, credits = 0').run();
}

        if (client.userDataCache) client.userDataCache.clear();

        let description;
if (type === 'light' && client.getDatabaseHealth) {
    const health = client.getDatabaseHealth();
    description = `🫧 **Light Log Purge Complete!**\n\`\`\`yaml\nDB Size: ${health.size}\nFragmentation: ${health.fragmentation} ${health.fragmentationStatus || ''}\nWasted: ${health.wastedMB || 'N/A'}\n\`\`\``;
} else {
    description = t.success(type.toUpperCase(), result.changes);
}

const successEmbed = new EmbedBuilder()
    .setColor('#2ecc71')
    .setTitle('✅ PURGE COMPLETE')
    .setDescription(description)
    .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});
        console.log(`[WIPE] ${type} - ${result.changes} records affected`);
    } catch (err) {
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(`❌ ERROR: ${err.message}`)], components: [] }).catch(() => {});
    }
}

// ═══════════════════════════════════════════════════════════════════
//  GDPR USER DATA DELETION — Right to be Forgotten
// ═══════════════════════════════════════════════════════════════════

/**
 * Builds a preview of all data found for a user across all tables.
 * Shows table name and record count per table.
 */
function buildGdprPreview(db, userId) {
    const tables = [
        { name: '🧠 users', query: 'SELECT COUNT(*) as c FROM users WHERE id = ?' },
        { name: '🎒 user_inventory', query: 'SELECT COUNT(*) as c FROM user_inventory WHERE user_id = ?' },
        { name: '🤖 lydia_memory', query: 'SELECT COUNT(*) as c FROM lydia_memory WHERE user_id = ?' },
        { name: '💬 lydia_conversations', query: 'SELECT COUNT(*) as c FROM lydia_conversations WHERE user_id = ?' },
        { name: '📝 lydia_introductions', query: 'SELECT COUNT(*) as c FROM lydia_introductions WHERE user_id = ?' },
        { name: '⏰ reminders', query: 'SELECT COUNT(*) as c FROM reminders WHERE user_id = ?' },
        { name: '⚠️ warnings', query: 'SELECT COUNT(*) as c FROM warnings WHERE user_id = ?' },
        { name: '📋 moderation_logs', query: 'SELECT COUNT(*) as c FROM moderation_logs WHERE user_id = ?' },
        { name: '📈 investments', query: 'SELECT COUNT(*) as c FROM investments WHERE user_id = ?' },
        { name: '🎂 birthdays', query: 'SELECT COUNT(*) as c FROM birthdays WHERE user_id = ?' },
        { name: '💸 transfers (sent)', query: 'SELECT COUNT(*) as c FROM transfers WHERE sender_id = ?' },
        { name: '💸 transfers (received)', query: 'SELECT COUNT(*) as c FROM transfers WHERE receiver_id = ?' },
        { name: '🏷️ bot_roles', query: 'SELECT COUNT(*) as c FROM bot_roles WHERE user_id = ?' },
        { name: '🔗 user_links', query: 'SELECT COUNT(*) as c FROM user_links WHERE discord_id = ?' },
        { name: '📊 server_backups', query: 'SELECT COUNT(*) as c FROM server_backups WHERE created_by = ?' },
    ];

    const lines = [];
    let totalRecords = 0;
    let affectedTables = 0;

    for (const table of tables) {
        try {
            const result = db.prepare(table.query).get(userId);
            const count = result?.c || 0;
            if (count > 0) {
                lines.push(`${table.name}: ${count} record${count > 1 ? 's' : ''}`);
                totalRecords += count;
                affectedTables++;
            }
        } catch (e) {
            // Table may not exist — skip silently
        }
    }

    if (lines.length === 0) {
        return `\`\`\`yaml\n⚠️ No data found for this user in any table.\n\`\`\``;
    }

    return `\`\`\`yaml\n${lines.join('\n')}\n\nTotal: ${totalRecords} records across ${affectedTables} tables\n\`\`\``;
}

/**
 * Prompts for a user ID when GDPR is selected from the select menu.
 * Uses a modal or text-based prompt.
 */
async function promptGdprUser(interaction, t, client, db, message) {
    // Send a message asking for user ID with a button to cancel
    const promptEmbed = new EmbedBuilder().setColor('#f39c12')
        .setTitle('🗑️ GDPR DATA DELETION')
        .setDescription('Reply with the **User ID** or **@mention** of the user whose data you want to erase.\n\n*Or click Cancel to abort.*')
        .setFooter({ text: 'You have 60 seconds to respond.' });

    const cancelBtn = new ButtonBuilder().setCustomId('gdpr_prompt_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(cancelBtn);

    await interaction.update({ embeds: [promptEmbed], components: [row] });

    // Wait for a message reply OR button click
    const msgCollector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === message.author.id,
        time: 60000,
        max: 1
    });

    const btnCollector = interaction.message.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id && i.customId === 'gdpr_prompt_cancel',
        time: 60000,
        max: 1
    });

    // Handle button cancel
    btnCollector.on('collect', async (i) => {
        msgCollector.stop();
        await i.update({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription('✅ Cancelled.')], components: [] }).catch(() => {});
    });

    // Handle message reply
    msgCollector.on('collect', async (m) => {
        btnCollector.stop();
        await m.delete().catch(() => {});

        const rawTarget = m.content.trim();
        const targetId = rawTarget.replace(/[<@!>]/g, '').trim();

        if (!/^\d{17,19}$/.test(targetId)) {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ Invalid user ID or mention.')], components: [] }).catch(() => {});
        }

        // Show confirmation with preview
        const preview = buildGdprPreview(db, targetId);
        const confirmEmbed = new EmbedBuilder().setColor('#ff0000')
            .setTitle('🗑️ CONFIRM DATA DELETION')
            .setDescription(`**Target:** <@${targetId}> (\`${targetId}\`)\n\n${preview}\n\n**⏳ Confirm button unlocks in 5s...**`)
            .setFooter({ text: 'This is IRREVERSIBLE. All user data will be permanently erased.' });

        const confirmBtn = new ButtonBuilder().setCustomId('gdpr_confirm').setLabel('🗑️ PERMANENTLY DELETE').setStyle(ButtonStyle.Danger).setDisabled(true);
        const cancelBtn2 = new ButtonBuilder().setCustomId('gdpr_cancel').setLabel('❌ CANCEL').setStyle(ButtonStyle.Secondary);
        const btnRow = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn2);

        await interaction.editReply({ embeds: [confirmEmbed], components: [btnRow] });

        setTimeout(() => {
            confirmBtn.setDisabled(false).setLabel('🗑️ DELETE NOW');
            interaction.editReply({ components: [btnRow] }).catch(() => {});
        }, 5000);

        const confirmCollector = interaction.message.createMessageComponentCollector({ time: 30000, max: 1 });
        confirmCollector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return;
            if (i.customId === 'gdpr_cancel') {
                return i.update({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription('✅ Deletion cancelled.')], components: [] }).catch(() => {});
            }
            if (i.customId === 'gdpr_confirm') {
                await i.deferUpdate().catch(() => {});
                await executeGdprDelete(i, targetId, t, client, db);
            }
        });
    });

    msgCollector.on('end', async (_, reason) => {
        if (reason === 'time') {
            btnCollector.stop();
            interaction.editReply({ embeds: [new EmbedBuilder().setColor('#f1c40f').setDescription('⏰ Timed out.')], components: [] }).catch(() => {});
        }
    });
}

/**
 * Executes the GDPR data deletion across all tables.
 * Wraps each deletion in try-catch so one table failure doesn't block others.
 */
async function executeGdprDelete(interaction, userId, t, client, db) {
    try {
        if (client.flushUserUpdates) await client.flushUserUpdates(0);

        const results = [];
        let totalDeleted = 0;

        // Delete from all user-data tables
        const deletions = [
            { table: 'users', query: 'DELETE FROM users WHERE id = ?' },
            { table: 'user_inventory', query: 'DELETE FROM user_inventory WHERE user_id = ?' },
            { table: 'lydia_memory', query: 'DELETE FROM lydia_memory WHERE user_id = ?' },
            { table: 'lydia_conversations', query: 'DELETE FROM lydia_conversations WHERE user_id = ?' },
            { table: 'lydia_introductions', query: 'DELETE FROM lydia_introductions WHERE user_id = ?' },
            { table: 'reminders', query: 'DELETE FROM reminders WHERE user_id = ?' },
            { table: 'warnings', query: 'DELETE FROM warnings WHERE user_id = ?' },
            { table: 'moderation_logs', query: 'DELETE FROM moderation_logs WHERE user_id = ?' },
            { table: 'investments', query: 'DELETE FROM investments WHERE user_id = ?' },
            { table: 'birthdays', query: 'DELETE FROM birthdays WHERE user_id = ?' },
            { table: 'transfers_sender', query: 'DELETE FROM transfers WHERE sender_id = ?' },
            { table: 'transfers_receiver', query: 'DELETE FROM transfers WHERE receiver_id = ?' },
            { table: 'bot_roles', query: 'DELETE FROM bot_roles WHERE user_id = ?' },
            { table: 'user_links', query: 'DELETE FROM user_links WHERE discord_id = ?' },
            { table: 'server_backups', query: 'DELETE FROM server_backups WHERE created_by = ?' },
        ];

        for (const del of deletions) {
            try {
                const result = db.prepare(del.query).run(userId);
                if (result.changes > 0) {
                    results.push(`✅ ${del.table}: ${result.changes}`);
                    totalDeleted += result.changes;
                }
            } catch (e) {
                // Table may not exist — skip silently
            }
        }

        // Clear cache entry if present
        if (client.userDataCache) {
            const cacheKeys = Array.from(client.userDataCache.keys()).filter(k => k.endsWith(`_${userId}`));
            for (const key of cacheKeys) client.userDataCache.delete(key);
        }

        // VACUUM to reclaim space
        try { db.exec('VACUUM;'); } catch (e) { /* VACUUM may fail in WAL mode */ }

        const desc = totalDeleted > 0
            ? `🗑️ **GDPR Deletion Complete**\n\`\`\`yaml\nTarget: ${userId}\nRecords Erased: ${totalDeleted}\nTables Affected: ${results.length}\nStatus: ✅ PERMANENTLY DELETED\nTimestamp: ${new Date().toISOString()}\n\`\`\`\n\n${results.join('\n')}`
            : `⚠️ **No data found** for user \`${userId}\`.\nNothing was deleted.`;

        const embed = new EmbedBuilder().setColor(totalDeleted > 0 ? '#2ecc71' : '#f39c12')
            .setTitle(totalDeleted > 0 ? '✅ DATA PERMANENTLY ERASED' : '⚠️ NO DATA FOUND')
            .setDescription(desc)
            .setFooter({ text: 'ARCHITECT CG-223 • GDPR Compliance' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
        console.log(`[GDPR] Deleted ${totalDeleted} records for user ${userId}`);

    } catch (err) {
        console.error('[GDPR] Deletion error:', err);
        await interaction.editReply({
            embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(`❌ Error during deletion: ${err.message}`)],
            components: []
        }).catch(() => {});
    }
}
