// /avatar [user] — someone's avatar in full size: the server avatar when they have one, every format (lib/info-cards.js)
const { SlashCommandBuilder } = require('discord.js');
const info = require('../lib/info-cards');
module.exports = {
    name: 'avatar',
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    aliases: ['av', 'pfp'],
    description: 'Your or someone’s avatar in full size', category: 'UTILITY', cooldown: 3000,
    usage: '.avatar [@user]', examples: ['.avatar', '.avatar @user'],
    data: new SlashCommandBuilder().setName('avatar').setDescription('Your or someone’s avatar in full size')
        .setDescriptionLocalizations({ fr: 'Ton avatar ou celui de quelqu’un, en grand' })
        .addUserOption((o) => o.setName('user').setDescription('Whose avatar').setRequired(false)),
    run: async (client, message) => {
        const lang = info.langOf(client, message.guild?.id, message, message.author.id);
        const user = message.mentions.users.first() || message.author;
        const member = message.guild ? (message.mentions.members?.first() || (user.id === message.author.id ? message.member : null)) : null;
        return message.reply(info.avatar(user, member, message.guild, lang)).catch(() => {});
    },
    execute: async (interaction, client) => {
        const lang = info.langOf(client, interaction.guildId, interaction, interaction.user.id);
        const user = interaction.options.getUser('user') || interaction.user;
        const m = interaction.options.getMember?.('user') || (user.id === interaction.user.id ? interaction.member : null);
        const member = m && typeof m.displayAvatarURL === 'function' ? m : null;   // outside a server with ARCHON: a plain object
        return interaction.reply(info.avatar(user, member, interaction.guild, lang));
    },
};
