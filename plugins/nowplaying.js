const { SlashCommandBuilder } = require('discord.js');
const { getQueue, buildNowPlayingEmbed, buildControlButtons, ARCHON } = require('./music.js');

module.exports = {
    name: 'nowplaying',
    aliases: ['np', 'current', 'encours'],
    description: '🎵 Show the current track',
    category: 'MUSIC',
    cooldown: 3000,
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('🎵 Show the currently playing track with progress'),

    run: async (client, message) => {
        const q = getQueue(message.guild?.id);
        if (!q?.currentTrack) return message.reply('❌ Nothing is playing!').catch(() => {});
        const embed = buildNowPlayingEmbed(q, client);
        const row = buildControlButtons(q);
        await message.reply({ embeds: [embed], components: [row] }).catch(() => {});
    },

    execute: async (interaction, client) => {
        const q = getQueue(interaction.guild?.id);
        if (!q?.currentTrack) return interaction.reply({ content: '❌ Nothing is playing!', flags: 64 });
        const embed = buildNowPlayingEmbed(q, client);
        const row = buildControlButtons(q);
        await interaction.reply({ embeds: [embed], components: [row] });
    }
};