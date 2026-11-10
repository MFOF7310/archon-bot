// /clear — delete recent messages in a channel, optionally only one member's.
// Fixes: the slash version always said "nothing deleted"; with a member picked it deleted fewer than asked;
// the bot's permission was checked server-wide instead of in the channel; the bot owner could purge any server.
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const M = require('../lib/mod-core');

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000 - 60 * 1000;
const CLEAR_LOG_THRESHOLD = 50; // Nombre minimum de messages pour envoyer un log dans le salon mod-log // a minute of margin: Discord refuses bulk delete past 14 days

async function purge(client, channel, actor, amount, targetUser, reason, lang, ctx, skipId) {
    const guild = channel.guild;
    if (!M.hasPerm(actor, PermissionFlagsBits.ManageMessages)) return { error: M.T('no_perm', lang, { perm: 'Manage Messages' }) };
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) return { error: M.T('clear_bad_amount', lang) };

    // Read up to 100 recent messages, then keep the ones that can go
    const fetched = await channel.messages.fetch({ limit: 100 });
    const cutoff = Date.now() - FOURTEEN_DAYS;
    const picked = [...fetched.values()]
        .filter((m) => m.id !== skipId && !m.pinned && m.createdTimestamp > cutoff && (!targetUser || m.author.id === targetUser.id))
        .slice(0, amount);
    if (!picked.length) return { error: M.T('clear_none', lang) };

    const deleted = await channel.bulkDelete(picked.map((m) => m.id), true);
    const count = deleted.size;
    const caseId = M.record(client.db, { guildId: guild.id, userId: targetUser?.id || channel.id, moderatorId: actor.id, action: 'purge', reason: `${count} messages in #${channel.name}: ${reason}` });
    const lines = [
        [M.T('l_channel', lang), `<#${channel.id}>`],
        targetUser ? [M.T('l_from', lang), M.who(targetUser)] : null,
        [M.T('l_moderator', lang), `<@${actor.id}>`],
        [M.T('l_reason', lang), M.safe(reason)],
    ];
    const make = () => M.card({ look: 'clear', title: M.T('clear_done', lang, { count }), lines, footer: M.footerFor(caseId, lang), ctx });
    
    // On envoie dans le salon mod-log seulement si on dépasse le seuil
    if (count >= CLEAR_LOG_THRESHOLD) {
        await M.toModLog(guild, client.db, make());
    }
    
    console.log(`[CLEAR] guild=${guild.id} channel=${channel.id} by=${actor.id} deleted=${count} (logged: ${count >= CLEAR_LOG_THRESHOLD})`);
    return { card: make(), count };
}

module.exports = {
    name: 'clear',
    aliases: ['purge', 'clean', 'nettoyer', 'effacer'],
    description: 'Delete recent messages in this channel',
    category: 'MODERATION',
    cooldown: 5000,
    userPermissions: ['ManageMessages'],
    usage: '.clear 20 [@member]',

    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Delete recent messages in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(o => o.setName('amount').setDescription('How many (1 to 100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption(o => o.setName('target').setDescription('Only this member\'s messages'))
        .addStringOption(o => o.setName('reason').setDescription('Why').setMaxLength(400)),

    execute: async (interaction, client) => {
        const lang = M.langFor(client, interaction);
        await interaction.deferReply({ flags: 64 });
        const actor = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        try {
            const r = await purge(client, interaction.channel, actor, interaction.options.getInteger('amount'), interaction.options.getUser('target'),
                M.cleanReason(interaction.options.getString('reason'), lang), lang, interaction, null);
            if (r.error) return interaction.editReply({ components: [M.card({ look: 'error', title: M.T('refused', lang), lines: [[null, r.error]], ctx: interaction })], flags: M.V2, allowedMentions: { parse: [] } });
            return interaction.editReply({ components: [r.card], flags: M.V2, allowedMentions: { parse: [] } });
        } catch (e) {
            console.error('[CLEAR]', e.message);
            const text = require('../lib/botPerms').explainError(e, interaction, 'clear', lang) || M.T('clear_none', lang);
            return interaction.editReply({ components: [M.card({ look: 'error', title: M.T('refused', lang), lines: [[null, text]], ctx: interaction })], flags: M.V2, allowedMentions: { parse: [] } });
        }
    },

    run: async (client, message, args) => {
        if (!message.guild) return;
        const lang = M.langFor(client, message);
        const mention = String(args.find((a) => /^<@!?\d+>$/.test(a)) || '').replace(/[<@!>]/g, '');
        const target = mention ? await client.users.fetch(mention).catch(() => null) : null;
        const num = args.find((a) => /^\d+$/.test(a));
        const amount = String(args[0] || '').toLowerCase() === 'all' ? 100 : Number(num);
        if (!amount) return message.reply({ content: M.T('usage_clear', lang), allowedMentions: { parse: [] } }).catch(() => {});
        try {
            const r = await purge(client, message.channel, message.member, amount, target, M.T('noReason', lang), lang, message, message.id);
            await message.delete().catch(() => {});
            const sent = await message.channel.send({ components: [r.error ? M.card({ look: 'error', title: M.T('refused', lang), lines: [[null, r.error]], ctx: message }) : r.card], flags: M.V2, allowedMentions: { parse: [] } }).catch(() => null);
            if (sent) setTimeout(() => Promise.resolve(sent.delete?.()).catch(() => {}), 6000);
        } catch (e) {
            console.error('[CLEAR]', e.message);
            const text = require('../lib/botPerms').explainError(e, message, 'clear', lang);
            if (text) message.reply({ content: text, allowedMentions: { parse: [] } }).catch(() => {});
        }
    },
};
