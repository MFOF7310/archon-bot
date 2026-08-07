const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const fs = require('fs');

const LOADOUT_IMG_DIR = path.join(__dirname, '../assets/loadouts');
if (!fs.existsSync(LOADOUT_IMG_DIR)) fs.mkdirSync(LOADOUT_IMG_DIR, { recursive: true });

const translations = {
    en: {
        title: '🔫 WEAPON ARMORY',
        selectCategory: 'Select a category to browse weapons.',
        close: 'Close', sessionEnded: '✅ Session ended.',
        accessDenied: '❌ Only the author can interact.',
        back: '◀️ Categories', backWeapons: '◀️ Weapons',
        footer: (g) => `${g} · Weapon Armory 🇲🇱`,
        noImage: (w) => `📸 No screenshot uploaded for **${w}** yet.
Admin → \`.setloadout ${w}\` + attach image.`,
        categories: { ar: '🔫 Assault Rifles', sniper: '🎯 Snipers', shotgun: '💥 Shotguns' },
        searchPlaceholder: '🔍 Quick search weapon...',
        focusIntel: (w) => `📍 ${w}`,
    },
    fr: {
        title: '🔫 ARSENAL DES ARMES',
        selectCategory: 'Sélectionnez une catégorie.',
        close: 'Fermer', sessionEnded: '✅ Session terminée.',
        accessDenied: "❌ Seul l'auteur peut interagir.",
        back: '\u25c4\ufe0f Cat\u00e9gories', backWeapons: '\u25c4\ufe0f Armes',
        footer: (g) => `${g} · Arsenal 🇲🇱`,
        noImage: (w) => `📸 Pas d'image pour **${w}** sur ce serveur.
Admin → \`.setloadout ${w}\` + joindre une image.`,
        categories: { ar: "🔫 Fusils d'Assaut", sniper: "🎯 Snipers", shotgun: "💥 Fusils à Pompe" },
        searchPlaceholder: '🔍 Rechercher une arme...',
        focusIntel: (w) => `📍 ${w}`,
    }
};

const loadouts = {
    AK117:  { emoji: '🔫', color: '#e74c3c', cat: 'ar',      name: { en: 'AK117',         fr: 'AK117'         }, subtitle: { en: 'Assault Rifle · Mid Range',          fr: "Fusil d'Assaut · Moyenne Portée"   } },
    FFAR1:  { emoji: '🔥', color: '#e67e22', cat: 'ar',      name: { en: 'FFAR 1',        fr: 'FFAR 1'        }, subtitle: { en: 'Assault Rifle · Close Range',         fr: "Fusil d'Assaut · Courte Portée"    } },
    BP50:   { emoji: '⚡', color: '#f1c40f', cat: 'ar',      name: { en: 'BP50',          fr: 'BP50'          }, subtitle: { en: 'Assault Rifle · Aggressive',          fr: "Fusil d'Assaut · Agressif"         } },
    KN44:   { emoji: '⚔️', color: '#1abc9c', cat: 'ar',     name: { en: 'KN-44',         fr: 'KN-44'         }, subtitle: { en: 'Assault Rifle · Versatile',           fr: "Fusil d'Assaut · Polyvalent"       } },
    DLQ:    { emoji: '🎯', color: '#9b59b6', cat: 'sniper',  name: { en: 'DL Q33',        fr: 'DL Q33'        }, subtitle: { en: 'Sniper Rifle · One Shot',             fr: "Fusil de Précision · Un Coup"       } },
    TUNDRA: { emoji: '❄️', color: '#3498db', cat: 'sniper',  name: { en: 'LW3 Tundra',    fr: 'LW3 Tundra'    }, subtitle: { en: 'Sniper Rifle · Fast ADS',             fr: "Fusil de Précision · ADS Rapide"    } },
    RYTEC:  { emoji: '🧨', color: '#e67e22', cat: 'sniper',  name: { en: 'Rytec AMR',     fr: 'Rytec AMR'     }, subtitle: { en: 'Sniper Rifle · Anti-Material',        fr: "Fusil de Précision · Anti-Matériel" } },
    HDR:    { emoji: '🔭', color: '#34495e', cat: 'sniper',  name: { en: 'HDR',           fr: 'HDR'           }, subtitle: { en: 'Sniper Rifle · Long Range',           fr: "Fusil de Précision · Longue Portée" } },
    KRM:    { emoji: '🛡️', color: '#27ae60', cat: 'shotgun', name: { en: 'KRM-262',       fr: 'KRM-262'       }, subtitle: { en: 'Shotgun · Hip Fire King',             fr: "Fusil à Pompe · Roi du Tir au Jugé" } },
    HS0405: { emoji: '💥', color: '#e74c3c', cat: 'shotgun', name: { en: 'HS0405',        fr: 'HS0405'        }, subtitle: { en: 'Shotgun · One Tap Dominant',          fr: "Fusil à Pompe · Domination"         } },
    BY15:   { emoji: '🛑', color: '#95a5a6', cat: 'shotgun', name: { en: 'BY15',          fr: 'BY15'          }, subtitle: { en: 'Shotgun · Slug Precision',            fr: "Fusil à Pompe · Précision Slug"     } },
};

