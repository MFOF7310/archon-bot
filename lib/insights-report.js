// ═══════════════════════════════════════════════════════════════════════════
// ARCHON INSIGHTS — turns command_events into usage reports (numbers only, never user IDs).
//
//   report(db, { guildId, days: 7 | 30, tz, aliases, known })   the whole period
//   dayDetail(db, { guildId, date: 'YYYY-MM-DD', tz, aliases })  one day, hour by hour
//
// tz = the viewer's offset from UTC in minutes (Paris in summer = 120). Days and hours follow it,
// so "Thursday" means the viewer's Thursday. A fixed offset is used for the whole period.
//
// Honesty rules built in:
//   - dataSince says when recording started, so the panel can say "only 2 days of data so far"
//   - comparisons with the previous period only come back when that period is fully covered
//   - the period is a rolling 7 x 24 h (or 30 x 24 h), so comparing it with the previous one is fair
//     (a calendar-day window would compare a half-finished today with whole days)
// ═══════════════════════════════════════════════════════════════════════════
const DAY = 24 * 60 * 60 * 1000;
const MIN_FOR_TREND = 5; // a command needs at least this many uses (now + before) to be called rising or falling

const clampTz = (m) => { m = Math.round(Number(m)); return Number.isFinite(m) ? Math.max(-720, Math.min(840, m)) : 0; };
const localDay = (ts, off) => Math.floor((ts + off) / DAY);          // whole days since 1970, in the viewer's day
const dayName = (idx) => new Date(idx * DAY).toISOString().slice(0, 10); // YYYY-MM-DD of that local day

function report(db, { guildId, days = 7, aliases = new Map(), known = [], tz = 0, now = Date.now() }) {
  days = days === 30 ? 30 : 7;
  const OFF = clampTz(tz) * 60000; // a clamped whole number: safe to put straight into the SQL below
  const start = now - days * DAY;
  const prevStart = start - days * DAY;
  const canon = (c) => aliases.get(c) || c;

  const first = db.prepare('SELECT MIN(ts) AS t FROM command_events').get();
  const dataSince = first?.t || null;
  const comparable = dataSince !== null && dataSince <= prevStart + DAY;

  const G = String(guildId);
  const win = (from, to) => db.prepare(
    'SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS u, COALESCE(SUM(slash), 0) AS s FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ?'
  ).get(G, from, to);
  const cur = win(start, now + 1);
  const prev = win(prevStart, start);

  // one row per (command, person) per window: small, and lets merged aliases keep an exact unique-user count
  const pairs = (from, to) => db.prepare(
    'SELECT command, user_id, COUNT(*) AS c FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ? GROUP BY command, user_id'
  ).all(G, from, to);
  const perCmd = new Map(); // command -> { count, users:Set, prev }
  const entry = (name) => perCmd.get(name) || perCmd.set(name, { count: 0, users: new Set(), prev: 0 }).get(name);
  for (const r of pairs(start, now + 1)) { const e = entry(canon(r.command)); e.count += r.c; e.users.add(r.user_id); }
  if (comparable) for (const r of pairs(prevStart, start)) entry(canon(r.command)).prev += r.c;

  const hoursAt = (off) => {
    const a = new Array(24).fill(0);
    for (const r of db.prepare(`SELECT ((ts + ${off}) % 86400000) / 3600000 AS h, COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ? GROUP BY h`).all(G, start, now + 1)) a[r.h] = r.n;
    return a;
  };

  // the same rolling period, split by the viewer's calendar days: the bars add up to the total.
  // The first bar can be a partial day (the period starts mid-day) and the last one is today so far.
  const firstIdx = localDay(start, OFF), lastIdx = localDay(now, OFF);
  const perDay = new Map();
  for (let i = firstIdx; i <= lastIdx; i++) perDay.set(i, 0);
  for (const r of db.prepare(`SELECT (ts + ${OFF}) / 86400000 AS d, COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ? GROUP BY d`).all(G, start, now + 1)) {
    if (perDay.has(r.d)) perDay.set(r.d, r.n);
  }
  const daily = [...perDay.entries()].map(([idx, count]) => ({
    date: dayName(idx), count, first: idx === firstIdx && (start + OFF) % DAY !== 0, today: idx === lastIdx,
  }));

  // "new" = first recorded command ever falls inside this window
  const newUsers = db.prepare(
    'SELECT COUNT(*) AS n FROM (SELECT user_id FROM command_events WHERE guild_id = ? GROUP BY user_id HAVING MIN(ts) >= ?)'
  ).get(G, start).n;

  const list = [...perCmd.entries()].map(([command, e]) => ({ command, count: e.count, users: e.users.size, prev: e.prev }));
  const used = list.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  const trend = comparable
    ? used.concat(list.filter((c) => c.count === 0 && c.prev > 0))
        .filter((c) => c.count + c.prev >= MIN_FOR_TREND)
        .map((c) => ({ command: c.command, count: c.count, prev: c.prev, change: c.prev ? Math.round(((c.count - c.prev) / c.prev) * 100) : null }))
    : [];
  const usedNames = new Set(used.map((c) => c.command));

  return {
    days, now, windowStart: start, dataSince, tzMinutes: OFF / 60000,
    daysOfData: dataSince ? Math.max(0, Math.floor((now - dataSince) / DAY)) : 0,
    comparable,
    totals: {
      commands: cur.n, users: cur.u, newUsers, returningUsers: cur.u - newUsers,
      slashShare: cur.n ? Math.round((cur.s / cur.n) * 100) : 0,
    },
    prev: comparable ? { commands: prev.n, users: prev.u } : null,
    top: used.slice(0, 10),
    rising: trend.filter((c) => c.change === null || c.change >= 25).sort((a, b) => (b.count - b.prev) - (a.count - a.prev)).slice(0, 5),
    falling: trend.filter((c) => c.change !== null && c.change <= -25).sort((a, b) => (a.count - a.prev) - (b.count - b.prev)).slice(0, 5),
    unused: [...new Set(known)].filter((n) => !usedNames.has(n)).sort().slice(0, 30),
    heat: (() => {         // 7 rows (Sunday first) x 24 hours, in the viewer's timezone
      const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
      for (const r of db.prepare(`SELECT (((ts + ${OFF}) / 86400000) + 4) % 7 AS wd, ((ts + ${OFF}) % 86400000) / 3600000 AS h, COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ? GROUP BY wd, h`).all(G, start, now + 1)) {
        if (grid[r.wd] && r.h >= 0 && r.h < 24) grid[r.wd][r.h] = r.n;
      }
      return grid;
    })(),
    hours: hoursAt(OFF),   // in the viewer's timezone
    hoursUtc: hoursAt(0),  // kept so a dashboard from before this version keeps working
    daily,
  };
}

