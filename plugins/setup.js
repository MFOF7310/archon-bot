// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — SETUP: the first-run wizard
// Four short questions (rules channel, welcome channel, member role, log channel), then a summary.
//   - every sentence lives in lang/<locale>/setup.json (English and French are written; the other languages fall back to English)
//   - native channel and role pickers: they list EVERY channel and role, with search (the old menus stopped at 25)
//   - the member role is checked before it is saved: not @everyone or an integration role, not above ARCHON's own role,
//     and not a role with powerful permissions (every new member would get those)
//   - the summary says whether ARCHON can really post in the welcome and log channels (the same check as /postcheck)
//   - what you pick is saved right away, so cancelling or timing out never loses it
// ═══════════════════════════════════════════════════════
const {
    EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType
} = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const { toV2 } = require('../lib/v2convert');   // classic embeds -> Components V2 cards
const { icon } = require('../lib/ui/icons');
const i18n = require('../lib/i18n');
const canPost = require('../lib/canPost');

const LANGS = ['en', 'fr', 'zh', 'ar', 'bm'];
const IDLE_MS = 120000;                                   // two minutes without a click ends the setup
const GOLD = 0xfcd116, GREEN = 0x14b53a, AMBER = 0xf59e0b, GREY = 0x8d897f;   // the colours of Mali, plus two quiet ones

// The questions, in order. `setting` is the name client.updateServerSetting already knows; `needsPost` marks the channels ARCHON writes in.
const STEPS = [
    { key: 'rules',   kind: 'channel', setting: 'rules' },
    { key: 'welcome', kind: 'channel', setting: 'welcome', extra: [['welcome_enabled', '1']], needsPost: 'welcome' },
    { key: 'member',  kind: 'role',    setting: 'member' },
    { key: 'log',     kind: 'channel', setting: 'log', needsPost: 'log' },
];

// A role with any of these must not be handed to every new member.
const POWERFUL = [
    ['Administrator', PermissionFlagsBits.Administrator], ['Manage Server', PermissionFlagsBits.ManageGuild], ['Manage Roles', PermissionFlagsBits.ManageRoles],
    ['Manage Channels', PermissionFlagsBits.ManageChannels], ['Ban Members', PermissionFlagsBits.BanMembers], ['Kick Members', PermissionFlagsBits.KickMembers],
    ['Timeout Members', PermissionFlagsBits.ModerateMembers], ['Manage Messages', PermissionFlagsBits.ManageMessages], ['Mention Everyone', PermissionFlagsBits.MentionEveryone],
];

