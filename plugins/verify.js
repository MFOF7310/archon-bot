// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — VERIFICATION GATE v1.0
// Per-server toggle, off by default, zero spam
// ═══════════════════════════════════════════════════════
const { 
    SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionsBitField, AttachmentBuilder,
    ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const { applyUnverifiedLock, lockSummary } = require('../lib/verify-guard.js');
const crypto = require('crypto');
const { generateCaptcha, randomCode } = require('./captcha.js');
const EMOJIS = require('../config/emojis');
const { validateVerifyRole, GUARD_MSG } = require('../lib/verify-guard');

const pending = new Map(); // userId:guildId => { timer, dmMsg, code, collector }
const joinHits = new Map(); // userId:guildId => [timestamps]
const JOIN_LIMIT = 3, JOIN_WINDOW = 10 * 60 * 1000;
const panelSessions = new Map(); // userId:guildId => { code, attempts, expires, nonce }
const panelCooldown = new Map(); // userId:guildId => ts
const PANEL_TTL = 5 * 60 * 1000, PANEL_COOLDOWN = 30 * 1000;

let _colsReady = false;
function ensureCols(db) {
    if (_colsReady) return;
    try { db.prepare('ALTER TABLE server_settings ADD COLUMN verify_panel_channel_id TEXT').run(); } catch {}
    _colsReady = true;
}

let _modlogCol;
function modlogCol(db) {
    if (_modlogCol !== undefined) return _modlogCol;
    const cols = db.prepare('PRAGMA table_info(server_settings)').all().map(r => r.name);
    _modlogCol = cols.find(n => /mod.?log/i.test(n) && /chan/i.test(n)) || cols.find(n => /mod.?log/i.test(n)) || null;
    console.log(`[VERIFY] mod-log column: ${_modlogCol || 'NONE — verify logs disabled'}`);
    return _modlogCol;
}

let _evReady = false;
async function logVerify(guild, db, color, title, userId, detail = '') {
    try {
        try {
            if (!_evReady) {
                db.prepare('CREATE TABLE IF NOT EXISTS verify_events (guild_id TEXT, user_id TEXT, kind TEXT, ts INTEGER)').run();
                db.prepare('CREATE INDEX IF NOT EXISTS idx_verify_events ON verify_events (guild_id, ts)').run();
                _evReady = true;
            }
            const kind = title.startsWith('✅') ? 'passed' : title.startsWith('👢') ? 'kicked' : title.startsWith('❌') ? 'failed' : 'spam';
            db.prepare('INSERT INTO verify_events VALUES (?, ?, ?, ?)').run(guild.id, String(userId), kind, Math.floor(Date.now() / 1000));
        } catch (e) { console.error('[VERIFY] event store:', e.message); }
        const ch = require('../lib/modlog.js').resolveModLog(guild, db);
        if (!ch) return;
        await ch.send({
            embeds: [new EmbedBuilder().setColor(color).setTitle(title)
                .setDescription(`<@${userId}> \`${userId}\`${detail ? `\n${detail}` : ''}`)
                .setFooter({ text: 'ARCHON CG-223 • Verification' }).setTimestamp()],
            allowedMentions: { parse: [] }
        });
    } catch (e) { console.error(`[VERIFY] modlog guild=${guild.id}:`, e.message); }
}

function prunePanel(now) {
    if (panelSessions.size + panelCooldown.size < 1000) return;
    for (const [k, s] of panelSessions) if (s.expires < now) panelSessions.delete(k);
    for (const [k, t] of panelCooldown) if (now - t > PANEL_COOLDOWN) panelCooldown.delete(k);
}

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
            .addRoleOption(o => o.setName('role').setDescription('Role that blocks channel access until verified').setRequired(true)))
        .addSubcommand(s => s.setName('panel').setDescription('🛡️ Post the verification panel')
            .addChannelOption(o => o.setName('channel').setDescription('Channel unverified members can see')
                .addChannelTypes(ChannelType.GuildText).setRequired(true))),

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
                    .setDescription('Image captcha verification is a **Premium** feature — it keeps your server safe with zero false kicks.\n\nUnlock it for just **$3.40/month** and protect your community.')
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
            const gErr = validateVerifyRole(interaction.guild, interaction.guild.roles.cache.get(role.id), interaction.member);
            if (gErr) return interaction.reply({ content: `⛔ Can't use ${role}: ${GUARD_MSG[gErr]}`, flags: 64 });
            const cur = db.prepare('SELECT verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            if (cur?.verify_unverified_role_id === role.id) return interaction.reply({ content: '⛔ Verified and unverified roles must be different.', flags: 64 });
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
            const gErr = validateVerifyRole(interaction.guild, interaction.guild.roles.cache.get(role.id), interaction.member);
            if (gErr) return interaction.reply({ content: `⛔ Can't use ${role}: ${GUARD_MSG[gErr]}`, flags: 64 });
            const cur = db.prepare('SELECT verify_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            if (cur?.verify_role_id === role.id) return interaction.reply({ content: '⛔ Verified and unverified roles must be different.', flags: 64 });
            db.prepare(`UPDATE server_settings SET verify_unverified_role_id = ? WHERE guild_id = ?`).run(role.id, gid);

            await interaction.deferReply({ flags: 64 });

            // Friendly waiting message while the channels are locked one by one
            ensureCols(db);
            const total = interaction.guild.channels.cache.filter(c => !c.isThread?.() && c.type !== 4).size;
            await interaction.editReply({ content: `🛡️ Securing **${interaction.guild.name}**… locking ${total} channels for ${role}, one by one. Just a few seconds ⏳` }).catch(() => {});

            const r = await applyUnverifiedLock(interaction.guild, role, db);
            return interaction.editReply({
                content: '',
                embeds: [new EmbedBuilder()
                    .setColor(r.failed ? 0xf1c40f : 0x00cc44)
                    .setTitle(`${EMOJIS.shield} Verification Gate Configured`)
                    .setDescription(lockSummary(r, `${role}`))
                    .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })]
            });
        }

        if (sub === 'panel') {
            const { isPremium } = require('./premium.js');
            if (!isPremium(db, gid)) return interaction.reply({ content: '⛔ Verification is a Premium feature — see `/premium status`.', flags: 64 });
            const guild = interaction.guild;
            const ch = interaction.options.getChannel('channel');
            const perms = ch.permissionsFor(guild.members.me);
            if (!perms?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks]))
                return interaction.reply({ content: `⛔ I can't post in ${ch}.`, flags: 64 });

            ensureCols(db);
            db.prepare('UPDATE server_settings SET verify_panel_channel_id = ? WHERE guild_id = ?').run(ch.id, gid);

            const s2 = db.prepare('SELECT verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            const uRole = s2?.verify_unverified_role_id ? guild.roles.cache.get(s2.verify_unverified_role_id) : null;
            if (uRole) applyUnverifiedLock(guild, uRole, db).catch(() => {}); // background: with a panel, the system channel closes too

            await ch.send({
                embeds: [new EmbedBuilder()
                    .setColor(0x00aaff)
                    .setTitle('🛡️ Verification Required')
                    .setDescription('Press **Start verification** to get your code.\n\nOnly you will see the captcha. Enter it in the popup — **3 attempts**, then a short cooldown.')
                    .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('vpanel:start').setLabel('Start verification').setStyle(ButtonStyle.Success).setEmoji('🛡️'))]
            });
            return interaction.reply({
                content: `✅ Panel posted in ${ch}.` + (uRole ? ` ${uRole} can see it.` : ' ⚠️ No unverified role set — run `/verify setunverified`.'),
                flags: 64
            });
        }

        if (sub === 'status') {
            const settings = db.prepare('SELECT verify_enabled, verify_role_id, verify_kick_days, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            const { isPremium } = require('./premium.js');
            const premiumOk = isPremium(db, gid);
            const configured = !!settings?.verify_enabled;
            const enabled = configured && premiumOk;
            const paused = configured && !premiumOk;
            const verifiedRole = settings?.verify_role_id ? `<@&${settings.verify_role_id}>` : '`Not configured`';
            const unverifiedRole = settings?.verify_unverified_role_id ? `<@&${settings.verify_unverified_role_id}>` : '`Not configured`';
            const autokick = settings?.verify_kick_days ? `${settings.verify_kick_days} minutes` : 'Disabled';

            const desc = [
                `### ${enabled ? `${EMOJIS.online} Gate is Active` : paused ? `${EMOJIS.offline} Gate is Paused` : `${EMOJIS.offline} Gate is Inactive`}`,
                `> ${enabled ? 'New members must verify before accessing channels.' : paused ? 'Configured, but Premium has lapsed — renew to resume the gate.' : 'Verification is currently off — all members join freely.'}`,
                ``,
                `### ${EMOJIS.shield} Configuration`,
                `**Verified role** — ${verifiedRole}`,
                `**Unverified role** — ${unverifiedRole}`,
                `**Auto-kick** — ${autokick}`,
                ``,
                `### ${EMOJIS.shield} Quick Setup`,
                `\`/verify setrole\` — role to give after passing`,
                `\`/verify setunverified\` — role that blocks channels`,
                `\`/verify setkick\` — auto-remove if they ghost`,
            ].join('\n');

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(enabled ? 0x00cc44 : 0x888888)
                    .setTitle(`${EMOJIS.shield} Verification Gate`)
                    .setDescription(desc)
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
        const { isPremium } = require('./premium.js');
        if (!isPremium(db, gid)) return; // premium lapsed → gate off

        const oldKey = `${member.id}:${gid}`;
        const old = pending.get(oldKey);
        if (old) {
            if (old.timer) clearTimeout(old.timer);
            old.collector?.stop('replaced');
            pending.delete(oldKey);
        }

        const verifyRole = settings.verify_role_id 
            ? member.guild.roles.cache.get(settings.verify_role_id)
            : null;


        const unverifiedRole = settings.verify_unverified_role_id
            ? member.guild.roles.cache.get(settings.verify_unverified_role_id)
            : null;

        // Runtime guard — refuse unsafe roles already stored in DB
        for (const r of [verifyRole, unverifiedRole]) {
            const err = r && validateVerifyRole(member.guild, r, null);
            if (err) { console.warn(`[VERIFY] ${gid} unsafe role ${r.id}: ${err} — gate skipped`); return; }
        }

        // Auto-assign unverified role immediately
        if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => {});

        // Join-spam limit — role stays applied, no new captcha
        const hitKey = `${member.id}:${gid}`;
        const now = Date.now();
        const hits = (joinHits.get(hitKey) || []).filter(t => now - t < JOIN_WINDOW);
        hits.push(now);
        joinHits.set(hitKey, hits);
        if (joinHits.size > 1000) {
            for (const [k, arr] of joinHits) if (now - arr[arr.length - 1] > JOIN_WINDOW) joinHits.delete(k);
        }
        if (hits.length > JOIN_LIMIT) {
            console.warn(`[VERIFY] join-spam guild=${gid} user=${member.id} (${hits.length} joins/10min) — captcha skipped`);
            if (hits.length === JOIN_LIMIT + 1) logVerify(member.guild, db, 0xff8800, '⚠️ Join spam — captcha paused', member.id, `${hits.length} joins in 10 min`);
            return;
        }
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
                `${EMOJIS.warning} Case insensitive • **3 attempts** • Expires in **${(settings.verify_kick_days || 0) > 0 ? settings.verify_kick_days : 10} minutes**\n\n` +
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

        if (!dmChannel) console.warn(`[VERIFY] no delivery path guild=${gid} user=${member.id} (DMs closed, no system channel)`);

        // Store captcha code
        const key = `${member.id}:${gid}`;
        let attempts = 0;
        const maxAttempts = 3;
        const expireMs = ((settings.verify_kick_days || 0) > 0 ? settings.verify_kick_days : 10) * 60 * 1000;
        const codeRef = { current: code }; // mutable ref so retries work

        let collector = null;
        // Listen for reply in DM
        if (dmChannel) {
            const filter = m => m.author.id === member.id && !m.author.bot;
            collector = dmChannel.createMessageCollector({ filter, time: expireMs });

            collector.on('collect', async m => {
                if (!dmChannel.isDMBased?.()) m.delete().catch(() => {});
                const guess = m.content.trim().toUpperCase();
                if (guess === codeRef.current) {
                    // ✅ Correct!
                    collector.stop('verified');
                    const pv = pending.get(key);
                    if (pv?.timer) clearTimeout(pv.timer);
                    pending.delete(key);

                    // Remove unverified role
                    if (unverifiedRole) await member.roles.remove(unverifiedRole).catch(() => {});
                    // Add verified role
                    if (verifyRole) await member.roles.add(verifyRole).catch(() => {});
                    logVerify(member.guild, db, 0x00cc44, '✅ Verified (DM)', member.id);
                    require('../lib/joinrole.js').applyJoinRole(member, db);

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
                        const pf = pending.get(key);
                        if (pf?.timer) clearTimeout(pf.timer);
                        pending.delete(key);
                        const kickOn = (settings.verify_kick_days || 0) > 0;
                        await dmChannel.send({ embeds: [new EmbedBuilder()
                            .setColor(0xff3311)
                            .setTitle(`${EMOJIS.warning} Too many attempts`)
                            .setDescription(kickOn
                                ? `No worries — you've been removed from **${member.guild.name}** for now.\n\nFeel free to rejoin and try again with a fresh code. 👋`
                                : `Verification failed for **${member.guild.name}**.\n\nLeave and rejoin the server to get a fresh code. 👋`)
                            .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
                        ]}).catch(() => {});
                        if (kickOn) await member.kick('Failed captcha verification').catch(() => {});
                        logVerify(member.guild, db, 0xff3311, kickOn ? '👢 Kicked — failed captcha' : '❌ Failed captcha', member.id, '3 wrong attempts');
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
                    // Keep entry if the kick timer still needs it
                    if (!pending.get(key)?.timer) pending.delete(key);
                    await dmChannel.send({ embeds: [new EmbedBuilder()
                        .setColor(0x888888)
                        .setDescription(`${EMOJIS.warning} Your verification window expired — no worries, just rejoin the server and we'll send a fresh code right away.`)
                        .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
                    ]}).catch(() => {});
                    // Kicking is handled by the auto-kick timer only
                }
            });
        }

        // Auto-kick timer
        const kickMins = settings.verify_kick_days || 0;
        const timer = kickMins > 0 ? setTimeout(async () => {
            const pk = pending.get(key);
            if (!pk) return; // verified, failed or replaced
            pk.collector?.stop('kicked');
            pending.delete(key);
            const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
            if (!freshMember) return;
            const hasRole = verifyRole && freshMember.roles.cache.has(verifyRole.id);
            if (!hasRole) {
                await freshMember.kick('Failed to verify in time').catch(() => {});
                logVerify(member.guild, db, 0xff8800, '👢 Kicked — verification timeout', member.id, `${kickMins} min`);
            }
        }, kickMins * 60000) : null;

        pending.set(key, { timer, dmMsg, code, collector });
    },

    // Called from InteractionCreate for customId 'vpanel:*'
    onPanelInteraction: async (interaction, client, db) => {
        const guild = interaction.guild;
        if (!guild) return;
        const [, action, nonce] = interaction.customId.split(':');
        const gid = guild.id, uid = interaction.user.id, key = `${uid}:${gid}`;
        const now = Date.now();
        const eph = (content) => interaction.reply({ content, flags: 64 });

        const { isPremium } = require('./premium.js');
        const settings = db.prepare('SELECT verify_enabled, verify_role_id, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
        if (!settings?.verify_enabled || !isPremium(db, gid)) return eph('🔒 Verification is not active on this server.');

        const vRole = settings.verify_role_id ? guild.roles.cache.get(settings.verify_role_id) : null;
        const uRole = settings.verify_unverified_role_id ? guild.roles.cache.get(settings.verify_unverified_role_id) : null;
        if (!vRole && !uRole) return eph('⚠️ Verification is not configured — ask an admin.');
        for (const r of [vRole, uRole]) {
            const err = r && validateVerifyRole(guild, r, null);
            if (err) {
                console.warn(`[VERIFY] panel unsafe role guild=${gid} role=${r.id}: ${err}`);
                return eph('⚠️ Verification is misconfigured — ask an admin.');
            }
        }

        const member = await guild.members.fetch(uid).catch(() => null);
        if (!member) return eph('❌ Could not find you in the server.');
        const done = vRole ? member.roles.cache.has(vRole.id) : !member.roles.cache.has(uRole.id);
        if (done) return eph('✅ You are already verified.');

        const challenge = (attempts, note) => {
            const code = randomCode(6);
            const n = crypto.randomBytes(4).toString('hex');
            panelSessions.set(key, { code, attempts, expires: now + PANEL_TTL, nonce: n });
            prunePanel(now);
            return {
                content: note || undefined,
                embeds: [new EmbedBuilder()
                    .setColor(0x00aaff)
                    .setTitle('🛡️ Enter the code in the image')
                    .setDescription(`Case insensitive • Attempt ${attempts + 1}/3 • Expires in 5 minutes`)
                    .setImage('attachment://verify.png')],
                files: [new AttachmentBuilder(generateCaptcha(code), { name: 'verify.png' })],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`vpanel:enter:${n}`).setLabel('Enter code').setStyle(ButtonStyle.Primary))],
                flags: 64
            };
        };

        if (action === 'start') {
            const wait = PANEL_COOLDOWN - (now - (panelCooldown.get(key) || 0));
            if (wait > 0) return eph(`⏳ Wait ${Math.ceil(wait / 1000)}s before requesting a new code.`);
            panelCooldown.set(key, now);
            return interaction.reply(challenge(0));
        }

        const sess = panelSessions.get(key);
        if (!sess || sess.expires < now) {
            panelSessions.delete(key);
            return eph('⌛ Code expired — press **Start verification** again.');
        }
        if (sess.nonce !== nonce) return eph('⚠️ That code is outdated — use your latest one.');

        if (action === 'enter') {
            return interaction.showModal(new ModalBuilder()
                .setCustomId(`vpanel:modal:${nonce}`)
                .setTitle('Verification')
                .addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('code').setLabel('Code from the image')
                        .setStyle(TextInputStyle.Short).setMinLength(6).setMaxLength(6).setRequired(true))));
        }

        if (action === 'modal') {
            const guess = interaction.fields.getTextInputValue('code').trim().toUpperCase();
            if (guess === sess.code) {
                panelSessions.delete(key);
                const p = pending.get(key);
                if (p) { if (p.timer) clearTimeout(p.timer); p.collector?.stop('verified'); pending.delete(key); }
                if (uRole) await member.roles.remove(uRole).catch(() => {});
                if (vRole) await member.roles.add(vRole).catch(() => {});
                logVerify(guild, db, 0x00cc44, '✅ Verified (panel)', uid);
                await require('../lib/joinrole.js').applyJoinRole(member, db);
                return eph(`✅ You're in! Welcome to **${guild.name}** 🎉`);
            }
            const attempts = sess.attempts + 1;
            if (attempts >= 3) {
                panelSessions.delete(key);
                panelCooldown.set(key, now);
                logVerify(guild, db, 0xff3311, '❌ Failed captcha (panel)', uid, '3 wrong attempts');
                return eph('❌ Too many wrong attempts — try again in 30 seconds.');
            }
            return interaction.reply(challenge(attempts, "❌ Not quite — here's a new code."));
        }
    },

    // Called from guildMemberRemove — frees timer + collector
    onMemberLeave: (member) => {
        const key = `${member.id}:${member.guild.id}`;
        const p = pending.get(key);
        if (!p) return;
        if (p.timer) clearTimeout(p.timer);
        p.collector?.stop('left');
        pending.delete(key);
    },

    // SECURITY: legacy button granted roles without captcha — disabled
    onVerifyButton: async (interaction) => {
        return interaction.reply({
            content: '🔒 This verification button is no longer valid. Rejoin the server to get a captcha.',
            flags: 64
        }).catch(() => {});
    }
};
