// /channels — the channels ARCHON posts in or points members to.
// One interactive panel, like /roles: every channel with its real state (ARCHON can post, a permission is missing,
// the channel was deleted, not set), a menu to pick one, Discord's own channel picker to change it, and the card redraws.
// /channels set and /channels remove still work, and answer with the same panel.
const {
    SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const { icon } = require('../lib/ui/icons');
const canPost = require('../lib/canPost');

const ACCENT = 0x00B4D8;
const V2 = MessageFlags.IsComponentsV2;
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const L = (k, lang, v) => t(`channels.${k}`, lang, v || {});

// key, settings column, group, what ARCHON needs there (canPost feature; 'see' = members are only sent there)
const SLOTS = [
    { key: 'welcome', col: 'welcome_channel', group: 'core', need: 'welcome' },
    { key: 'goodbye', col: 'goodbye_channel', group: 'core', need: 'goodbye' },
    { key: 'rules', col: 'rules_channel', group: 'core', need: 'see' },
    { key: 'general', col: 'general_channel', group: 'core', need: 'see' },
    { key: 'modlog', col: 'mod_log_channel', group: 'moderation', need: 'modlog' },
    { key: 'log', col: 'log_channel', group: 'moderation', need: null },
    { key: 'ticket', col: 'ticket_transcript_channel', group: 'moderation', need: 'ticket-log' },
    { key: 'daily', col: 'daily_channel', group: 'activity', need: null },
    { key: 'levelup', col: 'levelup_channel', group: 'activity', need: 'levelup-milestone' },
    { key: 'updates', col: 'updates_channel', group: 'activity', need: null },
];
const BY_KEY = Object.fromEntries(SLOTS.map((s) => [s.key, s]));
const GROUPS = ['core', 'moderation', 'activity'];
// older names people may type with .channels set / remove
const ALIASES = { mod: 'modlog', 'mod-log': 'modlog', modlogs: 'modlog', logs: 'log', tickets: 'ticket', transcript: 'ticket', level: 'levelup', levels: 'levelup', chat: 'general', bye: 'goodbye', update: 'updates' };
const slotOf = (type) => { const k = String(type || '').toLowerCase().trim(); return BY_KEY[k] ? k : ALIASES[k] || null; };

const needed = (slot) => (slot.need === 'see' ? [canPost.PERMS.view] : canPost.neededFor(slot.need || 'default'));
const canManage = (member) => !!member?.permissions?.has(PermissionFlagsBits.ManageGuild);

function readAll(db, gid) {
    try { return db.prepare(`SELECT ${SLOTS.map((s) => s.col).join(', ')} FROM server_settings WHERE guild_id = ?`).get(gid) || {}; }
    catch { return {}; }
}

// { state: 'ok' | 'warn' | 'gone' | 'unset', id, text } for one slot
function stateOf(guild, slot, saved, lang) {
    let id = saved[slot.col] ? String(saved[slot.col]) : null;
    let viaDiscord = false;
    // the rules: Discord's own rules channel counts when none is set here (the welcome card uses it too)
    if (!id && slot.key === 'rules' && guild.rulesChannelId) { id = guild.rulesChannelId; viaDiscord = true; }
    if (!id) return { state: 'unset' };
    const ch = guild.channels.cache.get(id);
    if (!ch) return { state: 'gone', id };
    const d = canPost.diagnose(guild, ch, guild.members.me, needed(slot));
    const note = viaDiscord ? L('from_discord', lang) : null;
    if (d.ok) return { state: 'ok', id, note };
    const perms = canPost.localize(d.missing || [], lang).join(', ');
    const why = d.reason === 'wrong_type' ? L('why_type', lang)
        : d.reason === 'timeout' ? L('why_timeout', lang)
        : d.reason === 'private' ? L('why_private', lang)
        : d.reason === 'thread_locked' ? L('why_locked', lang)
        : L('why_perms', lang, { perms });
    return { state: 'warn', id, why, note };
}

const MARK = { ok: '✓', warn: '!', gone: '×', unset: '–' };
function slotLine(guild, slot, saved, lang) {
    const s = stateOf(guild, slot, saved, lang);
    const name = `${icon(`ch_${slot.key}`, guild)} **${L(`label_${slot.key}`, lang)}**`;
    if (s.state === 'unset') return `\`${MARK.unset}\` ${name} · ${L('not_set', lang)}`;
    if (s.state === 'gone') return `\`${MARK.gone}\` ${name} · ${L('status_gone', lang)}`;
    const extra = [s.note, s.why].filter(Boolean).map((x) => `\n-# ${x}`).join('');
    return `\`${MARK[s.state]}\` ${name} · <#${s.id}>${extra}`;
}

function mainView(guild, db, lang, ownerId, notice) {
    const saved = readAll(db, guild.id);
    const states = SLOTS.map((s) => stateOf(guild, s, saved, lang).state);
    const set = states.filter((x) => x !== 'unset').length;
    const problems = states.filter((x) => x === 'warn' || x === 'gone').length;
    const c = new ContainerBuilder().setAccentColor(problems ? 0xE67E22 : ACCENT);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `-# ARCHON · ${L('title', lang)}\n## ${icon('ch_title', guild)} ${L('heading', lang, { guild: guild.name })}\n`
        + `${L('summary', lang, { n: set, total: SLOTS.length })}${problems ? ` · ${L(problems === 1 ? 'problems_one' : 'problems', lang, { n: problems })}` : ''}`));
    if (notice) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${notice}`));
    for (const g of GROUPS) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        const lines = SLOTS.filter((s) => s.group === g).map((s) => slotLine(guild, s, saved, lang));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${L(`group_${g}`, lang)}\n${lines.join('\n')}`));
    }
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`chan:menu:${ownerId}`)
            .setPlaceholder(cut(L('pick_placeholder', lang), 150))
            .addOptions(SLOTS.map((s) => {
                const st = stateOf(guild, s, saved, lang);
                const where = st.id ? (guild.channels.cache.get(st.id)?.name ? `#${guild.channels.cache.get(st.id).name}` : L('status_gone', lang)) : L('not_set', lang);
                return { label: cut(L(`label_${s.key}`, lang), 100), description: cut(`${MARK[st.state]} ${where}`, 100), value: s.key, emoji: icon(`ch_${s.key}`, guild) };
            }))));
    try {
        const { dashboardUrl } = require('../lib/postProblems');
        c.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(dashboardUrl(guild.id)).setLabel(L('btn_dashboard', lang)).setEmoji(icon('dashboard', guild))));
    } catch { /* no dashboard link: the panel works without it */ }
    return { components: [c] };
}

