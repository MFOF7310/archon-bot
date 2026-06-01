const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: (name) => `👥 ${name} Member Statistics`,
        total: '👤 Total Members',
        humans: '👨 Humans',
        bots: '🤖 Bots',
        online: '🟢 Online',
        idle: '🟡 Idle',
        dnd: '🔴 DND',
        offline: '⚫ Offline',
        boosters: '🚀 Boosters',
        roles: '📋 Roles',
        footer: 'ARCHITECT CG-223 • Neural Census'
    },
    fr: {
        title: (name) => `👥 Statistiques des Membres - ${name}`,
        total: '👤 Total Membres',
        humans: '👨 Humains',
        bots: '🤖 Robots',
        online: '🟢 En ligne',
        idle: '🟡 Inactif',
        dnd: '🔴 Ne pas déranger',
        offline: '⚫ Hors ligne',
        boosters: '🚀 Boosters',
        roles: '📋 Rôles',
        footer: 'ARCHITECT CG-223 • Recensement Neural'
    }
};

module.exports = {
    name: 'membercount',
    aliases: ['mc', 'members', 'membres', 'statsmembres'],
    description: '👥 Display server member statistics.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.membercount',
    examples: ['.membercount', '.mc', '.membres'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = translations[lang];
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
            .setAuthor({ name: t.title(guild.name), iconURL: guild.iconURL({ dynamic: true }) })
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