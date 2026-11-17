'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ICONS FOR TICKET CATEGORIES — the set the dashboard offers in its icon picker.
// A category saves "icon:<key>" (the name, never the ID): the ID is looked up in config/emojis.js when the panel
// is drawn, so redoing an icon on Discord (new ID) can't break the panel with "Invalid emoji".
// A missing or unusable icon falls back to its plain emoji. Regular emojis and <:name:id> still work as before.
// The icons are made by scripts/missing-icons.sh.
// ═══════════════════════════════════════════════════════════════════════════
const ICONS = [
    ['ic_lifebuoy', '🛟'], ['ic_bug', '🐛'], ['ic_card', '💳'], ['ic_flag', '🚩'], ['ic_gavel', '🔨'], ['ic_help', '❓'],
    ['ic_handshake', '🤝'], ['ic_crown', '👑'], ['ic_shop', '🛒'], ['ic_gift', '🎁'], ['ic_games', '🎮'],
];
const FALLBACK = new Map(ICONS);
const CUSTOM = /^<(a?):\w{2,32}:(\d{15,25})>$/;

function custom(key) {
    let E;
    try { E = require('../config/emojis'); } catch { return null; }
    const v = E?.[key];
    if (typeof v !== 'string' || !CUSTOM.test(v)) return null;
    try { if (!require('./emoji-check').usable(v)) return null; } catch { /* check not loaded: trust it */ }
    return v;
}

// "icon:ic_bug" → the emoji to show; anything else is returned as it was
function resolve(value) {
    const m = /^icon:(\w{2,32})$/.exec(String(value || '').trim());
    if (!m) return value;
    return custom(m[1]) || FALLBACK.get(m[1]) || '🎫';
}

// For the dashboard picker: the key to save, the picture to show (null when the icon isn't made yet) and its plain emoji
function list() {
    return ICONS.map(([key, fb]) => {
        const v = custom(key);
        const m = v && CUSTOM.exec(v);
        return { key, fb, url: m ? `https://cdn.discordapp.com/emojis/${m[2]}.${m[1] ? 'gif' : 'webp'}?size=48` : null };
    });
}

module.exports = { resolve, list, ICONS };
