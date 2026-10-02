// ═══════════════════════════════════════════════════════════════════════════
// ARCHON CG-223 — BOT PERMISSIONS, IN PLAIN WORDS
// Says what ARCHON itself is missing (and how to fix it) instead of failing silently or with Discord's raw error.
//
//   guard(ctx, cmdName, lang?)             before a command runs: null when all is fine, else { text } to send instead
//   explainError(err, ctx, cmdName, lang?) after Discord refused with "Missing Permissions": the text, or null for other errors
//   channelStatus(guild, channel, ctx)     after an admin sets a log channel: { ok, text }
//   channelText(guild, channel, ctx)       the same, as text only, and it never throws
//   hierarchyText(guild, target, 'ban'|'kick', fallback, ctx)   why a person can not be banned/kicked (role order, owner...), never throws
//   langOf(ctx)    say(ctx, text)
//
// ctx is a Message or an Interaction. Texts live in lang/<locale>/botperms.json (an empty text falls back to English).
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionFlagsBits: P } = require('discord.js');
const canPost = require('./canPost');
const i18n = require('./i18n');

// Commands whose need is unambiguous. Everything else is covered by explainError, whatever the command.
const NEEDS = {
  ban:   [['Ban Members', P.BanMembers]],
  kick:  [['Kick Members', P.KickMembers]],
  clear: [['Manage Messages', P.ManageMessages]],
  pin:   [['Manage Messages', P.ManageMessages]],
};

// Discord's own wording for the permissions above (canPost.localize covers the common channel ones).
const LABELS = {
  fr: { 'Ban Members': 'Bannir des membres', 'Kick Members': 'Expulser des membres', 'Manage Messages': 'Gérer les messages' },
  zh: { 'Ban Members': '封禁成员', 'Kick Members': '踢出成员', 'Manage Messages': '管理消息' },
};

const T = (key, lang, vars) => i18n.t(`botperms.${key}`, lang, vars);
const botName = (me) => me.roles?.botRole?.name || me.displayName || 'ARCHON';
const permNames = (list, lang) => list.map((n) => LABELS[lang]?.[n] || canPost.localize([n], lang)[0]).join(', ');
const isInteraction = (ctx) => typeof ctx?.isChatInputCommand === 'function' || typeof ctx?.isCommand === 'function';

// Slash: the same rule as everywhere else (an explicit server language wins, else the user's Discord locale).
// Messages: the server language when set, else the server's own locale.
function langOf(ctx) {
  if (isInteraction(ctx)) return i18n.slashLang(ctx);
  const guild = ctx?.guild, client = ctx?.client;
  const set = guild ? (client?.settings?.get(guild.id)?.language || client?.getServerSettings?.(guild.id)?.language) : null;
  if (set && set !== 'auto' && i18n.LANGS.includes(set)) return set;
  const loc = String(guild?.preferredLocale || '').toLowerCase();
  if (loc.startsWith('fr')) return 'fr';
  if (loc.startsWith('zh')) return 'zh';
  return 'en';
}

const fill = (d, me, lang) => ({ bot: botName(me), perms: permNames(d.missing || [], lang), role: d.role || T('someRole', lang) });

function guard(ctx, cmdName, lang) {
  const needs = NEEDS[String(cmdName || '').toLowerCase()];
  const guild = ctx?.guild, me = guild?.members?.me;
  if (!needs || !guild || !me) return null;
  const channel = ctx.channel || guild.channels?.cache?.get(ctx.channelId);
  if (!channel?.permissionsFor) return null;
  const d = canPost.diagnose(guild, channel, me, needs);
  if (d.ok) return null;
  lang = lang || langOf(ctx);
  return { reason: d.reason, text: T(canPost.keyFor('botNoPerms', d.reason), lang, fill(d, me, lang)) };
}

function explainError(err, ctx, cmdName, lang) {
  const code = err?.code ?? err?.rawError?.code;
  if (code !== 50013 && code !== 50001) return null; // 50013 Missing Permissions, 50001 Missing Access
  lang = lang || langOf(ctx);
  const precise = guard(ctx, cmdName, lang);
  if (precise) return precise.text;
  const me = ctx?.guild?.members?.me;
  return T('botNoPermsUnknown', lang, { bot: me ? botName(me) : 'ARCHON' });
}

function channelStatus(guild, channel, ctx, feature) {
  const me = guild.members.me, lang = langOf(ctx);
  const d = canPost.diagnose(guild, channel, me, canPost.neededFor(feature || 'automod'));
  const channelText = String(channel);
  if (d.ok) return { ok: true, text: T('logSetOk', lang, { channel: channelText }) };
  return { ok: false, text: T(canPost.keyFor('logSet', d.reason), lang, { channel: channelText, ...fill(d, me, lang) }) };
}

// For the "set the log channel" commands: never throws, so the command's own reply can not be lost to a problem in here.
function channelText(guild, channel, ctx, feature) {
  try { return channelStatus(guild, channel, ctx, feature).text; } catch (e) { console.error('[botPerms]', e.message); return `✅ ${String(channel)}`; }
}

// When ban/kick find the person "not bannable"/"not kickable": by now ARCHON's own permission has been checked, so the real cause is
// almost always role order (or the person is the owner). Says which, and how to fix it. Never throws: it falls back to the old text.
function hierarchyText(guild, target, action, fallback, ctx) {
  try {
    const me = guild.members.me, lang = langOf(ctx);
    if (target?.id && target.id === guild.ownerId) return T('hierarchyOwner', lang, {});
    if (target?.id && target.id === me.id) return T('hierarchySelf', lang, {});
    const need = action === 'ban' ? ['Ban Members', P.BanMembers] : ['Kick Members', P.KickMembers];
    if (!me.permissions.has(need[1])) return T('botNoPermsMissingPerm', lang, { bot: botName(me), perms: permNames([need[0]], lang) });
    const role = target?.roles?.highest;
    if (!role || role.id === guild.id) return fallback; // a member with no roles: nothing to move above, keep the old text
    return T(action === 'ban' ? 'hierarchyBan' : 'hierarchyKick', lang, { target: target.displayName || target.user?.username || '?', role: role.name, bot: botName(me) });
  } catch (e) { console.error('[botPerms]', e.message); return fallback; }
}

async function say(ctx, text) {
  try {
    if (isInteraction(ctx)) {
      return (ctx.deferred || ctx.replied) ? await ctx.followUp({ content: text, flags: 1 << 6 }) : await ctx.reply({ content: text, flags: 1 << 6 });
    }
    return await ctx.reply(text);
  } catch { return null; }
}

module.exports = { guard, explainError, channelStatus, channelText, hierarchyText, langOf, say, NEEDS };
