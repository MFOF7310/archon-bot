const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'randommeta',
    aliases: ['meta', 'codm'],
    description: 'Get a random CODM meta weapon loadout',

    async execute(message, args) {
        await message.channel.sendTyping();

        const metaWeapons = [
            {
                name: "AK117",
                description: "🔥 **Tier: S** | High fire rate AR. Best for mid-range dominance.\n**Build:** OWC Marksman, No Stock, OWC Laser, 40 Round Mag, Granulated Grip.",
                image: "PASTE_YOUR_AK117_DISCORD_LINK_HERE"
            },
            {
                name: "DL Q33",
                description: "🎯 **Tier: S** | The Sniper King. Consistent one-tap potential.\n**Build:** MIP Light Barrel, Combat Stock, OWC Laser, Maevwat Omega Mag.",
                image: "PASTE_YOUR_DLQ_DISCORD_LINK_HERE"
            },
            {
                name: "HS0405",
                description: "💀 **Tier: A+** | The One-Tap King. Movement player's favorite.\n**Build:** Choke, RTC Extended Light Barrel, No Stock, OWC Laser, Granulated Grip Tape.",
                image: "PASTE_YOUR_HS0_DISCORD_LINK_HERE"
            },
            {
                name: "BP50",
                description: "🏆 **Tier: God** | Current Season Meta. Unbeatable TTK.\n**Build:** Silencer Co. Suppressor, Rapid Fire Barrel, Folded Stock, 60 Round Mag.",
                image: "PASTE_YOUR_BP50_DISCORD_LINK_HERE"
            },
            {
                name: "FFAR 1",
                description: "⚡ **Tier: S** | Close-range beast. Shreds through enemies fast.\n**Build:** Agency Suppressor, Task Force Barrel, Raider Stock, 38 Rnd Speed Mag.",
                image: "PASTE_YOUR_FFAR_DISCORD_LINK_HERE"
            }
        ];

        const randomWeapon = metaWeapons[Math.floor(Math.random() * metaWeapons.length)];

        // Safety: If you haven't pasted a link yet, it uses a placeholder so it doesn't break
        const finalImage = randomWeapon.image.startsWith("http") ? randomWeapon.image : "https://i.imgur.com/B9O08G8.png";

        const embed = new EmbedBuilder()
            .setColor('#f1c40f') 
            .setTitle(`🎲 Random Loadout: ${randomWeapon.name}`)
            .setDescription(randomWeapon.description)
            .setImage(finalImage)
            .setFooter({ text: 'Digital Engine | CG-223 Meta' })
            .setTimestamp();

        try {
            await message.reply({ embeds: [embed] });
        } catch (err) {
            console.error("❌ Meta Error:", err.message);
        }
    }
};
