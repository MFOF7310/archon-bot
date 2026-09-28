const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { t } = require('../lib/i18n');

const OKL = ['en','fr','bm','zh','ar'];
const gl = (o) => OKL.includes(o?.language) ? o.language : 'en';

module.exports = {
    name: 'roll',
    aliases: ['dice'],
    description: '🎲 Roll dice (NdN format: 2d6, 1d20)',
    category: 'FUN',
    cooldown: 1,

    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll dice')
        .addStringOption(o => o.setName('dice').setDescription('Dice in NdN format (default: 1d6)').setRequired(false)),

    _roll: (client, gid, diceStr) => {
        const lang = gl(client?.getServerSettings?.(gid) || {});
        const result = rollDice(diceStr);
        if (!result) return { error: t('fun.rollInvalid', lang) };
        return { embed: new EmbedBuilder().setColor(0xFF4444)
            .setTitle(t('fun.rollTitle', lang))
            .setDescription(t('fun.rollResult', lang, { dice: diceStr, result }))
            .setTimestamp() };
    },

    run: async (client, message, args) => {
        const r = module.exports._roll(client, message.guild?.id, args[0] || '1d6');
        if (r.error) return message.reply(r.error);
        await message.reply({ embeds: [r.embed] });
    },

    execute: async (interaction, client) => {
        const r = module.exports._roll(client, interaction.guildId, interaction.options.getString('dice') || '1d6');
        if (r.error) return interaction.reply({ content: r.error, flags: 64 });
        await interaction.reply({ embeds: [r.embed] });
    }
};

function rollDice(str) {
    const match = str.match(/^(\d+)d(\d+)$/i);
    if (!match) return null;
    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
    let total = 0;
    const rolls = [];
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
    }
    return count > 1 ? `${total} [${rolls.join(', ')}]` : total;
}
