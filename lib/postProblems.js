'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — POST PROBLEMS: what ARCHON could not post, and who has been told
// One row per (server, feature): the channel, why, since when, how many times. The next successful post removes it.
// The admins hear about it at most once a day per feature, and at most three times a day per server whatever breaks:
// in the server's log channel when ARCHON can post there, else in a DM to the owner. The dashboard reads the same rows.
//   failed(guild, feature, channelId, diagnosis, code?, opts?)  record it and maybe tell the admins (opts.quiet: record nothing)
//   sent(guild, feature)                                       a real success: remove the row
//   fromCheck(guild, channel, feature, diagnosis)              for canPost.log(): record a failed check, clear a passed one
//   list(db, guildId)                                          the rows, for the dashboard health route
//   handleButton(interaction, client)                          the alert's "Check again" and "Mute for 7 days" buttons
// Never throws: the journal must never stop a message from going out.
// ═══════════════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const canPost = require('./canPost');
const i18n = require('./i18n');
const { icon } = require('./icons');

const DAY = 24 * 60 * 60 * 1000;
const MUTE_MS = 7 * DAY;             // "Mute for 7 days" on an alert
const KEEP_MS = 14 * DAY;            // a row nobody touched for two weeks is dropped (the feature was probably switched off)
const ALERTS_PER_SERVER_PER_DAY = 3;
const IGNORE = new Set(['broadcast']); // the bot owner's announcements to every server are not a server admin's business

let madeIn = null;                   // the database the table was made in
const open = new Set();              // `${guildId}|${feature}` rows that exist, so a success costs nothing when all is well
const alertsSent = new Map();        // guildId -> times an alert went out in the last day (this process)

const dbOf = (guild) => (guild?.client || global.client)?.db || null;
const clientOf = (guild) => guild?.client || global.client || null;
const parse = (s) => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

function ready(db) {
    if (!db) return false;
    if (madeIn === db) return true;
    db.prepare(`CREATE TABLE IF NOT EXISTS post_problems (
        guild_id TEXT NOT NULL,
        feature TEXT NOT NULL,
        channel_id TEXT,
        reason TEXT NOT NULL,
        missing TEXT,
        role TEXT,
        code INTEGER,
        first_at INTEGER NOT NULL,
        last_at INTEGER NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        alerted_at INTEGER,
        muted_until INTEGER,
        PRIMARY KEY (guild_id, feature)
    )`).run();
    db.prepare('DELETE FROM post_problems WHERE last_at < ?').run(Date.now() - KEEP_MS);
    open.clear();
    for (const r of db.prepare('SELECT guild_id, feature FROM post_problems').all()) open.add(r.guild_id + '|' + r.feature);
    madeIn = db;
    return true;
}

// Same channel as before: one more failure. Another channel: a fresh problem (count, first time and alert start over).
function record(db, guildId, feature, channelId, d, code) {
    const now = Date.now();
    db.prepare(`INSERT INTO post_problems (guild_id, feature, channel_id, reason, missing, role, code, first_at, last_at, count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(guild_id, feature) DO UPDATE SET
            first_at   = CASE WHEN post_problems.channel_id IS excluded.channel_id THEN post_problems.first_at ELSE excluded.first_at END,
            count      = CASE WHEN post_problems.channel_id IS excluded.channel_id THEN post_problems.count + 1 ELSE 1 END,
            alerted_at = CASE WHEN post_problems.channel_id IS excluded.channel_id THEN post_problems.alerted_at ELSE NULL END,
            channel_id = excluded.channel_id, reason = excluded.reason, missing = excluded.missing,
            role = excluded.role, code = excluded.code, last_at = excluded.last_at`)
        .run(guildId, feature, channelId ? String(channelId) : null, String(d.reason || 'refused'),
            JSON.stringify(d.missing || []), d.role || null, typeof code === 'number' ? code : null, now, now);
    open.add(guildId + '|' + feature);
    return db.prepare('SELECT * FROM post_problems WHERE guild_id = ? AND feature = ?').get(guildId, feature);
}

