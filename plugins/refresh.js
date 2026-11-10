const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, StringSelectMenuBuilder, SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const { icon, iconObj } = require('../lib/ui/icons');
const fs = require('fs');
const path = require('path');

const i18n = require('../lib/i18n');
const I18N_KEYS = ["title", "desc", "confirm", "abort", "security", "aborted", "timeout", "backupSent", "success", "preview"];
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`refresh.${k}`, lang);
    return o;
}

module.exports = {
    name: 'refresh',
    aliases: ['wipe', 'reset', 'nuclear'],
    description: '☢️ ARCHITECT ONLY: Selective or full database purge',
    category: 'OWNER',
    cooldown: 30000,
    usage: '.refresh',
    examples: ['.refresh', '.wipe'],

    execute: async (interaction, client) => {
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({ content: '⛔ Architect only!', flags: 64 });
        }
        const type = interaction.options.getString('type');
        const targetUser = interaction.options.getUser('target');
        const db = client.db;
        const t = loadT('en');
        await interaction.deferReply({ flags: 64 });
        const fakeMessage = { author: interaction.user, reply: async () => {}, react: () => Promise.resolve() };
        await executeWipe(interaction, type, t, client, db, fakeMessage, targetUser?.id);
    },

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const t = loadT(lang);
        const ARCHITECT_ID = process.env.OWNER_ID;

        if (message.author.id !== ARCHITECT_ID) {
            return message.reply({ content: t.security, flags: 64 }).catch(() => {});
        }

        if (args[0]?.toLowerCase() === 'gdpr' || args[0]?.toLowerCase() === 'deleteuser') {
            const rawTarget = args[1];
            if (!rawTarget) return message.reply('❌ **Usage:** `.refresh gdpr @user` or `.refresh gdpr <userID>`');
            const targetId = rawTarget.replace(/[<@!>]/g, '').trim();
            if (!/^\d{17,19}$/.test(targetId)) return message.reply('❌ Invalid user ID or mention.');

            const preview = buildGdprPreview(db, targetId);
            const c = new ContainerBuilder().setAccentColor(0xff0000);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_trash', '🗑️')} GDPR DATA DELETION`));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Target:** <@${targetId}> (\`${targetId}\`)\n\n${preview}\n\n**${em('ic_wait', '⏳')} Confirm button unlocks in 5s...**`));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# This is IRREVERSIBLE. All user data will be permanently erased.`));

            const confirmBtn = new ButtonBuilder().setCustomId('gdpr_confirm').setLabel('PERMANENTLY DELETE').setStyle(ButtonStyle.Danger).setEmoji(iconObj('ic_trash', null, '🗑️')).setDisabled(true);
            const cancelBtn = new ButtonBuilder().setCustomId('gdpr_cancel').setLabel('CANCEL').setStyle(ButtonStyle.Secondary).setEmoji(iconObj('ic_off', null, '❌'));
            c.addActionRowComponents(new ActionRowBuilder().addComponents(confirmBtn, cancelBtn));

            const reply = await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });

            setTimeout(() => {
                confirmBtn.setDisabled(false).setLabel('DELETE NOW');
                reply.edit({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }, 5000);

            const collector = reply.createMessageComponentCollector({ time: 30000, max: 1 });
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) return;
                if (i.customId === 'gdpr_cancel') {
                    const cancelC = new ContainerBuilder().setAccentColor(0x2ecc71).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${em('ic_ok', '✅')} Deletion cancelled.`));
                    return i.update({ components: [cancelC], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
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

        let healthPreview = '';
        if (client.getDatabaseHealth) {
            const h = client.getDatabaseHealth();
            healthPreview = `\n\n${em('ic_database', '💿')} **DB Size:** ${h.size} · ${em('ic_chart', '📊')} **Frag:** ${h.fragmentation} ${h.fragmentationStatus || ''} · ${em('ic_trash', '🗑️')} **Wasted:** ${h.wastedMB || 'N/A'}`;
        }

        const c = new ContainerBuilder().setAccentColor(0xe74c3c);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_warn', '⚠️')} Data Reset\n*${t.desc}*`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${em('ic_bolt', '🧠')} **XP Records:** ${xpUsers}  ·  ${em('ic_credit', '💰')} **Credits:** ${creditUsers}  ·  ${em('myprofile', '👥')} **Total Users:** ${totalUsers}${healthPreview}`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

        const select = new StringSelectMenuBuilder()
            .setCustomId('wipe_select')
            .setPlaceholder('Choose purge type...')
            .addOptions([
                { label: 'Wipe XP/Levels', value: 'xp', description: `Reset ${xpUsers} users`, emoji: iconObj('ic_bolt', null, '🧠') },
                { label: 'Wipe Credits', value: 'credits', description: `Reset ${creditUsers} users`, emoji: iconObj('ic_credit', null, '💰') },
                { label: 'Light Log Purge', value: 'light', description: 'Clean old logs + VACUUM (safe)', emoji: iconObj('ic_sync', null, '🫧') },
                { label: 'FULL PURGE', value: 'full', description: `Reset all ${totalUsers} users`, emoji: iconObj('ic_warn', null, '☢️') },
                { label: 'Wipe Lydia Memory', value: 'lydia', description: 'Clear AI conversations & memories', emoji: iconObj('ai_assistant', null, '🧹') },
                { label: 'Delete User Data (GDPR)', value: 'gdpr', description: 'Erase all data for a specific user', emoji: iconObj('ic_trash', null, '🗑️') },
            ]);

        c.addActionRowComponents(new ActionRowBuilder().addComponents(select));
        
        const abortBtn = new ButtonBuilder().setCustomId('wipe_abort').setLabel(t.abort).setStyle(ButtonStyle.Secondary).setEmoji(iconObj('ic_off', null, '❌'));
        c.addActionRowComponents(new ActionRowBuilder().addComponents(abortBtn));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ARCHON CG-223 · Data reset`));

        const reply = await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        if (!reply) return;

        const collector = reply.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return i.reply({ content: t.security, flags: 64 }).catch(() => {});
            if (i.customId === 'wipe_abort') {
                collector.stop();
                const cancelC = new ContainerBuilder().setAccentColor(0x2ecc71).addTextDisplayComponents(new TextDisplayBuilder().setContent(t.aborted));
                return i.update({ components: [cancelC], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }
            if (i.customId === 'wipe_select') {
                const type = i.values[0];
                if (type === 'gdpr') { collector.stop(); await promptGdprUser(i, t, client, db, message); return; }
                await showConfirm(i, type, t, client, db, message);
                collector.stop();
            }
        });
        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                const timeoutC = new ContainerBuilder().setAccentColor(0xf1c40f).addTextDisplayComponents(new TextDisplayBuilder().setContent(t.timeout));
                await reply.edit({ components: [timeoutC], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }
        });
    }
};

