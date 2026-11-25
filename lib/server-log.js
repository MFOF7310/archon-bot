'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — SERVER LOG: what members and staff do, written in the server's log channels
//   msg_delete   a message deleted (author, channel, text, attachments) → the server log channel
//   msg_edit     a message edited (before / after, link to it)          → the server log channel
//   mod_manual   a ban, unban or kick done in Discord itself, not through ARCHON (ARCHON logs its own already)
//                → the moderation log, else the server log channel
// Settings, in /channels → Server log (server_settings, columns added on first use):
//   log_events   JSON list of the kinds that are on (empty column = all on)
//   log_ignore   JSON list of channel ids whose messages are not followed (threads follow their parent)
// Against floods:
//   - messages ARCHON deletes itself (AutoMod, clean-ups…) are skipped: they have their own logs
//   - deletes or edits by one member in one channel are grouped: one card once they stop for 10 s (30 s at most)
//   - a purge is one bulk event, which this log does not follow
// Nothing is written while the server has no log channel. Texts: lang/<l>/serverlog.json. Never throws.
// ═══════════════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent, escapeMarkdown, Message, MessageManager } = require('discord.js');
const { card } = require('./games/v2');
const { t } = require('./i18n');
const { icon } = require('./ui/icons');
const { safeSend } = require('./safeSend');

const KINDS = ['msg_delete', 'msg_edit', 'mod_manual'];
const COLOR = { delete: 0xE74C3C, edit: 0xF0B232, ban: 0xE74C3C, unban: 0x2ECC71, kick: 0xE67E22 };
const QUIET_MS = 10_000, MAX_WAIT_MS = 30_000, SHOWN = 3;
const L = (k, lang, v) => t(`serverlog.${k}`, lang, v || {});

// ── settings ──
let columnsReady = null;
function ensureColumns(db) {
    if (columnsReady === db) return;
    for (const col of ['log_events', 'log_ignore']) {
        try { db.prepare(`ALTER TABLE server_settings ADD COLUMN ${col} TEXT`).run(); } catch { /* already there */ }
    }
    columnsReady = db;
}
function readList(db, guildId, col) {
    try {
        ensureColumns(db);
        const raw = db.prepare(`SELECT ${col} AS v FROM server_settings WHERE guild_id = ?`).get(guildId)?.v;
        if (raw === null || raw === undefined || raw === '') return null;
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list.map(String) : null;
    } catch { return null; }
}
function writeList(db, guildId, col, list) {
    ensureColumns(db);
    db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(guildId);
    db.prepare(`UPDATE server_settings SET ${col} = ? WHERE guild_id = ?`).run(JSON.stringify(list), guildId);
    return list;
}

/** The kinds that are on for this server (all of them until an admin changes it). */
function enabled(db, guildId) {
    const list = readList(db, guildId, 'log_events');
    return new Set(list ? list.filter((k) => KINDS.includes(k)) : KINDS);
}
function setEnabled(db, guildId, list) { return writeList(db, guildId, 'log_events', KINDS.filter((k) => list.includes(k))); }

/** Channel ids the log does not follow. */
function ignored(db, guildId) { return readList(db, guildId, 'log_ignore') || []; }
function setIgnored(db, guildId, ids) { return writeList(db, guildId, 'log_ignore', [...new Set(ids.map(String))].slice(0, 25)); }

const isIgnored = (db, message) => {
    const list = ignored(db, message.guild.id);
    return list.includes(message.channelId) || (message.channel?.parentId && message.channel.isThread?.() && list.includes(message.channel.parentId));
};

// ── messages ARCHON deletes itself ──
// Every delete in ARCHON goes through Message#delete or MessageManager#delete: remember those ids for a minute,
// so the "message deleted" log skips them (AutoMod, verification, clean-ups have their own logs).
const ownDeletes = new Map();   // message id → when
function markOwn(id) {
    if (!id) return;
    const now = Date.now();
    ownDeletes.set(String(id), now);
    if (ownDeletes.size > 500) for (const [k, at] of ownDeletes) if (now - at > 60_000) ownDeletes.delete(k);
}
if (!Message.prototype.__archonLogPatched) {
    const msgDelete = Message.prototype.delete;
    Message.prototype.delete = function (...args) { markOwn(this.id); return msgDelete.apply(this, args); };
    const mgrDelete = MessageManager.prototype.delete;
    MessageManager.prototype.delete = function (message, ...args) { markOwn(typeof message === 'string' ? message : message?.id); return mgrDelete.call(this, message, ...args); };
    Message.prototype.__archonLogPatched = true;
}
const deletedByArchon = (id) => { const at = ownDeletes.get(String(id)); if (at) ownDeletes.delete(String(id)); return !!at; };

