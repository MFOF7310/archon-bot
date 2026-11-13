'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON CG-223 — THE WELCOME WHEN ARCHON JOINS A SERVER
// One card that gets the server set up: /setup (four questions), /postcheck, the dashboard, and whether ARCHON got
// every permission its invite asks for (checked the moment it joins).
// Who gets it:
//   1. the person who added ARCHON, by DM (read from the audit log: the invite asks for View Audit Log)
//   2. else, in the server: the system channel, or the first text channel ARCHON can post in (that person mentioned)
// The owner gets no DM unless they are the one who added ARCHON.
// Commands are written as /name, not clickable mentions: in a DM they would open in the DM, and in a public
// channel members without the permission would see raw markup. In a DM, a button opens the server instead.
// Three cards, all in lang/<locale>/joined.json (en, fr, zh, ar):
//   · new server: three steps to get set up
//   · back within the 7 days the settings are kept: "welcome back, nothing to redo"
//   · removed: a DM to whoever added ARCHON, with the date the settings are deleted and a button to add it back
// Language: the person's /mylang, else the Discord language seen on their last interaction with ARCHON, else the
// server's. A row of language buttons on the DM card switches it (and that click tells us their real language).
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionFlagsBits: F, AuditLogEvent, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } = require('discord.js');
const i18n = require('./i18n');
const { card } = require('./games/v2');
const { icon } = require('./ui/icons');
const canPost = require('./canPost');
const { pickLang } = require('./pick-lang');
const { dashboardUrl } = require('./postProblems');

const SUPPORT_URL = 'https://discord.gg/NFSMFJajp9';
const SITE = (process.env.DASHBOARD_URL || 'https://bamako-steel-dev.xyz').replace(/\/+$/, '');
const GOLD = 0xE6A817, GREEN = 0x2ecc71, AMBER = 0xf0b232, GREY = 0x95a5a6;
const LANG_BTNS = [['en', 'EN'], ['fr', 'FR'], ['zh', '中文'], ['ar', 'العربية']];
const GRACE_MS = 7 * 24 * 3600 * 1000;
let memberLang = null; try { memberLang = require('./member-lang'); } catch { /* optional */ }

// ── Who added ARCHON, and the language people use ──
function db(client) { return client?.db; }
function ensureTables(client) {
    const d = db(client); if (!d) return;
    d.prepare('CREATE TABLE IF NOT EXISTS guild_inviters (guild_id TEXT PRIMARY KEY, user_id TEXT, at INTEGER)').run();
    d.prepare('CREATE TABLE IF NOT EXISTS user_locales (user_id TEXT PRIMARY KEY, locale TEXT, at INTEGER)').run();
}
// Called on every interaction (throttled): remembers the language of each person's Discord app
const seenLocale = new Map();
function rememberLocale(client, interaction) {
    try {
        const id = interaction?.user?.id, loc = String(interaction?.locale || '').split('-')[0].toLowerCase();
        if (!id || !loc) return;
        const last = seenLocale.get(id);
        if (last && last.loc === loc && Date.now() - last.at < 3600e3) return;
        seenLocale.set(id, { loc, at: Date.now() });
        ensureTables(client);
        db(client)?.prepare('INSERT OR REPLACE INTO user_locales (user_id, locale, at) VALUES (?, ?, ?)').run(id, loc, Date.now());
    } catch { /* never in the way */ }
}
const SUPPORTED = ['en', 'fr', 'zh', 'ar'];
function langFor(client, guild, userId) {
    try {
        const mine = memberLang?.get?.(userId, guild?.id) || memberLang?.get?.(userId, 'DM');
        if (SUPPORTED.includes(mine)) return mine;
    } catch { /* ignore */ }
    try {
        ensureTables(client);
        const row = db(client)?.prepare('SELECT locale FROM user_locales WHERE user_id = ?').get(String(userId));
        if (SUPPORTED.includes(row?.locale)) return row.locale;
    } catch { /* ignore */ }
    const l = pickLang(client, guild?.id, null, userId) || 'en';
    return SUPPORTED.includes(l) ? l : 'en';
}
const DATE_LOC = { en: 'en-GB', fr: 'fr-FR', zh: 'zh-CN', ar: 'ar' };
const fmtDate = (ms, lang) => new Date(ms).toLocaleDateString(DATE_LOC[lang] || 'en-GB', { day: 'numeric', month: 'long' });

