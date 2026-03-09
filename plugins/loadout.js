const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'loadout',
    description: 'Displays the best CODM loadout.',
    aliases: ['build', 'class'],
    run: async (client, message, args, database) => {
        const prefix = process.env.PREFIX || ",";
        if (!args.length) {
            return message.reply(`❌ **Usage:** \`${prefix}loadout <name>\` (e.g., AK117, DLQ)`);
        }

        let weapon = args[0].toUpperCase();
        const loadouts = {
            "AK117": { title: "AK117 - Tactical", description: "🔥 **Meta:** OWC Marksman, No Stock, OWC Laser, 40 Rnd, Granulated." },
            "FFAR1": { title: "FFAR 1 - Shredder", description: "⚡ **Meta:** Agency Suppressor, Task Force, Raider Stock, Speed Mag." },
            "HS0405": { title: "HS0405 - One-Tap", description: "💀 **Meta:** Choke, Extended Barrel, No Stock, OWC Laser, Granulated." },
            "KRM": { title: "KRM-262 - Hipfire", description: "🎯 **Meta:** Marauder Suppressor, Extended Barrel, No Stock, OWC Laser." },
            "DLQ": { title: "DL Q33 - Sniper", description: "🎯 **Meta:** MIP Light, Combat Stock, OWC Laser, Omega Mag, FMJ." }
        };

        const data = loadouts[weapon];
        if (!data) return message.reply(`⚠️ Weapon \`${weapon}\` not found.`);

        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle(`🔫 ${data.title}`)
            .setDescription(data.description)
            .setFooter({ text: 'Eagle Loadout System' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};
