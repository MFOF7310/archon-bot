// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — VERIFICATION GATE v1.0
// Per-server toggle, off by default, zero spam
// ═══════════════════════════════════════════════════════
const { 
    SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionsBitField, AttachmentBuilder
} = require('discord.js');
const { generateCaptcha, randomCode } = require('./captcha.js');
const EMOJIS = require('../config/emojis');

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
            const { isPremium } = require('./premium.js');
            if (!isPremium(db, gid)) {
                return interaction.reply({ embeds: [new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle(`${EMOJIS.premium} Premium Feature`)
                    .setDescription('Image captcha verification is a **Premium** feature — it keeps your server safe with zero false kicks.\n\nUnlock it for just **$1.99/month** and protect your community.')
                    .addFields({ name: '🔑 How to activate', value: 'Run `/premium status` to upgrade — takes 30 seconds.' })
                    .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
                ], flags: 64 });
            }
            db.prepare(`UPDATE server_settings SET verify_enabled = 1 WHERE guild_id = ?`).run(gid);
            const settings = db.prepare('SELECT verify_role_id, verify_kick_days FROM server_settings WHERE guild_id = ?').get(gid);
            const role = settings?.verify_role_id ? `<@&${settings.verify_role_id}>` : '⚠️ Not set — use `/verify setrole`';
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00cc44)
                    .setTitle(`${EMOJIS.verified} Verification Gate — Active`)
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
                    .setDescription(`${EMOJIS.warning} Verification gate **disabled** — new members join freely. Run \`/verify enable\` anytime to bring it back.`)],
                flags: 64
            });
        }

        if (sub === 'setrole') {
            const role = interaction.options.getRole('role');
            db.prepare(`UPDATE server_settings SET verify_role_id = ? WHERE guild_id = ?`).run(role.id, gid);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00aaff)
                    .setDescription(`${EMOJIS.check} Verified role set to ${role}\n\nMembers will receive this role automatically after passing the captcha.`)],
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
                        ? `${EMOJIS.check} Auto-kick disabled — unverified members stay until they verify or leave on their own.`
                        : `${EMOJIS.warning} Got it — unverified members will be removed after **${mins} minutes**. Make sure your captcha DM reaches them in time.`)],
                flags: 64
            });
        }

        if (sub === 'setunverified') {
            const role = interaction.options.getRole('role');
            db.prepare(`UPDATE server_settings SET verify_unverified_role_id = ? WHERE guild_id = ?`).run(role.id, gid);

            await interaction.deferReply({ flags: 64 });

            // Auto-configure channel permissions — deny ViewChannel for unverified role on all channels
            const guild = interaction.guild;
            let locked = 0, skipped = 0, failed = 0;

            for (const [, channel] of guild.channels.cache) {
                // Skip categories and thread channels
                if (channel.isThread?.() || channel.type === 4) continue;
                try {
                    await channel.permissionOverwrites.edit(role, {
                        ViewChannel: false,
                        SendMessages: false
                    });
                    locked++;
                } catch {
                    failed++;
                }
            }

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00cc44)
                    .setTitle(`${EMOJIS.shield} Verification Gate Configured`)
                    .setDescription(
                        `Unverified role set to ${role}\n\n` +
                        `**${locked}** channels locked — unverified members can\'t see them.\n` +
                        (failed > 0 ? `**${failed}** channels couldn\'t be updated — check my role is above the unverified role.\n\n` : '\n') +
                        `New members get this role on join, removed the moment they verify. ✨`
                    )
                    .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })]
            });
        }

        if (sub === 'status') {
        const settings = db.prepare('SELECT verify_enabled, verify_role_id, verify_kick_days, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(settings?.verify_enabled ? 0x00cc44 : 0x888888)
                    .setTitle(`${EMOJIS.shield} Verification Gate — Status`)
                    .addFields(
                        { name: '🔘 Status', value: settings?.verify_enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
                        { name: '🎭 Role', value: settings?.verify_role_id ? `<@&${settings.verify_role_id}>` : 'Not set', inline: true },
                        { name: '⏰ Auto-kick', value: settings?.verify_kick_days ? `${settings.verify_kick_days} min` : 'Disabled', inline: true }
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


        const unverifiedRole = settings.verify_unverified_role_id
            ? member.guild.roles.cache.get(settings.verify_unverified_role_id)
            : null;

        // Auto-assign unverified role immediately
        if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => {});
        // Generate captcha
        const code = randomCode(6);
        const imgBuf = generateCaptcha(code);
        const attachment = new AttachmentBuilder(imgBuf, { name: 'verify.png' });

        // Store code in pending
        const captchaEmbed = new EmbedBuilder()
            .setColor(0x00aaff)
            .setTitle(`👋 Hey, welcome to ${member.guild.name}!`)
            .setDescription(
                `Great to have you here! To unlock the server, **type the code shown in the image below** in this DM.\n\n` +
                `${EMOJIS.warning} Case insensitive • **3 attempts** • Expires in **10 minutes**\n\n` +
                `*Having trouble? Rejoin the server to get a fresh code.*`
            )
            .setImage('attachment://verify.png')
            .setThumbnail(member.guild.iconURL({ dynamic: true }))
            .setFooter({ text: `ARCHON CG-223 • ${member.guild.name} • Type the code to verify` })
            .setTimestamp();

        let dmMsg = null;
        let dmChannel = null;
        try {
            dmChannel = await member.createDM();
            dmMsg = await dmChannel.send({ embeds: [captchaEmbed], files: [attachment] });
        } catch {
            // DMs closed — try system channel
            const sysCh = member.guild.systemChannel;
            if (sysCh) {
                try {
                    dmMsg = await sysCh.send({
                        content: `${member} please verify!`,
                        embeds: [captchaEmbed],
                        files: [attachment]
                    });
                    dmChannel = sysCh;
                } catch {}
            }
        }

        // Store captcha code
        const key = `${member.id}:${gid}`;
        let attempts = 0;
        const maxAttempts = 3;
        const expireMs = 10 * 60 * 1000; // 10 min
        const codeRef = { current: code }; // mutable ref so retries work

        // Listen for reply in DM
        if (dmChannel) {
            const filter = m => m.author.id === member.id && !m.author.bot;
            const collector = dmChannel.createMessageCollector({ filter, time: expireMs });

            collector.on('collect', async m => {
                const guess = m.content.trim().toUpperCase();
                if (guess === codeRef.current) {
                    // ✅ Correct!
                    collector.stop('verified');
                    pending.delete(key);

                    // Remove unverified role
                    if (unverifiedRole) await member.roles.remove(unverifiedRole).catch(() => {});
                    // Add verified role
                    if (verifyRole) await member.roles.add(verifyRole).catch(() => {});

                    await dmChannel.send({ embeds: [new EmbedBuilder()
                        .setColor(0x00cc44)
                        .setTitle(`${EMOJIS.verified} You're in!`)
                        .setDescription(`Welcome to **${member.guild.name}** 🎉 You're all verified and ready to go.\n\nHave fun and enjoy the community!`)
                        .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
                    ]}).catch(() => {});
                } else {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        collector.stop('failed');
                        await dmChannel.send({ embeds: [new EmbedBuilder()
                            .setColor(0xff3311)
                            .setTitle(`${EMOJIS.warning} Too many attempts`)
                            .setDescription(`No worries — you've been removed from **${member.guild.name}** for now.\n\nFeel free to rejoin and try again with a fresh code. 👋`)
                            .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
                        ]}).catch(() => {});
                        await member.kick('Failed captcha verification').catch(() => {});
                    } else {
                        // Wrong — send new captcha
                        const newCode = randomCode(6);
                        const newBuf = generateCaptcha(newCode);
                        const newAttach = new AttachmentBuilder(newBuf, { name: 'verify.png' });
                        // Update codeRef so collector validates new code
                        codeRef.current = newCode;

                        await dmChannel.send({ embeds: [new EmbedBuilder()
                            .setColor(0xff8800)
                            .setTitle(`${EMOJIS.warning} Not quite — attempt ${attempts}/${maxAttempts}`)
                            .setDescription(`That code didn't match — here's a fresh one to try.\n\n**${maxAttempts - attempts} attempt(s) remaining** • You've got this 💪`)
                            .setImage('attachment://verify.png')
                            .setFooter({ text: 'ARCHON CG-223 • Type the code shown above' })
                        ], files: [newAttach]}).catch(() => {});

                        // Update code reference
                        if (pending.has(key)) pending.get(key).code = newCode;
                    }
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    pending.delete(key);
                    await dmChannel.send({ embeds: [new EmbedBuilder()
                        .setColor(0x888888)
                        .setDescription(`${EMOJIS.warning} Your verification window expired — no worries, just rejoin the server and we'll send a fresh code right away.`)
                        .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
                    ]}).catch(() => {});
                    // Kick if auto-kick enabled
                    const kickMins = settings.verify_kick_days || 0;
                    if (kickMins > 0) await member.kick('Verification timed out').catch(() => {});
                }
            });
        }

        // Auto-kick timer
        const kickMins = settings.verify_kick_days || 0;
        const timer = kickMins > 0 ? setTimeout(async () => {
            pending.delete(key);
            const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
            if (!freshMember) return;
            const hasRole = verifyRole && freshMember.roles.cache.has(verifyRole.id);
            if (!hasRole) await freshMember.kick('Failed to verify in time').catch(() => {});
        }, kickMins * 60000) : null;

        pending.set(key, { timer, dmMsg, code });
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