// What happened on one of the viewer's days, hour by hour.
function dayDetail(db, { guildId, date, aliases = new Map(), tz = 0, now = Date.now() }) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t0 = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t0) || new Date(t0).toISOString().slice(0, 10) !== date) return null; // rejects 2026-02-31
  const OFF = clampTz(tz) * 60000;
  const idx = Math.floor(t0 / DAY);
  const todayIdx = localDay(now, OFF);
  if (idx > todayIdx || idx < todayIdx - 120) return null;

  const G = String(guildId);
  const from = idx * DAY - OFF, to = from + DAY;
  const canon = (c) => aliases.get(c) || c;
  const tot = db.prepare(
    'SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS u, COALESCE(SUM(slash), 0) AS s FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ?'
  ).get(G, from, to);

  const perCmd = new Map();
  for (const r of db.prepare('SELECT command, user_id, COUNT(*) AS c FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ? GROUP BY command, user_id').all(G, from, to)) {
    const name = canon(r.command);
    const e = perCmd.get(name) || perCmd.set(name, { count: 0, users: new Set() }).get(name);
    e.count += r.c; e.users.add(r.user_id);
  }
  const top = [...perCmd.entries()].map(([command, e]) => ({ command, count: e.count, users: e.users.size })).sort((a, b) => b.count - a.count).slice(0, 8);

  const hours = new Array(24).fill(0);
  for (const r of db.prepare(`SELECT ((ts + ${OFF}) % 86400000) / 3600000 AS h, COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ? GROUP BY h`).all(G, from, to)) hours[r.h] = r.n;

  // a "typical day lately": the average of up to 14 earlier days, counting only days recording was running
  const since = db.prepare('SELECT MIN(ts) AS t FROM command_events').get()?.t;
  const bFrom = Math.max(idx - 14, since ? localDay(since, OFF) : idx);
  const nDays = idx - bFrom;
  let baseline = null;
  if (nDays >= 3) {
    const b = db.prepare('SELECT COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ?').get(G, bFrom * DAY - OFF, from).n;
    baseline = Math.round((b / nDays) * 10) / 10;
  }
  return {
    date, isToday: idx === todayIdx,
    totals: { commands: tot.n, users: tot.u, slashShare: tot.n ? Math.round((tot.s / tot.n) * 100) : 0 },
    top, hours, baseline,
  };
}

// The last hour, minute by minute, and the latest commands: what the panel shows as "live".
// Numbers and command names only, never who ran them.
function live(db, { guildId, aliases = new Map(), now = Date.now() }) {
  const G = String(guildId);
  const MIN = 60000;
  const end = Math.floor(now / MIN) * MIN + MIN;          // the end of the current minute
  const from = end - 60 * MIN;
  const perMinute = new Array(60).fill(0);
  // CAST: a bound number can arrive as a float, and minute 58.5 would land nowhere
  for (const r of db.prepare('SELECT CAST((ts - ?) / 60000 AS INTEGER) AS m, COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ? GROUP BY m').all(from, G, from, end)) {
    if (r.m >= 0 && r.m < 60) perMinute[r.m] = r.n;
  }
  const canon = (c) => aliases.get(c) || c;
  const recent = db.prepare('SELECT ts, command, slash FROM command_events WHERE guild_id = ? ORDER BY ts DESC LIMIT 12').all(G)
    .map((r) => ({ ts: r.ts, command: canon(r.command), slash: !!r.slash }));
  const users15 = db.prepare('SELECT COUNT(DISTINCT user_id) AS u FROM command_events WHERE guild_id = ? AND ts >= ?').get(G, now - 15 * MIN).u;
  const last5 = db.prepare('SELECT COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ?').get(G, now - 5 * MIN).n;
  return { now, from, perMinute, lastHour: perMinute.reduce((a, b) => a + b, 0), last5m: last5, activeUsers15m: users15, recent };
}

module.exports = { report, dayDetail, live, clampTz };
