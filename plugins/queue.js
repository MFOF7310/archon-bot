const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue, buildQueueEmbed, ARCHON } = require('./music.js');

module.exports = {
    name: 'queue',
    aliases: ['q', 'file', 'liste'],
    description: '📋 View the current music queue',
    category: 'MUSIC',
    cooldown: 3000,
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('📋 View the current music queue'),

    run: async (client, message) => {
        const q = getQueue(message.guild?.id);
        if (!q) return message.reply('❌ Nothing is playing!').catch(() => {});
        const embed = buildQueueEmbed(q, client);
        await message.reply({ embeds: [embed] }).catch(() => {});
    },

    execute: async (interaction, client) => {
        const q = getQueue(interaction.guild?.id);
        if (!q) return interaction.reply({ content: '❌ Nothing is playing!', flags: 64 });
        const embed = buildQueueEmbed(q, client);
        await interaction.reply({ embeds: [embed] });
    }
};