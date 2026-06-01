const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '🛠️ WEAPON INTELLIGENCE CENTER',
        subtitle: 'Choose a weapon via quick buttons or the search menu.',
        searchPlaceholder: '🔍 Search for a weapon...',
        searchDescription: (key) => `View build for ${key}`,
        build: '🛠️ BUILD',
        intel: '📋 INTEL',
        close: 'Close',
        sessionEnded: '✅ Session ended.',
        focusIntel: (weapon) => `📍 **Intelligence Focus:** ${weapon}`,
        accessDenied: '❌ Only the author can interact.',
        selectWeapon: 'Select a weapon to view its optimized loadout.',
        back: '🔙 Back',
        footer: (guildName) => `${guildName} | Loadout Intelligence 🇲🇱`,
        stats: {
            range: 'Range', damage: 'Damage', mobility: 'Mobility',
            fireRate: 'Fire Rate', accuracy: 'Accuracy'
        }
    },
    fr: {
        title: '🛠️ CENTRE DE RENSEIGNEMENT DES ARMES',
        subtitle: 'Choisissez une arme via les boutons rapides ou le menu de recherche.',
        searchPlaceholder: '🔍 Rechercher une arme...',
        searchDescription: (key) => `Voir le build pour ${key}`,
        build: '🛠️ CONFIGURATION',
        intel: '📋 INTEL',
        close: 'Fermer',
        sessionEnded: '✅ Session terminée.',
        focusIntel: (weapon) => `📍 **Focus Intelligence:** ${weapon}`,
        accessDenied: '❌ Seul l\'auteur peut interagir.',
        selectWeapon: 'Sélectionnez une arme pour voir sa configuration optimisée.',
        back: '🔙 Retour',
        footer: (guildName) => `${guildName} | Renseignement Loadout 🇲🇱`,
        stats: {
            range: 'Portée', damage: 'Dégâts', mobility: 'Mobilité',
            fireRate: 'Cadence', accuracy: 'Précision'
        }
    }
};

