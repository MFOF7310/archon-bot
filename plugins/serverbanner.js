const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: (name) => `🎨 ${name} Server Banner`,
        noBanner: '❌ This server has no banner.',
        footer: 'ARCHITECT CG-223 • Neural Imaging'
    },
    fr: {
        title: (name) => `🎨 Bannière du Serveur - ${name}`,
        noBanner: '❌ Ce serveur n\'a pas de bannière.',
        footer: 'ARCHITECT CG-223 • Imagerie Neurale'
    }
};

module.exports = {
    name: 'serverbanner',
    aliases: ['sbanner', 'banniereserveur', 'guildbanner'],
    description: '🎨 Display the server banner.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.serverbanner',
    examples: ['.serverbanner', '.sbanner'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const guild = message.guild;
        
        const banner = guild.bannerURL({ dynamic: true, size: 1024 });
        
        if (!banner) {
            return message.reply({ content: t.noBanner, ephemeral: true }).catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setAuthor({ name: t.title(guild.name), iconURL: guild.iconURL({ dynamic: true }) })
            .setImage(banner)
            .setDescription(
                `[PNG](${guild.bannerURL({ extension: 'png', size: 1024 })}) • ` +
                `[JPG](${guild.bannerURL({ extension: 'jpg', size: 1024 })}) • ` +
                `[WEBP](${guild.bannerURL({ extension: 'webp', size: 1024 })})`
            )
            .setFooter({ text: `${guild.name} • ${t.footer} • v${version}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    }
};