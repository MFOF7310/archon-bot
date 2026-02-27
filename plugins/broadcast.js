const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'broadcast',
    description: 'Sends a global announcement to all servers.',
    async execute(message, args, client) {
        // 1. SECURITY: Only the Owner can use this
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
            .setColor('#e74c3c') // Alert Red
            .setTitle('📢 GLOBAL ANNOUNCEMENT')
            .setAuthor({ name: 'Cloud Gaming-223 System', iconURL: client.user.displayAvatarURL() })
            .setDescription(announcement)
            .setFooter({ text: 'Broadcasted to all connected nodes' })
            .setTimestamp();

        let successCount = 0;
        let failCount = 0;

        // 3. THE LOOP: Find the best channel in every server
        client.guilds.cache.forEach(async (guild) => {
            try {
                // Find the first text channel where the bot has permission to speak
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
        });

        message.reply(`✅ Broadcast complete!\n🟢 Delivered to: **${successCount}** servers\n🔴 Failed in: **${failCount}** servers`);
    },
};
