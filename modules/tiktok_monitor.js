const { EmbedBuilder } = require('discord.js');
const { TikTokLiveConnection } = require('tiktok-live-connector');

let isLive = false;
let liveStartTime = null;

module.exports = (client) => {
    setInterval(async () => {
        const tiktok = new TikTokLiveConnection(process.env.TIKTOK_USERNAME);
        
        try {
            await tiktok.connect();
            
            // 🔴 START STREAM
            if (!isLive) {
                const channel = await client.channels.fetch(process.env.CHANNEL_ID);
                if (channel) {
                    liveStartTime = Date.now();
                    const liveEmbed = new EmbedBuilder()
                        .setColor('#fe2c55')
                        .setAuthor({ 
                            name: `${process.env.TIKTOK_USERNAME}`, 
                            iconURL: 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png' 
                        })
                        .setTitle('🔴 LIVE ON TIKTOK')
                        .setDescription(`**${process.env.TIKTOK_USERNAME}** is now live! Come watch the stream.`)
                        .setURL(`https://www.tiktok.com/@${process.env.TIKTOK_USERNAME}/live`)
                        .addFields(
                            { name: 'Platform', value: 'TikTok Live', inline: true },
                            { name: 'Status', value: 'Streaming Now ⚡', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Cloud Gaming-223 Notifications' });

                    await channel.send({ content: `📢 @everyone **${process.env.TIKTOK_USERNAME}** is LIVE!`, embeds: [liveEmbed] });
                    isLive = true;
                }
            }
            tiktok.disconnect();

        } catch (error) {
            // 🏁 END STREAM
            if (error.message.includes('not online') || error.message.includes('offline')) {
                if (isLive) {
                    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
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
    }, 120000); // 2 minutes
};
