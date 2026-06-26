const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle
} = require('discord.js');
const {
    joinVoiceChannel, createAudioPlayer, createAudioResource,
    AudioPlayerStatus, VoiceConnectionStatus, entersState,
    getVoiceConnection, StreamType
} = require('@discordjs/voice');
const playdl = require('play-dl');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Initialize play-dl SoundCloud token
(async () => {
    try {
        const clientId = await playdl.getFreeClientID();
        await playdl.setToken({ soundcloud: { client_id: clientId } });
        console.log('[MUSIC] SoundCloud token initialized:', clientId.substring(0, 8) + '...');
    } catch (e) {
        console.error('[MUSIC] SoundCloud token init failed:', e.message);
    }
})();

// Refresh SoundCloud token every 12 hours
setInterval(async () => {
    try {
        const clientId = await playdl.getFreeClientID();
        await playdl.setToken({ soundcloud: { client_id: clientId } });
        console.log('[MUSIC] SoundCloud token refreshed');
    } catch (e) {}
}, 12 * 60 * 60 * 1000);

// ═══════════════════════════════════════════════════════
// ARCHON MUSIC ENGINE — Queue Manager
// ═══════════════════════════════════════════════════════
const queues = new Map(); // guildId → QueueState

function getQueue(guildId) { return queues.get(guildId) || null; }

function createQueue(guild, voiceChannel, textChannel) {
    const state = {
        guild, voiceChannel, textChannel,
        connection: null, player: null,
        tracks: [], currentTrack: null,
        volume: 80, loop: false, autoplay: false,
        startTime: null, pausedAt: null, totalPaused: 0,
    };
    queues.set(guild.id, state);
    return state;
}

function destroyQueue(guildId) {
    const q = queues.get(guildId);
    if (q) {
        try { q.connection?.destroy(); } catch (e) {}
        try { q.player?.stop(); } catch (e) {}
        queues.delete(guildId);
    }
}

// ═══════════════════════════════════════════════════════
// ARCHON COLORS
// ═══════════════════════════════════════════════════════
const ARCHON = {
    cyan: 0x00f0ff, green: 0x00ff88, red: 0xff3333,
    gold: 0xf1c40f, purple: 0x9b59b6, orange: 0xe67e22,
};

