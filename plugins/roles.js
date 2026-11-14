// /roles — the role settings ARCHON uses (member, mute, auto role, ticket staff, rewards).
// One interactive panel: pick a setting, pick a role with Discord's own role picker, done.
// Every change goes through lib/role-rules.js, the same checks the dashboard uses, and is written to the mod-log.
const {
    SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const R = require('../lib/role-rules');

const ACCENT = 0x2b9bb0;
const V2 = MessageFlags.IsComponentsV2;
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const label = (key, lang) => t(`roles.labels.${key}`, lang);

// ARCHON's icons for each setting and group (a plain emoji when the custom one is missing or unusable)
const ICON = {
    autorole: ['member', '👤'], staff: ['ticket', '🎫'], investor: ['invest', '📈'], quizmaster: ['quizmaster', '🧠'], duelist: ['duelist', '⚔️'],
    dailyinitiate: ['streak', '🔥'], dailywarrior: ['streak', '🔥'], dailychampion: ['streak', '🔥'], dailylegend: ['streak', '🔥'],
    level5: ['xp', '✨'], level10: ['xp', '✨'], level15: ['xp', '✨'], level20: ['xp', '✨'], level25: ['xp', '✨'],
    core: ['ic_admin', '⚙️'], economy: ['invest', '💰'], daily: ['streak', '🔥'], levels: ['trophy', '🏆'],
};
function iconFor(key) {
    const [k, plain] = ICON[key] || [null, '•'];
    let E = {}; try { E = require('../config/emojis'); } catch { E = {}; }
    return require('../lib/emoji-check').pick(k && E[k], plain);
}

// Reward roles ARCHON can create in one go (cosmetic: no permissions). Economy ones live here; level and daily-streak
// ones come from plugins/leveling.js, so a role made from either place has the same name and is reused, not duplicated.
const ECONOMY_ROLES = [['investor', '📈', 0x2ECC71], ['quizmaster', '🧠', 0x9B59B6], ['duelist', '⚔️', 0xE74C3C]];
const COL_KEY = Object.fromEntries(R.SLOTS.map((s) => [s.col, s.key]));

// The reward roles not set yet (or whose role was deleted), grouped: [{ group, items: [{ key, emoji, name }] }]
function missingRewards(guild, db, lang) {
    const saved = R.readSlots(db, guild.id);
    const missing = (key) => !saved[key] || !guild.roles.cache.has(String(saved[key]));
    const lv = require('./leveling.js').roleNames(lang);
    const groups = [
        { group: 'economy', items: ECONOMY_ROLES.filter(([k]) => missing(k)).map(([k, emoji]) => ({ key: k, emoji, name: label(k, lang) })) },
        { group: 'daily', set: 'streak', items: lv.streak.filter((x) => COL_KEY[x.col] && missing(COL_KEY[x.col])).map((x) => ({ key: COL_KEY[x.col], emoji: x.emoji, name: x.name })) },
        { group: 'levels', set: 'level', items: lv.level.filter((x) => COL_KEY[x.col] && missing(COL_KEY[x.col])).map((x) => ({ key: COL_KEY[x.col], emoji: x.emoji, name: x.name })) },
    ];
    return groups.filter((g) => g.items.length);
}
const countMissing = (groups) => groups.reduce((n, g) => n + g.items.length, 0);

// The card shown before anything is created: what each role is for, and that it is cosmetic
function createView(guild, db, lang, ownerId) {
    const groups = missingRewards(guild, db, lang);
    const n = countMissing(groups);
    const c = new ContainerBuilder().setAccentColor(ACCENT);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${t('roles.mk_title', lang)}\n${t('roles.mk_intro', lang)}`));
    for (const g of groups) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${iconFor(g.group)} ${t(`roles.${g.group}`, lang)}\n${g.items.map((x) => `${x.emoji} **${x.name}** · ${t(`roles.hints.${x.key}`, lang)}`).join('\n')}`));
    }
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('roles.mk_reuse', lang)}`));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`roles:mkok:${ownerId}`).setLabel(t('roles.btn_confirm', lang, { n })).setStyle(ButtonStyle.Success).setDisabled(!n),
        new ButtonBuilder().setCustomId(`roles:back:${ownerId}`).setLabel(t('roles.btn_cancel', lang)).setStyle(ButtonStyle.Secondary)));
    return { components: [c] };
}

// Creates the missing economy roles like leveling.js does its own: no permissions, not mentionable, not hoisted,
// just under ARCHON's role; on boosted servers the emoji becomes the role icon, elsewhere it goes in the name
async function createEconomyRoles(guild, db, lang, actor) {
    const saved = R.readSlots(db, guild.id);
    const icons = guild.features?.includes?.('ROLE_ICONS');
    const next = { ...saved };
    let made = 0, reused = 0;
    for (const [key, emoji, color] of ECONOMY_ROLES) {
        if (saved[key] && guild.roles.cache.has(String(saved[key]))) continue;
        const base = label(key, lang);
        const name = icons ? base : `${emoji} ${base}`;
        let role = guild.roles.cache.find((r) => r.name === name || r.name === base || r.name === `${emoji} ${base}`);
        if (role && R.checkRole(guild, role, 'grant', null)) continue;   // an existing role ARCHON can't give is left alone
        if (!role) {
            const opts = { name, color, permissions: [], hoist: false, mentionable: false, reason: t('roles.mk_reason', lang, { user: actor.user?.tag || actor.id }) };
            if (icons) opts.unicodeEmoji = emoji;
            role = await guild.roles.create(opts).catch(() => (icons ? guild.roles.create({ ...opts, unicodeEmoji: undefined }).catch(() => null) : null));
            if (!role) continue;
            made++;
        } else reused++;
        next[key] = role.id;
    }
    return { next, made, reused };
}

// How a slot reads in the overview: the role, or "Not set", plus a short warning when the saved role can't be used
function slotLine(guild, slot, saved, lang) {
    let value = saved[slot.key];
    let fromEnv = false;
    if (!value && slot.env && guild.id === process.env.GUILD_ID && process.env[slot.env]) { value = process.env[slot.env]; fromEnv = true; }
    if (!value) return `**${label(slot.key, lang)}** · ${t('roles.not_set', lang)}`;
    const role = guild.roles.cache.get(value);
    if (!role) return `**${label(slot.key, lang)}** · \`${t('roles.status_missing', lang)}\``;
    const err = R.checkRole(guild, role, slot.profile, null);
    const env = fromEnv ? ` (${t('roles.from_env', lang)})` : '';
    const warn = err ? `\n-# ${t('roles.status_unsafe_line', lang, { reason: R.reasonText(err, lang) })}` : '';
    return `**${label(slot.key, lang)}** · <@&${role.id}>${env}${warn}`;
}

