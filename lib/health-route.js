// ═════════════════════════════════════════════════
// ARCHON SERVER HEALTH — bot-side route (loopback only, called by the dashboard server, which checks Manage Server first):
//   GET /api/health/:guildId?lang=en|fr|zh|ar|bm&fresh=1
// "Can ARCHON really do what this server set up?" Uses the SAME logic as the .postcheck command (lib/canPost):
//   - every channel configured in the settings: can ARCHON post there, and if not, why and how to fix it (in the dashboard's language)
//   - the server-wide permissions the enabled features need (AutoMod, verification)
//   - the roles ARCHON must hand out (verification, auto role): still exist, and below ARCHON's own role
// Nothing is written and no row is created. Answers are cached for 10 seconds; fresh=1 (the Re-check button) skips the cache.
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
  ['level_channel', null], ['levelup_channel', null], ['updates_channel', null], ['ticket_log_channel', null], ['ticket_transcript_channel', null],
  ['ticket_panel_channel', 'card'], ['verify_panel_channel_id', 'card'],
];
const ROLES = ['verify_role_id', 'verify_unverified_role_id', 'auto_role_id'];
// the names of the server-wide permissions as Discord's own interface shows them (canPost's table does not cover these)
const PERM_NAMES = {
  fr: { 'Manage Messages': 'Gérer les messages', 'Timeout Members': 'Exclure temporairement des membres', 'Ban Members': 'Bannir des membres', 'Manage Server': 'Gérer le serveur', 'Manage Roles': 'Gérer les rôles' },
  zh: { 'Manage Messages': '管理消息', 'Timeout Members': '超时成员', 'Ban Members': '封禁成员', 'Manage Server': '管理服务器', 'Manage Roles': '管理身份组' },
};

function build(guild, row, lang) {
  const me = guild.members.me;
  const T = (key, vars) => i18n.t('postcheck.' + key, lang, vars);

  const channels = [];
  for (const [col, feature] of CHANNELS) {
    const id = row?.[col];
    if (!id) continue;
    const base = { setting: col, channelId: String(id) };
    const ch = guild.channels.cache.get(String(id));
    if (!ch) { channels.push({ ...base, channelName: null, status: 'missing' }); continue; }
    if (!ch.isTextBased?.() || ch.isThread?.() || typeof ch.permissionsFor !== 'function') { channels.push({ ...base, channelName: ch.name, status: 'not_text' }); continue; }
    const needed = feature === 'card' ? (canPost.CARD_NEEDED || canPost.NEEDED) : canPost.neededFor(feature || undefined);
    const d = canPost.diagnose(guild, ch, me, needed);
    if (d.ok) { channels.push({ ...base, channelName: ch.name, status: 'ok' }); continue; }
    const vars = { channel: '#' + ch.name, bot: me.roles.botRole?.name || me.displayName, perms: canPost.localize(d.missing || [], lang).join(', '), role: d.role || T('someRole') };
    channels.push({ ...base, channelName: ch.name, status: 'blocked', reason: d.reason, missing: d.missing || [],
      why: T(canPost.keyFor('why', d.reason), vars), fix: T(canPost.keyFor('fix', d.reason), vars) });
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

  const problems = channels.filter((c) => c.status !== 'ok').length + permissions.filter((p) => !p.ok).length + roles.filter((r) => r.status !== 'ok').length;
  return { guild: { id: guild.id, name: guild.name }, checkedAt: Date.now(), lang, channels, permissions, roles, summary: { channelsChecked: channels.length, problems } };
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
    const data = build(guild, row, lang);
    if (cache.size > 300) cache.clear();
    cache.set(key, { at: Date.now(), data });
    return res.json(data);
  } catch (e) {
    console.error('[HEALTH] check failed:', e.message);
    return res.status(500).json({ error: 'health check failed' });
  }
}

module.exports = { handle, build };
