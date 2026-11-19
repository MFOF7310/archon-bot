'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// The small info commands' cards: .membercount, .boosters, .banner, .roleinfo, /avatar
// One look (Components V2), one set of texts (lang/<l>/info.json), and member counts that are real:
//   · members are fetched once (cached 10 minutes per server) before counting, so humans / bots / role members
//     / boosters aren't "whoever happens to be in the cache"
//   · "online" comes from Discord's own approximate count: ARCHON has no presence intent, so the old online /
//     idle / dnd numbers were always 0 and "offline" was everyone
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { t } = require('./i18n');
const { icon } = require('./ui/icons');
const v2 = require('./games/v2');

const T = (lang, k, v) => t(`info.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('./pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const n = (x, lang) => Number(x || 0).toLocaleString({ fr: 'fr-FR', zh: 'zh-CN', ar: 'en-US' }[lang] || 'en-US');
const safe = (s, max = 80) => String(s || '').replace(/[*_~`|>\\]/g, '').replace(/@(everyone|here)/gi, '@​$1').slice(0, max);

const fetched = new Map();   // guildId -> time of the last full member fetch
async function allMembers(guild) {
    const last = fetched.get(guild.id) || 0;
    if (Date.now() - last > 10 * 60 * 1000 && guild.memberCount <= 25000) {
        await Promise.race([guild.members.fetch().catch(() => null), new Promise((r) => setTimeout(r, 8000))]);
        fetched.set(guild.id, Date.now());
    }
    return guild.members.cache;
}

async function memberCount(guild, lang, where) {
    const members = await allMembers(guild);
    const bots = members.filter((m) => m.user.bot).size;
    const full = members.size >= guild.memberCount - 5;
    const live = await guild.client.guilds.fetch({ guild: guild.id, withCounts: true, force: true }).catch(() => null);
    const online = live?.approximatePresenceCount;
    const head = `-# ${safe(guild.name)}\n### ${icon('users', where)} ${T(lang, 'mcTitle')}\n# ${n(guild.memberCount, lang)}`;
    const lines = [
        full ? `**${T(lang, 'humans')}** ${n(guild.memberCount - bots, lang)}  ·  **${T(lang, 'bots')}** ${n(bots, lang)}` : null,
        online != null ? `${icon('online', where)} **${T(lang, 'online')}** ${n(online, lang)}` : null,
        `**${T(lang, 'boosts')}** ${n(guild.premiumSubscriptionCount, lang)} · ${T(lang, 'tier', { n: guild.premiumTier })}  ·  **${T(lang, 'roles')}** ${n(guild.roles.cache.size - 1, lang)}`,
        `-# ${T(lang, 'created', { when: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>` })}`,
    ].filter(Boolean);
    const icn = guild.iconURL({ size: 256 });
    return v2.card(0x378ADD, [icn ? { thumbnail: [head, icn] } : { text: head }, { rule: true }, { text: lines.join('\n') }]);
}

async function boosters(guild, lang, where) {
    const count = guild.premiumSubscriptionCount || 0;
    if (!count) return v2.card(0xD4537E, [{ text: `### ${icon('boost', where)} ${T(lang, 'boostTitle')}\n${T(lang, 'noBoosts')}` }]);
    const list = [...(await allMembers(guild)).filter((m) => m.premiumSince).values()].sort((a, b) => a.premiumSinceTimestamp - b.premiumSinceTimestamp);
    const next = { 0: 2, 1: 7, 2: 14 }[guild.premiumTier];
    const lines = list.slice(0, 25).map((m, i) => `${i + 1}. <@${m.id}> · ${T(lang, 'since', { when: `<t:${Math.floor(m.premiumSinceTimestamp / 1000)}:R>` })}`);
    return v2.card(0xD4537E, [
        { text: `-# ${safe(guild.name)}\n### ${icon('boost', where)} ${T(lang, 'boostTitle')}\n**${n(count, lang)}** ${T(lang, 'boostsWord')} · ${T(lang, 'tier', { n: guild.premiumTier })}${next ? `\n-# ${T(lang, 'nextTier', { n: Math.max(0, next - count), tier: guild.premiumTier + 1 })}` : ''}` },
        { rule: true },
        { text: (lines.join('\n') || T(lang, 'boostersHidden')) + (list.length > 25 ? `\n-# ${T(lang, 'more', { n: list.length - 25 })}` : '') },
    ]);
}

