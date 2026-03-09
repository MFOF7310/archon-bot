module.exports = {
    name: 'dlt',
    aliases: ['delete', 'remove', 'erase'],
    description: 'Surgical delete: Removes a specific replied message or a user\'s latest message.',
    run: async (client, message, args, database) => {
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has('ManageMessages');
        if (!isArchitect && !hasPerms) return;

        await message.delete().catch(() => null);

        let targetMsg = null;
        if (message.reference) {
            targetMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        } else if (message.mentions.users.first()) {
            const targetUser = message.mentions.users.first();
            const fetched = await message.channel.messages.fetch({ limit: 20 });
            targetMsg = fetched.find(m => m.author.id === targetUser.id);
        }

        if (targetMsg) {
            try {
                await targetMsg.delete();
                const success = await message.channel.send(`🎯 **Target Erased.**`);
                setTimeout(() => success.delete().catch(() => null), 2000);
            } catch (err) {
                const fail = await message.channel.send("⚠️ **Error:** Permission or age restriction.");
                setTimeout(() => fail.delete().catch(() => null), 3000);
            }
        } else {
            const noFound = await message.channel.send("❓ **No target found.**");
            setTimeout(() => noFound.delete().catch(() => null), 3000);
        }
    },
};
