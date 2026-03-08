module.exports = {
    name: 'clear',
    aliases: ['purge', 'clean', 'CLEAR'], // Added uppercase alias
    description: 'Deep-cleaning for all message types including system alerts.',

    async execute(message, args) {
        // 1. Permission Check
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has('ManageMessages');
        if (!isArchitect && !hasPerms) return;

        // 2. Immediate Cleanup of the trigger command
        await message.delete().catch(() => null);

        // 3. Setup Target and Amount
        const targetUser = message.mentions.users.first();
        const amountArg = targetUser ? args[1] : args[0];
        let amount = (args[0]?.toLowerCase() === 'all') ? 100 : parseInt(amountArg);

        if (isNaN(amount) || amount < 1) amount = 100; // Default to 100 if no number provided

        try {
            let messagesToDelete = [];
            let lastId = message.id;

            // 4. THE DEEP SCAN (Crucial for your screenshot)
            // We loop because your messages are spread across different dates
            while (messagesToDelete.length < amount) {
                const fetched = await message.channel.messages.fetch({ limit: 100, before: lastId });
                if (fetched.size === 0) break;

                const filtered = fetched.filter(m => {
                    const isNotPinned = !m.pinned;
                    const isRecent = (Date.now() - m.createdTimestamp) < 1209600000;
                    
                    // Specific logic for mentioned user OR general purge
                    const matchesTarget = targetUser ? m.author.id === targetUser.id : true;

                    return isNotPinned && isRecent && matchesTarget;
                });

                messagesToDelete.push(...filtered.values());
                lastId = fetched.last().id;

                // Break if we have enough or we've hit the end of the channel
                if (messagesToDelete.length >= amount || fetched.size < 100) break;
            }

            // 5. Execution
            const finalBatch = messagesToDelete.slice(0, amount);
            
            if (finalBatch.length > 0) {
                const deleted = await message.channel.bulkDelete(finalBatch, true);
                
                // Temporary feedback message
                const reply = await message.channel.send(`✨ **Sanitized:** Removed **${deleted.size}** items from history.`);
                setTimeout(() => reply.delete().catch(() => null), 3000);
            } else {
                const noFound = await message.channel.send("⚠️ **No deletable messages found.** (Pinned or >14 days old)");
                setTimeout(() => noFound.delete().catch(() => null), 4000);
            }

        } catch (err) {
            console.error("Purge Error:", err);
        }
    },
};
