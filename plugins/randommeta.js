const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'randommeta',
    aliases: ['meta', 'codm'],
    description: 'Get a random CODM meta weapon loadout',

    async execute(message, args) {
        // Let the user know the bot is thinking
        await message.channel.sendTyping();

        const metaWeapons = [
            {
                name: "AK117",
                description: "🔥 **Tier: S** | High fire rate AR. Best for mid-range dominance.\n**Build:** OWC Marksman, No Stock, OWC Laser, 40 Round Mag, Granulated Grip.",
                image: "https://i.imgur.com/E0B6yI8.png"
            },
            {
                name: "DL Q33",
                description: "🎯 **Tier: S** | The Sniper King. Consistent one-tap potential.\n**Build:** MIP Light Barrel, Combat Stock, OWC Laser, Maevwat Omega Mag.",
                image: "https://i.imgur.com/XqT7pC6.png"
            },
            {
                name: "KRM-262",
                description: "💀 **Tier: A+** | The King of Shotguns. Insane hip-fire accuracy.\n**Build:** Marauder Suppressor, Extended Barrel (+2), No Stock, OWC Laser.",
                image: "https://i.imgur.com/vH3A3X9.png"
            },
            {
                name: "BP50",
                description: "🏆 **Tier: God** | Current Season Meta. Unbeatable TTK.\n**Build:** Silencer Co. Suppressor, Rapid Fire Barrel, Folded Stock, 60 Round Mag.",
                image: "https://i.imgur.com/fL39v3M.png"
            },
            {
                name: "FFAR 1",
                description: "⚡ **Tier: S** | Close-range beast. Shreds through enemies fast.\n**Build:** Agency Suppressor, Task Force Barrel, Raider Stock, 38 Rnd Speed Mag.",
                image: "https://i.imgur.com/uG9Vf9n.png"
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
            // Use reply so the user knows it's for them
            await message.reply({ embeds: [embed] });
        } catch (err) {
            console.error("❌ Meta Command Error:", err.message);
            message.channel.send("⚠️ **Engine Error:** Failed to render the weapon image. Try again.");
        }
    }
};
