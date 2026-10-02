// ═══════════════════════════════════════════════════════════════════════════
// ARCHON INSIGHTS — bot-side routes (loopback only, called by the dashboard server):
//   GET /api/insights/:guildId?days=7|30&tz=<minutes>
//   GET /api/insights/:guildId/day/:date?tz=<minutes>
// Builds the alias map from the loaded commands, so ".quiz" counts as "trivia".
// Answers are cached for 10 seconds: a refresh button shows fresh numbers, a refresh storm costs nothing.
// ═══════════════════════════════════════════════════════════════════════════
const { report, dayDetail, clampTz } = require('./insights-report');

const TTL_MS = 10 * 1000;
const cache = new Map();

function commandMaps(client) {
  const aliases = new Map();
  const known = new Set();
  for (const c of client.commands?.values?.() || []) {
    const name = String(c.name || c.data?.name || '').toLowerCase();
    if (!name) continue;
    if (/owner|dev|system/i.test(String(c.category || ''))) continue; // internal commands are not "unused features"
    known.add(name);
    for (const a of c.aliases || []) aliases.set(String(a).toLowerCase(), name);
    const slash = c.data?.name ? String(c.data.name).toLowerCase() : null;
    if (slash && slash !== name) aliases.set(slash, name);
  }
  return { aliases, known: [...known] };
}

function cached(key, build, res) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return res.json(hit.data);
  try {
    const data = build();
    if (data === null) return res.status(400).json({ error: 'out of range' }); // a bad request, not a failure: not cached, not logged
    if (cache.size > 300) cache.clear();
    cache.set(key, { at: Date.now(), data });
    return res.json(data);
  } catch (e) {
    console.error('[INSIGHTS] report failed:', e.message);
    return res.status(500).json({ error: 'report failed' });
  }
}

const guildOf = (req) => String(req.params?.guildId || '');
const okGuild = (g) => /^\d{15,25}$/.test(g);

function handle(req, res, db, client) {
  const guildId = guildOf(req);
  if (!okGuild(guildId)) return res.status(400).json({ error: 'bad guild id' });
  const days = String(req.query?.days) === '30' ? 30 : 7;
  const tz = clampTz(req.query?.tz);
  return cached(`${guildId}:${days}:${tz}`, () => {
    require('./insights').setup(db); // makes sure the table exists, even before the first command of the day
    return report(db, { guildId, days, tz, ...commandMaps(client) });
  }, res);
}

function handleDay(req, res, db, client) {
  const guildId = guildOf(req);
  if (!okGuild(guildId)) return res.status(400).json({ error: 'bad guild id' });
  const date = String(req.params?.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'bad date' });
  const tz = clampTz(req.query?.tz);
  return cached(`${guildId}:day:${date}:${tz}`, () => {
    require('./insights').setup(db);
    return dayDetail(db, { guildId, date, tz, aliases: commandMaps(client).aliases });
  }, res);
}

module.exports = { handle, handleDay, commandMaps };
