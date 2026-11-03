'use strict';
// /server: info, icon and banner in one slash command (V2 cards, texts in lang/<locale>/server.json).
// Replaces servericon.js and serverbanner.js. The old prefix names (.si, .icon, .sbanner…) still work.
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { t, slashLang, LANGS } = require('../lib/i18n');
const v2 = require('../lib/games/v2');
const ui = require('../lib/games/ui');
const E = require('../config/emojis');

// Prefix words for each subcommand
const SUB_ALIASES = {
    info: ['server', 'si', 'serveur', 'guild', 'sector', 'info', 'infos', 'serverinfo'],
    icon: ['servericon', 'icon', 'icone', 'serveuricon', 'guildicon'],
    banner: ['serverbanner', 'sbanner', 'banniereserveur', 'guildbanner'],
};
const BOOST_NEXT = { 0: 2, 1: 7, 2: 14 }; // boosts needed for the next level

const em = (k, fb = '') => E[k] || fb;
const tr = (lang) => (k, vars) => t('server.' + k, lang, vars || {});
const n = (x) => Number(x || 0).toLocaleString();

function linkBtn(label, url) {
    return new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url);
}

// ─── Info ───
function infoCard(client, lang, guild) {
    const _ = tr(lang);
    const icon = guild.iconURL({ size: 256 }) || client.user.displayAvatarURL({ size: 256 });
    const created = Math.floor(guild.createdTimestamp / 1000);
    const now = new Date(), born = new Date(guild.createdTimestamp);
    const years = now.getFullYear() - born.getFullYear();
    const birthday = years > 0 && now.getMonth() === born.getMonth() && now.getDate() === born.getDate();

    const ch = guild.channels.cache;
    const text = ch.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement || c.type === ChannelType.GuildForum).size;
    const voice = ch.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size;
    const cats = ch.filter(c => c.type === ChannelType.GuildCategory).size;
    const inVoice = guild.voiceStates?.cache.filter(v => v.channelId).size || 0;

    const boosts = guild.premiumSubscriptionCount || 0;
    const level = guild.premiumTier || 0;
    const next = BOOST_NEXT[level];
    const boostLine = next
        ? `\`${ui.progressBar(Math.min(boosts, next), next, 10)}\` ${_('boost_line', { boosts, next, level: level + 1 })}`
        : _('boost_max', { boosts });

    const items = [
        { thumbnail: [
            `## ${em('ic_info', 'ℹ️')} ${guild.name}\n${_('owner_line', { owner: `<@${guild.ownerId}>`, created: `<t:${created}:D>` })}`,
            icon,
        ] },
    ];
    if (birthday) items.push({ text: `${em('yellowcrown', '🎉')} ${_('birthday', { years })}` });
    items.push(
        { rule: true },
        { text: [
            `**${_('members')}** · ${n(guild.memberCount)}  ·  **${_('in_voice')}** · ${n(inVoice)}`,
            `**${_('channels')}** · ${_('channels_line', { text: n(text), voice: n(voice), cats: n(cats) })}`,
            `**${_('roles')}** · ${n(guild.roles.cache.size - 1)}  ·  **${_('emojis')}** · ${n(guild.emojis.cache.size)}  ·  **${_('stickers')}** · ${n(guild.stickers.cache.size)}`,
            `**${_('verification')}** · ${_('verif_' + (guild.verificationLevel || 0))}`,
        ].join('\n') },
        { rule: true },
        { text: `**${_('boosts')}**\n${boostLine}` },
    );

    const links = [];
    if (guild.iconURL()) links.push(linkBtn(_('btn_icon'), guild.iconURL({ size: 1024 })));
    if (guild.bannerURL()) links.push(linkBtn(_('btn_banner'), guild.bannerURL({ size: 1024 })));
    if (links.length) items.push({ row: new ActionRowBuilder().addComponents(...links) });
    items.push({ text: `-# ${_('id_line', { id: guild.id })} · ARCHON CG-223` });
    return v2.card(birthday ? 0xf1c40f : 0x5865f2, items);
}

// ─── Icon / banner: the picture itself, with download links ───
function imageCard(client, lang, guild, kind) {
    const _ = tr(lang);
    const get = kind === 'icon' ? (o) => guild.iconURL(o) : (o) => guild.bannerURL(o);
    if (!get()) return v2.card(0x95a5a6, [{ text: _(kind === 'icon' ? 'no_icon' : 'no_banner') }]);

    const animated = /\/a_/.test(get() || '');
    const formats = ['png', 'jpg', 'webp'].concat(animated ? ['gif'] : []);
    const card = v2.card(kind === 'icon' ? 0x2ecc71 : 0x9b59b6, [
        { text: `## ${_(kind === 'icon' ? 'icon_title' : 'banner_title', { name: guild.name })}` },
    ]);
    card.components[0].addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(get({ size: 1024, extension: animated ? 'gif' : 'png' })),
    ));
    card.components[0].addActionRowComponents(new ActionRowBuilder().addComponents(
        ...formats.map(f => linkBtn(f.toUpperCase(), get({ size: 4096, extension: f }))),
    ));
    return card;
}

function build(sub, client, lang, guild) {
    if (!guild) return v2.card(0x95a5a6, [{ text: tr(lang)('server_only') }]);
    if (sub === 'icon' || sub === 'banner') return imageCard(client, lang, guild, sub);
    return infoCard(client, lang, guild);
}

const data = new SlashCommandBuilder()
    .setName('server')
    .setDescription('Info about this server, its icon and its banner')
    .setDescriptionLocalizations({ fr: 'Infos sur ce serveur, son icône et sa bannière', 'zh-CN': '本服务器的信息、图标和横幅' })
    .addSubcommand(s => s.setName('info').setDescription('Members, channels, boosts and more')
        .setDescriptionLocalizations({ fr: 'Membres, salons, boosts et plus', 'zh-CN': '成员、频道、加成等' }))
    .addSubcommand(s => s.setName('icon').setDescription('Show the server icon in full size')
        .setDescriptionLocalizations({ fr: 'Affiche l’icône du serveur en grand', 'zh-CN': '显示服务器图标大图' }))
    .addSubcommand(s => s.setName('banner').setDescription('Show the server banner in full size')
        .setDescriptionLocalizations({ fr: 'Affiche la bannière du serveur en grand', 'zh-CN': '显示服务器横幅大图' }));

module.exports = {
    name: 'server',
    aliases: Object.values(SUB_ALIASES).flat().filter(a => a !== 'server'),
    description: 'Info about this server, its icon and its banner',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.server [info|icon|banner]',
    examples: ['.server', '.icon', '.sbanner'],
    data,

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const L = LANGS.includes(lang) ? lang : 'en';
        const used = String(usedCommand || '').toLowerCase();
        const first = String(args[0] || '').toLowerCase();
        const sub = (['icon', 'banner'].includes(first) && first)
            || Object.keys(SUB_ALIASES).find(k => SUB_ALIASES[k].includes(used))
            || 'info';
        return message.reply(build(sub, client, L, message.guild)).catch(e => console.error('[SERVER]', sub, e.message));
    },

    execute: async (interaction, client) => {
        const sub = interaction.options.getSubcommand(false) || 'info';
        const card = build(sub, client, slashLang(interaction), interaction.guild);
        if (!interaction.guild) card.flags |= 64;
        return interaction.reply(card).catch(e => console.error('[SERVER]', sub, e.message));
    },

    _internal: { SUB_ALIASES },
};
