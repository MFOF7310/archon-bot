const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'loadout',
    description: 'Shows the best CODM loadout for a weapon',

    async execute(message, args) {

        if (!args.length) {
            return message.reply(
                "❌ Please specify a weapon.\n\nAvailable weapons:\n`AK117` `FFAR1` `BY15` `KRM` `DLQ`"
            );
        }

        const weapon = args[0].toUpperCase();

        const loadouts = {

            AK117: {
                description: "🔥 Meta AR build with strong recoil control and fast ADS.",
                image: "YOUR_AK117_IMAGE_LINK"
            },

            FFAR1: {
                description: "⚡ Extremely fast fire rate AR dominating close-mid range fights.",
                image: "YOUR_FFAR1_IMAGE_LINK"
            },

            BY15: {
                description: "💀 One-tap shotgun setup built for aggressive rushing.",
                image: "YOUR_BY15_IMAGE_LINK"
            },

            KRM: {
                description: "🎯 Deadly close-range shotgun with insane hipfire accuracy.",
                image: "YOUR_KRM_IMAGE_LINK"
            },

            DLQ: {
                description: "🎯 Legendary sniper loadout perfect for quickscoping.",
                image: "YOUR_DLQ_IMAGE_LINK"
            }
        };

        const data = loadouts[weapon];

        if (!data) {
            return message.reply(
                "⚠️ Unknown weapon.\n\nAvailable weapons:\n`AK117` `FFAR1` `BY15` `KRM` `DLQ`"
            );
        }

        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle(`🔫 ${weapon} Best Loadout`)
            .setDescription(data.description)
            .setImage(data.image)
            .setFooter({ text: 'CODM Loadout System' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    }
};