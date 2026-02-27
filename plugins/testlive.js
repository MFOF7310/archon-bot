const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'testlive',
    description: 'Manually triggers a test of the TikTok live notification.',
    async execute(message, args, client) {
        // Security check: Only the OWNER_ID from your .env can run this
        if (message.author.id !== process.env.OWNER_ID) {
            return message.reply("❌ This is a system command for the host only.");
        }

        const channelID = process.env.CHANNEL_ID;
        const username = process.env.TIKTOK_USERNAME;

        try {
            const channel = await client.channels.fetch(channelID);
            
            const testEmbed = new EmbedBuilder()
                .setColor('#fe2c55') // TikTok Brand Red
                .setAuthor({ 
                    name: `${username} (SYSTEM TEST)`, 
                    iconURL: 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png' 
                })
                .setTitle('🔴 LIVE ON TIKTOK')
                .setDescription(`**${username}** is now live! (This is a system test to check the layout)`)
                .addFields(
                    { name: 'Platform', value: 'TikTok Live', inline: true },
                    { name: 'Status', value: 'Testing ⚡', inline: true }
                )
                .setURL(`https://www.tiktok.com/@${username}/live`)
                .setTimestamp()
                .setFooter({ text: 'Cloud Gaming-223 Test Suite' });

            await channel.send({ 
                content: `📢 **TEST:** @everyone, **${username}** has just gone live!`, 
                embeds: [testEmbed] 
            });

            message.reply(`✅ Test notification sent to <#${channelID}>!`);
            
        } catch (error) {
            console.error(error);
            message.reply("❌ Error: Check if the CHANNEL_ID in your .env is correct.");
        }
    },
};
