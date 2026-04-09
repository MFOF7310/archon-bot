const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    StringSelectMenuBuilder, 
    ButtonStyle, 
    ComponentType 
} = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: '⚔️ Eagle Community Collective Armory',
        subtitle: 'Use the buttons or search to explore builds.',
        searchPlaceholder: '🔍 Search for a weapon...',
        buildCode: '🛠️ BUILD CODE',
        analysis: '📋 ANALYSIS',
        imageStatus: '📸 BUILD IMAGE',
        pendingContribution: '*Pending contribution...*',
        imageNotAvailable: '💡 *Image not yet available.*',
        imageLoaded: '✅ Image loaded successfully.',
        proposeBuild: 'Submit Build',
        close: 'Close',
        focus: 'Focus',
        sessionEnded: '✅ Session ended.',
        menuClosed: '✅ Menu closed.',
        accessDenied: '❌ Only the command author can navigate.',
        contributeTitle: '📥 How to contribute?',
        contributeDesc: '1. Take a screenshot of your build in-game.\n2. Send it in a public channel.\n3. Copy the image link.\n4. Send the link and build code to a **Staff Member** for update!',
        footer: 'Eagle Community | Loadout Intelligence 🇲🇱'
    },
    fr: {
        title: '⚔️ Armurerie Collective Eagle Community',
        subtitle: 'Utilisez les boutons ou la recherche pour explorer les builds.',
        searchPlaceholder: '🔍 Rechercher une arme...',
        buildCode: '🛠️ CODE BUILD',
        analysis: '📋 ANALYSE',
        imageStatus: '📸 IMAGE DU BUILD',
        pendingContribution: '*En attente de contribution...*',
        imageNotAvailable: '💡 *L\'image n\'est pas encore disponible.*',
        imageLoaded: '✅ Image chargée avec succès.',
        proposeBuild: 'Proposer un Build',
        close: 'Fermer',
        focus: 'Focus',
        sessionEnded: '✅ Session terminée.',
        menuClosed: '✅ Menu fermé.',
        accessDenied: '❌ Seul l\'auteur de la commande peut naviguer.',
        contributeTitle: '📥 Comment contribuer ?',
        contributeDesc: '1. Prenez un screenshot de votre build en jeu.\n2. Envoyez-le dans un salon public.\n3. Copiez le lien de l\'image.\n4. Envoyez le lien et le code du build à un **Staff Member** pour mise à jour !',
        footer: 'Eagle Community | Renseignement Loadout 🇲🇱'
    }
};

// ================= THE ARMORY DATABASE =================
// Replace 'YOUR_BUILD_CODE' with weapon build code (ex: 1C2C6C8B9A)
// Replace 'YOUR_IMG_URL' with your Discord screenshot link
const loadouts = {
    "AK117": { 
        emoji: "🔫", 
        title: { en: "AK117 - TACTICAL RELIABILITY", fr: "AK117 - FIABILITÉ TACTIQUE" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "Versatile and fast. Ideal for mid-range.", fr: "Polyvalente et rapide. Idéale pour le mid-range." }, 
        image: "YOUR_IMG_URL" 
    },
    "FFAR1": { 
        emoji: "🔥", 
        title: { en: "FFAR 1 - CLOSE-QUARTERS SHREDDER", fr: "FFAR 1 - DÉCHIQUETEUR CORPS-À-CORPS" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "Aggressive fire rate for close combat.", fr: "Cadence de tir agressive pour le combat rapproché." }, 
        image: "YOUR_IMG_URL" 
    },
    "DLQ": { 
        emoji: "🎯", 
        title: { en: "DL Q33 - LEGENDARY PRECISION", fr: "DL Q33 - PRÉCISION LÉGENDAIRE" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "The reference sniper for absolute precision.", fr: "Le sniper de référence pour la précision absolue." }, 
        image: "YOUR_IMG_URL" 
    },
    "KRM": { 
        emoji: "🛡️", 
        title: { en: "KRM-262 - SLIDING ASSASSIN", fr: "KRM-262 - ASSASSIN GLISSANT" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "Dominate close combat with high mobility.", fr: "Dominez en combat rapproché avec une grande mobilité." }, 
        image: "YOUR_IMG_URL" 
    },
    "TUNDRA": { 
        emoji: "❄️", 
        title: { en: "LW3-TUNDRA - MODERN SNIPING", fr: "LW3-TUNDRA - SNIPING MODERNE" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "Modern sniper with exceptional ADS speed.", fr: "Sniper moderne avec une vitesse de visée exceptionnelle." }, 
        image: "YOUR_IMG_URL" 
    },
    "BP50": { 
        emoji: "⚡", 
        title: { en: "BP50 - VELOCITY STRIKE", fr: "BP50 - FRAPPE VÉLOCITÉ" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "The fastest fire rate of the moment.", fr: "La cadence la plus rapide du moment." }, 
        image: "YOUR_IMG_URL" 
    },
    "KN44": { 
        emoji: "⚔️", 
        title: { en: "KN-44 - VERSATILE ASSAULT RIFLE", fr: "KN-44 - FUSIL D'ASSAUT POLYVALENT" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "Performs well at all distances.", fr: "Performante à toutes les distances." }, 
        image: "YOUR_IMG_URL" 
    },
    "HS0405": { 
        emoji: "💥", 
        title: { en: "HS0405 - ONE-TAP DOMINANCE", fr: "HS0405 - DOMINATION EN UN COUP" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "Extreme damage. One shot, one kill.", fr: "Dégâts extrêmes. Un tir, un mort." }, 
        image: "YOUR_IMG_URL" 
    },
    "RYTEC": { 
        emoji: "🧨", 
        title: { en: "RYTEC AMR - ANTI-MATERIAL RIFLE", fr: "RYTEC AMR - FUSIL ANTI-MATÉRIEL" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "Heavy firepower with explosive rounds.", fr: "Puissance de feu lourde avec munitions explosives." }, 
        image: "YOUR_IMG_URL" 
    },
    "HDR": { 
        emoji: "🔭", 
        title: { en: "HDR - BOLT ACTION SNIPER", fr: "HDR - SNIPER À VERROU" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "Ideal for holding very long distance lines.", fr: "Idéal pour tenir des lignes à très longue distance." }, 
        image: "YOUR_IMG_URL" 
    },
    "BY15": { 
        emoji: "🛑", 
        title: { en: "BY15 - PRECISION SLUGGER", fr: "BY15 - FRAPPEUR DE PRÉCISION" }, 
        build: "YOUR_BUILD_CODE", 
        desc: { en: "Tactical shotgun with surprising range.", fr: "Fusil à pompe tactique avec une portée surprenante." }, 
        image: "YOUR_IMG_URL" 
    }
};

