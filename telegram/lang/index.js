"use strict";
const en = require('./en');
const fr = require('./fr');
const bm = require('./bm');
const zh = require('./zh');

const LANGS = { en, fr, bm, zh };

// Map Telegram language codes to our lang files
const LANG_MAP = {
    'en': 'en', 'en-US': 'en', 'en-GB': 'en',
    'fr': 'fr', 'fr-FR': 'fr', 'fr-BE': 'fr',
    'zh': 'zh', 'zh-CN': 'zh', 'zh-TW': 'zh', 'zh-HK': 'zh',
    'bm': 'bm', 'bam': 'bm',
};

/**
 * Get translation for a user
 * @param {string} langCode - Telegram user language_code
 * @returns {object} translations object
 */
const fs = require('fs');
const USER_LANG_DB = '/tmp/archon_user_langs.json';

function getUserPreference(userId) {
    try {
        const db = JSON.parse(fs.readFileSync(USER_LANG_DB, 'utf8'));
        return db[String(userId)] || null;
    } catch { return null; }
}

function getLang(langCode, userId) {
    // User preference takes priority
    if (userId) {
        const pref = getUserPreference(userId);
        if (pref && LANGS[pref]) return LANGS[pref];
    }
    const code = LANG_MAP[langCode] || LANG_MAP[langCode?.split('-')[0]] || 'en';
    return LANGS[code] || LANGS.en;
}

/**
 * Get translated string with variable substitution
 * @param {string} langCode - Telegram user language_code  
 * @param {string} key - Translation key
 * @param {object} vars - Variables to substitute {name}, {group} etc
 * @returns {string} Translated string
 */
function t(langCode, key, vars = {}, userId = null) {
    const lang = getLang(langCode, userId);
    let str = lang[key] || LANGS.en[key] || key;
    
    // Handle arrays (pick random)
    if (Array.isArray(str)) {
        str = str[Math.floor(Math.random() * str.length)];
    }
    
    // Substitute variables
    for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`{${k}}`, 'g'), v);
    }
    
    return str;
}

module.exports = { getLang, t, LANGS, LANG_MAP };