// ================= WEAPON DATABASE (with stat bars) =================
const loadouts = {
    AK117: {
        emoji: '🔫', color: '#e74c3c',
        title: { en: 'AK117 — TACTICAL RELIABILITY', fr: 'AK117 — FIABILITÉ TACTIQUE' },
        build: 'OWC Marksman, No Stock, OWC Laser, 40 Rnd, Granulated Grip',
        desc: { en: 'Dominate mid-range with high fire rate. Reliable in all engagements.', fr: 'Dominez à moyenne portée avec une cadence de tir élevée.' },
        image: 'https://cdn.discordapp.com/attachments/1472176119540224010/1479909018368741711/Screenshot_20260307_114446_Call_of_Duty.jpg',
        stats: { range: 72, damage: 68, mobility: 65, fireRate: 78, accuracy: 70 },
        category: { en: 'ASSAULT RIFLE', fr: 'FUSIL D\'ASSAUT' }
    },
    FFAR1: {
        emoji: '🔥', color: '#e67e22',
        title: { en: 'FFAR 1 — CLOSE-QUARTERS SHREDDER', fr: 'FFAR 1 — DÉCHIQUETEUR RAPPROCHÉ' },
        build: 'Agency Suppressor, Task Force Barrel, Raider Stock, Speed Mag',
        desc: { en: 'High mobility and aggressive fire rate. Shreds at close range.', fr: 'Haute mobilité et cadence agressive. Déchiquete à courte portée.' },
        image: 'https://cdn.discordapp.com/attachments/1472176119540224010/1479909018725126286/Screenshot_20260307_114435_Call_of_Duty.jpg',
        stats: { range: 58, damage: 62, mobility: 82, fireRate: 88, accuracy: 60 },
        category: { en: 'ASSAULT RIFLE', fr: 'FUSIL D\'ASSAUT' }
    },
    DLQ: {
        emoji: '🎯', color: '#9b59b6',
        title: { en: 'DL Q33 — LEGENDARY PRECISION', fr: 'DL Q33 — PRÉCISION LÉGENDAIRE' },
        build: 'MIP Light Barrel, YMK Combat Stock, OWC Laser, Maevwat Omega-1',
        desc: { en: 'The gold standard for snipers. One-shot precision at any range.', fr: 'L\'étalon-or des snipers. Précision one-shot à toute portée.' },
        image: 'https://cdn.discordapp.com/attachments/1472176119540224010/1479909017387143430/Screenshot_20260307_114516_Call_of_Duty.jpg',
        stats: { range: 95, damage: 92, mobility: 35, fireRate: 25, accuracy: 90 },
        category: { en: 'SNIPER RIFLE', fr: 'FUSIL DE PRÉCISION' }
    },
    KRM: {
        emoji: '🛡️', color: '#27ae60',
        title: { en: 'KRM-262 — SLIDING ASSASSIN', fr: 'KRM-262 — ASSASSIN GLISSANT' },
        build: 'Marauder Suppressor, Extended Barrel, No Stock, OWC Laser',
        desc: { en: 'Perfect for hip-fire mobility. Devastating in close quarters.', fr: 'Parfait pour la mobilité en tir au jugé. Dévastateur au corps-à-corps.' },
        image: 'https://cdn.discordapp.com/attachments/1472176119540224010/1479913614772142111/Screenshot_20260307_184727_Call_of_Duty.jpg',
        stats: { range: 35, damage: 95, mobility: 70, fireRate: 30, accuracy: 55 },
        category: { en: 'SHOTGUN', fr: 'FUSIL À POMPE' }
    },
    TUNDRA: {
        emoji: '❄️', color: '#3498db',
        title: { en: 'LW3-TUNDRA — MODERN SNIPING', fr: 'LW3-TUNDRA — SNIPING MODERNE' },
        build: 'Tactical Suppressor, 26.5" Calvalry Lancer, FMJ, 7 Rnd, Serpent Wrap',
        desc: { en: 'Elite mobility for aggressive sniping. Fast ADS with lethal precision.', fr: 'Mobilité élite pour sniping agressif. ADS rapide avec précision létale.' },
        image: 'https://cdn.discordapp.com/attachments/1472176119540224010/1481256517700292722/Screenshot_20260311_114145_Call_of_Duty.jpg',
        stats: { range: 92, damage: 90, mobility: 45, fireRate: 30, accuracy: 88 },
        category: { en: 'SNIPER RIFLE', fr: 'FUSIL DE PRÉCISION' }
    },
    BP50: {
        emoji: '⚡', color: '#f1c40f',
        title: { en: 'BP50 — VELOCITY STRIKE', fr: 'BP50 — FRAPPE VÉLOCITÉ' },
        build: 'Leroy Custom Barrel, No Stock, Aim Assist Laser, 60 Round Mag, Stippled Grip',
        desc: { en: 'The fastest fire rate in the node. Melts enemies before they react.', fr: 'La cadence de tir la plus rapide du nœud. Fait fondre les ennemis avant qu\'ils ne réagissent.' },
        image: 'https://cdn.discordapp.com/attachments/1472176119540224010/1479913616877555882/Screenshot_20260307_184241_Call_of_Duty.jpg',
        stats: { range: 55, damage: 58, mobility: 85, fireRate: 95, accuracy: 62 },
        category: { en: 'ASSAULT RIFLE', fr: 'FUSIL D\'ASSAUT' }
    },
    KN44: {
        emoji: '⚔️', color: '#1abc9c',
        title: { en: 'KN-44 — VERSATILE ASSAULT', fr: 'KN-44 — ASSAUT POLYVALENT' },
        build: 'OWC Marksman, No Stock, OWC Laser, 38 Rnd, Granulated Grip',
        desc: { en: 'Performs best at mid-range. Balanced stats for any playstyle.', fr: 'Performances optimales à moyenne portée. Stats équilibrées pour tout style.' },
        image: 'https://cdn.discordapp.com/attachments/1472176119540224010/1481065011530043442/Screenshot_20260310_223955_Call_of_Duty.jpg',
        stats: { range: 68, damage: 72, mobility: 68, fireRate: 70, accuracy: 72 },
        category: { en: 'ASSAULT RIFLE', fr: 'FUSIL D\'ASSAUT' }
    },
    HS0405: {
        emoji: '💥', color: '#e74c3c',
        title: { en: 'HS0405 — ONE-TAP DOMINANCE', fr: 'HS0405 — DOMINATION EN UN COUP' },
        build: 'Choke, Extended Barrel, No Stock, OWC Laser',
        desc: { en: 'Extreme damage output. One-shot potential at surprising ranges.', fr: 'Dégâts extrêmes. Potentiel one-shot à des portées surprenantes.' },
        image: 'https://cdn.discordapp.com/attachments/1472176119540224010/1479913615225258075/Screenshot_20260307_184718_Call_of_Duty.jpg',
        stats: { range: 40, damage: 98, mobility: 55, fireRate: 20, accuracy: 50 },
        category: { en: 'SHOTGUN', fr: 'FUSIL À POMPE' }
    },
    RYTEC: {
        emoji: '🧨', color: '#e67e22',
        title: { en: 'RYTEC AMR — ANTI-MATERIAL RIFLE', fr: 'RYTEC AMR — FUSIL ANTI-MATÉRIEL' },
        build: 'MIP Light Barrel, OWC Skeleton Stock, OWC Laser, Explosive Mag, Stippled Grip',
        desc: { en: 'Heavy-duty firepower. Explosive rounds shred cover and vehicles.', fr: 'Puissance de feu lourde. Munitions explosives déchiquetent les abris et véhicules.' },
        image: 'https://cdn.discordapp.com/attachments/1472176119540224010/1481065012062585045/Screenshot_20260310_223824_Call_of_Duty.jpg',
        stats: { range: 88, damage: 94, mobility: 30, fireRate: 22, accuracy: 82 },
        category: { en: 'SNIPER RIFLE', fr: 'FUSIL DE PRÉCISION' }
    },
    HDR: {
        emoji: '🔭', color: '#34495e',
        title: { en: 'HDR — BOLT ACTION SNIPER', fr: 'HDR — SNIPER À VERROU' },
        build: 'Monolithic Suppressor, 26.9" HDR Pro, FTAC Stalker-Scout, 9 Round Mags',
        desc: { en: 'Excellent for long-distance combat. Maximum damage at extreme range.', fr: 'Excellent pour le combat à longue distance. Dégâts maximums à portée extrême.' },
        image: 'https://cdn.discordapp.com/attachments/1472176119540224010/1481065011232112813/Screenshot_20260310_224049_Call_of_Duty.jpg',
        stats: { range: 98, damage: 96, mobility: 25, fireRate: 18, accuracy: 94 },
        category: { en: 'SNIPER RIFLE', fr: 'FUSIL DE PRÉCISION' }
    },
    BY15: {
        emoji: '🛑', color: '#95a5a6',
        title: { en: 'BY15 — PRECISION SLUGGER', fr: 'BY15 — FRAPPEUR DE PRÉCISION' },
        build: 'Choke, Extended Barrel, No Stock, OWC Laser',
        desc: { en: 'Elite tactical range. Consistent damage with slug precision.', fr: 'Portée tactique élite. Dégâts constants avec précision de slug.' },
        image: 'https://raw.githubusercontent.com/MFOF7310/bot-assets-/main/IMG_20260307_011155_658.png',
        stats: { range: 38, damage: 88, mobility: 72, fireRate: 35, accuracy: 58 },
        category: { en: 'SHOTGUN', fr: 'FUSIL À POMPE' }
    }
};

