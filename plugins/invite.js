const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'invite',
    aliases: ['inv', 'link', 'inviter', 'lien'],
    description: '🔗 Get the invite link for the bot.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.invite',
    examples: ['.invite'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        
        const t = {
            en: {
                title: '🔗 Invite ARCHITECT CG-223',
                description: 'Click the button below to invite me to your server!',
                button: 'Invite Bot',
                support: 'Support Server',
                footer: 'Thank you for your support! 🇲🇱'
            },
            fr: {
                title: '🔗 Inviter ARCHITECT CG-223',
                description: 'Cliquez sur le bouton ci-dessous pour m\'inviter sur votre serveur !',
                button: 'Inviter le Bot',
                support: 'Serveur Support',
                footer: 'Merci pour votre soutien ! 🇲🇱'
            }
        }[lang];

        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(t.title)
            .setDescription(t.description)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setFooter({ text: t.footer })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel(t.button)
                .setURL(inviteUrl)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗'),
            new ButtonBuilder()
                .setLabel(t.support)
                .setURL('https://discord.gg/eaglecommunity')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🆘')
        );

        await message.reply({ embeds: [embed], components: [row] }).catch(() => {});
    }
};