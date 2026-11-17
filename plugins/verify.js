'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON CG-223 — VERIFICATION OF NEW MEMBERS (Premium)
//   /verify             one control panel for admins: on/off, the two roles, auto-kick, posting the panel
//   on join             the member gets the waiting role and a captcha in DM (a card with the picture)
//   DM answer           handleDM: the code typed in DM
//   server panel        vpanel:start → private captcha → vpanel:enter → form (vpanel:modal)
// A member is told they're in only once the roles really changed; if Discord refuses, they and the mod log are told.
// Admin panel components: vfy:vrole · vfy:urole (role menus) · vfy:kick (menu) · vfy:post (channel menu) · vfy:toggle
// Kept for the rest of the bot: gateActive, postVerifyPanel, approveMember (dashboard), resumeKickTimers,
// onMemberJoin, onMemberLeave, onPanelInteraction, onVerifyButton (old buttons), handleDM.
// ═══════════════════════════════════════════════════════════════════════════
const {
    SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
    PermissionsBitField,
} = require('discord.js');
const crypto = require('crypto');
const { applyUnverifiedLock, validateVerifyRole, DANGEROUS } = require('../lib/verify-guard.js');
const { generateCaptcha, randomCode } = require('./captcha.js');
const { card } = require('../lib/games/v2');
const { icon } = require('../lib/ui/icons');
const { pickLang } = require('../lib/pick-lang');
const access = require('../lib/access');
const i18n = require('../lib/i18n');

const V2 = MessageFlags.IsComponentsV2;
const EPH = MessageFlags.Ephemeral;
const COLOR = { on: 0x1D9E75, off: 0x5b6b7c, warn: 0xF0B232, bad: 0xE74C3C, info: 0x378ADD };
const MAX_TRIES = 3;
const KICK_CHOICES = [0, 5, 10, 15, 30, 60];

const T = (lang, k, v) => i18n.t('verify.' + k, lang || 'en', v || {});
const langOf = (client, gid, ix, uid) => pickLang(client, gid, ix || null, uid) || 'en';
const isPremium = (db, gid) => { try { return require('./premium.js').isPremium(db, gid); } catch { return false; } };

const pending = new Map();        // `${uid}:${gid}` → { timer }
const joinHits = new Map();
const JOIN_LIMIT = 3, JOIN_WINDOW = 10 * 60 * 1000;
const panelSessions = new Map();
const panelCooldown = new Map();
const PANEL_TTL = 5 * 60 * 1000, PANEL_COOLDOWN = 30 * 1000;
const RESUME_GRACE_MS = 10 * 60 * 1000;
let _vdb = null;

// ─── settings ────────────────────────────────────────────────────────────
let _colsReady = false;
function ensureCols(db) {
    if (_colsReady) return;
    try { db.prepare('ALTER TABLE server_settings ADD COLUMN verify_panel_channel_id TEXT').run(); } catch { /* already there */ }
    _colsReady = true;
}
function settingsOf(db, gid) {
    ensureCols(db);
    db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(gid);
    return db.prepare('SELECT verify_enabled, verify_role_id, verify_unverified_role_id, verify_kick_days, verify_panel_channel_id FROM server_settings WHERE guild_id = ?').get(gid) || {};
}
function save(client, gid, col, value) {
    client.db.prepare(`UPDATE server_settings SET ${col} = ? WHERE guild_id = ?`).run(value, gid);
    client.settings?.delete?.(gid);
    client.invalidateGuildCache?.(gid);
}
const rolesOf = (guild, s) => ({
    vRole: s.verify_role_id ? guild.roles.cache.get(s.verify_role_id) || null : null,
    uRole: s.verify_unverified_role_id ? guild.roles.cache.get(s.verify_unverified_role_id) || null : null,
});

// Why a role can't be used, in the admin's language (lib/verify-guard decides, this only words it)
function guardText(code, role, lang) {
    if (code !== 'dangerous_perms') return T(lang, `guard_${code}`);
    const perms = role?.permissions?.has?.(PermissionsBitField.Flags.Administrator) ? ['Administrator']
        : new PermissionsBitField(DANGEROUS.filter((f) => role?.permissions?.has?.(f))).toArray().map((n) => n.replace(/([a-z])([A-Z])/g, '$1 $2'));
    return T(lang, 'guard_dangerous_perms', { perms: perms.join(', ') });
}

// ─── auto-kick deadlines (kept in the database across restarts) ─────────
let _deadlineTable = false;
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
function clearPending(gid, uid) {
    const key = `${uid}:${gid}`;
    const p = pending.get(key);
    if (p?.timer) clearTimeout(p.timer);
    pending.delete(key);
    panelSessions.delete(key);
}
function armKick(client, db, gid, uid, waitMs) {
    const key = `${uid}:${gid}`;
    const old = pending.get(key);
    if (old?.timer) clearTimeout(old.timer);
    const timer = setTimeout(() => kickUnverified(client, db, gid, uid, 'timeout').catch((e) => console.error('[VERIFY] kick failed:', e.message)), waitMs);
    pending.set(key, { timer });
}

