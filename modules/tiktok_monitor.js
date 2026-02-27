const { EmbedBuilder } = require('discord.js');
const { TikTokLiveConnection } = require('tiktok-live-connector');

let isLive = false;
let liveStartTime = null;

module.exports = (client) => {
    // Check every 2 minutes
    setInterval(async () => {
        const username = process.env.TIKTOK_USERNAME || 'cloudgaming223';
        const channelId = process.env.CHANNEL_ID;
        const tiktok = new TikTokLiveConnection(username);
        
        try {
            await tiktok.connect();
            
            // 🔴 START STREAM LOGIC
            if (!isLive) {
                const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId);
                if (channel) {
                    liveStartTime = Date.now();
                    const liveEmbed = new EmbedBuilder()
                        .setColor('#fe2c55') // TikTok Red
                        .setAuthor({ 
                            name: `${username}`, 
                            iconURL: 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png' 
                        })
                        .setTitle('🔴 LIVE ON TIKTOK')
                        .setDescription(`**${username}** is now live! Come watch the stream.`)
                        .setURL(`https://www.tiktok.com/@${username}/live`)
                        .addFields(
                            { name: 'Platform', value: 'TikTok Live', inline: true },
                            { name: 'Status', value: 'Streaming Now ⚡', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Cloud Gaming-223 Notifications' });

                    await channel.send({ content: `📢 @everyone **${username}** is LIVE!`, embeds: [liveEmbed] });
                    isLive = true;
                }
            }
            await tiktok.disconnect();

        } catch (error) {
            // 🏁 END STREAM LOGIC
            if (error.message.includes('not online') || error.message.includes('offline') || error.message.includes('not found')) {
                if (isLive) {
                    const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId);
                    if (channel && liveStartTime) {
                        const durationMs = Date.now() - liveStartTime;
                        const hours = Math.floor(durationMs / 3600000);
                        const minutes = Math.floor((durationMs % 3600000) / 60000);
                        
                        const endEmbed = new EmbedBuilder()
                            .setColor('#2b2d31')
                            .setTitle('🏁 STREAM ENDED')
                            .addFields(
                                { name: '⏱️ Total Duration', value: `\`${hours}h ${minutes}m\``, inline: true },
                                { name: 'Platform', value: 'TikTok Live', inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: 'Thanks for watching! | Cloud Gaming-223' });

                        await channel.send({ embeds: [endEmbed] });
                    }
                    isLive = false;
                    liveStartTime = null;
                }
            }
        }
    }, 120000); 

    console.log("📦 [Module: TikTok] Monitor initialized and watching.");
};
