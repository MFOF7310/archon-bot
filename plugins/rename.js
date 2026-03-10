module.exports = {
    name: 'rename',
    aliases: ['setname'],
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        const newName = args.join(" ");
        if (!newName) return message.reply("❌ Usage: `.rename [New Name]`");
        if (newName.length > 20) return message.reply("⚠️ Limit: 20 characters.");

        if (!database[message.author.id]) {
            database[message.author.id] = { xp: 0, level: 1, name: message.author.username, gaming: { game: "N/A", rank: "Unranked" }};
        }

        database[message.author.id].name = newName;
        message.reply(`✅ **ID UPDATED:** System identity set to \`${newName}\`.`);
        // Note: Ensure your index.js saves the database to file after this!
    }
};
