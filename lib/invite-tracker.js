'use strict';
// ── Global invite cache ──
// Discord n'expose pas "qui a invité qui" sur guildMemberAdd.
// On cache les compteurs d'uses par code, puis on détecte le delta.
//
// Install: require('./lib/invite-tracker').install(client);
// Detect:  const inv = await require('../lib/invite-tracker').detect(guild);

const cache = new Map(); // Map<guildId, Map<code, uses>>

async function warm(guild) {
    try {
        const invites = await guild.invites.fetch();
        const m = new Map();
        invites.forEach(inv => m.set(inv.code, inv.uses || 0));
        cache.set(guild.id, m);
    } catch {
        // Missing "Manage Guild" — silent
    }
}

async function detect(guild) {
    const before = cache.get(guild.id);
    let fresh;
    try { fresh = await guild.invites.fetch(); } catch { return null; }
    let used = null;
    fresh.forEach(inv => {
        const prev = before ? (before.get(inv.code) || 0) : 0;
        const now = inv.uses || 0;
        if (now > prev && !used) used = inv;
    });
    // Refresh cache post-détection
    const m = new Map();
    fresh.forEach(inv => m.set(inv.code, inv.uses || 0));
    cache.set(guild.id, m);
    if (!used) return null;
    return {
        code: used.code,
        uses: used.uses,
        inviter: used.inviter
            ? { id: used.inviter.id, username: used.inviter.username, tag: used.inviter.tag }
            : null,
    };
}

function install(client) {
    client.once('ready', () => {
        for (const g of client.guilds.cache.values()) warm(g);
        console.log('[INVITE-TRACKER] Warmed', client.guilds.cache.size, 'guilds');
    });
    client.on('guildCreate', g => warm(g));
    client.on('inviteCreate', inv => {
        const m = cache.get(inv.guild.id) || new Map();
        m.set(inv.code, inv.uses || 0);
        cache.set(inv.guild.id, m);
    });
    client.on('inviteDelete', inv => {
        const m = cache.get(inv.guild.id);
        if (m) m.delete(inv.code);
    });
    console.log('[INVITE-TRACKER] Installed');
}

module.exports = { install, detect, warm };
