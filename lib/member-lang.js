// lib/member-lang.js
// The language a member chose for themselves, remembered PER SERVER.
const path = require('path');

const LANGS = ['en', 'fr', 'ar', 'bm', 'zh'];
const cache = new Map();   // `${userId}:${guildId}` -> language
let db = null;

function open() {
    if (db) return db;
    const Database = require('better-sqlite3');
    const file = process.env.MEMBER_LANG_DB || path.join(__dirname, '..', 'data', 'database.sqlite');
    db = new Database(file, { fileMustExist: true, timeout: 5000 });
    // Nouvelle table pour l'isolation par serveur (on garde l'ancienne au cas où)
    db.prepare('CREATE TABLE IF NOT EXISTS member_prefs_server (user_id TEXT, guild_id TEXT, language TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, guild_id))').run();
    return db;
}

const validId = (id) => /^\d{5,25}$/.test(String(id || ''));
const validGuild = (id) => id === 'DM' || /^\d{5,25}$/.test(String(id || ''));

function get(userId, guildId = 'DM') {
    if (!validId(userId) || !validGuild(guildId)) return null;
    const key = `${userId}:${guildId}`;
    if (cache.has(key)) return cache.get(key);
    try {
        const row = open().prepare('SELECT language FROM member_prefs_server WHERE user_id = ? AND guild_id = ?').get(String(userId), String(guildId));
        const lang = row && LANGS.includes(row.language) ? row.language : null;
        cache.set(key, lang);
        return lang;
    } catch (e) {
        console.error('[MYLANG] read failed:', e.message);
        return null;
    }
}

function set(userId, guildId = 'DM', language) {
    if (!validId(userId) || !validGuild(guildId) || !LANGS.includes(language)) throw new Error('invalid data');
    const key = `${userId}:${guildId}`;
    open().prepare('INSERT INTO member_prefs_server (user_id, guild_id, language, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, guild_id) DO UPDATE SET language = excluded.language, updated_at = excluded.updated_at')
        .run(String(userId), String(guildId), language, Math.floor(Date.now() / 1000));
    cache.set(key, language);
}

function reset(userId, guildId = 'DM') {
    if (!validId(userId) || !validGuild(guildId)) throw new Error('invalid data');
    const key = `${userId}:${guildId}`;
    open().prepare('DELETE FROM member_prefs_server WHERE user_id = ? AND guild_id = ?').run(String(userId), String(guildId));
    cache.set(key, null);
}

module.exports = { get, set, reset, LANGS };
