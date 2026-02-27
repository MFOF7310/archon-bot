module.exports = {
    name: 'clear',
    description: 'Deletes a specific number of messages.',
    async execute(message, args) {
        if (message.author.id !== process.env.OWNER_ID) {
            return message.reply("❌ Restricted: Engine Owner only.");
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('❌ Specify 1-100 messages to delete.');
        }

        await message.channel.bulkDelete(amount, true);
        const reply = await message.channel.send(`🧹 **Purged ${amount} messages.**`);
        setTimeout(() => reply.delete(), 3000); // Auto-delete the success message
    },
};