// The language buttons, plus a re-check button while something needs fixing (it vanishes once all is well)
function langRow(gid, kind, lang, needsCheck = false) {
    const row = new ActionRowBuilder().addComponents(LANG_BTNS.map(([code, label]) => new ButtonBuilder()
        .setCustomId(`joined:lang:${gid}:${kind}:${code}`).setLabel(label)
        .setStyle(code === lang ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(code === lang)));
    if (needsCheck) row.addComponents(new ButtonBuilder().setCustomId(`joined:check:${gid}:${kind}:${lang}`).setEmoji(icon('refresh', null)).setStyle(ButtonStyle.Secondary));
    return row;
}
// What was kept for a server that comes back: its settings and how many members had XP or credits
function keptOf(client, gid) {
    const d = db(client);
    let settings = false, members = 0;
    try { settings = !!d?.prepare('SELECT 1 FROM server_settings WHERE guild_id = ?').get(gid); } catch { /* table may differ */ }
    try { members = d?.prepare('SELECT COUNT(*) AS n FROM users WHERE guild_id = ? AND (xp > 0 OR credits > 0)').get(gid)?.n || 0; } catch { /* ignore */ }
    return { settings, members };
}
const T = (key, lang, vars) => i18n.t(`joined.${key}`, lang, vars || {});
const esc = (s) => (typeof escapeMarkdown === 'function' ? escapeMarkdown(String(s)) : String(s));
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

// What ARCHON's invite asks for, and what each permission is for (the use keys are in joined.json → use)
const ASKED = [
    ['View Channel', F.ViewChannel, ['core']], ['Send Messages', F.SendMessages, ['core']],
    ['Embed Links', F.EmbedLinks, ['links']], ['Attach Files', F.AttachFiles, ['images']],
    ['Read Message History', F.ReadMessageHistory, ['prefix']], ['Use External Emojis', F.UseExternalEmojis, ['emojis']],
    ['Add Reactions', F.AddReactions, ['polls']], ['Send Messages in Threads', F.SendMessagesInThreads, ['threads']],
    ['Manage Roles', F.ManageRoles, ['verify', 'autoroles']], ['Manage Channels', F.ManageChannels, ['tickets']],
    ['Manage Messages', F.ManageMessages, ['automod']], ['Timeout Members', F.ModerateMembers, ['timeouts']],
    ['Kick Members', F.KickMembers, ['moderation']], ['Ban Members', F.BanMembers, ['moderation']],
    ['Manage Server', F.ManageGuild, ['automod']], ['Connect', F.Connect, ['music']], ['Speak', F.Speak, ['music']],
];
// Discord's French names for the permissions canPost does not translate
const PERM_FR = {
    'Add Reactions': 'Ajouter des réactions', 'Manage Messages': 'Gérer les messages', 'Timeout Members': 'Exclure temporairement des membres',
    'Kick Members': 'Expulser des membres', 'Ban Members': 'Bannir des membres', 'Manage Server': 'Gérer le serveur', 'Connect': 'Se connecter', 'Speak': 'Parler',
};
// French names in French; English everywhere else (the card itself falls back to English there)
const permName = (name, lang) => (lang === 'fr' ? PERM_FR[name] || canPost.localize([name], 'fr')[0] : name);

// "A, B and C" / "A, B et C"
function list(items, lang) {
    if (items.length < 2) return items.join('');
    return `${items.slice(0, -1).join(', ')}${lang === 'fr' ? ' et ' : ' and '}${items[items.length - 1]}`;
}

// The permissions the invite asked for that ARCHON does not have ([] when all are there, null when it cannot tell)
function missingPerms(guild) {
    const me = guild?.members?.me;
    if (!me?.permissions?.has) return null;
    if (me.permissions.has(F.Administrator)) return [];
    return ASKED.filter(([, bit]) => !me.permissions.has(bit));
}

function permsLine(missing, lang, where, bot) {
    if (missing === null) return null;
    if (!missing.length) return `${icon('ok', where)} ${T('permsOk', lang)}`;
    const names = list(missing.map(([n]) => `**${permName(n, lang)}**`), lang);
    const uses = list([...new Set(missing.flatMap(([, , u]) => u))].map((u) => T(`use.${u}`, lang)), lang);
    return `${icon('warn', where)} ${T(missing.length === 1 ? 'missingOne' : 'missingMany', lang, { perms: names, what: uses })}\n-# ${T('missingFix', lang, { bot: esc(bot) })}`;
}

// The card. to: 'inviter' (a DM) | 'channel'. kind: 'new' | 'back'. name: who it speaks to (null in a channel when nobody is known)
function build(client, guild, { lang = 'en', to = 'channel', kind = 'new', name = null, mention = null, missing = null, where = null } = {}) {
    const g = esc(guild.name);
    const bot = guild.members?.me?.roles?.botRole?.name || 'ARCHON';
    const who = mention ? `<@${mention}>` : name;
    const items = [];
    let head;
    if (kind === 'back') {
        head = `-# ${T('eyebrowBack', lang, { guild: g })}\n### ${T('backTitle', lang)}\n${T('backSub', lang)}`;
    } else {
        head = `-# ${T('eyebrowNew', lang, { guild: g })}\n### ${who ? T('thanks', lang, { user: who, guild: g }) : T('arrivedTitle', lang, { guild: g })}\n${T('sub', lang)}`;
    }
    let avatar = null;
    try { avatar = client.user.displayAvatarURL({ extension: 'png', size: 256 }); } catch { avatar = null; }
    items.push(avatar ? { thumbnail: [head, avatar] } : { text: head }, { rule: true });

    if (kind === 'back') {
        const kept = keptOf(client, guild.id);
        const lines = [];
        if (kept.settings) lines.push(`${icon('ok', where)} ${T('keptSettings', lang)}`);
        if (kept.members) lines.push(`${icon('ok', where)} ${T('keptMembers', lang, { n: kept.members })}`);
        if (!lines.length) lines.push(`${icon('ok', where)} ${T('keptSettings', lang)}`);
        items.push({ text: lines.join('\n') });
    } else {
        items.push({ text: [
            `**1.** ${T('stepSetup', lang, { cmd: '`/setup`' })}`,
            `**2.** ${T('stepCheck', lang, { cmd: '`/postcheck`' })}`,
            `**3.** ${T('stepDashboard', lang)}`,
        ].join('\n') });
    }
    const perms = permsLine(missing, lang, where, bot);
    const low = require('./role-check').lowRoleText(guild, lang);
    if (perms || low) items.push({ rule: true }, { text: [perms, low ? `${icon('warn', where)} ${low}` : null].filter(Boolean).join('\n\n') });

    const row = new ActionRowBuilder();
    if (to !== 'channel') row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}`).setLabel(cut(T('btnServer', lang, { guild: guild.name }), 80)).setEmoji(icon('home', where)));
    row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(dashboardUrl(guild.id)).setLabel(T('btnDashboard', lang)).setEmoji(icon('dashboard', where)));
    if (kind !== 'back') row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(SUPPORT_URL).setLabel(T('btnSupport', lang)).setEmoji(icon('messages', where)));
    items.push({ row });
    if (to === 'inviter') {
        items.push({ row: langRow(guild.id, kind, lang, !!(missing?.length || low)) });
        items.push({ text: `-# ${T('whyInviter', lang, { guild: g })}` });
    }
    const color = (missing?.length || require('./role-check').hierarchy(guild)?.lowest) ? AMBER : kind === 'back' ? GREEN : GOLD;
    const out = card(color, items);
    if (mention) out.allowedMentions = { parse: [], users: [String(mention)] };
    return out;
}

