const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue, destroyQueue, ARCHON } = require('./music.js');

module.exports = {
    name: 'stop',
    aliases: ['disconnect', 'dc', 'leave', 'arreter'],
    description: '⏹️ Stop music and disconnect',
    category: 'MUSIC',
    cooldown: 2000,
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('⏹️ Stop music and disconnect from voice channel'),

    run: async (client, message) => {
        const guildId = message.guild?.id;
        if (!getQueue(guildId)) return message.reply('❌ Nothing is playing!').catch(() => {});
        destroyQueue(guildId);
        await message.reply('⏹️ Stopped and disconnected.').catch(() => {});
    },

    execute: async (interaction) => {
        const guildId = interaction.guild?.id;
        if (!getQueue(guildId)) return interaction.reply({ content: '❌ Nothing is playing!', flags: 64 });
        destroyQueue(guildId);
        const embed = new EmbedBuilder().setColor(ARCHON.red)
            .setDescription('```ansi\n\u001b[1;31m▸ STOPPED — Neural stream terminated. Queue cleared.\u001b[0m\n```');
        await interaction.reply({ embeds: [embed] });
    }
};