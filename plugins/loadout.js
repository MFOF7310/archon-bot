const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const fs = require('fs');

const LOADOUT_IMG_DIR = path.join(__dirname, '../assets/loadouts');
if (!fs.existsSync(LOADOUT_IMG_DIR)) fs.mkdirSync(LOADOUT_IMG_DIR, { recursive: true });

// ================= TRANSLATIONS =================
const translations = {
    en: {
        title: '🛠️ WEAPON INTELLIGENCE CENTER',
        subtitle: 'Select a category to browse weapons.',
        searchPlaceholder: '🔍 Quick search...',
        build: '🛠️ BUILD',
        close: 'Close',
        sessionEnded: '✅ Session ended.',
        focusIntel: (weapon) => `📍 **Intelligence Focus:** ${weapon}`,
        accessDenied: '❌ Only the author can interact.',
        selectCategory: 'Pick a weapon category to get started.',
        back: '🔙 Categories',
        backWeapons: '🔙 Weapons',
        footer: (guildName) => `${guildName} | Loadout Intelligence 🇲🇱`,
        noImage: (weapon) => `📸 No screenshot set for **${weapon}** on this server.\nAdmin: \`.setloadout ${weapon}\` + attach image.`,
        stats: { range: 'Range', damage: 'Damage', mobility: 'Mobility', fireRate: 'Fire Rate', accuracy: 'Accuracy' },
        categories: { ar: '🔫 Assault Rifles', sniper: '🎯 Snipers', shotgun: '💥 Shotguns' }
    },
    fr: {
        title: '🛠️ CENTRE DE RENSEIGNEMENT DES ARMES',
        subtitle: 'Sélectionnez une catégorie pour parcourir les armes.',
        searchPlaceholder: '🔍 Recherche rapide...',
        build: '🛠️ CONFIGURATION',
        close: 'Fermer',
        sessionEnded: '✅ Session terminée.',
        focusIntel: (weapon) => `📍 **Focus Intelligence:** ${weapon}`,
        accessDenied: '❌ Seul l\'auteur peut interagir.',
        selectCategory: 'Choisissez une catégorie pour commencer.',
        back: '🔙 Catégories',
        backWeapons: '🔙 Armes',
        footer: (guildName) => `${guildName} | Renseignement Loadout 🇲🇱`,
        noImage: (weapon) => `📸 Pas d\'image pour **${weapon}** sur ce serveur.\nAdmin: \`.setloadout ${weapon}\` + joindre une image.`,
        stats: { range: 'Portée', damage: 'Dégâts', mobility: 'Mobilité', fireRate: 'Cadence', accuracy: 'Précision' },
        categories: { ar: '🔫 Fusils d\'Assaut', sniper: '🎯 Snipers', shotgun: '💥 Fusils à Pompe' }
    }
};

