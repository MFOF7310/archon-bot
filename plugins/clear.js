module.exports = {
    name: 'clear',
    description: 'Deletes a specific number of messages.',
    async execute(message, args) {
        // Match the ID used in your index.js
        const ARCHITECT_ID = '1284944736620253296';
        if (message.author.id !== ARCHITECT_ID) {
            return message.reply("❌ **Restricted:** Engine Owner only.");
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('❌ Specify **1-100** messages to delete.');
        }

        try {
            // true filters out messages older than 14 days (Discord limitation)
            await message.channel.bulkDelete(amount, true);
            const reply = await message.channel.send(`🧹 **Purged ${amount} messages.**`);
            setTimeout(() => reply.delete().catch(() => null), 3000); 
        } catch (err) {
            message.reply("⚠️ **System Error:** I cannot delete messages older than 14 days.");
        }
    },
};
