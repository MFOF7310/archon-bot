const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue, ARCHON } = require('./music.js');

module.exports = {
    name: 'volume',
    aliases: ['vol', 'v'],
    description: '🎚️ Set the playback volume',
    category: 'MUSIC',
    cooldown: 2000,
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('🎚️ Set the playback volume (1-100)')
        .addIntegerOption(o => o.setName('level').setDescription('Volume level (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),

    run: async (client, message, args) => {
        const q = getQueue(message.guild?.id);
        if (!q) return message.reply('❌ Nothing is playing!').catch(() => {});
        const vol = parseInt(args[0]);
        if (!vol || vol < 1 || vol > 100) return message.reply('❌ Volume must be 1-100').catch(() => {});
        q.volume = vol;
        try { q.player?.state?.resource?.volume?.setVolume(vol / 100); } catch(e) {}
        await message.reply(`🎚️ Volume set to **${vol}%**`).catch(() => {});
    },

    execute: async (interaction) => {
        const q = getQueue(interaction.guild?.id);
        if (!q) return interaction.reply({ content: '❌ Nothing is playing!', flags: 64 });
        const vol = interaction.options.getInteger('level');
        q.volume = vol;
        try { q.player?.state?.resource?.volume?.setVolume(vol / 100); } catch(e) {}
        const bar = '█'.repeat(Math.round(vol/10)) + '░'.repeat(10 - Math.round(vol/10));
        const embed = new EmbedBuilder().setColor(ARCHON.purple)
            .setDescription(`\`\`\`ansi\n\u001b[1;35m▸ VOLUME\u001b[0m \u001b[1;36m${bar}\u001b[0m \u001b[1;33m${vol}%\u001b[0m\n\`\`\``);
        await interaction.reply({ embeds: [embed] });
    }
};