const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    name: 'broadcast',
    description: 'Send a global announcement to all servers (Owner only).',
    category: 'OWNER',
    run: async (client, message, args, database) => {
        if (message.author.id !== process.env.OWNER_ID) {
            return message.reply("❌ **Restricted.** Admin override required.");
        }

        const fullText = args.join(' ');

        if (!fullText) {
            return message.reply(`❌ Usage: \`${process.env.PREFIX || '.'}broadcast [message] (optional: image URL anywhere)\``);
        }

        // Regex to find URLs (http:// or https://)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = fullText.match(urlRegex);

        let imageUrl = null;
        let announcementText = fullText;

        if (urls && urls.length > 0) {
            // Use the first URL as the embed image
            imageUrl = urls[0];
            // Remove that URL from the text (only the first occurrence)
            announcementText = fullText.replace(imageUrl, '').trim();
        }

        // Build the embed
        const broadcastEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('📢 GLOBAL ANNOUNCEMENT')
            .setAuthor({ 
                name: message.author.tag, 
                iconURL: message.author.displayAvatarURL() 
            })
            .setDescription(announcementText || '*No text provided*')
            .setFooter({ text: 'Eagle Community • Digital Engine' })
            .setTimestamp();

        if (imageUrl) {
            broadcastEmbed.setImage(imageUrl);
        }

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
                } else {
                    fail++;
                }
            } catch (err) {
                fail++;
            }
        });

        await Promise.all(promises);
        await statusMsg.edit(`✅ **Transmission Complete**\n🟢 Active Nodes: **${success}**\n🔴 Failed Nodes: **${fail}**`);
    },
};