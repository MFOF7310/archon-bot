const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'loadout',
    description: 'Display elite weapon configurations and intelligence.',
    aliases: ['build', 'class'],
    category: 'GAMING',
    run: async (client, message, args, database) => {
        if (!args.length) {
            return message.reply(`❌ **Usage:** \`.loadout <weapon_name>\` (e.g., AK117, QQ9)`);
        }

        let weapon = args[0].toUpperCase();
        
        // --- WEAPON DATABASE ---
        const loadouts = {
            "AK117": { 
                title: "AK117 - TACTICAL RELIABILITY", 
                build: "OWC Marksman, No Stock, OWC Laser, 40 Rnd, Granulated Grip.",
                desc: "Dominate mid-range with high fire rate and laser-like accuracy.",
                image: "LINK_HERE" 
            },
            "FFAR1": { 
                title: "FFAR 1 - CLOSE-QUARTERS SHREDDER", 
                build: "Agency Suppressor, Task Force Barrel, Raider Stock, Speed Mag.",
                desc: "High mobility and aggressive fire rate. Built for front-line assault.",
                image: "LINK_HERE" 
            },
            "HS0405": { 
                title: "HS0405 - ONE-TAP DOMINANCE", 
                build: "Choke, Extended Barrel, No Stock, OWC Laser, Granulated Grip.",
                desc: "Extreme damage output. High-risk, high-reward shotgun play.",
                image: "LINK_HERE" 
            },
            "KRM": { 
                title: "KRM-262 - SLIDING ASSASSIN", 
                build: "Marauder Suppressor, Extended Barrel, No Stock, OWC Laser, Speed Up After Kill.",
                desc: "Perfect for hip-fire mobility and consistent one-shot kills.",
                image: "LINK_HERE" 
            },
            "DLQ": { 
                title: "DL Q33 - LEGENDARY PRECISION", 
                build: "MIP Light Barrel, Combat Stock, OWC Laser, Omega Mag, FMJ.",
                desc: "The gold standard for snipers. Maximum ADS speed and wall-bang potential.",
                image: "LINK_HERE" 
            },
            "RYTEC": { 
                title: "RYTEC AMR - ANTI-MATERIAL RIFLE", 
                build: "Configuration Pending...",
                desc: "Heavy-duty firepower. Capable of explosive or thermite payload utility.",
                image: "LINK_HERE" 
            },
            "TUNDRA": { 
                title: "LW3-TUNDRA - MODERN SNIPING", 
                build: "Configuration Pending...",
                desc: "Elite mobility for aggressive sniping and quick-scope maneuvers.",
                image: "LINK_HERE" 
            },
            "QQ9": { 
                title: "QQ9 - SUB-MACHINE AGILITY", 
                build: "Configuration Pending...",
                desc: "Ultimate strafe speed and fire rate. Dominates close-range encounters.",
                image: "LINK_HERE" 
            },
            "MG42": { 
                title: "MG42 - SUPPRESSIVE FIRE", 
                build: "Configuration Pending...",
                desc: "Infinite lead. Designed to hold lanes and suppress entire squads.",
                image: "LINK_HERE" 
            },
            "FENNEC": { 
                title: "FENNEC - VELOCITY STRIKE", 
                build: "Configuration Pending...",
                desc: "The fastest fire rate in the node. Melt targets before they can react.",
                image: "LINK_HERE" 
            }
        };

        const data = loadouts[weapon];
        if (!data) return message.reply(`⚠️ Weapon profile for \`${weapon}\` not found in the armory.`);

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`🔫 ${data.title}`)
            .addFields(
                { name: '🛠️ BUILD', value: `\`${data.build}\`` },
                { name: '📋 INTEL', value: `*${data.desc}*` }
            )
            .setFooter({ text: 'Eagle Community | Loadout Intelligence' })
            .setTimestamp();

        if (data.image && data.image !== "LINK_HERE") {
            embed.setImage(data.image);
        }

        await message.reply({ embeds: [embed] });
    }
};