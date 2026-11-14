'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — A CHANNEL DELETED IN DISCORD LEAVES ARCHON'S SETTINGS TOO (same idea as lib/role-cleanup)
//   onDelete(channel, client)  the settings that pointed at it are emptied; one mod-log card per burst of deletions
//   sweep(client)              at start-up: settings pointing at channels Discord says no longer exist are emptied
// Every column of server_settings whose name ends in _channel or _channel_id is covered.
// ═══════════════════════════════════════════════════════════════════════════

function channelCols(db) {
    try { return db.prepare('PRAGMA table_info(server_settings)').all().map((c) => c.name).filter((n) => /_channel(_id)?$/.test(n)); }
    catch { return []; }
}

// Empties every channel column of this server that holds one of these ids. Returns [{ col, id }].
function clear(client, guildId, ids) {
    const db = client.db;
    const want = new Set(ids.map(String));
    const cols = channelCols(db);
    if (!cols.length || !want.size) return [];
    let row;
    try { row = db.prepare(`SELECT ${cols.join(', ')} FROM server_settings WHERE guild_id = ?`).get(String(guildId)); } catch { return []; }
    if (!row) return [];
    const hit = cols.filter((c) => row[c] && want.has(String(row[c]))).map((c) => ({ col: c, id: String(row[c]) }));
    if (!hit.length) return [];
    try { db.prepare(`UPDATE server_settings SET ${hit.map((h) => `${h.col} = NULL`).join(', ')} WHERE guild_id = ?`).run(String(guildId)); }
    catch (e) { console.error(`[CHANNELS] cleanup guild=${guildId}:`, e.message); return []; }
    try { client.settings?.delete?.(String(guildId)); client.invalidateGuildCache?.(String(guildId)); } catch { /* reloads on next read */ }
    return hit;
}

const pending = new Map();   // guildId -> { names: Map(col -> channel name), timer }
const BURST_MS = 5000;

function onDelete(channel, client) {
    const guild = channel?.guild;
    if (!guild || !client?.db) return;
    const hit = clear(client, guild.id, [channel.id]);
    if (!hit.length) return;
    console.log(`[CHANNELS] guild=${guild.id} #${channel.name} deleted in Discord: removed from ${hit.map((h) => h.col).join(', ')}`);
    const p = pending.get(guild.id) || { names: new Map(), timer: null };
    for (const h of hit) p.names.set(h.col, channel.name);
    clearTimeout(p.timer);
    p.timer = setTimeout(() => { pending.delete(guild.id); report(guild, client, p.names).catch(() => {}); }, BURST_MS);
    pending.set(guild.id, p);
}

async function report(guild, client, names) {
    const ch = require('./modlog').resolveModLog(guild, client.db);   // gone too if the mod log itself was deleted: then nothing is sent
    if (!ch) return;
    const { t } = require('./i18n');
    let lang = 'en';
    try { lang = require('./pick-lang').pickLang(client, guild.id, null); } catch { /* English */ }
    if (!['en', 'fr', 'zh', 'ar'].includes(lang)) lang = 'en';
    const clean = (s) => String(s || '?').replace(/[*_~`|>\\]/g, '');
    const label = (col) => { const k = `postcheck.settings.${col}`; const v = t(k, lang); return v && v !== k ? v : col; };
    const lines = [...names].map(([col, name]) => `**${label(col)}** · ~~#${clean(name)}~~ → ${t('channels.not_set', lang)}`);
    let cmd = '/channels';
    try { cmd = require('./cmd').slash(client, 'channels', { guild }); } catch { /* plain text */ }
    const { EmbedBuilder } = require('discord.js');
    await ch.send({
        embeds: [new EmbedBuilder().setColor(0x5b6b7c).setTitle(t('channels.gone_title', lang))
            .setDescription(`${lines.join('\n')}\n\n${t('channels.gone_hint', lang, { cmd })}`).setTimestamp()],
        allowedMentions: { parse: [] },
    }).catch((e) => console.error(`[CHANNELS] mod-log guild=${guild.id}:`, e.message));
}

// Start-up: a channel missing from the cache may only be an archived thread, so Discord is asked before anything is
// emptied; only "Unknown Channel" (10003) counts as deleted. Quiet: no mod-log card.
async function sweep(client) {
    let n = 0;
    const cols = channelCols(client.db);
    if (!cols.length) return;
    for (const guild of client.guilds.cache.values()) {
        if (!guild.channels?.cache?.size) continue;
        let row;
        try { row = client.db.prepare(`SELECT ${cols.join(', ')} FROM server_settings WHERE guild_id = ?`).get(guild.id); } catch { continue; }
        if (!row) continue;
        const unsure = [...new Set(cols.map((c) => row[c]).filter((id) => id && /^\d{17,20}$/.test(String(id)) && !guild.channels.cache.has(String(id))))];
        const gone = [];
        for (const id of unsure) {
            try { await client.channels.fetch(String(id)); }
            catch (e) { if (e?.code === 10003) gone.push(id); }   // other errors (no access, network): left as they are
        }
        if (gone.length) n += clear(client, guild.id, gone).length;
    }
    if (n) console.log(`[CHANNELS] start-up: ${n} setting(s) pointed at channels deleted in Discord, now empty`);
}

module.exports = { onDelete, sweep, clear };
