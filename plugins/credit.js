const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'credits',
    description: 'Displays system credits and creator information.',
    category: 'Information',
    async execute(message, args, client) {
        const creditsEmbed = new EmbedBuilder()
            .setColor('#2ecc71') // AES Green
            .setTitle('🛡️ SYSTEM AUTHORIZATION & CREDITS')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription('**CLOUD GAMING-223 | DIGITAL ENGINE V2.5**\nPrincipal Architect: <@1284944736620253296>')
            .addFields(
                { name: '🧠 Intelligence', value: 'Gemini 2.0 Flash', inline: true },
                { name: '⚖️ License', value: 'MIT License', inline: true },
                { name: '🇲🇱 Region', value: 'Bamako, Mali', inline: true }
            )
            .setFooter({ text: 'AES Digital Sovereignty • Built for the Community' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Facebook')
                    .setURL('https://www.facebook.com/share/17KysmJrtm/')
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('TikTok')
                    .setURL('https://www.tiktok.com/@cloudgaming223')
                    .setStyle(ButtonStyle.Link)
            );

        // Uses message.reply to keep the "Conversation" clean on your Z Fold 5
        await message.reply({ embeds: [creditsEmbed], components: [row] });
    },
};