// ─── mod log: one short card per event ───────────────────────────────────
let _evReady = false;
const KIND_OF = { passed_dm: 'passed', passed_panel: 'passed', passed_manual: 'passed', failed_panel: 'failed', roles_failed: 'failed', kicked_fail: 'kicked', kicked_timeout: 'kicked', spam: 'spam' };
const LOOK = { passed: ['user_check', COLOR.on], failed: ['warn', COLOR.warn], kicked: ['user_x', COLOR.bad], spam: ['warn', COLOR.warn] };
async function logVerify(guild, db, event, userId, vars = {}) {
    const kind = KIND_OF[event] || 'spam';
    try {
        if (!_evReady) {
            db.prepare('CREATE TABLE IF NOT EXISTS verify_events (guild_id TEXT, user_id TEXT, kind TEXT, ts INTEGER)').run();
            db.prepare('CREATE INDEX IF NOT EXISTS idx_verify_events ON verify_events (guild_id, ts)').run();
            _evReady = true;
        }
        db.prepare('INSERT INTO verify_events VALUES (?, ?, ?, ?)').run(guild.id, String(userId), kind, Math.floor(Date.now() / 1000));
    } catch (e) { console.error('[VERIFY] event store:', e.message); }
    try {
        const ch = require('../lib/modlog').resolveModLog(guild, db);
        if (!ch) return;
        let lang = 'en';
        try { lang = pickLang(guild.client, guild.id, null); } catch { /* English */ }
        if (!['en', 'fr', 'zh', 'ar'].includes(lang)) lang = 'en';
        const [ic, color] = LOOK[kind];
        const user = await guild.client.users.fetch(String(userId)).catch(() => null);
        const text = `${icon(ic, ch)} ${T(lang, `log_${event}`, { user: `<@${userId}>`, ...vars })}\n-# \`${userId}\` · <t:${Math.floor(Date.now() / 1000)}:R>`;
        await require('../lib/safeSend').safeSend('modlog', ch, card(color, [user ? { thumbnail: [text, user.displayAvatarURL({ size: 64 })] } : { text }]), { guild });
    } catch (e) { console.error(`[VERIFY] modlog guild=${guild.id}:`, e.message); }
}

// ─── links shown to a member who is stuck ────────────────────────────────
async function panelLink(guild, db, lang) {
    try {
        const id = settingsOf(db, guild.id).verify_panel_channel_id;
        if (!id) return null;
        const ch = guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null);
        if (!ch) return null;
        return {
            id: ch.id,
            row: new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link)
                .setLabel(T(lang, 'btnOpenPanel', { channel: ch.name }).slice(0, 80)).setURL(`https://discord.com/channels/${guild.id}/${ch.id}`)),
        };
    } catch { return null; }
}

// A lasting invite to come back after a kick: the saved one if it still works, else a new one, else the vanity link
async function rejoinRow(db, guild, lang) {
    try {
        let url = db.prepare('SELECT server_invite FROM server_settings WHERE guild_id = ?').get(guild.id)?.server_invite || null;
        if (url && !await guild.client.fetchInvite(url).catch(() => null)) url = null;
        if (!url) {
            const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
            const channel = me && (guild.systemChannel || guild.channels.cache.find((c) => c.type === 0 && c.permissionsFor(me)?.has('CreateInstantInvite')));
            if (channel && channel.permissionsFor(me)?.has('CreateInstantInvite')) {
                const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: false, reason: 'Verification rejoin' }).catch(() => null);
                if (invite) {
                    url = invite.url;
                    try { db.prepare('UPDATE server_settings SET server_invite = ? WHERE guild_id = ?').run(url, guild.id); } catch { /* kept for this time only */ }
                }
            }
        }
        if (!url && guild.vanityURLCode) url = `https://discord.gg/${guild.vanityURLCode}`;
        if (!url) return null;
        return new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(T(lang, 'btnRejoin')).setURL(url).setEmoji(icon('ch_welcome')));
    } catch { return null; }
}

// ─── letting a member in, or out ─────────────────────────────────────────
// Takes the waiting role off and gives the verified one; returns the Discord error if one of them was refused
async function giveAccess(member, vRole, uRole, why) {
    const errors = [];
    if (uRole && member.roles.cache.has(uRole.id)) await member.roles.remove(uRole, why).catch((e) => errors.push(e.message));
    if (vRole && !member.roles.cache.has(vRole.id)) await member.roles.add(vRole, why).catch((e) => errors.push(e.message));
    return errors[0] || null;
}