// ─── the alert card ───
function label(feature, lang) {
    const key = 'postcheck.features.' + feature;
    const s = i18n.t(key, lang);
    return s === key ? i18n.t('postcheck.features.other', lang) : s;
}

// The website address: DASHBOARD_URL in .env if set, otherwise the current domain (as plugins/dashboard.js).
const dashboardUrl = (guildId) => `${(process.env.DASHBOARD_URL || 'https://bamako-steel-dev.xyz').replace(/\/+$/, '')}/dashboard/${guildId}`;

// Check again · Mute for 7 days · Dashboard. Standard icons only: a custom emoji Discord cannot use would refuse the whole card.
function alertButtons(guildId, feature, lang, { check = true, mute = true } = {}) {
    const T = (k) => i18n.t('postcheck.' + k, lang);
    const row = new ActionRowBuilder();
    if (check) row.addComponents(new ButtonBuilder().setCustomId(`pp:check:${guildId}:${feature}`).setLabel(T('alertBtnCheck')).setEmoji('🔄').setStyle(ButtonStyle.Secondary));
    if (mute) row.addComponents(new ButtonBuilder().setCustomId(`pp:mute:${guildId}:${feature}`).setLabel(T('alertBtnMute')).setEmoji('🔕').setStyle(ButtonStyle.Secondary));
    row.addComponents(new ButtonBuilder().setURL(dashboardUrl(guildId)).setLabel(T('alertBtnDashboard')).setEmoji('🌐').setStyle(ButtonStyle.Link));
    return row;
}

// where: 'log' (a server channel) or 'dm' (the owner's DMs). place: the channel or interaction it is shown in (null in a DM),
// so ARCHON's own icons are used only where it may use them.
function alertCard(guild, row, lang, where, note = null, place = null) {
    const { card } = require('./games/v2');
    const client = clientOf(guild);
    const T = (k, v) => i18n.t('postcheck.' + k, lang, v);
    const me = guild.members?.me;
    const bot = me?.roles?.botRole?.name || me?.displayName || 'ARCHON';
    const channel = row.channel_id ? `<#${row.channel_id}>` : T('alertNoChannel');
    const vars = { channel, bot, perms: canPost.localize(parse(row.missing), lang).join(', '), role: row.role || T('someRole') };
    const since = Math.floor(Number(row.first_at) / 1000);
    const whereLine = Number(row.count) > 1
        ? T('alertWhere', { channel, count: row.count, since: `<t:${since}:f>` })
        : T('alertWhereOne', { channel, since: `<t:${since}:R>` });
    // a clickable /postcheck on the server; in a DM it could not be run, so it stays plain there
    const cmd = where === 'dm' ? '`/postcheck`' : require('./cmd').slash(client, 'postcheck', { guild });
    const footer = where === 'dm' ? T('alertFooterDm', { guild: guild.name, cmd }) : T('alertFooterLog', { cmd });
    const muted = row.muted_until && Number(row.muted_until) > Date.now();
    return card(0xF0B232, [
        { text: `### ${icon('warn', place)} ${T('alertTitle', { feature: label(row.feature, lang) })}\n${whereLine}` },
        { rule: true },
        { text: `${T(canPost.keyFor('why', row.reason), vars)}\n\n${T(canPost.keyFor('fix', row.reason), vars)}` },
        ...(note ? [{ text: note }] : []),
        { rule: true },
        { text: `-# ${footer}` },
        { row: alertButtons(guild.id, row.feature, lang, { mute: !muted }) },
    ]);
}

// After "Check again" finds nothing wrong any more (or a real post already cleared it).
function fixedCard(guild, feature, channelId, lang, place = null) {
    const { card } = require('./games/v2');
    const T = (k, v) => i18n.t('postcheck.' + k, lang, v);
    const channel = channelId ? `<#${channelId}>` : T('alertNoChannel');
    return card(0x2ECC71, [
        { text: `### ${icon('ok', place)} ${T('alertFixed', { feature: label(feature, lang), channel })}\n${T('alertFixedLine', { when: `<t:${Math.floor(Date.now() / 1000)}:R>` })}` },
        { row: alertButtons(guild.id, feature, lang, { check: false, mute: false }) },
    ]);
}