async function showConfirm(interaction, type, t, client, db, message) {
    const typeNames = { xp: 'XP/LEVELS WIPE', credits: 'CREDITS WIPE', full: 'FULL DATABASE PURGE', lydia: 'LYDIA MEMORY WIPE', light: 'LIGHT LOG PURGE + VACUUM', gdpr: 'GDPR USER DATA DELETION' };
    const typeName = typeNames[type];

    const c = new ContainerBuilder().setAccentColor(0xff0000);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_warn', '⚠️')} CONFIRM: ${typeName}\n**THIS IS IRREVERSIBLE!**\n\n*${em('ic_wait', '⏳')} Confirm button unlocks in 5 seconds...*`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    const confirmBtn = new ButtonBuilder().setCustomId(`confirm_${type}`).setLabel('CONFIRM').setStyle(ButtonStyle.Danger).setEmoji(iconObj('ic_warn', null, '☢️')).setDisabled(true);
    const cancelBtn = new ButtonBuilder().setCustomId('cancel_wipe').setLabel('CANCEL').setStyle(ButtonStyle.Secondary).setEmoji(iconObj('ic_off', null, '❌'));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(confirmBtn, cancelBtn));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# You have 30 seconds to confirm...`));

    await interaction.update({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});

    setTimeout(async () => {
        confirmBtn.setDisabled(false).setLabel('CONFIRM NOW');
        await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }, 5000);

    const collector = interaction.message.createMessageComponentCollector({ time: 30000, max: 1 });
    collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) return;
        if (i.customId === 'cancel_wipe') {
            const cancelC = new ContainerBuilder().setAccentColor(0x2ecc71).addTextDisplayComponents(new TextDisplayBuilder().setContent(t.aborted));
            return i.update({ components: [cancelC], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
        if (i.customId.startsWith('confirm_')) {
            await i.deferUpdate().catch(() => {});
            await executeWipe(i, type, t, client, db, message);
        }
    });
}