// Everything that follows a passed captcha (DM, panel or by hand). Returns null when the member is in, else the error.
async function letIn(client, db, guild, member, event, vars = {}) {
    const { vRole, uRole } = rolesOf(guild, settingsOf(db, guild.id));
    const err = await giveAccess(member, vRole, uRole, event === 'passed_manual' ? `Verified by hand (${vars.mod || '?'})` : 'Passed verification');
    if (err) {
        // The right code was given: the member must not be kicked for ARCHON's own problem. The kick timer stops,
        // and the code stays valid so they can type it again once a moderator fixes the roles.
        const p = pending.get(`${member.id}:${guild.id}`);
        if (p?.timer) clearTimeout(p.timer);
        pending.delete(`${member.id}:${guild.id}`);
        try { _deadlines(db); db.prepare('UPDATE verify_pending SET kick_at = 0 WHERE guild_id = ? AND user_id = ?').run(guild.id, member.id); } catch { /* the timer is already stopped */ }
        await logVerify(guild, db, 'roles_failed', member.id, { error: err });
        return err;
    }
    forgetDeadline(db, guild.id, member.id);
    clearPending(guild.id, member.id);
    await logVerify(guild, db, event, member.id, vars);
    try { await require('../lib/joinrole.js').applyJoinRole(member, db); } catch { /* the join role is optional */ }
    try { require('./welcome.js').afterVerify(member, client, db)?.catch?.(() => {}); } catch { /* no welcome module */ }
    return null;
}

// Removes a member who didn't verify (time ran out, or 3 wrong codes), with a DM that lets them come back
async function kickUnverified(client, db, gid, uid, why) {
    forgetDeadline(db, gid, uid);
    clearPending(gid, uid);
    const guild = client.guilds.cache.get(gid);
    if (!guild) return;
    const s = settingsOf(db, gid);
    if (!s.verify_enabled || (why === 'timeout' && !(s.verify_kick_days > 0))) return;
    const m = await guild.members.fetch(uid).catch(() => null);
    if (!m) return;
    const { vRole, uRole } = rolesOf(guild, s);
    if (vRole ? m.roles.cache.has(vRole.id) : (uRole && !m.roles.cache.has(uRole.id))) return;   // verified meanwhile
    const lang = langOf(client, gid, null, uid);
    const row = await rejoinRow(db, guild, lang);
    const reason = why === 'timeout' ? T(lang, 'kickTimeout', { mins: s.verify_kick_days }) : T(lang, 'kickFail');
    await m.send(card(COLOR.bad, [
        { text: `-# ${guild.name}\n## ${icon('user_x')} ${T(lang, 'kickTitle', { server: guild.name })}\n${reason} ${T(lang, 'kickBack')}` },
        ...(row ? [{ row }] : []),
    ])).catch(() => {});
    await m.kick(why === 'timeout' ? 'Did not verify in time' : 'Failed captcha verification').catch(() => {});
    await logVerify(guild, db, why === 'timeout' ? 'kicked_timeout' : 'kicked_fail', uid, { mins: s.verify_kick_days });
}

// ─── cards for the member ────────────────────────────────────────────────
function captchaCard(guild, lang, { code, kickAt, panelId, mention }) {
    const lines = [
        mention ? `<@${mention}>` : null,
        `-# ${guild.name}`,
        `## ${icon('hand')} ${T(lang, 'dmTitle')}`,
        T(lang, 'dmIntro', { server: guild.name }),
    ].filter(Boolean).join('\n');
    const iconUrl = guild.iconURL?.({ size: 128 });
    const info = [
        `${icon('keyboard')} ${T(lang, 'dmTries', { n: MAX_TRIES })}`,
        kickAt ? `${icon('clock')} ${T(lang, 'dmEnds', { when: `<t:${Math.floor(kickAt / 1000)}:R>` })}` : null,
        `-# ${panelId ? T(lang, 'dmStuckPanel', { channel: `<#${panelId}>` }) : T(lang, 'dmStuck')}`,
    ].filter(Boolean).join('\n');
    const payload = card(COLOR.info, [
        iconUrl ? { thumbnail: [lines, iconUrl] } : { text: lines },
        { media: ['attachment://verify.png', T(lang, 'altCaptcha')] },
        { text: info },
    ]);
    payload.files = [new AttachmentBuilder(generateCaptcha(code), { name: 'verify.png' })];
    if (mention) payload.allowedMentions = { users: [mention] };
    return payload;
}
const inCard = (guild, lang) => card(COLOR.on, [{ text: `-# ${guild.name}\n## ${icon('user_check')} ${T(lang, 'okTitle')}\n${T(lang, 'okText', { server: guild.name })}` }]);
const blockedCard = (guild, lang) => card(COLOR.warn, [{ text: `-# ${guild.name}\n## ${icon('warn')} ${T(lang, 'rolesFailTitle')}\n${T(lang, 'rolesFailText', { server: guild.name })}` }]);

// ─── the panel posted in the server ──────────────────────────────────────
// Shared by /verify and the dashboard. Posts the panel, then (only if the post worked) remembers the channel and
// hides the other channels from the waiting role. Throws if Discord refuses the message.
async function postVerifyPanel(client, db, guild, ch, lang) {
    await ch.send(card(COLOR.on, [
        { text: `## ${icon('shield_check', ch)} ${T(lang, 'panelTitle')}\n${T(lang, 'panelIntro')}` },
        { rule: true },
        { text: `**${T(lang, 'panelHow')}**\n1. ${T(lang, 'panelStep1')}\n2. ${T(lang, 'panelStep2')}\n3. ${T(lang, 'panelStep3')}\n-# ${T(lang, 'panelNote', { n: MAX_TRIES })}` },
        { row: new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('vpanel:start').setLabel(T(lang, 'btnStart'))
            .setStyle(ButtonStyle.Success).setEmoji(icon('shield', ch))) },
    ]));
    save(client, guild.id, 'verify_panel_channel_id', ch.id);
    const { uRole } = rolesOf(guild, settingsOf(db, guild.id));
    if (uRole) applyUnverifiedLock(guild, uRole, db).catch(() => {});
    return { uRole };
}

