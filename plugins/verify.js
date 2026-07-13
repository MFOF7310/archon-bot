// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — VERIFICATION GATE v1.0
// Per-server toggle, off by default, zero spam
// ═══════════════════════════════════════════════════════
const { 
    SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionsBitField
} = require('discord.js');

const pending = new Map(); // userId:guildId => { timeout, messageId }

module.exports = {
    name: 'verify',
    description: 'Verification gate system',
    category: 'MODERATION',
    aliases: [],

    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('⚙️ Verification gate settings')
        .addSubcommand(s => s.setName('enable').setDescription('✅ Enable verification gate'))
        .addSubcommand(s => s.setName('disable').setDescription('❌ Disable verification gate'))
        .addSubcommand(s => s.setName('setrole').setDescription('🎭 Set the verified role')
            .addRoleOption(o => o.setName('role').setDescription('Role to assign after verification').setRequired(true)))
        .addSubcommand(s => s.setName('setkick').setDescription('⏰ Auto-kick unverified after X minutes (0 = never)')
            .addIntegerOption(o => o.setName('minutes').setDescription('Minutes before kick (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(60)))
        .addSubcommand(s => s.setName('status').setDescription('📊 View current verification settings'))
        .addSubcommand(s => s.setName('setunverified').setDescription('🔒 Set role given to new members before verifying')
            .addRoleOption(o => o.setName('role').setDescription('Role that blocks channel access until verified').setRequired(true))),

    execute: async (interaction, client) => {
        const db = client.db;
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
            return interaction.reply({ content: '⛔ You need Manage Server permission.', flags: 64 });

        const sub = interaction.options.getSubcommand();
        const gid = interaction.guild.id;

        // Ensure row exists
        db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(gid);

        if (sub === 'enable') {
            db.prepare(`UPDATE server_settings SET verify_enabled = 1 WHERE guild_id = ?`).run(gid);
            const settings = db.prepare('SELECT verify_role_id, verify_kick_days FROM server_settings WHERE guild_id = ?').get(gid);
            const role = settings?.verify_role_id ? `<@&${settings.verify_role_id}>` : '⚠️ Not set — use `/verify setrole`';
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00cc44)
                    .setTitle('✅ Verification Gate — ENABLED')
                    .addFields(
                        { name: '🎭 Verified Role', value: role, inline: true },
                        { name: '⏰ Auto-kick', value: settings?.verify_kick_days ? `${settings.verify_kick_days} min` : 'Disabled', inline: true }
                    )
                    .setFooter({ text: 'ARCHON CG-223 • New members will receive a DM to verify' })],
                flags: 64
            });
        }

        if (sub === 'disable') {
            db.prepare(`UPDATE server_settings SET verify_enabled = 0 WHERE guild_id = ?`).run(gid);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xff3311)
                    .setDescription('❌ Verification gate **disabled**. New members join freely.')],
                flags: 64
            });
        }

        if (sub === 'setrole') {
            const role = interaction.options.getRole('role');
            db.prepare(`UPDATE server_settings SET verify_role_id = ? WHERE guild_id = ?`).run(role.id, gid);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00aaff)
                    .setDescription(`🎭 Verified role set to ${role}`)],
                flags: 64
            });
        }

        if (sub === 'setkick') {
            const mins = interaction.options.getInteger('minutes');
            db.prepare(`UPDATE server_settings SET verify_kick_days = ? WHERE guild_id = ?`).run(mins, gid);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00aaff)
                    .setDescription(mins === 0 
                        ? '⏰ Auto-kick **disabled** — members won\'t be kicked for not verifying.'
                        : `⏰ Unverified members will be kicked after **${mins} minutes**.`)],
                flags: 64
            });
        }

        if (sub === 'setunverified') {
            const role = interaction.options.getRole('role');
            db.prepare(`UPDATE server_settings SET verify_unverified_role_id = ? WHERE guild_id = ?`).run(role.id, gid);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xff8800)
                    .setDescription(
                        `🔒 Unverified role set to ${role}\n\n` +
                        `Make sure this role has **no access** to your channels!\n` +
                        `New members will get this role on join, removed after verification.`
                    )],
                flags: 64
            });
        }

        if (sub === 'status') {
        const settings = db.prepare('SELECT verify_enabled, verify_role_id, verify_kick_days, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(s?.verify_enabled ? 0x00cc44 : 0x888888)
                    .setTitle('📊 Verification Gate Status')
                    .addFields(
                        { name: '🔘 Status', value: s?.verify_enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
                        { name: '🎭 Role', value: s?.verify_role_id ? `<@&${s.verify_role_id}>` : 'Not set', inline: true },
                        { name: '⏰ Auto-kick', value: s?.verify_kick_days ? `${s.verify_kick_days} min` : 'Disabled', inline: true }
                    )
                    .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })],
                flags: 64
            });
        }
    },

    // Called from guildMemberAdd
    onMemberJoin: async (member, client, db) => {
        const gid = member.guild.id;
        const settings = db.prepare('SELECT verify_enabled, verify_role_id, verify_kick_days, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
        if (!settings?.verify_enabled) return; // Off by default

        const verifyRole = settings.verify_role_id 
            ? member.guild.roles.cache.get(settings.verify_role_id)
            : null;

        // Build verification DM
        const embed = new EmbedBuilder()
            .setColor(0x00aaff)
            .setTitle(`👋 Welcome to ${member.guild.name}!`)
            .setDescription(
                `To get full access, please verify you're human.\n\n` +
                `Tap the button below — it only takes a second!`
            )
            .setThumbnail(member.guild.iconURL({ dynamic: true }))
            .setFooter({ text: `ARCHON CG-223 • ${member.guild.name}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`verify_${gid}_${member.id}`)
                .setLabel('✅ Verify Me')
                .setStyle(ButtonStyle.Success),
        );

        let dmMsg = null;
        try {
            const dm = await member.createDM();
            dmMsg = await dm.send({ embeds: [embed], components: [row] });
        } catch {
            // DMs closed — try to post in system channel
            const sysCh = member.guild.systemChannel;
            if (sysCh) {
                try {
                    dmMsg = await sysCh.send({ 
                        content: `${member} please verify!`,
                        embeds: [embed], 
                        components: [row] 
                    });
                } catch {}
            }
        }

        // Auto-kick timer
        const kickMins = settings.verify_kick_days || 0;
        if (kickMins > 0) {
            const timer = setTimeout(async () => {
                pending.delete(`${member.id}:${gid}`);
                // Check if still unverified
                const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
                if (!freshMember) return;
                const hasRole = verifyRole && freshMember.roles.cache.has(verifyRole.id);
                if (!hasRole) {
                    await freshMember.kick('Failed to verify in time').catch(() => {});
                    // Edit DM to show kicked
                    if (dmMsg) {
                        await dmMsg.edit({ 
                            embeds: [embed.setColor(0xff3311).setDescription('❌ You were kicked for not verifying in time.\n\nYou can rejoin and try again!')],
                            components: [] 
                        }).catch(() => {});
                    }
                }
            }, kickMins * 60000);
            pending.set(`${member.id}:${gid}`, { timer, dmMsg });
        } else {
            pending.set(`${member.id}:${gid}`, { timer: null, dmMsg });
        }
    },

    // Called from button interaction handler
    onVerifyButton: async (interaction, client, db) => {
        const parts = interaction.customId.split('_');
        const gid = parts[1];
        const uid = parts[2];

        // Only the right user can click
        if (interaction.user.id !== uid) {
            return interaction.reply({ content: '⛔ This verification is not for you!', flags: 64 });
        }

        const settings = db.prepare('SELECT verify_role_id, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
        const guild = client.guilds.cache.get(gid);
        if (!guild) return interaction.reply({ content: '❌ Server not found.', flags: 64 });

        const member = await guild.members.fetch(uid).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ Could not find you in the server.', flags: 64 });

        // Remove unverified role
        if (settings?.verify_unverified_role_id) {
            const unverRole = guild.roles.cache.get(settings.verify_unverified_role_id);
            if (unverRole) await member.roles.remove(unverRole).catch(() => {});
        }

        // Assign verified role
        if (settings?.verify_role_id) {
            const role = guild.roles.cache.get(settings.verify_role_id);
            if (role) await member.roles.add(role).catch(() => {});
        }

        // Clear kick timer
        const key = `${uid}:${gid}`;
        const p = pending.get(key);
        if (p?.timer) clearTimeout(p.timer);
        pending.delete(key);

        // Edit message — one clean response, no spam
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setColor(0x00cc44)
                .setTitle('✅ Verified!')
                .setDescription(`You're all set! Welcome to **${guild.name}** 🎉\n\nEnjoy your stay!`)
                .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })],
            components: []
        });
    }
};
