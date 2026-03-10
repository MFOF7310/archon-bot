const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'randommeta',
    aliases: ['meta', 'codm', 'pick'],
    category: 'GAMING',
    description: 'System-selected meta weapon intelligence with visual data.',
    run: async (client, message, args, database) => {
        const metaWeapons = [
            { 
                name: "AK117", 
                intel: "🔥 **Tier: S** | The undisputed king of versatility. High fire rate and aggressive TTK.",
                image: "LINK_HERE" 
            },
            { 
                name: "DL Q33", 
                intel: "🎯 **Tier: S** | The sniper's standard. Unmatched consistency and wall-penetration.",
                image: "LINK_HERE" 
            },
            { 
                name: "HS0405", 
                intel: "💀 **Tier: A+** | Devastating one-tap potential for players with elite movement.",
                image: "LINK_HERE" 
            },
            { 
                name: "BP50", 
                intel: "🏆 **Tier: GOD** | Current peak performance. Fire rate exceeds standard reaction times.",
                image: "LINK_HERE" 
            },
            { 
                name: "FFAR 1", 
                intel: "⚡ **Tier: S** | Aggressive strafe speeds. Behaves like an SMG with rifle range.",
                image: "LINK_HERE" 
            },
            { 
                name: "RYTEC AMR", 
                intel: "💣 **Tier: A** | Anti-material power. Ideal for disrupting enemy streaks.",
                image: "LINK_HERE" 
            },
            { 
                name: "QQ9", 
                intel: "🏃 **Tier: S** | The agility meta. Designed for ultra-fast ADS maneuvers.",
                image: "LINK_HERE" 
            },
            { 
                name: "DR-H", 
                intel: "🩸 **Tier: S** | Heavy hitter. Rewards accuracy with a lethal three-tap potential.",
                image: "LINK_HERE" 
            },
            { 
                name: "SKS", 
                intel: "🏹 **Tier: GOD** | The marksman's choice. Lethal two-tap potential at any range for disciplined players.",
                image: "LINK_HERE" 
            },
            { 
                name: "LW3-TUNDRA", 
                intel: "❄️ **Tier: S** | Elite bolt-action mobility. Best-in-class ADS speed for aggressive snipers.",
                image: "LINK_HERE" 
            }
        ];

        const randomWeapon = metaWeapons[Math.floor(Math.random() * metaWeapons.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#f1c40f') 
            .setAuthor({ name: 'ARCHITECT META RECOMMENDATION', iconURL: client.user.displayAvatarURL() })
            .setTitle(`🎲 SELECTED: ${randomWeapon.name}`)
            .setDescription(`${randomWeapon.intel}\n\n*Execute \`.loadout ${randomWeapon.name}\` for full specs.*`)
            .setFooter({ text: 'Eagle Community | Digital Engine Intelligence' })
            .setTimestamp();

        if (randomWeapon.image && randomWeapon.image !== "LINK_HERE") {
            embed.setImage(randomWeapon.image);
        }

        await message.reply({ embeds: [embed] });
    }
};
