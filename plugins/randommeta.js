const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        author: 'ARCHITECT META INTELLIGENCE',
        accessing: '> **🔍 Accessing Eagle Community Armory...**',
        newSignal: '> **🔄 New tactical signal acquired.**',
        specsTitle: (name) => `> **🛠️ Displaying full optimization specs for ${name}...**`,
        tier: 'TIER',
        intel: 'INTEL',
        optimizedSpecs: '🛠️ OPTIMIZED LOADOUT SPECS',
        reroll: 'RE-ROLL',
        viewSpecs: 'VIEW SPECS',
        hideSpecs: 'HIDE SPECS',
        securityLock: '⛔ Security Lock: Interaction restricted.',
        footer: 'EAGLE COMMUNITY • BKO-223 NODE',
        godTier: 'GOD',
        sTier: 'S',
        aTier: 'A',
        weaponStats: 'WEAPON STATS',
        fireRate: 'Fire Rate',
        damage: 'Damage',
        accuracy: 'Accuracy',
        range: 'Range',
        control: 'Control',
        mobility: 'Mobility',
        sessionExpired: '⏱️ Session expired. Use .meta to start a new one.'
    },
    fr: {
        author: 'ARCHITECT INTELLIGENCE MÉTA',
        accessing: '> **🔍 Accès à l\'Armurerie Eagle Community...**',
        newSignal: '> **🔄 Nouveau signal tactique acquis.**',
        specsTitle: (name) => `> **🛠️ Affichage des spécifications complètes pour ${name}...**`,
        tier: 'NIVEAU',
        intel: 'INTEL',
        optimizedSpecs: '🛠️ SPÉCIFICATIONS OPTIMISÉES',
        reroll: 'REJOUER',
        viewSpecs: 'VOIR SPÉCS',
        hideSpecs: 'CACHER SPÉCS',
        securityLock: '⛔ Verrouillage Sécurité: Interaction restreinte.',
        footer: 'EAGLE COMMUNITY • NŒUD BKO-223',
        godTier: 'DIEU',
        sTier: 'S',
        aTier: 'A',
        weaponStats: 'STATISTIQUES',
        fireRate: 'Cadence',
        damage: 'Dégâts',
        accuracy: 'Précision',
        range: 'Portée',
        control: 'Contrôle',
        mobility: 'Mobilité',
        sessionExpired: '⏱️ Session expirée. Utilisez .meta pour en démarrer une nouvelle.'
    }
};

