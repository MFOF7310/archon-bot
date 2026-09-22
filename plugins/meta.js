const { EmbedBuilder, SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const W = require('../lib/weapons');
const EMOJIS = require('../config/emojis');

const TIER_LABEL = {
    GOD: '🏆 GOD TIER',
    S:   '🔥 S TIER',
    A:   '⚔️ A TIER',
    B:   '🛡️ B TIER',
    C:   '📦 C TIER',
};

function metaEmbed(guild, filterCat) {
    const { season, updated } = W.getSeason();
    const groups = W.byTier();

    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setAuthor({ name: `${guild?.name || 'ARCHON'} • Meta`, iconURL: guild?.iconURL() || undefined })
        .setTitle(`${EMOJIS.gamer} CODM Weapon Meta — ${season}`);

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
            ? `No weapons listed under **${filterCat}** yet.`
            : 'No weapons in the meta list yet.');
    }

    embed.setFooter({ text: `Updated ${updated || 'unknown'} • /weapon <name> for full specs` });
    return embed;
}

function weaponEmbed(w, guild) {
    const s = w.stats || {};
    const bar = v => `\`${W.statBar(v)}\` ${String(v).padStart(3)}`;

    const embed = new EmbedBuilder()
        .setColor(W.tierColor(w.tier))
        .setAuthor({ name: `${guild?.name || 'ARCHON'} • Armory`, iconURL: guild?.iconURL() || undefined })
        .setTitle(`${w.name}`)
        .setDescription(
            `**${TIER_LABEL[w.tier] || w.tier}** · ${w.category || 'Unclassified'}\n\n` +
            (w.intel?.en || w.intel || '')
        );

    if (Object.keys(s).length) {
        embed.addFields({
            name: '📊 Stats',
            value:
                `Fire rate  ${bar(s.fireRate ?? 0)}\n` +
                `Damage     ${bar(s.damage ?? 0)}\n` +
                `Accuracy   ${bar(s.accuracy ?? 0)}\n` +
                `Range      ${bar(s.range ?? 0)}\n` +
                `Control    ${bar(s.control ?? 0)}\n` +
                `Mobility   ${bar(s.mobility ?? 0)}`,
            inline: false,
        });
    }

    if (w.specs) {
        embed.addFields({
            name: '🛠️ Recommended loadout',
            value: w.specs.split(',').map(x => `• ${x.trim()}`).join('\n'),
            inline: false,
        });
    }

    if (w.image && w.image.startsWith('http')) embed.setImage(w.image);

    const { season } = W.getSeason();
    embed.setFooter({ text: `${season} meta • ARCHON CG-223` }).setTimestamp();
    return embed;
}

module.exports = {
    name: 'meta',
    aliases: ['tier', 'tierlist', 'weapon', 'gun', 'randommeta', 'codm', 'pick', 'arme'],
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

    rerollRow() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('meta_reroll')
                .setLabel('Re-roll')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎲')
        );
    },

    randomPick(guild) {
        const list = W.getWeapons();
        if (!list.length) return null;
        return weaponEmbed(list[Math.floor(Math.random() * list.length)], guild);
    },

    execute: async (interaction) => {
        const sub = interaction.options.getSubcommand();

        if (sub === 'random') {
            const embed = module.exports.randomPick(interaction.guild);
            if (!embed) return interaction.reply({ content: 'No weapons in the meta list yet.', flags: MessageFlags.Ephemeral });
            return interaction.reply({ embeds: [embed], components: [module.exports.rerollRow()] });
        }


        if (sub === 'list') {
            const cat = interaction.options.getString('category');
            return interaction.reply({ embeds: [metaEmbed(interaction.guild, cat)] });
        }

        if (sub === 'weapon') {
            const q = interaction.options.getString('name');
            const w = W.findWeapon(q);
            if (!w) {
                const names = W.getWeapons().map(x => x.name).join(', ');
                return interaction.reply({
                    content: `No weapon matching **${q}**.\nAvailable: ${names || 'none yet'}`,
                    flags: MessageFlags.Ephemeral,
                });
            }
            return interaction.reply({ embeds: [weaponEmbed(w, interaction.guild)] });
        }
    },

    // Prefix: .meta | .meta sniper | .weapon ak117
    run: async (client, message, args, db, ss, used) => {
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
                return message.reply(`No weapon matching **${arg}**.\nAvailable: ${names || 'none yet'}`).catch(() => {});
            }
            return message.reply({ embeds: [weaponEmbed(w, message.guild)] }).catch(() => {});
        }

        // .randommeta / .pick / .codm / .arme -> random pick with reroll
        if (['randommeta', 'pick', 'codm', 'arme'].includes(cmd)) {
            const embed = module.exports.randomPick(message.guild);
            if (!embed) return message.reply('No weapons in the meta list yet.').catch(() => {});
            return message.reply({ embeds: [embed], components: [module.exports.rerollRow()] }).catch(() => {});
        }

        // .meta with an argument: category filter, or a weapon name if it matches one
        if (arg) {
            const cat = W.categories().find(c => c.toLowerCase().includes(arg.toLowerCase()));
            if (cat) {
                return message.reply({ embeds: [metaEmbed(message.guild, cat)] }).catch(() => {});
            }
            const w = W.findWeapon(arg);
            if (w) {
                return message.reply({ embeds: [weaponEmbed(w, message.guild)] }).catch(() => {});
            }
        }

        return message.reply({ embeds: [metaEmbed(message.guild, null)] }).catch(() => {});
    },
};

