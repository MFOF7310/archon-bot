const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue, ARCHON } = require('./music.js');

module.exports = {
    name: 'loop',
    aliases: ['repeat', 'boucle'],
    description: '🔁 Toggle loop mode',
    category: 'MUSIC',
    cooldown: 2000,
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('🔁 Toggle loop mode for the current track'),

    run: async (client, message) => {
        const q = getQueue(message.guild?.id);
        if (!q) return message.reply('❌ Nothing is playing!').catch(() => {});
        q.loop = !q.loop;
        await message.reply(`🔁 Loop ${q.loop ? 'enabled' : 'disabled'}`).catch(() => {});
    },

    execute: async (interaction) => {
        const q = getQueue(interaction.guild?.id);
        if (!q) return interaction.reply({ content: '❌ Nothing is playing!', flags: 64 });
        q.loop = !q.loop;
        if (q.loop && q.currentTrack) q.tracks.unshift({...q.currentTrack});
        const embed = new EmbedBuilder().setColor(q.loop ? ARCHON.green : ARCHON.orange)
            .setDescription(`\`\`\`ansi\n\u001b[1;${q.loop ? '32' : '33'}m▸ LOOP ${q.loop ? 'ENABLED' : 'DISABLED'}\u001b[0m\n\`\`\``);
        await interaction.reply({ embeds: [embed] });
    }
};