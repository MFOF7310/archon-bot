// /ban — ban (with a confirmation), unban, and the invite unbanned members get to come back.
// Shared rules live in lib/mod-core.js: role order, clean reasons, case record, mod-log card.
const crypto = require('crypto');
const {
    SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const M = require('../lib/mod-core');

const OWNER_GUILD_INVITE = 'https://discord.gg/NFSMFJajp9';
const INVITE_PATTERN = /^(https?:\/\/)?(discord\.gg\/|discordapp\.com\/invite\/|discord\.com\/invite\/)[a-zA-Z0-9_-]{2,32}$/i;
const DELETE_CHOICES = { none: 0, '1h': 3600, '24h': 86400, '7d': 604800 };

// Confirmations waiting for a click (2 minutes). Lost on restart: the button then says "expired".
const pending = new Map();
const PENDING_TTL = 2 * 60 * 1000;
function remember(data) {
    const now = Date.now();
    for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
    const nonce = crypto.randomBytes(5).toString('hex');
    pending.set(nonce, { ...data, expires: now + PENDING_TTL });
    return nonce;
}

let inviteColumn = false;
function ensureInviteColumn(db) {
    if (inviteColumn) return;
    try {
        const cols = db.prepare('PRAGMA table_info(server_settings)').all().map(c => c.name);
        if (!cols.includes('server_invite')) db.prepare('ALTER TABLE server_settings ADD COLUMN server_invite TEXT').run();
        inviteColumn = true;
    } catch (e) { console.error('[BAN] invite column:', e.message); }
}
// Only this server's own invite (or the owner's server invite on the owner's server): never another server's link
function rejoinInvite(db, guildId) {
    try {
        ensureInviteColumn(db);
        const row = db.prepare('SELECT server_invite FROM server_settings WHERE guild_id = ?').get(guildId);
        if (row?.server_invite && INVITE_PATTERN.test(row.server_invite)) return row.server_invite;
    } catch { /* no invite */ }
    return guildId === process.env.GUILD_ID ? OWNER_GUILD_INVITE : null;
}

const confirmRow = (nonce, actorId, lang) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`modban:go:${nonce}:${actorId}`).setLabel(M.T('btn_ban', lang)).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`modban:no:${nonce}:${actorId}`).setLabel(M.T('btn_cancel', lang)).setStyle(ButtonStyle.Secondary),
);

// Every check before asking for confirmation. Returns null when the ban may go ahead, else the text to show.
async function precheck(guild, actor, user, lang, ctx) {
    if (!M.hasPerm(actor, PermissionFlagsBits.BanMembers)) return M.T('no_perm', lang, { perm: 'Ban Members' });
    const member = await guild.members.fetch(user.id).catch(() => null);
    const code = M.checkTarget(guild, actor, user.id, member, 'ban');
    if (code) return M.targetText(code, lang, guild, member, 'ban', ctx);
    if (await guild.bans.fetch(user.id).catch(() => null)) return M.T('already_banned', lang);
    return null;
}

async function doBan(client, guild, actor, user, reason, deleteSeconds, lang, ctx) {
    const db = client.db;
    const caseId = M.record(db, { guildId: guild.id, userId: user.id, moderatorId: actor.id, action: 'ban', reason });
    // The message has to go out before the ban: afterwards ARCHON shares no server with them
    const sent = await M.dm(user, M.card({ look: 'ban', title: M.T('ban_dm_title', lang, { server: M.safe(guild.name) }), lines: [[M.T('l_reason', lang), M.safe(reason)]], ctx }));
    await guild.members.ban(user.id, { reason: M.auditReason(reason, actor), deleteMessageSeconds: deleteSeconds });
    const lines = [
        [M.T('l_member', lang), M.who(user)],
        [M.T('l_moderator', lang), `<@${actor.id}>`],
        [M.T('l_reason', lang), M.safe(reason)],
        deleteSeconds ? [M.T('l_deleted', lang), M.T({ 3600: 'del_1h', 86400: 'del_24h', 604800: 'del_7d' }[deleteSeconds], lang)] : null,
        [M.T('l_dm', lang), M.T(sent ? 'dm_yes' : 'dm_no', lang)],
    ];
    const result = () => M.card({ look: 'ban', title: M.T('ban_done', lang), lines, avatar: M.avatarOf(user), footer: M.footerFor(caseId, lang), ctx });
    await M.toModLog(guild, db, result());
    console.log(`[BAN] guild=${guild.id} by=${actor.id} user=${user.id} case=${caseId}`);
    return result();
}

