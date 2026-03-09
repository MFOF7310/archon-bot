module.exports = {
    name: 'rename',
    aliases: ['setname', 'nick'],
    description: 'Updates your system identity name in the database.',
    run: async (client, message, args, database) => {
        const newName = args.join(" ");
        if (!newName) return message.reply("❌ Please provide a new name. Usage: `,rename [New Name]`");
        if (newName.length > 20) return message.reply("⚠️ Name is too long! Keep it under 20 characters.");

        if (!database[message.author.id]) {
            database[message.author.id] = { xp: 0, level: 1, name: message.author.username, gaming: { game: "N/A", rank: "Unranked", stats: "N/A" } };
        }

        database[message.author.id].name = newName;
        message.reply(`✅ **ID UPDATED:** Your system identity is now set to \`${newName}\`.`);
    }
};
