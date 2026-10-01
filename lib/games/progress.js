// ═══════════════════════════════════════════════════════════════════════════
// GAME PROGRESS — one economy for every ARCHON game
// • Same level curve as plugins/leveling.js (xpForLevel = (level / 0.1)²)
// • One daily cap per player per server, shared by all games
// • One stats table (game_stats) for every game's leaderboard and profile
// ═══════════════════════════════════════════════════════════════════════════
const DAILY = { credits: 1500, xp: 1000 };

const RANKS = [ // by player level; names live in gameui.json → ranks.*
  { min: 1,  key: 'recruit',         emoji: '🌱', color: 0x2ecc71 },
  { min: 6,  key: 'fieldAgent',      emoji: '🔹', color: 0x3498db },
  { min: 16, key: 'cyberSpecialist', emoji: '💠', color: 0x9b59b6 },
  { min: 31, key: 'bkoCommander',    emoji: '⚜️', color: 0xe67e22 },
  { min: 51, key: 'systemArchitect', emoji: '👑', color: 0xe74c3c },
];

const levelFromXp = (xp) => Math.floor(0.1 * Math.sqrt(Math.max(0, xp || 0))) + 1;
const rankForLevel = (level) => [...RANKS].reverse().find(r => level >= r.min) || RANKS[0];
const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10);

