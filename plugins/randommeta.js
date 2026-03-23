/**
 * ◈ ARCHITECT CG-223 | RANDOM META MODULE ◈
 * * DEPLOYMENT PROCEDURE:
 * 1. Ensure 'discord.js' v14 is installed.
 * 2. Replace 'YOUR_IMAGE_URL' with direct links to weapon screenshots (Imgur/Discord links).
 * 3. To add a new weapon: Add a new object to the 'metaData' array following the existing schema.
 * 4. This command uses ANSI and FIX markdown for high-tech visual formatting.
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'randommeta',
    aliases: ['meta', 'codm', 'pick'],
    description: 'Access the Meta Intelligence Grid for real-time weapon picks and specs.',
    category: 'GAMING',
    run: async (client, message, args, database) => {
        
        // --- TACTICAL ARMORY DATA ---
        // Replace 'YOUR_IMAGE_URL' with actual high-resolution image links.
        const metaData = [
            { 
                name: "AK117", tier: "S", 
                intel: "The undisputed king of versatility. High fire rate and aggressive TTK.",
                specs: "Owc Marksman, No Stock, Owc Laser, 40 Round Mag, Granulated Grip",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "DL Q33", tier: "S", 
                intel: "The sniper's standard. Unmatched consistency and wall-penetration.",
                specs: "Mip Light, Combat Stock, Owc Laser, FMJ, Maevwat Omega Mag",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "BP50", tier: "GOD", 
                intel: "Current peak performance. Fire rate exceeds standard reaction times.",
                specs: "Leroy Custom Barrel, No Stock, Aim Assist Laser, 60 Round Mag, Stippled Grip",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "SKS", tier: "GOD", 
                intel: "The marksman's choice. Lethal two-tap potential at any range.",
                specs: "Mip Light, No Stock, Owc Laser, 20 Round Mag, Granulated Grip",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "LW3-TUNDRA", tier: "S", 
                intel: "Elite bolt-action mobility. Best-in-class ADS speed.",
                specs: "Tiger Team Barrel, Bandit Steady Stock, 7 Round Mag, Serpent Wrap",
                image: "YOUR_IMAGE_URL" 
            },
            { 
                name: "RYTEC AMR", tier: "A", 
                intel: "Anti-material power. Ideal for disrupting enemy streaks.",
                specs: "Mip Light Barrel, Owc Skeleton Stock, Owc Laser, Explosive Mag, Stippled Grip",
                image: "YOUR_IMAGE_URL" 
            }
        ];

        // --- EMBED GENERATOR ENGINE ---
        const generateEmbed = (weapon, showSpecs = false) => {
            const embed = new EmbedBuilder()
                .setColor(weapon.tier === 'GOD' ? '#ff0055' : '#00fbff')
                .setAuthor({ name: 'ARCHITECT META INTELLIGENCE', iconURL: client.user.displayAvatarURL() })
                .setTitle(`◈ ARMAMENT: ${weapon.name} ◈`)
                .setDescription(
                    `\`\`\`ansi\n\u001b[1;33m[TIER]:\u001b[0m ${weapon.tier}\n` +
                    `\u001b[1;36m[INTEL]:\u001b[0m ${weapon.intel}\`\`\``
                )
                .setFooter({ text: 'EAGLE COMMUNITY • BKO-223 NODE' })
                .setTimestamp();

            // Adds specialized loadout field if 'VIEW SPECS' is toggled
            if (showSpecs) {
                embed.addFields({ 
                    name: '🛠️ OPTIMIZED LOADOUT SPECS', 
                    value: `\`\`\`fix\n${weapon.specs}\`\`\`` 
                });
            }

            // Only attaches image if a valid URL is provided
            if (weapon.image && weapon.image.startsWith('http')) {
                embed.setImage(weapon.image);
            }
            
            return embed;
        };

        // Selection Logic
        let currentWeapon = metaData[Math.floor(Math.random() * metaData.length)];

        // Button Component Construction
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('reroll')
                .setLabel('RE-ROLL')
                .setEmoji('🎲')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('specs')
                .setLabel('VIEW SPECS')
                .setEmoji('🛠️')
                .setStyle(ButtonStyle.Success)
        );

        const response = await message.reply({
            content: `> **Accessing Eagle Community Armory...**`,
            embeds: [generateEmbed(currentWeapon)],
            components: [buttons]
        });

        // --- INTERACTION COLLECTOR ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 120000 // 2 Minute interaction window
        });

        collector.on('collect', async (i) => {
            // Security Check: Only the original command user can interact
            if (i.user.id !== message.author.id) {
                return i.reply({ content: '⛔ Security Lock: Interaction restricted to authorized agent.', ephemeral: true });
            }

            if (i.customId === 'reroll') {
                currentWeapon = metaData[Math.floor(Math.random() * metaData.length)];
                await i.update({
                    content: `> **New tactical signal acquired. Data updated.**`,
                    embeds: [generateEmbed(currentWeapon, false)],
                    components: [buttons]
                });
            }

            if (i.customId === 'specs') {
                await i.update({
                    content: `> **Displaying full optimization specs for ${currentWeapon.name}...**`,
                    embeds: [generateEmbed(currentWeapon, true)],
                    components: [buttons]
                });
            }
        });

        // Cleanup: Disable buttons after the timeout
        collector.on('end', () => {
            const disabled = new ActionRowBuilder().addComponents(
                buttons.components.map(b => ButtonBuilder.from(b).setDisabled(true))
            );
            response.edit({ components: [disabled] }).catch(() => null);
        });
    }
};
