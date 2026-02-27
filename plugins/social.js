const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'socials',
    description: 'Displays the official social media links for Cloud Gaming-223.',
    async execute(message) {
        const socialEmbed = new EmbedBuilder()
            .setColor('#00acee')
            .setTitle('🔗 CONNECT WITH CLOUD GAMING-223')
            .setDescription('Follow for the latest streams and digital engine news from Bamako!')
            .addFields(
                { name: '📱 TikTok', value: 'Live Streams', inline: true },
                { name: '📸 Instagram', value: 'Clips/Photos', inline: true },
                { name: '🔵 Facebook', value: 'Community Updates', inline: true },
                { name: '💬 WhatsApp', value: 'Direct Support', inline: true }
            )
            .setFooter({ text: 'Cloud Gaming-223 | Mali 🇲🇱' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setLabel('TikTok').setURL('https://www.tiktok.com/@cloudgaming223').setStyle(ButtonStyle.Link),
                new ButtonBuilder().setLabel('Facebook').setURL('https://www.facebook.com/share/17KysmJrtm/').setStyle(ButtonStyle.Link),
                new ButtonBuilder().setLabel('Instagram').setURL('https://www.instagram.com/mfof7310').setStyle(ButtonStyle.Link),
                new ButtonBuilder().setLabel('WhatsApp').setURL('https://wa.me/15485200518').setStyle(ButtonStyle.Link)
            );

        message.reply({ embeds: [socialEmbed], components: [row] });
    },
};
