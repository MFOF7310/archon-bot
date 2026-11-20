// ═══════════════════════════════════════════════════════════════════════════
// /tempvoice setup | off — "Join to create" voice rooms
//   A member joins the hub channel → ARCHON creates their own voice room next to it and moves them in.
//   The room's text chat gets a small panel: rename, member limit, lock, claim. Empty rooms are deleted.
//   One room per member and server (joining the hub again brings them back to theirs).
//   ARCHON needs Manage Channels, Move Members and Connect in the hub's category.
// Admins: Manage Server. Texts: lang/<l>/tempvoice.json. Buttons, menu and form: tv:<action>:<channelId>
// ═══════════════════════════════════════════════════════════════════════════
const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder,
    TextInputBuilder, TextInputStyle, PermissionFlagsBits: P, MessageFlags, ChannelType,
} = require('discord.js');
const { t } = require('../lib/i18n');
const { icon } = require('../lib/ui/icons');
const v2 = require('../lib/games/v2');

const T = (lang, k, v) => t(`tempvoice.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const EPH = MessageFlags.Ephemeral;
const CYAN = 0x00F0FF, GREEN = 0x2ECC71, ORANGE = 0xE67E22;
const NEEDS = [['ManageChannels', P.ManageChannels], ['MoveMembers', P.MoveMembers], ['Connect', P.Connect], ['ViewChannel', P.ViewChannel]];
const LIMITS = [0, 2, 3, 4, 5, 6, 8, 10, 15, 20];
const COOLDOWN = 10_000;                 // one new room per member every 10 s (joining the hub in a loop)
const RENAMES = 2, RENAME_WINDOW = 600_000;   // Discord allows 2 renames of a channel per 10 minutes

// ── storage ──
function ensure(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS tempvoice_hubs (hub_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, category_id TEXT, user_limit INTEGER DEFAULT 0);
             CREATE TABLE IF NOT EXISTS tempvoice_rooms (channel_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, owner_id TEXT NOT NULL,
                 hub_id TEXT, created_at INTEGER, locked INTEGER DEFAULT 0);`);
}
const hubs = new Map();                  // hub channel id → row (loaded at start)
const rooms = new Map();                 // room channel id → row
function load(db) {
    ensure(db);
    hubs.clear(); rooms.clear();
    for (const r of db.prepare('SELECT * FROM tempvoice_hubs').all()) hubs.set(r.hub_id, r);
    for (const r of db.prepare('SELECT * FROM tempvoice_rooms').all()) rooms.set(r.channel_id, r);
}
const humans = (ch) => ch?.members?.filter?.((m) => !m.user.bot) || new Map();
const ownRoom = (guildId, userId) => [...rooms.values()].find((r) => r.guild_id === guildId && r.owner_id === userId);
const missingIn = (guild, where) => {
    const me = guild.members.me;
    const perms = where ? me?.permissionsIn(where) : me?.permissions;
    return NEEDS.filter(([, bit]) => !perms?.has(bit)).map(([name]) => name);
};