const WEAPON_KEYS = Object.keys(loadouts);

function getWeaponImage(db, guildId, weaponKey) {
    try {
        const row = db.prepare('SELECT image_path FROM loadout_images WHERE guild_id = ? AND weapon_key = ?').get(guildId, weaponKey);
        if (row && fs.existsSync(row.image_path)) return row.image_path;
    } catch(e) {}
    return null;
}

function buildHomeEmbed(lang, guildName) {
    const t = translations[lang];
    const cats = [
        { key: 'ar',      weapons: WEAPON_KEYS.filter(k => loadouts[k].cat === 'ar')      },
        { key: 'sniper',  weapons: WEAPON_KEYS.filter(k => loadouts[k].cat === 'sniper')  },
        { key: 'shotgun', weapons: WEAPON_KEYS.filter(k => loadouts[k].cat === 'shotgun') },
    ];
    const desc = cats.map(c =>
        `**${t.categories[c.key]}**
${c.weapons.map(k => `${loadouts[k].emoji} ${loadouts[k].name[lang]}`).join('  ·  ')}`
    ).join('\n\n');

    return new EmbedBuilder()
        .setColor(0x00f0ff)
        .setTitle(t.title)
        .setDescription(`*${t.selectCategory}*\n\n${desc}`)
        .setFooter({ text: t.footer(guildName) })
        .setTimestamp();
}

function buildCategoryEmbed(cat, lang, guildName) {
    const t = translations[lang];
    const weapons = WEAPON_KEYS.filter(k => loadouts[k].cat === cat);
    return new EmbedBuilder()
        .setColor(0x00f0ff)
        .setTitle(t.categories[cat])
        .setDescription(weapons.map(k => `${loadouts[k].emoji} **${loadouts[k].name[lang]}** · *${loadouts[k].subtitle[lang]}*`).join('\n'))
        .setFooter({ text: t.footer(guildName) })
        .setTimestamp();
}

function buildWeaponEmbed(weaponKey, lang, guildName, imagePath) {
    const data = loadouts[weaponKey];
    const t = translations[lang];
    const embed = new EmbedBuilder()
        .setColor(data.color)
        .setAuthor({ name: t.categories[data.cat] })
        .setTitle(`${data.emoji}  ${data.name[lang]}`)
        .setDescription(`*${data.subtitle[lang]}*`)
        .setFooter({ text: t.footer(guildName) })
        .setTimestamp();
    if (imagePath) embed.setImage('attachment://weapon.jpg');
    return embed;
}

function buildHomeRows(authorId, lang) {
    const t = translations[lang];
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lo_cat_ar_${authorId}`).setLabel(t.categories.ar).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`lo_cat_sniper_${authorId}`).setLabel(t.categories.sniper).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`lo_cat_shotgun_${authorId}`).setLabel(t.categories.shotgun).setStyle(ButtonStyle.Primary),
        ),
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`lo_search_${authorId}`)
                .setPlaceholder(t.searchPlaceholder)
                .addOptions(WEAPON_KEYS.map(k => ({ label: loadouts[k].name[lang], value: k, emoji: loadouts[k].emoji, description: loadouts[k].subtitle[lang].substring(0,50) })))
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lo_close_${authorId}`).setLabel(t.close).setStyle(ButtonStyle.Danger).setEmoji('❌')
        ),
    ];
}

