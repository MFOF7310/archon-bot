module.exports = {
    name: 'rename',
    aliases: ['setname', 'nick'],
    async execute(message, args, client, model, lydiaChannels, database) {
        const newName = args.join(" ");
        if (!newName) return message.reply("❌ Please provide a new name. Usage: `,rename [New Name]`");
        if (newName.length > 20) return message.reply("⚠️ Name is too long! Keep it under 20 characters.");

        // Update the database
        database[message.author.id].name = newName;
        
        message.reply(`✅ **ID UPDATED:** Your system identity is now set to \`${newName}\`.`);
    }
};
