// /changelog — what changed in ARCHON, in plain words, with a menu for earlier versions.
// The notes come from config/changelog.json (see lib/changelog.js).
const { SlashCommandBuilder } = require('discord.js');
const notes = require('../lib/changelog');
const { pickLang } = require('../lib/pick-lang');

module.exports = {
    name: 'changelog',
    aliases: ['changes', 'updates', 'version', 'whatsnew', 'patch', 'maj', 'misesajour'],
    description: "What's new in ARCHON",
    category: 'SYSTEM',
    usage: '/changelog',
    cooldown: 5000,

    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription("See what's new in ARCHON")
        .setDescriptionLocalizations({ fr: 'Voir les nouveautés d\'ARCHON', 'zh-CN': '查看 ARCHON 的更新内容' }),

    run: async (client, message) => {
        const lang = pickLang(client, message.guild?.id, null, message.author.id);
        return message.reply(notes.view(notes.latest(), lang, message.author.id));
    },

    execute: async (interaction, client) => {
        const lang = pickLang(client, interaction.guildId, interaction);
        return interaction.reply(notes.view(notes.latest(), lang, interaction.user.id));
    },
};
