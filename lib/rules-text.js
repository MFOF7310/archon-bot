'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// THE SERVER'S RULES AS TEXT — for Archon AI when someone asks about the rules.
//   1. the text saved with /rules set (server_rules.rules_text), if any
//   2. otherwise what is written in the rules channel (the one set in /channels, else Discord's own rules channel):
//      the last messages, oldest first, with their embeds and V2 card text
// Rules are public to members, so this is given to anyone who asks. Read only, cached 10 minutes per server.
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionFlagsBits: F } = require('discord.js');

const MAX = 4000;
const TTL = 10 * 60 * 1000;
const cache = new Map();   // guildId → { at, text }

// every piece of text in a message: content, embeds, and the text blocks of V2 cards
function textOf(m) {
    const out = [];
    if (m.content) out.push(m.content);
    for (const e of m.embeds || []) {
        if (e.title) out.push(e.title);
        if (e.description) out.push(e.description);
        for (const f of e.fields || []) out.push(`${f.name}\n${f.value}`);
    }
    const walk = (c) => {
        if (!c) return;
        const d = typeof c.toJSON === 'function' ? c.toJSON() : c;
        if (d.type === 10 && d.content) out.push(d.content);   // TextDisplay
        for (const x of d.components || []) walk(x);
    };
    for (const c of m.components || []) walk(c);
    return out.join('\n');
}

async function fromChannel(guild, db) {
    let id = null;
    try { id = db.prepare('SELECT rules_channel FROM server_settings WHERE guild_id = ?').get(guild.id)?.rules_channel || null; } catch { /* none */ }
    const ch = guild.channels.cache.get(String(id || guild.rulesChannelId || ''));
    if (!ch?.isTextBased?.()) return null;
    const perms = ch.permissionsFor(guild.members.me);
    if (!perms?.has(F.ViewChannel) || !perms.has(F.ReadMessageHistory)) return null;
    const msgs = await ch.messages.fetch({ limit: 15 }).catch(() => null);
    if (!msgs?.size) return null;
    const text = [...msgs.values()].reverse().map(textOf).filter(Boolean).join('\n\n').trim();
    return text ? { text, where: `#${ch.name}` } : null;
}

// { text, where } or null when the server has no rules ARCHON can read
async function get(client, guild) {
    if (!guild) return null;
    const hit = cache.get(guild.id);
    if (hit && Date.now() - hit.at < TTL) return hit.value;
    let value = null;
    try {
        const saved = client.db.prepare('SELECT rules_text FROM server_rules WHERE guild_id = ?').get(guild.id)?.rules_text;
        if (saved && String(saved).trim()) value = { text: String(saved).trim(), where: '/rules' };
    } catch { /* table not made yet */ }
    if (!value) value = await fromChannel(guild, client.db).catch(() => null);
    if (value && value.text.length > MAX) value.text = value.text.slice(0, MAX) + '\n[…]';
    cache.set(guild.id, { at: Date.now(), value });
    return value;
}

// after /rules set or clear, so Archon reads the new text at once
const forget = (guildId) => cache.delete(String(guildId));

module.exports = { get, forget };