// ================= WEAPON DATABASE =================
const loadouts = {
    AK117:  { emoji: '🔫', color: '#e74c3c', cat: 'ar',      title: { en: 'AK117 — TACTICAL RELIABILITY',       fr: 'AK117 — FIABILITÉ TACTIQUE'          }, build: 'OWC Marksman, No Stock, OWC Laser, 40 Rnd, Granulated Grip',                              desc: { en: 'Dominate mid-range with high fire rate.',          fr: 'Dominez à moyenne portée avec une cadence élevée.'     }, stats: { range: 72, damage: 68, mobility: 65, fireRate: 78, accuracy: 70 }, category: { en: 'ASSAULT RIFLE',   fr: 'FUSIL D\'ASSAUT'    } },
    FFAR1:  { emoji: '🔥', color: '#e67e22', cat: 'ar',      title: { en: 'FFAR 1 — CLOSE-QUARTERS SHREDDER',   fr: 'FFAR 1 — DÉCHIQUETEUR RAPPROCHÉ'     }, build: 'Agency Suppressor, Task Force Barrel, Raider Stock, Speed Mag',                           desc: { en: 'High mobility and aggressive fire rate.',          fr: 'Haute mobilité et cadence agressive.'                  }, stats: { range: 58, damage: 62, mobility: 82, fireRate: 88, accuracy: 60 }, category: { en: 'ASSAULT RIFLE',   fr: 'FUSIL D\'ASSAUT'    } },
    BP50:   { emoji: '⚡', color: '#f1c40f', cat: 'ar',      title: { en: 'BP50 — VELOCITY STRIKE',              fr: 'BP50 — FRAPPE VÉLOCITÉ'              }, build: 'Leroy Custom Barrel, No Stock, Aim Assist Laser, 60 Round Mag, Stippled Grip',            desc: { en: 'Fastest fire rate. Melts enemies before they react.', fr: 'Cadence la plus rapide. Fond les ennemis.'            }, stats: { range: 55, damage: 58, mobility: 85, fireRate: 95, accuracy: 62 }, category: { en: 'ASSAULT RIFLE',   fr: 'FUSIL D\'ASSAUT'    } },
    KN44:   { emoji: '⚔️', color: '#1abc9c', cat: 'ar',     title: { en: 'KN-44 — VERSATILE ASSAULT',           fr: 'KN-44 — ASSAUT POLYVALENT'           }, build: 'OWC Marksman, No Stock, OWC Laser, 38 Rnd, Granulated Grip',                              desc: { en: 'Balanced stats for any playstyle.',                fr: 'Stats équilibrées pour tout style de jeu.'             }, stats: { range: 68, damage: 72, mobility: 68, fireRate: 70, accuracy: 72 }, category: { en: 'ASSAULT RIFLE',   fr: 'FUSIL D\'ASSAUT'    } },
    DLQ:    { emoji: '🎯', color: '#9b59b6', cat: 'sniper',  title: { en: 'DL Q33 — LEGENDARY PRECISION',        fr: 'DL Q33 — PRÉCISION LÉGENDAIRE'       }, build: 'MIP Light Barrel, YMK Combat Stock, OWC Laser, Maevwat Omega-1',                          desc: { en: 'Gold standard for snipers. One-shot at any range.', fr: 'L\'étalon-or des snipers. One-shot à toute portée.' }, stats: { range: 95, damage: 92, mobility: 35, fireRate: 25, accuracy: 90 }, category: { en: 'SNIPER RIFLE',    fr: 'FUSIL DE PRÉCISION'   } },
    TUNDRA: { emoji: '❄️', color: '#3498db', cat: 'sniper',  title: { en: 'LW3-TUNDRA — MODERN SNIPING',         fr: 'LW3-TUNDRA — SNIPING MODERNE'        }, build: 'Tactical Suppressor, 26.5" Calvalry Lancer, FMJ, 7 Rnd, Serpent Wrap',                   desc: { en: 'Elite mobility for aggressive sniping.',           fr: 'Mobilité élite pour sniping agressif.'                 }, stats: { range: 92, damage: 90, mobility: 45, fireRate: 30, accuracy: 88 }, category: { en: 'SNIPER RIFLE',    fr: 'FUSIL DE PRÉCISION'   } },
    RYTEC:  { emoji: '🧨', color: '#e67e22', cat: 'sniper',  title: { en: 'RYTEC AMR — ANTI-MATERIAL RIFLE',     fr: 'RYTEC AMR — FUSIL ANTI-MATÉRIEL'     }, build: 'MIP Light Barrel, OWC Skeleton Stock, OWC Laser, Explosive Mag, Stippled Grip',           desc: { en: 'Explosive rounds shred cover and vehicles.',       fr: 'Munitions explosives déchiquetent abris et véhicules.' }, stats: { range: 88, damage: 94, mobility: 30, fireRate: 22, accuracy: 82 }, category: { en: 'SNIPER RIFLE',    fr: 'FUSIL DE PRÉCISION'   } },
    HDR:    { emoji: '🔭', color: '#34495e', cat: 'sniper',  title: { en: 'HDR — BOLT ACTION SNIPER',             fr: 'HDR — SNIPER À VERROU'               }, build: 'Monolithic Suppressor, 26.9" HDR Pro, FTAC Stalker-Scout, 9 Round Mags',                  desc: { en: 'Maximum damage at extreme range.',                 fr: 'Dégâts maximums à portée extrême.'                     }, stats: { range: 98, damage: 96, mobility: 25, fireRate: 18, accuracy: 94 }, category: { en: 'SNIPER RIFLE',    fr: 'FUSIL DE PRÉCISION'   } },
    KRM:    { emoji: '🛡️', color: '#27ae60', cat: 'shotgun', title: { en: 'KRM-262 — SLIDING ASSASSIN',          fr: 'KRM-262 — ASSASSIN GLISSANT'         }, build: 'Marauder Suppressor, Extended Barrel, No Stock, OWC Laser',                               desc: { en: 'Devastating in close quarters.',                   fr: 'Dévastateur au corps-à-corps.'                         }, stats: { range: 35, damage: 95, mobility: 70, fireRate: 30, accuracy: 55 }, category: { en: 'SHOTGUN',         fr: 'FUSIL À POMPE'        } },
    HS0405: { emoji: '💥', color: '#e74c3c', cat: 'shotgun', title: { en: 'HS0405 — ONE-TAP DOMINANCE',           fr: 'HS0405 — DOMINATION EN UN COUP'      }, build: 'Choke, Extended Barrel, No Stock, OWC Laser',                                             desc: { en: 'One-shot potential at surprising ranges.',         fr: 'Potentiel one-shot à des portées surprenantes.'        }, stats: { range: 40, damage: 98, mobility: 55, fireRate: 20, accuracy: 50 }, category: { en: 'SHOTGUN',         fr: 'FUSIL À POMPE'        } },
    BY15:   { emoji: '🛑', color: '#95a5a6', cat: 'shotgun', title: { en: 'BY15 — PRECISION SLUGGER',             fr: 'BY15 — FRAPPEUR DE PRÉCISION'        }, build: 'Choke, Extended Barrel, No Stock, OWC Laser',                                             desc: { en: 'Consistent damage with slug precision.',           fr: 'Dégâts constants avec précision de slug.'              }, stats: { range: 38, damage: 88, mobility: 72, fireRate: 35, accuracy: 58 }, category: { en: 'SHOTGUN',         fr: 'FUSIL À POMPE'        } },
};

