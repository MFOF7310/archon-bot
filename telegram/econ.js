// telegram/econ.js — the Telegram economy account of a member. Telegram members have their own row (guild_id
// 'telegram') in the shared users table; Discord rows are per server and never touched from here.
const G = 'telegram';

function getUser(db, userId) {
    return db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(String(userId), G) || null;
}
function ensureUser(db, userId, username) {
    try {
        db.prepare(`INSERT OR IGNORE INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_messages, games_played, games_won, total_winnings, gaming, last_xp_gain, total_dailies, highest_streak, streak_protections)
            VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0, 0, 0, '{"game":"CODM","rank":"Unranked"}', 0, 0, 0, 0)`).run(String(userId), G, username || 'User');
    } catch (e) { console.error('[TG ECON] create:', e.message); }
    return getUser(db, userId);
}
function update(db, userId, fields) {
    const keys = Object.keys(fields);
    db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND guild_id = ?`).run(...keys.map((k) => fields[k]), String(userId), G);
}

const levelOf = (xp) => Math.floor(0.1 * Math.sqrt(xp || 0)) + 1;
const RANK_LV = [1, 6, 16, 31, 51];
const rankIndex = (level) => RANK_LV.reduce((i, lv, n) => (level >= lv ? n : i), 0);
const bar = (pct) => { const f = Math.max(0, Math.min(10, Math.round(pct / 10))); return '▰'.repeat(f) + '▱'.repeat(10 - f); };
// Progress inside the current level
function progress(xp, level) {
    const lo = Math.pow((level - 1) / 0.1, 2), hi = Math.pow(level / 0.1, 2);
    return { pct: Math.max(0, Math.min(100, Math.round(((xp || 0) - lo) / (hi - lo) * 100))), need: Math.max(0, Math.ceil(hi - (xp || 0))) };
}

module.exports = { G, getUser, ensureUser, update, levelOf, RANK_LV, rankIndex, bar, progress };