function mainView(guild, db, lang, ownerId, notice) {
    const saved = R.readSlots(db, guild.id);
    const c = new ContainerBuilder().setAccentColor(ACCENT);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${t('roles.title', lang)}\n${t('roles.intro', lang)}`));
    if (notice) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${notice}`));
    for (const g of R.GROUPS) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        const lines = R.SLOTS.filter(s => s.group === g).map(s => slotLine(guild, s, saved, lang));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${iconFor(g)} ${t(`roles.${g}`, lang)}\n${lines.join('\n')}`));
    }
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`roles:menu:${ownerId}`)
            .setPlaceholder(cut(t('roles.pick_placeholder', lang), 150))
            .addOptions(R.SLOTS.map(s => ({
                label: cut(label(s.key, lang), 100),
                description: cut(t(`roles.hints.${s.key}`, lang), 100),
                value: s.key,
                emoji: iconFor(s.key),
            })))
    ));
    // one tap creates the reward roles that are still missing (after a card that says exactly what they are)
    const n = guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles) ? countMissing(missingRewards(guild, db, lang)) : 0;
    if (n) c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`roles:mk:${ownerId}`).setLabel(cut(t('roles.btn_create', lang, { n }), 80)).setStyle(ButtonStyle.Secondary).setEmoji(iconFor('levels'))));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t('roles.footer', lang)}`));
    return { components: [c] };
}

