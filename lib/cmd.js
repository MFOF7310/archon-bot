'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// SLASH COMMAND MENTIONS — clickable </name:id> pills
//
// Discord only renders a slash mention as a tappable pill when the VIEWER
// has permission to use that command in that channel. Otherwise the raw
// markup shows as plain text, which looks worse than code style.
//
// Use this ONLY in replies where the reader is guaranteed to be a moderator
// or admin (command replies, ephemeral admin views, the tribunal embed,
// raid alerts). Never in DMs to punished users and never inside `backticks`.
//
// Falls back to `/name` in code style when the ID isn't cached, so a miss
// never leaves broken markup in a message. The cache is re-warmed whenever
// a lookup misses, in case the client was still hydrating on first call.
// ═══════════════════════════════════════════════════════════════════════════

let _global = null;                    // Map<name, id>
const _perGuild = new Map();           // guildId -> Map<name, id>

function warm(client) {
    const m = new Map();
    try {
        const cache = client?.application?.commands?.cache;
        if (cache) for (const c of cache.values()) {
            if (c?.name && c?.id) m.set(c.name, c.id);
        }
    } catch {}
    // Only adopt if we found something (never clobber a good cache with an empty one).
    if (m.size > 0 || !_global) _global = m;
    return m.size;
}

function warmGuild(guild) {
    if (!guild) return 0;
    const m = new Map();
    try {
        for (const c of guild.commands?.cache?.values() || []) {
            if (c?.name && c?.id) m.set(c.name, c.id);
        }
    } catch {}
    if (m.size > 0 || !_perGuild.has(guild.id)) _perGuild.set(guild.id, m);
    return m.size;
}

function lookup(client, root, opts) {
    if (!_global || _global.size === 0) warm(client);
    let id = _global?.get(root);
    if (id) return id;
    if (opts.guild) {
        const gm = _perGuild.get(opts.guild.id);
        if (!gm || gm.size === 0) warmGuild(opts.guild);
        id = _perGuild.get(opts.guild.id)?.get(root);
        if (id) return id;
    }
    return null;
}

// slash(client, 'automod domains', { guild }) → '</automod domains:1234567890>'
function slash(client, name, opts = {}) {
    const full = String(name || '').trim();
    if (!full) return '';
    const root = full.split(/\s+/)[0];

    let id = lookup(client, root, opts);
    if (!id) {
        // Second chance — cache may have filled since the last attempt.
        warm(client);
        if (opts.guild) warmGuild(opts.guild);
        id = lookup(client, root, opts);
    }
    if (!id) {
        // Last resort: fire-and-forget fetch, so the NEXT call works.
        // (Never await here — the caller is building a string synchronously.)
        try {
            client.application?.commands?.fetch?.().then((cmds) => {
                if (cmds?.size) warm(client);
            }).catch(() => {});
        } catch {}
        return '`/' + full + '`';           // honest fallback for this call
    }
    return '</' + full + ':' + id + '>';
}

module.exports = { warm, warmGuild, slash };
