// ═════════════════════════════════════════════════
// ARCHON SERVER HEALTH — bot-side routes (loopback only, called by the dashboard server, which checks Manage Server first):
//   GET  /api/health/:guildId?lang=en|fr|zh|ar|bm&fresh=1
//   POST /api/health/:guildId/test { channelId, feature, lang }   (x-api-key) a real, silent test message, deleted after 10 s
// "Can ARCHON really do what this server set up?" Uses the SAME logic as /postcheck and the alerts (lib/canPost):
//   - every channel ARCHON posts in (settings, YouTube/TikTok alerts, running giveaways): can it post there, with exactly
//     what that feature sends; if not, why and how to fix it (in the dashboard's language). "soft" = it posts, but looks worse
//   - the server-wide permissions the enabled features need (AutoMod, verification)
//   - the roles ARCHON must hand out (verification, auto role): still exist, and below ARCHON's own role
//   - what really failed lately (lib/postProblems): when, how often, why
// GET writes nothing. Answers are cached for 10 seconds; fresh=1 (the Re-check button) skips the cache.
// ═════════════════════════════════════════════════
const { PermissionFlagsBits: P } = require('discord.js');
const canPost = require('./canPost');
const i18n = require('./i18n');

const TTL_MS = 10 * 1000;
const cache = new Map();
const LANGS = ['en', 'fr', 'zh', 'ar', 'bm'];
const okGuild = (g) => /^\d{15,25}$/.test(g);

// settings column -> the feature that decides which permissions ARCHON needs there (null = the default set; 'card' = panels with buttons)
const CHANNELS = [
  ['log_channel', 'log'], ['mod_log_channel', 'modlog'], ['automod_log_channel', 'automod'], ['welcome_channel', 'welcome'], ['goodbye_channel', 'goodbye'],
  ['rules_channel', null], ['general_channel', null], ['daily_channel', null], ['shop_channel', null], ['market_channel', null], ['gift_channel', null],
  ['level_channel', null], ['levelup_channel', 'levelup-milestone'], ['updates_channel', null], ['ticket_log_channel', null], ['ticket_transcript_channel', null],
  ['ticket_panel_channel', 'card'], ['verify_panel_channel_id', 'card'],
];
// channels kept in their own tables: [setting, feature, query giving { id, detail }]
const EXTRA = [
  ['youtube_channel', 'youtube', "SELECT target_channel_id AS id, COALESCE('@' || youtube_handle, youtube_channel_id) AS detail FROM youtube_notifications WHERE guild_id = ?"],
  ['tiktok_channel', 'tiktok', "SELECT target_channel_id AS id, '@' || tiktok_username AS detail FROM tiktok_notifications WHERE guild_id = ?"],
  ['giveaway_channel', 'giveaway', "SELECT channel_id AS id, prize AS detail FROM giveaways WHERE guild_id = ? AND status = 'active'"],
];
const ROLES = ['verify_role_id', 'verify_unverified_role_id', 'auto_role_id'];
// the names of the server-wide permissions as Discord's own interface shows them (canPost's table does not cover these)
const PERM_NAMES = {
  fr: { 'Manage Messages': 'Gérer les messages', 'Timeout Members': 'Exclure temporairement des membres', 'Ban Members': 'Bannir des membres', 'Manage Server': 'Gérer le serveur', 'Manage Roles': 'Gérer les rôles' },
  zh: { 'Manage Messages': '管理消息', 'Timeout Members': '超时成员', 'Ban Members': '封禁成员', 'Manage Server': '管理服务器', 'Manage Roles': '管理身份组' },
};

