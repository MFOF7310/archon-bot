const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'lydia',
    aliases: ['ai', 'aimode'],
    description: 'Toggle Lydia AI with REAL-TIME web access in this channel.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {

        if (!message.member.permissions.has('Administrator')) {
            return message.reply("⛔ **Access Denied:** Administrator clearance required.");
        }

        const channelId = message.channel.id;

        // Toggle OFF
        if (client.lydiaChannels && client.lydiaChannels[channelId]) {
            delete client.lydiaChannels[channelId];

            const offEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('⚙️ AI CONTROL PANEL')
                .setDescription('**Lydia Engine** has been **disabled** in this channel.')
                .addFields(
                    { name: '❌ To Re-Enable', value: `\`${process.env.PREFIX || '.'}lydia on\``, inline: true }
                )
                .setFooter({ text: 'Cloud Gaming-223 Systems' })
                .setTimestamp();

            return message.channel.send({ embeds: [offEmbed] });
        }

        // Toggle ON
        if (!client.lydiaChannels) client.lydiaChannels = {};
        client.lydiaChannels[channelId] = true;

        const onEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('⚙️ AI CONTROL PANEL')
            .setDescription('**Lydia Engine** is now **ACTIVE** with REAL-TIME web search!\nMention or reply to the bot to talk to Lydia.')
            .addFields(
                { name: '✅ Status', value: '`ONLINE + REAL-TIME`', inline: true },
                { name: '💬 Method', value: 'Mention or Reply', inline: true },
                { name: '🔍 Web Search', value: 'Automatically searches for current info', inline: true },
                { name: '❌ To Disable', value: `\`${process.env.PREFIX || '.'}lydia off\``, inline: false }
            )
            .setFooter({ text: `Bamako Node 🇲🇱 | Cloud Gaming-223 | Powered by Groq Compound` })
            .setTimestamp();

        message.channel.send({ embeds: [onEmbed] });
    }
};