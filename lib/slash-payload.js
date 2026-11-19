'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// The one list of slash commands ARCHON sends to Discord.
//   build(plugins) → { commands, serverOnly, skipped, problems }
// Used by index.js at start-up and by scripts/deploy-commands.js, so both always send the same thing.
// Server-only commands (moderation, economy, games…) are marked so Discord hides them in DMs instead of
// letting someone pick a command that can only fail there.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const LIMIT = 100;   // Discord's limit of global slash commands
const GUILD_ONLY_CATS = new Set(['MODERATION', 'ADMIN', 'ECONOMY', 'PROFILE', 'GAMING', 'MUSIC']);
const NAME = /^[-_\p{L}\p{N}]{1,32}$/u;

const serverOnlyOf = (plugin, json) => plugin.guildOnly === true
    || GUILD_ONLY_CATS.has(String(plugin.category || '').toUpperCase())
    || !!json.default_member_permissions;

function toJson(plugin) {
    const d = plugin.data;
    if (!d) return null;
    if (typeof d.toJSON === 'function') return d.toJSON();
    if (typeof d === 'object' && d.name) return JSON.parse(JSON.stringify(d));
    return null;
}

// Discord's own rules for a command; a command that breaks one makes the whole upload fail.
function checkOne(json, where, problems) {
    const at = where ? `${where} ` : '';
    if (!NAME.test(json.name || '') || json.name !== json.name.toLowerCase()) problems.push(`${at}"${json.name}": invalid name (1-32 lowercase letters, numbers, - or _)`);
    const needsDescription = where ? true : (json.type ?? 1) === 1;   // options always, context-menu commands never
    if (needsDescription && !(json.description && json.description.length <= 100)) problems.push(`${at}"${json.name}": description missing or over 100 characters`);
    const opts = json.options || [];
    if (opts.length > 25) problems.push(`${at}"${json.name}": ${opts.length} options (Discord allows 25)`);
    const seen = new Set();
    let optionalSeen = false;
    for (const o of opts) {
        if (seen.has(o.name)) problems.push(`${at}"${json.name}": option "${o.name}" appears twice`);
        seen.add(o.name);
        const isSub = o.type === 1 || o.type === 2;
        if (!isSub) {
            if (o.required && optionalSeen) problems.push(`${at}"${json.name}": required option "${o.name}" comes after an optional one`);
            if (!o.required) optionalSeen = true;
        }
        if ((o.choices || []).length > 25) problems.push(`${at}"${json.name}" → "${o.name}": ${o.choices.length} choices (Discord allows 25)`);
        if (o.choices?.length && o.autocomplete) problems.push(`${at}"${json.name}" → "${o.name}": choices and autocomplete can't be used together`);
        checkOne(o, `${at}${json.name} →`, problems);
    }
}

function build(plugins) {
    const commands = [];
    const skipped = [];
    const problems = [];
    const owners = new Map();
    let serverOnly = 0;

    for (const plugin of plugins) {
        if (!plugin?.data) continue;
        let json;
        try { json = toJson(plugin); } catch (e) { skipped.push(`${plugin.name}: ${e.message}`); continue; }
        if (!json?.name) { skipped.push(`${plugin.name || '?'}: no slash data`); continue; }
        if (owners.has(json.name)) {
            problems.push(`"${json.name}" is declared twice (${owners.get(json.name)} and ${plugin.name})`);
            continue;
        }
        owners.set(json.name, plugin.name);
        // Installed on a server only, unless the plugin says it also works as a user app (userApp: true).
        // Without this, Discord used the portal's install settings: with "User Install" on, every command showed up
        // in DMs and in servers ARCHON isn't in, where most of them can only fail (no server, no settings).
        if (!json.integration_types) json.integration_types = plugin.userApp === true ? [0, 1] : [0];
        if (plugin.userApp === true && !json.contexts) json.contexts = [0, 1, 2];
        if (serverOnlyOf(plugin, json) && !json.contexts) {
            json.contexts = [0];
            delete json.dm_permission;
            serverOnly++;
        }
        checkOne(json, '', problems);
        commands.push(json);
        // context-menu commands a plugin adds next to its slash command (type 2 user, 3 message), same install rules
        for (const m of Array.isArray(plugin.menus) ? plugin.menus : []) {
            const mj = JSON.parse(JSON.stringify(m));
            if (!mj.integration_types) mj.integration_types = json.integration_types;
            if (!mj.contexts && json.contexts) mj.contexts = json.contexts;
            if (owners.has(`menu:${mj.name}`)) { problems.push(`menu "${mj.name}" is declared twice`); continue; }
            owners.set(`menu:${mj.name}`, plugin.name);
            if (!mj.name || mj.name.length > 32) { problems.push(`menu "${mj.name}": name missing or over 32 characters`); continue; }
            commands.push(mj);
        }
    }
    if (commands.length > LIMIT) problems.push(`${commands.length} commands: Discord allows ${LIMIT}`);
    return { commands, serverOnly, skipped, problems };
}

// The plugins index.js loads (lydia included: index.js adds it separately).
function loadPlugins(dir = path.join(__dirname, '..', 'plugins')) {
    const plugins = [];
    const failed = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'market-manager.js').sort()) {
        try {
            const p = require(path.join(dir, file));
            if (p?.name && (p.run || p.execute)) plugins.push(p);
        } catch (e) {
            failed.push(`${file}: ${e.message}`);
        }
    }
    return { plugins, failed };
}

module.exports = { build, loadPlugins, LIMIT };