// ================= EXPANDED WEAPON DATABASE =================
const metaData = [
    { 
        name: "AK117", 
        tier: "S", 
        intel: { 
            en: "The undisputed king of versatility. High fire rate and aggressive TTK.", 
            fr: "Le roi incontesté de la polyvalence. Cadence élevée et TTK agressif." 
        },
        specs: "Owc Marksman, No Stock, Owc Laser, 40 Round Mag, Granulated Grip",
        image: "https://cdn.discordapp.com/attachments/1472176119540224010/1479909018368741711/Screenshot_20260307_114446_Call_of_Duty.jpg",
        stats: { fireRate: 85, damage: 75, accuracy: 80, range: 70, control: 75, mobility: 85 }
    },
    { 
        name: "DL Q33", 
        tier: "S", 
        intel: { 
            en: "The sniper's standard. Unmatched consistency and wall-penetration.", 
            fr: "Le standard du sniper. Constance et pénétration inégalées." 
        },
        specs: "Mip Light, Combat Stock, Owc Laser, FMJ, Maevwat Omega Mag",
        image: "https://cdn.discordapp.com/attachments/1472176119540224010/1479909017387143430/Screenshot_20260307_114516_Call_of_Duty.jpg",
        stats: { fireRate: 30, damage: 95, accuracy: 95, range: 100, control: 60, mobility: 40 }
    },
    { 
        name: "BP50", 
        tier: "GOD", 
        intel: { 
            en: "Current peak performance. Fire rate exceeds standard reaction times.", 
            fr: "Performance maximale actuelle. Cadence dépasse les temps de réaction standards." 
        },
        specs: "Leroy Custom Barrel, No Stock, Aim Assist Laser, 60 Round Mag, Stippled Grip",
        image: "https://cdn.discordapp.com/attachments/1472176119540224010/1479913616877555882/Screenshot_20260307_184241_Call_of_Duty.jpg",
        stats: { fireRate: 95, damage: 80, accuracy: 75, range: 65, control: 70, mobility: 90 }
    },
    { 
        name: "SKS", 
        tier: "GOD", 
        intel: { 
            en: "The marksman's choice. Lethal two-tap potential at any range.", 
            fr: "Le choix du tireur d'élite. Potentiel mortel en deux balles à toute portée." 
        },
        specs: "Mip Light, No Stock, Owc Laser, 20 Round Mag, Granulated Grip",
        image: "https://i.imgur.com/example_sks.png",
        stats: { fireRate: 60, damage: 85, accuracy: 90, range: 85, control: 80, mobility: 75 }
    },
    { 
        name: "LW3-TUNDRA", 
        tier: "S", 
        intel: { 
            en: "Elite bolt-action mobility. Best-in-class ADS speed.", 
            fr: "Mobilité élite à verrou. Meilleure vitesse ADS de sa catégorie." 
        },
        specs: "Tiger Team Barrel, Bandit Steady Stock, 7 Round Mag, Serpent Wrap",
        image: "https://cdn.discordapp.com/attachments/1472176119540224010/1481256517700292722/Screenshot_20260311_114145_Call_of_Duty.jpg",
        stats: { fireRate: 35, damage: 98, accuracy: 92, range: 95, control: 55, mobility: 50 }
    },
    { 
        name: "RYTEC AMR", 
        tier: "A", 
        intel: { 
            en: "Anti-material power. Ideal for disrupting enemy streaks.", 
            fr: "Puissance anti-matériel. Idéal pour perturber les séries ennemies." 
        },
        specs: "Mip Light Barrel, Owc Skeleton Stock, Owc Laser, Explosive Mag, Stippled Grip",
        image: "https://cdn.discordapp.com/attachments/1472176119540224010/1481256517347967017/Screenshot_20260311_114124_Call_of_Duty.jpg",
        stats: { fireRate: 25, damage: 100, accuracy: 85, range: 90, control: 45, mobility: 30 }
    },
    { 
        name: "KRM-262", 
        tier: "A", 
        intel: { 
            en: "Devastating close-range shotgun. One-shot kill potential.", 
            fr: "Fusil à pompe dévastateur à courte portée. Potentiel de kill en un coup." 
        },
        specs: "Marauder Suppressor, Extended Barrel, No Stock, OWC Laser",
        image: "https://cdn.discordapp.com/attachments/1472176119540224010/1479913614772142111/Screenshot_20260307_184727_Call_of_Duty.jpg",
        stats: { fireRate: 45, damage: 100, accuracy: 40, range: 20, control: 50, mobility: 80 }
    },
    { 
        name: "FFAR 1", 
        tier: "S", 
        intel: { 
            en: "Aggressive assault rifle with blistering fire rate.", 
            fr: "Fusil d'assaut agressif avec une cadence de tir fulgurante." 
        },
        specs: "Agency Suppressor, Task Force Barrel, Raider Stock, Speed Mag",
        image: "https://cdn.discordapp.com/attachments/1472176119540224010/1479909018725126286/Screenshot_20260307_114435_Call_of_Duty.jpg",
        stats: { fireRate: 90, damage: 70, accuracy: 75, range: 60, control: 65, mobility: 88 }
    },
    { 
        name: "HDR", 
        tier: "A", 
        intel: { 
            en: "Heavy-duty bolt action. Extreme range and damage.", 
            fr: "Fusil à verrou lourd. Portée et dégâts extrêmes." 
        },
        specs: "Monolithic Suppressor, 26.9 HDR Pro, FTAC Stalker-Scout, 9 Round Mags",
        image: "https://cdn.discordapp.com/attachments/1472176119540224010/1481065011232112813/Screenshot_20260310_224049_Call_of_Duty.jpg",
        stats: { fireRate: 25, damage: 99, accuracy: 98, range: 100, control: 40, mobility: 30 }
    },
    { 
        name: "KN-44", 
        tier: "A", 
        intel: { 
            en: "Reliable workhorse. Consistent performance at all ranges.", 
            fr: "Cheval de bataille fiable. Performance constante à toutes les portées." 
        },
        specs: "OWC Marksman, No Stock, OWC Laser, 38 Rnd, Granulated Grip",
        image: "https://cdn.discordapp.com/attachments/1472176119540224010/1481065011530043442/Screenshot_20260310_223955_Call_of_Duty.jpg",
        stats: { fireRate: 70, damage: 75, accuracy: 80, range: 75, control: 80, mobility: 75 }
    }
];