const T = (lang, key, vars) => i18n.t('setup.' + key, lang, vars);
const safeName = (s) => String(s || '').replace(/[*_~`|>\\]/g, '').slice(0, 80);

// The language: the server's own (or the slash command's), and always one we have; anything else is English.
function pickLang(client, guildId, interaction) {
    let raw = null;
    if (interaction && typeof i18n.slashLang === 'function') { try { raw = i18n.slashLang(interaction, LANGS); } catch { raw = null; } }
    if (!LANGS.includes(raw)) { try { raw = client.detectLanguage ? client.detectLanguage('setup', guildId) : null; } catch { raw = null; } }
    return LANGS.includes(raw) ? raw : 'en';
}

// ── suggestions: a channel or role whose name already fits the question, offered as a one-tap button ──
const NAME_HINTS = {
    rules: /rule|r[eè]gle|regl|info|规则|قوانين|قواعد/i,
    welcome: /welcome|bienvenue|accueil|arriv|hello|欢迎|ترحيب/i,
    log: /log|journal|audit|mod-?log|staff|日志|سجل/i,
    member: /member|membre|verified|v[ée]rifi|citizen|成员|عضو/i,
};
function suggestFor(guild, step) {
    const hint = NAME_HINTS[step.key];
    if (!hint) return null;
    const me = guild.members?.me;
    if (step.kind === 'role') {
        const top = me?.roles?.highest?.position ?? 0;
        const r = [...(guild.roles?.cache?.values?.() || [])]
            .filter((x) => x.id !== guild.id && !x.managed && x.position < top && hint.test(x.name) && !POWERFUL.some(([, bit]) => x.permissions?.has(bit)))
            .sort((a, b) => b.position - a.position)[0];
        return r ? { id: r.id, label: `@${safeName(r.name)}` } : null;
    }
    const ok = (c) => !step.needsPost || !me || canPost.diagnose(guild, c, me, canPost.neededFor(step.needsPost)).ok;
    const list = [...(guild.channels?.cache?.values?.() || [])].filter((c) => (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) && hint.test(c.name))
        .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0));
    const c = list.find(ok) || list[0];
    return c ? { id: c.id, label: `#${safeName(c.name)}` } : null;
}

// ── the screens ──────────────────────────────────────
// The first screen: where this server stands (lib/setup-checklist.js, the same list Lydia reads), the wizard's
// Start button, and shortcuts to the panels that fix the rest. Opener id in the shortcuts: only they can drive them.
function welcomeScreen(lang, guild, client, userId = '0') {
    const { card } = require('../lib/games/v2');
    const C = (k, v) => T(lang, `check.${k}`, v);
    let res = { items: [], doneCount: 0, total: 0, coreLeft: 0 };
    try { res = require('../lib/setup-checklist').compute(client, guild); } catch (e) { console.error('[SETUP] checklist:', e.message); }
    const cmd = (name) => { try { return require('../lib/cmd').slash(client, name, { guild }); } catch { return `/${name}`; } };
    const fixLabel = (panel) => panel === 'language' ? cmd('setlang') : panel === 'verify' ? cmd('verify') : C(`panel_${panel}`);
    const line = (i) => {
        if (i.done) return `${icon('ok', guild)} ${C(`item_${i.key}`)}`;
        const why = i.problem ? C(`problem_${i.problem}`) : C('notSet');
        return `${i.problem ? icon('warn', guild) : i.level === 'core' ? icon('off', guild) : '○'} ${C(`item_${i.key}`)} · ${why}\n-# ${C('fixIn', { where: fixLabel(i.panel) })}`;
    };
    const filled = res.total ? Math.round((res.doneCount / res.total) * 10) : 0;
    const items = [{ text: `-# ARCHON · ${T(lang, 'title')}\n## ${icon('ch_title', guild)} ${C('heading', { server: safeName(guild.name) })}\n${C('progress', { done: res.doneCount, total: res.total })}${res.coreLeft ? ` · ${C(res.coreLeft === 1 ? 'coreLeftOne' : 'coreLeft', { n: res.coreLeft })}` : ` · ${C('coreDone')}`}\n\`${'█'.repeat(filled)}${'░'.repeat(10 - filled)}\`` }];
    for (const level of ['core', 'recommended', 'optional']) {
        const list = res.items.filter((i) => i.level === level);
        if (!list.length) continue;
        items.push({ rule: true }, { text: `### ${C(`level_${level}`)}\n${list.map(line).join('\n')}` });
    }
    items.push({ rule: true }, { text: C('wizardHint', { total: STEPS.length, start: T(lang, 'start') }) });
    items.push({ row: new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_start').setLabel(T(lang, 'start')).setStyle(ButtonStyle.Success).setEmoji(icon('next', guild)),
        new ButtonBuilder().setCustomId('setup_cancel').setLabel(T(lang, 'cancel')).setStyle(ButtonStyle.Secondary)) });
    items.push({ row: new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`chan:back:${userId}`).setLabel(C('panel_channels')).setStyle(ButtonStyle.Secondary).setEmoji(icon('ch_title', guild)),
        new ButtonBuilder().setCustomId(`roles:back:${userId}`).setLabel(C('panel_roles')).setStyle(ButtonStyle.Secondary).setEmoji(icon('member', guild)),
        new ButtonBuilder().setCustomId(`wel:open:welcome:${userId}`).setLabel(C('panel_welcome')).setStyle(ButtonStyle.Secondary).setEmoji(icon('ch_welcome', guild))) });
    return card(res.coreLeft ? AMBER : GREEN, items);
}

function questionScreen(lang, guild, idx, notice, suggestion = suggestFor(guild, STEPS[idx])) {
    const step = STEPS[idx];
    const embed = new EmbedBuilder().setColor(GOLD)
        .setTitle(T(lang, `q.${step.key}.title`))
        .setDescription(T(lang, `q.${step.key}.text`) + (notice ? `\n\n⚠️ ${notice}` : ''))
        .setFooter({ text: T(lang, 'footer', { server: safeName(guild.name), n: idx + 1, total: STEPS.length }) });
    const picker = step.kind === 'role' ? new RoleSelectMenuBuilder() : new ChannelSelectMenuBuilder().setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
    picker.setCustomId('setup_pick').setPlaceholder(T(lang, step.kind === 'role' ? 'placeholderRole' : 'placeholderChannel')).setMinValues(1).setMaxValues(1);
    const buttons = new ActionRowBuilder();
    if (suggestion) buttons.addComponents(new ButtonBuilder().setCustomId(`setup_use:${suggestion.id}`).setLabel(T(lang, 'useSuggestion', { name: suggestion.label }).slice(0, 80)).setStyle(ButtonStyle.Success));
    buttons.addComponents(
        new ButtonBuilder().setCustomId('setup_skip').setLabel(T(lang, 'skip')).setStyle(ButtonStyle.Secondary).setEmoji(icon('skip', guild)),
        new ButtonBuilder().setCustomId('setup_cancel').setLabel(T(lang, 'cancel')).setStyle(ButtonStyle.Secondary));
    return toV2({ embeds: [embed], components: [new ActionRowBuilder().addComponents(picker), buttons] });
}

