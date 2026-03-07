const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'randommeta',
    description: 'Get a random CODM meta weapon loadout',

    async execute(message) {

        const metaWeapons = [

            {
                name: "AK117",
                description: "🔥 Current meta AR with strong recoil control and fast TTK.",
                image: "YOUR_AK117_IMAGE_LINK"
            },

            {
                name: "FFAR1",
                description: "⚡ Extremely fast fire rate AR dominating close-mid range fights.",
                image: "YOUR_FFAR1_IMAGE_LINK"
            },

            {
                name: "BY15",
                description: "💀 One-tap shotgun build perfect for aggressive rush players.",
                image: "YOUR_BY15_IMAGE_LINK"
            },

            {
                name: "KRM",
                description: "🎯 Deadly close range shotgun with insane hip-fire accuracy.",
                image: "YOUR_KRM_IMAGE_LINK"
            },

            {
                name: "DLQ33",
                description: "🎯 Legendary sniper loadout perfect for quickscoping.",
                image: "YOUR_DLQ_IMAGE_LINK"
            }

        ];

        const randomWeapon = metaWeapons[Math.floor(Math.random() * metaWeapons.length)];

        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(`🔥 Random META Loadout`)
            .addFields(
                { name: "Weapon", value: randomWeapon.name },
                { name: "Build", value: randomWeapon.description }
            )
            .setImage(randomWeapon.image)
            .setFooter({ text: 'CODM Meta Generator' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    }
};