// ── the panel in the room's chat ──
function panel(lang, room, ch) {
    const id = ch.id;
    const limit = ch.userLimit ? T(lang, 'limitN', { n: ch.userLimit }) : T(lang, 'limitNone');
    return v2.card(CYAN, [
        { text: `-# ARCHON · ${T(lang, 'eyebrow')}\n### ${icon('voice', null) || '🎙️'} ${T(lang, 'panelTitle', { owner: `<@${room.owner_id}>` })}\n${T(lang, 'panelSub')}` },
        { text: `-# ${room.locked ? `${icon('lock', null) || '🔒'} ${T(lang, 'stateLocked')}` : T(lang, 'stateOpen')} · ${limit}` },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tv:rename:${id}`).setLabel(T(lang, 'btnRename')).setStyle(ButtonStyle.Secondary).setEmoji(icon('edit', null) || '✏️'),
            new ButtonBuilder().setCustomId(`tv:lock:${id}`).setLabel(T(lang, room.locked ? 'btnUnlock' : 'btnLock')).setStyle(room.locked ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(icon('lock', null) || '🔒'),
            new ButtonBuilder().setCustomId(`tv:claim:${id}`).setLabel(T(lang, 'btnClaim')).setStyle(ButtonStyle.Secondary).setEmoji(icon('crown', null) || '👑'),
        ) },
        // a locked room: the owner lets chosen members in (they get a DM with a join button) or sends someone out
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tv:invite:${id}`).setLabel(T(lang, 'btnInvite')).setStyle(ButtonStyle.Primary).setEmoji(icon('join', null) || '➕'),
            new ButtonBuilder().setCustomId(`tv:kick:${id}`).setLabel(T(lang, 'btnKick')).setStyle(ButtonStyle.Secondary).setEmoji(icon('x', null) || '✖️'),
        ) },
        { row: new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`tv:limit:${id}`).setPlaceholder(T(lang, 'pickLimit'))
            .addOptions(LIMITS.map((n) => ({ label: n ? T(lang, 'limitN', { n }) : T(lang, 'limitNone'), value: String(n), default: (ch.userLimit || 0) === n })))) },
    ]);
}
async function refreshPanel(client, ch, room) {
    if (!room.panel_id) return;
    const msg = await ch.messages.fetch(room.panel_id).catch(() => null);
    if (msg) await msg.edit(panel(langOf(client, ch.guild.id, null, room.owner_id), room, ch)).catch(() => {});
}

// ── create, move, clean ──
const lastCreate = new Map();
async function createRoom(client, member, hub) {
    const guild = member.guild, db = client.db;
    // already has a room here: back to it
    const mine = ownRoom(guild.id, member.id);
    const existing = mine && guild.channels.cache.get(mine.channel_id);
    if (existing) return member.voice.setChannel(existing).catch(() => {});
    if (Date.now() - (lastCreate.get(member.id) || 0) < COOLDOWN) return;
    lastCreate.set(member.id, Date.now());

    const hubCh = guild.channels.cache.get(hub.hub_id);
    const parent = hubCh?.parentId || hub.category_id || null;
    const name = `🎮 ${String(member.displayName || member.user.username).replace(/[\n\r]/g, ' ').slice(0, 90)}`;   // channel names can't hold custom emojis
    let ch;
    try {
        // created in the hub's category with its permissions; the owner may always connect (even once locked)
        ch = await guild.channels.create({ name, type: ChannelType.GuildVoice, parent, userLimit: hub.user_limit || 0, bitrate: hubCh?.bitrate, reason: `Temporary room for ${member.user.username}` });
        await ch.permissionOverwrites.edit(member.id, { Connect: true, ViewChannel: true }).catch(() => {});
    } catch (e) {
        console.warn(`[TEMPVOICE] guild=${guild.id} create failed: ${e.message}`);
        return;
    }
    const room = { channel_id: ch.id, guild_id: guild.id, owner_id: member.id, hub_id: hub.hub_id, created_at: Date.now(), locked: 0 };
    rooms.set(ch.id, room);
    db.prepare('INSERT OR REPLACE INTO tempvoice_rooms (channel_id, guild_id, owner_id, hub_id, created_at, locked) VALUES (?, ?, ?, ?, ?, 0)').run(ch.id, guild.id, member.id, hub.hub_id, room.created_at);
    const moved = await member.voice.setChannel(ch).then(() => true).catch((e) => { console.warn(`[TEMPVOICE] guild=${guild.id} move failed: ${e.message}`); return false; });
    if (!moved) return removeRoom(client, ch.id, true);   // no Move Members (or they left already): no empty room left behind
    const msg = await ch.send(panel(langOf(client, guild.id, null, member.id), room, ch)).catch(() => null);
    if (msg) room.panel_id = msg.id;
}

async function removeRoom(client, channelId, deleteChannel) {
    const room = rooms.get(channelId);
    rooms.delete(channelId);
    try { client.db.prepare('DELETE FROM tempvoice_rooms WHERE channel_id = ?').run(channelId); } catch { /* table gone */ }
    if (!deleteChannel) return;
    const ch = client.channels.cache.get(channelId);
    if (ch) await ch.delete('Temporary room is empty').catch((e) => console.warn(`[TEMPVOICE] delete ${channelId}: ${e.message}`));
    if (room) console.log(`[TEMPVOICE] guild=${room.guild_id} room closed`);
}

