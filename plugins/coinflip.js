const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { t } = require('../lib/i18n');

const OKL = ['en','fr','bm','zh','ar'];
const gl = (o) => OKL.includes(o?.language) ? o.language : 'en';

module.exports = {
    name: 'coinflip',
    aliases: ['coin', 'flip'],
    description: '🪙 Flip a coin',
    category: 'FUN',
    cooldown: 1,

    data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),

    _flip: (client, gid) => {
        const lang = gl(client?.getServerSettings?.(gid) || {});
        const heads = Math.random() < 0.5;
        return new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(t('fun.coinTitle', lang))
            .setDescription(t('fun.coinResult', lang, { result: t(heads ? 'fun.heads' : 'fun.tails', lang) }))
            .setTimestamp();
    },

    run: async (client, message) => {
        await message.reply({ embeds: [module.exports._flip(client, message.guild?.id)] });
    },

    execute: async (interaction, client) => {
        await interaction.reply({ embeds: [module.exports._flip(client, interaction.guildId)] });
    }
};
