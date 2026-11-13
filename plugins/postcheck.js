// ═══ ARCHON CG-223 — POSTCHECK ═══
// "Can I post here, and what should change if not?"
//   /postcheck [channel]   one channel: the permissions ARCHON uses there, what each one is for, and what blocks the missing ones
//   /postcheck all:True    every channel ARCHON uses on this server, the dashboard's health card in Discord (Manage Server only)
//   .postcheck [#channel]  ·  .postcheck all
// Same rules as the dashboard and the "couldn't post" alerts (lib/canPost, lib/health-route, lib/postProblems).
// Texts: lang/<locale>/postcheck.json (English and French written; the other languages fall back to English).
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cp = require('../lib/canPost');
const i18n = require('../lib/i18n');
const { card } = require('../lib/games/v2');
const { icon } = require('../lib/ui/icons');
const { slash } = require('../lib/cmd');

const T = (key, lang, vars) => i18n.t(`postcheck.${key}`, lang, vars);
const GREEN = 0x2ECC71, AMBER = 0xF0B232, RED = 0xE74C3C;
const ALL_WORDS = /^(all|tout|tous|everything)$/i;
const when = () => `<t:${Math.floor(Date.now() / 1000)}:R>`;
const botName = (me) => me?.roles?.botRole?.name || me?.displayName || 'ARCHON';

// The permissions ARCHON uses in a channel, and what each one is for.
const LIST = [['view', 'useCore'], ['send', 'useCore'], ['embed', 'useEmbeds'], ['files', 'useFiles'], ['history', 'useReplies'], ['emojis', 'useEmojis']];

// where: the message or interaction the card is shown in (ARCHON's own icons only where it may use them)
function oneChannel(guild, channel, lang, hint, where) {
    const me = guild.members.me;
    const target = channel ? String(channel) : T('alertNoChannel', lang);
    const vars = (d) => ({ channel: target, bot: botName(me), perms: cp.localize(d.missing || [], lang).join(', '), role: d.role || T('someRole', lang) });
    const explain = (d) => `${T(cp.keyFor('why', d.reason), lang, vars(d))}\n\n${T(cp.keyFor('fix', d.reason), lang, vars(d))}`;
    const foot = { text: `-# ${hint}` };

    // the permissions, essential ones first (one line when they agree), then each one a feature needs
    const perms = channel && typeof channel.permissionsFor === 'function' ? channel.permissionsFor(me) : null;
    const thread = !!channel?.isThread?.();
    const core = [], extra = [], missing = [];
    if (perms) {
        for (const [key, use] of LIST) {
            const p = key === 'send' && thread ? cp.PERMS.sendThreads : cp.PERMS[key];
            const has = !!perms.has(p[1]);
            if (!has) missing.push(p);
            (use === 'useCore' ? core : extra).push({ has, name: cp.localize([p[0]], lang)[0], use });
        }
    }
    const mark = (has) => icon(has ? 'ok' : 'no', where);
    const lines = [];
    if (core.length) {
        lines.push(`-# ${T('groupCore', lang)}`);
        if (core.every((c) => c.has === core[0].has)) lines.push(`${mark(core[0].has)} ${core.map((c) => `**${c.name}**`).join(' · ')}`);
        else for (const c of core) lines.push(`${mark(c.has)} **${c.name}**`);
    }
    if (extra.length) {
        lines.push(`-# ${T('groupFeature', lang)}`);
        for (const c of extra) lines.push(`${mark(c.has)} **${c.name}** · ${T(c.use, lang)}`);
    }
    const list = lines.length ? [{ rule: true }, { text: lines.join('\n') }] : [];
    const total = core.length + extra.length;
    const sub = [total ? T('countOf', lang, { ok: total - missing.length, total }) : null, T('checkedShort', lang, { when: when() })].filter(Boolean).join(' · ');
    const head = (title) => ({ text: `### ${title}\n-# ${sub}` });

    // first: can ARCHON post here at all?
    const coreCheck = cp.diagnose(guild, channel, me, [cp.PERMS.view, cp.PERMS.send]);
    if (!coreCheck.ok) return card(RED, [head(`${icon('no', where)} ${T('noTitle', lang, { channel: target })}`), ...list, { rule: true }, { text: explain(coreCheck) }, foot]);
    if (!missing.length) return card(GREEN, [head(`${icon('ok', where)} ${T('okTitle', lang, { channel: target })}`), ...list, foot]);
    // it posts, but some things will not work here: name what blocks them
    const d = cp.diagnose(guild, channel, me, missing);
    return card(AMBER, [head(`${icon('warn', where)} ${T('limitTitle', lang, { channel: target })}`), ...list, ...(d.ok ? [] : [{ rule: true }, { text: explain(d) }]), foot]);
}

