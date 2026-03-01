const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'credits',
    description: 'Displays system credits and creator information.',
    category: 'Information',
    async execute(message, args, client) {
        // We use the ID directly to ensure it works even if .env fails
        const ARCHITECT_ID = '1284944736620253296';

        const creditsEmbed = new EmbedBuilder()
            .setColor('#2ecc71') // AES Green
            .setTitle('🛡️ SYSTEM AUTHORIZATION & CREDITS')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription('**CLOUD GAMING-223 | DIGITAL ENGINE V2.6**\nPrincipal Architect: <@' + ARCHITECT_ID + '>')
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

        // message.reply is better for mobile (Z Fold 5) as it creates a thread-like view
        await message.reply({ 
            embeds: [creditsEmbed], 
            components: [row] 
        }).catch(err => console.error("Credits Error:", err));
    },
};