async function doUnban(client, guild, actor, userId, reason, lang, ctx) {
    const db = client.db;
    if (!M.hasPerm(actor, PermissionFlagsBits.BanMembers)) return { error: M.T('no_perm', lang, { perm: 'Ban Members' }) };
    const ban = await guild.bans.fetch(userId).catch(() => null);
    if (!ban) return { error: M.T('not_banned', lang) };
    await guild.members.unban(userId, M.auditReason(reason, actor));
    const caseId = M.record(db, { guildId: guild.id, userId, moderatorId: actor.id, action: 'unban', reason });
    const user = ban.user;
    const invite = rejoinInvite(db, guild.id);
    const dmCard = M.card({ look: 'unban', title: M.T('unban_dm_title', lang, { server: M.safe(guild.name) }), lines: [[M.T('l_reason', lang), M.safe(reason)], invite ? [null, M.T('unban_dm_rejoin', lang)] : null], ctx });
    let sent = false;
    try {
        await user.send({ components: invite ? [dmCard, new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(invite.startsWith('http') ? invite : `https://${invite}`).setLabel(M.T('btn_rejoin', lang)))] : [dmCard], flags: M.V2, allowedMentions: { parse: [] } });
        sent = true;
    } catch { /* DMs closed or no shared server */ }
    const lines = [
        [M.T('l_member', lang), M.who(user)],
        [M.T('l_moderator', lang), `<@${actor.id}>`],
        [M.T('l_reason', lang), M.safe(reason)],
        [M.T('l_dm', lang), M.T(sent ? 'dm_yes' : 'dm_no', lang)],
    ];
    const make = () => M.card({ look: 'unban', title: M.T('unban_done', lang), lines, avatar: M.avatarOf(user), footer: M.footerFor(caseId, lang), ctx });
    await M.toModLog(guild, db, make());
    console.log(`[UNBAN] guild=${guild.id} by=${actor.id} user=${userId} case=${caseId}`);
    return { card: make() };
}

function inviteView(db, guild, lang, ctx) {
    const invite = rejoinInvite(db, guild.id);
    const own = invite && invite !== OWNER_GUILD_INVITE ? invite : (guild.id === process.env.GUILD_ID ? invite : null);
    return M.card({ look: 'info', title: M.T('invite_title', lang), lines: [[null, own ? M.T('invite_custom', lang, { invite: own }) : M.T('invite_none', lang)]], ctx });
}
function saveInvite(client, guild, link, lang) {
    let invite = String(link || '').trim();
    if (!INVITE_PATTERN.test(invite)) return { error: M.T('invite_invalid', lang) };
    if (!invite.startsWith('http')) invite = `https://${invite}`;
    ensureInviteColumn(client.db);
    client.db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(guild.id);
    client.db.prepare('UPDATE server_settings SET server_invite = ? WHERE guild_id = ?').run(invite, guild.id);
    client.settings?.delete?.(guild.id);
    return { invite };
}

