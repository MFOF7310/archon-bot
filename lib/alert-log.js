'use strict';
// ═══ ARCHON CG-223 — ALERT LOG ═══
// One row per YouTube / TikTok alert actually posted (tests left out), kept 90 days.
// Only used to count ARCHON's work per server on the owner dashboard (Usage). It must never break an alert.
const RETENTION_MS = 90 * 86400000;
let ready = false;
let lastPrune = 0;

function setup(db) {
    if (ready) return;
    db.prepare('CREATE TABLE IF NOT EXISTS alert_events (ts INTEGER NOT NULL, guild_id TEXT NOT NULL, kind TEXT NOT NULL)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_alert_events_ts ON alert_events (ts)').run();
    ready = true;
}

// kind: 'youtube_live', 'youtube_video', 'tiktok_live', 'tiktok_video'
function record(db, guildId, kind) {
    try {
        if (!db || !guildId) return;
        setup(db);
        const now = Date.now();
        db.prepare('INSERT INTO alert_events (ts, guild_id, kind) VALUES (?, ?, ?)').run(now, String(guildId), String(kind));
        if (now - lastPrune > 86400000) { lastPrune = now; db.prepare('DELETE FROM alert_events WHERE ts < ?').run(now - RETENTION_MS); }
    } catch { /* counting only */ }
}

module.exports = { record, setup };
