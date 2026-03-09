const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'socials',
    description: 'Displays the official social media links.',
    category: 'Social',
    run: async (client, message, args, database) => {
        const socialEmbed = new EmbedBuilder()
            .setColor('#00acee')
            .setTitle('🔗 CONNECT WITH EAGLE COMMUNITY')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription('Follow for the latest streams and digital engine news from Bamako!')
            .addFields(
                { name: '🎬 TikTok', value: 'Live Streams', inline: true },
                { name: '📸 Instagram', value: 'Clips & Photos', inline: true },
                { name: '🔵 Facebook', value: 'Community Hub', inline: true },
                { name: '💬 WhatsApp', value: 'Direct Support', inline: true }
            )
            .setFooter({ text: 'Eagle Community | Mali 🇲🇱' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('TikTok').setURL('https://www.tiktok.com/@cloudgaming223').setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('Facebook').setURL('https://www.facebook.com/share/17KysmJrtm/').setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('Instagram').setURL('https://www.instagram.com/mfof7310').setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('WhatsApp').setURL('https://wa.me/15485200518').setStyle(ButtonStyle.Link)
        );

        await message.reply({ embeds: [socialEmbed], components: [row] });
    },
};