function editView(guild, db, lang, ownerId, key, problem) {
    const slot = R.BY_KEY[key];
    const current = R.readSlots(db, guild.id)[key];
    const role = current ? guild.roles.cache.get(current) : null;
    const c = new ContainerBuilder().setAccentColor(problem ? 0xc0392b : ACCENT);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ${iconFor(key)} ${label(key, lang)}\n${t(`roles.hints.${key}`, lang)}\n-# ${t(`roles.rules_${slot.profile}`, lang)}`));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        t('roles.current', lang, { role: role ? `<@&${role.id}>` : (current ? `\`${t('roles.status_missing', lang)}\`` : t('roles.not_set', lang)) })));
    if (problem) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${problem}`));
    const picker = new RoleSelectMenuBuilder()
        .setCustomId(`roles:pick:${key}:${ownerId}`)
        .setPlaceholder(t('roles.role_placeholder', lang))
        .setMinValues(1).setMaxValues(1);
    if (role) picker.setDefaultRoles(role.id);
    c.addActionRowComponents(new ActionRowBuilder().addComponents(picker));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`roles:back:${ownerId}`).setLabel(t('roles.btn_back', lang)).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`roles:clear:${key}:${ownerId}`).setLabel(t('roles.btn_clear', lang)).setStyle(ButtonStyle.Danger).setDisabled(!current),
    ));
    return { components: [c] };
}

// Apply one change with the shared rules. Returns { notice } on success or { problem } when refused.
async function applyOne(client, guild, actor, key, roleId, lang, via) {
    const db = client.db;
    const current = R.readSlots(db, guild.id);
    const v = R.validateChanges(guild, current, { [key]: roleId }, actor);
    if (!v.ok) return { problem: t('roles.rejected', lang, { label: label(v.slot, lang), reason: R.reasonText(v.err, lang) }) };
    const changes = R.writeSlots(client, db, guild.id, current, v.next);
    if (!changes.length) return { notice: t('roles.unchanged', lang) };
    console.log(`[ROLES] guild=${guild.id} by=${actor.id} via=${via} ${JSON.stringify(changes)}`);
    await R.logChanges(guild, db, changes, actor.id, via, lang);
    return { notice: roleId ? t('roles.saved', lang, { label: label(key, lang), role: `<@&${roleId}>` }) : t('roles.cleared', lang, { label: label(key, lang) }) };
}

// Prefix and slash share one entry point for set/remove
function slotFromType(type) {
    const k = String(type || '').toLowerCase().replace(/[^a-z]/g, '');
    const legacy = { staffrole: 'staff', ticketstaff: 'staff', auto: 'autorole', joinrole: 'autorole' };
    return R.BY_KEY[k] ? k : legacy[k] || null;
}

const typeChoices = (o) => o.setName('type').setDescription('Which role setting').setRequired(true)
    .addChoices(...R.SLOTS.map(s => ({ name: t(`roles.labels.${s.key}`, 'en'), value: s.key })));

module.exports = {
    name: 'roles',
    aliases: ['role', 'setrole', 'roleconfig'],
    description: 'View and change the roles ARCHON uses',
    category: 'ADMIN',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('View and change the roles ARCHON uses')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .addSubcommand(s => s.setName('view').setDescription('Open the role settings panel'))
        .addSubcommand(s => s.setName('set').setDescription('Set a role setting')
            .addStringOption(typeChoices)
            .addRoleOption(o => o.setName('role').setDescription('The role to use').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Clear a role setting')
            .addStringOption(typeChoices)),

    execute: async (interaction, client) => {
        const guild = interaction.guild;
        const lang = pickLang(client, guild.id, interaction);
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!R.canManage(member)) return interaction.reply({ content: t('roles.need_perms', lang), flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();
        if (sub === 'view') {
            return interaction.reply({ ...mainView(guild, client.db, lang, interaction.user.id), flags: V2 | MessageFlags.Ephemeral });
        }
        const key = slotFromType(interaction.options.getString('type'));
        if (!key) return interaction.reply({ content: t('roles.unknown_type', lang), flags: MessageFlags.Ephemeral });
        if (sub === 'remove' && !R.readSlots(client.db, guild.id)[key])
            return interaction.reply({ content: t('roles.already_removed', lang), flags: MessageFlags.Ephemeral });
        const roleId = sub === 'set' ? interaction.options.getRole('role').id : null;
        const r = await applyOne(client, guild, member, key, roleId, lang, 'discord');
        return interaction.reply({ ...mainView(guild, client.db, lang, interaction.user.id, r.notice || r.problem), flags: V2 | MessageFlags.Ephemeral });
    },

    run: async (client, message, args) => {
        const guild = message.guild;
        if (!guild) return;
        const lang = pickLang(client, guild.id, message);
        if (!R.canManage(message.member)) return message.reply(t('roles.need_perms', lang)).catch(() => {});
        const sub = (args[0] || 'view').toLowerCase();

        if (sub === 'view') return message.reply({ ...mainView(guild, client.db, lang, message.author.id), flags: V2, allowedMentions: { parse: [] } }).catch(() => {});

        if (sub === 'set' || sub === 'remove') {
            const key = slotFromType(args[1]);
            if (!key) return message.reply(t('roles.unknown_type', lang)).catch(() => {});
            let roleId = null;
            if (sub === 'set') {
                roleId = String(args[2] || '').replace(/[<@&>]/g, '');
                if (!roleId) return message.reply(t('roles.usage_set', lang)).catch(() => {});
                if (!guild.roles.cache.has(roleId)) return message.reply(t('roles.invalid_role', lang)).catch(() => {});
            } else if (!R.readSlots(client.db, guild.id)[key]) {
                return message.reply(t('roles.already_removed', lang)).catch(() => {});
            }
            const r = await applyOne(client, guild, message.member, key, roleId, lang, 'discord');
            return message.reply({ ...mainView(guild, client.db, lang, message.author.id, r.notice || r.problem), flags: V2, allowedMentions: { parse: [] } }).catch(() => {});
        }
        return message.reply(t('roles.usage_set', lang)).catch(() => {});
    },

    // Buttons and menus of the panel. The opener's id travels in every customId: nobody else can drive it.
    handleComponent: async (interaction, client) => {
        const guild = interaction.guild;
        if (!guild) return;
        const lang = pickLang(client, guild.id, interaction);
        const parts = interaction.customId.split(':');
        const action = parts[1];
        const ownerId = parts[parts.length - 1];
        const deny = (key) => interaction.reply({ content: t(key, lang), flags: MessageFlags.Ephemeral }).catch(() => {});

        if (!/^\d{17,20}$/.test(ownerId)) return deny('roles.expired');
        if (interaction.user.id !== ownerId) return deny('roles.not_yours');
        // Permissions are checked again on every click: they may have changed since the panel opened
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!R.canManage(member)) return deny('roles.need_perms');

        const update = (view) => interaction.update({ ...view, flags: V2, allowedMentions: { parse: [] } });

        if (action === 'menu') {
            const key = interaction.values?.[0];
            if (!R.BY_KEY[key]) return deny('roles.expired');
            return update(editView(guild, client.db, lang, ownerId, key));
        }
        if (action === 'back') return update(mainView(guild, client.db, lang, ownerId));
        if (action === 'mk') {
            if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return deny('roles.mk_noperm');
            return update(createView(guild, client.db, lang, ownerId));
        }
        if (action === 'mkok') {
            if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return deny('roles.mk_noperm');
            await interaction.deferUpdate().catch(() => {});
            const db = client.db;
            const before = R.readSlots(db, guild.id);
            const groups = missingRewards(guild, db, lang);
            if (!countMissing(groups)) return interaction.editReply({ ...mainView(guild, db, lang, ownerId, t('roles.mk_nothing', lang)), flags: V2, allowedMentions: { parse: [] } }).catch(() => {});
            let made = 0, reused = 0;
            const eco = await createEconomyRoles(guild, db, lang, member);
            made += eco.made; reused += eco.reused;
            R.writeSlots(client, db, guild.id, R.readSlots(db, guild.id), eco.next);
            for (const g of groups.filter((x) => x.set)) {
                const r = await require('./leveling.js').createRoles(guild, db, lang, g.set).catch(() => ({}));
                made += r.made || 0; reused += r.reused || 0;
            }
            try { client.settings?.delete?.(guild.id); } catch { /* reloads */ }
            const after = R.readSlots(db, guild.id);
            const changes = R.SLOTS.filter((x) => (before[x.key] || null) !== (after[x.key] || null)).map((x) => ({ key: x.key, before: before[x.key] || null, after: after[x.key] || null }));
            console.log(`[ROLES] guild=${guild.id} by=${interaction.user.id} reward roles: ${made} created, ${reused} reused`);
            await R.logChanges(guild, db, changes, interaction.user.id, 'discord', lang);
            const notice = [made ? t('roles.mk_done', lang, { n: made }) : null, reused ? t('roles.mk_reused', lang, { n: reused }) : null].filter(Boolean).join(' ') || t('roles.mk_nothing', lang);
            return interaction.editReply({ ...mainView(guild, db, lang, ownerId, notice), flags: V2, allowedMentions: { parse: [] } }).catch(() => {});
        }

        const key = parts[2];
        if (!R.BY_KEY[key]) return deny('roles.expired');
        if (action === 'pick' || action === 'clear') {
            const roleId = action === 'pick' ? interaction.values?.[0] : null;
            if (action === 'pick' && !roleId) return update(editView(guild, client.db, lang, ownerId, key));
            const r = await applyOne(client, guild, member, key, roleId, lang, 'discord');
            if (r.problem) return update(editView(guild, client.db, lang, ownerId, key, r.problem));
            return update(mainView(guild, client.db, lang, ownerId, r.notice));
        }
        return deny('roles.expired');
    },
};