async function executeWipe(interaction, type, t, client, db, message, targetUserId = null) {
    try {
        if (type === 'gdpr') {
            if (!targetUserId) return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0xe74c3c).addTextDisplayComponents(new TextDisplayBuilder().setContent('❌ **GDPR deletion requires a target user.**\nUse `/refresh type:gdpr target:@user`'))], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
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
        if (type === 'xp') result = db.prepare('UPDATE users SET xp = 0, level = 1 WHERE xp > 0 OR level > 1').run();
        else if (type === 'credits') result = db.prepare('UPDATE users SET credits = 0 WHERE credits > 0').run();
        else if (type === 'lydia') { result = db.prepare('DELETE FROM lydia_conversations').run(); const mem = db.prepare('DELETE FROM lydia_memory').run(); result.changes += mem.changes; }
        else if (type === 'light') {
            if (client.runWeeklyDatabasePurge) { await client.runWeeklyDatabasePurge(); result = { changes: 0 }; }
            else {
                const now = Math.floor(Date.now() / 1000);
                const sevenDays = now - (7 * 24 * 60 * 60);
                const thirtyDays = now - (30 * 24 * 60 * 60);
                const l = db.prepare('DELETE FROM lydia_conversations WHERE timestamp < ?').run(sevenDays);
                const m = db.prepare('DELETE FROM moderation_logs WHERE timestamp < ?').run(thirtyDays);
                const r = db.prepare('DELETE FROM reminders WHERE status != \'pending\' AND execute_at < ?').run(sevenDays);
                db.prepare('UPDATE warnings SET active = 0 WHERE expires_at < ? AND active = 1').run(now);
                db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); db.exec('VACUUM;');
                result = { changes: l.changes + m.changes + r.changes };
            }
        } else result = db.prepare('UPDATE users SET xp = 0, level = 1, credits = 0').run();

        if (client.userDataCache) client.userDataCache.clear();

        let desc = i18n.t('refresh.success', 'en', { type: type.toUpperCase(), count: result.changes, ts: new Date().toISOString() });
        if (type === 'light' && client.getDatabaseHealth) {
            const h = client.getDatabaseHealth();
            desc = `**Light Log Purge Complete!**\n${em('ic_database', '💿')} DB Size: ${h.size} · ${em('ic_chart', '📊')} Fragmentation: ${h.fragmentation} · ${em('ic_trash', '🗑️')} Wasted: ${h.wastedMB || 'N/A'}`;
        }

        const c = new ContainerBuilder().setAccentColor(0x2ecc71);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_ok', '✅')} PURGE COMPLETE\n\n${desc}`));
        await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        console.log(`[WIPE] ${type} - ${result.changes} records affected`);
    } catch (err) {
        const c = new ContainerBuilder().setAccentColor(0xff0000).addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_off', '❌')} ERROR\n${err.message}`));
        await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
}

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

    const lines = []; let total = 0; let affected = 0;
    for (const table of tables) {
        try {
            const r = db.prepare(table.query).get(userId);
            if (r?.c > 0) { lines.push(`${table.name}: ${r.c}`); total += r.c; affected++; }
        } catch (e) {}
    }
    if (!lines.length) return `*No data found for this user.*`;
    return lines.join('\n') + `\n\n**Total:** ${total} records across ${affected} tables`;
}

