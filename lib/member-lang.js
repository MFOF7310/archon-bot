// lib/member-lang.js
// The language a member chose for themselves with .mylang, remembered across servers.
// It is only used on servers set to Auto: a language chosen with /setlang always wins.
// Stores the Discord user id and the language code, nothing else. `.mylang auto` deletes the row.
const path = require('path');

const LANGS = ['en', 'fr', 'ar', 'bm', 'zh'];
const cache = new Map();   // userId -> language, or null when the member has not chosen one
let db = null;

function open() {
    if (db) return db;
    const Database = require('better-sqlite3');
    const file = process.env.MEMBER_LANG_DB || path.join(__dirname, '..', 'data', 'database.sqlite');
    db = new Database(file, { fileMustExist: true, timeout: 5000 });
    db.prepare('CREATE TABLE IF NOT EXISTS member_prefs (user_id TEXT PRIMARY KEY, language TEXT NOT NULL, updated_at INTEGER NOT NULL)').run();
    return db;
}

const validId = (userId) => /^\d{5,25}$/.test(String(userId || ''));

// The member's chosen language, or null. A read problem is logged and answered with null: it must never stop a command.
function get(userId) {
    if (!validId(userId)) return null;
    const id = String(userId);
    if (cache.has(id)) return cache.get(id);
    try {
        const row = open().prepare('SELECT language FROM member_prefs WHERE user_id = ?').get(id);
        const lang = row && LANGS.includes(row.language) ? row.language : null;
        cache.set(id, lang);
        return lang;
    } catch (e) {
        console.error('[MYLANG] read failed:', e.message);
        return null;
    }
}

function set(userId, language) {
    if (!validId(userId) || !LANGS.includes(language)) throw new Error('invalid member or language');
    const id = String(userId);
    open().prepare('INSERT INTO member_prefs (user_id, language, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET language = excluded.language, updated_at = excluded.updated_at')
        .run(id, language, Math.floor(Date.now() / 1000));
    cache.set(id, language);
}

function reset(userId) {
    if (!validId(userId)) throw new Error('invalid member');
    const id = String(userId);
    open().prepare('DELETE FROM member_prefs WHERE user_id = ?').run(id);
    cache.set(id, null);
}

module.exports = { get, set, reset, LANGS };