function summaryScreen(lang, guild, state, warnings, prefix) {
    const lines = STEPS.map((s) => {
        const label = T(lang, `line.${s.key}`);
        return state[s.key] ? `${icon('ok', guild)} ${label}: ${s.kind === 'role' ? `<@&${state[s.key]}>` : `<#${state[s.key]}>`}` : `${icon('skip', guild)} ${label}: ${T(lang, 'skipped')}`;
    });
    let text = `${T(lang, 'doneText')}\n\n${lines.join('\n')}`;
    if (warnings.length) text += `\n\n**${icon('warn', guild)} ${T(lang, 'attention')}**\n${warnings.join('\n\n')}`;
    text += `\n\n${T(lang, 'next')}\n${T(lang, 'prefixLine', { prefix })}`;
    const embed = new EmbedBuilder().setColor(warnings.length ? AMBER : GREEN).setTitle(T(lang, 'doneTitle')).setDescription(text)
        .setFooter({ text: safeName(guild.name) }).setTimestamp();
    return toV2({ embeds: [embed], components: [] });
}

function plainScreen(lang, key) {
    return toV2({ embeds: [new EmbedBuilder().setColor(GREY).setDescription(T(lang, key))], components: [] });
}

// ── the checks ───────────────────────────────────────
// Returns a sentence when ARCHON cannot give this role to new members, otherwise null.
function roleProblem(lang, guild, role) {
    if (!role) return null;
    if (role.id === guild.id || role.managed) return T(lang, 'roleManaged');
    const me = guild.members?.me;
    if (me && role.position >= (me.roles?.highest?.position ?? 0)) return T(lang, 'roleAbove', { role: safeName(role.name) });
    const names = role.permissions?.has(PermissionFlagsBits.Administrator) ? ['Administrator'] : POWERFUL.filter(([, bit]) => role.permissions?.has(bit)).map(([n]) => n);
    if (names.length) return T(lang, 'roleDangerous', { role: safeName(role.name), perms: canPost.localize(names, lang).join(', ') });
    return null;
}

// Returns a sentence when ARCHON cannot post in a channel it was just given, otherwise null.
function channelWarning(lang, guild, step, id) {
    const me = guild.members?.me;
    const ch = guild.channels?.cache?.get(id);
    if (!me || !ch || !step.needsPost || typeof ch.permissionsFor !== 'function') return null;
    const d = canPost.diagnose(guild, ch, me, canPost.neededFor(step.needsPost));
    if (d.ok) return null;
    const vars = { channel: `<#${id}>`, bot: me.roles?.botRole?.name || me.displayName, perms: canPost.localize(d.missing || [], lang).join(', '), role: d.role || '' };
    return `**<#${id}>**\n${i18n.t('postcheck.' + canPost.keyFor('why', d.reason), lang, vars)}\n${T(lang, 'postcheckHint', { cmd: require('../lib/cmd').slash(guild.client, 'postcheck', { guild }) })}`;
}

