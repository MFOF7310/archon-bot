const axios = require("axios");

module.exports = {
    name: 'owner',
    description: 'Executive commands and community links',
    async execute(message, args, client) {
        
        // Pulls the Owner ID from your .env file
        const ownerId = process.env.OWNER_ID;

        // Security check: Match the message author with the ID in .env
        if (message.author.id !== ownerId) {
            return message.reply("⚠️ This command is reserved for the bot owner.");
        }

        const subCommand = args[0]?.toLowerCase();

        // Subcommand: !owner social
        if (subCommand === 'social') {
            const supportLink = process.env.SUPPORT_LINK || "No link set in .env";
            return message.reply(`🌐 **Join our community:** ${supportLink}`);
        }

        // Subcommand: !owner restart
        if (subCommand === 'restart') {
            await message.reply("🔄 Restarting the container...");
            process.exit(); // Pterodactyl will auto-reboot the bot
        }

        // Default help message for the owner
        message.reply("🛠️ **Owner Menu:** Use `!owner social` or `!owner restart`.");
    }
};
