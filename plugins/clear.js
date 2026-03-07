module.exports = {
    name: 'clear',
    description: 'Delete messages (1-200 or all).',

    async execute(message, args) {
        
        // This pulls the ID dynamically from the environment variables
        const ARCHITECT_ID = process.env.OWNER_ID;

        if (message.author.id !== ARCHITECT_ID) {
            return message.reply("❌ **Restricted:** Engine Owner only.");
        }

        // --- OPTION 1: Delete Everything ---
        if (args[0] === 'all') {
            try {
                let deleted;
                do {
                    deleted = await message.channel.bulkDelete(100, true);
                } while (deleted.size >= 2);

                const reply = await message.channel.send(`🧹 **All messages cleared.**`);
                setTimeout(() => reply.delete().catch(() => null), 3000);
            } catch (err) {
                message.reply("⚠️ **System Error:** Some messages are older than 14 days (Discord limitation).");
            }
            return;
        }

        // --- OPTION 2: Delete specific amount (1-200) ---
        const amount = parseInt(args[0]);

        if (isNaN(amount) || amount < 1 || amount > 200) {
            return message.reply('❌ Specify **1-200** messages or type **clear all**.');
        }

        try {
            let remaining = amount;
            while (remaining > 0) {
                const deleteAmount = remaining > 100 ? 100 : remaining;
                await message.channel.bulkDelete(deleteAmount, true);
                remaining -= deleteAmount;
            }

            const reply = await message.channel.send(`🧹 **Purged ${amount} messages.**`);
            setTimeout(() => reply.delete().catch(() => null), 3000);
        } catch (err) {
            message.reply("⚠️ **System Error:** Cannot delete messages older than 14 days.");
        }
    },
};