// The server's log channels first (never the broken channel itself), then the owner's DMs. Returns where it went, or null.
async function deliver(guild, row) {
    const client = clientOf(guild);
    const { pickLang } = require('./pick-lang');
    const ss = client?.getServerSettings?.(guild.id) || {};
    const ids = [ss.logChannel || ss.log_channel, ss.modLogChannel || ss.mod_log_channel].filter(Boolean).map(String);
    for (const id of [...new Set(ids)]) {
        if (id === String(row.channel_id)) continue;
        const ch = guild.channels?.cache?.get(id);
        if (!ch || !canPost.diagnose(guild, ch, guild.members?.me, [canPost.PERMS.view, canPost.PERMS.send]).ok) continue;
        const msg = await ch.send(alertCard(guild, row, pickLang(client, guild.id), 'log', null, ch)).catch(() => null);
        if (msg) return 'log';
    }
    const owner = typeof guild.fetchOwner === 'function' ? await guild.fetchOwner().catch(() => null) : null;
    if (owner && typeof owner.send === 'function') {
        const msg = await owner.send(alertCard(guild, row, pickLang(client, guild.id, null, owner.id), 'dm')).catch(() => null);
        if (msg) return 'dm';
    }
    return null;
}

async function maybeAlert(db, guild, row) {
    const now = Date.now();
    if (row.muted_until && Number(row.muted_until) > now) return null;
    if (row.alerted_at && now - Number(row.alerted_at) < DAY) return null;
    const recent = (alertsSent.get(guild.id) || []).filter((t) => now - t < DAY);
    if (recent.length >= ALERTS_PER_SERVER_PER_DAY) return null;
    // claimed before sending, so two failures at the same moment never send two alerts;
    // if nobody can be told (no usable log channel, closed DMs), the next try is tomorrow and the dashboard still shows it
    db.prepare('UPDATE post_problems SET alerted_at = ? WHERE guild_id = ? AND feature = ?').run(now, guild.id, row.feature);
    recent.push(now);
    alertsSent.set(guild.id, recent);
    return deliver(guild, row);
}

// ─── public ───
function failed(guild, feature, channelId, d, code = null, opts = {}) {
    try {
        if (!guild?.id || !feature || IGNORE.has(feature) || opts.quiet) return null;
        const db = dbOf(guild);
        if (!ready(db)) return null;
        const row = record(db, guild.id, feature, channelId, d || {}, code);
        if (row && opts.alert !== false) {
            maybeAlert(db, guild, row).catch((e) => console.error('[postProblems] alert:', e.message));
        }
        return row;
    } catch (e) {
        console.error('[postProblems]', e.message);
        return null;
    }
}

function sent(guild, feature) {
    try {
        const db = dbOf(guild);
        if (!guild?.id || !ready(db)) return false;
        const k = guild.id + '|' + feature;
        if (!open.has(k)) return false;
        db.prepare('DELETE FROM post_problems WHERE guild_id = ? AND feature = ?').run(guild.id, feature);
        open.delete(k);
        return true;
    } catch (e) {
        console.error('[postProblems]', e.message);
        return false;
    }
}

function fromCheck(guild, channel, feature, d) {
    if (IGNORE.has(feature)) return;
    if (d?.ok) { if (!d.unverified) sent(guild, feature); return; }
    failed(guild, feature, channel?.id || null, d);
}

function list(db, guildId) {
    try {
        if (!ready(db)) return [];
        return db.prepare('SELECT * FROM post_problems WHERE guild_id = ? ORDER BY last_at DESC').all(String(guildId)).map((r) => ({
            feature: r.feature, channelId: r.channel_id, reason: r.reason, missing: parse(r.missing), role: r.role, code: r.code,
            firstAt: r.first_at, lastAt: r.last_at, count: r.count, alertedAt: r.alerted_at,
        }));
    } catch (e) {
        console.error('[postProblems]', e.message);
        return [];
    }
}