// someone left a room: empty → delete; owner gone → the longest-present member takes over
async function onLeave(client, channel) {
    const room = rooms.get(channel.id);
    if (!room) return;
    const left = humans(channel);
    if (!left.size) return removeRoom(client, channel.id, true);
    if (left.has(room.owner_id)) return;
    const next = [...left.values()][0];
    room.owner_id = next.id;
    client.db.prepare('UPDATE tempvoice_rooms SET owner_id = ? WHERE channel_id = ?').run(next.id, channel.id);
    await channel.permissionOverwrites.edit(next.id, { Connect: true, ViewChannel: true }).catch(() => {});
    const lang = langOf(client, channel.guild.id, null, next.id);
    await channel.send({ content: `${icon('crown', null) || '👑'} ${T(lang, 'newOwner', { user: `<@${next.id}>` })}`, allowedMentions: { users: [next.id] } }).catch(() => {});
    await refreshPanel(client, channel, room);
}

async function onVoice(client, oldS, newS) {
    try {
        if (oldS.channelId && oldS.channelId !== newS.channelId && rooms.has(oldS.channelId) && oldS.channel) await onLeave(client, oldS.channel);
        if (newS.channelId && newS.channelId !== oldS.channelId && hubs.has(newS.channelId) && newS.member && !newS.member.user.bot) {
            await createRoom(client, newS.member, hubs.get(newS.channelId));
        }
    } catch (e) { console.error('[TEMPVOICE]', e.message); }
}

// rooms that emptied or vanished while ARCHON was offline; hubs that were deleted
async function sweep(client) {
    for (const [id, room] of [...rooms]) {
        const ch = client.channels.cache.get(id);
        if (!client.guilds.cache.has(room.guild_id)) continue;           // server unavailable or left: its rows go with the 7-day purge
        if (!ch) await removeRoom(client, id, false);
        else if (!humans(ch).size) await removeRoom(client, id, true);
    }
    for (const [id, hub] of [...hubs]) {
        if (client.guilds.cache.has(hub.guild_id) && !client.channels.cache.get(id)) {
            hubs.delete(id);
            client.db.prepare('DELETE FROM tempvoice_hubs WHERE hub_id = ?').run(id);
        }
    }
}

