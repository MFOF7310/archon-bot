module.exports = {
    name: 'clear',
    async execute(message, args) {
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply("❌ You don't have permission to clear messages!");
        }
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply("❌ Provide a number between 1 and 100.");
        }
        await message.channel.bulkDelete(amount + 1, true);
        const msg = await message.channel.send(`✅ Cleared **${amount}** messages.`);
        setTimeout(() => msg.delete(), 3000);
    }
};
