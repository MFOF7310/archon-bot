'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON CG-223 — PREMIUM PRICES, ONE PLACE
// The card price (USD) and the local price (Orange Money / Wave, in FCFA) live in the bot_meta table.
// Every text shows them through {priceUsd} and {priceXof} (lib/i18n fills them in), the dashboard and the
// support chat read them from /api/premium/info, and the owner changes them in the dashboard (Owner → Overview).
// The amount a card is really charged is set in Dodo Payments: change it there too.
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULTS = { usd: 3.40, xof: 1500 };
let current = { ...DEFAULTS };
let db = null;

function init(database) {
    db = database;
    try {
        db.prepare('CREATE TABLE IF NOT EXISTS bot_meta (key TEXT PRIMARY KEY, value TEXT)').run();
        const read = (k) => db.prepare('SELECT value FROM bot_meta WHERE key = ?').get(k)?.value;
        const usd = Number(read('price_usd')), xof = Number(read('price_xof'));
        if (usd > 0) current.usd = usd;
        if (xof > 0) current.xof = xof;
    } catch (e) { console.error('[PRICES] could not read prices:', e.message); }
    return current;
}

const get = () => ({ ...current });

// Saves new prices (a value left out keeps its current amount). Returns the prices now in force.
function set({ usd, xof } = {}) {
    const u = usd === undefined ? current.usd : Math.round(Number(usd) * 100) / 100;
    const x = xof === undefined ? current.xof : Math.round(Number(xof));
    if (!(u >= 0.5 && u <= 100)) throw new Error('usd_invalid');
    if (!(x >= 100 && x <= 100000)) throw new Error('xof_invalid');
    current = { usd: u, xof: x };
    if (db) {
        const save = db.prepare('INSERT OR REPLACE INTO bot_meta (key, value) VALUES (?, ?)');
        save.run('price_usd', String(u)); save.run('price_xof', String(x));
    }
    return get();
}

// "$3.40" · "3,40 $" · "3.40$" and "1,500 FCFA" · "1 500 FCFA", the way each language writes them
function usdText(lang, usd = current.usd) {
    const n = usd.toFixed(2);
    if (lang === 'fr') return `${n.replace('.', ',')} $`;
    if (lang === 'ar') return `${n}$`;
    return `$${n}`;
}
function xofText(lang, xof = current.xof) {
    const n = String(xof).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'fr' ? ' ' : ',');
    return `${n} FCFA`;
}

module.exports = { init, get, set, usdText, xofText, DEFAULTS };