// ── helpers ──
function langOf(client, guildId) {
    try { return require('./pick-lang').pickLang(client, guildId); } catch { return 'en'; }
}
function channelOf(guild, db, col) {
    try {
        const id = db.prepare(`SELECT ${col} AS id FROM server_settings WHERE guild_id = ?`).get(guild.id)?.id;
        const ch = id ? guild.channels.cache.get(String(id)) : null;
        return ch?.isTextBased?.() ? ch : null;
    } catch { return null; }
}
// Message text inside a quote: markdown escaped (no fake headings or links), capped, never empty
function quote(text, lang, max = 1000) {
    const s = String(text || '').trim();
    if (!s) return `> -# ${L('empty', lang)}`;
    const cut = s.length > max ? s.slice(0, max - 1) + '…' : s;
    return escapeMarkdown(cut).split('\n').map((l) => `> ${l}`).join('\n');
}
const ago = () => `<t:${Math.floor(Date.now() / 1000)}:R>`;
const send = (feature, ch, payload) => safeSend(feature, ch, { ...payload, allowedMentions: { parse: [] } });

// ── grouping: one card per member, channel and kind once they stop for a moment ──
const pending = new Map();   // key → { kind, guild, channelId, userId, items: [], first, timer }
function queue(client, kind, guild, channelId, userId, item) {
    const key = `${guild.id}:${channelId}:${userId}:${kind}`;
    let g = pending.get(key);
    if (!g) { g = { kind, guild, channelId, userId, items: [], first: Date.now(), timer: null }; pending.set(key, g); }
    g.items.push(item);
    clearTimeout(g.timer);
    const wait = Math.max(0, Math.min(QUIET_MS, g.first + MAX_WAIT_MS - Date.now()));
    g.timer = setTimeout(() => { pending.delete(key); flush(client, g).catch((e) => console.error('[SERVERLOG] flush:', e.message)); }, wait);
    g.timer.unref?.();
}