const CATEGORIES = { ar: 'ar', sniper: 'sniper', shotgun: 'shotgun' };
const WEAPON_KEYS = Object.keys(loadouts);

// ================= HELPERS =================
function statBar(value, length = 12) {
    const filled = Math.round((value / 100) * length);
    return '▰'.repeat(Math.max(0, filled)) + '▱'.repeat(Math.max(0, length - filled));
}

function getWeaponImage(db, guildId, weaponKey) {
    try {
        const row = db.prepare('SELECT image_path FROM loadout_images WHERE guild_id = ? AND weapon_key = ?').get(guildId, weaponKey);
        if (row && fs.existsSync(row.image_path)) return row.image_path;
    } catch(e) {}
    return null;
}

async function downloadToFile(url, dest) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*,*/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    return dest;
}

// ================= EMBED BUILDERS =================
function buildHomeEmbed(lang, guildName) {
    const t = translations[lang];
    const arList  = WEAPON_KEYS.filter(k => loadouts[k].cat === 'ar').map(k => `${loadouts[k].emoji} **${k}**`).join('  ');
    const snList  = WEAPON_KEYS.filter(k => loadouts[k].cat === 'sniper').map(k => `${loadouts[k].emoji} **${k}**`).join('  ');
    const shList  = WEAPON_KEYS.filter(k => loadouts[k].cat === 'shotgun').map(k => `${loadouts[k].emoji} **${k}**`).join('  ');

    return new EmbedBuilder()
        .setColor(0x00f0ff)
        .setTitle(t.title)
        .setDescription(
            `*${t.selectCategory}*

` +
            `**${t.categories.ar}**
${arList}

` +
            `**${t.categories.sniper}**
${snList}

` +
            `**${t.categories.shotgun}**
${shList}`
        )
        .setFooter({ text: t.footer(guildName) })
        .setTimestamp();
}

