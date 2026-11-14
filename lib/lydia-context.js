'use strict';
// ═══════════════════════════════════════════════════════════════════════
// LYDIA'S VIEW OF ONE SERVER — live facts about the server she is answering in, and nothing from any other.
//   forEveryone: modules on/off, commands turned off here, public channels, Premium or not, the asker's OWN stats
//   forManagers (Manage Server): AutoMod state, Premium end date, open tickets (the setup checklist is added apart)
// Plain English for the model; she answers in the member's language. Read only.
// ═══════════════════════════════════════════════════════════════════════

const MODULES = [['economy_enabled', 'economy'], ['leveling_enabled', 'leveling'], ['music_enabled', 'music'], ['tickets_enabled', 'tickets'],
    ['moderation_enabled', 'moderation'], ['codm_enabled', 'CODM tools'], ['ai_enabled', 'AI chat'], ['afk_enabled', 'AFK'], ['market_enabled', 'market']];

const one = (db, sql, ...args) => { try { return db.prepare(sql).get(...args) || null; } catch { return null; } };
const all = (db, sql, ...args) => { try { return db.prepare(sql).all(...args) || []; } catch { return []; } };
const chan = (guild, id) => (id && guild.channels.cache.has(String(id)) ? `<#${id}>` : null);

function build(client, guild, member) {
    const db = client.db;
    const s = one(db, 'SELECT * FROM server_settings WHERE guild_id = ?', guild.id) || {};
    const lines = [];

    const on = MODULES.filter(([col]) => s[col] !== 0).map(([, name]) => name);
    const off = MODULES.filter(([col]) => s[col] === 0).map(([, name]) => name);
    lines.push(`- Modules on here: ${on.join(', ') || 'none'}${off.length ? `. Turned OFF here: ${off.join(', ')} — never suggest their commands` : ''}`);

    const disabled = all(db, 'SELECT command_name FROM server_command_settings WHERE guild_id = ? AND enabled = 0', guild.id).map((r) => r.command_name);
    if (disabled.length) lines.push(`- Commands turned off on this server (never suggest them): ${disabled.slice(0, 40).join(', ')}`);

    const pub = [['rules', chan(guild, s.rules_channel || guild.rulesChannelId)], ['general chat', chan(guild, s.general_channel)], ['level-ups', chan(guild, s.levelup_channel)], ['daily rewards', chan(guild, s.daily_channel)]]
        .filter(([, c]) => c).map(([n, c]) => `${n} ${c}`);
    if (pub.length) lines.push(`- Public channels: ${pub.join(', ')}`);

    let premium = false;
    try { premium = require('../plugins/premium.js').isPremium(db, guild.id); } catch { premium = false; }
    lines.push(`- Premium: ${premium ? 'yes (verification gate, AI actions and the other Premium features work here)' : 'no (Premium-only features are not available here; /premium explains them)'}`);

    // the asker's own numbers on this server: never anyone else's
    if (member) {
        const u = one(db, 'SELECT xp, level, credits, streak_days FROM users WHERE id = ? AND guild_id = ?', member.id, guild.id);
        if (u) {
            const rank = (one(db, 'SELECT COUNT(*) AS n FROM users WHERE guild_id = ? AND xp > ?', guild.id, u.xp || 0)?.n || 0) + 1;
            const total = one(db, 'SELECT COUNT(*) AS n FROM users WHERE guild_id = ?', guild.id)?.n || 1;
            lines.push(`- The person asking, on this server only: level ${u.level || 1}, ${Number(u.xp || 0)} XP, ${Number(u.credits || 0)} credits, daily streak ${u.streak_days || 0}, XP rank #${rank} of ${total}. Share these with them only; never give another member's numbers.`);
        }
    }
    return `SERVER FACTS — live, for this server only (never mention other servers):\n${lines.join('\n')}`;
}

function forManagers(client, guild) {
    const db = client.db;
    const s = one(db, 'SELECT automod_enabled, automod_sensitivity, automod_log_channel, mod_log_channel FROM server_settings WHERE guild_id = ?', guild.id) || {};
    const lines = [];
    const amOn = s.automod_enabled === 1 || s.automod_enabled === '1';
    const amLog = s.automod_log_channel || s.mod_log_channel;
    lines.push(`- AutoMod: ${amOn ? `on, sensitivity ${s.automod_sensitivity || 'medium'}, ${amLog ? (guild.channels.cache.has(String(amLog)) ? 'its log channel is set' : 'its log channel was DELETED') : 'no log channel set'}` : 'off (turn it on with /automod)'}`);
    const p = one(db, 'SELECT expires_at FROM premium WHERE guild_id = ?', guild.id);
    if (p) lines.push(`- Premium ends: ${p.expires_at ? new Date(p.expires_at * 1000).toISOString().slice(0, 10) : 'never (lifetime)'}`);
    const open = one(db, "SELECT COUNT(*) AS c FROM tickets WHERE guild_id = ? AND (status IS NULL OR status = 'open')", guild.id)?.c;
    if (open != null) lines.push(`- Open tickets: ${open}`);
    return `MANAGER FACTS — the person asking manages this server:\n${lines.join('\n')}`;
}

module.exports = { build, forManagers };