// For the commands that set a channel: '' when ARCHON can post there for that feature,
// else one short paragraph to add under the confirmation ("Saved, but I can't post there yet", why, how to fix it).
// where: the message or interaction the confirmation is shown in (for the icon).
function setupWarning(guild, channel, feature, lang, where = null) {
    try {
        const d = canPost.diagnose(guild, channel, guild?.members?.me, canPost.neededFor(feature));
        if (d.ok) return '';
        const me = guild.members?.me;
        const T = (k, v) => i18n.t('postcheck.' + k, lang, v);
        const vars = { channel: channel ? `<#${channel.id}>` : T('alertNoChannel'), bot: me?.roles?.botRole?.name || me?.displayName || 'ARCHON',
            perms: canPost.localize(d.missing || [], lang).join(', '), role: d.role || T('someRole') };
        return `${icon('warn', where || channel)} ${T('setWarn', vars)}\n${T(canPost.keyFor('why', d.reason), vars)}\n${T(canPost.keyFor('fix', d.reason), vars)}`;
    } catch (e) {
        console.error('[postProblems] setupWarning:', e.message);
        return '';
    }
}

// The alert's buttons: pp:check:<guildId>:<feature> and pp:mute:<guildId>:<feature>.
// They also work from the owner's DMs, so the server is in the id. Only the owner or a member with Manage Server may use them.
async function handleButton(i, client) {
    const parts = String(i.customId || '').split(':');
    const action = parts[1], guildId = parts[2], feature = parts.slice(3).join(':');
    const { pickLang } = require('./pick-lang');
    const lang = pickLang(client, guildId, i, i.user?.id);
    const T = (k, v) => i18n.t('postcheck.' + k, lang, v);
    const say = (key) => i.reply({ content: T(key), flags: 64 }).catch(() => {});
    const guild = client.guilds?.cache?.get(guildId);
    if (!guild || !feature) return say('alertGuildGone');
    let allowed = i.user?.id === guild.ownerId;
    if (!allowed) {
        const m = await guild.members.fetch(i.user.id).catch(() => null);
        allowed = !!m?.permissions?.has?.(PermissionFlagsBits.ManageGuild);
    }
    if (!allowed) return say('alertAdminsOnly');
    const db = client.db;
    if (!ready(db)) return say('alertUnavailable');
    const where = i.guildId ? 'log' : 'dm';
    const place = i.guildId ? i : null;
    const now = Date.now();
    const row = db.prepare('SELECT * FROM post_problems WHERE guild_id = ? AND feature = ?').get(guildId, feature);
    if (!row) return i.update(fixedCard(guild, feature, null, lang, place)).catch(() => {});

    if (action === 'mute') {
        db.prepare('UPDATE post_problems SET muted_until = ? WHERE guild_id = ? AND feature = ?').run(now + MUTE_MS, guildId, feature);
        return i.update(alertCard(guild, { ...row, muted_until: now + MUTE_MS }, lang, where, `${icon('muted', place)} ${T('alertMuted')}`, place)).catch(() => {});
    }
    // check again with the rules of that feature; a passing check clears it (a real post confirms it later)
    const ch = row.channel_id ? guild.channels?.cache?.get(String(row.channel_id)) : null;
    const d = canPost.diagnose(guild, ch, guild.members?.me, canPost.neededFor(feature));
    if (d.ok) {
        sent(guild, feature);
        return i.update(fixedCard(guild, feature, row.channel_id, lang, place)).catch(() => {});
    }
    db.prepare('UPDATE post_problems SET reason = ?, missing = ?, role = ? WHERE guild_id = ? AND feature = ?')
        .run(d.reason, JSON.stringify(d.missing || []), d.role || null, guildId, feature);
    const fresh = { ...row, reason: d.reason, missing: JSON.stringify(d.missing || []), role: d.role || null };
    return i.update(alertCard(guild, fresh, lang, where, `${icon('no', place)} ${T('alertStill', { when: `<t:${Math.floor(now / 1000)}:R>` })}`, place)).catch(() => {});
}

module.exports = { failed, sent, fromCheck, list, label, alertCard, fixedCard, handleButton, setupWarning, dashboardUrl, _reset: () => { madeIn = null; open.clear(); alertsSent.clear(); } };
