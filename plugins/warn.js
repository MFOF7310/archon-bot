// /warn — warnings, their history, and the automatic action when a member reaches the server's limit
// ("Max warnings" in the dashboard; it was saved but never applied before).
const crypto = require('crypto');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const M = require('../lib/mod-core');

const WARN_DAYS = 30;
const now = () => Math.floor(Date.now() / 1000);
const newId = () => `W-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

function activeCount(db, guildId, userId) {
    return db.prepare('SELECT COUNT(*) AS n FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)').get(guildId, userId, now()).n;
}

function limits(db, guildId) {
    try {
        const row = db.prepare('SELECT max_warnings, warning_action FROM server_settings WHERE guild_id = ?').get(guildId) || {};
        const max = Number(row.max_warnings) || 3;
        const action = ['mute', 'kick', 'ban', 'none'].includes(String(row.warning_action)) ? String(row.warning_action) : 'mute';
        return { max: Math.max(1, Math.min(10, max)), action };
    } catch { return { max: 3, action: 'mute' }; }
}

// The automatic action at the limit. Returns a line for the card, or null.
async function autoAction(client, guild, member, count, lang, ctx) {
    const { max, action } = limits(client.db, guild.id);
    if (action === 'none' || count < max || !member) return null;
    const me = guild.members.me;
    const label = M.T(`action_${action}`, lang);
    const reason = M.auditReason(`${count} warnings`, me.user);
    try {
        if (action === 'mute') {
            if (!member.moderatable || member.permissions?.has(PermissionFlagsBits.Administrator)) throw Object.assign(new Error('not moderatable'), { why: 'role' });   // access-ok: the target
            await member.timeout(60 * 60 * 1000, reason);
        } else if (action === 'kick') {
            if (!member.kickable) throw Object.assign(new Error('not kickable'), { why: 'role' });
            await member.kick(reason);
        } else {
            if (!member.bannable) throw Object.assign(new Error('not bannable'), { why: 'role' });
            await guild.members.ban(member.id, { reason });
        }
        M.record(client.db, { guildId: guild.id, userId: member.id, moderatorId: me.id, action: action === 'mute' ? 'mute' : action, reason: `Automatic: ${count} warnings` });
        return M.T('warn_auto', lang, { count, action: label });
    } catch (e) {
        const why = e.why === 'role' ? M.T('target_above_bot', lang) : (require('../lib/botPerms').explainError(e, ctx, action === 'mute' ? 'mute' : action, lang) || e.message);
        return M.T('warn_auto_failed', lang, { count, action: label, why });
    }
}

async function addWarning(client, guild, actor, user, reason, lang, ctx) {
    const db = client.db;
    M.ensureTables(db);
    if (!M.hasPerm(actor, PermissionFlagsBits.ModerateMembers)) return { error: M.T('no_perm', lang, { perm: 'Timeout Members' }) };
    const member = await guild.members.fetch(user.id).catch(() => null);
    const code = M.checkTarget(guild, actor, user.id, member, 'warn') || (user.bot ? 'bot' : null);
    if (code) return { error: M.targetText(code, lang, guild, member, 'warn', ctx) };

    const id = newId();
    db.prepare('INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, created_at, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)')
        .run(id, guild.id, user.id, actor.id, reason, now(), now() + WARN_DAYS * 86400);
    const caseId = M.record(db, { guildId: guild.id, userId: user.id, moderatorId: actor.id, action: 'warn', reason, warningId: id });
    const count = activeCount(db, guild.id, user.id);
    const { max } = limits(db, guild.id);
    const sent = await M.dm(user, require('../lib/appeals').attach(M.card({ look: 'warn', title: M.T('warn_dm_title', lang, { server: M.safe(guild.name) }), lines: [[M.T('l_reason', lang), M.safe(reason)], [M.T('l_warnings', lang), `${count} / ${max}`]], ctx }), guild.id, caseId, lang));
    const auto = await autoAction(client, guild, member, count, lang, ctx);
    const lines = [
        [M.T('l_member', lang), M.who(user)],
        [M.T('l_moderator', lang), `<@${actor.id}>`],
        [M.T('l_reason', lang), M.safe(reason)],
        [M.T('l_warnings', lang), `${count} / ${max}`],
        [M.T('l_id', lang), `\`${id}\``],
        [M.T('l_dm', lang), M.T(sent ? 'dm_yes' : 'dm_no', lang)],
        auto ? [null, `> ${auto}`] : null,
    ];
    const make = () => M.card({ look: 'warn', title: M.T('warn_done', lang), lines, avatar: M.avatarOf(user), footer: M.footerFor(caseId, lang), ctx });
    await M.toModLog(guild, db, make());
    return { card: make() };
}

