const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'randommeta',
    aliases: ['meta', 'codm'],
    description: 'Get a random CODM meta weapon loadout',
    run: async (client, message, args, database) => {
        const metaWeapons = [
            { name: "AK117", description: "🔥 **Tier: S** | Build: OWC Marksman, No Stock, OWC Laser, 40 Round Mag, Granulated Grip." },
            { name: "DL Q33", description: "🎯 **Tier: S** | Build: MIP Light Barrel, Combat Stock, OWC Laser, Maevwat Omega Mag." },
            { name: "HS0405", description: "💀 **Tier: A+** | Build: Choke, RTC Extended Light Barrel, No Stock, OWC Laser, Granulated Grip." },
            { name: "BP50", description: "🏆 **Tier: God** | Build: Silencer Co. Suppressor, Rapid Fire Barrel, Folded Stock, 60 Round Mag." },
            { name: "FFAR 1", description: "⚡ **Tier: S** | Build: Agency Suppressor, Task Force Barrel, Raider Stock, 38 Rnd Speed Mag." }
        ];

        const randomWeapon = metaWeapons[Math.floor(Math.random() * metaWeapons.length)];
        const embed = new EmbedBuilder()
            .setColor('#f1c40f') 
            .setTitle(`🎲 Random Loadout: ${randomWeapon.name}`)
            .setDescription(randomWeapon.description)
            .setFooter({ text: 'Digital Engine | CG-223 Meta' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};
