const { EmbedBuilder, SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const W = require('../lib/weapons');
const i18n = require('../lib/i18n');
const EMOJIS = require('../config/emojis');

const TIER_LABEL = {
    GOD: '🏆 GOD TIER',
    S:   '🔥 S TIER',
    A:   '⚔️ A TIER',
    B:   '🛡️ B TIER',
    C:   '📦 C TIER',
};

function metaEmbed(guild, filterCat, lang = 'en') {
    const tr = (k, v) => i18n.t(`meta.${k}`, lang, v);
    const { season, updated } = W.getSeason();
    const groups = W.byTier();

    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setAuthor({ name: `${guild?.name || 'ARCHON'} • Meta`, iconURL: guild?.iconURL() || undefined })
        .setTitle(`${EMOJIS.gamer} ${tr('metaTitle', { season })}`);

    let any = false;
    for (const [tier, list] of groups) {
        const filtered = filterCat
            ? list.filter(w => (w.category || '').toLowerCase() === filterCat.toLowerCase())
            : list;
        if (!filtered.length) continue;
        any = true;
        embed.addFields({
            name: TIER_LABEL[tier] || tier,
            value: filtered.map(w => `**${w.name}** · ${w.category || '—'}`).join('\n'),
            inline: false,
        });
    }

    if (!any) {
        embed.setDescription(filterCat
            ? tr('emptyCategory', { cat: filterCat })
            : tr('emptyList'));
    }

    embed.setFooter({ text: tr('metaFooter', { updated: updated || tr('unknown') }) });
    return embed;
}

function weaponEmbed(w, guild, lang = 'en') {
    const tr = (k, v) => i18n.t(`meta.${k}`, lang, v);
    const STAT_KEYS = ['statFireRate', 'statDamage', 'statAccuracy', 'statRange', 'statControl', 'statMobility'];
    const pad = Math.max(...STAT_KEYS.map(k => tr(k).length)) + 2;
    const lbl = k => tr(k).padEnd(pad);
    const s = w.stats || {};
    const bar = v => `\`${W.statBar(v)}\` ${String(v).padStart(3)}`;

    const embed = new EmbedBuilder()
        .setColor(W.tierColor(w.tier))
        .setAuthor({ name: `${guild?.name || 'ARCHON'} • ${tr('armory')}`, iconURL: guild?.iconURL() || undefined })
        .setTitle(`${w.name}`)
        .setDescription(
            `**${TIER_LABEL[w.tier] || w.tier}** · ${w.category || tr('unclassified')}\n\n` +
            (w.intel?.[lang] || w.intel?.en || (typeof w.intel === 'string' ? w.intel : ''))
        );

    if (Object.keys(s).length) {
        embed.addFields({
            name: tr('statsTitle'),
            value:
                `${lbl('statFireRate')}${bar(s.fireRate ?? 0)}\n` +
                `${lbl('statDamage')}${bar(s.damage ?? 0)}\n` +
                `${lbl('statAccuracy')}${bar(s.accuracy ?? 0)}\n` +
                `${lbl('statRange')}${bar(s.range ?? 0)}\n` +
                `${lbl('statControl')}${bar(s.control ?? 0)}\n` +
                `${lbl('statMobility')}${bar(s.mobility ?? 0)}`,
            inline: false,
        });
    }

    if (w.specs) {
        embed.addFields({
            name: tr('loadoutTitle'),
            value: w.specs.split(',').map(x => `• ${x.trim()}`).join('\n'),
            inline: false,
        });
    }

    if (w.image && w.image.startsWith('http')) embed.setImage(w.image);

    const { season } = W.getSeason();
    embed.setFooter({ text: tr('weaponFooter', { season }) }).setTimestamp();
    return embed;
}

module.exports = {
    name: 'meta',
    aliases: ['tier', 'tierlist', 'weapon', 'gun', 'randommeta', 'codm', 'pick', 'arme', 'loadout', 'loadouts', 'weapons', 'armes'],
    description: 'CODM weapon meta tier list and detailed weapon specs.',
    category: 'GAMING',
    usage: '/meta [category] | /weapon <name>',
    cooldown: 3000,

    data: new SlashCommandBuilder().setName('meta').setDescription('🎯 CODM weapon meta').
        addSubcommand(s => s.setName('list').setDescription('Show the current weapon tier list').
            addStringOption(o => o.setName('category').setDescription('Filter by weapon class').setAutocomplete(true))).
        addSubcommand(s => s.setName('random').setDescription('Random weapon pick from the meta')).
        addSubcommand(s => s.setName('weapon').setDescription('Full specs for one weapon').
            addStringOption(o => o.setName('name').setDescription('Weapon name').setRequired(true).setAutocomplete(true))),

    autocomplete: async (interaction) => {
        const focused = interaction.options.getFocused(true);
        const typed = (focused.value || '').toLowerCase();

        if (focused.name === 'category') {
            const cats = W.categories().filter(c => c.toLowerCase().includes(typed));
            return interaction.respond(
                cats.slice(0, 25).map(c => ({ name: c, value: c }))
            ).catch(() => {});
        }

        if (focused.name === 'name') {
            const hits = W.searchWeapons(typed, 25);
            return interaction.respond(
                hits.map(w => ({ name: `${w.name}${w.tier ? ` [${w.tier}]` : ''} · ${w.category || '—'}`, value: w.name }))
            ).catch(() => {});
        }

        return interaction.respond([]).catch(() => {});
    },

    rerollRow(lang = 'en') {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('meta_reroll')
                .setLabel(i18n.t('meta.reroll', lang))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎲')
        );
    },

    randomPick(guild, lang = 'en') {
        const list = W.getWeapons();
        if (!list.length) return null;
        return weaponEmbed(list[Math.floor(Math.random() * list.length)], guild, lang);
    },

    execute: async (interaction) => {
        const lang = interaction.client.detectLanguage ? interaction.client.detectLanguage('meta', interaction.guildId) : 'en';
        const tr = (k, v) => i18n.t(`meta.${k}`, lang, v);
        const sub = interaction.options.getSubcommand();

        if (sub === 'random') {
            const embed = module.exports.randomPick(interaction.guild, lang);
            if (!embed) return interaction.reply({ content: tr('emptyList'), flags: MessageFlags.Ephemeral });
            return interaction.reply({ embeds: [embed], components: [module.exports.rerollRow(lang)] });
        }


        if (sub === 'list') {
            const cat = interaction.options.getString('category');
            return interaction.reply({ embeds: [metaEmbed(interaction.guild, cat, lang)] });
        }

        if (sub === 'weapon') {
            const q = interaction.options.getString('name');
            const w = W.findWeapon(q);
            if (!w) {
                const names = W.getWeapons().map(x => x.name).join(', ');
                return interaction.reply({
                    content: tr('noMatch', { q, names: names || tr('noneYet') }),
                    flags: MessageFlags.Ephemeral,
                });
            }
            return interaction.reply({ embeds: [weaponEmbed(w, interaction.guild, lang)] });
        }
    },

    // Prefix: .meta | .meta sniper | .weapon ak117
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used || 'meta', message.guild?.id) : 'en';
        const tr = (k, v) => i18n.t(`meta.${k}`, lang, v);
        const cmd = (used || '').toLowerCase();
        const arg = args.join(' ').trim();

        // .weapon / .gun always look up one weapon
        if (cmd === 'weapon' || cmd === 'gun') {
            if (!arg) {
                return message.reply('Usage: `.weapon <name>` — for example `.weapon ak117`').catch(() => {});
            }
            const w = W.findWeapon(arg);
            if (!w) {
                const names = W.getWeapons().map(x => x.name).join(', ');
                return message.reply(tr('noMatch', { q: arg, names: names || tr('noneYet') })).catch(() => {});
            }
            return message.reply({ embeds: [weaponEmbed(w, message.guild, lang)] }).catch(() => {});
        }

        // .randommeta / .pick / .codm / .arme -> random pick with reroll
        if (['randommeta', 'pick', 'codm', 'arme'].includes(cmd)) {
            const embed = module.exports.randomPick(message.guild, lang);
            if (!embed) return message.reply(tr('emptyList')).catch(() => {});
            return message.reply({ embeds: [embed], components: [module.exports.rerollRow(lang)] }).catch(() => {});
        }

        // .meta with an argument: category filter, or a weapon name if it matches one
        if (arg) {
            const cat = W.categories().find(c => c.toLowerCase().includes(arg.toLowerCase()));
            if (cat) {
                return message.reply({ embeds: [metaEmbed(message.guild, cat, lang)] }).catch(() => {});
            }
            const w = W.findWeapon(arg);
            if (w) {
                return message.reply({ embeds: [weaponEmbed(w, message.guild, lang)] }).catch(() => {});
            }
        }

        return message.reply({ embeds: [metaEmbed(message.guild, null, lang)] }).catch(() => {});
    },
};