module.exports = {
    name: 'ban',
    aliases: ['banish', 'permaban', 'hammer', 'bannir', 'unban', 'pardon', 'debannir', 'setinvite', 'getinvite'],
    description: 'Ban or unban members, and set the invite unbanned members get',
    category: 'MODERATION',
    usage: '.ban @member [reason] | .unban <user id> [reason] | .ban setinvite <link> | .ban getinvite',
    cooldown: 5000,
    userPermissions: ['BanMembers'],

    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban or unban members')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(s => s.setName('ban').setDescription('Ban a member (asks for confirmation)')
            .addUserOption(o => o.setName('user').setDescription('Who to ban (they don\'t need to be in the server)').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Why (shown to them and in the audit log)').setMaxLength(400))
            .addStringOption(o => o.setName('delete_messages').setDescription('Also delete their recent messages')
                .addChoices({ name: 'None', value: 'none' }, { name: 'Last hour', value: '1h' }, { name: 'Last 24 hours', value: '24h' }, { name: 'Last 7 days', value: '7d' })))
        .addSubcommand(s => s.setName('unban').setDescription('Unban someone')
            .addStringOption(o => o.setName('user_id').setDescription('Their user ID').setRequired(true).setMinLength(17).setMaxLength(20))
            .addStringOption(o => o.setName('reason').setDescription('Why').setMaxLength(400)))
        .addSubcommand(s => s.setName('setinvite').setDescription('Set the invite unbanned members get to come back')
            .addStringOption(o => o.setName('invite').setDescription('A discord.gg invite link').setRequired(true)))
        .addSubcommand(s => s.setName('getinvite').setDescription('See the invite unbanned members get')),

    execute: async (interaction, client) => {
        const guild = interaction.guild;
        const lang = M.langFor(client, interaction);
        const actor = await guild.members.fetch(interaction.user.id).catch(() => null);
        const sub = interaction.options.getSubcommand();

        if (sub === 'getinvite') return M.respond(interaction, { components: [inviteView(client.db, guild, lang, interaction)] }, { ephemeral: true });
        if (!M.hasPerm(actor, PermissionFlagsBits.BanMembers)) return M.fail(interaction, M.T('no_perm', lang, { perm: 'Ban Members' }), lang);

        if (sub === 'setinvite') {
            const r = saveInvite(client, guild, interaction.options.getString('invite'), lang);
            if (r.error) return M.fail(interaction, r.error, lang);
            return M.respond(interaction, { components: [M.card({ look: 'info', title: M.T('invite_title', lang), lines: [[null, M.T('invite_set', lang, { invite: r.invite })]], ctx: interaction })] }, { ephemeral: true });
        }

        if (sub === 'unban') {
            const id = String(interaction.options.getString('user_id') || '').replace(/[<@!>]/g, '');
            if (!M.SNOWFLAKE.test(id)) return M.fail(interaction, M.T('not_banned', lang), lang);
            await interaction.deferReply();
            const r = await doUnban(client, guild, actor, id, M.cleanReason(interaction.options.getString('reason'), lang), lang, interaction);
            if (r.error) return interaction.editReply({ content: r.error, allowedMentions: { parse: [] } });
            return interaction.editReply({ components: [r.card], flags: M.V2, allowedMentions: { parse: [] } });
        }

        // ban: check everything, then ask
        const user = interaction.options.getUser('user');
        const problem = await precheck(guild, actor, user, lang, interaction);
        if (problem) return M.fail(interaction, problem, lang);
        const reason = M.cleanReason(interaction.options.getString('reason'), lang);
        const deleteSeconds = DELETE_CHOICES[interaction.options.getString('delete_messages') || 'none'] || 0;
        const nonce = remember({ guildId: guild.id, actorId: actor.id, userId: user.id, reason, deleteSeconds, lang, channelId: interaction.channelId, ephemeral: true });
        const ask = M.card({ look: 'ban', title: M.T('ban_confirm_title', lang, { user: M.safe(user.username) }), lines: [[null, M.T('ban_confirm_text', lang)], [M.T('l_reason', lang), M.safe(reason)]], avatar: M.avatarOf(user), ctx: interaction });
        return interaction.reply({ components: [ask, confirmRow(nonce, actor.id, lang)], flags: M.V2 | MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    },

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const guild = message.guild;
        if (!guild) return;
        const lang = M.langFor(client, message);
        const actor = message.member;
        const used = String(usedCommand || 'ban').toLowerCase();
        const first = String(args[0] || '').toLowerCase();

        if (used === 'getinvite' || first === 'getinvite') return M.respond(message, { components: [inviteView(client.db, guild, lang, message)] });
        if (!M.hasPerm(actor, PermissionFlagsBits.BanMembers)) return M.fail(message, M.T('no_perm', lang, { perm: 'Ban Members' }), lang);
        if (used === 'setinvite' || first === 'setinvite') {
            const r = saveInvite(client, guild, used === 'setinvite' ? args[0] : args[1], lang);
            if (r.error) return M.fail(message, r.error, lang);
            return M.respond(message, { components: [M.card({ look: 'info', title: M.T('invite_title', lang), lines: [[null, M.T('invite_set', lang, { invite: r.invite })]], ctx: message })] });
        }

        const id = String(args[0] || '').replace(/[<@!>]/g, '');
        if (!M.SNOWFLAKE.test(id)) return message.reply({ content: M.T('usage_ban', lang), allowedMentions: { parse: [] } }).catch(() => {});
        const reason = M.cleanReason(args.slice(1).join(' '), lang);

        if (['unban', 'pardon', 'debannir'].includes(used)) {
            const r = await doUnban(client, guild, actor, id, reason, lang, message);
            if (r.error) return M.fail(message, r.error, lang);
            return M.respond(message, { components: [r.card] });
        }

        const user = await client.users.fetch(id).catch(() => null);
        if (!user) return M.fail(message, M.T('not_member', lang), lang);
        const problem = await precheck(guild, actor, user, lang, message);
        if (problem) return M.fail(message, problem, lang);
        const nonce = remember({ guildId: guild.id, actorId: actor.id, userId: user.id, reason, deleteSeconds: 0, lang, channelId: message.channelId, ephemeral: false });
        const ask = M.card({ look: 'ban', title: M.T('ban_confirm_title', lang, { user: M.safe(user.username) }), lines: [[null, M.T('ban_confirm_text', lang)], [M.T('l_reason', lang), M.safe(reason)]], avatar: M.avatarOf(user), ctx: message });
        return message.reply({ components: [ask, confirmRow(nonce, actor.id, lang)], flags: M.V2, allowedMentions: { parse: [] } }).catch(() => {});
    },

    // The two confirmation buttons. The moderator's id is in the button; the ban details stay on the bot.
    handleComponent: async (interaction, client) => {
        const [, action, nonce, actorId] = interaction.customId.split(':');
        const guild = interaction.guild;
        const lang = M.langFor(client, interaction);
        const deny = (key) => interaction.reply({ content: M.T(key, lang), flags: MessageFlags.Ephemeral }).catch(() => {});
        if (!guild) return;
        if (interaction.user.id !== actorId) return deny('not_yours');
        const p = pending.get(nonce);
        if (!p || p.expires < Date.now() || p.guildId !== guild.id || p.actorId !== actorId) {
            pending.delete(nonce);
            return interaction.update({ components: [M.card({ look: 'info', title: M.T('expired', lang), ctx: interaction })], flags: M.V2 }).catch(() => deny('expired'));
        }
        pending.delete(nonce);
        if (action === 'no') return interaction.update({ components: [M.card({ look: 'info', title: M.T('cancelled', p.lang), ctx: interaction })], flags: M.V2 });

        // Checked again: roles or permissions may have changed while the question was open
        const actor = await guild.members.fetch(actorId).catch(() => null);
        const user = await client.users.fetch(p.userId).catch(() => null);
        const problem = !actor || !user ? M.T('expired', p.lang) : await precheck(guild, actor, user, p.lang, interaction);
        if (problem) return interaction.update({ components: [M.card({ look: 'error', title: M.T('refused', p.lang), lines: [[null, problem]], ctx: interaction })], flags: M.V2, allowedMentions: { parse: [] } });

        await interaction.deferUpdate();
        try {
            const result = await doBan(client, guild, actor, user, p.reason, p.deleteSeconds, p.lang, interaction);
            await interaction.editReply({ components: [result], flags: M.V2, allowedMentions: { parse: [] } });
            // The confirmation was private: let the channel see the outcome too
            if (p.ephemeral) await interaction.channel?.send({ components: [result], flags: M.V2, allowedMentions: { parse: [] } }).catch(() => {});
        } catch (e) {
            console.error(`[BAN] guild=${guild.id} user=${p.userId}:`, e.message);
            const text = require('../lib/botPerms').explainError(e, interaction, 'ban', p.lang) || M.T('above_bot', p.lang);
            await interaction.editReply({ components: [M.card({ look: 'error', title: M.T('refused', p.lang), lines: [[null, text]], ctx: interaction })], flags: M.V2, allowedMentions: { parse: [] } }).catch(() => {});
        }
    },
};

