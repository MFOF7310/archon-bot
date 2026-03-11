const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rename',
    aliases: ['setname'],
    description: 'Change your displayed name in the system (max 20 characters).',
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        const newName = args.join(" ");
        if (!newName) return message.reply("❌ Usage: `.rename [New Name]`");
        if (newName.length > 20) return message.reply("⚠️ Limit: 20 characters.");

        // Ensure user entry exists
        if (!database[message.author.id]) {
            database[message.author.id] = { 
                xp: 0, 
                level: 1, 
                name: message.author.username, 
                gaming: { game: "N/A", rank: "Unranked" }
            };
        }

        const oldName = database[message.author.id].name || message.author.username;
        database[message.author.id].name = newName;

        // Persist to file
        client.saveDatabase();

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
            .setTitle('✅ IDENTITY UPDATED')
            .addFields(
                { name: 'Old Designation', value: `\`${oldName}\``, inline: true },
                { name: 'New Designation', value: `\`${newName}\``, inline: true }
            )
            .setFooter({ text: 'Eagle Community • Digital Engine' })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};