// ═══════════════════════════════════════════════════════════════════════════
// ARCHON INSIGHTS — bot-side route: GET /api/insights/:guildId?days=7|30
// Called only by the dashboard server (the bot API listens on 127.0.0.1).
// Builds the alias map from the loaded commands, so ".quiz" counts as "trivia".
// Results are cached for 60 s so refreshing the page never hammers the database.
// ═══════════════════════════════════════════════════════════════════════════
const { report } = require('./insights-report');

const TTL_MS = 60 * 1000;
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

function handle(req, res, db, client) {
  const guildId = String(req.params?.guildId || '');
  if (!/^\d{15,25}$/.test(guildId)) return res.status(400).json({ error: 'bad guild id' });
  const days = String(req.query?.days) === '30' ? 30 : 7;
  const key = `${guildId}:${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return res.json(hit.data);
  try {
    require('./insights').setup(db); // makes sure the table exists, even before the first command of the day
    const data = report(db, { guildId, days, ...commandMaps(client) });
    if (cache.size > 200) cache.clear();
    cache.set(key, { at: Date.now(), data });
    return res.json(data);
  } catch (e) {
    console.error('[INSIGHTS] report failed:', e.message);
    return res.status(500).json({ error: 'report failed' });
  }
}

module.exports = { handle, commandMaps };
