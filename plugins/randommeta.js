/**
 * ◈ ARCHITECT CG-223 | RANDOM META MODULE ◈
 * DEPLOYMENT PROCEDURE:
 * 1. Ensure 'discord.js' v14 is installed.
 * 2. Replace 'YOUR_IMAGE_URL' with direct links to weapon screenshots.
 * 3. This module focuses on "Intel" to avoid giving conflicting loadout advice.
 * 4. Use '.randommeta' to cycle through the current global combat meta.
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: 'ARCHITECT META INTELLIGENCE',
        scanning: '> **🔍 Scanning global combat trends... Signal acquired.**',
        updated: '> **🔄 Meta-grid updated. New armament recommendation displayed.**',
        tier: 'TIER',
        intel: 'INTEL',
        reroll: 'RE-ROLL DATA',
        accessDenied: '⛔ **ACCESS DENIED:** This terminal is locked to the original agent.',
        footer: 'EAGLE COMMUNITY • BKO-223 NODE',
        godTier: 'GOD',
        sTier: 'S',
        aTier: 'A',
        bTier: 'B',
        weaponSelected: 'ARMAMENT SELECTED'
    },
    fr: {
        author: 'ARCHITECT INTELLIGENCE MÉTA',
        scanning: '> **🔍 Analyse des tendances de combat mondiales... Signal acquis.**',
        updated: '> **🔄 Grille méta mise à jour. Nouvelle recommandation affichée.**',
        tier: 'NIVEAU',
        intel: 'INTEL',
        reroll: 'ACTUALISER',
        accessDenied: '⛔ **ACCÈS REFUSÉ:** Ce terminal est verrouillé à l\'agent d\'origine.',
        footer: 'EAGLE COMMUNITY • NŒUD BKO-223',
        godTier: 'DIEU',
        sTier: 'S',
        aTier: 'A',
        bTier: 'B',
        weaponSelected: 'ARME SÉLECTIONNÉE'
    }
};

// ================= TACTICAL ARMORY DATA =================
const metaData = [
    { 
        name: "AK117", tier: "S", 
        intel: { 
            en: "The undisputed king of versatility. High fire rate and aggressive TTK.", 
            fr: "Le roi incontesté de la polyvalence. Cadence élevée et TTK agressif." 
        },
        image: "YOUR_IMAGE_URL" 
    },
    { 
        name: "DL Q33", tier: "S", 
        intel: { 
            en: "The sniper's standard. Unmatched consistency and wall-penetration.", 
            fr: "Le standard du sniper. Constance et pénétration inégalées." 
        },
        image: "YOUR_IMAGE_URL" 
    },
    { 
        name: "BP50", tier: "GOD", 
        intel: { 
            en: "Current peak performance. Fire rate exceeds standard human reaction times.", 
            fr: "Performance maximale actuelle. Cadence dépasse les temps de réaction humains standards." 
        },
        image: "YOUR_IMAGE_URL" 
    },
    { 
        name: "SKS", tier: "GOD", 
        intel: { 
            en: "The marksman's choice. Lethal two-tap potential at any range for disciplined players.", 
            fr: "Le choix du tireur d'élite. Potentiel mortel en deux balles à toute portée pour les joueurs disciplinés." 
        },
        image: "YOUR_IMAGE_URL" 
    },
    { 
        name: "LW3-TUNDRA", tier: "S", 
        intel: { 
            en: "Elite bolt-action mobility. Best-in-class ADS speed for aggressive snipers.", 
            fr: "Mobilité élite à verrou. Meilleure vitesse ADS de sa catégorie pour les snipers agressifs." 
        },
        image: "YOUR_IMAGE_URL" 
    },
    { 
        name: "RYTEC AMR", tier: "A", 
        intel: { 
            en: "Anti-material power. Ideal for disrupting enemy scorestreaks and vehicles.", 
            fr: "Puissance anti-matériel. Idéal pour perturber les séries d'éliminations et véhicules ennemis." 
        },
        image: "YOUR_IMAGE_URL" 
    },
    { 
        name: "KN-44", tier: "S", 
        intel: { 
            en: "Heavy hitter with a lethal three-tap potential if accuracy is maintained.", 
            fr: "Frappe lourde avec un potentiel mortel en trois balles si la précision est maintenue." 
        },
        image: "YOUR_IMAGE_URL" 
    }
];

// ================= EMBED GENERATOR =================
function generateEmbed(weapon, lang = 'en') {
    const t = translations[lang];
    const tierColor = weapon.tier === 'GOD' ? '#ff0055' : (weapon.tier === 'S' ? '#00fbff' : (weapon.tier === 'A' ? '#f1c40f' : '#95a5a6'));
    const tierName = weapon.tier === 'GOD' ? t.godTier : (weapon.tier === 'S' ? t.sTier : (weapon.tier === 'A' ? t.aTier : t.bTier));
    
    const embed = new EmbedBuilder()
        .setColor(tierColor)
        .setAuthor({ name: t.author, iconURL: 'https://cdn.discordapp.com/emojis/1274083642106257499.png' })
        .setTitle(`◈ ${t.weaponSelected}: ${weapon.name} ◈`)
        .setDescription(
            `\`\`\`yaml\n` +
            `[${t.tier}]: ${tierName}\n` +
            `[${t.intel}]: ${weapon.intel[lang]}\`\`\``
        )
        .setFooter({ text: t.footer })
        .setTimestamp();

    if (weapon.image && weapon.image.startsWith('http')) {
        embed.setImage(weapon.image);
    }
    
    return embed;
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'randommeta',
    aliases: ['meta', 'codm', 'pick', 'weapon', 'arme'],
    description: '🎲 Access the Meta Intelligence Grid for real-time weapon recommendations.',
    category: 'GAMING',
    cooldown: 3000,
    usage: '.randommeta',
    examples: ['.meta', '.arme', '.weapon'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';

        // Initial weapon selection
        let currentWeapon = metaData[Math.floor(Math.random() * metaData.length)];

        // Dynamic Button Builder
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('meta_reroll')
                .setLabel(t.reroll)
                .setEmoji('🎲')
                .setStyle(ButtonStyle.Primary)
        );

        const response = await message.reply({
            content: t.scanning,
            embeds: [generateEmbed(currentWeapon, lang)],
            components: [buttons]
        }).catch(() => {});

        if (!response) return;

        // ================= INTERACTION COLLECTOR =================
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
            }

            if (i.customId === 'meta_reroll') {
                currentWeapon = metaData[Math.floor(Math.random() * metaData.length)];
                await i.update({
                    content: t.updated,
                    embeds: [generateEmbed(currentWeapon, lang)],
                    components: [buttons]
                }).catch(() => {});
            }
        });

        collector.on('end', () => {
            const disabled = new ActionRowBuilder().addComponents(
                buttons.components.map(b => ButtonBuilder.from(b).setDisabled(true))
            );
            response.edit({ components: [disabled] }).catch(() => {});
        });

        console.log(`[META] ${message.author.tag} rolled: ${currentWeapon.name} (${currentWeapon.tier}) | Lang: ${lang}`);
    }
};