module.exports = {
    name: 'setup',
    category: 'ADMIN',
    aliases: ['wizard', 'config', 'configure'],
    description: '🧙‍♂️ Interactive setup wizard for new servers',
    usage: '.setup',
    permissions: ['Administrator'],

    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('🧙‍♂️ Launch the interactive server setup wizard')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescriptionLocalizations({ fr: '🧙‍♂️ Lancer l\'assistant de configuration interactif' }),

    // ── slash command ──
    async execute(interaction, client) {
        const lang = pickLang(client, interaction.guild?.id, interaction);
        if (!interaction.guild) return interaction.reply({ content: T(lang, 'guildOnly'), flags: 1 << 6 }).catch(() => {});
        const isAdmin = interaction.user.id === interaction.guild.ownerId || interaction.member?.permissions?.has('Administrator');
        if (!isAdmin) return interaction.reply({ content: T(lang, 'needAdmin'), flags: 1 << 6 }).catch(() => {});
        await module.exports.startWizard(interaction, client, lang, true);
    },

    // ── prefix command ──
    async run(client, message, args, db, serverSettings) {
        const lang = pickLang(client, message.guild?.id, null);
        if (!message.guild) return message.reply(T(lang, 'guildOnly')).catch(() => {});
        const isAdmin = message.author.id === message.guild.ownerId || message.member?.permissions?.has('Administrator');
        if (!isAdmin) return message.reply(T(lang, 'needAdmin')).catch(() => {});
        await module.exports.startWizard(message, client, lang, false);
    },

    // ── the wizard: one collector for the whole conversation ──
    async startWizard(context, client, lang, isSlash) {
        const guild = context.guild;
        const userId = isSlash ? context.user.id : context.author.id;
        const state = {};
        let idx = -1;

        let msg;
        try {
            const first = welcomeScreen(lang, guild, client, userId);
            if (isSlash) { await context.reply({ ...first, flags: first.flags | (1 << 6) }); msg = await context.fetchReply(); } else msg = await context.reply(first);
        } catch (e) { console.error('[SETUP] could not open the wizard:', e.message); return; }

        const collector = msg.createMessageComponentCollector({ idle: IDLE_MS });
        const savedCount = () => Object.keys(state).length;

        const advance = (i) => {
            idx += 1;
            if (idx < STEPS.length) return i.update(questionScreen(lang, guild, idx)).catch(() => {});
            collector.stop('done');
            const warnings = STEPS.filter((s) => s.needsPost && state[s.key]).map((s) => channelWarning(lang, guild, s, state[s.key])).filter(Boolean);
            const low = require('../lib/role-check').lowRoleText(guild, lang);
            if (low) warnings.push(low);
            let prefix = '.';
            try { prefix = client.getServerSettings(guild.id)?.prefix || '.'; } catch { /* the default prefix */ }
            return i.update(summaryScreen(lang, guild, state, warnings, prefix)).catch(() => {});
        };

        collector.on('collect', async (i) => {
            try {
                if (i.user.id !== userId) return i.reply({ content: T(lang, 'notYours'), flags: 1 << 6 }).catch(() => {});
                // a shortcut to another panel: that panel's own handler takes over this message, the wizard steps aside
                if (!i.customId.startsWith('setup_')) return collector.stop('left');
                if (i.customId === 'setup_cancel') { collector.stop('cancelled'); return i.update(plainScreen(lang, savedCount() ? 'cancelledSaved' : 'cancelled')).catch(() => {}); }
                if (i.customId === 'setup_start' && idx === -1) return advance(i);
                if (i.customId === 'setup_skip' && idx >= 0) return advance(i);
                if ((i.customId === 'setup_pick' || i.customId.startsWith('setup_use:')) && idx >= 0) {
                    const step = STEPS[idx];
                    const id = i.customId === 'setup_pick' ? i.values[0] : i.customId.split(':')[1];
                    if (step.kind === 'role') {
                        const problem = roleProblem(lang, guild, guild.roles.cache.get(id));
                        if (problem) return i.update(questionScreen(lang, guild, idx, problem, null)).catch(() => {});   // stay on this question
                    }
                    client.updateServerSetting(guild.id, step.setting, id);
                    for (const [k, v] of step.extra || []) client.updateServerSetting(guild.id, k, v);
                    state[step.key] = id;
                    return advance(i);
                }
            } catch (e) {
                console.error('[SETUP] step failed:', e.message);
                if (!i.replied && !i.deferred) i.reply({ content: T(lang, 'error'), flags: 1 << 6 }).catch(() => {});
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'idle') await msg.edit(plainScreen(lang, savedCount() ? 'timeoutSaved' : 'timeout')).catch(() => {});
        });
    },

    // Used by the installer's self-test.
    _warning: (lang, guild, step, id) => channelWarning(lang, guild, step, id),

    // Used by the installer's self-test: builds every screen in one language with the real discord.js builders.
    _preview(lang) {
        const guild = { name: 'Test Server', channels: { cache: new Map() }, members: { me: null } };
        const state = { rules: '111111111111111111', welcome: '222222222222222222', member: '333333333333333333' };
        const shots = [ ...STEPS.map((_, n) => questionScreen(lang, guild, n)), questionScreen(lang, guild, 2, T(lang, 'roleManaged')),
            summaryScreen(lang, guild, state, ['example warning'], '.'), plainScreen(lang, 'cancelled'), plainScreen(lang, 'timeoutSaved')];
        return shots.map((s) => JSON.stringify({ flags: s.flags, components: s.components.map((c) => c.toJSON()) }));
    }
};
