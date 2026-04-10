const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'avatar',
    aliases: ['av', 'pfp', 'photo'],
    description: '🖼️ Display your or another user\'s avatar.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.avatar [@user]',
    examples: ['.avatar', '.avatar @user'],

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const target = message.mentions.users.first() || message.author;
        
        const t = {
            en: { title: (user) => `🖼️ ${user}'s Avatar`, footer: 'ARCHITECT CG-223 • Neural Imaging' },
            fr: { title: (user) => `🖼️ Avatar de ${user}`, footer: 'ARCHITECT CG-223 • Imagerie Neurale' }
        }[lang] || { title: (u) => `${u}'s Avatar`, footer: 'ARCHITECT CG-223' };

        const formats = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        const avatarURL = target.displayAvatarURL({ dynamic: true, size: 1024 });

        const embed = new EmbedBuilder()
            .setColor(target.accentColor || '#00fbff')
            .setAuthor({ name: t.title(target.username), iconURL: target.displayAvatarURL({ dynamic: true }) })
            .setImage(avatarURL)
            .setDescription(formats.map(f => `[\`.${f}\`](${target.displayAvatarURL({ extension: f === 'jpg' ? 'jpeg' : f, size: 1024 })})`).join(' • '))
            .setFooter({ text: t.footer })
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    }
};