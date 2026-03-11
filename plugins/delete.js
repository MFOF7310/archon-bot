const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'dlt',
    aliases: ['delete', 'remove', 'erase'],
    description: 'Delete a specific message (reply to it, mention user, or use message ID).',
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const hasPerms = message.member.permissions.has(PermissionFlagsBits.ManageMessages);
        if (!isArchitect && !hasPerms) {
            return message.reply("❌ **Access Denied.** You need `Manage Messages` permission.");
        }

        // Delete the command message immediately
        await message.delete().catch(() => null);

        let targetMsg = null;

        // If replying to a message
        if (message.reference) {
            targetMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        }
        // If message ID provided as argument
        else if (args[0] && /^\d+$/.test(args[0])) {
            targetMsg = await message.channel.messages.fetch(args[0]).catch(() => null);
        }
        // If user mentioned, fetch their last message in the channel
        else if (message.mentions.users.first()) {
            const targetUser = message.mentions.users.first();
            const messages = await message.channel.messages.fetch({ limit: 20 });
            targetMsg = messages.find(m => m.author.id === targetUser.id);
        }

        if (targetMsg) {
            try {
                await targetMsg.delete();
                const success = await message.channel.send(`🎯 **Target Packet Erased.**`);
                setTimeout(() => success.delete().catch(() => null), 2000);
            } catch (err) {
                const fail = await message.channel.send("⚠️ **Error:** Message too old or missing permissions.");
                setTimeout(() => fail.delete().catch(() => null), 3000);
            }
        } else {
            const noFound = await message.channel.send("❓ **No target signature found.**");
            setTimeout(() => noFound.delete().catch(() => null), 3000);
        }
    },
};