// ── buttons, menu, form ──
async function handleComponent(interaction, client) {
    const [, action, channelId] = interaction.customId.split(':');
    const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
    const room = rooms.get(channelId);
    const ch = interaction.guild?.channels.cache.get(channelId);
    if (!room || !ch) return interaction.reply({ content: T(lang, 'gone'), flags: EPH }).catch(() => {});
    const isOwner = interaction.user.id === room.owner_id;
    const isStaff = interaction.memberPermissions?.has(P.ManageChannels);

    if (action === 'claim') {
        if (isOwner) return interaction.reply({ content: T(lang, 'alreadyOwner'), flags: EPH }).catch(() => {});
        if (humans(ch).has(room.owner_id) && !isStaff) return interaction.reply({ content: T(lang, 'ownerHere', { user: `<@${room.owner_id}>` }), flags: EPH }).catch(() => {});
        if (!humans(ch).has(interaction.user.id)) return interaction.reply({ content: T(lang, 'beInside'), flags: EPH }).catch(() => {});
        room.owner_id = interaction.user.id;
        client.db.prepare('UPDATE tempvoice_rooms SET owner_id = ? WHERE channel_id = ?').run(room.owner_id, channelId);
        await ch.permissionOverwrites.edit(room.owner_id, { Connect: true, ViewChannel: true }).catch(() => {});
        await interaction.reply({ content: `${icon('crown', null) || '👑'} ${T(lang, 'newOwner', { user: `<@${room.owner_id}>` })}`, allowedMentions: { parse: [] } }).catch(() => {});
        return refreshPanel(client, ch, room);
    }
    if (!isOwner && !isStaff) return interaction.reply({ content: T(lang, 'ownerOnly', { user: `<@${room.owner_id}>` }), flags: EPH }).catch(() => {});

    if (action === 'rename') {
        const input = new TextInputBuilder().setCustomId('name').setLabel(T(lang, 'nameLabel')).setStyle(TextInputStyle.Short)
            .setMaxLength(90).setMinLength(1).setRequired(true).setValue(ch.name.slice(0, 90)).setPlaceholder(T(lang, 'namePlaceholder'));
        return interaction.showModal(new ModalBuilder().setCustomId(`tv:renamed:${channelId}`).setTitle(T(lang, 'renameTitle'))
            .addComponents(new ActionRowBuilder().addComponents(input))).catch(() => {});
    }
    if (action === 'renamed') {
        const name = String(interaction.fields.getTextInputValue('name') || '').replace(/[\n\r]/g, ' ').trim().slice(0, 90);
        if (!name) return interaction.reply({ content: T(lang, 'nameEmpty'), flags: EPH }).catch(() => {});
        // Discord lets a channel be renamed twice per 10 minutes; a third waits silently for minutes, so say it instead
        room.renames = (room.renames || []).filter((at) => Date.now() - at < RENAME_WINDOW);
        if (room.renames.length >= RENAMES) {
            const free = Math.ceil((room.renames[0] + RENAME_WINDOW) / 1000);
            return interaction.reply({ content: T(lang, 'renameWait', { when: `<t:${free}:R>` }), flags: EPH }).catch(() => {});
        }
        room.renames.push(Date.now());
        await interaction.deferReply({ flags: EPH }).catch(() => {});
        const ok = await ch.setName(name).then(() => true).catch(() => false);
        return interaction.editReply({ content: ok ? T(lang, 'renamed', { name }) : T(lang, 'failed') }).catch(() => {});
    }
    if (action === 'invite' || action === 'kick') {
        const menu = new UserSelectMenuBuilder().setCustomId(`tv:${action}sel:${channelId}`).setPlaceholder(T(lang, action === 'invite' ? 'pickInvite' : 'pickKick')).setMinValues(1).setMaxValues(10);
        return interaction.reply({ content: T(lang, action === 'invite' ? 'inviteHow' : 'kickHow'), components: [new ActionRowBuilder().addComponents(menu)], flags: EPH }).catch(() => {});
    }
    if (action === 'invitesel') {
        await interaction.deferUpdate().catch(() => {});
        const url = `https://discord.com/channels/${ch.guild.id}/${ch.id}`;
        const done = [], pinged = [];
        for (const u of interaction.users?.values?.() || []) {
            if (u.bot || u.id === room.owner_id) continue;
            const ok = await ch.permissionOverwrites.edit(u.id, { Connect: true, ViewChannel: true }).then(() => true).catch(() => false);
            if (!ok) continue;
            done.push(u.id);
            // tell them: a DM with a join button, or a mention in the room's chat when their DMs are closed
            const ul = langOf(client, ch.guild.id, null, u.id);
            const dm = await u.send(v2.card(CYAN, [
                { text: `-# ARCHON · ${T(ul, 'eyebrow')}\n### ${icon('voice', null) || '🎙️'} ${T(ul, 'invitedTitle', { room: ch.name, guild: ch.guild.name })}\n${T(ul, 'invitedBody', { owner: `<@${room.owner_id}>` })}` },
                { row: new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(T(ul, 'btnJoin'))) },
            ])).then(() => true).catch(() => false);
            if (!dm) pinged.push(u.id);
        }
        if (pinged.length) await ch.send({ content: T(lang, 'invitedHere', { users: pinged.map((x) => `<@${x}>`).join(' '), owner: `<@${room.owner_id}>` }), allowedMentions: { users: pinged } }).catch(() => {});
        return interaction.editReply({ content: done.length ? T(lang, 'invitedDone', { users: done.map((x) => `<@${x}>`).join(' ') }) : T(lang, 'failed'), components: [], allowedMentions: { parse: [] } }).catch(() => {});
    }
    if (action === 'kicksel') {
        await interaction.deferUpdate().catch(() => {});
        const done = [];
        for (const u of interaction.users?.values?.() || []) {
            if (u.bot || u.id === room.owner_id || u.id === interaction.user.id) continue;
            await ch.permissionOverwrites.edit(u.id, { Connect: false }).catch(() => {});
            const m = ch.members.get(u.id);
            if (m) await m.voice.disconnect('Removed from the room by its owner').catch(() => {});
            done.push(u.id);
        }
        return interaction.editReply({ content: done.length ? T(lang, 'kickedDone', { users: done.map((x) => `<@${x}>`).join(' ') }) : T(lang, 'kickNone'), components: [], allowedMentions: { parse: [] } }).catch(() => {});
    }
    if (action === 'limit') {
        const n = Math.max(0, Math.min(99, Number(interaction.values?.[0]) || 0));
        const ok = await ch.setUserLimit(n).then(() => true).catch(() => false);
        if (!ok) return interaction.reply({ content: T(lang, 'failed'), flags: EPH }).catch(() => {});
        await interaction.update(panel(lang, room, ch)).catch(() => {});
        return;
    }
    if (action === 'lock') {
        const locked = room.locked ? 0 : 1;
        // locked: nobody new can connect (the people inside stay, and so does the owner, who has their own permission)
        const ok = await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: locked ? false : null }).then(() => true).catch(() => false);
        if (!ok) return interaction.reply({ content: T(lang, 'failed'), flags: EPH }).catch(() => {});
        if (locked) for (const m of humans(ch).values()) await ch.permissionOverwrites.edit(m.id, { Connect: true }).catch(() => {});
        room.locked = locked;
        client.db.prepare('UPDATE tempvoice_rooms SET locked = ? WHERE channel_id = ?').run(locked, channelId);
        return interaction.update(panel(lang, room, ch)).catch(() => {});
    }
}

