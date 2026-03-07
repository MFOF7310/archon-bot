const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'list',
    description: 'Dynamically lists all installed engine modules',
    async execute(message, args, client) {
        // Use a Map to filter out duplicates (so aliases don't show up twice)
        const uniqueCommands = [...new Map(client.commands.map(cmd => [cmd.name, cmd])).values()];

        const embed = new EmbedBuilder()
            .setColor('#36ced1')
            .setTitle('🛰️ DIGITAL ENGINE | ACTIVE MODULES')
            .setDescription(`Currently running **${uniqueCommands.length}** synchronized plugins.`)
            .setThumbnail(client.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: 'System scan complete. All modules operational.' });

        // Build the fields array first
        const fields = uniqueCommands.map(cmd => ({
            name: `🔹 ,${cmd.name}`,
            // Ensure description is NEVER empty (Discord will crash otherwise)
            value: cmd.description || 'No description provided.',
            inline: false
        }));

        // Add all fields at once
        embed.addFields(fields);

        try {
            await message.reply({ embeds: [embed] });
        } catch (err) {
            console.error("❌ List Command Error:", err.message);
            message.reply("⚠️ **Engine Error:** Could not generate the module list.");
        }
    },
};
