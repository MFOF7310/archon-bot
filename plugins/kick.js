// /kick — remove a member from the server. Role order, clean reasons, case record and mod-log come from lib/mod-core.js.
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const M = require('../lib/mod-core');

async function doKick(client, guild, actor, member, reason, lang, ctx) {
    if (!M.hasPerm(actor, PermissionFlagsBits.KickMembers)) return { error: M.T('no_perm', lang, { perm: 'Kick Members' }) };
    if (!member) return { error: M.T('not_member', lang) };
    const code = M.checkTarget(guild, actor, member.id, member, 'kick');
    if (code) return { error: M.targetText(code, lang, guild, member, 'kick', ctx) };

    const caseId = M.record(client.db, { guildId: guild.id, userId: member.id, moderatorId: actor.id, action: 'kick', reason });
    // Sent first: once kicked, ARCHON may share no server with them
    const sent = await M.dm(member.user, M.card({ look: 'kick', title: M.T('kick_dm_title', lang, { server: M.safe(guild.name) }), lines: [[M.T('l_reason', lang), M.safe(reason)]], ctx }));
    try {
        await member.kick(M.auditReason(reason, actor));
    } catch (e) {
        console.error(`[KICK] guild=${guild.id} user=${member.id}:`, e.message);
        return { error: require('../lib/botPerms').explainError(e, ctx, 'kick', lang) || M.T('above_bot', lang) };
    }
    const lines = [
        [M.T('l_member', lang), M.who(member.user)],
        [M.T('l_moderator', lang), `<@${actor.id}>`],
        [M.T('l_reason', lang), M.safe(reason)],
        [M.T('l_dm', lang), M.T(sent ? 'dm_yes' : 'dm_no', lang)],
    ];
    const make = () => M.card({ look: 'kick', title: M.T('kick_done', lang), lines, avatar: M.avatarOf(member.user), footer: M.footerFor(caseId, lang), ctx });
    await M.toModLog(guild, client.db, make());
    console.log(`[KICK] guild=${guild.id} by=${actor.id} user=${member.id} case=${caseId}`);
    return { card: make() };
}

module.exports = {
    name: 'kick',
    aliases: ['expel', 'expulser', 'virer', 'k'],
    description: 'Remove a member from the server',
    category: 'MODERATION',
    cooldown: 5000,
    userPermissions: ['KickMembers'],
    usage: '.kick @member [reason]',

    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Remove a member from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(o => o.setName('target').setDescription('Member to remove').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Why (shown to them and in the audit log)').setMaxLength(400)),

    execute: async (interaction, client) => {
        const guild = interaction.guild;
        const lang = M.langFor(client, interaction);
        const actor = await guild.members.fetch(interaction.user.id).catch(() => null);
        const user = interaction.options.getUser('target');
        const member = await guild.members.fetch(user.id).catch(() => null);
        await interaction.deferReply();
        const r = await doKick(client, guild, actor, member, M.cleanReason(interaction.options.getString('reason'), lang), lang, interaction);
        if (r.error) {
            await interaction.deleteReply().catch(() => {});
            return interaction.followUp({ components: [M.card({ look: 'error', title: M.T('refused', lang), lines: [[null, r.error]], ctx: interaction })], flags: M.V2 | 64, allowedMentions: { parse: [] } });
        }
        return interaction.editReply({ components: [r.card], flags: M.V2, allowedMentions: { parse: [] } });
    },

    run: async (client, message, args) => {
        const guild = message.guild;
        if (!guild) return;
        const lang = M.langFor(client, message);
        const id = String(args[0] || '').replace(/[<@!>]/g, '');
        if (!M.SNOWFLAKE.test(id)) return message.reply({ content: M.T('usage_kick', lang), allowedMentions: { parse: [] } }).catch(() => {});
        const member = await guild.members.fetch(id).catch(() => null);
        const r = await doKick(client, guild, message.member, member, M.cleanReason(args.slice(1).join(' '), lang), lang, message);
        if (r.error) return M.fail(message, r.error, lang);
        return M.respond(message, { components: [r.card] });
    },
};
