'use strict';
// ═══ ARCHON CG-223 — COMPONENTS: one router for buttons and menus, with sessions that survive a restart ═══
// A card that needs to remember something between clicks (a wizard's step, the choices made) keeps it in SQLite,
// not in a collector waiting in memory. So a click still works after the bot restarts, and nothing sits in memory.
//
//   const components = require('../lib/components');
//   components.register('setup', handler, { command: 'setup' });       // once, when the plugin loads
//   const sid = components.create(db, { kind: 'setup', userId, guildId, data: { step: 0 } });
//   button.setCustomId(components.id('setup', sid, 'next'));            // → c:setup:<sid>:next
//
//   handler(ix, client, { sid, action, args, session, save, end })
//     session: { userId, guildId, data } · save(data) keeps the new state (and the session alive) · end() closes it
//
// A click on a session that has ended (finished, or no click for its idle time) greys out that message's buttons and
// tells the person, privately, which command opens it again. Only the person who opened a session can use it.
// customId: c:<kind>:<sid>:<action>[:<arg>…], at most 100 characters.

const crypto = require('crypto');

const DEFAULT_IDLE_MS = 15 * 60 * 1000;
const handlers = new Map();   // kind → { fn, command }
let ready = false;
let lastPrune = 0;

function setup(db) {
    if (ready) return;
    db.prepare(`CREATE TABLE IF NOT EXISTS component_sessions (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id TEXT NOT NULL, guild_id TEXT,
        data TEXT NOT NULL DEFAULT '{}', idle_ms INTEGER NOT NULL, expires_at INTEGER NOT NULL)`).run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_component_sessions_exp ON component_sessions (expires_at)').run();
    ready = true;
}

function prune(db) {
    const now = Date.now();
    if (now - lastPrune < 3600000) return;
    lastPrune = now;
    try { db.prepare('DELETE FROM component_sessions WHERE expires_at < ?').run(now); } catch { /* next time */ }
}

/** The plugin's handler for c:<kind>:… ids. command: what the person runs to open it again (shown when it ended). */
function register(kind, fn, { command } = {}) {
    handlers.set(kind, { fn, command: command || kind });
}

/** Opens a session; returns its short id (10 characters). */
function create(db, { kind, userId, guildId = null, data = {}, idleMs = DEFAULT_IDLE_MS }) {
    setup(db);
    prune(db);
    const sid = crypto.randomBytes(8).toString('base64url').slice(0, 10);
    db.prepare('INSERT INTO component_sessions (id, kind, user_id, guild_id, data, idle_ms, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(sid, kind, String(userId), guildId ? String(guildId) : null, JSON.stringify(data), idleMs, Date.now() + idleMs);
    return sid;
}

function load(db, sid) {
    setup(db);
    const r = db.prepare('SELECT * FROM component_sessions WHERE id = ?').get(sid);
    if (!r || r.expires_at < Date.now()) return null;
    let data = {};
    try { data = JSON.parse(r.data); } catch { /* empty state */ }
    return { kind: r.kind, userId: r.user_id, guildId: r.guild_id, data, idleMs: r.idle_ms };
}

/** c:<kind>:<sid>:<action>[:<arg>…] */
function id(kind, sid, action, ...args) {
    return ['c', kind, sid, action, ...args].join(':').slice(0, 100);
}

// A copy of the message's components with every button and menu turned off (links stay usable)
function disabledCopy(message) {
    const off = (c) => {
        const j = typeof c?.toJSON === 'function' ? c.toJSON() : { ...c };
        if (j.type === 2 && j.style !== 5) j.disabled = true;
        if ([3, 5, 6, 7, 8].includes(j.type)) j.disabled = true;
        if (Array.isArray(j.components)) j.components = j.components.map(off);
        if (j.accessory) j.accessory = off(j.accessory);
        return j;
    };
    return (message?.components || []).map(off);
}

async function ended(ix, client, command) {
    const { t } = require('./i18n');
    let lang = 'en';
    try { lang = require('./pick-lang').pickLang(client, ix.guildId, ix, ix.user.id); } catch { /* English */ }
    if (!['en', 'fr', 'zh', 'ar'].includes(lang)) lang = lang === 'bm' ? 'fr' : 'en';
    let cmd = `/${command}`;
    try { cmd = require('./cmd').slash(client, command, { guild: ix.guild }); } catch { /* plain text */ }
    const text = t('session_ended', lang, { cmd });
    // grey the buttons out on this message, then say why (privately)
    try { await ix.update({ components: disabledCopy(ix.message) }); }
    catch { return ix.reply({ content: text, flags: 1 << 6, allowedMentions: { parse: [] } }).catch(() => {}); }
    return ix.followUp({ content: text, flags: 1 << 6, allowedMentions: { parse: [] } }).catch(() => {});
}

/** Called for every interaction: true when it was a c:… id and has been handled here. */
async function route(ix, client) {
    const cid = ix.customId;
    if (typeof cid !== 'string' || !cid.startsWith('c:')) return false;
    const [, kind, sid, action, ...args] = cid.split(':');
    const handler = handlers.get(kind);   // plugins register themselves when they load at startup
    const db = client.db;
    const session = handler && sid ? load(db, sid) : null;
    if (!handler || !session || session.kind !== kind) { await ended(ix, client, handler?.command || kind); return true; }

    if (session.userId !== ix.user.id) {
        const { t } = require('./i18n');
        let lang = 'en';
        try { lang = require('./pick-lang').pickLang(client, ix.guildId, ix, ix.user.id); } catch { /* English */ }
        await ix.reply({ content: t('session_not_yours', lang), flags: 1 << 6 }).catch(() => {});
        return true;
    }

    const save = (data) => {
        session.data = data;
        db.prepare('UPDATE component_sessions SET data = ?, expires_at = ? WHERE id = ?').run(JSON.stringify(data), Date.now() + session.idleMs, sid);
    };
    const end = () => { try { db.prepare('DELETE FROM component_sessions WHERE id = ?').run(sid); } catch { /* expires anyway */ } };
    // any click keeps the session alive
    try { db.prepare('UPDATE component_sessions SET expires_at = ? WHERE id = ?').run(Date.now() + session.idleMs, sid); } catch { /* fine */ }

    try { await handler.fn(ix, client, { sid, action, args, session, save, end }); }
    catch (e) {
        console.error(`[COMPONENTS] ${kind}:${action}:`, e.message);
        if (!ix.replied && !ix.deferred) {
            let lang = 'en';
            try { lang = require('./pick-lang').pickLang(client, ix.guildId, ix, ix.user.id); } catch { /* English */ }
            await ix.reply({ content: require('./i18n').t('error_generic', lang), flags: 1 << 6 }).catch(() => {});
        }
    }
    return true;
}

// For a card from before a plugin moved here (its old ids have no handler any more): grey it out and say how to reopen it
const expire = (ix, client, command) => ended(ix, client, command);

module.exports = { register, create, load, id, route, disabledCopy, expire, DEFAULT_IDLE_MS };