async function promptGdprUser(interaction, t, client, db, message) {
    const c = new ContainerBuilder().setAccentColor(0xf39c12);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_trash', '🗑️')} GDPR DATA DELETION\nReply with the **User ID** or **@mention** of the user whose data you want to erase.\n\n*Or click Cancel to abort.*`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    const cancelBtn = new ButtonBuilder().setCustomId('gdpr_prompt_cancel').setLabel('CANCEL').setStyle(ButtonStyle.Secondary).setEmoji(iconObj('ic_off', null, '❌'));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(cancelBtn));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# You have 60 seconds to respond.`));

    await interaction.update({ components: [c], flags: MessageFlags.IsComponentsV2 });

    const msgCollector = interaction.channel.createMessageCollector({ filter: m => m.author.id === message.author.id, time: 60000, max: 1 });
    const btnCollector = interaction.message.createMessageComponentCollector({ filter: i => i.user.id === message.author.id && i.customId === 'gdpr_prompt_cancel', time: 60000, max: 1 });

    btnCollector.on('collect', async (i) => {
        msgCollector.stop();
        const cancelC = new ContainerBuilder().setAccentColor(0x2ecc71).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${em('ic_ok', '✅')} Cancelled.`));
        await i.update({ components: [cancelC], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    });

    msgCollector.on('collect', async (m) => {
        btnCollector.stop();
        await m.delete().catch(() => {});
        const targetId = m.content.replace(/[<@!>]/g, '').trim();
        if (!/^\d{17,19}$/.test(targetId)) {
            const errC = new ContainerBuilder().setAccentColor(0xe74c3c).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${em('ic_off', '❌')} Invalid user ID or mention.`));
            return interaction.editReply({ components: [errC], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        const preview = buildGdprPreview(db, targetId);
        const confirmC = new ContainerBuilder().setAccentColor(0xff0000);
        confirmC.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_trash', '🗑️')} CONFIRM DATA DELETION\n**Target:** <@${targetId}> (\`${targetId}\`)\n\n${preview}\n\n**${em('ic_wait', '⏳')} Confirm button unlocks in 5s...**`));
        confirmC.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        
        const confirmBtn = new ButtonBuilder().setCustomId('gdpr_confirm').setLabel('PERMANENTLY DELETE').setStyle(ButtonStyle.Danger).setEmoji(iconObj('ic_trash', null, '🗑️')).setDisabled(true);
        const cancelBtn2 = new ButtonBuilder().setCustomId('gdpr_cancel').setLabel('CANCEL').setStyle(ButtonStyle.Secondary).setEmoji(iconObj('ic_off', null, '❌'));
        confirmC.addActionRowComponents(new ActionRowBuilder().addComponents(confirmBtn, cancelBtn2));
        confirmC.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# This is IRREVERSIBLE. All user data will be permanently erased.`));

        await interaction.editReply({ components: [confirmC], flags: MessageFlags.IsComponentsV2 });

        setTimeout(() => {
            confirmBtn.setDisabled(false).setLabel('DELETE NOW');
            interaction.editReply({ components: [confirmC], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }, 5000);

        const confirmCollector = interaction.message.createMessageComponentCollector({ time: 30000, max: 1 });
        confirmCollector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return;
            if (i.customId === 'gdpr_cancel') {
                const cancelC = new ContainerBuilder().setAccentColor(0x2ecc71).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${em('ic_ok', '✅')} Deletion cancelled.`));
                return i.update({ components: [cancelC], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
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
            const timeoutC = new ContainerBuilder().setAccentColor(0xf1c40f).addTextDisplayComponents(new TextDisplayBuilder().setContent(`⏰ Timed out.`));
            interaction.editReply({ components: [timeoutC], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
    });
}

async function executeGdprDelete(interaction, userId, t, client, db) {
    try {
        if (client.flushUserUpdates) await client.flushUserUpdates(0);
        const results = []; let totalDeleted = 0;
        const deletions = [
            { table: 'users', query: 'DELETE FROM users WHERE id = ?' }, { table: 'user_inventory', query: 'DELETE FROM user_inventory WHERE user_id = ?' },
            { table: 'lydia_memory', query: 'DELETE FROM lydia_memory WHERE user_id = ?' }, { table: 'lydia_conversations', query: 'DELETE FROM lydia_conversations WHERE user_id = ?' },
            { table: 'lydia_introductions', query: 'DELETE FROM lydia_introductions WHERE user_id = ?' }, { table: 'reminders', query: 'DELETE FROM reminders WHERE user_id = ?' },
            { table: 'warnings', query: 'DELETE FROM warnings WHERE user_id = ?' }, { table: 'moderation_logs', query: 'DELETE FROM moderation_logs WHERE user_id = ?' },
            { table: 'investments', query: 'DELETE FROM investments WHERE user_id = ?' }, { table: 'birthdays', query: 'DELETE FROM birthdays WHERE user_id = ?' },
            { table: 'transfers_sender', query: 'DELETE FROM transfers WHERE sender_id = ?' }, { table: 'transfers_receiver', query: 'DELETE FROM transfers WHERE receiver_id = ?' },
            { table: 'bot_roles', query: 'DELETE FROM bot_roles WHERE user_id = ?' }, { table: 'user_links', query: 'DELETE FROM user_links WHERE discord_id = ?' },
            { table: 'server_backups', query: 'DELETE FROM server_backups WHERE created_by = ?' },
        ];

        for (const del of deletions) {
            try { const r = db.prepare(del.query).run(userId); if (r.changes > 0) { results.push(`${em('ic_ok', '✅')} ${del.table}: ${r.changes}`); totalDeleted += r.changes; } } catch (e) {}
        }
        if (client.userDataCache) {
            const keys = Array.from(client.userDataCache.keys()).filter(k => k.endsWith(`_${userId}`));
            for (const k of keys) client.userDataCache.delete(k);
        }
        try { db.exec('VACUUM;'); } catch (e) {}

        const desc = totalDeleted > 0
            ? `**GDPR Deletion Complete**\n${em('ic_user', '👤')} Target: ${userId}\n${em('ic_trash', '🗑️')} Records Erased: ${totalDeleted}\n${em('ic_chart', '📊')} Tables Affected: ${results.length}\n\n${results.join('\n')}`
            : `${em('ic_warn', '⚠️')} **No data found** for user \`${userId}\`.\nNothing was deleted.`;

        const c = new ContainerBuilder().setAccentColor(totalDeleted > 0 ? 0x2ecc71 : 0xf39c12);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('ic_ok', totalDeleted > 0 ? '✅' : '⚠️')} ${totalDeleted > 0 ? 'DATA PERMANENTLY ERASED' : 'NO DATA FOUND'}\n\n${desc}`));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ARCHON CG-223 • GDPR Compliance`));

        await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        console.log(`[GDPR] Deleted ${totalDeleted} records for user ${userId}`);
    } catch (err) {
        console.error('[GDPR] Deletion error:', err);
        const c = new ContainerBuilder().setAccentColor(0xff0000).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${em('ic_off', '❌')} Error during deletion: ${err.message}`));
        await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
}
