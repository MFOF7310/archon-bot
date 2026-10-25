// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — VERIFICATION GATE v2.1 (V2 UI + Persistent)
// ═══════════════════════════════════════════════════════
const { 
    SlashCommandBuilder, EmbedBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionsBitField, AttachmentBuilder,
    ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const { applyUnverifiedLock, lockSummary, validateVerifyRole, GUARD_MSG } = require('../lib/verify-guard.js');
const crypto = require('crypto');
const { generateCaptcha, randomCode } = require('./captcha.js');
const EMOJIS = require('../config/emojis');
const mentions = require('../lib/mentions');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { pickLang } = require('../lib/pick-lang');
const i18nV = require('../lib/i18n');

const vt = (lang, k, v) => i18nV.t('verify.' + k, lang || 'en', v);

const pending = new Map(); 
const joinHits = new Map(); 
const JOIN_LIMIT = 3, JOIN_WINDOW = 10 * 60 * 1000;
const panelSessions = new Map(); 
const panelCooldown = new Map(); 

// ── Auto-kick deadlines (DB Persistent) ──
const RESUME_GRACE_MS = 10 * 60 * 1000;
let _vdb = null, _deadlineTable = false;

function _deadlines(db) {
    if (!db) return false;
    if (!_deadlineTable) { 
        db.prepare('CREATE TABLE IF NOT EXISTS verify_pending (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, kick_at INTEGER NOT NULL, code TEXT, attempts INTEGER DEFAULT 0, PRIMARY KEY (guild_id, user_id))').run(); 
        _deadlineTable = true; 
    }
    return true;
}
function saveDeadline(db, gid, uid, kickAt, code) {
    try { if (_deadlines(db)) db.prepare('INSERT OR REPLACE INTO verify_pending (guild_id, user_id, kick_at, code, attempts) VALUES (?, ?, ?, ?, 0)').run(String(gid), String(uid), kickAt, code); }
    catch (e) { console.error('[VERIFY] saveDeadline:', e.message); }
}
function forgetDeadline(db, gid, uid) {
    try { if (_deadlines(db)) db.prepare('DELETE FROM verify_pending WHERE guild_id = ? AND user_id = ?').run(String(gid), String(uid)); }
    catch (e) { console.error('[VERIFY] forgetDeadline:', e.message); }
}

function armResumedKick(client, db, gid, uid, waitMs) {
    const key = `${uid}:${gid}`;
    const old = pending.get(key); if (old?.timer) clearTimeout(old.timer);
    const timer = setTimeout(() => kickIfStillUnverified(client, db, gid, uid).catch((e) => console.error('[VERIFY] resumed kick failed:', e.message)), waitMs);
    pending.set(key, { timer, resumed: true });
}

async function kickIfStillUnverified(client, db, gid, uid) {
    const key = `${uid}:${gid}`;
    forgetDeadline(db, gid, uid);
    const pk = pending.get(key); if (!pk) return; 
    pk.collector?.stop('kicked'); pending.delete(key);
    const guild = client.guilds.cache.get(gid); if (!guild) return;
    const s = db.prepare('SELECT verify_enabled, verify_role_id, verify_kick_days FROM server_settings WHERE guild_id = ?').get(gid);
    if (!s || !s.verify_enabled || !(s.verify_kick_days > 0)) return;
    const m = await guild.members.fetch(uid).catch(() => null); if (!m) return;
    const role = s.verify_role_id ? guild.roles.cache.get(s.verify_role_id) : null;
    if (role && m.roles.cache.has(role.id)) return;
    
    const lang = pickLang(client, gid, null, uid) || 'en';
    try {
        const dmCh = await m.createDM().catch(() => null);
        if (dmCh) {
            const invRow = await storedInviteRow(db, guild, lang);
            await dmCh.send({ embeds: [new EmbedBuilder().setColor(0xff8800)
                .setTitle(`${EMOJIS.warning} ${vt(lang, 'tooManyTitle')}`)
                .setDescription(vt(lang, 'kickDm', { server: guild.name }))
                .setFooter({ text: vt(lang, 'bamakoFooter') })],
                components: invRow ? [invRow] : [] }).catch(() => {});
        }
    } catch {}
    await m.kick('Failed to verify in time').catch(() => {});
    await logVerify(guild, db, 0xff8800, vt(lang, 'logKickedTimeout'), uid, `${s.verify_kick_days} min`, lang);
}

const PANEL_TTL = 5 * 60 * 1000, PANEL_COOLDOWN = 30 * 1000;
let _colsReady = false;
function ensureCols(db) {
    if (_colsReady) return;
    try { db.prepare('ALTER TABLE server_settings ADD COLUMN verify_panel_channel_id TEXT').run(); } catch {}
    _colsReady = true;
}

let _evReady = false;
async function logVerify(guild, db, color, title, userId, detail = '', lang = 'en') {
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
        
        let ch = null;
        const row = db.prepare('SELECT mod_log_channel FROM server_settings WHERE guild_id = ?').get(guild.id);
        if (row && row.mod_log_channel) {
            ch = guild.channels.cache.get(String(row.mod_log_channel)) || await guild.channels.fetch(row.mod_log_channel).catch(() => null);
        }
        if (!ch) {
            const envId = process.env.MOD_LOG_CHANNEL_ID;
            if (envId) ch = guild.channels.cache.get(envId) || await guild.channels.fetch(envId).catch(() => null);
        }
        if (!ch) return;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(`<@${userId}> \`${userId}\`${detail ? `\n${detail}` : ''}`)
            .setFooter({ text: vt(lang, 'logFooter') || 'ARCHON CG-223 • Verification' })
            .setTimestamp();

        await ch.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (e) { console.error(`[VERIFY] modlog guild=${guild.id}:`, e.message); }
}

function prunePanel(now) {
    if (panelSessions.size + panelCooldown.size < 1000) return;
    for (const [k, s] of panelSessions) if (s.expires < now) panelSessions.delete(k);
    for (const [k, t] of panelCooldown) if (now - t > PANEL_COOLDOWN) panelCooldown.delete(k);
}

async function panelLink(guild, db, lang) {
    try {
        const id = db.prepare('SELECT verify_panel_channel_id AS p FROM server_settings WHERE guild_id = ?').get(guild.id)?.p;
        if (!id) return null;
        let ch = guild.channels.cache.get(id);
        if (!ch) ch = await guild.channels.fetch(id).catch(() => null);
        if (!ch) return null;
        return {
            id: ch.id,
            row: new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link)
                .setLabel(vt(lang, 'inviteBtn', { channel: ch.name }).slice(0, 80))
                .setURL(`https://discord.com/channels/${guild.id}/${ch.id}`))
        };
    } catch { return null; }
}

