// /slowmode — how often members can post in a channel. The slash command was never registered before
// (the builder was missing), so /slowmode did not exist; the bot owner could also change any server's channels.
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const M = require('../lib/mod-core');

const MAX = 21600; // Discord's limit: 6 hours

function parseSlow(input) {
    const s = String(input || '').trim().toLowerCase();
    if (['off', '0', 'none', 'non', 'stop', 'désactiver', 'desactiver'].includes(s)) return 0;
    if (/^\d+$/.test(s)) return Number(s); // plain number = seconds
    const ms = M.parseDuration(s);
    return ms ? Math.round(ms / 1000) : null;
}

async function setSlow(client, channel, actor, input, lang, ctx) {
    const guild = channel.guild;
    if (!M.hasPerm(actor, PermissionFlagsBits.ManageChannels)) return { error: M.T('no_perm', lang, { perm: 'Manage Channels' }) };
    const seconds = parseSlow(input);
    if (seconds === null || seconds < 0 || seconds > MAX) return { error: M.T('slow_bad', lang) };
    const d = require('../lib/canPost').diagnose(guild, channel, guild.members.me, [['Manage Channels', PermissionFlagsBits.ManageChannels]]);
    if (!d.ok) return { error: require('../lib/botPerms').guard({ guild, channel, client }, 'slowmode', lang)?.text || M.T('above_bot', lang) };

    const before = channel.rateLimitPerUser || 0;
    if (!seconds && !before) return { card: M.card({ look: 'slowmode', title: M.T('slow_off', lang), lines: [[M.T('l_channel', lang), `<#${channel.id}>`], [null, M.T('slow_was_off', lang)]], ctx }) };
    await channel.setRateLimitPerUser(seconds, M.auditReason('slowmode', actor));
    const time = seconds ? M.formatDuration(seconds * 1000, lang) : null;
    const caseId = M.record(client.db, { guildId: guild.id, userId: channel.id, moderatorId: actor.id, action: 'slowmode', reason: seconds ? `${seconds}s in #${channel.name}` : `off in #${channel.name}` });
    const make = () => M.card({
        look: 'slowmode',
        title: seconds ? M.T('slow_on', lang, { time }) : M.T('slow_off', lang),
        lines: [[M.T('l_channel', lang), `<#${channel.id}>`], [M.T('l_moderator', lang), `<@${actor.id}>`]],
        footer: M.footerFor(caseId, lang), ctx,
    });
    await M.toModLog(guild, client.db, make());
    return { card: make() };
}

module.exports = {
    name: 'slowmode',
    aliases: ['sm', 'lent', 'ralenti'],
    description: 'Set how often members can post in a channel',
    category: 'MODERATION',
    cooldown: 3000,
    userPermissions: ['ManageChannels'],
    usage: '.slowmode 10s | .slowmode off',

    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set how often members can post in a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(o => o.setName('duration').setDescription('5s, 30s, 2m, 1h (up to 6 hours), or off').setRequired(true).setMaxLength(12)
            .setAutocomplete(true))
        .addChannelOption(o => o.setName('channel').setDescription('Which channel (this one if empty)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildForum, ChannelType.PublicThread, ChannelType.PrivateThread)),

    // Suggestions while typing: the common values, and what the typed text would mean
    autocomplete: async (interaction) => {
        const typed = String(interaction.options.getFocused() || '').trim();
        const base = ['off', '5s', '10s', '30s', '1m', '5m', '15m', '1h', '6h'];
        const sec = parseSlow(typed);
        const list = (sec !== null && sec <= MAX && typed && !base.includes(typed.toLowerCase()) ? [typed] : []).concat(base.filter((b) => !typed || b.startsWith(typed.toLowerCase())));
        return interaction.respond(list.slice(0, 25).map((v) => ({ name: v, value: v }))).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = M.langFor(client, interaction);
        const actor = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        try {
            const r = await setSlow(client, channel, actor, interaction.options.getString('duration'), lang, interaction);
            if (r.error) return M.fail(interaction, r.error, lang);
            return M.respond(interaction, { components: [r.card] }, { ephemeral: true });
        } catch (e) {
            console.error('[SLOWMODE]', e.message);
            return M.fail(interaction, require('../lib/botPerms').explainError(e, interaction, 'slowmode', lang) || M.T('slow_bad', lang), lang);
        }
    },

    run: async (client, message, args) => {
        if (!message.guild) return;
        const lang = M.langFor(client, message);
        if (!args[0]) return message.reply({ content: M.T('usage_slowmode', lang), allowedMentions: { parse: [] } }).catch(() => {});
        try {
            const r = await setSlow(client, message.channel, message.member, args[0], lang, message);
            if (r.error) return M.fail(message, r.error, lang);
            const sent = await M.respond(message, { components: [r.card] });
            if (sent) setTimeout(() => { Promise.resolve(sent.delete?.()).catch(() => {}); Promise.resolve(message.delete?.()).catch(() => {}); }, 8000);
        } catch (e) {
            console.error('[SLOWMODE]', e.message);
            const text = require('../lib/botPerms').explainError(e, message, 'slowmode', lang);
            if (text) message.reply({ content: text, allowedMentions: { parse: [] } }).catch(() => {});
        }
    },
};
