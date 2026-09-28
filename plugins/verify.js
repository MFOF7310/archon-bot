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
const i18nV = require('../lib/i18n');
const VL = (db, gid) => { try { const l = db.prepare('SELECT language FROM server_settings WHERE guild_id = ?').get(gid)?.language; return ['en','fr','bm','zh','ar'].includes(l) ? l : 'en'; } catch { return 'en'; } };
const vt = (db, gid, k, v) => i18nV.t('verify.' + k, VL(db, gid), v);
let _inviteCol;
function inviteCol(db) {
    if (_inviteCol !== undefined) return _inviteCol;
    try {
        const cols = db.prepare('PRAGMA table_info(server_settings)').all().map(r => r.name);
        _inviteCol = cols.find(n => /invit/i.test(n)) || null;
    } catch { _inviteCol = null; }
    return _inviteCol;
}
function storedInviteRow(db, guild) {
    try {
        const col = inviteCol(db);
        if (!col) return null;
        const raw = db.prepare(`SELECT ${col} AS v FROM server_settings WHERE guild_id = ?`).get(guild.id)?.v;
        if (!raw) return null;
        const m = String(raw).match(/https?:\/\/[^\s)\]]+/i);
        if (!m) return null;
        return new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link)
            .setLabel(vt(db, guild.id, 'rejoinBtn')).setURL(m[0]));
    } catch { return null; }
}
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

