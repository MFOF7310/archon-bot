const { EmbedBuilder } = require('discord.js');

// ================= BILINGUAL TRANSLATIONS =================
const translations = {
    en: {
        title: (name) => `👴 Oldest Members - ${name}`,
        member: 'Member',
        joined: 'Joined',
        accountCreated: 'Account Created',
        daysAgo: (days) => `${days} days ago`,
        footer: 'ARCHITECT CG-223 • Neural Archive'
    },
    fr: {
        title: (name) => `👴 Membres les Plus Anciens - ${name}`,
        member: 'Membre',
        joined: 'Rejoint',
        accountCreated: 'Compte Créé',
        daysAgo: (days) => `il y a ${days} jours`,
        footer: 'ARCHITECT CG-223 • Archive Neurale'
    }
};

module.exports = {
    name: 'oldest',
    aliases: ['anciens', 'seniors', 'veterans'],
    description: '👴 Display the oldest members in the server.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.oldest [count]',
    examples: ['.oldest', '.oldest 10', '.anciens'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const t = translations[lang];
        const version = client.version || '1.6.0';
        const guild = message.guild;
        
        const count = parseInt(args[0]) || 10;
        const limit = Math.min(count, 25);
        
        await guild.members.fetch();
        
        const oldest = guild.members.cache
            .filter(m => !m.user.bot)
            .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
            .first(limit);
        
        let description = '';
        oldest.forEach((member, i) => {
            const joinDate = member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown';
            const createDate = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
            description += `**${i + 1}.** ${member.user.tag}\n└─ ${t.joined}: ${joinDate}\n└─ ${t.accountCreated}: ${createDate}\n\n`;
        });

        const embed = new EmbedBuilder()
            .setColor('#e67e22')
            .setAuthor({ name: t.title(guild.name), iconURL: guild.iconURL({ dynamic: true }) })
            .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
            .setDescription(description)
            .setFooter({ text: `${guild.name} • ${t.footer} • v${version}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    }
};