// /mute — Discord's own timeout: kept by Discord through restarts, up to 28 days, no role to set up.
// (The old version gave a role and removed it with a timer that was lost whenever the bot restarted.)
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const M = require('../lib/mod-core');

const MIN = 60 * 1000;
const MAX = 28 * 24 * 60 * 60 * 1000;

async function doMute(client, guild, actor, member, ms, reason, lang, ctx) {
    if (!M.hasPerm(actor, PermissionFlagsBits.ModerateMembers)) return { error: M.T('no_perm', lang, { perm: 'Timeout Members' }) };
    if (!member) return { error: M.T('not_member', lang) };
    if (!ms || ms < MIN || ms > MAX) return { error: M.T('mute_bad_duration', lang) };
    const code = M.checkTarget(guild, actor, member.id, member, 'mute');
    if (code) return { error: M.targetText(code, lang, guild, member, 'mute', ctx) };
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return { error: M.T('mute_admin', lang) };
    const until = member.communicationDisabledUntilTimestamp;
    if (until && until > Date.now()) return { error: M.T('already_muted', lang, { until: `<t:${Math.floor(until / 1000)}:f>` }) };

    try {
        await member.timeout(ms, M.auditReason(reason, actor));
    } catch (e) {
        console.error(`[MUTE] guild=${guild.id} user=${member.id}:`, e.message);
        return { error: require('../lib/botPerms').explainError(e, ctx, 'mute', lang) || M.T('above_bot', lang) };
    }
    const end = Math.floor((Date.now() + ms) / 1000);
    const caseId = M.record(client.db, { guildId: guild.id, userId: member.id, moderatorId: actor.id, action: 'mute', reason: `${reason} (${M.formatDuration(ms, 'en')})` });
    const sent = await M.dm(member.user, M.card({ look: 'mute', title: M.T('mute_dm_title', lang, { server: M.safe(guild.name) }), lines: [[M.T('l_until', lang), `<t:${end}:f>`], [M.T('l_reason', lang), M.safe(reason)]], ctx }));
    const lines = [
        [M.T('l_member', lang), M.who(member.user)],
        [M.T('l_moderator', lang), `<@${actor.id}>`],
        [M.T('l_duration', lang), `${M.formatDuration(ms, lang)} · <t:${end}:R>`],
        [M.T('l_reason', lang), M.safe(reason)],
        [M.T('l_dm', lang), M.T(sent ? 'dm_yes' : 'dm_no', lang)],
    ];
    const make = () => M.card({ look: 'mute', title: M.T('mute_done', lang), lines, avatar: M.avatarOf(member.user), footer: M.footerFor(caseId, lang), ctx });
    await M.toModLog(guild, client.db, make());
    console.log(`[MUTE] guild=${guild.id} by=${actor.id} user=${member.id} ms=${ms} case=${caseId}`);
    return { card: make() };
}

async function doUnmute(client, guild, actor, member, reason, lang, ctx) {
    if (!M.hasPerm(actor, PermissionFlagsBits.ModerateMembers)) return { error: M.T('no_perm', lang, { perm: 'Timeout Members' }) };
    if (!member) return { error: M.T('not_member', lang) };
    const until = member.communicationDisabledUntilTimestamp;
    if (!until || until <= Date.now()) return { error: M.T('not_muted', lang) };
    const code = M.checkTarget(guild, actor, member.id, member, 'mute');
    if (code) return { error: M.targetText(code, lang, guild, member, 'mute', ctx) };
    try {
        await member.timeout(null, M.auditReason(reason, actor));
    } catch (e) {
        return { error: require('../lib/botPerms').explainError(e, ctx, 'mute', lang) || M.T('above_bot', lang) };
    }
    const caseId = M.record(client.db, { guildId: guild.id, userId: member.id, moderatorId: actor.id, action: 'unmute', reason });
    const lines = [[M.T('l_member', lang), M.who(member.user)], [M.T('l_moderator', lang), `<@${actor.id}>`], [M.T('l_reason', lang), M.safe(reason)]];
    const make = () => M.card({ look: 'unmute', title: M.T('unmute_done', lang), lines, avatar: M.avatarOf(member.user), footer: M.footerFor(caseId, lang), ctx });
    await M.toModLog(guild, client.db, make());
    return { card: make() };
}

module.exports = {
    name: 'mute',
    aliases: ['silence', 'shut', 'timeout', 'unmute', 'unsilence', 'demute'],
    description: 'Time out a member, or lift a timeout',
    category: 'MODERATION',
    usage: '.mute @member 10m [reason] | .unmute @member',
    cooldown: 3000,
    userPermissions: ['ModerateMembers'],
    doMute,

    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Time out a member, or lift a timeout')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(s => s.setName('add').setDescription('Time out a member')
            .addUserOption(o => o.setName('target').setDescription('Member').setRequired(true))
            .addStringOption(o => o.setName('duration').setDescription('How long: 10m, 2h, 3d… (default 1 hour, at most 28 days)').setMaxLength(12))
            .addStringOption(o => o.setName('reason').setDescription('Why').setMaxLength(400)))
        .addSubcommand(s => s.setName('remove').setDescription('Lift a timeout')
            .addUserOption(o => o.setName('target').setDescription('Member').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Why').setMaxLength(400))),

    execute: async (interaction, client) => {
        const guild = interaction.guild;
        const lang = M.langFor(client, interaction);
        const actor = await guild.members.fetch(interaction.user.id).catch(() => null);
        const user = interaction.options.getUser('target');
        const member = await guild.members.fetch(user.id).catch(() => null);
        const reason = M.cleanReason(interaction.options.getString('reason'), lang);
        const r = interaction.options.getSubcommand() === 'remove'
            ? await doUnmute(client, guild, actor, member, reason, lang, interaction)
            : await doMute(client, guild, actor, member, M.parseDuration(interaction.options.getString('duration') || '1h'), reason, lang, interaction);
        if (r.error) return M.fail(interaction, r.error, lang);
        return M.respond(interaction, { components: [r.card] });
    },

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const guild = message.guild;
        if (!guild) return;
        const lang = M.langFor(client, message);
        const unmute = ['unmute', 'unsilence', 'demute'].includes(String(usedCommand || '').toLowerCase());
        const id = String(args[0] || '').replace(/[<@!>]/g, '');
        if (!M.SNOWFLAKE.test(id)) return message.reply({ content: M.T('usage_mute', lang), allowedMentions: { parse: [] } }).catch(() => {});
        const member = await guild.members.fetch(id).catch(() => null);
        let r;
        if (unmute) {
            r = await doUnmute(client, guild, message.member, member, M.cleanReason(args.slice(1).join(' '), lang), lang, message);
        } else {
            // ".mute @x 2h reason" or ".mute @x reason" (1 hour)
            const ms = M.parseDuration(args[1]);
            r = await doMute(client, guild, message.member, member, ms || 3600000, M.cleanReason(args.slice(ms ? 2 : 1).join(' '), lang), lang, message);
        }
        if (r.error) return M.fail(message, r.error, lang);
        return M.respond(message, { components: [r.card] });
    },
};