// Link button to the server's verification panel: members get a fresh code there
// (private popup, works with closed DMs) instead of leaving and rejoining.
function panelLink(guild, db) {
    try {
        const id = db.prepare('SELECT verify_panel_channel_id AS p FROM server_settings WHERE guild_id = ?').get(guild.id)?.p;
        const ch = id && guild.channels.cache.get(id);
        if (!ch) return null;
        return {
            id: ch.id,
            row: new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link)
                .setLabel(`Open #${ch.name}`.slice(0, 80)).setURL(`https://discord.com/channels/${guild.id}/${ch.id}`))
        };
    } catch { return null; }
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
            return interaction.reply({ content: vt(db, interaction.guild?.id, 'needManageGuild'), flags: 64 });

        const sub = interaction.options.getSubcommand();
        const gid = interaction.guild.id;

        // Ensure row exists
        db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(gid);

        if (sub === 'enable') {
            const { isPremium } = require('./premium.js');
            if (!isPremium(db, gid)) {
                return interaction.reply({ embeds: [new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle(`⭐ ${vt(db, gid, 'premiumTitle')}`)
                    .setDescription(vt(db, gid, 'premiumDesc'))
                    .addFields({ name: vt(db, gid, 'premiumHowTo'), value: vt(db, gid, 'premiumHowToValue') })
                    .setFooter({ text: vt(db, gid, 'bamakoFooter') })
                ], flags: 64 });
            }
            db.prepare(`UPDATE server_settings SET verify_enabled = 1 WHERE guild_id = ?`).run(gid);
            const settings = db.prepare('SELECT verify_role_id, verify_kick_days FROM server_settings WHERE guild_id = ?').get(gid);
            const role = settings?.verify_role_id ? `<@&${settings.verify_role_id}>` : vt(db, gid, 'setroleHint');
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00cc44)
                    .setTitle(`✅ ${vt(db, gid, 'enableTitle')}`)
                    .addFields(
                        { name: vt(db, gid, 'verifiedRoleLabel'), value: role, inline: true },
                        { name: vt(db, gid, 'autokickLabel'), value: settings?.verify_kick_days ? vt(db, gid, 'autokickMin', { mins: settings.verify_kick_days }) : vt(db, gid, 'disabled'), inline: true }
                    )
                    .setFooter({ text: vt(db, gid, 'enableFooter') })],
                flags: 64
            });
        }

        if (sub === 'disable') {
            db.prepare(`UPDATE server_settings SET verify_enabled = 0 WHERE guild_id = ?`).run(gid);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xff3311)
                    .setDescription(`⚠️ ${vt(db, gid, 'disableDesc')}`)],
                flags: 64
            });
        }

        if (sub === 'setrole') {
            const role = interaction.options.getRole('role');
            const gErr = validateVerifyRole(interaction.guild, interaction.guild.roles.cache.get(role.id), interaction.member);
            if (gErr) return interaction.reply({ content: vt(db, gid, 'roleGuardError', { role: String(role), reason: GUARD_MSG[gErr] }), flags: 64 });
            const cur = db.prepare('SELECT verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            if (cur?.verify_unverified_role_id === role.id) return interaction.reply({ content: vt(db, gid, 'roleDiffError'), flags: 64 });
            db.prepare(`UPDATE server_settings SET verify_role_id = ? WHERE guild_id = ?`).run(role.id, gid);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00aaff)
                    .setDescription(vt(db, gid, 'roleSetDesc', { role: String(role) }))],
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
                        ? `${EMOJIS.check} ${vt(db, gid, 'setkickDisabled')}`
                        : `⚠️ ${vt(db, gid, 'setkickEnabled', { mins })}`)],
                flags: 64
            });
        }

        if (sub === 'setunverified') {
            const role = interaction.options.getRole('role');
            const gErr = validateVerifyRole(interaction.guild, interaction.guild.roles.cache.get(role.id), interaction.member);
            if (gErr) return interaction.reply({ content: vt(db, gid, 'roleGuardError', { role: String(role), reason: GUARD_MSG[gErr] }), flags: 64 });
            const cur = db.prepare('SELECT verify_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            if (cur?.verify_role_id === role.id) return interaction.reply({ content: vt(db, gid, 'roleDiffError'), flags: 64 });
            db.prepare(`UPDATE server_settings SET verify_unverified_role_id = ? WHERE guild_id = ?`).run(role.id, gid);

            await interaction.deferReply({ flags: 64 });

            // Friendly waiting message while the channels are locked one by one
            ensureCols(db);
            const total = interaction.guild.channels.cache.filter(c => !c.isThread?.() && c.type !== 4).size;
            await interaction.editReply({ content: vt(db, gid, 'lockingChannels', { server: interaction.guild.name, count: total, role: String(role) }) }).catch(() => {});

            const r = await applyUnverifiedLock(interaction.guild, role, db);
            return interaction.editReply({
                content: '',
                embeds: [new EmbedBuilder()
                    .setColor(r.failed ? 0xf1c40f : 0x00cc44)
                    .setTitle(vt(db, gid, 'configuredTitle'))
                    .setDescription(lockSummary(r, `${role}`))
                    .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })]
            });
        }

        if (sub === 'panel') {
            const { isPremium } = require('./premium.js');
            if (!isPremium(db, gid)) return interaction.reply({ content: vt(db, gid, 'premiumLapsed'), flags: 64 });
            const guild = interaction.guild;
            const ch = interaction.options.getChannel('channel');
            const perms = ch.permissionsFor(guild.members.me);
            if (!perms?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks]))
                return interaction.reply({ content: vt(db, gid, 'cantPost', { ch: String(ch) }), flags: 64 });

            ensureCols(db);
            db.prepare('UPDATE server_settings SET verify_panel_channel_id = ? WHERE guild_id = ?').run(ch.id, gid);

            const s2 = db.prepare('SELECT verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            const uRole = s2?.verify_unverified_role_id ? guild.roles.cache.get(s2.verify_unverified_role_id) : null;
            if (uRole) applyUnverifiedLock(guild, uRole, db).catch(() => {}); // background: with a panel, the system channel closes too

            await ch.send({
                embeds: [new EmbedBuilder()
                    .setColor(0x00aaff)
                    .setTitle(vt(db, gid, 'panelTitle'))
                    .setDescription(vt(db, gid, 'panelDesc'))
                    .setFooter({ text: vt(db, gid, 'bamakoFooter') })],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('vpanel:start').setLabel(vt(db, gid, 'panelBtn')).setStyle(ButtonStyle.Success).setEmoji('🛡️'))]
            });
            return interaction.reply({
                content: vt(db, gid, 'panelPosted', { ch: String(ch) }) + (uRole ? ' ' + vt(db, gid, 'panelCanSee', { role: String(uRole) }) : vt(db, gid, 'panelNoRole')),
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

            const v = (k, x) => vt(db, gid, k, x);
            const desc = [
                `### ${enabled ? `${EMOJIS.online} ${v('gateActive')}` : paused ? `${EMOJIS.offline} ${v('gatePaused')}` : `${EMOJIS.offline} ${v('gateInactive')}`}`,
                `> ${enabled ? v('gateActiveDesc') : paused ? v('gatePausedDesc') : v('gateInactiveDesc')}`,
                ``,
                `### ${EMOJIS.shield} ${v('configuration')}`,
                `**${v('verifiedRoleLabel')}** — ${verifiedRole}`,
                `**${v('unverifiedRoleLabel')}** — ${unverifiedRole}`,
                `**${v('autokickLabel')}** — ${autokick}`,
                ``,
                `### ${EMOJIS.shield} ${v('quickSetup')}`,
                v('qsSetrole'),
                v('qsSetunverified'),
                v('qsSetkick'),
            ].join('\n');

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(enabled ? 0x00cc44 : 0x888888)
                    .setTitle(vt(db, gid, 'gateTitle'))
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
            if (hits.length === JOIN_LIMIT + 1) logVerify(member.guild, db, 0xff8800, vt(db, gid, 'logSpam'), member.id, `${hits.length} joins in 10 min`);
            return;
        }
        // Generate captcha
        const code = randomCode(6);
        const imgBuf = generateCaptcha(code);
        const attachment = new AttachmentBuilder(imgBuf, { name: 'verify.png' });

        // Store code in pending
        const pl = panelLink(member.guild, db);
        const plNoKick = (settings.verify_kick_days || 0) > 0 ? null : pl;
        const captchaEmbed = new EmbedBuilder()
            .setColor(0x00aaff)
            .setTitle(vt(db, gid, 'dmTitle', { server: member.guild.name }))
            .setDescription(
                vt(db, gid, 'dmInstructions') +
                `⚠️ ${vt(db, gid, 'dmCaseNote')} • **${vt(db, gid, 'dmAttempts')}** • ${vt(db, gid, 'dmExpires', { mins: (settings.verify_kick_days || 0) > 0 ? settings.verify_kick_days : 10 })}\n\n` +
                (pl ? `*${vt(db, gid, 'dmTroublePanel')}*` : `*${vt(db, gid, 'dmTroubleRejoin')}*`)
            )
            .setImage('attachment://verify.png')
            .setThumbnail(member.guild.iconURL({ dynamic: true }))
            .setFooter({ text: `ARCHON CG-223 • ${member.guild.name} • ${vt(db, gid, 'dmFooter')}` })
            .setTimestamp();

        let dmMsg = null;
        let dmChannel = null;
        try {
            dmChannel = await member.createDM();
            dmMsg = await dmChannel.send({ embeds: [captchaEmbed], files: [attachment], components: pl ? [pl.row] : [] });
        } catch {
            // DMs closed — try system channel
            const sysCh = pl ? null : member.guild.systemChannel; // with a panel, the system channel is locked for them: they verify in the panel
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
        let lastHint = 0; // throttles the "not a code" reply
        const expireMs = ((settings.verify_kick_days || 0) > 0 ? settings.verify_kick_days : 10) * 60 * 1000;
        const codeRef = { current: code }; // mutable ref so retries work

        let collector = null;
        // Listen for reply in DM
        if (dmChannel) {
            const filter = m => m.author.id === member.id && !m.author.bot;
            collector = dmChannel.createMessageCollector({ filter, time: expireMs });

            collector.on('collect', async m => {
                if (!dmChannel.isDMBased?.()) m.delete().catch(() => {});
                const guess = m.content.replace(/\s+/g, '').toUpperCase();
                // Chat ("hi", a question) is not an attempt: only 6 letters/digits count
                if (!/^[A-Z0-9]{6}$/.test(guess)) {
                    if (Date.now() - lastHint > 60000) {
                        lastHint = Date.now();
                        dmChannel.send({ content: vt(db, gid, 'dmHint') }).catch(() => {});
                    }
                    return;
                }
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
                    logVerify(member.guild, db, 0x00cc44, vt(db, gid, 'logPassedDm'), member.id);
                    require('../lib/joinrole.js').applyJoinRole(member, db);

                    await dmChannel.send({ embeds: [new EmbedBuilder()
                        .setColor(0x00cc44)
                        .setTitle(`✅ ${vt(db, gid, 'verifiedDmTitle')}`)
                        .setDescription(vt(db, gid, 'welcomeDm', { server: member.guild.name }))
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
                            .setTitle(`⚠️ ${vt(db, gid, 'tooManyTitle')}`)
                            .setDescription(kickOn
                                ? vt(db, gid, 'kickDm', { server: member.guild.name })
                                : (pl ? vt(db, gid, 'failPanelDm', { server: member.guild.name }) : vt(db, gid, 'failRejoinDm', { server: member.guild.name })))
                            .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
                        ], components: kickOn ? (() => { const r = storedInviteRow(db, member.guild); return r ? [r] : []; })() : (pl ? [pl.row] : []) }).catch(() => {});
                        if (kickOn) await member.kick('Failed captcha verification').catch(() => {});
                        logVerify(member.guild, db, 0xff3311, kickOn ? vt(db, gid, 'logKickedFail') : vt(db, gid, 'logFailed'), member.id, '3 wrong attempts');
                    } else {
                        // Wrong — send new captcha
                        const newCode = randomCode(6);
                        const newBuf = generateCaptcha(newCode);
                        const newAttach = new AttachmentBuilder(newBuf, { name: 'verify.png' });
                        // Update codeRef so collector validates new code
                        codeRef.current = newCode;

                        await dmChannel.send({ embeds: [new EmbedBuilder()
                            .setColor(0xff8800)
                            .setTitle(`⚠️ ${vt(db, gid, 'attemptWrongTitle', { n: attempts, max: maxAttempts })}`)
                            .setDescription(vt(db, gid, 'attemptWrongDesc', { remaining: maxAttempts - attempts }))
                            .setImage('attachment://verify.png')
                            .setFooter({ text: vt(db, gid, 'dmRetryFooter') })
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
                        .setDescription(`⚠️ ${plNoKick ? vt(db, gid, 'expiredPanel') : vt(db, gid, 'expiredRejoin')}`)
                        .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
                    ], components: plNoKick ? [plNoKick.row] : [] }).catch(() => {});
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
                try {
                    const dmCh = await freshMember.createDM().catch(() => null);
                    if (dmCh) {
                        const invRow = storedInviteRow(db, member.guild);
                        await dmCh.send({ embeds: [new EmbedBuilder().setColor(0xff8800)
                            .setTitle(`⚠️ ${vt(db, gid, 'tooManyTitle')}`)
                            .setDescription(vt(db, gid, 'kickDm', { server: member.guild.name }))
                            .setFooter({ text: vt(db, gid, 'bamakoFooter') })],
                            components: invRow ? [invRow] : [] }).catch(() => {});
                    }
                } catch {}
                await freshMember.kick('Failed to verify in time').catch(() => {});
                logVerify(member.guild, db, 0xff8800, vt(db, gid, 'logKickedTimeout'), member.id, `${kickMins} min`);
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
        if (!settings?.verify_enabled || !isPremium(db, gid)) return eph(vt(db, gid, 'notActive'));

        const vRole = settings.verify_role_id ? guild.roles.cache.get(settings.verify_role_id) : null;
        const uRole = settings.verify_unverified_role_id ? guild.roles.cache.get(settings.verify_unverified_role_id) : null;
        if (!vRole && !uRole) return eph(vt(db, gid, 'notConfigured'));
        for (const r of [vRole, uRole]) {
            const err = r && validateVerifyRole(guild, r, null);
            if (err) {
                console.warn(`[VERIFY] panel unsafe role guild=${gid} role=${r.id}: ${err}`);
                return eph(vt(db, gid, 'misconfigured'));
            }
        }

        const member = await guild.members.fetch(uid).catch(() => null);
        if (!member) return eph(vt(db, gid, 'memberNotFound'));
        const done = vRole ? member.roles.cache.has(vRole.id) : !member.roles.cache.has(uRole.id);
        if (done) return eph(vt(db, gid, 'alreadyVerified'));

        const challenge = (attempts, note) => {
            const code = randomCode(6);
            const n = crypto.randomBytes(4).toString('hex');
            panelSessions.set(key, { code, attempts, expires: now + PANEL_TTL, nonce: n });
            prunePanel(now);
            return {
                content: note || undefined,
                embeds: [new EmbedBuilder()
                    .setColor(0x00aaff)
                    .setTitle(vt(db, gid, 'enterCodeTitle'))
                    .setDescription(vt(db, gid, 'enterCodeDesc', { n: attempts + 1 }))
                    .setImage('attachment://verify.png')],
                files: [new AttachmentBuilder(generateCaptcha(code), { name: 'verify.png' })],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`vpanel:enter:${n}`).setLabel(vt(db, gid, 'enterCodeBtn')).setStyle(ButtonStyle.Primary))],
                flags: 64
            };
        };

        if (action === 'start') {
            const wait = PANEL_COOLDOWN - (now - (panelCooldown.get(key) || 0));
            if (wait > 0) return eph(vt(db, gid, 'cooldown', { secs: Math.ceil(wait / 1000) }));
            panelCooldown.set(key, now);
            return interaction.reply(challenge(0));
        }

        const sess = panelSessions.get(key);
        if (!sess || sess.expires < now) {
            panelSessions.delete(key);
            return eph(vt(db, gid, 'codeExpired'));
        }
        if (sess.nonce !== nonce) return eph(vt(db, gid, 'codeOutdated'));

        if (action === 'enter') {
            return interaction.showModal(new ModalBuilder()
                .setCustomId(`vpanel:modal:${nonce}`)
                .setTitle(vt(db, gid, 'modalTitle'))
                .addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('code').setLabel(vt(db, gid, 'modalLabel'))
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
                logVerify(guild, db, 0x00cc44, vt(db, gid, 'logPassedPanel'), uid);
                await require('../lib/joinrole.js').applyJoinRole(member, db);
                return eph(vt(db, gid, 'verifiedPanel', { server: guild.name }));
            }
            const attempts = sess.attempts + 1;
            if (attempts >= 3) {
                panelSessions.delete(key);
                panelCooldown.set(key, now);
                logVerify(guild, db, 0xff3311, vt(db, gid, 'logFailedPanel'), uid, '3 wrong attempts');
                return eph(vt(db, gid, 'tooManyPanel'));
            }
            return interaction.reply(challenge(attempts, vt(db, gid, 'incorrectNote')));
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
            content: (() => { const pl = interaction.guild && panelLink(interaction.guild, interaction.client.db); return pl ? vt(interaction.client.db, interaction.guild.id, 'legacyBtnPanel', { channel: pl.id }) : vt(interaction.client.db, interaction.guild.id, 'legacyBtnRejoin'); })(),
            flags: 64
        }).catch(() => {});
    }
};
