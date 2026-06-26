const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue, ARCHON } = require('./music.js');

module.exports = {
    name: 'pause',
    aliases: ['pa', 'pauser'],
    description: '⏸️ Pause or resume the current track',
    category: 'MUSIC',
    cooldown: 2000,
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('⏸️ Pause or resume the current track'),

    run: async (client, message, args, db, serverSettings) => {
        const q = getQueue(message.guild?.id);
        if (!q?.player) return message.reply('❌ Nothing is playing!').catch(() => {});
        const { AudioPlayerStatus } = require('@discordjs/voice');
        const isPaused = q.player.state.status === AudioPlayerStatus.Paused;
        isPaused ? q.player.unpause() : q.player.pause();
        await message.reply(`${isPaused ? '▶️ Resumed' : '⏸️ Paused'}`).catch(() => {});
    },

    execute: async (interaction, client) => {
        const q = getQueue(interaction.guild?.id);
        if (!q?.player) return interaction.reply({ content: '❌ Nothing is playing!', flags: 64 });
        const { AudioPlayerStatus } = require('@discordjs/voice');
        const isPaused = q.player.state.status === AudioPlayerStatus.Paused;
        isPaused ? q.player.unpause() : q.player.pause();
        if (isPaused) { q.totalPaused += Date.now() - (q.pausedAt || Date.now()); q.pausedAt = null; }
        else { q.pausedAt = Date.now(); }
        const embed = new EmbedBuilder().setColor(isPaused ? ARCHON.green : ARCHON.gold)
            .setDescription(`\`\`\`ansi\n\u001b[1;${isPaused ? '32' : '33'}m▸ ${isPaused ? 'RESUMED' : 'PAUSED'} — Neural stream ${isPaused ? 'active' : 'suspended'}\u001b[0m\n\`\`\``);
        await interaction.reply({ embeds: [embed] });
    }
};