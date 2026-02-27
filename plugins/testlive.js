const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'testlive',
    description: 'Manually triggers a test of the TikTok live notification.',
    async execute(message, args, client) {
        // Dynamically pull the Owner ID from your .env
        const OWNER_ID = String(process.env.OWNER_ID);
        
        // Security check: Match the message author with the .env owner
        if (message.author.id !== OWNER_ID) {
            return message.reply("❌ This is a system command for the host only.");
        }

        const channelID = process.env.CHANNEL_ID;
        const username = process.env.TIKTOK_USERNAME;

        // Check if essential variables are missing in the .env
        if (!channelID || !username) {
            return message.reply("❌ Missing `CHANNEL_ID` or `TIKTOK_USERNAME` in `.env`!");
        }

        try {
            const channel = await client.channels.fetch(channelID);
            
            if (!channel) {
                return message.reply("❌ Could not find the channel. Please verify the ID in your dashboard.");
            }

            const testEmbed = new EmbedBuilder()
                .setColor('#fe2c55') // TikTok Red
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
            console.error("TestLive Error:", error);
            message.reply("❌ Execution failed. Check your console logs.");
        }
    },
};
