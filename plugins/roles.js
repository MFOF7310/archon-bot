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
