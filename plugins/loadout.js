const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'loadout',
    description: 'Displays the best CODM loadout for a specific weapon.',
    aliases: ['build', 'class'],

    async execute(message, args) {
        if (!args.length) {
            return message.reply({
                content: "❌ **Missing Weapon Name!**\nUsage: `,loadout <name>`\nExample: `,loadout HS0405`\n\n**Available:** `AK117`, `FFAR1`, `HS0405`, `KRM`, `DLQ`"
            });
        }

        let weapon = args[0].toUpperCase();
        // Fuzzy search fixes
        if (weapon === "DLQ33") weapon = "DLQ";
        if (weapon === "KRM262") weapon = "KRM";
        if (weapon === "HS0") weapon = "HS0405";
        if (weapon === "HS") weapon = "HS0405";

        const loadouts = {
            "AK117": {
                title: "AK117 - Tactical Precision",
                description: "🔥 **Meta Build:** OWC Marksman, No Stock, OWC Laser, 40 Round Mag, Granulated Grip.",
                image: "PASTE_YOUR_DISCORD_LINK_HERE"
            },
            "FFAR1": {
                title: "FFAR 1 - Rapid Shredder",
                description: "⚡ **Meta Build:** Agency Suppressor, Task Force Barrel, Raider Stock, 38 Rnd Speed Mag, Serpent Wrap.",
                image: "PASTE_YOUR_DISCORD_LINK_HERE"
            },
            "HS0405": {
                title: "HS0405 - One-Tap Specialist",
                description: "💀 **Meta Build:** Choke, RTC Extended Light Barrel, No Stock, OWC Laser - Tactical, Granulated Grip Tape.\n*High damage and mobility for the ultimate rush.*",
                image: "PASTE_YOUR_DISCORD_LINK_HERE"
            },
            "KRM": {
                title: "KRM-262 - Hipfire King",
                description: "🎯 **Meta Build:** Marauder Suppressor, Extended Barrel (+2), No Stock, OWC Laser, Tube Plus.",
                image: "PASTE_YOUR_DISCORD_LINK_HERE"
            },
            "DLQ": {
                title: "DL Q33 - Legendary Sniper",
                description: "🎯 **Meta Build:** MIP Light Barrel, Combat Stock, OWC Laser, Maevwat Omega Mag, FMJ.",
                image: "PASTE_YOUR_DISCORD_LINK_HERE"
            }
        };

        const data = loadouts[weapon];

        if (!data) {
            return message.reply(`⚠️ **Engine Alert:** Weapon \`${weapon}\` is not in the database. Use: \`AK117, FFAR1, HS0405, KRM, DLQ\``);
        }

        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle(`🔫 ${data.title}`)
            .setDescription(data.description)
            .setImage(data.image) 
            .setFooter({ text: 'Digital Engine Loadout System | Mali 🇲🇱' })
            .setTimestamp();

        try {
            await message.channel.sendTyping();
            await message.reply({ embeds: [embed] });
        } catch (err) {
            console.error("❌ Loadout Error:", err.message);
        }
    }
};
