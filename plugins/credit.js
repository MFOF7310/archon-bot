const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'credits',
    description: 'Display system authorization and credits.',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        const ARCHITECT_ID = process.env.OWNER_ID;

        const creditsEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🛡️ SYSTEM AUTHORIZATION & CREDITS')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription('**ARCHITECT CG-223 | DIGITAL ENGINE**\nPrincipal Architect: <@' + ARCHITECT_ID + '>')
            .addFields(
                { name: '🧠 Intelligence', value: 'Gemini 1.5 Flash', inline: true },
                { name: '🇲🇱 Region', value: 'Bamako, Mali', inline: true },
                { name: '📦 Version', value: client.version || '2.6.0', inline: true }
            )
            .setFooter({ text: 'Eagle Community | Digital Sovereignty' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Facebook').setURL('https://www.facebook.com/share/17KysmJrtm/').setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('TikTok').setURL('https://www.tiktok.com/@cloudgaming223').setStyle(ButtonStyle.Link)
        );

        await message.reply({ embeds: [creditsEmbed], components: [row] });
    },
};