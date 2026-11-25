// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — SETUP: the first-run wizard
// Four short questions (rules channel, welcome channel, member role, log channel), then a summary.
//   - every sentence lives in lang/<locale>/setup.json (English and French are written; the other languages fall back to English)
//   - native channel and role pickers: they list EVERY channel and role, with search (the old menus stopped at 25)
//   - the member role is checked before it is saved: not @everyone or an integration role, not above ARCHON's own role,
//     and not a role with powerful permissions (every new member would get those)
//   - the summary says whether ARCHON can really post in the welcome and log channels (the same check as /postcheck)
//   - what you pick is saved right away, so cancelling or timing out never loses it
//   - the wizard's state is a stored session (lib/components.js): its buttons keep working after a restart, and once it has
//     ended (15 minutes without a click) a click greys them out and says to run /setup again
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
const components = require('../lib/components');

const LANGS = ['en', 'fr', 'zh', 'ar', 'bm'];
const IDLE_MS = 15 * 60 * 1000;                           // 15 minutes without a click ends the setup (the session is stored: a restart doesn't)
const cid = (sid, action, ...args) => components.id('setup', sid, action, ...args);
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

// What each wizard step holds now (a channel or role that still exists), so the wizard only asks what's missing
const STEP_COL = { rules: 'rules_channel', welcome: 'welcome_channel', member: 'member_role', log: 'log_channel' };
function currentOf(client, guild) {
    let row = {};
    try { row = client.db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guild.id) || {}; } catch { row = {}; }
    const out = {};
    for (const st of STEPS) {
        const id = row[STEP_COL[st.key]] || (st.key === 'rules' ? guild.rulesChannelId : null);
        if (id && (st.kind === 'role' ? guild.roles.cache.has(String(id)) : guild.channels.cache.has(String(id)))) out[st.key] = String(id);
    }
    return out;
}
const missingSteps = (client, guild) => { const cur = currentOf(client, guild); return STEPS.map((st, n) => (cur[st.key] ? -1 : n)).filter((n) => n >= 0); };
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
function welcomeScreen(lang, guild, client, userId = '0', sid = 'preview') {
    const { card } = require('../lib/games/v2');
    const C = (k, v) => T(lang, `check.${k}`, v);
    let res = { items: [], doneCount: 0, total: 0, coreLeft: 0 };
    try { res = require('../lib/setup-checklist').compute(client, guild); } catch (e) { console.error('[SETUP] checklist:', e.message); }
    const cmd = (name) => { try { return require('../lib/cmd').slash(client, name, { guild }); } catch { return `/${name}`; } };
    const fixLabel = (panel) => panel === 'language' ? cmd('setlang') : panel === 'verify' ? cmd('verify') : panel === 'automod' ? cmd('automod') : C(`panel_${panel}`);
    const line = (i) => {
        if (i.done) return `${icon('ok', guild)} ${C(`item_${i.key}`)}`;
        const why = i.problem ? C(`problem_${i.problem}`) : C('notSet');
        return `${i.problem && i.problem !== 'notOn' ? icon('warn', guild) : i.level === 'core' ? icon('off', guild) : icon('unset', guild)} ${C(`item_${i.key}`)} · ${why}\n-# ${C('fixIn', { where: fixLabel(i.panel) })}`;
    };
    const filled = res.total ? Math.round((res.doneCount / res.total) * 10) : 0;
    const items = [{ text: `-# ARCHON · ${T(lang, 'title')}\n## ${icon('ch_title', guild)} ${C('heading', { server: safeName(guild.name) })}\n${C('progress', { done: res.doneCount, total: res.total })}${res.coreLeft ? ` · ${C(res.coreLeft === 1 ? 'coreLeftOne' : 'coreLeft', { n: res.coreLeft })}` : ` · ${C('coreDone')}`}\n\`${'█'.repeat(filled)}${'░'.repeat(10 - filled)}\`` }];
    for (const level of ['core', 'recommended', 'optional']) {
        const list = res.items.filter((i) => i.level === level);
        if (!list.length) continue;
        // what's left is shown in full; what's done fits in one line (a long list of ticks is skipped, not read)
        const todo = list.filter((i) => !i.done), done = list.filter((i) => i.done);
        const body = !todo.length
            ? `${icon('ok', guild)} ${C('levelAllDone', { n: done.length })}`
            : [...todo.map(line), ...(done.length ? [`-# ${icon('ok', guild)} ${C('alsoDone', { list: done.map((i) => C(`item_${i.key}`)).join(', ') })}`] : [])].join('\n');
        items.push({ rule: true }, { text: `### ${C(`level_${level}`)}\n${body}` });
    }
    // the wizard asks only what's still missing; when its questions are all answered it's offered to change them
    let left = STEPS.length;
    try { left = missingSteps(client, guild).length; } catch { /* ask everything */ }
    const hint = left === STEPS.length ? C('wizardHint', { total: STEPS.length, start: T(lang, 'start') })
        : left ? C('wizardHintLeft', { n: left, start: T(lang, 'start') })
        : C('wizardAllSet', { total: STEPS.length, redo: T(lang, 'redo') });
    items.push({ rule: true }, { text: hint });
    items.push({ row: new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(cid(sid, 'start')).setLabel(T(lang, left ? 'start' : 'redo')).setStyle(left ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(icon(left ? 'next' : 'refresh', guild)),
        new ButtonBuilder().setCustomId(cid(sid, 'cancel')).setLabel(T(lang, 'cancel')).setStyle(ButtonStyle.Secondary)) });
    items.push({ row: new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`chan:back:${userId}`).setLabel(C('panel_channels')).setStyle(ButtonStyle.Secondary).setEmoji(icon('ch_title', guild)),
        new ButtonBuilder().setCustomId(`roles:back:${userId}`).setLabel(C('panel_roles')).setStyle(ButtonStyle.Secondary).setEmoji(icon('member', guild)),
        new ButtonBuilder().setCustomId(`wel:open:welcome:${userId}`).setLabel(C('panel_welcome')).setStyle(ButtonStyle.Secondary).setEmoji(icon('ch_welcome', guild))) });
    // a copy of the settings, and a way back to zero (it asks first)
    items.push({ row: new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(cid(sid, 'export')).setLabel(C('btn_export')).setStyle(ButtonStyle.Secondary).setEmoji(icon('file', guild)),
        new ButtonBuilder().setCustomId(cid(sid, 'reset')).setLabel(C('btn_reset')).setStyle(ButtonStyle.Danger).setEmoji(icon('refresh', guild))) });
    return card(res.coreLeft ? AMBER : GREEN, items);
}