// True when a newcomer really goes through the gate here: on, Premium, and a usable role to give or take.
// plugins/welcome.js holds the welcome card until verification passes on these servers.
function gateActive(guild, db) {
    try {
        const s = settingsOf(db, guild.id);
        if (!s.verify_enabled || !isPremium(db, guild.id)) return false;
        const roles = Object.values(rolesOf(guild, s)).filter(Boolean);
        return roles.length > 0 && !roles.some((r) => validateVerifyRole(guild, r, null));
    } catch { return false; }
}

// A moderator lets a member through by hand (dashboard). Same end state as passing the captcha.
async function approveMember(client, db, guild, member, actorId) {
    const { vRole, uRole } = rolesOf(guild, settingsOf(db, guild.id));
    if (!vRole && !uRole) return { error: 'not_configured' };
    for (const r of [vRole, uRole]) if (r && validateVerifyRole(guild, r, null)) return { error: 'misconfigured' };
    if (vRole ? member.roles.cache.has(vRole.id) : !member.roles.cache.has(uRole.id)) return { error: 'already_verified' };
    const err = await letIn(client, db, guild, member, 'passed_manual', { mod: `<@${actorId}>` });
    return err ? { error: 'roles_failed' } : { ok: true };
}

// ─── the admin control panel (/verify) ───────────────────────────────────
function weekNumbers(db, gid) {
    try {
        const since = Math.floor(Date.now() / 1000) - 7 * 86400;
        const out = { passed: 0, failed: 0, kicked: 0 };
        for (const r of db.prepare('SELECT kind, COUNT(*) AS n FROM verify_events WHERE guild_id = ? AND ts >= ? GROUP BY kind').all(gid, since)) if (r.kind in out) out[r.kind] = r.n;
        return out;
    } catch { return null; }
}

function adminView(client, guild, lang, where, notice) {
    const db = client.db;
    const s = settingsOf(db, guild.id);
    const premium = isPremium(db, guild.id);
    const { vRole, uRole } = rolesOf(guild, s);
    const problems = [];
    for (const [r, id] of [[vRole, s.verify_role_id], [uRole, s.verify_unverified_role_id]]) {
        if (id && !r) problems.push(`${icon('warn', where)} <@&${id}> · ${guardText('role_missing', null, lang)}`);
        const code = r && validateVerifyRole(guild, r, null);
        if (code) problems.push(`${icon('warn', where)} ${r} · ${guardText(code, r, lang)}`);
    }
    const state = !s.verify_enabled ? 'off' : !premium ? 'paused' : (!vRole && !uRole) ? 'incomplete' : problems.length ? 'blocked' : 'on';
    const stateIcon = { on: 'on', off: 'off', paused: 'warn', incomplete: 'warn', blocked: 'warn' }[state];
    const panel = s.verify_panel_channel_id && guild.channels.cache.get(s.verify_panel_channel_id);
    const kick = s.verify_kick_days > 0 ? T(lang, 'kickMins', { mins: s.verify_kick_days }) : T(lang, 'kickOff');
    const week = weekNumbers(db, guild.id);

    const items = [
        { text: [
            notice ? `-# ${notice}` : null,
            `-# ${guild.name} · ${premium ? T(lang, 'premium') : T(lang, 'free')}`,
            `## ${icon('shield_check', where)} ${T(lang, 'title')}`,
            `${icon(stateIcon, where)} ${T(lang, `state_${state}`)}`,
        ].filter(Boolean).join('\n') },
        { rule: true },
        { text: [
            `${icon('user_check', where)} **${T(lang, 'vroleLabel')}** · ${vRole || T(lang, 'notSet')}`,
            `${icon('lock', where)} **${T(lang, 'uroleLabel')}** · ${uRole || T(lang, 'notSet')}`,
            `${icon('clock', where)} **${T(lang, 'kickLabel')}** · ${kick}`,
            `${icon('ch_title', where)} **${T(lang, 'panelLabel')}** · ${panel ? `<#${panel.id}>` : T(lang, 'notPosted')}`,
            ...problems,
        ].join('\n') },
    ];
    if (!premium) items.push({ text: `${icon('star', where)} ${T(lang, 'premiumNeeded')}` });
    if (week && (week.passed + week.failed + week.kicked) > 0) items.push({ text: `-# ${T(lang, 'week', week)}` });

    const roleMenu = (id, ph, current) => {
        const m = new RoleSelectMenuBuilder().setCustomId(id).setPlaceholder(ph).setMinValues(1).setMaxValues(1);
        if (current) m.setDefaultRoles(current.id);
        return new ActionRowBuilder().addComponents(m);
    };
    items.push(
        { row: roleMenu('vfy:vrole', T(lang, 'phVrole'), vRole) },
        { row: roleMenu('vfy:urole', T(lang, 'phUrole'), uRole) },
        { row: new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('vfy:kick').setPlaceholder(T(lang, 'kickLabel'))
            .addOptions(KICK_CHOICES.map((m) => ({
                label: m ? T(lang, 'optMins', { mins: m }) : T(lang, 'optNever'),
                value: String(m),
                default: (s.verify_kick_days || 0) === m,
            })))) },
        { row: new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('vfy:post').setPlaceholder(T(lang, 'phPost'))
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1)) },
        { row: new ActionRowBuilder().addComponents(s.verify_enabled
            ? new ButtonBuilder().setCustomId('vfy:toggle').setStyle(ButtonStyle.Danger).setLabel(T(lang, 'btnOff')).setEmoji(icon('off', where))
            : new ButtonBuilder().setCustomId('vfy:toggle').setStyle(ButtonStyle.Success).setLabel(T(lang, 'btnOn')).setEmoji(icon('on', where))) },
        { text: `-# ${T(lang, 'hint')}` },
    );
    return card(COLOR[state === 'on' ? 'on' : state === 'off' ? 'off' : 'warn'], items);
}