function build(guild, row, lang, db) {
  const me = guild.members.me;
  const T = (key, vars) => i18n.t('postcheck.' + key, lang, vars);

  const bot = me.roles.botRole?.name || me.displayName;
  const channels = [];
  const check = (setting, id, feature, extra = {}) => {
    const base = { setting, channelId: String(id), feature: feature && feature !== 'card' ? feature : null, ...extra };
    const ch = guild.channels.cache.get(String(id));
    if (!ch) return channels.push({ ...base, channelName: null, status: 'missing' });
    if (!ch.isTextBased?.() || ch.isThread?.() || typeof ch.permissionsFor !== 'function') return channels.push({ ...base, channelName: ch.name, status: 'not_text' });
    const needed = feature === 'card' ? canPost.CARD_NEEDED : canPost.neededFor(feature || undefined);
    const d = canPost.diagnose(guild, ch, me, needed, { soft: true });
    const vars = (missing, role) => ({ channel: '#' + ch.name, bot, perms: canPost.localize(missing || [], lang).join(', '), role: role || T('someRole') });
    if (d.ok) {
      // it posts, but something makes it look worse: reported apart, so a dashboard that does not know "soft" still reads this as fine
      const soft = d.soft?.length ? { soft: d.soft, softWhy: T('whySoft', vars(d.soft)), softFix: T('fixSoft', vars(d.soft)) } : {};
      return channels.push({ ...base, channelName: ch.name, status: 'ok', ...soft });
    }
    channels.push({ ...base, channelName: ch.name, status: 'blocked', reason: d.reason, missing: d.missing || [], role: d.role || null, blocker: d.blocker?.type || null,
      why: T(canPost.keyFor('why', d.reason), vars(d.missing, d.role)), fix: T(canPost.keyFor('fix', d.reason), vars(d.missing, d.role)) });
  };
  for (const [col, feature] of CHANNELS) if (row?.[col]) check(col, row[col], feature);
  if (db) {
    for (const [setting, feature, sql] of EXTRA) {
      let rows = [];
      try { rows = db.prepare(sql).all(guild.id); } catch { rows = []; } // that feature was never used here: no table yet
      for (const r of rows) if (r.id) check(setting, r.id, feature, { detail: r.detail ? String(r.detail).slice(0, 80) : null });
    }
  }

  // server-wide permissions, only for the features that are switched on
  const permissions = [];
  const need = (feature, list) => { for (const [name, bit] of list) permissions.push({ feature, name: (PERM_NAMES[lang] || {})[name] || canPost.localize([name], lang)[0], ok: !!me.permissions.has(bit) }); };
  if (Number(row?.automod_enabled) === 1) need('automod', [['Manage Messages', P.ManageMessages], ['Timeout Members', P.ModerateMembers], ['Ban Members', P.BanMembers], ['Manage Server', P.ManageGuild]]);
  if (Number(row?.verify_enabled) === 1) need('verify', [['Manage Roles', P.ManageRoles]]);

  // roles ARCHON has to give out: a role at or above ARCHON's own cannot be assigned, even by an administrator
  const roles = [];
  const top = me.roles?.highest?.position ?? 0;
  for (const col of ROLES) {
    const id = row?.[col];
    if (!id) continue;
    const r = guild.roles.cache.get(String(id));
    if (!r) roles.push({ setting: col, roleId: String(id), roleName: null, status: 'missing' });
    else roles.push({ setting: col, roleId: r.id, roleName: r.name, status: r.position >= top ? 'above' : 'ok' });
  }

  // what really failed (lib/postProblems): when, how often, and why, in the same words as the checks above
  const failures = [];
  if (db) {
    const journal = require('./postProblems');
    for (const f of journal.list(db, guild.id)) {
      const ch = f.channelId ? guild.channels.cache.get(String(f.channelId)) : null;
      const vars = { channel: ch ? '#' + ch.name : T('alertNoChannel'), bot, perms: canPost.localize(f.missing, lang).join(', '), role: f.role || T('someRole') };
      failures.push({ ...f, label: journal.label(f.feature, lang), channelName: ch ? ch.name : null,
        why: T(canPost.keyFor('why', f.reason), vars), fix: T(canPost.keyFor('fix', f.reason), vars) });
    }
  }

  const problems = channels.filter((c) => c.status !== 'ok').length + permissions.filter((p) => !p.ok).length + roles.filter((r) => r.status !== 'ok').length;
  const warnings = channels.filter((c) => c.soft?.length).length;
  return { guild: { id: guild.id, name: guild.name }, checkedAt: Date.now(), lang, channels, permissions, roles, failures, summary: { channelsChecked: channels.length, problems, warnings, failures: failures.length } };
}

