const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["title","noBanner","footer"];
// Clés dans lang/<locale>/serverbanner.json ; '' retombe sur EN dans t().
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`serverbanner.${k}`, lang);
    return o;
}

module.exports = {
    name: 'serverbanner',
    aliases: ['sbanner', 'banniereserveur', 'guildbanner'],
    description: '🎨 Display the server banner.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.serverbanner',
    examples: ['.serverbanner', '.sbanner'],

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        const t = loadT(lang);
        const version = client.version || '1.6.0';
        const guild = message.guild;
        
        const banner = guild.bannerURL({ dynamic: true, size: 1024 });
        
        if (!banner) {
            return message.reply({ content: t.noBanner, flags: 64 }).catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setAuthor({ name: i18n.t('serverbanner.title', lang, { name: guild.name }), iconURL: guild.iconURL({ dynamic: true }) })
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