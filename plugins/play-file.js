const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const { createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { join } = require('path');
const { createWriteStream, unlinkSync } = require('fs');
const https = require('https');
const http = require('http');

const {
    getQueue, createQueue, destroyQueue, ensureConnection,
    playNext, buildNowPlayingEmbed, buildControlButtons,
    ARCHON
} = require('./music.js');

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const file = createWriteStream(dest);
        proto.get(url, res => {
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', err => { try { unlinkSync(dest); } catch (e) {} reject(err); });
    });
}

module.exports = {
    name: 'play-file',
    aliases: ['pf', 'playfile'],
    description: '🎵 Play a song from an uploaded audio file',
    category: 'MUSIC',
    usage: '/play-file <attach file>',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('play-file')
        .setDescription('🎵 Play a song from an uploaded audio file')
        .addAttachmentOption(o => o
            .setName('file')
            .setDescription('Audio file to play (mp3, wav, ogg, flac, m4a)')
            .setRequired(true)
        )
        .addBooleanOption(o => o
            .setName('insert-first')
            .setDescription('Insert at the top of the queue')
            .setRequired(false)
        ),

    execute: async (interaction, client) => {
        const attachment = interaction.options.getAttachment('file');
        const insertFirst = interaction.options.getBoolean('insert-first') || false;
        const voiceChannel = interaction.member?.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ **Join a voice channel first!**', flags: 64 });
        }

        // Validate file type
        const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a', 'video/mp4'];
        const ext = attachment.name.split('.').pop()?.toLowerCase();
        const validExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'mp4', 'aac', 'opus'];

        if (!validExts.includes(ext || '')) {
            return interaction.reply({
                content: `❌ **Invalid file type!**\nSupported: mp3, wav, ogg, flac, m4a, aac`,
                flags: 64
            });
        }

        await interaction.deferReply();

        const guildId = interaction.guild.id;
        let q = getQueue(guildId) || createQueue(interaction.guild, voiceChannel, interaction.channel);
        q.textChannel = interaction.channel;

        // Download file to temp
        const tempPath = `/tmp/archon_music_${Date.now()}.${ext}`;
        try {
            await downloadFile(attachment.url, tempPath);
        } catch (err) {
            return interaction.editReply({ content: `❌ Failed to download file: ${err.message}` });
        }

        const track = {
            title: attachment.name.replace(/\.[^/.]+$/, ''),
            query: attachment.name,
            artist: 'File Upload',
            source: 'file',
            duration: 0,
            thumbnail: null,
            requestedBy: interaction.user.username,
            url: tempPath,
            tempPath,
        };

        if (insertFirst) {
            q.tracks.unshift(track);
        } else {
            q.tracks.push(track);
        }

        const isPlaying = q.player && q.currentTrack && q.player.state.status !== AudioPlayerStatus.Idle;

        const queuedEmbed = new EmbedBuilder()
            .setColor(ARCHON.cyan)
            .setAuthor({ name: '// CLASSIFIED // ARCHON MUSIC ENGINE //', iconURL: client.user.displayAvatarURL() })
            .setTitle('🎵 FILE QUEUED')
            .setDescription(
                `\`\`\`ansi\n` +
                `\u001b[1;32m▸ ${insertFirst ? 'INSERTED AT TOP' : 'ADDED TO QUEUE'}\u001b[0m\n` +
                `\u001b[1;36m${track.title.substring(0, 60)}\u001b[0m\n` +
                `\u001b[0;37m Format: ${ext?.toUpperCase()} • Size: ${(attachment.size / 1024 / 1024).toFixed(2)} MB\u001b[0m\n` +
                `\u001b[0;37m Position: ${insertFirst ? '#1' : '#' + q.tracks.length}\u001b[0m\n` +
                `\`\`\``
            )
            .setFooter({ text: `BAMAKO_223 🇲🇱 • NEURAL MUSIC GRID` });

        await interaction.editReply({ embeds: [queuedEmbed] });

        if (!isPlaying) {
            try {
                await ensureConnection(q);
                await playNext(q, client);
            } catch (err) {
                destroyQueue(guildId);
                interaction.editReply({ content: `❌ ${err.message}`, embeds: [] }).catch(() => {});
            }
        }
    }
};
