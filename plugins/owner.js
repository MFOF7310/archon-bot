const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'owner',
    description: 'Displays the creator info and social links',
    async execute(message) {
        const ownerEmbed = new EmbedBuilder()
            .setColor('#3498db') // Matching your blue theme
            .setTitle('👨‍💻 CLOUD GAMING-223 | CREATOR')
            .setDescription('Connect with the developer behind the CLOUD GAMING-223 Engine.')
            .addFields(
                { name: '📍 Location', value: '`Bamako, Mali`', inline: true },
                { name: '🛰️ Connection', value: '`Starlink Active`', inline: true }
            )
            .setThumbnail(message.client.user.displayAvatarURL())
            .setFooter({ text: 'Cloud Gaming 223 | System Admin' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('TikTok')
                    .setURL('https://www.tiktok.com/@cloudgaming223?_r=1&_t=ZS-94ExHk94xB1') // Replace with your link
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('Instagram')
                    .setURL('https://www.instagram.com/mfof7310?igsh=ZHB2MDJkaGJsNHA5') // Replace with your link
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('WhatsApp')
                    .setURL('https://wa.me/15485200518') // Replace with your number
                    .setStyle(ButtonStyle.Link)
            );

        return message.reply({ embeds: [ownerEmbed], components: [row] });
    }
};