async function handleAdmin(ix, client) {
    const guild = ix.guild;
    if (!guild) return;
    const db = client.db;
    const lang = langOf(client, guild.id, ix, ix.user.id);
    const no = access.deny(ix.member, 'settings', lang);
    if (no) return ix.reply({ content: no, flags: EPH, allowedMentions: { parse: [] } });
    const act = ix.customId.split(':')[1];
    const s = settingsOf(db, guild.id);
    const show = (notice, ic = 'ok') => {
        const view = adminView(client, guild, lang, ix, notice ? `${icon(ic, ix)} ${notice}` : null);
        return ix.deferred || ix.replied ? ix.editReply(view) : ix.update(view);
    };

    if (act === 'vrole' || act === 'urole') {
        const role = guild.roles.cache.get(ix.values[0]);
        const code = validateVerifyRole(guild, role, ix.member);
        if (code) return show(T(lang, 'nGuard', { role: String(role || '?'), reason: guardText(code, role, lang) }), 'no');
        const other = act === 'vrole' ? s.verify_unverified_role_id : s.verify_role_id;
        if (other === role.id) return show(T(lang, 'nSame'), 'no');
        if (act === 'vrole') {
            save(client, guild.id, 'verify_role_id', role.id);
            return show(T(lang, 'nVrole', { role: String(role) }));
        }
        save(client, guild.id, 'verify_unverified_role_id', role.id);
        await ix.deferUpdate();
        const r = await applyUnverifiedLock(guild, role, db);
        let note = T(lang, 'nUrole', { role: String(role), n: r.locked });
        if (r.failed) note += ` ${T(lang, 'nLockFailed', { n: r.failed })}`;
        if (!r.panelId) note += ` ${r.fallbackId ? T(lang, 'nNoPanel', { channel: `<#${r.fallbackId}>` }) : T(lang, 'nNoPanelNone')}`;
        return show(note, r.failed || !r.panelId ? 'warn' : 'ok');
    }

    if (act === 'kick') {
        const mins = Number(ix.values[0]) || 0;
        save(client, guild.id, 'verify_kick_days', mins);
        return show(T(lang, 'nKick', { value: mins ? T(lang, 'kickMins', { mins }) : T(lang, 'kickOff') }));
    }

    if (act === 'post') {
        if (!isPremium(db, guild.id)) return show(T(lang, 'premiumNeeded'), 'star');
        const ch = guild.channels.cache.get(ix.values[0]);
        const d = require('../lib/canPost').diagnose(guild, ch, guild.members.me);
        if (!d.ok) {
            return show(T(lang, d.key, {
                ch: String(ch), role: d.role || '', perms: require('../lib/canPost').localize(d.missing || [], lang).join(', '),
                bot: guild.members.me?.roles?.botRole?.name || guild.members.me?.displayName || 'ARCHON', cmd: '/verify',
            }), 'no');
        }
        await ix.deferUpdate();
        try { await postVerifyPanel(client, db, guild, ch, lang); }
        catch (e) { console.error('[VERIFY] panel post failed:', e.message); return show(T(lang, 'cantPost', { ch: String(ch) }), 'no'); }
        return show(T(lang, 'nPosted', { ch: String(ch) }));
    }

    if (act === 'toggle') {
        if (s.verify_enabled) {
            save(client, guild.id, 'verify_enabled', 0);
            return show(T(lang, 'nOff'), 'off');
        }
        if (!isPremium(db, guild.id)) return show(T(lang, 'premiumNeeded'), 'star');
        const { vRole, uRole } = rolesOf(guild, s);
        if (!vRole && !uRole) return show(T(lang, 'nNeedRole'), 'warn');
        save(client, guild.id, 'verify_enabled', 1);
        return show(T(lang, 'nOn'), 'on');
    }
}