function editView(guild, db, lang, ownerId, key, problem) {
    const slot = BY_KEY[key];
    const saved = readAll(db, guild.id);
    const st = stateOf(guild, slot, saved, lang);
    const c = new ContainerBuilder().setAccentColor(problem || st.state === 'warn' || st.state === 'gone' ? 0xE67E22 : ACCENT);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ${icon(`ch_${key}`, guild)} ${L(`label_${key}`, lang)}\n${L(`hint_${key}`, lang)}`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    const current = st.state === 'unset' ? L('not_set', lang) : st.state === 'gone' ? L('status_gone', lang) : `<#${st.id}>`;
    let body = L('current', lang, { channel: current });
    if (st.note) body += `\n-# ${st.note}`;
    if (st.state === 'ok') body += `\n${icon('ok', guild)} ${L('can_post_short', lang)}`;
    if (st.state === 'warn') body += `\n${icon('warn', guild)} ${st.why}`;
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    if (problem) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${problem}`));
    const picker = new ChannelSelectMenuBuilder()
        .setCustomId(`chan:pick:${key}:${ownerId}`)
        .setPlaceholder(cut(L('channel_placeholder', lang), 150))
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1).setMaxValues(1);
    if (st.id && guild.channels.cache.has(st.id) && saved[slot.col]) picker.setDefaultChannels(st.id);
    c.addActionRowComponents(new ActionRowBuilder().addComponents(picker));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`chan:back:${ownerId}`).setLabel(L('btn_back', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('back', guild)),
        new ButtonBuilder().setCustomId(`chan:clear:${key}:${ownerId}`).setLabel(L('btn_clear', lang)).setStyle(ButtonStyle.Danger).setDisabled(!saved[slot.col])));
    return { components: [c] };
}

// Saves one channel (or clears it). Returns { notice } or { problem }.
function applyOne(client, guild, key, channelId, lang, actorId) {
    const slot = BY_KEY[key];
    if (channelId) {
        const ch = guild.channels.cache.get(channelId);
        if (!ch || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(ch.type)) return { problem: L('invalid_channel', lang) };
    }
    let ok = false;
    try {
        client.db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(guild.id);
        client.db.prepare(`UPDATE server_settings SET ${slot.col} = ? WHERE guild_id = ?`).run(channelId || null, guild.id);
        ok = String(client.db.prepare(`SELECT ${slot.col} AS v FROM server_settings WHERE guild_id = ?`).get(guild.id)?.v || '') === String(channelId || '');
    } catch (e) { console.error('[CHANNELS] save:', e.message); }
    try { client.settings?.delete?.(guild.id); } catch { /* the settings cache reloads on next read */ }
    if (!ok) return { problem: L('save_failed', lang) };
    console.log(`[CHANNELS] guild=${guild.id} by=${actorId} ${slot.col}=${channelId || 'none'}`);
    return { notice: channelId ? L('saved', lang, { label: L(`label_${key}`, lang), channel: `<#${channelId}>` }) : L('cleared', lang, { label: L(`label_${key}`, lang) }) };
}

