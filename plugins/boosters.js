const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["title","boostCount","boostLevel","boosters","noBoosters","since","footer"];
// Clés dans lang/<locale>/boosters.json ; '' retombe sur EN dans t().
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`boosters.${k}`, lang);
    return o;
}

module.exports = {
    name: 'boosters',
    aliases: ['boosts', 'boost', 'premium'],
    description: '🚀 Display server boosters and boost status.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.boosters',
    examples: ['.boosters', '.boosts'],

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        const t = loadT(lang);
        const version = client.version || '1.6.0';
        const guild = message.guild;
        
        const boostCount = guild.premiumSubscriptionCount || 0;
        const boostLevel = guild.premiumTier;
        
        if (boostCount === 0) {
            return message.reply({ content: t.noBoosters, flags: 64 }).catch(() => {});
        }

        // Get boosters (members with booster role or premium since)
        const boosters = guild.members.cache.filter(m => m.premiumSince).sort((a, b) => a.premiumSinceTimestamp - b.premiumSinceTimestamp);
        
        let boostersList = '';
        boosters.forEach((member, i) => {
            const since = member.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : 'Unknown';
            boostersList += `**${i + 1}.** ${member.user.tag} - ${since}\n`;
        });

        if (boostersList.length > 1024) boostersList = boostersList.substring(0, 1021) + '...';

        const embed = new EmbedBuilder()
            .setColor('#f47fff')
            .setAuthor({ name: i18n.t('boosters.title', lang, { name: guild.name }), iconURL: guild.iconURL({ dynamic: true }) })
            .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.boostCount}: ${boostCount}\n` +
                `${t.boostLevel}: Tier ${boostLevel}\n` +
                `\`\`\``
            )
            .addFields({
                name: t.boosters,
                value: boostersList || t.noBoosters,
                inline: false
            })
            .setFooter({ text: `${guild.name} • ${t.footer} • v${version}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    }
};