async function storedInviteRow(db, guild, lang) {
    try {
        let url = null;
        
        // 1. Check DB for a saved invite first
        const row = db.prepare('SELECT server_invite FROM server_settings WHERE guild_id = ?').get(guild.id);
        if (row && row.server_invite) {
            url = row.server_invite;
            // 2. Smart validation: Is the link still alive?
            const check = await guild.client.fetchInvite(url).catch(() => null);
            if (!check) {
                console.log(`[VERIFY] Stored invite for ${guild.name} was revoked. Generating a new one...`);
                url = null; // Dead link, needs renewal
            }
        }

        // 3. Create new if missing or dead
        if (!url) {
            const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
            if (me && me.permissions.has('CreateInstantInvite')) {
                const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(me)?.has('CreateInstantInvite'));
                if (channel) {
                    // unique: false prevents Discord from spamming the Invites tab with new links
                    const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: false, reason: 'Verification rejoin' }).catch(() => null);
                    if (invite) {
                        url = invite.url;
                        // 4. Save back to DB for next time!
                        try { 
                            db.prepare('UPDATE server_settings SET server_invite = ? WHERE guild_id = ?').run(url, guild.id); 
                            console.log(`[VERIFY] Saved permanent invite for ${guild.name}`);
                        } catch(e) {}
                    }
                }
            }
        }

        // 5. Vanity URL fallback
        if (!url && guild.vanityURLCode) url = `https://discord.gg/${guild.vanityURLCode}`;
        
        if (!url) return null;
        
        return new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link)
            .setLabel(vt(lang, 'rejoinBtn') || 'Rejoin Server').setURL(url));
    } catch { return null; }
}

