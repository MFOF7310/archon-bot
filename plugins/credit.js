const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'credits',
    description: 'Displays system credits.',
    category: 'Information',
    run: async (client, message, args, database) => {
        const ARCHITECT_ID = process.env.OWNER_ID || '1284944736620253296';

        const creditsEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🛡️ SYSTEM AUTHORIZATION & CREDITS')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription('**CLOUD GAMING-223 | DIGITAL ENGINE**\nPrincipal Architect: <@' + ARCHITECT_ID + '>')
            .addFields(
                { name: '🧠 Intelligence', value: 'Gemini 1.5 Flash', inline: true },
                { name: '🇲🇱 Region', value: 'Bamako, Mali', inline: true }
            )
            .setFooter({ text: 'AES Digital Sovereignty' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Facebook').setURL('https://www.facebook.com/share/17KysmJrtm/').setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('TikTok').setURL('https://www.tiktok.com/@cloudgaming223').setStyle(ButtonStyle.Link)
        );

        await message.reply({ embeds: [creditsEmbed], components: [row] });
    },
};
