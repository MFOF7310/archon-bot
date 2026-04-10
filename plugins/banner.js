const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    name: 'banner',
    aliases: ['banniere', 'bg'],
    description: '🎨 Display your or another user\'s banner.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.banner [@user]',
    examples: ['.banner', '.banner @user'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const target = message.mentions.users.first() || message.author;
        
        const t = {
            en: { 
                title: (user) => `🎨 ${user}'s Banner`, 
                noBanner: '❌ This user does not have a banner.',
                footer: 'ARCHITECT CG-223 • Neural Imaging'
            },
            fr: { 
                title: (user) => `🎨 Bannière de ${user}`, 
                noBanner: '❌ Cet utilisateur n\'a pas de bannière.',
                footer: 'ARCHITECT CG-223 • Imagerie Neurale'
            }
        }[lang] || { title: (u) => `${u}'s Banner`, noBanner: '❌ No banner.', footer: 'ARCHITECT CG-223' };

        // Fetch user with banner
        const user = await client.users.fetch(target.id, { force: true });
        
        const bannerURL = user.bannerURL({ dynamic: true, size: 1024 });
        
        if (!bannerURL) {
            return message.reply({ content: t.noBanner, ephemeral: true }).catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setColor(user.accentColor || '#00fbff')
            .setAuthor({ name: t.title(user.username), iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setImage(bannerURL)
            .setDescription(`[🔗 PNG](${user.bannerURL({ extension: 'png', size: 1024 })}) • [🔗 JPG](${user.bannerURL({ extension: 'jpg', size: 1024 })}) • [🔗 WEBP](${user.bannerURL({ extension: 'webp', size: 1024 })})`)
            .setFooter({ text: t.footer })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    }
};