// ─── command and events ──────────────────────────────────────────────────
module.exports = {
    name: 'verify',
    description: 'Verification of new members (Premium)',
    category: 'MODERATION',
    aliases: [],
    gateActive,
    postVerifyPanel,
    approveMember,
    handleAdmin,

    data: new SlashCommandBuilder().setName('verify')
        .setDescription('🛡️ Verification of new members: settings and panel (Premium)')
        .setDescriptionLocalizations({ fr: '🛡️ Vérification des nouveaux membres : réglages et panneau (Premium)' }),

    execute: async (interaction, client) => {
        if (!interaction.guild) return;
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        const no = access.deny(interaction.member, 'settings', lang);
        if (no) return interaction.reply({ content: no, flags: EPH, allowedMentions: { parse: [] } });
        return interaction.reply({ ...adminView(client, interaction.guild, lang, interaction), flags: V2 | EPH });
    },

    resumeKickTimers: async (client, db) => {
        _vdb = db;
        let rows;
        try { _deadlines(db); rows = db.prepare('SELECT guild_id, user_id, kick_at FROM verify_pending').all(); }
        catch (e) { console.error('[VERIFY] read deadlines:', e.message); return; }
        const now = Date.now();
        let rearmed = 0, graced = 0, dropped = 0;
        for (const r of rows) {
            if (!client.guilds.cache.get(r.guild_id)) { forgetDeadline(db, r.guild_id, r.user_id); dropped++; continue; }
            if (r.kick_at === 0) { rearmed++; continue; }   // no auto-kick on that server
            let wait = r.kick_at - now;
            if (wait <= 0) {
                wait = RESUME_GRACE_MS; graced++;
                try { db.prepare('UPDATE verify_pending SET kick_at = ? WHERE guild_id = ? AND user_id = ?').run(now + wait, r.guild_id, r.user_id); } catch { /* the timer still runs */ }
            } else rearmed++;
            armKick(client, db, r.guild_id, r.user_id, wait);
        }
        console.log(`[VERIFY] resumed ${rows.length} kick deadline(s): ${rearmed} re-armed, ${graced} overdue, ${dropped} dropped`);
    },

    // ARCHON notes every minute that it is online. At startup, members who joined during the gap never got the
    // join event: those with no verified role, no waiting role and no code on file get the normal captcha now.
    // At most CATCHUP_MAX per server (never a wave of DMs), one every 1.5 s; skipped on the first start (no gap known).
    catchUpMissedJoins: async (client, db) => {
        const CATCHUP_MAX = 25;
        try { db.prepare('CREATE TABLE IF NOT EXISTS bot_meta (key TEXT PRIMARY KEY, value TEXT)').run(); } catch { return; }
        const seen = () => { try { db.prepare("INSERT OR REPLACE INTO bot_meta (key, value) VALUES ('verify_last_seen', ?)").run(String(Date.now())); } catch { /* next minute */ } };
        let last = 0;
        try { last = Number(db.prepare("SELECT value FROM bot_meta WHERE key = 'verify_last_seen'").get()?.value || 0); } catch { last = 0; }
        seen();
        setInterval(seen, 60 * 1000).unref?.();
        if (!last) return console.log('[VERIFY] catch-up: first start, nothing to compare with');
        const since = last - 60 * 1000;   // one heartbeat of margin
        let done = 0;
        for (const guild of client.guilds.cache.values()) {
            let s;
            try { s = settingsOf(db, guild.id); } catch { continue; }
            if (!s.verify_enabled || !isPremium(db, guild.id)) continue;
            const { vRole, uRole } = rolesOf(guild, s);
            if (!vRole && !uRole) continue;
            const members = await guild.members.fetch().catch(() => null);
            if (!members) continue;
            let filed = new Set();
            try { filed = new Set(db.prepare('SELECT user_id FROM verify_pending WHERE guild_id = ?').all(guild.id).map((r) => r.user_id)); } catch { /* none on file */ }
            const missed = [...members.values()].filter((m) => !m.user.bot && (m.joinedTimestamp || 0) > since
                && !(vRole && m.roles.cache.has(vRole.id)) && !(uRole && m.roles.cache.has(uRole.id)) && !filed.has(m.id))
                .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp).slice(0, CATCHUP_MAX);
            for (const m of missed) {
                await module.exports.onMemberJoin(m, client, db).catch((e) => console.error(`[VERIFY] catch-up ${guild.id}/${m.id}:`, e.message));
                done++;
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
        console.log(`[VERIFY] catch-up: ${done} member(s) who joined while offline got their captcha`);
    },

    onMemberJoin: async (member, client, db) => {
        const gid = member.guild.id;
        _vdb = db;
        const s = settingsOf(db, gid);
        if (!s.verify_enabled || !isPremium(db, gid)) return;
        clearPending(gid, member.id);
        const { vRole, uRole } = rolesOf(member.guild, s);
        for (const r of [vRole, uRole]) {
            const err = r && validateVerifyRole(member.guild, r, null);
            if (err) { console.warn(`[VERIFY] ${gid} unsafe role ${r.id}: ${err} — gate skipped`); return; }
        }
        if (uRole) await member.roles.add(uRole, 'Waiting for verification').catch(() => {});

        // Someone leaving and joining again and again: one captcha, then nothing until it calms down
        const now = Date.now();
        const hitKey = `${member.id}:${gid}`;
        const hits = (joinHits.get(hitKey) || []).filter((t) => now - t < JOIN_WINDOW);
        hits.push(now);
        joinHits.set(hitKey, hits);
        if (joinHits.size > 1000) for (const [k, arr] of joinHits) if (now - arr[arr.length - 1] > JOIN_WINDOW) joinHits.delete(k);
        if (hits.length > JOIN_LIMIT) {
            if (hits.length === JOIN_LIMIT + 1) logVerify(member.guild, db, 'spam', member.id, { n: hits.length });
            return;
        }

        const lang = langOf(client, gid, null, member.id);
        const code = randomCode(6);
        const kickMins = s.verify_kick_days || 0;
        const kickAt = kickMins > 0 ? now + kickMins * 60000 : 0;
        const pl = await panelLink(member.guild, db, lang);
        // Saved before the DM goes out: a restart right after sending must not leave a code the bot doesn't know
        saveDeadline(db, gid, member.id, kickAt, code);
        let sent = await member.send(captchaCard(member.guild, lang, { code, kickAt, panelId: pl?.id })).then(() => true).catch(() => false);
        // DMs closed and no panel: the system channel, with a ping (the code is checked in DM only)
        if (!sent && !pl && member.guild.systemChannel) {
            sent = await member.guild.systemChannel.send(captchaCard(member.guild, lang, { code, kickAt, mention: member.id })).then(() => true).catch(() => false);
        }
        if (kickAt) armKick(client, db, gid, member.id, kickAt - now);
        else pending.set(`${member.id}:${gid}`, { timer: null });
    },

    onMemberLeave: (member) => {
        forgetDeadline(_vdb, member.guild.id, member.id);
        clearPending(member.guild.id, member.id);
    },

    // The panel in the server: a private captcha, then a form for the code
    onPanelInteraction: async (interaction, client, db) => {
        const guild = interaction.guild;
        if (!guild) return;
        const [, action, nonce] = interaction.customId.split(':');
        const gid = guild.id, uid = interaction.user.id, key = `${uid}:${gid}`;
        const now = Date.now();
        const lang = langOf(client, gid, interaction, uid);
        const isModal = interaction.isModalSubmit?.() === true;
        if (isModal) await interaction.deferReply({ flags: EPH });   // giving the roles can take more than 3 seconds
        const say = (ic, k, v) => {
            const content = `${icon(ic, interaction)} ${T(lang, k, v)}`;
            return isModal ? interaction.editReply({ content }) : interaction.reply({ content, flags: EPH });
        };

        const s = settingsOf(db, gid);
        if (!s.verify_enabled || !isPremium(db, gid)) return say('lock', 'notActive');
        const { vRole, uRole } = rolesOf(guild, s);
        if (!vRole && !uRole) return say('warn', 'notConfigured');
        for (const r of [vRole, uRole]) if (r && validateVerifyRole(guild, r, null)) return say('warn', 'misconfigured');
        const member = await guild.members.fetch(uid).catch(() => null);
        if (!member) return say('no', 'memberNotFound');
        if (vRole ? member.roles.cache.has(vRole.id) : !member.roles.cache.has(uRole.id)) return say('ok', 'alreadyIn');

        const challenge = (attempts, wrong) => {
            const code = randomCode(6);
            const n = crypto.randomBytes(4).toString('hex');
            panelSessions.set(key, { code, attempts, expires: now + PANEL_TTL, nonce: n });
            if (panelSessions.size + panelCooldown.size > 1000) {
                for (const [k, v] of panelSessions) if (v.expires < now) panelSessions.delete(k);
                for (const [k, t] of panelCooldown) if (now - t > PANEL_COOLDOWN) panelCooldown.delete(k);
            }
            const payload = card(COLOR.info, [
                { text: `${wrong ? `-# ${icon('no', interaction)} ${T(lang, 'wrongNew')}\n` : ''}## ${icon('keyboard', interaction)} ${T(lang, 'chTitle')}` },
                { media: ['attachment://verify.png', T(lang, 'altCaptcha')] },
                { text: `-# ${T(lang, 'chHint', { n: attempts + 1, max: MAX_TRIES, when: `<t:${Math.floor((now + PANEL_TTL) / 1000)}:R>` })}` },
                { row: new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`vpanel:enter:${n}`)
                    .setLabel(T(lang, 'btnEnter')).setStyle(ButtonStyle.Primary).setEmoji(icon('keyboard', interaction))) },
            ]);
            payload.files = [new AttachmentBuilder(generateCaptcha(code), { name: 'verify.png' })];
            return payload;
        };

        if (action === 'start') {
            const wait = PANEL_COOLDOWN - (now - (panelCooldown.get(key) || 0));
            if (wait > 0) return say('clock', 'cooldown', { secs: Math.ceil(wait / 1000) });
            panelCooldown.set(key, now);
            return interaction.reply({ ...challenge(0), flags: V2 | EPH });
        }

        const sess = panelSessions.get(key);
        if (!sess || sess.expires < now) { panelSessions.delete(key); return say('clock', 'codeExpired'); }
        if (sess.nonce !== nonce) return say('warn', 'codeOutdated');

        if (action === 'enter') {
            return interaction.showModal(new ModalBuilder().setCustomId(`vpanel:modal:${nonce}`).setTitle(T(lang, 'modalTitle').slice(0, 45))
                .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('code').setLabel(T(lang, 'modalLabel').slice(0, 45))
                    .setStyle(TextInputStyle.Short).setMinLength(6).setMaxLength(6).setRequired(true))));
        }

        if (action === 'modal') {
            const guess = interaction.fields.getTextInputValue('code').trim().toUpperCase();
            if (guess === sess.code) {
                panelSessions.delete(key);
                const err = await letIn(client, db, guild, member, 'passed_panel');
                return interaction.editReply(err ? blockedCard(guild, lang) : inCard(guild, lang));
            }
            const attempts = sess.attempts + 1;
            if (attempts >= MAX_TRIES) {
                panelSessions.delete(key);
                panelCooldown.set(key, now);
                await logVerify(guild, db, 'failed_panel', uid);
                return say('no', 'tooManyPanel');
            }
            return interaction.editReply(challenge(attempts, true));
        }
    },

    // Buttons from the very first version of verification
    onVerifyButton: async (interaction) => {
        const lang = langOf(interaction.client, interaction.guild?.id, interaction, interaction.user.id);
        const pl = interaction.guild && await panelLink(interaction.guild, interaction.client.db, lang);
        return interaction.reply({ content: pl ? T(lang, 'oldBtnPanel', { channel: `<#${pl.id}>` }) : T(lang, 'oldBtnRejoin'), flags: EPH }).catch(() => {});
    },

    // The code typed in DM
    handleDM: async (message, client, db) => {
        if (message.author.bot || !message.channel.isDMBased()) return false;
        let rows = [];
        try { _deadlines(db); rows = db.prepare('SELECT guild_id, code, attempts, kick_at FROM verify_pending WHERE user_id = ?').all(message.author.id); } catch { return false; }
        rows = rows.filter((r) => client.guilds.cache.has(r.guild_id));
        if (!rows.length) return false;

        // Waiting on several servers at once: the code answers the server it belongs to
        const guess = message.content.replace(/\s+/g, '').toUpperCase();
        const row = rows.find((r) => String(r.code || '').toUpperCase() === guess) || rows.slice().sort((a, b) => (b.kick_at || 0) - (a.kick_at || 0))[0];
        const guild = client.guilds.cache.get(row.guild_id);
        if (!guild) return false;
        const lang = langOf(client, guild.id, null, message.author.id);

        if (!/^[A-Z0-9]{6}$/.test(guess)) {
            await message.channel.send(`${icon('info')} ${T(lang, 'dmHint')}`).catch(() => {});
            return true;
        }

        if (guess === String(row.code || '').toUpperCase()) {
            const member = await guild.members.fetch(message.author.id).catch(() => null);
            if (!member) { forgetDeadline(db, guild.id, message.author.id); return true; }
            await message.channel.sendTyping?.().catch(() => {});
            const err = await letIn(client, db, guild, member, 'passed_dm');
            await message.channel.send(err ? blockedCard(guild, lang) : inCard(guild, lang)).catch(() => {});
            return true;
        }

        const attempts = (row.attempts || 0) + 1;
        if (attempts < MAX_TRIES) {
            db.prepare('UPDATE verify_pending SET attempts = ? WHERE guild_id = ? AND user_id = ?').run(attempts, guild.id, message.author.id);
            await message.channel.send(`${icon('no')} ${T(lang, MAX_TRIES - attempts === 1 ? 'dmWrongOne' : 'dmWrong', { n: MAX_TRIES - attempts })}`).catch(() => {});
            return true;
        }

        // Third wrong code: removed when auto-kick is on, else sent to the panel for a new code
        const s = settingsOf(db, guild.id);
        if ((s.verify_kick_days || 0) > 0) {
            await kickUnverified(client, db, guild.id, message.author.id, 'fail');
            return true;
        }
        forgetDeadline(db, guild.id, message.author.id);
        await logVerify(guild, db, 'failed_panel', message.author.id);
        const pl = await panelLink(guild, db, lang);
        await message.channel.send(card(COLOR.warn, [
            { text: `-# ${guild.name}\n## ${icon('user_x')} ${T(lang, 'failTitle', { n: MAX_TRIES })}\n${pl ? T(lang, 'failPanel', { server: guild.name }) : T(lang, 'failNoPanel', { server: guild.name })}` },
            ...(pl ? [{ row: pl.row }] : []),
        ])).catch(() => {});
        return true;
    },
};