const typeChoices = (o) => o.setName('type').setDescription('Which channel').setRequired(true)
    .addChoices(...SLOTS.map((s) => ({ name: t(`channels.label_${s.key}`, 'en'), value: s.key })));

module.exports = {
    name: 'channels',
    aliases: ['channel', 'setchannel', 'salons'],
    description: 'View and change the channels ARCHON uses',
    category: 'ADMIN',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('channels')
        .setDescription('View and change the channels ARCHON uses')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((s) => s.setName('view').setDescription('Open the channel settings panel'))
        .addSubcommand((s) => s.setName('set').setDescription('Set a channel')
            .addStringOption(typeChoices)
            .addChannelOption((o) => o.setName('channel').setDescription('The channel to use').setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
        .addSubcommand((s) => s.setName('remove').setDescription('Clear a channel setting').addStringOption(typeChoices)),

    execute: async (interaction, client) => {
        const guild = interaction.guild;
        if (!guild) return;
        const lang = pickLang(client, guild.id, interaction);
        if (!canManage(interaction.member)) return interaction.reply({ content: L('admin_only', lang), flags: MessageFlags.Ephemeral });
        const sub = interaction.options.getSubcommand();
        const reply = (notice) => interaction.reply({ ...mainView(guild, client.db, lang, interaction.user.id, notice), flags: V2 | MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        if (sub === 'view') return reply();
        const key = slotOf(interaction.options.getString('type'));
        if (!key) return interaction.reply({ content: L('unknown_type', lang), flags: MessageFlags.Ephemeral });
        if (sub === 'remove' && !readAll(client.db, guild.id)[BY_KEY[key].col]) return interaction.reply({ content: L('already_removed', lang, { label: L(`label_${key}`, lang) }), flags: MessageFlags.Ephemeral });
        const r = applyOne(client, guild, key, sub === 'set' ? interaction.options.getChannel('channel').id : null, lang, interaction.user.id);
        return reply(r.notice || r.problem);
    },

    run: async (client, message, args) => {
        const guild = message.guild;
        if (!guild) return;
        const lang = pickLang(client, guild.id, message);
        if (!canManage(message.member)) return message.reply(L('admin_only', lang)).catch(() => {});
        const sub = (args[0] || 'view').toLowerCase();
        const reply = (notice) => message.reply({ ...mainView(guild, client.db, lang, message.author.id, notice), flags: V2, allowedMentions: { parse: [] } }).catch(() => {});
        if (sub === 'view') return reply();
        if (sub !== 'set' && sub !== 'remove') return message.reply(L('usage_set', lang)).catch(() => {});
        const key = slotOf(args[1]);
        if (!key) return message.reply(L('unknown_type', lang)).catch(() => {});
        if (sub === 'remove') {
            if (!readAll(client.db, guild.id)[BY_KEY[key].col]) return message.reply(L('already_removed', lang, { label: L(`label_${key}`, lang) })).catch(() => {});
            const r = applyOne(client, guild, key, null, lang, message.author.id);
            return reply(r.notice || r.problem);
        }
        const channelId = String(args[2] || '').replace(/[<#>]/g, '');
        if (!channelId) return message.reply(L('usage_set', lang)).catch(() => {});
        const r = applyOne(client, guild, key, channelId, lang, message.author.id);
        return reply(r.notice || r.problem);
    },

    // The panel's menu, channel picker and buttons. The opener's id travels in every customId: nobody else can drive it.
    handleComponent: async (interaction, client) => {
        const guild = interaction.guild;
        if (!guild) return;
        const lang = pickLang(client, guild.id, interaction);
        const parts = interaction.customId.split(':');
        const action = parts[1];
        const ownerId = parts[parts.length - 1];
        const deny = (key) => interaction.reply({ content: L(key, lang), flags: MessageFlags.Ephemeral }).catch(() => {});
        if (!/^\d{17,20}$/.test(ownerId)) return deny('expired');
        if (interaction.user.id !== ownerId) return deny('not_yours');
        if (!canManage(interaction.member)) return deny('admin_only');   // checked again on every click
        const update = (view) => interaction.update({ ...view, flags: V2, allowedMentions: { parse: [] } });

        if (action === 'menu') {
            const key = interaction.values?.[0];
            return BY_KEY[key] ? update(editView(guild, client.db, lang, ownerId, key)) : deny('expired');
        }
        if (action === 'back') return update(mainView(guild, client.db, lang, ownerId));
        const key = parts[2];
        if (!BY_KEY[key]) return deny('expired');
        if (action === 'pick' || action === 'clear') {
            const id = action === 'pick' ? interaction.values?.[0] : null;
            if (action === 'pick' && !id) return update(editView(guild, client.db, lang, ownerId, key));
            const r = applyOne(client, guild, key, id, lang, interaction.user.id);
            if (r.problem) return update(editView(guild, client.db, lang, ownerId, key, r.problem));
            return update(mainView(guild, client.db, lang, ownerId, r.notice));
        }
        return deny('expired');
    },
};
