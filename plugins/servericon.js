const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: (name) => `🖼️ ${name} Server Icon`,
        noIcon: '❌ This server has no icon.',
        formats: 'Formats',
        footer: 'ARCHITECT CG-223 • Neural Imaging'
    },
    fr: {
        title: (name) => `🖼️ Icône du Serveur - ${name}`,
        noIcon: '❌ Ce serveur n\'a pas d\'icône.',
        formats: 'Formats',
        footer: 'ARCHITECT CG-223 • Imagerie Neurale'
    }
};

module.exports = {
    name: 'servericon',
    aliases: ['icon', 'icone', 'serveuricon', 'guildicon'],
    description: '🖼️ Display the server icon in high resolution.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.servericon',
    examples: ['.servericon', '.icon', '.icone'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const guild = message.guild;
        
        const icon = guild.iconURL({ dynamic: true, size: 1024 });
        
        if (!icon) {
            return message.reply({ content: t.noIcon, ephemeral: true }).catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: t.title(guild.name), iconURL: icon })
            .setImage(icon)
            .setDescription(
                `**${t.formats}:** ` +
                `[PNG](${guild.iconURL({ extension: 'png', size: 1024 })}) • ` +
                `[JPG](${guild.iconURL({ extension: 'jpg', size: 1024 })}) • ` +
                `[WEBP](${guild.iconURL({ extension: 'webp', size: 1024 })})` +
                (guild.iconURL({ dynamic: true })?.includes('a_') ? ' • [GIF](' + guild.iconURL({ extension: 'gif', size: 1024 }) + ')' : '')
            )
            .setFooter({ text: `${guild.name} • ${t.footer} • v${version}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    }
};