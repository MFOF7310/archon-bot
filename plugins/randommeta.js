const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'randommeta',
    aliases: ['meta', 'codm'], // Added aliases for easier use
    description: 'Get a random CODM meta weapon loadout',

    // Match these arguments to your index.js: (message, args, client, model, lydiaChannels, database)
    async execute(message, args) {

        const metaWeapons = [
            {
                name: "AK117",
                description: "🔥 High fire rate AR. Best for mid-range dominance.\n**Attachments:** OWC Marksman, No Stock, OWC Laser, 40 Round Mag, Granulated Grip.",
                image: "https://zilliongamer.com/uploads/codm/weapons/assault-rifle/ak117-cod-mobile.jpg"
            },
            {
                name: "FFAR 1",
                description: "⚡ Close-range beast. Shreds through enemies fast.\n**Attachments:** Agency Suppressor, Task Force Barrel, Raider Stock, 38 Rnd Speed Mag.",
                image: "https://zilliongamer.com/uploads/codm/weapons/assault-rifle/ffar1/ffar1-cod-mobile.jpg"
            },
            {
                name: "KRM-262",
                description: "💀 The King of Shotguns. Insane hip-fire accuracy.\n**Attachments:** Marauder Suppressor, Extended Barrel (+2), No Stock, OWC Laser, Tube Plus.",
                image: "https://zilliongamer.com/uploads/codm/weapons/shotgun/krm-262-cod-mobile.jpg"
            },
            {
                name: "DL Q33",
                description: "🎯 The Sniper King. Consistent one-tap potential.\n**Attachments:** MIP Light Barrel, Combat Stock, OWC Laser, Maevwat Omega Mag.",
                image: "https://zilliongamer.com/uploads/codm/weapons/sniper-rifle/dl-q33-cod-mobile.jpg"
            },
            {
                name: "BP50",
                description: "🏆 Current S-Tier Meta. Unbeatable TTK.\n**Attachments:** Silencer Co. Suppressor, Rapid Fire Barrel, Folded Stock, 60 Round Mag.",
                image: "https://zilliongamer.com/uploads/codm/weapons/assault-rifle/bp50/bp50-cod-mobile.jpg"
            }
        ];

        const randomWeapon = metaWeapons[Math.floor(Math.random() * metaWeapons.length)];

        const embed = new EmbedBuilder()
            .setColor('#f1c40f') // Gold color for Meta
            .setTitle(`🔥 CG-223 | Random META Loadout`)
            .setThumbnail('https://i.imgur.com/B9O08G8.png') // Optional: Small icon
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
