const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'loadout',
    description: 'Displays the best loadout for a specific weapon.',
    async execute(message, args) {
        // Check if an argument was provided
        if (!args[0]) {
            return message.reply("❌ Please specify a weapon: `AK117`, `BY15`, or `KRM`.");
        }

        // Convert input to uppercase to avoid case-sensitivity issues
        const weapon = args[0].toUpperCase();

        // Loadout Database (Replace the links with your actual image URLs)
        const loadouts = {
            'AK117': {
                description: "A versatile high-stability loadout optimized for mid-range dominance.",
                image: "YOUR_IMAGE_LINK_FOR_AK117"
            },
            'BY15': {
                description: "High-mobility configuration designed for quick 'One-tap' aggressive playstyles.",
                image: "YOUR_IMAGE_LINK_FOR_BY15"
            },
            'KRM': {
                description: "The ultimate close-quarters build for maximum damage and hip-fire accuracy.",
                image: "YOUR_IMAGE_LINK_FOR_KRM"
            }
        };

        const data = loadouts[weapon];

        // If the weapon is not in our list
        if (!data) {
            return message.reply("⚠️ Unknown weapon. Available options: `AK117`, `BY15`, or `KRM`.");
        }

        // Creating the Digital Engine styled Embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🛠️ Loadout Profile: ${weapon}`)
            .setDescription(data.description)
            .setImage(data.image) // The weapon image will be displayed here
            .setFooter({ text: 'Digital Engine Loadout System' })
            .setTimestamp();

        // Send the embed to the channel
        await message.channel.send({ embeds: [embed] });
    },
};