function shortWhy(c, lang, bot) {
    const perms = cp.localize(c.missing || [], lang).join(', ');
    if (c.status === 'missing') return T('short.gone', lang);
    if (c.status === 'not_text') return T('short.wrong_type', lang);
    const key = 'short.' + (c.reason || 'refused');
    const s = T(key, lang, { role: c.role || T('someRole', lang), perms, bot });
    return s === 'postcheck.' + key ? T('short.refused', lang) : s;
}

function label(setting, lang) {
    const key = 'settings.' + setting;
    const s = T(key, lang);
    return s === 'postcheck.' + key ? setting : s;
}

function allChannels(guild, db, lang, hint, where) {
    const health = require('../lib/health-route');
    let row = {};
    try { row = db?.prepare?.('SELECT * FROM server_settings WHERE guild_id = ?').get(guild.id) || {}; } catch { row = {}; }
    const h = health.build(guild, row, lang, db);
    const bot = botName(guild.members.me);
    const at = (id) => (id ? `<#${id}>` : T('alertNoChannel', lang));

    const chLines = h.channels.map((c) => {
        const name = `**${label(c.setting, lang)}**${c.detail ? ` (${c.detail})` : ''} · ${at(c.channelId)}`;
        if (c.status !== 'ok') return `${icon('no', where)} ${name} — ${shortWhy(c, lang, bot)}`;
        if (c.soft?.length) return `${icon('warn', where)} ${name} — ${T('short.soft', lang, { perms: cp.localize(c.soft, lang).join(', ') })}`;
        return `${icon('ok', where)} ${name}`;
    });
    const permLines = h.permissions.map((p) => `${icon(p.ok ? 'ok' : 'no', where)} **${p.name}** · ${T('neededFor', lang, { feature: T('features.' + p.feature, lang) })}`);
    const roleLines = h.roles.map((r) => {
        const name = `**${label(r.setting, lang)}**${r.roleName ? ` · @${r.roleName}` : ''}`;
        if (r.status === 'ok') return `${icon('ok', where)} ${name}`;
        return `${icon('no', where)} ${name} — ${r.status === 'above' ? T('roleAbove', lang) : T('roleMissing', lang)}`;
    });
    const failLines = (h.failures || []).map((f) => `${icon('no', where)} **${f.label}** · ${at(f.channelId)} · ${T('failureLine', lang, { count: f.count, when: `<t:${Math.floor(f.lastAt / 1000)}:R>` })}`);

    const problems = h.summary.problems;
    const warnings = h.summary.warnings || 0;
    const sub = problems === 1 ? T('allProblemOne', lang, { when: when() })
        : problems > 1 ? T('allProblemMany', lang, { count: problems, when: when() })
        : (warnings || failLines.length) ? T('allWarnOnly', lang, { when: when() })
        : T('allOk', lang, { when: when() });
    const color = problems ? RED : (warnings || failLines.length) ? AMBER : GREEN;
    const section = (title, lines) => (lines.length ? [{ rule: true }, { text: `${T(title, lang)}\n${lines.join('\n')}` }] : []);

    const { dashboardUrl } = require('../lib/postProblems');
    const link = new ActionRowBuilder().addComponents(new ButtonBuilder().setURL(dashboardUrl(guild.id)).setLabel(T('alertBtnDashboard', lang)).setEmoji(icon('globe')).setStyle(ButtonStyle.Link));
    return card(color, [
        { text: `### ${T('allTitle', lang, { guild: guild.name })}\n-# ${sub}` },
        ...(chLines.length ? section('secChannels', chLines) : [{ rule: true }, { text: T('noChannels', lang) }]),
        ...section('secPerms', permLines),
        ...section('secRoles', roleLines),
        ...(h.hierarchy?.lowest ? [{ rule: true }, { text: `${T('secHierarchy', lang)}\n${icon('warn', where)} ${require('../lib/role-check').lowRoleText(guild, lang, h.hierarchy)}` }] : []),
        ...section('secFailures', failLines),
        { rule: true },
        { text: `-# ${hint}` },
        { row: link },
    ]);
}

