'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON CG-223 — WHICH CUSTOM EMOJIS ARCHON CAN REALLY USE
// config/emojis.js can point to an emoji that no longer exists (deleted, or uploaded to a server ARCHON left).
// In text that only shows :name:, but in a button or a menu Discord refuses the whole message
// ("Invalid emoji"), which broke the trivia menu. At start-up this loads every emoji ARCHON can use
// (its own app emojis and those of its servers); icons, buttons and menus then fall back to plain emojis
// for any id that isn't there, and the log lists the keys to recreate.
// ═══════════════════════════════════════════════════════════════════════════
const known = new Set();
let ready = false;
const ID = /^<a?:\w{2,32}:(\d{15,25})>$/;

async function load(client) {
    // without the app emoji list, checking would wrongly reject them all: stay permissive instead
    if (typeof client.application?.emojis?.fetch !== 'function') { console.log('[EMOJIS] app emoji list not available in this discord.js: custom emojis are not checked'); return; }
    try {
        const app = await client.application.emojis.fetch();
        for (const e of app?.values?.() || []) known.add(e.id);
    } catch (e) { console.error('[EMOJIS] could not list app emojis:', e.message); return; }
    for (const e of client.emojis?.cache?.values?.() || []) known.add(e.id);
    ready = true;
    try {
        const E = require('../config/emojis');
        const stale = Object.entries(E).filter(([, v]) => typeof v === 'string' && ID.test(v) && !known.has(ID.exec(v)[1])).map(([k]) => k);
        if (stale.length) console.log(`[EMOJIS] ${stale.length} key(s) point to emojis ARCHON can't use (plain emojis are shown instead): ${stale.join(', ')}`);
    } catch { /* no config */ }
}

// true for plain emojis, and for custom ones ARCHON can use (before the list is loaded: true)
function usable(str) {
    const m = ID.exec(String(str || ''));
    if (!m) return true;
    return !ready || known.has(m[1]);
}

// the emoji if it can be used, otherwise the fallback (which may be undefined: no emoji)
const pick = (str, fallback) => (str && usable(str) ? str : fallback);

const remember = (id) => { if (id) known.add(String(id)); };

module.exports = { load, usable, pick, remember };