// ═══════════════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════════════
function progressBar(current, total, length = 15) {
    if (!total || total === 0) return '░'.repeat(length);
    const pct = Math.min(1, current / total);
    const filled = Math.round(pct * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════
// BUILD NOW PLAYING EMBED
// ═══════════════════════════════════════════════════════
function buildNowPlayingEmbed(q, client) {
    const track = q.currentTrack;
    if (!track) return null;

    const elapsed = q.startTime
        ? Math.floor((Date.now() - q.startTime - q.totalPaused) / 1000)
        : 0;
    const duration = track.duration || 0;
    const bar = progressBar(elapsed, duration);
    const pct = duration > 0 ? Math.min(100, Math.round((elapsed / duration) * 100)) : 0;

    return new EmbedBuilder()
        .setColor(ARCHON.cyan)
        .setAuthor({ name: '// CLASSIFIED // ARCHON MUSIC ENGINE //', iconURL: client.user.displayAvatarURL() })
        .setTitle('🎵 NOW PLAYING')
        .setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;36m▸ TRACK    \u001b[0m ${track.title.substring(0, 50)}\n` +
            `\u001b[1;36m▸ ARTIST   \u001b[0m ${track.artist || 'Unknown'}\n` +
            `\u001b[1;36m▸ SOURCE   \u001b[0m ${track.source || 'Neural Feed'}\n` +
            `\u001b[1;36m▸ ADDED BY \u001b[0m ${track.requestedBy}\n` +
            `\`\`\``
        )
        .addFields(
            {
                name: '📊 NEURAL STREAM',
                value: `\`\`\`ansi\n\u001b[1;32m${bar}\u001b[0m ${pct}%\n\u001b[0;37m${formatTime(elapsed)} / ${formatTime(duration)}\u001b[0m\n\`\`\``,
                inline: false
            },
            { name: '🎚️ VOLUME', value: `\`${q.volume}%\``, inline: true },
            { name: '📋 QUEUE', value: `\`${q.tracks.length} tracks\``, inline: true },
            { name: '🔁 LOOP', value: `\`${q.loop ? 'ON' : 'OFF'}\``, inline: true },
        )
        .setThumbnail(track.thumbnail || client.user.displayAvatarURL())
        .setFooter({ text: `BAMAKO_223 🇲🇱 • NEURAL MUSIC GRID • v${client.version || '3.0.7'}` })
        .setTimestamp();
}

function buildControlButtons(q) {
    const isPaused = q.player?.state?.status === AudioPlayerStatus.Paused;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_pause').setLabel(isPaused ? 'Resume' : 'Pause').setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(isPaused ? '▶️' : '⏸️'),
        new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setStyle(ButtonStyle.Primary).setEmoji('⏭️'),
        new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️'),
        new ButtonBuilder().setCustomId('music_loop').setLabel(q.loop ? 'Loop ON' : 'Loop').setStyle(q.loop ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🔁'),
        new ButtonBuilder().setCustomId('music_queue').setLabel('Queue').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
    );
}

// ═══════════════════════════════════════════════════════
// PLAY NEXT TRACK
// ═══════════════════════════════════════════════════════
async function playNext(q, client) {
    if (q.tracks.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(ARCHON.orange)
            .setDescription('```ansi\n\u001b[1;33m▸ QUEUE EMPTY — Neural stream ended.\u001b[0m\n```');
        q.textChannel?.send({ embeds: [embed] }).catch(() => {});
        setTimeout(() => destroyQueue(q.guild.id), 30000);
        return;
    }

    const track = q.tracks.shift();
    q.currentTrack = track;
    q.startTime = Date.now();
    q.totalPaused = 0;
    q.pausedAt = null;

    // Save to music history
    try {
        const db = require('better-sqlite3')('/root/cloud-gaming-223-digital-engine/data/database.sqlite');
        const existing = db.prepare('SELECT id, play_count FROM music_history WHERE guild_id = ? AND query = ?').get(q.guild.id, track.query || track.title);
        if (existing) {
            db.prepare('UPDATE music_history SET play_count = play_count + 1, played_at = ? WHERE id = ?').run(Math.floor(Date.now()/1000), existing.id);
        } else {
            db.prepare('INSERT INTO music_history (guild_id, title, query, source) VALUES (?, ?, ?, ?)').run(q.guild.id, track.title, track.query || track.title, track.source || 'SoundCloud');
        }
        db.close();
    } catch(e) {}

    console.log('[MUSIC] playNext called, track:', track?.title, 'queue size:', q.tracks.length);
    try {
        let resource;

        if (track.source === 'file') {
            const { createReadStream } = require('fs');
            const { createAudioResource: car } = require('@discordjs/voice');
            resource = car(createReadStream(track.url), {
                inputType: StreamType.Arbitrary,
                inlineVolume: true,
            });
        } else {
            // Try SoundCloud first, then YouTube via yt-dlp
            let stream = null;

            try {
                // Ensure token is set before search
                const scId = await playdl.getFreeClientID();
                await playdl.setToken({ soundcloud: { client_id: scId } });
                console.log('[MUSIC] Searching SoundCloud for:', track.query || track.title);
                const scSearch = await playdl.search(track.query || track.title, { source: { soundcloud: 'tracks' }, limit: 1 });
                console.log('[MUSIC] SoundCloud results:', scSearch.length);
                if (scSearch.length > 0) {
                    const scUrl = scSearch[0].permalink || scSearch[0].url;
                    console.log('[MUSIC] Streaming:', scUrl);
                    stream = await playdl.stream(scUrl);
                    track.source = 'SoundCloud';
                    track.duration = scSearch[0].durationInSec;
                    track.thumbnail = scSearch[0].thumbnail?.url;
                    track.artist = scSearch[0].publisher?.artist || scSearch[0].user?.name;
                    console.log('[MUSIC] Stream type:', stream.type);
                }
            } catch (e) {
                console.error('[MUSIC] SoundCloud stream error:', e.message);
            }

            if (!stream) {
                try {
                    const ytSearch = `ytsearch1:${track.query || track.title}`;
                    const { stdout } = await execAsync(`yt-dlp -x --audio-format mp3 --get-url "${ytSearch}" 2>/dev/null`, { timeout: 15000 });
                    const url = stdout.trim().split('\n')[0];
                    if (url) {
                        stream = await playdl.stream(url, { quality: 2 }).catch(() => null);
                        track.source = 'YouTube';
                    }
                } catch (e) {}
            }

            if (!stream && !resource) throw new Error('Could not find audio stream');

            if (!resource) {
                resource = createAudioResource(stream.stream, {
                    inputType: stream.type,
                    inlineVolume: true,
                });
            }
        }

        resource.volume?.setVolume(q.volume / 100);
        q.player.play(resource);

        const embed = buildNowPlayingEmbed(q, client);
        const row = buildControlButtons(q);
        const msg = await q.textChannel?.send({ embeds: [embed], components: [row] }).catch(() => {});

        // Button collector
        if (msg) {
            const collector = msg.createMessageComponentCollector({ time: 600000 });
            collector.on('collect', async (i) => {
                if (!i.member?.voice?.channel) {
                    return i.reply({ content: '❌ Join a voice channel first!', flags: 64 }).catch(() => {});
                }
                await i.deferUpdate().catch(() => {});
                const qState = getQueue(q.guild.id);
                if (!qState) return;

                switch (i.customId) {
                    case 'music_pause':
                        if (qState.player.state.status === AudioPlayerStatus.Paused) {
                            qState.player.unpause();
                            qState.totalPaused += Date.now() - (qState.pausedAt || Date.now());
                            qState.pausedAt = null;
                        } else {
                            qState.player.pause();
                            qState.pausedAt = Date.now();
                        }
                        await i.editReply({ components: [buildControlButtons(qState)] }).catch(() => {});
                        break;
                    case 'music_skip':
                        qState.player.stop();
                        break;
                    case 'music_stop':
                        destroyQueue(q.guild.id);
                        await i.editReply({ components: [] }).catch(() => {});
                        await i.followUp({ content: '⏹️ Playback stopped.', flags: 64 }).catch(() => {});
                        break;
                    case 'music_loop':
                        qState.loop = !qState.loop;
                        if (qState.loop && qState.currentTrack) qState.tracks.unshift({ ...qState.currentTrack });
                        await i.editReply({ components: [buildControlButtons(qState)] }).catch(() => {});
                        break;
                    case 'music_queue':
                        const qEmbed = buildQueueEmbed(qState, client);
                        await i.followUp({ embeds: [qEmbed], flags: 64 }).catch(() => {});
                        break;
                }
            });
            collector.on('end', () => {
                msg.edit({ components: [] }).catch(() => {});
            });
        }

    } catch (err) {
        console.error('[MUSIC] Playback error:', err.message);
        const errEmbed = new EmbedBuilder()
            .setColor(ARCHON.red)
            .setDescription(`\`\`\`ansi\n\u001b[1;31m▸ STREAM ERROR\u001b[0m\n\u001b[0;37m${err.message.substring(0, 100)}\u001b[0m\n\`\`\``);
        q.textChannel?.send({ embeds: [errEmbed] }).catch(() => {});
        setTimeout(() => playNext(q, client), 2000);
    }
}

// ═══════════════════════════════════════════════════════
// BUILD QUEUE EMBED
// ═══════════════════════════════════════════════════════
function buildQueueEmbed(q, client) {
    const tracks = q.tracks.slice(0, 10);
    const qList = tracks.length > 0
        ? tracks.map((t, i) => `\u001b[0;37m${(i + 1).toString().padStart(2)}.\u001b[0m \u001b[1;36m${t.title.substring(0, 40)}\u001b[0m`).join('\n')
        : '\u001b[0;37m  Queue is empty\u001b[0m';

    return new EmbedBuilder()
        .setColor(ARCHON.purple)
        .setAuthor({ name: '// CLASSIFIED // ARCHON MUSIC ENGINE //', iconURL: client.user.displayAvatarURL() })
        .setTitle('📋 NEURAL QUEUE')
        .addFields(
            {
                name: `NOW PLAYING`,
                value: `\`\`\`ansi\n\u001b[1;32m▸ ${q.currentTrack?.title?.substring(0, 50) || 'Nothing'}\u001b[0m\n\`\`\``,
                inline: false
            },
            {
                name: `UP NEXT (${q.tracks.length} tracks)`,
                value: `\`\`\`ansi\n${qList}\n\`\`\``,
                inline: false
            }
        )
        .setFooter({ text: `BAMAKO_223 🇲🇱 • Volume: ${q.volume}% • Loop: ${q.loop ? 'ON' : 'OFF'}` });
}

// ═══════════════════════════════════════════════════════
// ENSURE VOICE CONNECTION
// ═══════════════════════════════════════════════════════
async function ensureConnection(q, client) {
    if (client) q._client = client;
    let connection = getVoiceConnection(q.guild.id);
    if (!connection) {
        // Stage channels need selfDeaf: false and speaker request
        const isStage = q.voiceChannel.type === 13; // ChannelType.GuildStageVoice
        connection = joinVoiceChannel({
            channelId: q.voiceChannel.id,
            guildId: q.guild.id,
            adapterCreator: q.guild.voiceAdapterCreator,
            selfDeaf: !isStage,
            selfMute: false,
            debug: true,
        });
        // Request to speak in stage channel
        if (isStage) {
            try {
                await q.guild.members.me?.voice.setSuppressed(false);
            } catch (e) {}
        }
        q.connection = connection;

        // Handle disconnection
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch (e) {
                destroyQueue(q.guild.id);
            }
        });
    }

    console.log('[MUSIC] Connecting to voice channel:', q.voiceChannel.id, 'Guild:', q.guild.id);
    console.log('[MUSIC] Connection state:', connection.state.status);
    connection.on('stateChange', (oldState, newState) => {
        console.log('[MUSIC] Voice state:', oldState.status, '->', newState.status);
    });
    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (e) {
        destroyQueue(q.guild.id);
        throw new Error('Could not connect to voice channel — check bot permissions');
    }

    if (!q.player) {
        const player = createAudioPlayer();
        q.player = player;
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
            if (q.loop && q.currentTrack) {
                q.tracks.unshift({ ...q.currentTrack });
            }
            // Autoplay — find similar song when queue is empty
            if (q.tracks.length === 0 && q.autoplay && q.currentTrack) {
                const similar = q.currentTrack.artist || q.currentTrack.title;
                q.tracks.push({
                    title: similar + ' mix',
                    query: similar,
                    artist: 'Unknown',
                    source: 'SoundCloud',
                    duration: 0,
                    thumbnail: null,
                    requestedBy: '🤖 Autoplay',
                    url: null,
                });
            }
            playNext(q, q._client);
        });

        player.on('error', (err) => {
            console.error('[MUSIC PLAYER ERROR]', err.message);
            playNext(q, q._client);
        });
    }

    return connection;
}

// ═══════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════
module.exports = {
    name: 'play',
    aliases: ['p', 'music', 'jouer'],
    description: '🎵 Play music in your voice channel',
    category: 'MUSIC',
    usage: '.play <song name or URL>',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('🎵 Play a song in your voice channel')
        .addStringOption(o => o
            .setName('query')
            .setDescription('Song name, URL, or search query')
            .setRequired(true)
        ),

    // Export queue utilities for play-file.js
    getQueue, createQueue, destroyQueue, ensureConnection,
    playNext, buildNowPlayingEmbed, buildControlButtons, buildQueueEmbed,
    ARCHON, progressBar, formatTime,

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const lang = client.detectLanguage ? client.detectLanguage(usedCommand, message.guild?.id) : 'en';
        const query = args.join(' ');

        if (!query) return message.reply('❌ Provide a song name or URL!').catch(() => {});

        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) return message.reply('❌ **Join a voice channel first!**').catch(() => {});

        const guildId = message.guild.id;
        let q = getQueue(guildId) || createQueue(message.guild, voiceChannel, message.channel);
        q.textChannel = message.channel;

        const track = {
            title: query,
            query,
            artist: 'Unknown',
            source: 'SoundCloud',
            duration: 0,
            thumbnail: null,
            requestedBy: message.author.username,
            url: null,
        };

        q.tracks.push(track);

        const queuedEmbed = new EmbedBuilder()
            .setColor(ARCHON.cyan)
            .setDescription(`\`\`\`ansi\n\u001b[1;32m▸ QUEUED\u001b[0m \u001b[1;36m${query.substring(0, 60)}\u001b[0m\n\u001b[0;37m Position: #${q.tracks.length}\u001b[0m\n\`\`\``);
        await message.reply({ embeds: [queuedEmbed] }).catch(() => {});

        if (!q.player || q.player.state.status === AudioPlayerStatus.Idle || !q.currentTrack) {
            try {
                await ensureConnection(q, client);
                await playNext(q, client);
            } catch (err) {
                destroyQueue(guildId);
                message.reply(`❌ ${err.message}`).catch(() => {});
            }
        }
    },

    execute: async (interaction, client) => {
        const query = interaction.options.getString('query');
        const voiceChannel = interaction.member?.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ **Join a voice channel first!**', flags: 64 });
        }

        await interaction.deferReply();

        // Show recent suggestions alongside the queued track
        let suggestions = [];
        try {
            const db = require('better-sqlite3')('/root/cloud-gaming-223-digital-engine/data/database.sqlite');
            suggestions = db.prepare('SELECT title, query FROM music_history WHERE guild_id = ? AND query != ? ORDER BY play_count DESC, played_at DESC LIMIT 4').all(interaction.guild.id, query);
            db.close();
        } catch(e) {}

        const guildId = interaction.guild.id;
        let q = getQueue(guildId) || createQueue(interaction.guild, voiceChannel, interaction.channel);
        q.textChannel = interaction.channel;

        const track = {
            title: query,
            query,
            artist: 'Unknown',
            source: 'SoundCloud',
            duration: 0,
            thumbnail: null,
            requestedBy: interaction.user.username,
            url: null,
        };

        q.tracks.push(track);

        const isPlaying = q.player && q.currentTrack && q.player.state.status !== AudioPlayerStatus.Idle;

        const queuedEmbed = new EmbedBuilder()
            .setColor(ARCHON.cyan)
            .setAuthor({ name: '// CLASSIFIED // ARCHON MUSIC ENGINE //', iconURL: client.user.displayAvatarURL() })
            .setDescription(
                isPlaying
                    ? `\`\`\`ansi\n\u001b[1;32m▸ ADDED TO QUEUE\u001b[0m\n\u001b[1;36m${query.substring(0, 60)}\u001b[0m\n\u001b[0;37m Position: #${q.tracks.length}\u001b[0m\n\`\`\``
                    : `\`\`\`ansi\n\u001b[1;36m▸ LOADING NEURAL STREAM...\u001b[0m\n\u001b[0;37m${query.substring(0, 60)}\u001b[0m\n\`\`\``
            )
            .setFooter({ text: `BAMAKO_223 🇲🇱 • NEURAL MUSIC GRID` });

        // Build suggestion buttons if we have history
        const components = [];
        if (suggestions.length > 0) {
            const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
            const suggestMenu = new StringSelectMenuBuilder()
                .setCustomId(`music_suggest_${interaction.user.id}`)
                .setPlaceholder('🎵 Queue a suggested track...')
                .addOptions(suggestions.map(s => ({
                    label: s.title.substring(0, 100),
                    value: s.query.substring(0, 100),
                    emoji: '🎵'
                })));
            components.push(new ActionRowBuilder().addComponents(suggestMenu));
        }

        await interaction.editReply({ embeds: [queuedEmbed], components });

        // Handle suggestion selection
        if (components.length > 0) {
            const reply = await interaction.fetchReply();
            const collector = reply.createMessageComponentCollector({ time: 30000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Not your session', flags: 64 }).catch(() => {});
                await i.deferUpdate().catch(() => {});
                const selectedQuery = i.values[0];
                const qState = getQueue(interaction.guild.id);
                if (qState) {
                    qState.tracks.push({
                        title: selectedQuery,
                        query: selectedQuery,
                        artist: 'Unknown',
                        source: 'SoundCloud',
                        duration: 0,
                        thumbnail: null,
                        requestedBy: interaction.user.username,
                        url: null,
                    });
                    await i.followUp({ content: `✅ Added **${selectedQuery.substring(0,50)}** to queue!`, flags: 64 }).catch(() => {});
                }
                collector.stop();
            });
            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });
        }

        if (!isPlaying) {
            try {
                await ensureConnection(q, client);
                await playNext(q, client);
            } catch (err) {
                destroyQueue(guildId);
                interaction.editReply({ content: `❌ ${err.message}`, embeds: [] }).catch(() => {});
            }
        }
    }
};