async function flush(client, g) {
    const db = client.db;
    const ch = channelOf(g.guild, db, 'log_channel');
    if (!ch) return;
    const lang = langOf(client, g.guild.id);
    const n = g.items.length;
    const where = L('where', lang, { user: `<@${g.userId}>`, channel: `<#${g.channelId}>` });
    const seconds = Math.max(1, Math.round((Date.now() - g.first) / 1000));
    const sub = n > 1 ? `${where} · ${L('within', lang, { s: seconds })}` : `${where} · ${ago()}`;
    const last = g.items[n - 1];
    const more = n > SHOWN ? [{ text: `-# ${L('more', lang, { n: n - SHOWN })}` }] : [];
    const ids = { text: `-# ${n > 1 ? L('user_id', lang, { id: g.userId }) : L('ids', lang, { user: g.userId, message: last.id })}` };

    if (g.kind === 'delete') {
        const body = g.items.slice(-SHOWN).map((it) => {
            const files = it.files.length ? `\n-# ${L('attachments', lang, { list: it.files.map((f) => escapeMarkdown(f)).join(', ') })}` : '';
            return quote(it.content, lang, n > 1 ? 300 : 1000) + files;
        }).join('\n');
        const title = n > 1 ? L('deleted_many', lang, { n }) : L('deleted_title', lang);
        return send('serverlog', ch, card(COLOR.delete, [
            { text: `### ${icon('trash', ch)} ${title}\n-# ${sub}` }, { rule: true }, { text: body }, ...more, ids,
        ]));
    }
    // edits: before → after for each, the button goes to the last edited message
    const blocks = n > 1
        ? [{ text: g.items.slice(-SHOWN).map((it) => `${quote(it.before, lang, 200)}\n${icon('next', ch)} ${escapeMarkdown(String(it.after || '').trim().slice(0, 200)) || `-# ${L('empty', lang)}`}`).join('\n\n') }]
        : [{ text: `**${L('before', lang)}**\n${quote(last.before, lang, 900)}` }, { text: `**${L('after', lang)}**\n${quote(last.after, lang, 900)}` }];
    const title = n > 1 ? L('edited_many', lang, { n }) : L('edited_title', lang);
    return send('serverlog', ch, card(COLOR.edit, [
        { text: `### ${icon('edit', ch)} ${title}\n-# ${sub}` }, { rule: true }, ...blocks, ...more, ids,
        { row: new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(last.url).setLabel(L('jump', lang)).setEmoji(icon('link', ch))) },
    ]));
}

// ── message events ──
// Only messages ARCHON still has in memory (sent since its last restart): for older ones Discord gives no text.
function onDelete(message, client) {
    try {
        const guild = message.guild;
        if (deletedByArchon(message.id)) return;
        if (!guild || message.partial || message.author?.bot || message.system) return;
        const db = client.db;
        if (!enabled(db, guild.id).has('msg_delete') || isIgnored(db, message)) return;
        const ch = channelOf(guild, db, 'log_channel');
        if (!ch || ch.id === message.channelId) return;
        queue(client, 'delete', guild, message.channelId, message.author.id, {
            id: message.id, content: message.content, files: [...(message.attachments?.values?.() || [])].map((a) => a.name).slice(0, 5),
        });
    } catch (e) { console.error('[SERVERLOG] delete:', e.message); }
}

function onEdit(before, after, client) {
    try {
        const guild = after.guild;
        if (!guild || before.partial || after.author?.bot) return;
        if ((before.content || '') === (after.content || '')) return;   // an embed or a pin changed, not the text
        const db = client.db;
        if (!enabled(db, guild.id).has('msg_edit') || isIgnored(db, after)) return;
        const ch = channelOf(guild, db, 'log_channel');
        if (!ch || ch.id === after.channelId) return;
        queue(client, 'edit', guild, after.channelId, after.author.id, { id: after.id, before: before.content, after: after.content, url: after.url });
    } catch (e) { console.error('[SERVERLOG] edit:', e.message); }
}

// ── bans, unbans and kicks done in Discord itself ──
// Discord's audit log says who did it. Actions by ARCHON are skipped: its moderation commands log them already.
const MOD = {
    [AuditLogEvent.MemberBanAdd]: { key: 'ban', icon: 'gavel' },
    [AuditLogEvent.MemberBanRemove]: { key: 'unban', icon: 'user_check' },
    [AuditLogEvent.MemberKick]: { key: 'kick', icon: 'user_x' },
};

async function onAudit(entry, guild, client) {
    try {
        const kind = MOD[entry.action];
        if (!kind || !guild || entry.executorId === client.user.id) return;
        const db = client.db;
        if (!enabled(db, guild.id).has('mod_manual')) return;
        const ch = channelOf(guild, db, 'mod_log_channel') || channelOf(guild, db, 'log_channel');
        if (!ch) return;
        const lang = langOf(client, guild.id);
        const reason = entry.reason ? escapeMarkdown(String(entry.reason).slice(0, 500)) : L('no_reason', lang);
        await send('modlog', ch, card(COLOR[kind.key], [
            { text: `### ${icon(kind.icon, ch)} ${L(`${kind.key}_title`, lang)}\n-# <@${entry.targetId}> · ${ago()}` },
            { rule: true },
            { text: `${L('by', lang, { mod: entry.executorId ? `<@${entry.executorId}>` : L('someone', lang) })}\n${L('reason', lang, { reason })}` },
            { text: `-# ${L('by_hand', lang)} · ${L('user_id', lang, { id: entry.targetId })}` },
        ]));
    } catch (e) { console.error('[SERVERLOG] audit:', e.message); }
}

module.exports = { KINDS, enabled, setEnabled, ignored, setIgnored, onDelete, onEdit, onAudit };
