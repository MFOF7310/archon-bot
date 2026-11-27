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
    // A command that only works through its subcommands (/daily check, /daily stats): a bare </daily:id> opens
    // nothing when clicked, so it is written as plain text instead
    if (!full.includes(' ')) {
        const cmd = client.application?.commands?.cache?.get(id) || opts.guild?.commands?.cache?.get(id);
        if (cmd?.options?.some((o) => o.type === 1 || o.type === 2)) return '`/' + full + '`';
    }
    return '</' + full + ':' + id + '>';
}

// ─── links(text, { client, guild, member }) ───
// Turns every "/name", "/name sub" or "/name group sub" written in a sentence into a clickable pill, when:
//   • that command really exists (looked up in Discord's own list: ids are never written by hand),
//   • the words after it are its real subcommand (a command that only works through subcommands is left as text),
//   • the reader may use it: pass `member` only when that member is the one who will read the message (an ephemeral
//     reply). Without a member, only commands everyone may use get a pill.
// Text in `backticks`, links (https://…/commands) and anything not a known command stay exactly as written.
function findCmd(client, guild, root) {
    const id = lookup(client, root, { guild });
    if (!id) return null;
    return client.application?.commands?.cache?.get(id) || guild?.commands?.cache?.get(id) || null;
}

function mayUse(cmd, member) {
    const need = cmd.defaultMemberPermissions;
    if (!need || need.bitfield === 0n) return true;
    try { return !!member?.permissions?.has?.(need); } catch { return false; }
}

function links(text, { client, guild = null, member = null } = {}) {
    const str = String(text ?? '');
    if (!client || !str.includes('/')) return str;
    if (!_global || _global.size === 0) {
        if (!warm(client)) { try { client.application?.commands?.fetch?.().then(() => warm(client)).catch(() => {}); } catch {} }
    }
    return str.split(/(`[^`]*`)/).map((part, i) => (i % 2 ? part : part.replace(
        /(^|[\s(«"'“])\/([a-z0-9_-]{1,32})((?: [a-z0-9_-]{1,32}){0,2})/g,
        (all, pre, root, rest) => {
            const cmd = findCmd(client, guild, root);
            if (!cmd || !mayUse(cmd, member)) return all;
            const words = rest.trim() ? rest.trim().split(' ') : [];
            const opts = cmd.options || [];
            const subs = opts.filter((o) => o.type === 1 || o.type === 2);
            if (!subs.length) return `${pre}</${root}:${cmd.id}>${words.length ? ' ' + words.join(' ') : ''}`;
            const first = subs.find((o) => o.name === words[0]);
            if (!first) return all;   // only works through a subcommand, and none was named
            if (first.type === 1) return `${pre}</${root} ${first.name}:${cmd.id}>${words.length > 1 ? ' ' + words.slice(1).join(' ') : ''}`;
            const second = (first.options || []).find((o) => o.type === 1 && o.name === words[1]);
            return second ? `${pre}</${root} ${first.name} ${second.name}:${cmd.id}>` : all;
        },
    ))).join('');
}

module.exports = { warm, warmGuild, slash, links };
