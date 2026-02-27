const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'testlive',
    description: 'Triggers a test of the TikTok live notification.',
    category: 'Owner',
    async execute(message, args, client) {
        if (message.author.id !== process.env.OWNER_ID) {
            return message.reply("❌ This is a system command for the host only.");
        }

        const channelID = process.env.CHANNEL_ID;
        const username = process.env.TIKTOK_USERNAME;

        try {
            const channel = await client.channels.fetch(channelID);
            const testEmbed = new EmbedBuilder()
                .setColor('#fe2c55')
                .setTitle('🔴 LIVE ON TIKTOK (TEST)')
                .setDescription(`**${username}** is now live!`)
                .setURL(`https://www.tiktok.com/@${username}/live`)
                .setFooter({ text: 'Cloud Gaming-223 Test Suite' });

            await channel.send({ content: `📢 **TEST:** @everyone, **${username}** is live!`, embeds: [testEmbed] });
            message.reply(`✅ Test notification sent to <#${channelID}>!`);
        } catch (error) {
            message.reply("❌ Execution failed. Check ID in `.env`.");
        }
    },
};