// ── /tempvoice ──
async function setup(client, guild, user, lang, { category = null, limit = 0 } = {}) {
    const db = client.db;
    ensure(db);
    const already = [...hubs.values()].find((h) => h.guild_id === guild.id && guild.channels.cache.has(h.hub_id));
    if (already) return { card: doneCard(lang, guild, already, true) };
    const missing = missingIn(guild, category);
    if (missing.includes('ManageChannels')) return { error: T(lang, 'needManage') };
    let parent = category;
    if (!parent) {
        parent = await guild.channels.create({ name: T(lang, 'categoryName'), type: ChannelType.GuildCategory, reason: `/tempvoice setup by ${user.username}` }).catch(() => null);
        if (!parent) return { error: T(lang, 'failed') };
    }
    const hubCh = await guild.channels.create({ name: T(lang, 'hubName'), type: ChannelType.GuildVoice, parent: parent.id, reason: `/tempvoice setup by ${user.username}` }).catch(() => null);
    if (!hubCh) return { error: T(lang, 'failed') };
    const hub = { hub_id: hubCh.id, guild_id: guild.id, category_id: parent.id, user_limit: limit || 0 };
    db.prepare('INSERT OR REPLACE INTO tempvoice_hubs (hub_id, guild_id, category_id, user_limit) VALUES (?, ?, ?, ?)').run(hub.hub_id, guild.id, parent.id, hub.user_limit);
    hubs.set(hub.hub_id, hub);
    return { card: doneCard(lang, guild, hub, false) };
}
function doneCard(lang, guild, hub, already) {
    const missing = missingIn(guild, guild.channels.cache.get(hub.category_id) || null);
    const items = [
        { text: `-# ARCHON · ${T(lang, 'eyebrow')}\n### ${icon('gamepad', null) || '🎮'} ${T(lang, already ? 'alreadyTitle' : 'readyTitle')}\n${T(lang, 'readyBody', { hub: `<#${hub.hub_id}>` })}` },
        { text: `-# ${hub.user_limit ? T(lang, 'defaultLimit', { n: hub.user_limit }) : T(lang, 'defaultNoLimit')} · ${T(lang, 'offHint')}` },
    ];
    if (missing.length) items.push({ text: `${icon('warn', null) || '⚠️'} ${T(lang, 'missing', { perms: missing.join(', ') })}` });
    return v2.card(missing.length ? ORANGE : GREEN, items);
}
function off(client, guild) {
    const mine = [...hubs.values()].filter((h) => h.guild_id === guild.id);
    for (const h of mine) {
        hubs.delete(h.hub_id);
        client.db.prepare('DELETE FROM tempvoice_hubs WHERE hub_id = ?').run(h.hub_id);
        guild.channels.cache.get(h.hub_id)?.delete('/tempvoice off').catch(() => {});
    }
    return mine.length;   // rooms in use stay until they empty
}

module.exports = {
    name: 'tempvoice',
    aliases: ['tv', 'voicerooms', 'jtc'],
    description: '🎮 Join-to-create voice rooms: each member gets their own room.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.tempvoice setup | .tempvoice off',
    handleComponent,

    data: new SlashCommandBuilder().setName('tempvoice').setDescription('Join-to-create voice rooms')
        .setDescriptionLocalizations({ fr: 'Salons vocaux temporaires (rejoindre pour créer)' })
        .setDefaultMemberPermissions(P.ManageGuild)
        .addSubcommand((s) => s.setName('setup').setDescription('Create the "join to create" channel')
            .setDescriptionLocalizations({ fr: 'Créer le salon « rejoindre pour créer »' })
            .addChannelOption((o) => o.setName('category').setDescription('Category for the rooms (default: a new one)')
                .setDescriptionLocalizations({ fr: 'Catégorie des salons (par défaut : une nouvelle)' }).addChannelTypes(ChannelType.GuildCategory))
            .addIntegerOption((o) => o.setName('limit').setDescription('Default member limit of a new room (0 = none)')
                .setDescriptionLocalizations({ fr: 'Limite de membres par défaut (0 = aucune)' }).setMinValue(0).setMaxValue(99)))
        .addSubcommand((s) => s.setName('off').setDescription('Remove the "join to create" channel')
            .setDescriptionLocalizations({ fr: 'Retirer le salon « rejoindre pour créer »' })),

    async init(client, db) {
        load(db);
        // one listener, even when plugins are reloaded
        if (client._tempvoiceListener) client.off('voiceStateUpdate', client._tempvoiceListener);
        client._tempvoiceListener = (o, n) => onVoice(client, o, n);
        client.on('voiceStateUpdate', client._tempvoiceListener);
        clearInterval(client._tempvoiceSweep);
        client._tempvoiceSweep = setInterval(() => sweep(client).catch(() => {}), 10 * 60 * 1000);
        if (client.isReady()) sweep(client).catch(() => {});
        else client.once('ready', () => setTimeout(() => sweep(client).catch(() => {}), 15000));
    },

    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        if (!interaction.guild) return interaction.reply({ content: T(lang, 'serverOnly'), flags: EPH }).catch(() => {});
        const sub = interaction.options.getSubcommand();
        if (sub === 'off') {
            const n = off(client, interaction.guild);
            return interaction.reply({ content: n ? T(lang, 'offDone') : T(lang, 'offNone'), flags: EPH }).catch(() => {});
        }
        await interaction.deferReply({ flags: EPH }).catch(() => {});
        const r = await setup(client, interaction.guild, interaction.user, lang, { category: interaction.options.getChannel('category'), limit: interaction.options.getInteger('limit') || 0 });
        return interaction.editReply(r.card ? r.card : { content: `${icon('warn', null) || '⚠️'} ${r.error}` }).catch(() => {});
    },

    run: async (client, message, args) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        if (!message.guild) return;
        if (!message.member?.permissions.has(P.ManageGuild)) return message.reply(T(lang, 'adminOnly')).catch(() => {});
        if ((args[0] || '').toLowerCase() === 'off') return message.reply(off(client, message.guild) ? T(lang, 'offDone') : T(lang, 'offNone')).catch(() => {});
        if ((args[0] || '').toLowerCase() !== 'setup') return message.reply(T(lang, 'usage')).catch(() => {});
        const r = await setup(client, message.guild, message.author, lang);
        return message.reply(r.card || `${icon('warn', null) || '⚠️'} ${r.error}`).catch(() => {});
    },
};
