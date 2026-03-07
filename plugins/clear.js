module.exports = {
    name: 'clear',
    description: 'Delete messages with admin logging.',

    async execute(message, args) {
        const ARCHITECT_ID = process.env.OWNER_ID;
        const isArchitect = message.author.id === ARCHITECT_ID;
        const isAdmin = message.member.permissions.has('Administrator');

        // Permission Check
        if (!isArchitect && !isAdmin) {
            const noPerms = await message.reply("❌ **Restricted:** Engine Owner or Admin only.");
            return setTimeout(() => noPerms.delete().catch(() => null), 5000);
        }

        let totalDeleted = 0;
        const targetChannel = message.channel;

        // --- EXECUTION LOGIC ---
        try {
            if (args[0] === 'all') {
                let deleted;
                do {
                    deleted = await targetChannel.bulkDelete(100, true);
                    totalDeleted += deleted.size;
                } while (deleted.size >= 2);
            } else {
                const amount = parseInt(args[0]);
                if (isNaN(amount) || amount < 1 || amount > 200) {
                    const usage = await message.reply('❌ Usage: `!clear 1-200` or `!clear all`.');
                    return setTimeout(() => usage.delete().catch(() => null), 5000);
                }
                
                let remaining = amount;
                while (remaining > 0) {
                    const deleteAmount = remaining > 100 ? 100 : remaining;
                    const deletedBatch = await targetChannel.bulkDelete(deleteAmount, true);
                    totalDeleted += deletedBatch.size;
                    remaining -= deleteAmount;
                }
            }

            // --- SUCCESS MESSAGE ---
            const successMsg = await targetChannel.send(`🧹 **Purged ${totalDeleted} messages.**`);
            setTimeout(() => successMsg.delete().catch(() => null), 3000);

            // --- LOGGING FEATURE ---
            // Finds a channel named 'bot-logs' in the server
            const logChannel = message.guild.channels.cache.find(ch => ch.name === 'bot-logs');
            
            if (logChannel) {
                logChannel.send({
                    content: `🛡️ **Audit Log: Message Purge**\n**Action by:** ${message.author.tag}\n**Channel:** ${targetChannel}\n**Amount:** ${totalDeleted} messages\n**Type:** ${args[0] === 'all' ? 'Nuclear (All)' : 'Manual'}`
                });
            }

        } catch (err) {
            console.error(err);
            message.reply("⚠️ **Error:** Check permissions or message age (14-day limit).");
        }
    },
};