// /warn history: active warnings first, each with its Remove button, then the moderation history; Clear all goes
// through lib/confirm. The opener's id is in every button: only they can use it (and Timeout Members is checked again).
const SHOWN = 5;
function historyCard(db, guild, user, lang, ctx, actorId, notice = null) {
    M.ensureTables(db);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder } = require('discord.js');
    const { icon } = require('../lib/ui/icons');
    const t = now();
    const active = db.prepare('SELECT id, reason, created_at FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC').all(guild.id, user.id, t);
    const total = db.prepare('SELECT COUNT(*) AS n FROM warnings WHERE guild_id = ? AND user_id = ?').get(guild.id, user.id).n;
    const logs = db.prepare("SELECT id, action, reason, moderator_id, timestamp FROM moderation_logs WHERE guild_id = ? AND user_id = ? AND action != 'warn' ORDER BY timestamp DESC LIMIT 6").all(guild.id, user.id);
    const name = (a) => { const k = `act_${a}`; const v = M.T(k, lang); return v === `mod.${k}` ? a : v; };
    const c = M.card({ look: active.length ? 'warn' : 'info', title: M.T('hist_title', lang, { user: M.safe(user.username) }), avatar: M.avatarOf(user), ctx,
        lines: [[null, M.T('hist_sub', lang, { active: active.length, total, logs: logs.length })]] });
    if (notice) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${icon('ok', ctx)} ${notice}`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    if (!active.length) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${M.T('hist_active', lang)}**\n${M.T('hist_none_active', lang)}`));
    else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${M.T('hist_active', lang)}**`));
        for (const w of active.slice(0, SHOWN)) {
            c.addSectionComponents(new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${M.safe(String(w.reason || '').slice(0, 120))}\n-# <t:${w.created_at}:R>`))
                .setButtonAccessory(new ButtonBuilder().setCustomId(`warnx:rm:${w.id}:${user.id}:${actorId}`).setLabel(M.T('btn_remove', lang)).setStyle(ButtonStyle.Secondary).setEmoji(icon('x', ctx))));
        }
        if (active.length > SHOWN) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${M.T('warn_list_more', lang, { n: active.length - SHOWN })}`));
    }
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${M.T('hist_logs', lang)}**\n${logs.length
        ? logs.map((r) => `-# **${name(r.action)}** · <t:${r.timestamp}:R> · <@${r.moderator_id}>${r.reason ? ` · ${M.safe(String(r.reason).slice(0, 80))}` : ''}`).join('\n')
        : M.T('hist_none_logs', lang)}`));
    if (active.length > 1) c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`warnx:clear:${user.id}:${actorId}`).setLabel(M.T('btn_clear_all', lang)).setStyle(ButtonStyle.Danger).setEmoji(icon('trash', ctx))));
    return c;
}

function clearWarnings(client, guild, actor, user, lang) {
    const db = client.db;
    M.ensureTables(db);
    if (!M.hasPerm(actor, PermissionFlagsBits.ModerateMembers)) return { error: M.T('no_perm', lang, { perm: 'Timeout Members' }) };
    const n = db.prepare('UPDATE warnings SET active = 0 WHERE guild_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)').run(guild.id, user.id, now()).changes;
    if (!n) return { error: M.T('warn_none_active', lang, { user: M.safe(user.username) }) };
    M.record(db, { guildId: guild.id, userId: user.id, moderatorId: actor.id, action: 'clear', reason: `${n} warnings` });
    return { text: M.T('warn_cleared', lang, { count: n, user: M.safe(user.username) }) };
}

function removeWarning(client, guild, actor, id, lang) {
    const db = client.db;
    M.ensureTables(db);
    if (!M.hasPerm(actor, PermissionFlagsBits.ModerateMembers)) return { error: M.T('no_perm', lang, { perm: 'Timeout Members' }) };
    const clean = String(id || '').trim().toUpperCase().slice(0, 40);
    const w = db.prepare('SELECT user_id FROM warnings WHERE id = ? AND guild_id = ? AND active = 1').get(clean, guild.id);
    if (!w) return { error: M.T('warn_not_found', lang) };
    db.prepare('UPDATE warnings SET active = 0 WHERE id = ? AND guild_id = ?').run(clean, guild.id);
    M.record(db, { guildId: guild.id, userId: w.user_id, moderatorId: actor.id, action: 'remove', reason: clean, warningId: clean });
    return { text: M.T('warn_removed', lang, { id: clean }) };
}

require('../lib/confirm').define('warn.clear', {
    access: 'timeout',
    run: async (ix, client, data, lang) => {
        const user = await client.users.fetch(data.userId).catch(() => null);
        if (!user) return {};
        const r = clearWarnings(client, ix.guild, ix.member, user, lang);
        const { card } = require('../lib/games/v2');
        return { cleared: r.error ? 0 : 1, payload: card(r.error ? 0x8D897F : 0x2ECC71, [{ text: r.error || r.text }]) };
    },
    log: (lang, data, res) => (res.cleared ? M.T('clear_log', lang, { user: `<@${data.userId}>` }) : null),
});

module.exports = {
    name: 'warn',
    aliases: ['w', 'warning', 'warnings', 'modlogs', 'clearwarn', 'removewarn', 'avertir', 'avertissement', 'historique'],
    description: 'Warn members and see their moderation history',
    category: 'MODERATION',
    cooldown: 3000,
    userPermissions: ['ModerateMembers'],
    usage: '.warn @member [reason] | .warnings @member | .clearwarn @member | .removewarn <id> | .modlogs @member',

    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn members and see their moderation history')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(s => s.setName('add').setDescription('Warn a member')
            .addUserOption(o => o.setName('target').setDescription('Member').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Why').setMaxLength(400)))
        // list, clear, remove and modlogs became one card: /warn history (remove and clear are buttons on it)
        .addSubcommand(s => s.setName('history').setDescription('A member\'s warnings and moderation history')
            .setDescriptionLocalizations({ fr: 'Les avertissements et l\'historique de modération d\'un membre' })
            .addUserOption(o => o.setName('target').setDescription('Member').setRequired(true))),

    execute: async (interaction, client) => {
        const guild = interaction.guild;
        const lang = M.langFor(client, interaction);
        const actor = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!M.hasPerm(actor, PermissionFlagsBits.ModerateMembers)) return M.fail(interaction, M.T('no_perm', lang, { perm: 'Timeout Members' }), lang);
        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser('target');

        if (sub === 'history') return M.respond(interaction, { components: [historyCard(client.db, guild, user, lang, interaction, interaction.user.id)] }, { ephemeral: true });
        await interaction.deferReply();
        const r = await addWarning(client, guild, actor, user, M.cleanReason(interaction.options.getString('reason'), lang), lang, interaction);
        if (r.error) {
            await interaction.deleteReply().catch(() => {});
            return interaction.followUp({ components: [M.card({ look: 'error', title: M.T('refused', lang), lines: [[null, r.error]], ctx: interaction })], flags: M.V2 | 64, allowedMentions: { parse: [] } });
        }
        return interaction.editReply({ components: [r.card], flags: M.V2, allowedMentions: { parse: [] } });
    },

    // The history card's buttons: warnx:rm:<warning>:<user>:<opener> and warnx:clear:<user>:<opener>
    handleComponent: async (interaction, client) => {
        const guild = interaction.guild;
        if (!guild) return;
        const lang = M.langFor(client, interaction);
        const parts = interaction.customId.split(':');
        const actorId = parts[parts.length - 1];
        if (interaction.user.id !== actorId) return interaction.reply({ content: M.T('not_yours', lang), flags: 64 }).catch(() => {});
        const actor = await guild.members.fetch(actorId).catch(() => null);
        if (!M.hasPerm(actor, PermissionFlagsBits.ModerateMembers)) return interaction.reply({ content: M.T('no_perm', lang, { perm: 'Timeout Members' }), flags: 64 }).catch(() => {});
        const user = await client.users.fetch(parts[parts[1] === 'rm' ? 3 : 2]).catch(() => null);
        if (!user) return interaction.reply({ content: M.T('expired', lang), flags: 64 }).catch(() => {});
        if (parts[1] === 'rm') {
            const r = removeWarning(client, guild, actor, parts[2], lang);
            if (r.error) return interaction.reply({ content: r.error, flags: 64, allowedMentions: { parse: [] } }).catch(() => {});
            return interaction.update({ components: [historyCard(client.db, guild, user, lang, interaction, actorId, r.text)], flags: M.V2, allowedMentions: { parse: [] } }).catch(() => {});
        }
        if (parts[1] === 'clear') {
            return interaction.reply({ ...require('../lib/confirm').card(client, {
                action: 'warn.clear', userId: actorId, guild, lang, where: interaction, danger: true,
                title: M.T('clear_confirm_title', lang, { user: M.safe(user.username) }), body: M.T('clear_confirm_body', lang),
                yes: M.T('btn_clear_all', lang), data: { userId: user.id },
            }), flags: M.V2 | 64 }).catch(() => {});
        }
        return interaction.deferUpdate().catch(() => {});
    },

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const guild = message.guild;
        if (!guild) return;
        const lang = M.langFor(client, message);
        if (!M.hasPerm(message.member, PermissionFlagsBits.ModerateMembers)) return M.fail(message, M.T('no_perm', lang, { perm: 'Timeout Members' }), lang);
        let used = String(usedCommand || 'warn').toLowerCase();
        // ".warn list @x" style also works
        const first = String(args[0] || '').toLowerCase();
        if (['list', 'warnings', 'clear', 'remove', 'modlogs', 'history', 'historique'].includes(first)) { used = { list: 'warnings', clear: 'clearwarn', remove: 'removewarn', history: 'modlogs', historique: 'modlogs' }[first] || first; args = args.slice(1); }
        const userFrom = async (raw) => { const id = String(raw || '').replace(/[<@!>]/g, ''); return M.SNOWFLAKE.test(id) ? client.users.fetch(id).catch(() => null) : null; };

        if (used === 'removewarn') {
            const r = removeWarning(client, guild, message.member, args[0], lang);
            if (r.error) return M.fail(message, r.error, lang);
            return M.respond(message, { components: [M.card({ look: 'info', title: r.text, ctx: message })] });
        }
        const user = await userFrom(args[0]);
        if (!user) return message.reply({ content: M.T('usage_warn', lang), allowedMentions: { parse: [] } }).catch(() => {});
        if (['warnings', 'avertissement', 'modlogs', 'historique', 'warning'].includes(used)) return M.respond(message, { components: [historyCard(client.db, guild, user, lang, message, message.author.id)] });
        if (used === 'clearwarn') {
            const r = clearWarnings(client, guild, message.member, user, lang);
            if (r.error) return M.fail(message, r.error, lang);
            return M.respond(message, { components: [M.card({ look: 'info', title: r.text, ctx: message })] });
        }
        const r = await addWarning(client, guild, message.member, user, M.cleanReason(args.slice(1).join(' '), lang), lang, message);
        if (r.error) return M.fail(message, r.error, lang);
        return M.respond(message, { components: [r.card] });
    },
};
