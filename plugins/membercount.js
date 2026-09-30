const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["title","total","humans","bots","online","idle","dnd","offline","boosters","roles","footer"];
// Clés dans lang/<locale>/membercount.json ; '' retombe sur EN dans t().
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`membercount.${k}`, lang);
    return o;
}

module.exports = {
    name: 'membercount',
    aliases: ['mc', 'members', 'membres', 'statsmembres'],
    description: '👥 Display server member statistics.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.membercount',
    examples: ['.membercount', '.mc', '.membres'],

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        const t = loadT(lang);
        const version = client.version || '1.6.0';
        const guild = message.guild;
        
        // Fetch all members for accurate counts
        await guild.members.fetch();
        
        const total = guild.memberCount;
        const humans = guild.members.cache.filter(m => !m.user.bot).size;
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const online = guild.members.cache.filter(m => m.presence?.status === 'online').size;
        const idle = guild.members.cache.filter(m => m.presence?.status === 'idle').size;
        const dnd = guild.members.cache.filter(m => m.presence?.status === 'dnd').size;
        const offline = guild.members.cache.filter(m => !m.presence || m.presence?.status === 'offline').size;
        const boosters = guild.premiumSubscriptionCount || 0;
        const roles = guild.roles.cache.size;

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: i18n.t('membercount.title', lang, { name: guild.name }), iconURL: guild.iconURL({ dynamic: true }) })
            .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
            .setDescription(
                `\`\`\`yaml\n` +
                `${t.total}: ${total}\n` +
                `${t.humans}: ${humans}\n` +
                `${t.bots}: ${bots}\n` +
                `${t.boosters}: ${boosters}\n` +
                `${t.roles}: ${roles}\n` +
                `\`\`\``
            )
            .addFields({
                name: '📊 Status',
                value: `\`\`\`yaml\n${t.online}: ${online}\n${t.idle}: ${idle}\n${t.dnd}: ${dnd}\n${t.offline}: ${offline}\`\`\``,
                inline: false
            })
            .setFooter({ text: `${guild.name} • ${t.footer} • v${version}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    }
};