const isAdmin = (perms) => !!perms?.has?.(PermissionFlagsBits.ManageGuild);

module.exports = {
    name: 'postcheck',
    aliases: ['checkperms', 'canipost', 'accesscheck'],
    description: '🔍 Check whether I can post in a channel, or in every channel I use here',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.postcheck [#channel] | .postcheck all',
    examples: ['.postcheck', '.postcheck #welcome', '.postcheck all'],

    data: new SlashCommandBuilder()
        .setName('postcheck')
        .setDescription('🔍 Check whether I can post in a channel, or in every channel I use here')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to check (default: this one)').setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.PublicThread,
                ChannelType.PrivateThread, ChannelType.AnnouncementThread ?? 10, ChannelType.GuildForum))
        .addBooleanOption(o => o.setName('all').setDescription('Check every channel I use on this server (admins)').setRequired(false)),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        lang = lang || require('../lib/pick-lang').pickLang(client, message.guild?.id, message, message.author?.id);
        if (!message.guild) return;
        const prefix = serverSettings?.prefix || '.';
        try {
            if (ALL_WORDS.test(String(args?.[0] || ''))) {
                if (!isAdmin(message.member?.permissions) && message.author.id !== message.guild.ownerId) return message.reply(T('adminsOnlyAll', lang)).catch(() => {});
                return message.reply(allChannels(message.guild, db || client.db, lang, T('oneHintPrefix', lang, { prefix, cmd: slash(client, 'postcheck', { guild: message.guild }) }), message)).catch(() => {});
            }
            const target = message.mentions.channels.first() || message.channel;
            return message.reply(oneChannel(message.guild, target, lang, T('allHintPrefix', lang, { prefix, cmd: slash(client, 'postcheck', { guild: message.guild }) }), message)).catch(() => {});
        } catch (e) {
            console.error('[POSTCHECK]', e.message);
            return message.reply(T('alertUnavailable', lang)).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        const lang = i18n.slashLang(interaction);
        if (!interaction.guild) return interaction.reply({ content: T('alertUnavailable', lang), flags: 64 }).catch(() => {});
        const ephemeral = (payload) => ({ ...payload, flags: payload.flags | 64 });
        try {
            if (interaction.options.getBoolean('all')) {
                if (!isAdmin(interaction.memberPermissions) && interaction.user.id !== interaction.guild.ownerId) {
                    return interaction.reply({ content: T('adminsOnlyAll', lang), flags: 64 });
                }
                return interaction.reply(ephemeral(allChannels(interaction.guild, client.db, lang, T('oneHintSlash', lang, { cmd: slash(client, 'postcheck', { guild: interaction.guild }) }), interaction)));
            }
            const target = interaction.options.getChannel('channel') || interaction.channel;
            return interaction.reply(ephemeral(oneChannel(interaction.guild, target, lang, T('allHintSlash', lang, { cmd: slash(client, 'postcheck', { guild: interaction.guild }) }), interaction)));
        } catch (e) {
            console.error('[POSTCHECK]', e.message);
            if (!interaction.replied) return interaction.reply({ content: T('alertUnavailable', lang), flags: 64 }).catch(() => {});
        }
    },

    _oneChannel: oneChannel,
    _allChannels: allChannels,
};