// ================= HELPER FUNCTIONS =================
function createStatBar(value, max = 100, length = 10) {
    const filled = Math.round((value / max) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function generateEmbed(weapon, showSpecs = false, lang = 'en') {
    const t = translations[lang];
    
    const tierColors = {
        'GOD': '#ff0055',
        'S': '#00fbff',
        'A': '#f1c40f'
    };
    
    const tierColor = tierColors[weapon.tier] || '#f1c40f';
    const tierName = weapon.tier === 'GOD' ? t.godTier : (weapon.tier === 'S' ? t.sTier : t.aTier);
    
    const embed = new EmbedBuilder()
        .setColor(tierColor)
        .setAuthor({ 
            name: t.author, 
            iconURL: 'https://cdn.discordapp.com/emojis/1274083642106257499.png' 
        })
        .setTitle(`◈ ARMAMENT: ${weapon.name} ◈`)
        .setDescription(
            `\`\`\`yaml\n` +
            `[${t.tier}]: ${tierName}\n` +
            `[${t.intel}]: ${weapon.intel[lang]}\`\`\``
        );

    // Add weapon stats
    if (weapon.stats) {
        const stats = weapon.stats;
        embed.addFields({
            name: `📊 ${t.weaponStats}`,
            value: `\`\`\`yaml\n` +
                   `${t.fireRate}:  ${createStatBar(stats.fireRate)} ${stats.fireRate}%\n` +
                   `${t.damage}:   ${createStatBar(stats.damage)} ${stats.damage}%\n` +
                   `${t.accuracy}: ${createStatBar(stats.accuracy)} ${stats.accuracy}%\n` +
                   `${t.range}:    ${createStatBar(stats.range)} ${stats.range}%\n` +
                   `${t.control}:  ${createStatBar(stats.control)} ${stats.control}%\n` +
                   `${t.mobility}: ${createStatBar(stats.mobility)} ${stats.mobility}%\`\`\``,
            inline: false
        });
    }

    if (showSpecs) {
        embed.addFields({ 
            name: t.optimizedSpecs, 
            value: `\`\`\`fix\n${weapon.specs}\`\`\``,
            inline: false
        });
    }

    if (weapon.image && weapon.image.includes('http')) {
        embed.setImage(weapon.image);
    }
    
    embed.setFooter({ text: t.footer })
        .setTimestamp();
        
    return embed;
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'randommeta',
    aliases: ['meta', 'codm', 'pick', 'weapon', 'arme'],
    description: '🎲 Access the Meta Intelligence Grid for real-time weapon picks and specs.',
    category: 'GAMING',
    cooldown: 3000,
    usage: '.randommeta',
    examples: ['.meta', '.arme', '.weapon'],

    run: async (client, message, args, db, usedCommand) => {
        
        // Language detection
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];

        let currentWeapon = metaData[Math.floor(Math.random() * metaData.length)];
        let showingSpecs = false;

        // Create buttons with unique IDs containing user ID
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`meta_reroll_${message.author.id}`)
                .setLabel(t.reroll)
                .setEmoji('🎲')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`meta_specs_${message.author.id}`)
                .setLabel(t.viewSpecs)
                .setEmoji('🛠️')
                .setStyle(ButtonStyle.Success)
        );

        try {
            const response = await message.reply({
                content: t.accessing,
                embeds: [generateEmbed(currentWeapon, false, lang)],
                components: [buttons]
            });

            // Collector with no componentType filter - catches all
            const collector = response.createMessageComponentCollector({ 
                time: 120000 
            });

            collector.on('collect', async (i) => {
                // Verify the interaction is for this user
                if (!i.customId.endsWith(`_${message.author.id}`)) {
                    return i.reply({ 
                        content: t.securityLock, 
                        flags: 64 
                    }).catch(() => {});
                }

                // Handle reroll button
                if (i.customId.startsWith('meta_reroll')) {
                    currentWeapon = metaData[Math.floor(Math.random() * metaData.length)];
                    showingSpecs = false;
                    
                    // Update button label
                    const updatedButtons = new ActionRowBuilder().addComponents(
                        ButtonBuilder.from(buttons.components[0]),
                        new ButtonBuilder()
                            .setCustomId(`meta_specs_${message.author.id}`)
                            .setLabel(t.viewSpecs)
                            .setEmoji('🛠️')
                            .setStyle(ButtonStyle.Success)
                    );
                    
                    await i.update({
                        content: t.newSignal,
                        embeds: [generateEmbed(currentWeapon, false, lang)],
                        components: [updatedButtons]
                    }).catch(() => {});
                    
                    console.log(`[META] ${message.author.tag} rerolled: ${currentWeapon.name} (${currentWeapon.tier})`);
                }

                // Handle specs toggle button
                if (i.customId.startsWith('meta_specs')) {
                    showingSpecs = !showingSpecs;
                    
                    // Update button label
                    const updatedButtons = new ActionRowBuilder().addComponents(
                        ButtonBuilder.from(buttons.components[0]),
                        new ButtonBuilder()
                            .setCustomId(`meta_specs_${message.author.id}`)
                            .setLabel(showingSpecs ? t.hideSpecs : t.viewSpecs)
                            .setEmoji('🛠️')
                            .setStyle(ButtonStyle.Success)
                    );
                    
                    await i.update({
                        content: showingSpecs ? t.specsTitle(currentWeapon.name) : t.accessing,
                        embeds: [generateEmbed(currentWeapon, showingSpecs, lang)],
                        components: [updatedButtons]
                    }).catch(() => {});
                }
            });

            collector.on('end', async () => {
                // Disable all buttons when session ends
                const disabledRow = new ActionRowBuilder().addComponents(
                    buttons.components.map(b => ButtonBuilder.from(b).setDisabled(true))
                );
                
                await response.edit({ 
                    content: t.sessionExpired,
                    components: [disabledRow] 
                }).catch(() => {});
            });

            console.log(`[META] ${message.author.tag} rolled: ${currentWeapon.name} (${currentWeapon.tier}) | Lang: ${lang}`);
            
        } catch (error) {
            console.error('[META] Error:', error);
            await message.reply('❌ An error occurred while accessing the armory.').catch(() => {});
        }
    }
};