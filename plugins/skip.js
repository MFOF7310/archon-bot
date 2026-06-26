const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue, ARCHON } = require('./music.js');

module.exports = {
    name: 'skip',
    aliases: ['s', 'next', 'passer'],
    description: '⏭️ Skip the current track',
    category: 'MUSIC',
    cooldown: 2000,
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('⏭️ Skip to the next track'),

    run: async (client, message) => {
        const q = getQueue(message.guild?.id);
        if (!q?.player) return message.reply('❌ Nothing is playing!').catch(() => {});
        q.player.stop();
        await message.reply('⏭️ Skipped!').catch(() => {});
    },

    execute: async (interaction) => {
        const q = getQueue(interaction.guild?.id);
        if (!q?.player) return interaction.reply({ content: '❌ Nothing is playing!', flags: 64 });
        const title = q.currentTrack?.title || 'Unknown';
        q.player.stop();
        const embed = new EmbedBuilder().setColor(ARCHON.cyan)
            .setDescription(`\`\`\`ansi\n\u001b[1;36m▸ SKIPPED\u001b[0m\n\u001b[0;37m${title.substring(0, 60)}\u001b[0m\n\`\`\``);
        await interaction.reply({ embeds: [embed] });
    }
};