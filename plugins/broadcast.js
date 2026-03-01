const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    name: 'broadcast',
    description: 'Sends a global announcement to all servers.',
    category: 'Owner',
    async execute(message, args, client) {
        const OWNER_ID = '1284944736620253296';
        if (message.author.id !== OWNER_ID) return message.reply("❌ Restricted.");

        const announcement = args.join(' ');
        if (!announcement) return message.reply("❌ Usage: `,broadcast [message]`");

        const broadcastEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('📢 GLOBAL ANNOUNCEMENT')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(announcement)
            .setFooter({ text: 'Cloud Gaming-223 Network' })
            .setTimestamp();

        const statusMsg = await message.reply("🛰️ **Transmitting across all nodes...**");

        let success = 0;
        let fail = 0;

        // Efficient async broadcasting
        const promises = client.guilds.cache.map(async (guild) => {
            try {
                const channel = guild.channels.cache.find(c => 
                    c.type === ChannelType.GuildText && 
                    c.permissionsFor(client.user).has(PermissionFlagsBits.SendMessages)
                );
                if (channel) {
                    await channel.send({ embeds: [broadcastEmbed] });
                    success++;
                } else { fail++; }
            } catch (err) { fail++; }
        });

        await Promise.all(promises);
        await statusMsg.edit(`✅ **Transmission Complete**\n🟢 Nodes: **${success}**\n🔴 Offline: **${fail}**`);
    },
};
