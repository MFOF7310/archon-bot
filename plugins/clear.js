module.exports = {
    name: 'clear',
    aliases: ['purge', 'clean', 'CLEAR'],
    description: 'Deep-cleaning for all message types.',
    run: async (client, message, args, database) => {
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has('ManageMessages');
        if (!isArchitect && !hasPerms) return;

        await message.delete().catch(() => null);

        const targetUser = message.mentions.users.first();
        const amountArg = targetUser ? args[1] : args[0];
        let amount = (args[0]?.toLowerCase() === 'all') ? 100 : parseInt(amountArg);

        if (isNaN(amount) || amount < 1) amount = 100;

        try {
            let messagesToDelete = [];
            let lastId = message.id;

            while (messagesToDelete.length < amount) {
                const fetched = await message.channel.messages.fetch({ limit: 100, before: lastId });
                if (fetched.size === 0) break;

                const filtered = fetched.filter(m => {
                    const isNotPinned = !m.pinned;
                    const isRecent = (Date.now() - m.createdTimestamp) < 1209600000;
                    const matchesTarget = targetUser ? m.author.id === targetUser.id : true;
                    return isNotPinned && isRecent && matchesTarget;
                });

                messagesToDelete.push(...filtered.values());
                lastId = fetched.last().id;
                if (messagesToDelete.length >= amount || fetched.size < 100) break;
            }

            const finalBatch = messagesToDelete.slice(0, amount);
            
            if (finalBatch.length > 0) {
                const deleted = await message.channel.bulkDelete(finalBatch, true);
                const reply = await message.channel.send(`✨ **Sanitized:** Removed **${deleted.size}** items.`);
                setTimeout(() => reply.delete().catch(() => null), 3000);
            } else {
                const noFound = await message.channel.send("⚠️ **No deletable messages found.**");
                setTimeout(() => noFound.delete().catch(() => null), 4000);
            }
        } catch (err) {
            console.error("Purge Error:", err);
        }
    },
};
