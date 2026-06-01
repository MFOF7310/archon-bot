const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'avatar',
    aliases: ['av', 'pfp', 'photo'],
    description: '🖼️ Display your or another user\'s avatar in high quality.',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.avatar [@user]',
    examples: ['.avatar', '.avatar @user'],

    // ================= SLASH COMMAND DATA =================
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('🖼️ Display your or another user\'s avatar in high quality')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User whose avatar you want to see')
                .setRequired(false)
        ),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage?.(usedCommand, 'en') || 'en';
        const target = message.mentions.users.first() || message.author;

        return sendAvatarEmbed(message, target, lang, client);
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const target = interaction.options.getUser('user') || interaction.user;

        return sendAvatarEmbed(interaction, target, lang, client);
    }
};

// ================= SHARED HELPER =================
async function sendAvatarEmbed(context, target, lang, client) {
    const t = {
        en: { title: (user) => `🖼️ ${user}'s Avatar`, footer: 'ARCHITECT CG-223 • Neural Imaging' },
        fr: { title: (user) => `🖼️ Avatar de ${user}`, footer: 'ARCHITECT CG-223 • Imagerie Neurale' }
    }[lang] || { title: (u) => `${u}'s Avatar`, footer: 'ARCHITECT CG-223' };

    const formats = ['png', 'jpg', 'webp', 'gif'];

    // 🔥 Get highest quality: global avatar (4096) or guild avatar (4096)
    const member = context.guild?.members.cache.get(target.id);
    const guildAvatar = member?.avatar;
    
    // Guild-specific avatar or global avatar - max size 4096
    const avatarURL = guildAvatar
        ? `https://cdn.discordapp.com/guilds/${context.guild.id}/users/${target.id}/avatars/${guildAvatar}.${guildAvatar.startsWith('a_') ? 'gif' : 'png'}?size=4096`
        : target.displayAvatarURL({ dynamic: true, size: 4096 });

    const embed = new EmbedBuilder()
        .setColor(member?.displayColor || target.accentColor || '#00fbff')
        .setAuthor({ 
            name: t.title(target.username), 
            iconURL: target.displayAvatarURL({ dynamic: true, size: 128 }) 
        })
        .setImage(avatarURL)
        .setDescription(
            formats.map(f => {
                const url = guildAvatar
                    ? `https://cdn.discordapp.com/guilds/${context.guild.id}/users/${target.id}/avatars/${guildAvatar}.${f === 'jpg' ? 'jpeg' : f}?size=4096`
                    : target.displayAvatarURL({ extension: f === 'jpg' ? 'jpeg' : f, size: 4096 });
                return `[\`.${f}\`](${url})`;
            }).join(' • ')
        )
        .setFooter({ text: `${t.footer} • 4096x4096` })
        .setTimestamp();

    const replyOptions = { embeds: [embed] };
    
    if (context.reply) {
        await context.reply(replyOptions).catch(() => {});
    } else if (context.editReply) {
        await context.editReply(replyOptions).catch(() => {});
    }
}