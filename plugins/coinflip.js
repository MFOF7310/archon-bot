// plugins/coinflip.js — /coinflip: heads or tails (lib/fun cards, Flip again in the same card)
const { SlashCommandBuilder } = require('discord.js');
const fun = require('../lib/fun');
const { icon } = require('../lib/ui/icons');

function funMake(client, { guild, user, lang, priv }) {
    const heads = Math.random() < 0.5;
    return fun.textCard(guild, lang, {
        color: 0xEF9F27, body: `### ${icon('coin', guild)} ${fun.F(heads ? 'heads' : 'tails', lang)}`,
        lines: [fun.F('by', lang, { user: fun.safe(user.displayName || user.globalName || user.username, 40) })],
        again: ['coin', user.id, null, fun.F('flipAgain', lang)], priv,
    });
}

module.exports = {
    name: 'coinflip',
    aliases: ['coin', 'flip'],
    description: 'Flip a coin',
    category: 'FUN',
    cooldown: 1000,
    funMake,
    data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),
    run: async (client, message) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        return message.reply(funMake(client, { guild: message.guild, user: message.author, lang })).catch(() => {});
    },
    execute: async (ix, client) => {
        const lang = fun.langOf(client, ix.guildId, ix, ix.user.id);
        return ix.reply(funMake(client, { guild: ix.guild, user: ix.user, lang }));
    },
};