// ================= EMBED CREATOR =================
function createEmbed(weaponKey, lang = 'en') {
    const data = loadouts[weaponKey];
    const t = translations[lang];
    const isDefault = data.build === "YOUR_BUILD_CODE";
    const isDefaultImage = data.image === "YOUR_IMG_URL";
    
    const embed = new EmbedBuilder()
        .setColor(isDefault ? '#4f545c' : '#2b2d31')
        .setTitle(`${data.emoji} ${data.title[lang]}`)
        .addFields(
            { 
                name: t.buildCode, 
                value: isDefault ? t.pendingContribution : `\`\`\`fix\n${data.build}\`\`\`` 
            },
            { 
                name: t.analysis, 
                value: `*${data.desc[lang]}*` 
            },
            {
                name: t.imageStatus,
                value: isDefaultImage ? t.imageNotAvailable : t.imageLoaded
            }
        )
        .setFooter({ text: t.footer })
        .setTimestamp();

    if (!isDefaultImage) {
        embed.setImage(data.image);
    }
    
    return embed;
}

// ================= MAIN COMMAND =================
module.exports = {
    name: 'loadout',
    aliases: ['loadouts', 'weapons', 'build', 'armes', 'configuration'],
    description: '🛠️ Interactive community armory for Eagle Community.',
    category: 'GAMING',
    cooldown: 3000,
    usage: '.loadout',
    examples: ['.loadout', '.armes', '.build'],

    // 🔥 NEW SIGNATURE: 6 parameters with usedCommand
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        
        // 🔥 NEURAL LANGUAGE BRIDGE - Alias-based detection!
        const lang = client.detectLanguage 
            ? client.detectLanguage(usedCommand, 'en')
            : 'en';
        
        const t = translations[lang];
        const version = client.version || '1.6.0';

        // ================= SEARCH DROPDOWN =================
        const searchRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('loadout_search')
                .setPlaceholder(t.searchPlaceholder)
                .addOptions(Object.keys(loadouts).map(key => ({
                    label: key,
                    value: key,
                    emoji: loadouts[key].emoji
                })))
        );

        // ================= POPULAR QUICK BUTTONS =================
        const popularRow = new ActionRowBuilder().addComponents(
            ['AK117', 'FFAR1', 'DLQ', 'KRM', 'BP50'].map(key => 
                new ButtonBuilder()
                    .setCustomId(`loadout_${key}`)
                    .setLabel(key)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(loadouts[key].emoji)
            )
        );

        // ================= UTILITY ROW =================
        const utilityRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('loadout_submit')
                .setLabel(t.proposeBuild)
                .setStyle(ButtonStyle.Success)
                .setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId('loadout_close')
                .setLabel(t.close)
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );

        const initialMsg = await message.reply({
            content: `**${t.title}**\n*${t.subtitle}*`,
            components: [searchRow, popularRow, utilityRow]
        }).catch(() => {});

        if (!initialMsg) return;

        const collector = initialMsg.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 180000 
        });

        const selectCollector = initialMsg.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 180000 
        });

        // Handle button clicks
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
            }

            if (i.customId === 'loadout_close') {
                return i.update({ content: t.menuClosed, embeds: [], components: [] }).catch(() => {});
            }

            if (i.customId === 'loadout_submit') {
                return i.reply({ 
                    content: `**${t.contributeTitle}**\n${t.contributeDesc}`, 
                    ephemeral: true 
                }).catch(() => {});
            }

            const selected = i.customId.replace('loadout_', '');
            
            await i.update({
                content: `📍 **${t.focus}:** ${selected}`,
                embeds: [createEmbed(selected, lang)],
                components: [searchRow, popularRow, utilityRow]
            }).catch(() => {});
        });

        // Handle select menu
        selectCollector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: t.accessDenied, ephemeral: true }).catch(() => {});
            }

            const selected = i.values[0];
            
            await i.update({
                content: `📍 **${t.focus}:** ${selected}`,
                embeds: [createEmbed(selected, lang)],
                components: [searchRow, popularRow, utilityRow]
            }).catch(() => {});
        });

        // Cleanup
        const endCollector = () => {
            const disabledComponents = [searchRow, popularRow, utilityRow].map(row => {
                return new ActionRowBuilder().addComponents(
                    row.components.map(c => {
                        if (c instanceof StringSelectMenuBuilder) {
                            return StringSelectMenuBuilder.from(c).setDisabled(true);
                        }
                        return ButtonBuilder.from(c).setDisabled(true);
                    })
                );
            });
            initialMsg.edit({ components: disabledComponents }).catch(() => {});
        };

        collector.on('end', endCollector);
        selectCollector.on('end', endCollector);

        console.log(`[LOADOUT] ${message.author.tag} opened armory | Lang: ${lang}`);
    }
};