module.exports = {
    resumeKickTimers: async (client, db) => {
        _vdb = db;
        let rows;
        try { _deadlines(db); rows = db.prepare('SELECT guild_id, user_id, kick_at FROM verify_pending').all(); }
        catch (e) { console.error('[VERIFY] read deadlines:', e.message); return; }
        const now = Date.now();
        let rearmed = 0, graced = 0, dropped = 0;
        for (const r of rows) {
            if (!client.guilds.cache.get(r.guild_id)) { forgetDeadline(db, r.guild_id, r.user_id); dropped++; continue; }
            let wait = r.kick_at - now;
            if (wait <= 0) {
                wait = RESUME_GRACE_MS; graced++;
                try { db.prepare('UPDATE verify_pending SET kick_at = ? WHERE guild_id = ? AND user_id = ?').run(now + wait, r.guild_id, r.user_id); } catch {}
            } else rearmed++;
            armResumedKick(client, db, r.guild_id, r.user_id, wait);
        }
        console.log(`[VERIFY] resumed ${rows.length} kick deadline(s): ${rearmed} re-armed, ${graced} overdue, ${dropped} dropped`);
    },
    name: 'verify',
    description: 'Verification gate system',
    category: 'MODERATION',
    aliases: [],

    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('⚙️ Verification gate settings')
        .addSubcommand(s => s.setName('enable').setDescription('✅ Enable verification gate'))
        .addSubcommand(s => s.setName('disable').setDescription('❌ Disable verification gate'))
        .addSubcommand(s => s.setName('setrole').setDescription('🎭 Set the verified role').addRoleOption(o => o.setName('role').setDescription('Role to assign after verification').setRequired(true)))
        .addSubcommand(s => s.setName('setkick').setDescription('⏰ Auto-kick unverified after X minutes (0 = never)').addIntegerOption(o => o.setName('minutes').setDescription('Minutes').setRequired(true).setMinValue(0).setMaxValue(60)))
        .addSubcommand(s => s.setName('status').setDescription('📊 View current verification settings'))
        .addSubcommand(s => s.setName('setunverified').setDescription('🔒 Set role given to new members before verifying').addRoleOption(o => o.setName('role').setDescription('Role that blocks channel access').setRequired(true)))
        .addSubcommand(s => s.setName('panel').setDescription('🛡️ Post the verification panel').addChannelOption(o => o.setName('channel').setDescription('Channel unverified members can see').addChannelTypes(ChannelType.GuildText).setRequired(true))),

    execute: async (interaction, client) => {
        const db = client.db;
        const gid = interaction.guild.id;
        const lang = pickLang(client, gid, interaction) || 'en';
        
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
            return interaction.reply({ content: vt(lang, 'needManageGuild'), flags: 64 });

        const sub = interaction.options.getSubcommand();
        const premiumCmdId = client.application.commands.cache.find(c => c.name === 'premium')?.id;
        const premiumMention = premiumCmdId ? `</premium status:${premiumCmdId}>` : '`/premium status`';

        db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(gid);

        if (sub === 'enable') {
            const { isPremium } = require('./premium.js');
            if (!isPremium(db, gid)) {
                return interaction.reply({ embeds: [new EmbedBuilder()
                    .setColor(0xffd700).setTitle(`⭐ ${vt(lang, 'premiumTitle')}`).setDescription(vt(lang, 'premiumDesc'))
                    .addFields({ name: vt(lang, 'premiumHowTo'), value: vt(lang, 'premiumHowToValue') }).setFooter({ text: vt(lang, 'bamakoFooter') })
                ], flags: 64 });
            }
            db.prepare(`UPDATE server_settings SET verify_enabled = 1 WHERE guild_id = ?`).run(gid);
            const settings = db.prepare('SELECT verify_role_id, verify_kick_days FROM server_settings WHERE guild_id = ?').get(gid);
            const role = settings?.verify_role_id ? `<@&${settings.verify_role_id}>` : vt(lang, 'setroleHint');
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x00cc44).setTitle(`${EMOJIS.verified} ${vt(lang, 'enableTitle')}`)
                    .addFields(
                        { name: vt(lang, 'verifiedRoleLabel'), value: role, inline: true },
                        { name: vt(lang, 'autokickLabel'), value: settings?.verify_kick_days ? vt(lang, 'autokickMin', { mins: settings.verify_kick_days }) : vt(lang, 'disabled'), inline: true }
                    ).setFooter({ text: vt(lang, 'enableFooter') })],
                flags: 64
            });
        }

        if (sub === 'disable') {
            db.prepare(`UPDATE server_settings SET verify_enabled = 0 WHERE guild_id = ?`).run(gid);
            return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff3311).setDescription(`⚠️ ${vt(lang, 'disableDesc')}`)], flags: 64 });
        }

        if (sub === 'setrole') {
            const role = interaction.options.getRole('role');
            const gErr = validateVerifyRole(interaction.guild, interaction.guild.roles.cache.get(role.id), interaction.member);
            if (gErr) return interaction.reply({ content: vt(lang, 'roleGuardError', { role: String(role), reason: GUARD_MSG[gErr] }), flags: 64 });
            const cur = db.prepare('SELECT verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            if (cur?.verify_unverified_role_id === role.id) return interaction.reply({ content: vt(lang, 'roleDiffError'), flags: 64 });
            db.prepare(`UPDATE server_settings SET verify_role_id = ? WHERE guild_id = ?`).run(role.id, gid);
            return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00aaff).setDescription(vt(lang, 'roleSetDesc', { role: String(role) }))], flags: 64 });
        }

        if (sub === 'setkick') {
            const mins = interaction.options.getInteger('minutes');
            db.prepare(`UPDATE server_settings SET verify_kick_days = ? WHERE guild_id = ?`).run(mins, gid);
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x00aaff).setDescription(mins === 0 ? `${EMOJIS.check} ${vt(lang, 'setkickDisabled')}` : `⚠️ ${vt(lang, 'setkickEnabled', { mins })}`)],
                flags: 64
            });
        }

        if (sub === 'setunverified') {
            const role = interaction.options.getRole('role');
            const gErr = validateVerifyRole(interaction.guild, interaction.guild.roles.cache.get(role.id), interaction.member);
            if (gErr) return interaction.reply({ content: vt(lang, 'roleGuardError', { role: String(role), reason: GUARD_MSG[gErr] }), flags: 64 });
            const cur = db.prepare('SELECT verify_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            if (cur?.verify_role_id === role.id) return interaction.reply({ content: vt(lang, 'roleDiffError'), flags: 64 });
            db.prepare(`UPDATE server_settings SET verify_unverified_role_id = ? WHERE guild_id = ?`).run(role.id, gid);

            await interaction.deferReply({ flags: 64 });
            ensureCols(db);
            const total = interaction.guild.channels.cache.filter(c => !c.isThread?.() && c.type !== 4).size;
            await interaction.editReply({ content: vt(lang, 'lockingChannels', { server: interaction.guild.name, count: total, role: String(role) }) }).catch(() => {});

            const r = await applyUnverifiedLock(interaction.guild, role, db);
            return interaction.editReply({
                content: '', embeds: [new EmbedBuilder().setColor(r.failed ? 0xf1c40f : 0x00cc44)
                    .setTitle(vt(lang, 'configuredTitle')).setDescription(lockSummary(r, `${role}`)).setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })]
            });
        }

        if (sub === 'panel') {
            const { isPremium } = require('./premium.js');
            if (!isPremium(db, gid)) return interaction.reply({ content: vt(lang, 'premiumLapsed', { premiumCmd: premiumMention }), flags: 64 });
            const guild = interaction.guild;
            const ch = interaction.options.getChannel('channel');
            const canPostChk = require('../lib/canPost').diagnose(guild, ch, guild.members.me);
            if (!canPostChk.ok)
                return interaction.reply({ content: vt(lang, canPostChk.key, { ch: String(ch), role: canPostChk.role || '', perms: require('../lib/canPost').localize(canPostChk.missing || [], lang).join(', '), bot: guild.members.me.roles.botRole?.name || guild.members.me.displayName, cmd: mentions(client, 'verify', 'panel') }), flags: 64 });

            ensureCols(db);
            db.prepare('UPDATE server_settings SET verify_panel_channel_id = ? WHERE guild_id = ?').run(ch.id, gid);

            const s2 = db.prepare('SELECT verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            const uRole = s2?.verify_unverified_role_id ? guild.roles.cache.get(s2.verify_unverified_role_id) : null;
            if (uRole) applyUnverifiedLock(guild, uRole, db).catch(() => {});

            const vContainer = new ContainerBuilder().setAccentColor(0x00aaff);
            const checkEm = resolveEmoji('small_check', client) || '✅';
            const warnEm = resolveEmoji('warning', client) || '⚠️';
            
            vContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${resolveEmoji('shield', client) || '🛡️'} ${vt(lang, 'v2_panel_title')}`));
            vContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            vContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(vt(lang, 'v2_panel_intro')));
            vContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(vt(lang, 'v2_panel_how', { check: checkEm })));
            vContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(vt(lang, 'v2_panel_warn', { warn: warnEm })));
            vContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            vContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${vt(lang, 'bamakoFooter')}`));
            vContainer.addActionRowComponents(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('vpanel:start').setLabel(vt(lang, 'v2_panel_btn')).setStyle(ButtonStyle.Success).setEmoji(resolveEmoji('lock', client) || '🛡️')
            ));
            await ch.send({ components: [vContainer], flags: MessageFlags.IsComponentsV2 });
            
            return interaction.reply({
                content: vt(lang, 'panelPosted', { ch: String(ch) }) + (uRole ? ' ' + vt(lang, 'panelCanSee', { role: String(uRole) }) : vt(lang, 'panelNoRole')),
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

            const cmdId = interaction.commandId;
            const desc = [
                `### ${enabled ? `${EMOJIS.online} ${vt(lang, 'gateActive')}` : paused ? `${EMOJIS.offline} ${vt(lang, 'gatePaused')}` : `${EMOJIS.offline} ${vt(lang, 'gateInactive')}`}`,
                `> ${enabled ? vt(lang, 'gateActiveDesc') : paused ? vt(lang, 'gatePausedDesc') : vt(lang, 'gateInactiveDesc')}`,
                ``, `### ${EMOJIS.shield} ${vt(lang, 'configuration')}`,
                `**${vt(lang, 'verifiedRoleLabel')}** — ${verifiedRole}`,
                `**${vt(lang, 'unverifiedRoleLabel')}** — ${unverifiedRole}`,
                `**${vt(lang, 'autokickLabel')}** — ${autokick}`,
                ``, `### ${EMOJIS.shield} ${vt(lang, 'quickSetup')}`,
                vt(lang, 'qsSetrole', { id: cmdId }), vt(lang, 'qsSetunverified', { id: cmdId }), vt(lang, 'qsSetkick', { id: cmdId }),
            ].join('\n');

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(enabled ? 0x00cc44 : 0x888888).setTitle(vt(lang, 'gateTitle')).setDescription(desc).setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })],
                flags: 64
            });
        }
    },

    onMemberJoin: async (member, client, db) => {
        const gid = member.guild.id;
        const lang = pickLang(client, gid, null, member.id) || 'en';
        
        const settings = db.prepare('SELECT verify_enabled, verify_role_id, verify_kick_days, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
        if (!settings?.verify_enabled) return;
        const { isPremium } = require('./premium.js');
        if (!isPremium(db, gid)) return;

        const oldKey = `${member.id}:${gid}`;
        const old = pending.get(oldKey);
        if (old) {
            if (old.timer) clearTimeout(old.timer);
            old.collector?.stop('replaced');
            pending.delete(oldKey);
        }

        const verifyRole = settings.verify_role_id ? member.guild.roles.cache.get(settings.verify_role_id) : null;
        const unverifiedRole = settings.verify_unverified_role_id ? member.guild.roles.cache.get(settings.verify_unverified_role_id) : null;

        for (const r of [verifyRole, unverifiedRole]) {
            const err = r && validateVerifyRole(member.guild, r, null);
            if (err) { console.warn(`[VERIFY] ${gid} unsafe role ${r.id}: ${err} — gate skipped`); return; }
        }

        if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => {});

        const hitKey = `${member.id}:${gid}`;
        const now = Date.now();
        const hits = (joinHits.get(hitKey) || []).filter(t => now - t < JOIN_WINDOW);
        hits.push(now);
        joinHits.set(hitKey, hits);
        if (joinHits.size > 1000) {
            for (const [k, arr] of joinHits) if (now - arr[arr.length - 1] > JOIN_WINDOW) joinHits.delete(k);
        }
        if (hits.length > JOIN_LIMIT) {
            if (hits.length === JOIN_LIMIT + 1) logVerify(member.guild, db, 0xff8800, vt(lang, 'logSpam'), member.id, `${hits.length} joins in 10 min`, lang);
            return;
        }

        const code = randomCode(6);
        const imgBuf = generateCaptcha(code);
        const attachment = new AttachmentBuilder(imgBuf, { name: 'verify.png' });

        const pl = await panelLink(member.guild, db, lang);
        const plNoKick = (settings.verify_kick_days || 0) > 0 ? null : pl;
        
        const captchaEmbed = new EmbedBuilder()
            .setColor(0x00aaff)
            .setTitle(vt(lang, 'dmTitle', { server: member.guild.name }).replace('👋 ', '').replace('👋', ''))
            .setDescription(
                `${resolveEmoji('ducky_hey', client) || '👋'} ` + vt(lang, 'dmInstructions') +
                `⚠️ ${vt(lang, 'dmCaseNote')} • **${vt(lang, 'dmAttempts')}** • ${vt(lang, 'dmExpires', { mins: (settings.verify_kick_days || 0) > 0 ? settings.verify_kick_days : 10 })}\n\n` +
                (pl ? `*${vt(lang, 'dmTroublePanel')}*` : `*${vt(lang, 'dmTroubleRejoin')}*`)
            )
            .setImage('attachment://verify.png')
            .setThumbnail(member.guild.iconURL({ dynamic: true }))
            .setFooter({ text: `ARCHON CG-223 • ${member.guild.name} • ${vt(lang, 'dmFooter')}` })
            .setTimestamp();

        let dmMsg = null;
        let dmChannel = null;
        try {
            dmChannel = await member.createDM();
            dmMsg = await dmChannel.send({ embeds: [captchaEmbed], files: [attachment] }); // Clean, no button
        } catch {
            const sysCh = pl ? null : member.guild.systemChannel;
            if (sysCh) {
                try {
                    dmMsg = await sysCh.send({ content: vt(lang, 'sysChanPing', { user: member }), embeds: [captchaEmbed], files: [attachment] });
                    dmChannel = sysCh;
                } catch {}
            }
        }

        const key = `${member.id}:${gid}`;
        const kickMins = settings.verify_kick_days || 0;
        
        const timer = kickMins > 0 ? setTimeout(async () => {
            forgetDeadline(db, gid, member.id);
            const pk = pending.get(key);
            if (!pk) return;
            pk.collector?.stop('kicked');
            pending.delete(key);
            const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
            if (!freshMember) return;
            const hasRole = verifyRole && freshMember.roles.cache.has(verifyRole.id);
            if (!hasRole) {
                try {
                    const dmCh = await freshMember.createDM().catch(() => null);
                    if (dmCh) {
                        const invRow = await storedInviteRow(db, member.guild, lang);
                        await dmCh.send({ embeds: [new EmbedBuilder().setColor(0xff8800)
                            .setTitle(`${EMOJIS.warning} ${vt(lang, 'tooManyTitle')}`)
                            .setDescription(vt(lang, 'kickDm', { server: member.guild.name }))
                            .setFooter({ text: vt(lang, 'bamakoFooter') })],
                            components: invRow ? [invRow] : [] }).catch(() => {});
                    }
                } catch {}
                await freshMember.kick('Failed to verify in time').catch(() => {});
                await logVerify(member.guild, db, 0xff8800, vt(lang, 'logKickedTimeout'), member.id, `${kickMins} min`, lang);
            }
        }, kickMins * 60000) : null;

        pending.set(key, { timer, dmMsg, code, collector: null });
        _vdb = db;
        if (timer) saveDeadline(db, gid, member.id, Date.now() + kickMins * 60000, code);
    },

    onPanelInteraction: async (interaction, client, db) => {
        const guild = interaction.guild;
        if (!guild) return;
        const [, action, nonce] = interaction.customId.split(':');
        const gid = guild.id, uid = interaction.user.id, key = `${uid}:${gid}`;
        const now = Date.now();
        const eph = (content) => interaction.reply({ content, flags: 64 });
        const lang = pickLang(client, gid, interaction) || 'en';

        const { isPremium } = require('./premium.js');
        const settings = db.prepare('SELECT verify_enabled, verify_role_id, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
        if (!settings?.verify_enabled || !isPremium(db, gid)) return eph(vt(lang, 'notActive'));

        const vRole = settings.verify_role_id ? guild.roles.cache.get(settings.verify_role_id) : null;
        const uRole = settings.verify_unverified_role_id ? guild.roles.cache.get(settings.verify_unverified_role_id) : null;
        if (!vRole && !uRole) return eph(vt(lang, 'notConfigured'));
        
        for (const r of [vRole, uRole]) {
            const err = r && validateVerifyRole(guild, r, null);
            if (err) return eph(vt(lang, 'misconfigured'));
        }

        const member = await guild.members.fetch(uid).catch(() => null);
        if (!member) return eph(vt(lang, 'memberNotFound'));
        const done = vRole ? member.roles.cache.has(vRole.id) : !member.roles.cache.has(uRole.id);
        if (done) return eph(vt(lang, 'alreadyVerified'));

        const challenge = (attempts, note) => {
            const code = randomCode(6);
            const n = crypto.randomBytes(4).toString('hex');
            panelSessions.set(key, { code, attempts, expires: now + PANEL_TTL, nonce: n });
            prunePanel(now);
            return {
                content: note || undefined,
                embeds: [new EmbedBuilder()
                    .setColor(0x00aaff)
                    .setTitle(vt(lang, 'enterCodeTitle'))
                    .setDescription(vt(lang, 'enterCodeDesc', { n: attempts + 1 }))
                    .setImage('attachment://verify.png')],
                files: [new AttachmentBuilder(generateCaptcha(code), { name: 'verify.png' })],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`vpanel:enter:${n}`).setLabel(vt(lang, 'enterCodeBtn')).setStyle(ButtonStyle.Primary))],
                flags: 64
            };
        };

        if (action === 'start') {
            const wait = PANEL_COOLDOWN - (now - (panelCooldown.get(key) || 0));
            if (wait > 0) return eph(vt(lang, 'cooldown', { secs: Math.ceil(wait / 1000) }));
            panelCooldown.set(key, now);
            return interaction.reply(challenge(0));
        }

        const sess = panelSessions.get(key);
        if (!sess || sess.expires < now) {
            panelSessions.delete(key);
            return eph(vt(lang, 'codeExpired'));
        }
        if (sess.nonce !== nonce) return eph(vt(lang, 'codeOutdated'));

        if (action === 'enter') {
            return interaction.showModal(new ModalBuilder()
                .setCustomId(`vpanel:modal:${nonce}`)
                .setTitle(vt(lang, 'modalTitle'))
                .addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('code').setLabel(vt(lang, 'modalLabel'))
                        .setStyle(TextInputStyle.Short).setMinLength(6).setMaxLength(6).setRequired(true))));
        }

        if (action === 'modal') {
            const guess = interaction.fields.getTextInputValue('code').trim().toUpperCase();
            if (guess === sess.code) {
                panelSessions.delete(key);
                const p = pending.get(key);
                if (p) { if (p.timer) clearTimeout(p.timer); p.collector?.stop('verified'); pending.delete(key); }
                forgetDeadline(db, gid, uid);
                if (uRole) await member.roles.remove(uRole).catch(() => {});
                if (vRole) await member.roles.add(vRole).catch(() => {});
                await logVerify(guild, db, 0x00cc44, vt(lang, 'logPassedPanel'), uid, '', lang);
                await require('../lib/joinrole.js').applyJoinRole(member, db);
                return eph(vt(lang, 'verifiedPanel', { server: guild.name }));
            }
            const attempts = sess.attempts + 1;
            if (attempts >= 3) {
                panelSessions.delete(key);
                panelCooldown.set(key, now);
                await logVerify(guild, db, 0xff3311, vt(lang, 'logFailedPanel'), uid, '3 wrong attempts', lang);
                return eph(vt(lang, 'tooManyPanel'));
            }
            return interaction.reply(challenge(attempts, vt(lang, 'incorrectNote')));
        }
    },

    onMemberLeave: (member) => {
        const key = `${member.id}:${member.guild.id}`;
        forgetDeadline(_vdb, member.guild.id, member.id);
        const p = pending.get(key);
        if (!p) return;
        if (p.timer) clearTimeout(p.timer);
        p.collector?.stop('left');
        pending.delete(key);
    },

    onVerifyButton: async (interaction) => {
        const lang = pickLang(interaction.client, interaction.guild?.id, interaction) || 'en';
        const pl = interaction.guild && await panelLink(interaction.guild, interaction.client.db, lang);
        return interaction.reply({
            content: pl ? vt(lang, 'legacyBtnPanel', { channel: pl.id }) : vt(lang, 'legacyBtnRejoin'),
            flags: 64
        }).catch(() => {});
    },

    handleDM: async (message, client, db) => {
        if (message.author.bot || !message.channel.isDMBased()) return false;
        
        const pendingRows = db.prepare('SELECT guild_id, code, attempts FROM verify_pending WHERE user_id = ?').all(message.author.id);
        if (!pendingRows.length) return false;

        const row = pendingRows[0];
        const gid = row.guild_id;
        const guild = client.guilds.cache.get(gid);
        if (!guild) return false;

        const lang = pickLang(client, gid, null, message.author.id) || 'en';
        const guess = message.content.replace(/\s+/g, '').toUpperCase();

        if (!/^[A-Z0-9]{6}$/.test(guess)) {
            await message.channel.send({ content: vt(lang, 'dmHint') }).catch(() => {});
            return true;
        }

        if (guess === row.code) {
            const settings = db.prepare('SELECT verify_role_id, verify_unverified_role_id FROM server_settings WHERE guild_id = ?').get(gid);
            const vRole = settings?.verify_role_id ? guild.roles.cache.get(settings.verify_role_id) : null;
            const uRole = settings?.verify_unverified_role_id ? guild.roles.cache.get(settings.verify_unverified_role_id) : null;
            const member = await guild.members.fetch(message.author.id).catch(() => null);
            if (!member) return true;

            await message.channel.send({ embeds: [new EmbedBuilder()
                .setColor(0x00cc44)
                .setTitle(`${EMOJIS.verified} ${vt(lang, 'verifiedDmTitle')}`)
                .setDescription(vt(lang, 'welcomeDm', { server: guild.name }))
                .setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })
            ]}).catch(() => {});

            (async () => {
                if (uRole) await member.roles.remove(uRole).catch(() => {});
                if (vRole) await member.roles.add(vRole).catch(() => {});
                await logVerify(guild, db, 0x00cc44, vt(lang, 'logPassedDm'), member.id, '', lang);
                require('../lib/joinrole.js').applyJoinRole(member, db);
                forgetDeadline(db, gid, member.id);
                const p = pending.get(`${member.id}:${gid}`);
                if (p) { if(p.timer) clearTimeout(p.timer); p.collector?.stop('verified'); pending.delete(`${member.id}:${gid}`); }
            })();
            return true;
        } else {
            const attempts = (row.attempts || 0) + 1;
            if (attempts >= 3) {
                db.prepare('DELETE FROM verify_pending WHERE guild_id = ? AND user_id = ?').run(gid, message.author.id);
                
                const member = await guild.members.fetch(message.author.id).catch(() => null);
                const settings = db.prepare('SELECT verify_kick_days, verify_role_id FROM server_settings WHERE guild_id = ?').get(gid);
                const kickOn = (settings?.verify_kick_days || 0) > 0;
                
                if (kickOn) {
                    // They are getting kicked. Send the Rejoin button.
                    const invRow = await storedInviteRow(db, guild, lang);
                    await message.channel.send({ 
                        embeds: [new EmbedBuilder().setColor(0xff3311).setTitle(vt(lang, 'tooManyTitle')).setDescription(vt(lang, 'kickDm', { server: guild.name })).setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })],
                        components: invRow ? [invRow] : []
                    }).catch(() => {});
                    
                    if (member) {
                        const hasRole = settings.verify_role_id && member.roles.cache.has(settings.verify_role_id);
                        if (!hasRole) {
                            await member.kick('Failed captcha verification').catch(() => {});
                            await logVerify(guild, db, 0xff3311, vt(lang, 'logKickedFail'), member.id, '3 wrong attempts', lang);
                            const p = pending.get(`${member.id}:${gid}`);
                            if (p) { if(p.timer) clearTimeout(p.timer); p.collector?.stop('kicked'); pending.delete(`${member.id}:${gid}`); }
                        }
                    }
                } else {
                    // Kick is off. Send the Panel button so they can try in the server.
                    const pl = await panelLink(guild, db, lang);
                    await message.channel.send({ 
                        embeds: [new EmbedBuilder().setColor(0xff3311).setTitle(vt(lang, 'tooManyTitle')).setDescription(vt(lang, 'failPanelDm', { server: guild.name })).setFooter({ text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' })],
                        components: pl ? [pl.row] : []
                    }).catch(() => {});
                }
            } else {
                db.prepare('UPDATE verify_pending SET attempts = ? WHERE guild_id = ? AND user_id = ?').run(attempts, gid, message.author.id);
                await message.channel.send({ content: vt(lang, 'attemptWrongTitle', { n: attempts, max: 3 }) }).catch(() => {});
            }
            return true;
        }
    }
};
