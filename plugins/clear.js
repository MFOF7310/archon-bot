const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'clear',
    aliases: ['purge', 'clean'],
    description: 'Bulk delete messages in the current channel.',
    category: 'MODERATION',
    run: async (client, message, args, database) => {
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has(PermissionFlagsBits.ManageMessages);
        if (!isArchitect && !hasPerms) {
            return message.reply("❌ **Access Denied.** You need `Manage Messages` permission.");
        }

        // Delete command message immediately
        await message.delete().catch(() => null);

        const targetUser = message.mentions.users.first();
        const amountArg = targetUser ? args[1] : args[0];
        let amount = (amountArg?.toLowerCase() === 'all') ? 100 : parseInt(amountArg);

        if (isNaN(amount) || amount < 1) amount = 10;
        if (amount > 100) amount = 100; // Discord limit

        try {
            const fetched = await message.channel.messages.fetch({ limit: amount });
            const messagesToDelete = fetched.filter(m => {
                const notPinned = !m.pinned;
                const recent = (Date.now() - m.createdTimestamp) < 1209600000; // 14 days
                const matchesTarget = targetUser ? m.author.id === targetUser.id : true;
                return notPinned && recent && matchesTarget;
            });

            if (messagesToDelete.size > 0) {
                const deleted = await message.channel.bulkDelete(messagesToDelete, true);
                const reply = await message.channel.send(`✨ **Sanitization:** ${deleted.size} packets removed from node.`);
                setTimeout(() => reply.delete().catch(() => null), 3000);
            } else {
                const noFound = await message.channel.send("⚠️ **No deletable packets identified.**");
                setTimeout(() => noFound.delete().catch(() => null), 4000);
            }
        } catch (err) {
            console.error("Purge Error:", err);
            message.channel.send("❌ **Error:** Could not purge messages.").then(m => setTimeout(() => m.delete(), 5000));
        }
    },
};