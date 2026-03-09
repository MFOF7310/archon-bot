const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    name: 'broadcast',
    description: 'Sends a global announcement to all servers.',
    run: async (client, message, args, database) => {
        const currentPrefix = process.env.PREFIX || ",";
        // Using environment variable for owner check
        if (message.author.id !== process.env.OWNER_ID) return message.reply("❌ Restricted.");

        const announcement = args.join(' ');
        if (!announcement) return message.reply(`❌ Usage: \`${currentPrefix}broadcast [message]\``);

        const broadcastEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('📢 GLOBAL ANNOUNCEMENT')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(announcement)
            .setFooter({ text: 'Eagle Community • Digital Engine' })
            .setTimestamp();

        const statusMsg = await message.reply("🛰️ **Transmitting across all nodes...**");

        let success = 0;
        let fail = 0;

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
