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
// Texts: lang/<locale>/joined.json (English and French; the other languages fall back to English).
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionFlagsBits: F, AuditLogEvent, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } = require('discord.js');
const i18n = require('./i18n');
const { card } = require('./games/v2');
const { icon } = require('./ui/icons');
const canPost = require('./canPost');
const { pickLang } = require('./pick-lang');
const { dashboardUrl } = require('./postProblems');

const SUPPORT_URL = 'https://discord.gg/NFSMFJajp9';
const GREEN = 0x2ecc71, AMBER = 0xf0b232;
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

// The card. to: 'inviter' (a DM) | 'channel'. name: who it speaks to (null in a channel when nobody is known)
function build(client, guild, { lang = 'en', to = 'channel', name = null, mention = null, missing = null, where = null } = {}) {
    const g = esc(guild.name);
    const bot = guild.members?.me?.roles?.botRole?.name || 'ARCHON';
    let title, sub;
    if (name || mention) { title = T('thanks', lang, { user: mention ? `<@${mention}>` : name }); sub = T('subThanks', lang, { guild: g }); }
    else { title = T('arrivedTitle', lang, { guild: g }); sub = T('arrivedSub', lang); }

    const steps = [
        `1. ${T('stepSetup', lang, { cmd: '`/setup`' })}`,
        `2. ${T('stepCheck', lang, { cmd: '`/postcheck`' })}`,
        `3. ${T('stepDashboard', lang)}`,
    ].join('\n');
    const perms = permsLine(missing, lang, where, bot);

    const row = new ActionRowBuilder();
    if (to !== 'channel') row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}`).setLabel(cut(T('btnServer', lang, { guild: guild.name }), 80)).setEmoji(icon('home', where)));
    row.addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(dashboardUrl(guild.id)).setLabel(T('btnDashboard', lang)).setEmoji(icon('globe', where)),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(SUPPORT_URL).setLabel(T('btnSupport', lang)).setEmoji(icon('messages', where)),
    );

    const head = `### ${title}\n-# ${sub}`;
    let avatar = null;
    try { avatar = client.user.displayAvatarURL({ extension: 'png', size: 256 }); } catch { avatar = null; }
    /** @type {any[]} */
    const items = [avatar ? { thumbnail: [head, avatar] } : { text: head }, { rule: true }, { text: steps }];
    if (perms) items.push({ rule: true }, { text: perms });
    items.push({ row });
    if (to === 'inviter') items.push({ text: `-# ${T('whyInviter', lang, { guild: g })}` });
    const out = card(missing?.length ? AMBER : GREEN, items);
    if (mention) out.allowedMentions = { parse: [], users: [String(mention)] };
    return out;
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
async function sendWelcome(client, guild) {
    const missing = missingPerms(guild);
    const inviter = await inviterOf(client, guild);
    if (inviter) {
        const lang = pickLang(client, guild.id, null, inviter.id) || 'en';
        const payload = build(client, guild, { lang, to: 'inviter', name: await displayName(guild, inviter), missing, where: null });
        if (await inviter.send(payload).then(() => true).catch(() => false)) return `DM ${inviter.username}`;
    }

    // nobody known, or their DMs are closed: in the server, where ARCHON can post
    const me = guild.members?.me;
    const text = [...guild.channels.cache.values()].filter((c) => c.type === 0).sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0));
    const ch = [guild.systemChannel, ...text].find((c) => c && canPost.diagnose(guild, c, me, [canPost.PERMS.view, canPost.PERMS.send]).ok);
    if (!ch) return null;
    const lang = pickLang(client, guild.id, null) || 'en';
    const payload = build(client, guild, { lang, to: 'channel', mention: inviter?.id || null, missing, where: ch });
    return (await ch.send(payload).then(() => true).catch(() => false)) ? `#${ch.name}` : null;
}

module.exports = { sendWelcome, build, missingPerms, inviterOf, ASKED };
