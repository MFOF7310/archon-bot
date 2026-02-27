const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'broadcast',
    description: 'Sends a global announcement to all servers.',
    category: 'Owner',
    async execute(message, args, client) {
        // 1. SECURITY: Using the ID from your setup
        const OWNER_ID = '1284944736620253296';
        if (message.author.id !== OWNER_ID) {
            return message.reply("❌ Restricted: Only the Engine Owner can broadcast.");
        }

        // 2. CHECK FOR MESSAGE
        const announcement = args.join(' ');
        if (!announcement) {
            return message.reply("❌ Usage: `,broadcast [Your message here]`");
        }

        const broadcastEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('📢 GLOBAL ANNOUNCEMENT')
            .setAuthor({ name: 'Cloud Gaming-223 System', iconURL: client.user.displayAvatarURL() })
            .setDescription(announcement)
            .setFooter({ text: 'Broadcasted to all connected nodes' })
            .setTimestamp();

        let successCount = 0;
        let failCount = 0;

        const statusMsg = await message.reply("🛰️ **Transmitting broadcast...**");

        // 3. THE LOOP (Fixed for async accuracy)
        for (const [id, guild] of client.guilds.cache) {
            try {
                const channel = guild.channels.cache
                    .filter(ch => ch.isTextBased() && ch.permissionsFor(client.user).has(PermissionFlagsBits.SendMessages))
                    .first();

                if (channel) {
                    await channel.send({ embeds: [broadcastEmbed] });
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }

        await statusMsg.edit(`✅ **Broadcast complete!**\n🟢 Delivered: **${successCount}**\n🔴 Failed: **${failCount}**`);
    },
};
