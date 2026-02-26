const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'owner',
    description: 'Creator social links and contact info',
    async execute(message) {
        // 🔗 Replace these with your actual links from earlier
        const socials = {
            tiktok: "https://www.tiktok.com/https://www.tiktok.com/@cloudgaming223?_r=1&_t=ZS-94ExHk94xB1your_username",
            instagram: "https://www.instagram.com/mfof7310?igsh=ZHB2MDJkaGJsNHA5",
            facebook: "https://www.facebook.com/share/16q67Ar7FP/",
            whatsapp: "https://wa.me/15485200518" 
        };

        const ownerEmbed = new EmbedBuilder()
            .setColor('#f1c40f') // Gold Theme
            .setTitle('👑 AES Framework Creator')
            .setThumbnail(message.client.user.displayAvatarURL())
            .setDescription('Connected from **Bamako, Mali**. Reach out for bot support or AES project collaboration.')
            .addFields(
                { name: '📍 Location', value: '`Mali (AES)`', inline: true },
                { name: '🛰️ Network', value: '`Starlink`', inline: true },
                { name: '🛠️ Role', value: '`Lead Developer`', inline: true }
            )
            .setFooter({ text: 'Digital Sovereignty for the Sahel' });

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('TikTok').setURL(socials.tiktok).setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('Instagram').setURL(socials.instagram).setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('WhatsApp').setURL(socials.whatsapp).setStyle(ButtonStyle.Link)
        );

        return message.reply({ embeds: [ownerEmbed], components: [buttons] });
    }
};