// ================= STAT BAR BUILDER =================
function statBar(value, length = 10) {
    const filled = Math.round((value / 100) * length);
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, length - filled));
}

// ================= EMBED CREATOR (upgraded with stats) =================
function createEmbed(weaponKey, lang = 'en', guildName = 'Eagle Community') {
    const data = loadouts[weaponKey];
    const t = translations[lang];
    const s = data.stats;

    return new EmbedBuilder()
        .setColor(data.color)
        .setTitle(`${data.emoji} ${data.title[lang]}`)
        .setDescription(
            `**${data.category[lang]}**\n` +
            `> *${data.desc[lang]}*`
        )
        .addFields(
            {
                name: t.build,
                value: `\`\`\`fix\n${data.build}\n\`\`\``,
                inline: false
            },
            {
                name: '📊 STATS',
                value:
                    `${t.stats.range}:    \`${statBar(s.range)}\` ${s.range}\n` +
                    `${t.stats.damage}:   \`${statBar(s.damage)}\` ${s.damage}\n` +
                    `${t.stats.mobility}: \`${statBar(s.mobility)}\` ${s.mobility}\n` +
                    `${t.stats.fireRate}: \`${statBar(s.fireRate)}\` ${s.fireRate}\n` +
                    `${t.stats.accuracy}: \`${statBar(s.accuracy)}\` ${s.accuracy}`,
                inline: false
            }
        )
        .setFooter({ text: t.footer(guildName) })
        .setImage(data.image)
        .setTimestamp();
}

