// /unban — lift a ban, picking the person by name: the user option suggests the server's banned members
// (name and ban reason), so nobody has to copy a user ID. The unban itself is ban.js's doUnban (same checks,
// same mod-log card). Prefix: .unban <user id> [reason] (also .pardon, .debannir).
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const M = require('../lib/mod-core');

const unban = (...a) => require('./ban.js')._doUnban(...a);
const idOf = (v) => String(v || '').replace(/[<@!>]/g, '').trim();

module.exports = {
    name: 'unban',
    aliases: ['pardon', 'debannir'],
    description: 'Lift a ban (pick the person by name)',
    category: 'MODERATION',
    usage: '.unban <user id> [reason]',
    cooldown: 3000,
    userPermissions: ['BanMembers'],

    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Lift a ban')
        .setDescriptionLocalizations({ fr: 'Lever un bannissement' })
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(o => o.setName('user').setDescription('Type a name: the banned members are suggested').setRequired(true).setAutocomplete(true)
            .setDescriptionLocalizations({ fr: 'Tape un nom : les membres bannis sont proposés' }))
        .addStringOption(o => o.setName('reason').setDescription('Why').setMaxLength(400)
            .setDescriptionLocalizations({ fr: 'Pourquoi' })),

    // The banned members whose name, display name or ID matches what is typed (25 at most, Discord's limit)
    autocomplete: async (interaction) => {
        const typed = String(interaction.options.getFocused() || '').toLowerCase().trim();
        const bans = await interaction.guild?.bans?.fetch().catch(() => null);
        if (!bans) return interaction.respond([]).catch(() => {});
        const list = [...bans.values()]
            .filter((b) => !typed || [b.user.username, b.user.globalName, b.user.id].some((x) => String(x || '').toLowerCase().includes(typed)))
            .slice(0, 25)
            .map((b) => ({ name: `${b.user.globalName || b.user.username}${b.reason ? ` · ${b.reason}` : ''}`.slice(0, 100), value: b.user.id }));
        return interaction.respond(list).catch(() => {});
    },

    execute: async (interaction, client) => {
        const guild = interaction.guild;
        const lang = M.langFor(client, interaction);
        const actor = await guild.members.fetch(interaction.user.id).catch(() => null);
        const id = idOf(interaction.options.getString('user'));
        if (!M.SNOWFLAKE.test(id)) return M.fail(interaction, M.T('not_banned', lang), lang);
        await interaction.deferReply();
        const r = await unban(client, guild, actor, id, M.cleanReason(interaction.options.getString('reason'), lang), lang, interaction);
        if (r.error) return interaction.editReply({ content: r.error, allowedMentions: { parse: [] } });
        return interaction.editReply({ components: [r.card], flags: M.V2, allowedMentions: { parse: [] } });
    },

    run: async (client, message, args) => {
        const guild = message.guild;
        if (!guild) return;
        const lang = M.langFor(client, message);
        const id = idOf(args[0]);
        if (!M.SNOWFLAKE.test(id)) return message.reply({ content: M.T('usage_unban', lang), allowedMentions: { parse: [] } }).catch(() => {});
        const r = await unban(client, guild, message.member, id, M.cleanReason(args.slice(1).join(' '), lang), lang, message);
        if (r.error) return M.fail(message, r.error, lang);
        return M.respond(message, { components: [r.card] });
    },
};
