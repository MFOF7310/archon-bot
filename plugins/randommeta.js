const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'randommeta',
    aliases: ['meta', 'codm'],
    description: 'Get a random CODM meta weapon loadout',

    async execute(message, args) {

        const metaWeapons = [
            {
                name: "AK117",
                description: "🔥 **Tier: S** | High fire rate AR. Best for mid-range dominance.\n**Build:** OWC Marksman, No Stock, OWC Laser, 40 Round Mag, Granulated Grip.",
                image: "https://static.wikia.nocookie.net/callofduty/images/5/5e/AK117_Menu_Icon_CODM.png"
            },
            {
                name: "DL Q33",
                description: "🎯 **Tier: S** | The Sniper King. Consistent one-tap potential.\n**Build:** MIP Light Barrel, Combat Stock, OWC Laser, Maevwat Omega Mag.",
                image: "https://static.wikia.nocookie.net/callofduty/images/d/d3/DL_Q33_Menu_Icon_CODM.png"
            },
            {
                name: "KRM-262",
                description: "💀 **Tier: A+** | The King of Shotguns. Insane hip-fire accuracy.\n**Build:** Marauder Suppressor, Extended Barrel (+2), No Stock, OWC Laser.",
                image: "https://static.wikia.nocookie.net/callofduty/images/3/30/KRM-262_Menu_Icon_CODM.png"
            },
            {
                name: "BP50",
                description: "🏆 **Tier: God** | Current Season Meta. Unbeatable TTK.\n**Build:** Silencer Co. Suppressor, Rapid Fire Barrel, Folded Stock, 60 Round Mag.",
                image: "https://static.wikia.nocookie.net/callofduty/images/f/f7/BP50_Menu_Icon_CODM.png"
            },
            {
                name: "FFAR 1",
                description: "⚡ **Tier: S** | Close-range beast. Shreds through enemies fast.\n**Build:** Agency Suppressor, Task Force Barrel, Raider Stock, 38 Rnd Speed Mag.",
                image: "https://static.wikia.nocookie.net/callofduty/images/c/c5/FFAR_1_Menu_Icon_CODM.png"
            }
        ];

        const randomWeapon = metaWeapons[Math.floor(Math.random() * metaWeapons.length)];

        const embed = new EmbedBuilder()
            .setColor('#f1c40f') 
            .setTitle(`🔥 CG-223 | Random META Loadout`)
            .addFields(
                { name: "Weapon Model", value: `**${randomWeapon.name}**`, inline: true },
                { name: "Build Details", value: randomWeapon.description }
            )
            .setImage(randomWeapon.image)
            .setFooter({ text: 'Digital Engine Meta Generator | Mali 🇲🇱' })
            .setTimestamp();

        try {
            await message.reply({ embeds: [embed] });
        } catch (err) {
            console.error("❌ Meta Command Error:", err.message);
        }
    }
};
