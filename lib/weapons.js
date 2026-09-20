const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'weapons.json');

let cache = null;
let mtime = 0;

// Reloads automatically when weapons.json changes on disk —
// editing the meta needs no restart.
function loadAll() {
    try {
        const stat = fs.statSync(FILE);
        if (!cache || stat.mtimeMs !== mtime) {
            cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
            mtime = stat.mtimeMs;
        }
    } catch (e) {
        console.error('[WEAPONS] Failed to load weapons.json:', e.message);
        cache = cache || { season: 'unknown', updated: null, weapons: [] };
    }
    return cache;
}

function getWeapons() {
    return loadAll().weapons || [];
}

function getSeason() {
    const d = loadAll();
    return { season: d.season, updated: d.updated };
}

// Exact match first, then case-insensitive, then partial.
function findWeapon(query) {
    if (!query) return null;
    const list = getWeapons();
    const q = query.trim().toLowerCase();
    return list.find(w => w.name.toLowerCase() === q)
        || list.find(w => w.name.toLowerCase().replace(/[\s-]/g, '') === q.replace(/[\s-]/g, ''))
        || list.find(w => w.name.toLowerCase().includes(q))
        || null;
}

function searchWeapons(query, limit = 25) {
    const list = getWeapons();
    if (!query) return list.slice(0, limit);
    const q = query.trim().toLowerCase();
    return list.filter(w =>
        w.name.toLowerCase().includes(q) ||
        (w.category || '').toLowerCase().includes(q) ||
        (w.tier || '').toLowerCase() === q
    ).slice(0, limit);
}

const TIER_ORDER = { GOD: 0, S: 1, A: 2, B: 3, C: 4 };

function byTier() {
    const groups = {};
    for (const w of getWeapons()) {
        const t = w.tier || 'C';
        (groups[t] = groups[t] || []).push(w);
    }
    return Object.entries(groups)
        .sort((a, b) => (TIER_ORDER[a[0]] ?? 9) - (TIER_ORDER[b[0]] ?? 9));
}

function byCategory(category) {
    const c = (category || '').toLowerCase();
    return getWeapons().filter(w => (w.category || '').toLowerCase() === c);
}

function categories() {
    return [...new Set(getWeapons().map(w => w.category).filter(Boolean))].sort();
}

// Horizontal bar for a 0-100 stat.
function statBar(value, width = 10) {
    const filled = Math.max(0, Math.min(width, Math.round((value / 100) * width)));
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

const TIER_COLORS = {
    GOD: '#ffd700',
    S:   '#e74c3c',
    A:   '#3498db',
    B:   '#2ecc71',
    C:   '#95a5a6',
};

function tierColor(tier) {
    return TIER_COLORS[tier] || '#95a5a6';
}

module.exports = {
    getWeapons,
    getSeason,
    findWeapon,
    searchWeapons,
    byTier,
    byCategory,
    categories,
    statBar,
    tierColor,
    TIER_ORDER,
};