// The settings row as it is saved, plus the commands turned off: what a server would need to be set up again
function exportFile(client, guild) {
    const db = client.db;
    let settings = {}, commands = [];
    try { settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guild.id) || {}; } catch { /* nothing saved */ }
    try { commands = db.prepare('SELECT * FROM server_command_settings WHERE guild_id = ?').all(guild.id); } catch { /* no table */ }
    const clean = Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== null && v !== ''));
    const body = { server: { id: guild.id, name: guild.name }, exportedAt: new Date().toISOString(), settings: clean, commands };
    return { attachment: Buffer.from(JSON.stringify(body, null, 2), 'utf-8'), name: `archon-settings-${guild.id}.json` };
}

// Asks before wiping: what goes, what stays, and the advice to export first
function resetScreen(lang, guild, sid = 'preview') {
    const { card } = require('../lib/games/v2');
    const C = (k, v) => T(lang, `check.${k}`, v);
    return card(0xE74C3C, [
        { text: `-# ARCHON · ${T(lang, 'title')}\n## ${icon('warn', guild)} ${C('reset_title', { server: safeName(guild.name) })}\n${C('reset_gone')}\n-# ${C('reset_kept')}\n-# ${C('reset_tip')}` },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(cid(sid, 'reset_ok')).setLabel(C('reset_yes')).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(cid(sid, 'export')).setLabel(C('btn_export')).setStyle(ButtonStyle.Secondary).setEmoji(icon('file', guild)),
            new ButtonBuilder().setCustomId(cid(sid, 'reset_no')).setLabel(T(lang, 'cancel')).setStyle(ButtonStyle.Secondary)) },
    ]);
}

