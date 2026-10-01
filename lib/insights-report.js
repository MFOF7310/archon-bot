// ═══════════════════════════════════════════════════════════════════════════
// ARCHON INSIGHTS — turns command_events into a usage report (numbers only).
// The dashboard writes the sentences; this file never returns user IDs.
//
//   report(db, { guildId, days: 7 | 30, aliases: Map(alias → command), known: [command names] })
//
// Honesty rules built in:
//   • dataSince says when recording started, so the panel can say "only 2 days of data so far"
//   • comparisons with the previous period are only returned when that period is fully covered
//   • times are UTC; the panel converts them to the viewer's timezone
// ═══════════════════════════════════════════════════════════════════════════
const DAY = 24 * 60 * 60 * 1000;
const MIN_FOR_TREND = 5; // a command needs at least this many uses (now + before) to be called rising or falling

function report(db, { guildId, days = 7, aliases = new Map(), known = [], now = Date.now() }) {
  days = days === 30 ? 30 : 7;
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
  const perCmd = new Map(); // command → { count, users:Set, prev }
  const entry = (name) => perCmd.get(name) || perCmd.set(name, { count: 0, users: new Set(), prev: 0 }).get(name);
  for (const r of pairs(start, now + 1)) { const e = entry(canon(r.command)); e.count += r.c; e.users.add(r.user_id); }
  if (comparable) for (const r of pairs(prevStart, start)) entry(canon(r.command)).prev += r.c;

  const hours = new Array(24).fill(0);
  for (const r of db.prepare('SELECT (ts % 86400000) / 3600000 AS h, COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ? GROUP BY h').all(G, start, now + 1)) hours[r.h] = r.n;

  const dayLabel = (n) => new Date(n * DAY).toISOString().slice(0, 10); // n = whole days since 1970 (UTC)
  const perDay = new Map();
  for (let i = days - 1; i >= 0; i--) perDay.set(Math.floor((now - i * DAY) / DAY), 0);
  for (const r of db.prepare('SELECT ts / 86400000 AS d, COUNT(*) AS n FROM command_events WHERE guild_id = ? AND ts >= ? AND ts < ? GROUP BY d').all(G, start, now + 1)) {
    if (perDay.has(r.d)) perDay.set(r.d, r.n);
  }

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
    days, now, windowStart: start, dataSince,
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
    hoursUtc: hours,
    daily: [...perDay.entries()].map(([n, count]) => ({ date: dayLabel(n), count })),
  };
}

module.exports = { report };