function buildCategoryEmbed(cat, lang, guildName) {
    const t = translations[lang];
    const weapons = WEAPON_KEYS.filter(k => loadouts[k].cat === cat);
    const catLabel = t.categories[cat];
    const lines = weapons.map(k => {
        const d = loadouts[k];
        return `${d.emoji} **${k}** — *${d.desc[lang]}*`;
    }).join('\n');

    return new EmbedBuilder()
        .setColor(0x00f0ff)
        .setTitle(`${catLabel}`)
        .setDescription(lines)
        .setFooter({ text: t.footer(guildName) })
        .setTimestamp();
}

function buildWeaponEmbed(weaponKey, lang, guildName, imagePath) {
    const data = loadouts[weaponKey];
    const t = translations[lang];
    const s = data.stats;

    const embed = new EmbedBuilder()
        .setColor(data.color)
        .setTitle(`${data.emoji} ${data.title[lang]}`)
        .setDescription(`**${data.category[lang]}**
> *${data.desc[lang]}*`)
        .addFields(
            { name: t.build, value: `\`\`\`
${data.build}
\`\`\``, inline: false },
            {
                name: '📊 STATS',
                value: [
                    `\`${t.stats.range.padEnd(9)}\` ${statBar(s.range)} **${s.range}**`,
                    `\`${t.stats.damage.padEnd(9)}\` ${statBar(s.damage)} **${s.damage}**`,
                    `\`${t.stats.mobility.padEnd(9)}\` ${statBar(s.mobility)} **${s.mobility}**`,
                    `\`${t.stats.fireRate.padEnd(9)}\` ${statBar(s.fireRate)} **${s.fireRate}**`,
                    `\`${t.stats.accuracy.padEnd(9)}\` ${statBar(s.accuracy)} **${s.accuracy}**`,
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: t.footer(guildName) })
        .setTimestamp();

    if (imagePath) embed.setImage('attachment://weapon.jpg');
    return embed;
}

// ================= COMPONENT BUILDERS =================
function buildHomeRows(authorId, lang) {
    const t = translations[lang];
    // Row 1: Category buttons
    const catRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`loadout_cat_ar_${authorId}`).setLabel(t.categories.ar).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`loadout_cat_sniper_${authorId}`).setLabel(t.categories.sniper).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`loadout_cat_shotgun_${authorId}`).setLabel(t.categories.shotgun).setStyle(ButtonStyle.Primary),
    );
    // Row 2: Quick search
    const searchRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`loadout_search_${authorId}`)
            .setPlaceholder(t.searchPlaceholder)
            .addOptions(WEAPON_KEYS.map(key => ({
                label: key, value: key, emoji: loadouts[key].emoji,
                description: loadouts[key].desc[lang].substring(0, 50)
            })))
    );
    // Row 3: Close
    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`loadout_close_${authorId}`).setLabel(t.close).setStyle(ButtonStyle.Danger).setEmoji('❌')
    );
    return [catRow, searchRow, closeRow];
}

function buildCategoryRows(cat, authorId, lang) {
    const t = translations[lang];
    const weapons = WEAPON_KEYS.filter(k => loadouts[k].cat === cat);
    // Row 1: Weapon buttons (max 5, all fit in one row per category)
    const weaponRow = new ActionRowBuilder().addComponents(
        weapons.map(key => new ButtonBuilder()
            .setCustomId(`loadout_weapon_${key}_${authorId}`)
            .setLabel(key)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(loadouts[key].emoji)
        )
    );
    // Row 2: Back + Close
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`loadout_home_${authorId}`).setLabel(t.back).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`loadout_close_${authorId}`).setLabel(t.close).setStyle(ButtonStyle.Danger).setEmoji('❌')
    );
    return [weaponRow, navRow];
}

