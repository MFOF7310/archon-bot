const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'credits',
    description: 'Displays system credits and creator information.',
    async execute(message) {
        const creditsEmbed = new EmbedBuilder()
            .setColor('#2ecc71') // Professional Green
            .setTitle('🛡️ SYSTEM AUTHORIZATION & CREDITS')
            .setDescription('**CLOUD GAMING-223 | DIGITAL ENGINE V2.5**\nDeveloped for the high-performance gaming community in Mali.')
            .addFields(
                { name: '👤 Principal Architect', value: '<@1284944736620253296>', inline: true },
                { name: '🤖 Core Intelligence', value: 'Gemini AI', inline: true },
                { name: '⚖️ License', value: 'MIT License', inline: true }
            )
            .setFooter({ text: 'Optimized for Starlink Connectivity 🛰️' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('TikTok')
                    .setURL('https://www.tiktok.com/@cloudgaming223')
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('Facebook')
                    .setURL('https://www.facebook.com/YOUR_FACEBOOK_LINK') // Update this!
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('WhatsApp')
                    .setURL('https://wa.me/15485200518')
                    .setStyle(ButtonStyle.Link)
            );

        message.reply({ embeds: [creditsEmbed], components: [row] });
    },
};
