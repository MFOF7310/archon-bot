'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — A ROLE DELETED IN DISCORD LEAVES ARCHON'S SETTINGS TOO
// Without this, a deleted role kept its place: /roles showed it as deleted, "Create missing roles" in some places
// didn't count it, and the admin had to clear each one by hand (one mod-log line each).
//   onDelete(role, client)  the slots that held this role are emptied; one mod-log card per burst of deletions
//   sweep(client)           at start-up: slots holding roles that no longer exist are emptied (quietly, one console line)
// The verification roles are left alone: /verify has its own checks and fixes for them.
// ═══════════════════════════════════════════════════════════════════════════
const R = require('./role-rules');

const SLOT_COLS = R.SLOTS.map((s) => s.col);
// old columns nothing reads any more (or only as a fallback): emptied too, never logged
const LEGACY_COLS = ['member_role', 'auto_role_id', 'mute_role_id', 'gamer_role'];
const KEY_OF = Object.fromEntries(R.SLOTS.map((s) => [s.col, s.key]));

function existingCols(db) {
    try {
        const have = new Set(db.prepare('PRAGMA table_info(server_settings)').all().map((c) => c.name));
        return [...SLOT_COLS, ...LEGACY_COLS].filter((c) => have.has(c));
    } catch { return []; }
}

// Empties every column of this server that holds one of these role ids. Returns [{ col, id }] that were emptied.
function clear(client, guildId, ids) {
    const db = client.db;
    const want = new Set(ids.map(String));
    const cols = existingCols(db);
    if (!cols.length || !want.size) return [];
    let row;
    try { row = db.prepare(`SELECT ${cols.join(', ')} FROM server_settings WHERE guild_id = ?`).get(String(guildId)); } catch { return []; }
    if (!row) return [];
    const hit = cols.filter((c) => row[c] && want.has(String(row[c]))).map((c) => ({ col: c, id: String(row[c]) }));
    if (!hit.length) return [];
    try {
        db.prepare(`UPDATE server_settings SET ${hit.map((h) => `${h.col} = NULL`).join(', ')} WHERE guild_id = ?`).run(String(guildId));
    } catch (e) { console.error(`[ROLES] cleanup guild=${guildId}:`, e.message); return []; }
    try { client.settings?.delete?.(String(guildId)); client.invalidateGuildCache?.(String(guildId)); } catch { /* reloads on next read */ }
    return hit;
}

// Deleting several roles in a row makes one card, not one per role
const pending = new Map();   // guildId -> { names: Map(col -> role name), timer }
const BURST_MS = 5000;

function onDelete(role, client) {
    const guild = role?.guild;
    if (!guild || !client?.db) return;
    const hit = clear(client, guild.id, [role.id]);
    const logged = hit.filter((h) => KEY_OF[h.col]);
    if (!logged.length) return;
    console.log(`[ROLES] guild=${guild.id} role "${role.name}" deleted in Discord: removed from ${logged.map((h) => h.col).join(', ')}`);
    const p = pending.get(guild.id) || { names: new Map(), timer: null };
    for (const h of logged) p.names.set(h.col, role.name);
    clearTimeout(p.timer);
    p.timer = setTimeout(() => { pending.delete(guild.id); report(guild, client, p.names).catch(() => {}); }, BURST_MS);
    pending.set(guild.id, p);
}

async function report(guild, client, names) {
    const ch = require('./modlog').resolveModLog(guild, client.db);
    if (!ch) return;
    const { t } = require('./i18n');
    let lang = 'en';
    try { lang = require('./pick-lang').pickLang(client, guild.id, null); } catch { /* English */ }
    if (!['en', 'fr', 'zh', 'ar'].includes(lang)) lang = 'en';
    const clean = (s) => String(s || '?').replace(/[*_~`|>\\]/g, '');
    const lines = [...names].map(([col, name]) => `**${t(`roles.labels.${KEY_OF[col]}`, lang)}** · ~~${clean(name)}~~ → ${t('roles.not_set', lang)}`);
    const { EmbedBuilder } = require('discord.js');
    let cmd = '/roles';
    try { cmd = require('./cmd').slash(client, 'roles', { guild }); } catch { /* plain text */ }
    await ch.send({
        embeds: [new EmbedBuilder().setColor(0x5b6b7c).setTitle(t('roles.gone_title', lang))
            .setDescription(`${lines.join('\n')}\n\n${t('roles.gone_hint', lang, { cmd })}`).setTimestamp()],
        allowedMentions: { parse: [] },
    }).catch((e) => console.error(`[ROLES] mod-log guild=${guild.id}:`, e.message));
}

// Start-up: roles deleted while ARCHON was offline (or before this existed). Quiet: no mod-log card.
function sweep(client) {
    let n = 0;
    for (const guild of client.guilds.cache.values()) {
        if (!guild.roles?.cache?.size) continue;
        const cols = existingCols(client.db);
        let row;
        try { row = client.db.prepare(`SELECT ${cols.join(', ')} FROM server_settings WHERE guild_id = ?`).get(guild.id); } catch { continue; }
        if (!row) continue;
        const gone = cols.map((c) => row[c]).filter((id) => id && /^\d{17,20}$/.test(String(id)) && !guild.roles.cache.has(String(id)));
        if (gone.length) n += clear(client, guild.id, gone).length;
    }
    if (n) console.log(`[ROLES] start-up: ${n} setting(s) pointed at roles deleted in Discord, now empty`);
}

module.exports = { onDelete, sweep, clear };
