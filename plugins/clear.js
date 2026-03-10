module.exports = {
    name: 'clear',
    aliases: ['purge', 'clean'],
    description: 'Sanitizes the channel history.',
    run: async (client, message, args, database) => {
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has('ManageMessages');
        if (!isArchitect && !hasPerms) return message.reply("❌ Authority insufficient.");

        await message.delete().catch(() => null);

        const targetUser = message.mentions.users.first();
        const amountArg = targetUser ? args[1] : args[0];
        let amount = (args[0]?.toLowerCase() === 'all') ? 100 : parseInt(amountArg);

        if (isNaN(amount) || amount < 1) amount = 10;

        try {
            let messagesToDelete = [];
            const fetched = await message.channel.messages.fetch({ limit: amount });

            const filtered = fetched.filter(m => {
                const isNotPinned = !m.pinned;
                const isRecent = (Date.now() - m.createdTimestamp) < 1209600000;
                const matchesTarget = targetUser ? m.author.id === targetUser.id : true;
                return isNotPinned && isRecent && matchesTarget;
            });

            if (filtered.size > 0) {
                const deleted = await message.channel.bulkDelete(filtered, true);
                const reply = await message.channel.send(`✨ **Sanitization:** ${deleted.size} packets removed from node.`);
                setTimeout(() => reply.delete().catch(() => null), 3000);
            } else {
                const noFound = await message.channel.send("⚠️ **No deletable packets identified.**");
                setTimeout(() => noFound.delete().catch(() => null), 4000);
            }
        } catch (err) {
            console.error("Purge Error:", err);
        }
    },
};
