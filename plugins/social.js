const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'socials',
    description: 'Displays the official social media links and community hubs.',
    category: 'SOCIAL',
    run: async (client, message, args, database) => {
        const socialEmbed = new EmbedBuilder()
            .setColor('#00acee')
            .setAuthor({ name: 'EAGLE COMMUNITY | UPLINK HUB', iconURL: client.user.displayAvatarURL() })
            .setTitle('🔗 CONNECT WITH THE ARCHITECT')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription('Join our digital network for the latest CODM meta, live streams, and community events directly from **Bamako, Mali**.')
            .addFields(
                { name: '🎬 TikTok', value: '*Live Streams*', inline: true },
                { name: '📸 Instagram', value: '*Clips & Intel*', inline: true },
                { name: '🔵 Facebook', value: '*Community Hub*', inline: true },
                { name: '💬 WhatsApp', value: '*Direct Support*', inline: true }
            )
            .setFooter({ text: 'Eagle Community • Digital Sovereignty 🇲🇱' })
            .setTimestamp();

        // Organize buttons into a single clean row
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('TikTok')
                .setURL('https://www.tiktok.com/@cloudgaming223')
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setLabel('Facebook')
                .setURL('https://www.facebook.com/share/17KysmJrtm/')
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setLabel('Instagram')
                .setURL('https://www.instagram.com/mfof7310')
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setLabel('WhatsApp')
                .setURL('https://wa.me/15485200518')
                .setStyle(ButtonStyle.Link)
        );

        await message.reply({ embeds: [socialEmbed], components: [row] });
    },
};
