module.exports = {
    name: 'clear',
    description: 'Safe delete with pinning protection and user filtering.',

    async execute(message, args) {
        const ARCHITECT_ID = process.env.OWNER_ID;
        const isArchitect = message.author.id === ARCHITECT_ID;
        const isAdmin = message.member.permissions.has('Administrator');

        if (!isArchitect && !isAdmin) return;

        // 1. Identify if a user was mentioned (for specific deletion)
        const targetUser = message.mentions.users.first();
        const amountArg = targetUser ? args[1] : args[0];
        let amount = parseInt(amountArg);

        if (args[0] !== 'all' && (isNaN(amount) || amount < 1 || amount > 100)) {
            return message.reply("Usage: `!clear 20` or `!clear @user 20`").then(m => setTimeout(() => m.delete(), 5000));
        }

        try {
            // Fetch messages from the channel
            let messages = await message.channel.messages.fetch({ limit: 100 });

            // SAFETY: Filter out Pinned Messages so they are NEVER deleted
            messages = messages.filter(m => !m.pinned);

            // FILTER: If a user was mentioned, only keep their messages
            if (targetUser) {
                messages = messages.filter(m => m.author.id === targetUser.id);
            }

            // Limit the deletion to the amount requested
            if (args[0] !== 'all') {
                messages = Array.from(messages.values()).slice(0, amount);
            }

            // Execute Delete
            const deleted = await message.channel.bulkDelete(messages, true);
            
            const reply = await message.channel.send(`✅ Cleaned **${deleted.size}** messages safely (Pinned messages were saved).`);
            setTimeout(() => reply.delete().catch(() => null), 3000);

            // Log it
            const logChannel = message.guild.channels.cache.find(ch => ch.name === 'bot-logs');
            if (logChannel) {
                logChannel.send(`🛡️ **Safe Purge** by ${message.author.tag} in ${message.channel}. Target: ${targetUser ? targetUser.tag : 'Everyone'}.`);
            }

        } catch (err) {
            message.channel.send("⚠️ Could not complete purge. Messages might be older than 14 days.");
        }
    },
};
