const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'credits',
    description: 'Displays system credits and creator information.',
    async execute(message) {
        const creditsEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🛡️ SYSTEM AUTHORIZATION & CREDITS')
            .setDescription('**CLOUD GAMING-223 | DIGITAL ENGINE V2.5**\nPrincipal Architect: <@1284944736620253296>')
            .addFields(
                { name: '🤖 Intelligence', value: 'Gemini AI', inline: true },
                { name: '⚖️ License', value: 'MIT License', inline: true },
                { name: '📍 Region', value: 'Bamako, Mali', inline: true }
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setLabel('Facebook').setURL('https://www.facebook.com/share/17KysmJrtm/').setStyle(ButtonStyle.Link),
                new ButtonBuilder().setLabel('TikTok').setURL('https://www.tiktok.com/@cloudgaming223').setStyle(ButtonStyle.Link)
            );

        message.reply({ embeds: [creditsEmbed], components: [row] });
    },
};