// The DM sent to whoever added ARCHON when it is removed
function buildRemoved(guildId, guildName, lang, leftAt) {
    const g = esc(guildName || '?');
    const back = `${SITE}/go/comeback?guild=${guildId}`;
    return card(GREY, [
        { text: `-# ${T('eyebrowRemoved', lang, { guild: g })}\n### ${T('removedTitle', lang, { guild: g })}\n${T('removedSub', lang, { date: fmtDate(leftAt + GRACE_MS, lang) })}` },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(back).setLabel(T('btnAddBack', lang)).setEmoji(icon('join', null)),
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(SUPPORT_URL).setLabel(T('btnWhy', lang)).setEmoji(icon('messages', null)),
        ) },
        { text: `-# ${T('whyInviter', lang, { guild: g })}` },
    ]);
}

// Who added ARCHON: the latest "bot added" entry of the audit log (null when the admin unticked View Audit Log)
async function inviterOf(client, guild) {
    try {
        if (!guild.members?.me?.permissions?.has?.(F.ViewAuditLog)) return null;
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
        const entry = [...logs.entries.values()].find((e) => e.target?.id === client.user.id && Date.now() - (e.createdTimestamp || 0) < 15 * 60e3);
        return entry?.executor && !entry.executor.bot ? entry.executor : null;
    } catch {
        return null;
    }
}