function handle(req, res, db, client) {
  const gid = String(req.params?.guildId || '');
  if (!okGuild(gid)) return res.status(400).json({ error: 'invalid guild id' });
  const lang = LANGS.includes(String(req.query?.lang)) ? String(req.query.lang) : 'en';
  const guild = client.guilds?.cache?.get(gid);
  if (!guild || !guild.members?.me) return res.status(404).json({ error: 'ARCHON is not in this server' });
  const key = `${gid}|${lang}`;
  const hit = cache.get(key);
  if (hit && req.query?.fresh !== '1' && Date.now() - hit.at < TTL_MS) return res.json(hit.data);
  try {
    const row = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(gid) || {};
    const data = build(guild, row, lang, db);
    if (cache.size > 300) cache.clear();
    cache.set(key, { at: Date.now(), data });
    return res.json(data);
  } catch (e) {
    console.error('[HEALTH] check failed:', e.message);
    return res.status(500).json({ error: 'health check failed' });
  }
}

// "Send a test": the feature's own check first, then a real message (no notification, no mention), deleted after 10 seconds.
// A success also clears that feature's failure; a refusal is recorded without an alert (the admin is looking at it).
async function handleTest(req, res, db, client) {
  const gid = String(req.params?.guildId || '');
  if (!okGuild(gid)) return res.status(400).json({ error: 'invalid guild id' });
  const body = req.body || {};
  const lang = LANGS.includes(String(body.lang)) ? String(body.lang) : 'en';
  const channelId = String(body.channelId || '');
  const feature = /^[a-z][a-z-]{1,40}$/.test(String(body.feature || '')) ? String(body.feature) : null;
  if (!/^\d{15,25}$/.test(channelId)) return res.status(400).json({ error: 'invalid channel id' });
  const guild = client.guilds?.cache?.get(gid);
  if (!guild || !guild.members?.me) return res.status(404).json({ error: 'ARCHON is not in this server' });
  const wait = client.rateWait?.(`healthtest:${gid}`, 3, 60000);
  if (wait) return res.set('Retry-After', String(wait)).status(429).json({ error: 'slow_down', retryAfter: wait });
  const T = (key, vars) => i18n.t('postcheck.' + key, lang, vars);
  const me = guild.members.me;
  const ch = guild.channels.cache.get(channelId) || null;
  const answer = (d) => {
    const vars = { channel: ch ? '#' + ch.name : T('alertNoChannel'), bot: me.roles.botRole?.name || me.displayName, perms: canPost.localize(d.missing || [], lang).join(', '), role: d.role || T('someRole') };
    return res.json({ ok: false, reason: d.reason, missing: d.missing || [], why: T(canPost.keyFor('why', d.reason), vars), fix: T(canPost.keyFor('fix', d.reason), vars) });
  };
  const d = canPost.diagnose(guild, ch, me, canPost.neededFor(feature || undefined));
  if (!d.ok) return answer(d);
  const { safeSend } = require('./safeSend');
  const SILENT = 1 << 12; // SuppressNotifications
  const msg = await safeSend(feature || 'test', ch, { content: T('testMessage'), flags: SILENT, allowedMentions: { parse: [] } }, { alert: false, quiet: !feature });
  if (!msg) return answer({ reason: 'refused', missing: [] });
  setTimeout(() => msg.delete?.().catch(() => {}), 10000);
  cache.clear();
  return res.json({ ok: true });
}

module.exports = { handle, handleTest, build };
