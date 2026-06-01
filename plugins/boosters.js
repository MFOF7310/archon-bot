const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: (name) => `🚀 ${name} Server Boosters`,
        boostCount: 'Boost Count',
        boostLevel: 'Boost Level',
        boosters: '🌟 Boosters',
        noBoosters: '❌ This server has no boosters.',
        since: 'Boosting since',
        footer: 'ARCHITECT CG-223 • Neural Recognition'
    },
    fr: {
        title: (name) => `🚀 Boosters du Serveur - ${name}`,
        boostCount: 'Nombre de Boosts',
        boostLevel: 'Niveau de Boost',
        boosters: '🌟 Boosters',
        noBoosters: '❌ Ce serveur n\'a pas de boosters.',
        since: 'Booste depuis',
        footer: 'ARCHITECT CG-223 • Reconnaissance Neurale'
    }
};

module.exports = {
    name: 'boosters',
    aliases: ['boosts', 'boost', 'premium'],
    description: '🚀 Display server boosters and boost status.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.boosters',
    examples: ['.boosters', '.boosts'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const guild = message.guild;
        
        const boostCount = guild.premiumSubscriptionCount || 0;
        const boostLevel = guild.premiumTier;
        
        if (boostCount === 0) {
            return message.reply({ content: t.noBoosters, ephemeral: true }).catch(() => {});
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
            .setAuthor({ name: t.title(guild.name), iconURL: guild.iconURL({ dynamic: true }) })
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