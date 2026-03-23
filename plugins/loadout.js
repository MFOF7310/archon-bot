const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    StringSelectMenuBuilder, 
    ButtonStyle, 
    ComponentType 
} = require('discord.js');

module.exports = {
    name: 'loadout',
    description: 'Interactive community armory for Eagle Community.',
    run: async (client, message, args) => {

        // --- THE ARMORY DATABASE ---
        // Remplacer 'YOUR_BUILD_CODE' par le code de l'arme (ex: 1C2C6C8B9A)
        // Remplacer 'YOUR_IMG_URL' par le lien de votre screenshot Discord
        const loadouts = {
            "AK117": { emoji: "🔫", title: "AK117 - TACTICAL RELIABILITY", build: "YOUR_BUILD_CODE", desc: "Polyvalente et rapide. Idéale pour le mid-range.", image: "YOUR_IMG_URL" },
            "FFAR1": { emoji: "🔥", title: "FFAR 1 - CLOSE-QUARTERS SHREDDER", build: "YOUR_BUILD_CODE", desc: "Cadence de tir agressive pour le combat rapproché.", image: "YOUR_IMG_URL" },
            "DLQ": { emoji: "🎯", title: "DL Q33 - LEGENDARY PRECISION", build: "YOUR_BUILD_CODE", desc: "Le sniper de référence pour la précision absolue.", image: "YOUR_IMG_URL" },
            "KRM": { emoji: "🛡️", title: "KRM-262 - SLIDING ASSASSIN", build: "YOUR_BUILD_CODE", desc: "Dominez en combat rapproché avec une grande mobilité.", image: "YOUR_IMG_URL" },
            "TUNDRA": { emoji: "❄️", title: "LW3-TUNDRA - MODERN SNIPING", build: "YOUR_BUILD_CODE", desc: "Sniper moderne avec une vitesse de visée exceptionnelle.", image: "YOUR_IMG_URL" },
            "BP50": { emoji: "⚡", title: "BP50 - VELOCITY STRIKE", build: "YOUR_BUILD_CODE", desc: "La cadence la plus rapide du moment.", image: "YOUR_IMG_URL" },
            "KN44": { emoji: "⚔️", title: "KN-44 - VERSATILE ASSAULT RIFLE", build: "YOUR_BUILD_CODE", desc: "Performante à toutes les distances.", image: "YOUR_IMG_URL" },
            "HS0405": { emoji: "💥", title: "HS0405 - ONE-TAP DOMINANCE", build: "YOUR_BUILD_CODE", desc: "Dégâts extrêmes. Un tir, un mort.", image: "YOUR_IMG_URL" },
            "RYTEC": { emoji: "🧨", title: "RYTEC AMR - ANTI-MATERIAL RIFLE", build: "YOUR_BUILD_CODE", desc: "Puissance de feu lourde avec munitions explosives.", image: "YOUR_IMG_URL" },
            "HDR": { emoji: "🔭", title: "HDR - BOLT ACTION SNIPER WEAPON", build: "YOUR_BUILD_CODE", desc: "Idéal pour tenir des lignes à très longue distance.", image: "YOUR_IMG_URL" },
            "BY15": { emoji: "🛑", title: "BY15 - PRECISION SLUGGER", build: "YOUR_BUILD_CODE", desc: "Fusil à pompe tactique avec une portée surprenante.", image: "YOUR_IMG_URL" }
        };

        const createEmbed = (weaponKey) => {
            const data = loadouts[weaponKey];
            const isDefault = data.build === "YOUR_BUILD_CODE";
            
            const embed = new EmbedBuilder()
                .setColor(isDefault ? '#4f545c' : '#2b2d31')
                .setTitle(`${data.emoji} ${data.title}`)
                .addFields(
                    { 
                        name: '🛠️ BUILD CODE', 
                        value: isDefault ? "*En attente de contribution...*" : `\`${data.build}\`` 
                    },
                    { 
                        name: '📋 ANALYSE', 
                        value: `*${data.desc}*` 
                    },
                    {
                        name: '📸 IMAGE DU BUILD',
                        value: data.image === "YOUR_IMG_URL" ? "💡 *L'image n'est pas encore disponible.*" : "✅ Image chargée avec succès."
                    }
                )
                .setFooter({ text: 'Eagle Community | Loadout Intelligence 🇲🇱' })
                .setTimestamp();

            if (data.image !== "YOUR_IMG_URL") {
                embed.setImage(data.image);
            }
            
            return embed;
        };

        const searchRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('search_weapon')
                .setPlaceholder('🔍 Rechercher une arme...')
                .addOptions(Object.keys(loadouts).map(key => ({
                    label: key,
                    value: key,
                    emoji: loadouts[key].emoji
                })))
        );

        const popularRow = new ActionRowBuilder().addComponents(
            ['AK117', 'FFAR1', 'DLQ', 'KRM', 'BP50'].map(key => 
                new ButtonBuilder()
                    .setCustomId(`btn_${key}`)
                    .setLabel(key)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(loadouts[key].emoji)
            )
        );

        const utilityRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('submit_build')
                .setLabel('Proposer un Build')
                .setStyle(ButtonStyle.Success)
                .setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId('close_menu')
                .setLabel('Fermer')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );

        const initialMsg = await message.reply({
            content: "⚔️ **Armurerie Collective Eagle Community**\n*Utilisez les boutons ou la recherche pour explorer les builds.*",
            components: [searchRow, popularRow, utilityRow]
        });

        const collector = initialMsg.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return i.reply({ content: "❌ Seul l'auteur de la commande peut naviguer.", ephemeral: true });

            if (i.customId === 'close_menu') {
                return i.update({ content: "✅ Menu fermé.", components: [], embeds: [] });
            }

            if (i.customId === 'submit_build') {
                return i.reply({ 
                    content: "📥 **Comment contribuer ?**\n1. Prenez un screenshot de votre build en jeu.\n2. Envoyez-le dans un salon public.\n3. Copiez le lien de l'image.\n4. Envoyez le lien et le code du build à un **Staff Member** pour mise à jour !", 
                    ephemeral: true 
                });
            }

            const selected = i.isStringSelectMenu() ? i.values[0] : i.customId.replace('btn_', '');
            
            await i.update({
                content: `📍 Focus : **${selected}**`,
                embeds: [createEmbed(selected)],
                components: [searchRow, popularRow, utilityRow]
            });
        });

        collector.on('end', () => {
            initialMsg.edit({ components: [] }).catch(() => null);
        });
    }
};