async function banner(client, user, lang, where) {
    const u = await client.users.fetch(user.id, { force: true }).catch(() => user);
    const url = u.bannerURL?.({ size: 1024 });
    if (!url) return v2.card(0x888780, [{ text: `${T(lang, 'noBanner', { user: safe(u.globalName || u.username, 40) })}${u.hexAccentColor ? `\n-# ${T(lang, 'accent', { hex: u.hexAccentColor })}` : ''}` }]);
    const animated = /\/a_/.test(url);
    const formats = ['png', 'jpg', 'webp', ...(animated ? ['gif'] : [])];
    return v2.card(u.accentColor || 0x7F77DD, [
        { text: `### ${T(lang, 'bannerTitle', { user: safe(u.globalName || u.username, 40) })}` },
        { media: [url, safe(u.username, 60)] },
        { row: new ActionRowBuilder().addComponents(...formats.map((f) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(f.toUpperCase()).setURL(u.bannerURL({ extension: f, size: 4096 })))) },
    ]);
}

// /avatar: the server avatar when there is one (with a button to the main one), every format that exists
function avatar(user, member, guild, lang) {
    const own = member?.avatar ? member.displayAvatarURL({ size: 4096 }) : null;
    const main = user.displayAvatarURL({ size: 4096 });
    const shown = own || main;
    const animated = own ? member.avatar.startsWith('a_') : !!user.avatar?.startsWith('a_');
    const urlFor = (f) => (own ? member.displayAvatarURL({ extension: f, size: 4096 }) : user.displayAvatarURL({ extension: f, size: 4096 }));
    const formats = ['png', 'jpg', 'webp', ...(animated ? ['gif'] : [])];
    const row = new ActionRowBuilder().addComponents(...formats.map((f) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(f.toUpperCase()).setURL(urlFor(f))));
    if (own) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(T(lang, 'mainAvatar')).setURL(main));
    return v2.card(member?.displayColor || user.accentColor || 0x378ADD, [
        { text: `### ${T(lang, 'avatarTitle', { user: safe(member?.displayName || user.globalName || user.username, 40) })}${own ? `\n-# ${T(lang, 'serverAvatar')}` : ''}` },
        { media: [shown, safe(user.username, 60)] },
        { row },
    ]);
}

const KEY_PERMS = [['Administrator', 'Administrator'], ['ManageGuild', 'Manage Server'], ['ManageRoles', 'Manage Roles'], ['ManageChannels', 'Manage Channels'],
    ['KickMembers', 'Kick Members'], ['BanMembers', 'Ban Members'], ['ModerateMembers', 'Timeout Members'], ['ManageMessages', 'Manage Messages'], ['MentionEveryone', 'Mention @everyone']];
async function roleInfo(guild, role, lang, where) {
    await allMembers(guild);
    const perms = KEY_PERMS.filter(([f]) => role.permissions.has(PermissionsBitField.Flags[f])).map(([, name]) => name);
    const yes = (b) => (b ? icon('ok', where) : '—');
    const lines = [
        `**${T(lang, 'members')}** ${n(role.members.size, lang)}  ·  **${T(lang, 'position')}** ${role.position} / ${guild.roles.cache.size - 1}  ·  **${T(lang, 'color')}** \`${role.hexColor}\``,
        `**${T(lang, 'hoisted')}** ${yes(role.hoist)}  ·  **${T(lang, 'mentionable')}** ${yes(role.mentionable)}  ·  **${T(lang, 'managed')}** ${yes(role.managed)}`,
        `**${T(lang, 'keyPerms')}** ${perms.length ? perms.join(', ') : T(lang, 'none')}`,
        `-# ${T(lang, 'created', { when: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>` })} · \`${role.id}\``,
    ];
    return v2.card(role.color || 0x888780, [{ text: `-# ${safe(guild.name)}\n### <@&${role.id}>` }, { rule: true }, { text: lines.join('\n') }]);
}

module.exports = { langOf, T, memberCount, boosters, banner, avatar, roleInfo };
