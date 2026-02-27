const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'clear',
    description: 'Deletes a specific number of messages (up to 100).',
    async execute(message, args) {
        // 1. SECURITY: Check if user has permission to manage messages
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply("❌ You don't have permission to clear messages.");
        }

        // 2. GET AMOUNT
        const amount = parseInt(args[0]);

        if (isNaN(amount) || amount <= 0 || amount > 100) {
            return message.reply("❌ Please provide a number between 1 and 100.");
        }

        try {
            // Delete the messages
            const deleted = await message.channel.bulkDelete(amount, true);
            
            // Send a temporary success message
            const reply = await message.channel.send(`✅ Successfully cleared **${deleted.size}** messages.`);
            
            // Delete the success message after 3 seconds to keep it clean
            setTimeout(() => reply.delete(), 3000);

        } catch (error) {
            console.error(error);
            message.reply("❌ I can only delete messages that are less than 14 days old.");
        }
    },
};