async function displayName(guild, user) {
    const m = guild.members?.cache?.get(user.id) || await guild.members?.fetch?.(user.id).catch(() => null);
    return esc(m?.displayName || user.globalName || user.username || '');
}

// Sends the card to the person who added ARCHON, else in the server; returns where it went ("DM name", "#channel") or null
async function sendWelcome(client, guild, { back = false } = {}) {
    const missing = missingPerms(guild);
    const kind = back ? 'back' : 'new';
    const inviter = await inviterOf(client, guild);
    if (inviter) {
        try { ensureTables(client); db(client)?.prepare('INSERT OR REPLACE INTO guild_inviters (guild_id, user_id, at) VALUES (?, ?, ?)').run(guild.id, inviter.id, Date.now()); } catch { /* ignore */ }
        const lang = langFor(client, guild, inviter.id);
        const payload = build(client, guild, { lang, to: 'inviter', kind, name: await displayName(guild, inviter), missing, where: null });
        if (await inviter.send(payload).then(() => true).catch(() => false)) return `DM ${inviter.username}`;
    }

    // nobody known, or their DMs are closed: in the server, where ARCHON can post
    const me = guild.members?.me;
    const text = [...guild.channels.cache.values()].filter((c) => c.type === 0).sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0));
    const ch = [guild.systemChannel, ...text].find((c) => c && canPost.diagnose(guild, c, me, [canPost.PERMS.view, canPost.PERMS.send]).ok);
    if (!ch) return null;
    const lang = pickLang(client, guild.id, null) || 'en';
    const payload = build(client, guild, { lang, to: 'channel', kind, mention: inviter?.id || null, missing, where: ch });
    return (await ch.send(payload).then(() => true).catch(() => false)) ? `#${ch.name}` : null;
}

// ARCHON was removed: tell the person who added it (works while they still share a server with ARCHON or have an open DM)
async function sendRemoved(client, guild) {
    try {
        ensureTables(client);
        const row = db(client)?.prepare('SELECT user_id FROM guild_inviters WHERE guild_id = ?').get(guild.id);
        if (!row?.user_id) return null;
        const user = await client.users.fetch(row.user_id).catch(() => null);
        if (!user) return null;
        const lang = langFor(client, guild, user.id);
        const ok = await user.send(buildRemoved(guild.id, guild.name, lang, Date.now())).then(() => true).catch(() => false);
        return ok ? `DM ${user.username}` : null;
    } catch {
        return null;
    }
}

// Language buttons on the DM card: joined:lang:<guildId>:<new|back>:<code>
async function handleComponent(interaction, client) {
    rememberLocale(client, interaction);
    const [, action, gid, kind, code] = interaction.customId.split(':');
    if ((action !== 'lang' && action !== 'check') || !SUPPORTED.includes(code)) return;
    const guild = client.guilds.cache.get(gid);
    if (!guild) return interaction.update(buildRemoved(gid, '?', code, Date.now())).catch(() => {});
    const payload = build(client, guild, { lang: code, to: 'inviter', kind: kind === 'back' ? 'back' : 'new', name: await displayName(guild, interaction.user), missing: missingPerms(guild), where: null });
    return interaction.update(payload).catch(() => {});
}

module.exports = { sendWelcome, sendRemoved, build, buildRemoved, handleComponent, rememberLocale, missingPerms, inviterOf, ASKED };
