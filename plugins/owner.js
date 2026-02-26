const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'owner',
    description: 'Social links for CLOUD GAMING223',
    async execute(message) {
        // 🔗 PASTE YOUR LINKS HERE
        const tiktok = "https://www.tiktok.com/@cloudgaming223?_r=1&_t=ZS-94ExHk94xB1";
        const whatsapp = "https://wa.me/15485200518";
        const instagram = "https://www.instagram.com/mfof7310?igsh=ZHB2MDJkaGJsNHA5E;

        const ownerEmbed = new EmbedBuilder()
            .setColor('#3498db') // Cloud Blue
            .setTitle('🎮 CLOUD GAMING223 CREATOR')
            .setThumbnail(message.client.user.displayAvatarURL())
            .setDescription('Connected from **Bamako, Mali**. Join the community on TikTok, WhatsApp, and Instagram for the best cloud gaming updates.')
            .addFields(
                { name: '📍 Location', value: '`Bamako, Mali`', inline: true },
                { name: '🛰️ Network', value: '`Starlink`', inline: true },
                { name: '🎮 Platform', value: '`Boosteroid`', inline: true }
            )
            .setFooter({ text: 'Cloud Gaming 223 - Pure Performance' });

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('TikTok').setURL(tiktok).setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('WhatsApp').setURL(whatsapp).setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('Instagram').setURL(instagram).setStyle(ButtonStyle.Link)
        );

        return message.reply({ embeds: [ownerEmbed], components: [buttons] });
    }
};
