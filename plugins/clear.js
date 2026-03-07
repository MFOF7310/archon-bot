module.exports = {
    name: 'clear',
    aliases: ['purge', 'clean'],
    description: 'Safe delete with pinning protection and user filtering.',

    async execute(message, args) {
        // Use the OWNER_ID from your .env or check for Admin
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const isAdmin = message.member.permissions.has('ManageMessages'); // 'ManageMessages' is safer than full Admin

        if (!isArchitect && !isAdmin) {
            return message.reply("⛔ **Access Denied:** You lack the permissions to purge data.").then(m => setTimeout(() => m.delete(), 3000));
        }

        // 1. Identify Target and Amount
        const targetUser = message.mentions.users.first();
        const amountArg = targetUser ? args[1] : args[0];
        let amount = (args[0] === 'all') ? 100 : parseInt(amountArg);

        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply("💡 **Usage:** `,clear 20` or `,clear @user 20` (Max 100)").then(m => setTimeout(() => m.delete(), 5000));
        }

        try {
            // Fetch messages (Limit 100 is the Discord API Max for bulkDelete)
            let fetched = await message.channel.messages.fetch({ limit: 100 });

            // SAFETY: Filter out Pinned Messages & the command message itself
            let toDelete = fetched.filter(m => !m.pinned && m.id !== message.id);

            // FILTER: If a user was mentioned
            if (targetUser) {
                toDelete = toDelete.filter(m => m.author.id === targetUser.id);
            }

            // LIMIT: Slice the collection to the requested amount
            const finalDeleteList = toDelete.first(amount);

            // EXECUTE: Bulk Delete (True = Filter out messages older than 14 days)
            const deleted = await message.channel.bulkDelete(finalDeleteList, true);
            
            const reply = await message.channel.send(`🧹 **Purge Complete:** Cleaned **${deleted.size}** messages. (Pinned items saved)`);
            setTimeout(() => reply.delete().catch(() => null), 3000);

            // LOGGING
            const logChannel = message.guild.channels.cache.find(ch => ch.name === 'bot-logs' || ch.name === 'logs');
            if (logChannel) {
                logChannel.send(`🛡️ **Safe Purge** | Executed by: ${message.author.tag}\n📍 Channel: ${message.channel}\n🎯 Target: ${targetUser ? targetUser.tag : 'Global'}\n🗑️ Count: ${deleted.size}`);
            }

        } catch (err) {
            console.error(err);
            message.channel.send("⚠️ **Engine Error:** Could not purge. This usually happens if messages are older than 14 days or I lack permissions.");
        }
    },
};