let ready = false;
function setup(db) {
  if (ready || !db) return;
  db.prepare(`
    CREATE TABLE IF NOT EXISTS game_daily (
      user_id TEXT NOT NULL, guild_id TEXT NOT NULL, day TEXT NOT NULL,
      credits INTEGER DEFAULT 0, xp INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, guild_id, day)
    )`).run();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS game_stats (
      game TEXT NOT NULL, user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
      points INTEGER DEFAULT 0, played INTEGER DEFAULT 0, won INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0, correct INTEGER DEFAULT 0, top_tier TEXT, last_played INTEGER DEFAULT 0,
      PRIMARY KEY (game, user_id, guild_id)
    )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_game_stats_board ON game_stats(game, guild_id, points DESC)`).run();
  try { db.prepare(`DELETE FROM game_daily WHERE day < ?`).run(dayKey(Date.now() - 7 * 86400000)); } catch {}
  ready = true;
}

// Adds credits/XP/game counters to the users row, the same way trivia and WRG always did.
function writeUser(client, db, { userId, guildId, username, credits, xp, played, won }) {
  const none = { oldLevel: null, newLevel: null, leveledUp: false };
  if (!credits && !xp && !played && !won) return none;
  try {
    if (client?.getUserData && client?.queueUserUpdate) {
      const d = client.getUserData(userId, guildId) || {};
      const newXp = (d.xp || 0) + xp;
      const oldLevel = d.level || levelFromXp(d.xp);
      const newLevel = Math.max(oldLevel, levelFromXp(newXp));
      client.queueUserUpdate(userId, guildId, {
        ...d, username: username || d.username,
        credits: (d.credits || 0) + credits, xp: newXp, level: newLevel,
        games_played: (d.games_played || 0) + played, games_won: (d.games_won || 0) + won,
      });
      return { oldLevel, newLevel, leveledUp: newLevel > oldLevel };
    }
    db.prepare('INSERT OR IGNORE INTO users (id, guild_id, username, xp, level, credits) VALUES (?, ?, ?, 0, 1, 0)').run(userId, guildId, username);
    const d = db.prepare('SELECT xp, level FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId) || {};
    const oldLevel = d.level || levelFromXp(d.xp);
    const newLevel = Math.max(oldLevel, levelFromXp((d.xp || 0) + xp));
    db.prepare(`UPDATE users SET credits = credits + ?, xp = xp + ?, level = ?,
      games_played = COALESCE(games_played, 0) + ?, games_won = COALESCE(games_won, 0) + ? WHERE id = ? AND guild_id = ?`)
      .run(credits, xp, newLevel, played, won, userId, guildId);
    return { oldLevel, newLevel, leveledUp: newLevel > oldLevel };
  } catch (e) {
    console.error('[GAMES] user update failed:', e.message);
    return none;
  }
}

// Pays credits/XP inside the shared daily cap. Returns what was actually paid and any level-up.
function award(client, db, { userId, guildId, username, credits = 0, xp = 0, played = 0, won = 0 }) {
  setup(db);
  const day = dayKey();
  let used = { credits: 0, xp: 0 };
  try { used = db.prepare('SELECT credits, xp FROM game_daily WHERE user_id = ? AND guild_id = ? AND day = ?').get(userId, guildId, day) || used; } catch {}
  const payC = Math.max(0, Math.min(credits, DAILY.credits - (used.credits || 0)));
  const payX = Math.max(0, Math.min(xp, DAILY.xp - (used.xp || 0)));
  if (payC || payX) {
    db.prepare(`INSERT INTO game_daily (user_id, guild_id, day, credits, xp) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, guild_id, day) DO UPDATE SET credits = credits + excluded.credits, xp = xp + excluded.xp`)
      .run(userId, guildId, day, payC, payX);
  }
  const lv = writeUser(client, db, { userId, guildId, username, credits: payC, xp: payX, played, won });
  return { credits: payC, xp: payX, capped: payC < credits || payX < xp, ...lv };
}

// Records one finished run in game_stats. tierOrder lets each game rank its own tiers.
function recordRun(db, { game, userId, guildId, username, points = 0, won = false, streak = 0, correct = 0, tier = null, tierOrder = [] }) {
  setup(db);
  try {
    const cur = db.prepare('SELECT top_tier FROM game_stats WHERE game = ? AND user_id = ? AND guild_id = ?').get(game, userId, guildId);
    const top = tier && tierOrder.indexOf(tier) > tierOrder.indexOf(cur?.top_tier) ? tier : (cur?.top_tier ?? tier);
    db.prepare(`
      INSERT INTO game_stats (game, user_id, guild_id, username, points, played, won, best_streak, correct, top_tier, last_played)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(game, user_id, guild_id) DO UPDATE SET
        username = excluded.username, points = points + excluded.points, played = played + 1,
        won = won + excluded.won, best_streak = MAX(best_streak, excluded.best_streak),
        correct = correct + excluded.correct, top_tier = excluded.top_tier, last_played = excluded.last_played`)
      .run(game, userId, guildId, username, points, won ? 1 : 0, streak, correct, top, Date.now());
  } catch (e) {
    console.error(`[GAMES] stats for ${game} failed:`, e.message);
  }
}

function board(db, game, guildId, limit = 10) {
  setup(db);
  try {
    return guildId
      ? db.prepare('SELECT username, points, won AS wins FROM game_stats WHERE game = ? AND guild_id = ? AND points > 0 ORDER BY points DESC LIMIT ?').all(game, guildId, limit)
      : db.prepare('SELECT MAX(username) AS username, SUM(points) AS points, SUM(won) AS wins FROM game_stats WHERE game = ? GROUP BY user_id HAVING SUM(points) > 0 ORDER BY points DESC LIMIT ?').all(game, limit);
  } catch { return []; }
}

function statsFor(db, game, userId, guildId) {
  setup(db);
  try {
    const here = db.prepare('SELECT * FROM game_stats WHERE game = ? AND user_id = ? AND guild_id = ?').get(game, userId, guildId) || null;
    const all = db.prepare(`SELECT COALESCE(SUM(points), 0) AS points, COALESCE(SUM(won), 0) AS wins, COALESCE(SUM(correct), 0) AS correct,
      COALESCE(MAX(best_streak), 0) AS best_streak FROM game_stats WHERE game = ? AND user_id = ?`).get(game, userId);
    return { here, all };
  } catch { return { here: null, all: { points: 0, wins: 0, correct: 0, best_streak: 0 } }; }
}

module.exports = { DAILY, RANKS, levelFromXp, rankForLevel, dayKey, setup, award, recordRun, board, statsFor };
