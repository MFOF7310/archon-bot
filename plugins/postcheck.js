// ═══ ARCHON CG-223 — POSTCHECK ═══
// "Can I post in this channel, and what should I change if not?" The texts live in lang/<locale>/postcheck.json.
const { EmbedBuilder, SlashCommandBuilder, ChannelType } = require('discord.js');
const cp = require('../lib/canPost');
const i18n = require('../lib/i18n');

const T = (key, lang, vars) => i18n.t(`postcheck.${key}`, lang, vars);

function buildReply(d, target, me, lang) {
    const bot = me.roles.botRole?.name || me.displayName;
    const footer = { text: 'ARCHON CG-223 • BAMAKO_223 🇲🇱' };
    if (d.ok) {
        return { embeds: [new EmbedBuilder().setColor(0x2ecc71)
            .setTitle(T('okTitle', lang, { channel: target }))
            .setDescription(T('okDesc', lang))
            .setFooter(footer)] };
    }
    const vars = { channel: target, bot, perms: cp.localize(d.missing || [], lang).join(', '), role: d.role || T('someRole', lang) };
    const why = T(cp.keyFor('why', d.reason), lang, vars);   // whyPrivate / whyRoleBlock / whyMissingPerm
    const fix = T(cp.keyFor('fix', d.reason), lang, vars);   // fixPrivate / fixRoleBlock / fixMissingPerm
    return { embeds: [new EmbedBuilder().setColor(0xf1c40f)
        .setTitle(T('noTitle', lang, vars))
        .setDescription(`${why}\n\n${fix}`)
        .setFooter(footer)] };
}

module.exports = {
    name: 'postcheck',
    aliases: ['checkperms', 'canipost', 'accesscheck'],
    description: '🔍 Check whether I can post in a channel, and what to change if not',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.postcheck [#channel]',
    examples: ['.postcheck', '.postcheck #welcome', '.checkperms #staff'],

    data: new SlashCommandBuilder()
        .setName('postcheck')
        .setDescription('🔍 Check whether I can post in a channel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to check (default: this one)').setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const target = message.mentions.channels.first() || message.channel;
        const d = cp.diagnose(message.guild, target, message.guild.members.me);
        return message.reply(buildReply(d, target.toString(), message.guild.members.me, lang)).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = i18n.slashLang(interaction);
        const target = interaction.options.getChannel('channel') || interaction.channel;
        const d = cp.diagnose(interaction.guild, target, interaction.guild.members.me);
        return interaction.reply({ ...buildReply(d, target.toString(), interaction.guild.members.me, lang), flags: 64 });
    }
};
