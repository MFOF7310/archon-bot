const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["title","noIcon","formats","footer"];
// Clés dans lang/<locale>/servericon.json ; '' retombe sur EN dans t().
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`servericon.${k}`, lang);
    return o;
}

module.exports = {
    name: 'servericon',
    aliases: ['icon', 'icone', 'serveuricon', 'guildicon'],
    description: '🖼️ Display the server icon in high resolution.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.servericon',
    examples: ['.servericon', '.icon', '.icone'],

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        const t = loadT(lang);
        const version = client.version || '1.6.0';
        const guild = message.guild;
        
        const icon = guild.iconURL({ dynamic: true, size: 1024 });
        
        if (!icon) {
            return message.reply({ content: t.noIcon, flags: 64 }).catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: i18n.t('servericon.title', lang, { name: guild.name }), iconURL: icon })
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