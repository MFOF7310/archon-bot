/**
 * ◈ ARCHITECT CG-223 | RANDOM META MODULE ◈
 * * DEPLOYMENT PROCEDURE:
 * 1. Ensure 'discord.js' v14 is installed.
 * 2. Replace 'YOUR_IMAGE_URL' with direct links to weapon screenshots.
 * 3. This module focuses on "Intel" to avoid giving conflicting loadout advice.
 * 4. Use '.randommeta' to cycle through the current global combat meta.
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'randommeta',
    aliases: ['meta', 'codm', 'pick'],
    description: 'Access the Meta Intelligence Grid for real-time weapon recommendations.',
    category: 'GAMING',
    run: async (client, message, args, database) => {
        
        // --- TACTICAL ARMORY DATA ---
        // Clean and honest: Intel only, no forced specs!
        const metaData = [
            { 
                name: "AK117", tier: "S", 
                intel: "The undisputed king of versatility. High fire rate and aggressive TTK.",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "DL Q33", tier: "S", 
                intel: "The sniper's standard. Unmatched consistency and wall-penetration.",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "BP50", tier: "GOD", 
                intel: "Current peak performance. Fire rate exceeds standard human reaction times.",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "SKS", tier: "GOD", 
                intel: "The marksman's choice. Lethal two-tap potential at any range for disciplined players.",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "LW3-TUNDRA", tier: "S", 
                intel: "Elite bolt-action mobility. Best-in-class ADS speed for aggressive snipers.",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "RYTEC AMR", tier: "A", 
                intel: "Anti-material power. Ideal for disrupting enemy scorestreaks and vehicles.",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "KN-44", tier: "S", 
                intel: "Heavy hitter with a lethal three-tap potential if accuracy is maintained.",
                image: "YOUR_IMAGE_URL" 
            }
        ];

        // --- EMBED GENERATOR ENGINE ---
        const generateEmbed = (weapon) => {
            const embed = new EmbedBuilder()
                .setColor(weapon.tier === 'GOD' ? '#ff0055' : '#00fbff')
                .setAuthor({ name: 'ARCHITECT META INTELLIGENCE', iconURL: client.user.displayAvatarURL() })
                .setTitle(`◈ ARMAMENT SELECTED: ${weapon.name} ◈`)
                .setDescription(
                    `\`\`\`ansi\n\u001b[1;33m[TIER]:\u001b[0m ${weapon.tier}\n` +
                    `\u001b[1;36m[INTEL]:\u001b[0m ${weapon.intel}\`\`\``
                )
                .setFooter({ text: 'EAGLE COMMUNITY • BKO-223 NODE' })
                .setTimestamp();

            // Only attaches image if a valid URL is provided
            if (weapon.image && weapon.image.startsWith('http')) {
                embed.setImage(weapon.image);
            }
            
            return embed;
        };

        // Initial Selection
        let currentWeapon = metaData[Math.floor(Math.random() * metaData.length)];

        // Dynamic Button Builder
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('reroll')
                .setLabel('RE-ROLL DATA')
                .setEmoji('🎲')
                .setStyle(ButtonStyle.Primary)
        );

        const response = await message.reply({
            content: `> **Scanning global combat trends... Signal acquired.**`,
            embeds: [generateEmbed(currentWeapon)],
            components: [buttons]
        });

        // --- INTERACTION COLLECTOR ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 // 1 minute active window
        });

        collector.on('collect', async (i) => {
            // Security Check
            if (i.user.id !== message.author.id) {
                return i.reply({ content: '⛔ **ACCESS DENIED:** This terminal is locked to the original agent.', ephemeral: true });
            }

            if (i.customId === 'reroll') {
                currentWeapon = metaData[Math.floor(Math.random() * metaData.length)];
                await i.update({
                    content: `> **Meta-grid updated. New armament recommendation displayed.**`,
                    embeds: [generateEmbed(currentWeapon)],
                    components: [buttons]
                });
            }
        });

        // Cleanup
        collector.on('end', () => {
            const disabled = new ActionRowBuilder().addComponents(
                buttons.components.map(b => ButtonBuilder.from(b).setDisabled(true))
            );
            response.edit({ components: [disabled] }).catch(() => null);
        });
    }
};