function questionScreen(lang, guild, idx, notice, suggestion = suggestFor(guild, STEPS[idx]), sid = 'preview', n = idx + 1, total = STEPS.length) {
    const step = STEPS[idx];
    const embed = new EmbedBuilder().setColor(GOLD)
        .setTitle(T(lang, `q.${step.key}.title`))
        .setDescription(T(lang, `q.${step.key}.text`) + (notice ? `\n\n⚠️ ${notice}` : ''))
        .setFooter({ text: T(lang, 'footer', { server: safeName(guild.name), n, total }) });
    const picker = step.kind === 'role' ? new RoleSelectMenuBuilder() : new ChannelSelectMenuBuilder().setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
    picker.setCustomId(cid(sid, 'pick')).setPlaceholder(T(lang, step.kind === 'role' ? 'placeholderRole' : 'placeholderChannel')).setMinValues(1).setMaxValues(1);
    const buttons = new ActionRowBuilder();
    if (suggestion) buttons.addComponents(new ButtonBuilder().setCustomId(cid(sid, 'use', suggestion.id)).setLabel(T(lang, 'useSuggestion', { name: suggestion.label }).slice(0, 80)).setStyle(ButtonStyle.Success));
    buttons.addComponents(
        new ButtonBuilder().setCustomId(cid(sid, 'skip')).setLabel(T(lang, 'skip')).setStyle(ButtonStyle.Secondary).setEmoji(icon('skip', guild)),
        new ButtonBuilder().setCustomId(cid(sid, 'cancel')).setLabel(T(lang, 'cancel')).setStyle(ButtonStyle.Secondary));
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
    const names = role.permissions?.has(PermissionFlagsBits.Administrator) /* access-ok: a role, not a person */ ? ['Administrator'] : POWERFUL.filter(([, bit]) => role.permissions?.has(bit)).map(([n]) => n);
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
    aliases: ['wizard', 'config', 'configure', 'serversettings', 'ss', 'serverconfig', 'guildsettings', 'gs', 'settings'],   // the old /serversettings names open this checklist
    description: '🧙‍♂️ Interactive setup wizard for new servers',
    usage: '.setup',
    permissions: ['ManageGuild', 'ManageRoles'],

    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('🧙‍♂️ Launch the interactive server setup wizard')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDescriptionLocalizations({ fr: '🧙‍♂️ Lancer l\'assistant de configuration interactif' }),

    // ── slash command ──
    async execute(interaction, client) {
        const lang = pickLang(client, interaction.guild?.id, interaction);
        if (!interaction.guild) return interaction.reply({ content: T(lang, 'guildOnly'), flags: 1 << 6 }).catch(() => {});
        // the wizard picks channels and the member role: Manage Server + Manage Roles (lib/access), like /roles
        { const _no = require('../lib/access').deny(interaction.member, 'roles', lang); if (_no) return interaction.reply({ content: _no, flags: 1 << 6, allowedMentions: { parse: [] } }).catch(() => {}); }
        await module.exports.startWizard(interaction, client, lang, true);
    },

    // ── prefix command ──
    async run(client, message, args, db, serverSettings) {
        const lang = pickLang(client, message.guild?.id, null);
        if (!message.guild) return message.reply(T(lang, 'guildOnly')).catch(() => {});
        { const _no = require('../lib/access').deny(message.member, 'roles', lang); if (_no) return message.reply({ content: _no, allowedMentions: { parse: [] } }).catch(() => {}); }
        await module.exports.startWizard(message, client, lang, false);
    },

    // ── the wizard: its state lives in a stored session (lib/components.js), so a restart doesn't kill the buttons ──
    async startWizard(context, client, lang, isSlash) {
        const guild = context.guild;
        const userId = isSlash ? context.user.id : context.author.id;
        const sid = components.create(client.db, { kind: 'setup', userId, guildId: guild.id, idleMs: IDLE_MS, data: { lang, idx: -1, state: {} } });
        try {
            const first = welcomeScreen(lang, guild, client, userId, sid);
            if (isSlash) await context.reply({ ...first, flags: first.flags | (1 << 6) }); else await context.reply(first);
        } catch (e) { console.error('[SETUP] could not open the wizard:', e.message); }
    },

    // Every click on the wizard: c:setup:<sid>:<action>[:<id>]
    async onComponent(i, client, { sid, action, args, session, save, end }) {
        const guild = i.guild;
        if (!guild) return;
        const { lang, state } = session.data;
        let { idx } = session.data;
        let ask = session.data.ask || STEPS.map((_, n) => n);   // the steps this run asks, in order
        let pos = session.data.pos ?? ask.indexOf(idx);
        const at = () => [pos + 1, ask.length];
        const userId = session.userId;
        const savedCount = () => Object.keys(state).length;

        const advance = () => {
            pos += 1;
            if (pos < ask.length) { idx = ask[pos]; save({ lang, idx, pos, ask, state }); return i.update(questionScreen(lang, guild, idx, null, undefined, sid, ...at())).catch(() => {}); }
            end();
            // the summary shows every essential: what was answered now, and what was already set
            let current = {};
            try { current = currentOf(client, guild); } catch { /* answered ones only */ }
            for (const [k, v] of Object.entries(current)) if (!(k in state)) state[k] = v;
            const warnings = STEPS.filter((s) => s.needsPost && state[s.key]).map((s) => channelWarning(lang, guild, s, state[s.key])).filter(Boolean);
            const low = require('../lib/role-check').lowRoleText(guild, lang);
            if (low) warnings.push(low);
            let prefix = '.';
            try { prefix = client.getServerSettings(guild.id)?.prefix || '.'; } catch { /* the default prefix */ }
            return i.update(summaryScreen(lang, guild, state, warnings, prefix)).catch(() => {});
        };

        if (action === 'cancel') { end(); return i.update(plainScreen(lang, savedCount() ? 'cancelledSaved' : 'cancelled')).catch(() => {}); }
        if (action === 'start' && idx === -1) {
            try { const miss = missingSteps(client, guild); if (miss.length) ask = miss; } catch { /* ask everything */ }
            pos = -1;
            return advance();
        }
        if (action === 'export') {
            return i.reply({ content: T(lang, 'check.export_done'), files: [exportFile(client, guild)], flags: 1 << 6 }).catch((e) => console.error('[SETUP] export:', e.message));
        }
        // erasing everything at once is the one step that needs Administrator (or the owner)
        if (action === 'reset' || action === 'reset_ok') {
            const _no = require('../lib/access').deny(i.member, 'reset', lang);
            if (_no) return i.reply({ content: _no, flags: 1 << 6, allowedMentions: { parse: [] } }).catch(() => {});
        }
        if (action === 'reset' && idx === -1) return i.update(resetScreen(lang, guild, sid)).catch(() => {});
        if (action === 'reset_no' && idx === -1) return i.update(welcomeScreen(lang, guild, client, userId, sid)).catch(() => {});
        if (action === 'reset_ok' && idx === -1) {
            try { client.db.prepare('DELETE FROM server_settings WHERE guild_id = ?').run(guild.id); } catch (e) { console.error('[SETUP] reset:', e.message); }
            try { client.db.prepare('DELETE FROM server_command_settings WHERE guild_id = ?').run(guild.id); } catch { /* no table */ }
            try { client.settings?.delete?.(guild.id); client.invalidateGuildCache?.(guild.id); } catch { /* reloads on next read */ }
            console.log(`[SETUP] settings reset for ${guild.id} by ${i.user.id}`);
            return i.update(welcomeScreen(lang, guild, client, userId, sid)).then(() => i.followUp({ content: T(lang, 'check.reset_done'), flags: 1 << 6 })).catch(() => {});
        }
        if (action === 'skip' && idx >= 0) return advance();
        if ((action === 'pick' || action === 'use') && idx >= 0) {
            const step = STEPS[idx];
            const id = action === 'pick' ? i.values?.[0] : args[0];
            if (!id) return;
            if (step.kind === 'role') {
                const problem = roleProblem(lang, guild, guild.roles.cache.get(id));
                if (problem) return i.update(questionScreen(lang, guild, idx, problem, null, sid, ...at())).catch(() => {});   // stay on this question
            }
            client.updateServerSetting(guild.id, step.setting, id);
            for (const [k, v] of step.extra || []) client.updateServerSetting(guild.id, k, v);
            state[step.key] = id;
            return advance();
        }
        // a click that doesn't fit the current screen (an old copy of the card): show where the wizard is now
        if (idx === -1) return i.update(welcomeScreen(lang, guild, client, userId, sid)).catch(() => {});
        return i.update(questionScreen(lang, guild, idx, null, undefined, sid, ...at())).catch(() => {});
    },

    // Used by the installer's self-test.
    _warning: (lang, guild, step, id) => channelWarning(lang, guild, step, id),
    _resetScreen: resetScreen,
    _exportFile: exportFile,

    // Used by the installer's self-test: builds every screen in one language with the real discord.js builders.
    _preview(lang) {
        const guild = { name: 'Test Server', channels: { cache: new Map() }, members: { me: null } };
        const state = { rules: '111111111111111111', welcome: '222222222222222222', member: '333333333333333333' };
        const shots = [ ...STEPS.map((_, n) => questionScreen(lang, guild, n)), questionScreen(lang, guild, 2, T(lang, 'roleManaged')),
            summaryScreen(lang, guild, state, ['example warning'], '.'), plainScreen(lang, 'cancelled'), plainScreen(lang, 'timeoutSaved')];
        return shots.map((s) => JSON.stringify({ flags: s.flags, components: s.components.map((c) => c.toJSON()) }));
    }
};

// The wizard's buttons and menus (c:setup:…) come back here, even after a restart
components.register('setup', (ix, client, ctx) => module.exports.onComponent(ix, client, ctx), { command: 'setup' });
