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
// Never throws: the journal must never stop a message from going out.
// ═══════════════════════════════════════════════════════════════════════════
const canPost = require('./canPost');
const i18n = require('./i18n');

const DAY = 24 * 60 * 60 * 1000;
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

function alertCard(guild, row, lang, where) {
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
    let cmd = '`/postcheck`';
    try { cmd = require('./mentions')(client, 'postcheck'); } catch {}
    const footer = where === 'dm' ? T('alertFooterDm', { guild: guild.name, cmd }) : T('alertFooterLog', { cmd });
    return card(0xF0B232, [
        { text: `### ${T('alertTitle', { feature: label(row.feature, lang) })}\n${whereLine}` },
        { rule: true },
        { text: `${T(canPost.keyFor('why', row.reason), vars)}\n\n${T(canPost.keyFor('fix', row.reason), vars)}` },
        { rule: true },
        { text: `-# ${footer}` },
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
        const msg = await ch.send(alertCard(guild, row, pickLang(client, guild.id), 'log')).catch(() => null);
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

module.exports = { failed, sent, fromCheck, list, label, alertCard, _reset: () => { madeIn = null; open.clear(); alertsSent.clear(); } };
