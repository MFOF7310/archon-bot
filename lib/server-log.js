'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — SERVER LOG: what members and staff do, written in the server's log channels
//   msg_delete   a message deleted (author, channel, text, attachments) → the server log channel
//   msg_edit     a message edited (before / after, link to it)          → the server log channel
//   mod_manual   a ban, unban or kick done in Discord itself, not through ARCHON (ARCHON logs its own already)
//                → the moderation log, else the server log channel
// Each kind can be turned off in /channels → Server log (stored in server_settings.log_events, JSON list of the
// kinds that are on; empty column = all on). Nothing is written while the server has no log channel.
// Texts: lang/<l>/serverlog.json. Never throws.
// ═══════════════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent, escapeMarkdown } = require('discord.js');
const { card } = require('./games/v2');
const { t } = require('./i18n');
const { icon } = require('./ui/icons');
const { safeSend } = require('./safeSend');

const KINDS = ['msg_delete', 'msg_edit', 'mod_manual'];
const COLOR = { delete: 0xE74C3C, edit: 0xF0B232, ban: 0xE74C3C, unban: 0x2ECC71, kick: 0xE67E22 };
const L = (k, lang, v) => t(`serverlog.${k}`, lang, v || {});

let columnReady = null;
function ensureColumn(db) {
    if (columnReady === db) return;
    try { db.prepare('ALTER TABLE server_settings ADD COLUMN log_events TEXT').run(); } catch { /* already there */ }
    columnReady = db;
}

/** The kinds that are on for this server (all of them until an admin changes it). */
function enabled(db, guildId) {
    try {
        ensureColumn(db);
        const raw = db.prepare('SELECT log_events FROM server_settings WHERE guild_id = ?').get(guildId)?.log_events;
        if (raw === null || raw === undefined || raw === '') return new Set(KINDS);
        const list = JSON.parse(raw);
        return new Set(Array.isArray(list) ? list.filter((k) => KINDS.includes(k)) : KINDS);
    } catch { return new Set(KINDS); }
}

function setEnabled(db, guildId, list) {
    ensureColumn(db);
    const clean = KINDS.filter((k) => list.includes(k));
    db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(guildId);
    db.prepare('UPDATE server_settings SET log_events = ? WHERE guild_id = ?').run(JSON.stringify(clean), guildId);
    return clean;
}

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

// ── messages ──
// Only messages ARCHON still has in memory (sent since its last restart): for older ones Discord gives no text.
async function onDelete(message, client) {
    try {
        const guild = message.guild;
        if (!guild || message.partial || message.author?.bot || message.system) return;
        const db = client.db;
        if (!enabled(db, guild.id).has('msg_delete')) return;
        const ch = channelOf(guild, db, 'log_channel');
        if (!ch || ch.id === message.channelId) return;
        const lang = langOf(client, guild.id);
        const files = [...(message.attachments?.values?.() || [])].map((a) => a.name).slice(0, 5);
        const items = [
            { text: `### ${icon('trash', ch)} ${L('deleted_title', lang)}\n-# ${L('where', lang, { user: `<@${message.author.id}>`, channel: `<#${message.channelId}>` })} · ${ago()}` },
            { rule: true },
            { text: quote(message.content, lang) },
        ];
        if (files.length) items.push({ text: `-# ${L('attachments', lang, { list: files.map((f) => escapeMarkdown(f)).join(', ') })}` });
        items.push({ text: `-# ${L('ids', lang, { user: message.author.id, message: message.id })}` });
        await send('serverlog', ch, card(COLOR.delete, items));
    } catch (e) { console.error('[SERVERLOG] delete:', e.message); }
}

async function onEdit(before, after, client) {
    try {
        const guild = after.guild;
        if (!guild || before.partial || after.author?.bot) return;
        if ((before.content || '') === (after.content || '')) return;   // an embed or a pin changed, not the text
        const db = client.db;
        if (!enabled(db, guild.id).has('msg_edit')) return;
        const ch = channelOf(guild, db, 'log_channel');
        if (!ch || ch.id === after.channelId) return;
        const lang = langOf(client, guild.id);
        await send('serverlog', ch, card(COLOR.edit, [
            { text: `### ${icon('edit', ch)} ${L('edited_title', lang)}\n-# ${L('where', lang, { user: `<@${after.author.id}>`, channel: `<#${after.channelId}>` })} · ${ago()}` },
            { rule: true },
            { text: `**${L('before', lang)}**\n${quote(before.content, lang, 900)}` },
            { text: `**${L('after', lang)}**\n${quote(after.content, lang, 900)}` },
            { text: `-# ${L('ids', lang, { user: after.author.id, message: after.id })}` },
            { row: new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(after.url).setLabel(L('jump', lang)).setEmoji(icon('link', ch))) },
        ]));
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

module.exports = { KINDS, enabled, setEnabled, onDelete, onEdit, onAudit };