function buildCategoryRows(cat, authorId, lang) {
    const t = translations[lang];
    const weapons = WEAPON_KEYS.filter(k => loadouts[k].cat === cat);
    return [
        new ActionRowBuilder().addComponents(
            weapons.map(k => new ButtonBuilder()
                .setCustomId(`lo_weapon_${k}_${authorId}`)
                .setLabel(loadouts[k].name[lang])
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(loadouts[k].emoji)
            )
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lo_home_${authorId}`).setLabel(t.back).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`lo_close_${authorId}`).setLabel(t.close).setStyle(ButtonStyle.Danger).setEmoji('❌')
        ),
    ];
}

function buildWeaponRows(cat, authorId, lang) {
    const t = translations[lang];
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lo_cat_${cat}_${authorId}`).setLabel(t.backWeapons).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`lo_home_${authorId}`).setLabel(t.back).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`lo_close_${authorId}`).setLabel(t.close).setStyle(ButtonStyle.Danger).setEmoji('❌')
        ),
    ];
}

module.exports = {
    name: 'loadout',
    aliases: ['loadouts', 'weapons', 'build', 'armes', 'armory', 'arsenal', 'configuration'],
    description: '🔫 Interactive weapon armory — browse by category with screenshots.',
    category: 'GAMING',
    cooldown: 3000,
    usage: '.loadout',

    data: new (require('discord.js').SlashCommandBuilder)()
        .setName('loadout')
        .setDescription('🔫 Browse the weapon armory'),

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
            const initialMsg = await message.reply({
                embeds: [buildHomeEmbed(lang, guildName)],
                components: buildHomeRows(authorId, lang)
            });

            const collector = initialMsg.createMessageComponentCollector({ time: 180000 });
            let currentCat = null;

            collector.on('collect', async (i) => {
                if (!i.customId.endsWith(`_${authorId}`)) {
                    return i.reply({ content: t.accessDenied, flags: 64 }).catch(() => {});
                }

                if (i.customId.startsWith('lo_close')) {
                    await i.update({ content: t.sessionEnded, embeds: [], components: [], files: [] }).catch(() => {});
                    collector.stop();
                    return;
                }

                if (i.customId.startsWith('lo_home')) {
                    currentCat = null;
                    await i.update({ embeds: [buildHomeEmbed(lang, guildName)], components: buildHomeRows(authorId, lang), files: [], content: null }).catch(() => {});
                    return;
                }

                const catMatch = i.customId.match(/^lo_cat_(\w+)_/);
                if (catMatch) {
                    currentCat = catMatch[1];
                    await i.update({ embeds: [buildCategoryEmbed(currentCat, lang, guildName)], components: buildCategoryRows(currentCat, authorId, lang), files: [], content: null }).catch(() => {});
                    return;
                }

                const weaponMatch = i.customId.match(/^lo_weapon_(\w+)_/);
                let selected = weaponMatch ? weaponMatch[1] : null;
                if (!selected && i.isStringSelectMenu()) {
                    selected = i.values[0];
                    currentCat = loadouts[selected]?.cat || currentCat;
                }
                if (!selected || !loadouts[selected]) return;

                const imagePath = getWeaponImage(db, guildId, selected);
                const embed = buildWeaponEmbed(selected, lang, guildName, imagePath);
                const files = imagePath ? [{ attachment: imagePath, name: 'weapon.jpg' }] : [];
                const content = !imagePath ? t.noImage(selected) : null;

                await i.update({
                    content,
                    embeds: [embed],
                    components: buildWeaponRows(currentCat || loadouts[selected].cat, authorId, lang),
                    files
                }).catch(() => {});
            });

            collector.on('end', async () => {
                await initialMsg.edit({ components: [] }).catch(() => {});
            });

        } catch(err) {
            console.error('[LOADOUT]', err);
            message.reply('❌ Something went wrong loading the armory.').catch(() => {});
        }
    }
};
