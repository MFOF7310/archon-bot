// ═══════════════════════════════════════════════════════════════════════════
// ARCHON INSIGHTS — records every command use (slash and prefix) for usage reports
// One row per use, kept 90 days. Called from bot-stats onCommandProcessed, which
// runs after every command on all three paths. It must never break a command.
// ═══════════════════════════════════════════════════════════════════════════
const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
let insert = null;
let lastPrune = 0;
let announced = false;
let warned = false;

function setup(db) {
  if (insert) return;
  db.prepare(`CREATE TABLE IF NOT EXISTS command_events (
    ts INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    command TEXT NOT NULL,
    slash INTEGER NOT NULL DEFAULT 0
  )`).run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_command_events_guild_ts ON command_events(guild_id, ts)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_command_events_ts ON command_events(ts)').run();
  insert = db.prepare('INSERT INTO command_events (ts, guild_id, user_id, command, slash) VALUES (?, ?, ?, ?, ?)');
}

// The command is stored as typed (aliases included); the report merges aliases later.
function record(db, { guildId, userId, command, slash = false }) {
  try {
    if (!db || !guildId || !userId || !command) return;
    setup(db);
    const now = Date.now();
    insert.run(now, String(guildId), String(userId), String(command).toLowerCase().slice(0, 64), slash ? 1 : 0);
    if (!announced) { announced = true; console.log('[INSIGHTS] recording command usage'); }
    if (now - lastPrune > DAY_MS) {
      lastPrune = now;
      db.prepare('DELETE FROM command_events WHERE ts < ?').run(now - RETENTION_DAYS * DAY_MS);
    }
  } catch (e) {
    if (!warned) { warned = true; console.error('[INSIGHTS] record failed:', e.message); }
  }
}

module.exports = { record, setup, RETENTION_DAYS };
