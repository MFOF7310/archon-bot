#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Checks ARCHON's slash commands and, when asked, sends them to Discord.
//   node scripts/deploy-commands.js                     check, and compare with what Discord has (sends nothing)
//   node scripts/deploy-commands.js --push              send to every server (global)
//   node scripts/deploy-commands.js --guild <id>        send to one server only: shows up at once, for testing
//   node scripts/deploy-commands.js --clear-guild <id>  remove those test copies from that server
// The bot already sends the global list each time it starts (index.js). This tool is for checking, or for
// applying a change without restarting. Both build the list with lib/slash-payload, so they always agree.
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
const { REST, Routes } = require('discord.js');
const { build, loadPlugins, LIMIT } = require('../lib/slash-payload');

const C = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', grey: '\x1b[90m', bold: '\x1b[1m', reset: '\x1b[0m' };
const paint = (color, s) => `${C[color]}${s}${C.reset}`;

// ─── arguments ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const push = flag('--push');
const guildId = value('--guild');
const clearId = value('--clear-guild');
for (const [name, id] of [['--guild', guildId], ['--clear-guild', clearId]]) {
    if (flag(name) && !/^\d{15,25}$/.test(id || '')) stop(`${name} needs a server ID, for example: ${name} 1571287013619925023`);
}
if ([push, !!guildId, !!clearId].filter(Boolean).length > 1) stop('Use only one of --push, --guild or --clear-guild at a time.');

function stop(msg) {
    console.error(paint('red', `✖ ${msg}`));
    process.exit(1);
}

// ─── comparing with Discord ──────────────────────────────────────────────
// Discord fills in defaults (type 1, required false, nsfw false…) that the bot leaves out: they are dropped on both
// sides so only real differences show.
const IGNORED = new Set(['id', 'application_id', 'version', 'guild_id', 'dm_permission', 'integration_types', 'handler', 'name_localized', 'description_localized']);
function clean(v) {
    if (Array.isArray(v)) { const a = v.map(clean).filter((x) => x !== undefined); return a.length ? a : undefined; }
    if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v).sort()) {
            if (IGNORED.has(k)) continue;
            const c = clean(v[k]);
            if (c !== undefined) out[k] = c;
        }
        return Object.keys(out).length ? out : undefined;
    }
    if (v === null || v === false || v === '') return undefined;
    return v;
}
const same = (a, b) => JSON.stringify(clean({ ...a, type: a.type ?? 1 })) === JSON.stringify(clean({ ...b, type: b.type ?? 1 }));

function whatChanged(local, remote) {
    const parts = [];
    for (const k of ['description', 'options', 'default_member_permissions', 'contexts', 'nsfw', 'name_localizations', 'description_localizations']) {
        if (JSON.stringify(clean(local[k])) !== JSON.stringify(clean(remote[k]))) parts.push(k === 'default_member_permissions' ? 'permissions' : k.replace('_', ' '));
    }
    return parts.join(', ') || 'details';
}

function compare(local, remote) {
    const byName = new Map(remote.map((c) => [c.name, c]));
    const added = [], changed = [], removed = [];
    let unchanged = 0;
    for (const c of local) {
        const r = byName.get(c.name);
        if (!r) added.push(c.name);
        else if (!same(c, r)) changed.push(`${c.name}  (${whatChanged(c, r)})`);
        else unchanged++;
        byName.delete(c.name);
    }
    removed.push(...byName.keys());
    return { added, changed, removed, unchanged };
}

// ─── run ─────────────────────────────────────────────────────────────────
(async () => {
    const token = process.env.DISCORD_TOKEN;
    if (!token) stop('DISCORD_TOKEN is missing from .env');
    const rest = new REST({ version: '10' }).setToken(token);

    console.log(paint('bold', '\nARCHON — slash commands'));

    // Plugins print their own start-up lines when loaded: kept quiet here.
    const quiet = { log: console.log, info: console.info, warn: console.warn };
    console.log = console.info = console.warn = () => {};
    let loaded;
    try { loaded = loadPlugins(); } finally { Object.assign(console, quiet); }

    const { commands, serverOnly, skipped, problems } = build(loaded.plugins);
    console.log(`  ${commands.length} commands ready (${serverOnly} server-only) · limit ${LIMIT}`);
    for (const f of loaded.failed) console.log(paint('yellow', `  ⚠ plugin not loaded: ${f}`));
    for (const s of skipped) console.log(paint('grey', `  · skipped ${s}`));
    if (problems.length) {
        console.log(paint('red', `  ✖ ${problems.length} problem(s) Discord would refuse:`));
        for (const p of problems) console.log(paint('red', `    - ${p}`));
    } else {
        console.log(paint('green', '  ✓ names, descriptions and options all valid'));
    }

    let clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
        try { clientId = (await rest.get(Routes.currentApplication())).id; } catch (e) { stop(`CLIENT_ID is missing from .env and the bot's ID couldn't be read: ${e.message}`); }
    }

    if (clearId) {
        await rest.put(Routes.applicationGuildCommands(clientId, clearId), { body: [] });
        console.log(paint('green', `\n✓ Test commands removed from server ${clearId}. The global ones stay.\n`));
        process.exit(0);
    }

    const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);
    const where = guildId ? `server ${guildId}` : 'global';

    let remote = [];
    try { remote = await rest.get(route, { query: new URLSearchParams({ with_localizations: 'true' }) }); } catch (e) { stop(`Couldn't read the commands Discord has (${where}): ${e.message}`); }
    const d = compare(commands, remote);
    console.log(`\n${paint('cyan', `Compared with Discord (${where}):`)}`);
    for (const n of d.added) console.log(paint('green', `  + ${n}`));
    for (const n of d.changed) console.log(paint('yellow', `  ~ ${n}`));
    for (const n of d.removed) console.log(paint('red', `  − ${n}`));
    console.log(paint('grey', `  ${d.unchanged} unchanged`));
    const differs = d.added.length + d.changed.length + d.removed.length > 0;

    if (!push && !guildId) {
        console.log(differs
            ? `\nNothing was sent. Run again with ${paint('bold', '--push')} to apply, or restart the bot (it sends the list at start-up).\n`
            : paint('green', '\n✓ Discord already has exactly this list. Nothing to do.\n'));
        process.exit(problems.length ? 1 : 0);
    }
    if (problems.length) stop('Fix the problems above first: Discord would refuse the whole list.');
    if (!differs) { console.log(paint('green', `\n✓ Discord already has exactly this list (${where}). Nothing sent.\n`)); process.exit(0); }

    try {
        await rest.put(route, { body: commands });
    } catch (e) {
        stop(`Discord refused the list: ${e.message}`);
    }
    console.log(paint('green', `\n✓ ${commands.length} commands sent (${where}).`));
    if (guildId) console.log(paint('grey', `  They show up at once on that server. Remove them later with --clear-guild ${guildId}, or members will see each command twice.`));
    console.log('');
    process.exit(0);
})().catch((e) => stop(e.message));
