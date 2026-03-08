module.exports = {
    name: 'dlt', // This is your primary command
    aliases: ['delete', 'remove', 'erase'], // These are the secondary triggers
    description: 'Surgical delete: Removes a specific replied message or a user\'s latest message.',

    async execute(message, args) {
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has('ManageMessages');
        if (!isArchitect && !hasPerms) return;

        // Immediate cleanup of the command itself (",dlt @user")
        await message.delete().catch(() => null);

        let targetMsg = null;

        // 1. DYNAMIC CHECK: Is it a Reply?
        if (message.reference) {
            targetMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        } 
        
        // 2. DYNAMIC CHECK: Is it a User Mention?
        else if (message.mentions.users.first()) {
            const targetUser = message.mentions.users.first();
            // Fetch the last 20 messages to find the most recent one by this user
            const fetched = await message.channel.messages.fetch({ limit: 20 });
            targetMsg = fetched.find(m => m.author.id === targetUser.id);
        }

        // 3. EXECUTION
        if (targetMsg) {
            try {
                await targetMsg.delete();
                // Brief ghost confirmation
                const success = await message.channel.send(`🎯 **Target Erased.**`);
                setTimeout(() => success.delete().catch(() => null), 2000);
            } catch (err) {
                const fail = await message.channel.send("⚠️ **Error:** Message is too old or I lack permissions.");
                setTimeout(() => fail.delete().catch(() => null), 3000);
            }
        } else {
            const noFound = await message.channel.send("❓ **No target found.** Reply to a message or mention a user.");
            setTimeout(() => noFound.delete().catch(() => null), 3000);
        }
    },
};