function buildWeaponRows(cat, authorId, lang) {
    const t = translations[lang];
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`loadout_cat_${cat}_${authorId}`).setLabel(t.backWeapons).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`loadout_home_${authorId}`).setLabel(t.back).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`loadout_close_${authorId}`).setLabel(t.close).setStyle(ButtonStyle.Danger).setEmoji('❌')
    );
    return [navRow];
}

// ================= MODULE =================
module.exports = {
    name: 'loadout',
    aliases: ['loadouts', 'weapons', 'build', 'armes', 'configuration'],
    description: '🛠️ Interactive armory — category tabs, weapon stats, per-server images.',
    category: 'GAMING',
    cooldown: 3000,
    usage: '.loadout',

    data: new (require('discord.js').SlashCommandBuilder)()
        .setName('loadout')
        .setDescription('🛠️ Browse the weapon loadout armory'),

    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        await interaction.deferReply();
        const fakeMessage = {
            author: interaction.user, guild: interaction.guild,
            channel: interaction.channel, member: interaction.member,
            reply: async (opts) => interaction.deferred ? interaction.editReply(opts) : interaction.reply(opts),
            react: () => Promise.resolve()
        };
        await module.exports.run(client, fakeMessage, [], client.db, {}, 'loadout', lang);
    },

    run: async (client, message, args, db, serverSettings, usedCommand, lang = 'en') => {
        const t = translations[lang] || translations.en;
        const authorId = message.author.id;
        const guildId = message.guild?.id || 'DM';
        const guildName = message.guild?.name || 'Neural Network';

        try {
            const homeRows = buildHomeRows(authorId, lang);
            const initialMsg = await message.reply({
                embeds: [buildHomeEmbed(lang, guildName)],
                components: homeRows
            });

            const collector = initialMsg.createMessageComponentCollector({ time: 180000 });
            let currentCat = null;

            collector.on('collect', async (i) => {
                if (!i.customId.endsWith(`_${authorId}`)) {
                    return i.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
                }

                // Close
                if (i.customId.startsWith('loadout_close')) {
                    await i.update({ content: t.sessionEnded, embeds: [], components: [], files: [] }).catch(() => {});
                    collector.stop();
                    return;
                }

                // Home
                if (i.customId.startsWith('loadout_home')) {
                    currentCat = null;
                    await i.update({
                        embeds: [buildHomeEmbed(lang, guildName)],
                        components: buildHomeRows(authorId, lang),
                        files: []
                    }).catch(() => {});
                    return;
                }

                // Category select
                const catMatch = i.customId.match(/^loadout_cat_(\w+)_/);
                if (catMatch) {
                    currentCat = catMatch[1];
                    await i.update({
                        embeds: [buildCategoryEmbed(currentCat, lang, guildName)],
                        components: buildCategoryRows(currentCat, authorId, lang),
                        files: []
                    }).catch(() => {});
                    return;
                }

                // Weapon select (button)
                const weaponMatch = i.customId.match(/^loadout_weapon_(\w+)_/);
                let selected = weaponMatch ? weaponMatch[1] : null;

                // Quick search (select menu)
                if (!selected && i.isStringSelectMenu() && i.customId.startsWith('loadout_search')) {
                    selected = i.values[0];
                    currentCat = loadouts[selected]?.cat || currentCat;
                }

                if (!selected || !loadouts[selected]) return;

                const imagePath = getWeaponImage(db, guildId, selected);
                const embed = buildWeaponEmbed(selected, lang, guildName, imagePath);
                const files = imagePath ? [{ attachment: imagePath, name: 'weapon.jpg' }] : [];

                let content = t.focusIntel(selected);
                if (!imagePath) content += `\n\n${t.noImage(selected)}`;

                await i.update({
                    content,
                    embeds: [embed],
                    components: buildWeaponRows(currentCat || loadouts[selected].cat, authorId, lang),
                    files
                }).catch(() => {});
            });

            collector.on('end', async () => {
                try {
                    await initialMsg.edit({ components: [] }).catch(() => {});
                } catch(e) {}
            });

        } catch(err) {
            console.error('[LOADOUT]', err);
            message.reply('❌ Something went wrong loading the armory.').catch(() => {});
        }
    }
};