// ================= COMPONENT BUILDERS =================
function buildComponents(authorId, lang, includeBack = false) {
    const t = translations[lang];
    const keys = Object.keys(loadouts);

    // Search dropdown
    const searchRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`loadout_search_${authorId}`)
            .setPlaceholder(t.searchPlaceholder)
            .addOptions(keys.slice(0, 25).map(key => ({
                label: key,
                description: t.searchDescription(key).substring(0, 50),
                value: key,
                emoji: loadouts[key].emoji
            })))
    );

    // Row 1: Primary weapons
    const primaryRow = new ActionRowBuilder().addComponents(
        ['AK117', 'FFAR1', 'DLQ', 'KRM', 'BP50'].map(key =>
            new ButtonBuilder()
                .setCustomId(`loadout_${key}_${authorId}`)
                .setLabel(key)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(loadouts[key].emoji)
        )
    );

    // Row 2: Secondary weapons
    const secondaryRow = new ActionRowBuilder().addComponents(
        ['TUNDRA', 'KN44', 'HS0405', 'RYTEC', 'HDR'].map(key =>
            new ButtonBuilder()
                .setCustomId(`loadout_${key}_${authorId}`)
                .setLabel(key)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(loadouts[key].emoji)
        )
    );

    // Row 3: BY15 + optional back button + close
    const tertiaryButtons = [
        new ButtonBuilder()
            .setCustomId(`loadout_BY15_${authorId}`)
            .setLabel('BY15')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(loadouts.BY15.emoji)
    ];

    if (includeBack) {
        tertiaryButtons.push(
            new ButtonBuilder()
                .setCustomId(`loadout_back_${authorId}`)
                .setLabel(t.back)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔙')
        );
    }

    tertiaryButtons.push(
        new ButtonBuilder()
            .setCustomId(`loadout_close_${authorId}`)
            .setLabel(t.close)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
    );

    const tertiaryRow = new ActionRowBuilder().addComponents(tertiaryButtons);

    return [searchRow, primaryRow, secondaryRow, tertiaryRow];
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'loadout',
    aliases: ['loadouts', 'weapons', 'build', 'armes', 'configuration'],
    description: '🛠️ Interactive armory with weapon stats, search and quick-select buttons.',
    category: 'GAMING',
    cooldown: 3000,
    usage: '.loadout',
    examples: ['.loadout', '.armes', '.build'],

    data: new (require('discord.js').SlashCommandBuilder)()
        .setName('loadout')
        .setDescription('🛠️ Browse the weapon loadout armory')
        .setDescriptionLocalizations({ fr: '🛠️ Parcourir l\'arsenal de configurations d\'armes' }),

    // ================= SLASH COMMAND =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';

        // Build Collection-compatible fake message
        const fakeMessage = {
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            member: interaction.member,
            reply: async (options) => interaction.deferred || interaction.replied
                ? interaction.editReply(options)
                : interaction.reply(options),
            react: () => Promise.resolve()
        };

        // Add Collection-compatible mentions
        fakeMessage.mentions = {
            users: {
                first: () => interaction.options.getUser('agent') || interaction.user,
                get: () => interaction.options.getUser('agent') || interaction.user,
                has: () => !!interaction.options.getUser('agent'),
                size: interaction.options.getUser('agent') ? 1 : 0
            }
        };

        const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };

        // Defer first so reply() works
        await interaction.deferReply();
        await module.exports.run(client, fakeMessage, [], client.db, serverSettings, 'loadout');
    },

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, 'en') : 'en';
        const t = translations[lang];
        const authorId = message.author.id;
        const guildName = message.guild?.name || 'Neural Network';

        // Build components
        const components = buildComponents(authorId, lang);

        try {
            // Determine if this is a slash call (has deferred reply)
            const isSlash = !!message.guild && message.reply.toString().includes('editReply');

            const initialMsg = await message.reply({
                content: `**${t.title}**\n*${t.subtitle}*\n\n💡 ${t.selectWeapon}`,
                components
            });

            // Single collector — no componentType filter (handles buttons + select menus)
            const collector = initialMsg.createMessageComponentCollector({ time: 180000 });

            collector.on('collect', async (i) => {
                // Verify this interaction belongs to the command author
                if (!i.customId.endsWith(`_${authorId}`)) {
                    return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
                }

                // Handle close button
                if (i.customId.startsWith('loadout_close')) {
                    await i.update({ content: t.sessionEnded, embeds: [], components: [] }).catch(() => {});
                    collector.stop();
                    return;
                }

                // Handle back button — return to menu
                if (i.customId.startsWith('loadout_back')) {
                    await i.update({
                        content: `**${t.title}**\n*${t.subtitle}*\n\n💡 ${t.selectWeapon}`,
                        embeds: [],
                        components: buildComponents(authorId, lang)
                    }).catch(() => {});
                    return;
                }

                // Get selected weapon
                let selected;
                if (i.isStringSelectMenu()) {
                    selected = i.values[0];
                } else if (i.isButton()) {
                    selected = i.customId.split('_')[1];
                }

                if (!selected || !loadouts[selected]) return;

                // Show weapon embed with back button
                await i.update({
                    content: t.focusIntel(selected),
                    embeds: [createEmbed(selected, lang, guildName)],
                    components: buildComponents(authorId, lang, true)
                }).catch(() => {});
            });

            collector.on('end', async () => {
                // Disable all components
                const disabled = components.map(row =>
                    new ActionRowBuilder().addComponents(
                        row.components.map(c => {
                            if (c.data.type === 3) { // StringSelectMenu
                                return require('discord.js').StringSelectMenuBuilder.from(c).setDisabled(true);
                            }
                            return ButtonBuilder.from(c).setDisabled(true);
                        })
                    )
                );
                await initialMsg.edit({ components: disabled }).catch(() => {});
            });

        } catch (error) {
            console.error('[LOADOUT] Error:', error);
            message.reply('❌ An error occurred.').catch(() => {});
        }
    }
};