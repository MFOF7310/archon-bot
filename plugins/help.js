const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Displays the full list of Digital Engine modules categorized by type.',
    async execute(message, args, client) {
        const { commands } = client;
        const prefix = process.env.PREFIX || ',';

        // 1. Create the base Embed
        const helpEmbed = new EmbedBuilder()
            .setColor('#2ecc71') // Success Green
            .setTitle('🎮 CLOUD GAMING-223 | COMMAND CENTER')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`**Digital Engine V2.5** is active.\nTotal Modules Synchronized: **${commands.size}**\n\nUse \`${prefix}command\` to execute.`)
            .setFooter({ text: 'Optimized for West Africa | Bamako 🇲🇱' })
            .setTimestamp();

        // 2. Organize commands by Category
        // We use an object to group them: { 'Moderation': ['ban', 'kick'], 'Utility': ['ping'] }
        const categories = {};

        commands.forEach(cmd => {
            const cat = cmd.category || 'General'; // Defaults to General if no category is set
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(`\`${cmd.name}\``);
        });

        // 3. Add a field for each category to the embed
        for (const [category, commandList] of Object.entries(categories)) {
            helpEmbed.addFields({
                name: `📁 ${category}`,
                value: commandList.join(', '), // List them side-by-side
                inline: false
            });
        }

        // 4. Send the response
        try {
            await message.reply({ embeds: [helpEmbed] });
        } catch (error) {
            console.error("Help Command Error:", error);
            message.channel.send("❌ Error displaying the help menu.");
        }
    },
};
