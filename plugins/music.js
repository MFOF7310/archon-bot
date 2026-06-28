const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder
} = require('discord.js');
const {
    joinVoiceChannel, createAudioPlayer, createAudioResource,
    AudioPlayerStatus, VoiceConnectionStatus, entersState,
    getVoiceConnection, StreamType
} = require('@discordjs/voice');
const playdl = require('play-dl');
const { exec } = require('child_process');
const { promisify } = require('util');
const { createWriteStream, unlinkSync } = require('fs');
const https = require('https');
const http = require('http');
const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════
// QUEUE MANAGER
// ═══════════════════════════════════════════════════════
const queues = new Map();

function getQueue(guildId) { return queues.get(guildId) || null; }

const INACTIVITY_MS = 3 * 60 * 1000;
function resetInactivityTimer(q) {
    if (q.inactivityTimer) clearTimeout(q.inactivityTimer);
    q.inactivityTimer = setTimeout(async () => {
        const qNow = queues.get(q.guild.id);
        if (!qNow) return;
        if (qNow.player?.state?.status === AudioPlayerStatus.Playing) { resetInactivityTimer(qNow); return; }
        try {
            await qNow.textChannel?.send({ embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription('⚠️ Left the voice channel due to inactivity. Use /music play to start a new session.')] });
        } catch(e) {}
        destroyQueue(q.guild.id);
    }, INACTIVITY_MS);
}
function clearInactivityTimer(q) {
    if (q.inactivityTimer) { clearTimeout(q.inactivityTimer); q.inactivityTimer = null; }
}

function createQueue(guild, voiceChannel, textChannel, client) {
    const state = {
        guild, voiceChannel, textChannel, _client: client,
        connection: null, player: null,
        tracks: [], currentTrack: null, trackHistory: [],
        volume: 80, loop: false, autoplay: true,
        libraryIndex: -1, // -1 = not in library mode; >= 0 = current library position
        startTime: null, pausedAt: null, totalPaused: 0,
        persistentMsg: null, updateInterval: null,
        inactivityTimer: null,
    };
    queues.set(guild.id, state);
    return state;
}

function destroyQueue(guildId) {
    const q = queues.get(guildId);
    if (q) {
        try { q.connection?.destroy(); } catch (e) {}
        try { q.player?.stop(true); } catch (e) {}
        queues.delete(guildId);
    }
}

// ═══════════════════════════════════════════════════════
// ARCHON STYLE
// ═══════════════════════════════════════════════════════
const ARCHON = {
    cyan: 0x00f0ff, green: 0x00ff88, red: 0xff3333,
    gold: 0xf1c40f, purple: 0x9b59b6, orange: 0xe67e22,
};

function progressBar(cur, total, len = 15) {
    if (!total) return '░'.repeat(len);
    const f = Math.round(Math.min(1, cur / total) * len);
    return '█'.repeat(f) + '░'.repeat(len - f);
}

function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
}

// ═══════════════════════════════════════════════════════
// EMBEDS
// ═══════════════════════════════════════════════════════
function buildNowPlayingEmbed(q, client) {
    const t = q.currentTrack;
    if (!t) return null;
    const elapsed = q.startTime ? Math.floor((Date.now() - q.startTime - q.totalPaused) / 1000) : 0;
    const bar = progressBar(elapsed, t.duration);
    const pct = t.duration > 0 ? Math.min(100, Math.round((elapsed / t.duration) * 100)) : 0;
    return new EmbedBuilder()
        .setColor(ARCHON.cyan)
        .setAuthor({ 
            name: '// CLASSIFIED // ARCHON MUSIC ENGINE //', 
            iconURL: t.spotifyUrl 
                ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/168px-Spotify_logo_without_text.svg.png'
                : client.user.displayAvatarURL()
        })
        .setTitle(`${t.spotifyUrl ? '🟢' : '🎵'} NOW PLAYING`)
        .setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;36m▸ TRACK    \u001b[0m ${t.title.substring(0,50)}\n` +
            `\u001b[1;36m▸ ARTIST   \u001b[0m ${t.artist || 'Unknown'}\n` +
            `\u001b[1;36m▸ ALBUM    \u001b[0m ${t.album || 'Unknown'}\n` +
            `\u001b[1;36m▸ SOURCE   \u001b[0m ${t.source || 'Neural Feed'}\n` +
            `\u001b[1;36m▸ ADDED BY \u001b[0m ${t.requestedBy}\n` +
            `\`\`\``
        )
        .addFields(
            { name: '📊 NEURAL STREAM', value: `\`\`\`ansi\n\u001b[1;32m${bar}\u001b[0m ${pct}%\n\u001b[0;37m${formatTime(elapsed)} / ${formatTime(t.duration)}\u001b[0m\n\`\`\``, inline: false },
            { name: '🎚️ VOLUME', value: `\`${q.volume}%\``, inline: true },
            { name: '📋 QUEUE', value: `\`${q.tracks.length} tracks\``, inline: true },
            { name: '🔁 LOOP', value: `\`${q.loop ? 'ON' : 'OFF'}\``, inline: true },
        )
        .setThumbnail(t.thumbnail || client.user.displayAvatarURL())
        .setFooter({ text: `BAMAKO_223 🇲🇱 • NEURAL MUSIC GRID` })
        .setTimestamp();
}

function buildControls(q) {
    const isPaused = q.player?.state?.status === AudioPlayerStatus.Paused;
    const hasPrev = q.trackHistory && q.trackHistory.length > 0;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mc_prev').setLabel('Prev').setStyle(ButtonStyle.Secondary).setEmoji('⏮️').setDisabled(!hasPrev),
        new ButtonBuilder().setCustomId('mc_pause').setLabel(isPaused ? 'Resume' : 'Pause').setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(isPaused ? '▶️' : '⏸️'),
        new ButtonBuilder().setCustomId('mc_skip').setLabel('Skip').setStyle(ButtonStyle.Primary).setEmoji('⏭️'),
        new ButtonBuilder().setCustomId('mc_stop').setLabel('Stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️'),
        new ButtonBuilder().setCustomId('mc_loop').setLabel(q.loop ? 'Loop ON' : 'Loop').setStyle(q.loop ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🔁'),
    );
}

function buildQueueEmbed(q, client) {
    const list = q.tracks.slice(0, 10).map((t, i) =>
        `\u001b[0;37m${(i+1).toString().padStart(2)}.\u001b[0m \u001b[1;36m${t.title.substring(0,40)}\u001b[0m`
    ).join('\n') || '\u001b[0;37m  Queue is empty\u001b[0m';
    return new EmbedBuilder()
        .setColor(ARCHON.purple)
        .setAuthor({ name: '// CLASSIFIED // ARCHON MUSIC ENGINE //', iconURL: client.user.displayAvatarURL() })
        .setTitle('📋 NEURAL QUEUE')
        .addFields(
            { name: 'NOW PLAYING', value: `\`\`\`ansi\n\u001b[1;32m▸ ${q.currentTrack?.title?.substring(0,50) || 'Nothing'}\u001b[0m\n\`\`\``, inline: false },
            { name: `UP NEXT (${q.tracks.length})`, value: `\`\`\`ansi\n${list}\n\`\`\``, inline: false }
        )
        .setFooter({ text: `BAMAKO_223 🇲🇱 • Vol: ${q.volume}% • Loop: ${q.loop ? 'ON' : 'OFF'}` });
}

// ═══════════════════════════════════════════════════════
// PERSISTENT MUSIC PANEL
// ═══════════════════════════════════════════════════════
async function updatePersistentPanel(q) {
    const client = q._client;
    if (!client || !q.currentTrack) return;

    const t = q.currentTrack;
    const elapsed = q.startTime ? Math.floor((Date.now() - q.startTime - q.totalPaused) / 1000) : 0;
    const duration = t.duration || 0;
    const bar = progressBar(elapsed, duration, 18);
    const pct = duration > 0 ? Math.min(100, Math.round((elapsed/duration)*100)) : 0;
    const isPaused = q.player?.state?.status === AudioPlayerStatus.Paused;

    const statusLine = isPaused ? '⏸️ PAUSED' : '🟢 LIVE';
    const sourceLine = t.spotifyUrl ? '🟢 Spotify' : `🎵 ${t.source || 'SoundCloud'}`;

    const embed = new EmbedBuilder()
        .setColor(isPaused ? ARCHON.gold : ARCHON.cyan)
        .setAuthor({
            name: isPaused ? '⏸️ PAUSED — ARCHON MUSIC' : '🎵 NOW PLAYING — ARCHON MUSIC',
            iconURL: t.spotifyUrl
                ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/168px-Spotify_logo_without_text.svg.png'
                : client.user.displayAvatarURL()
        })
        .setDescription(
            `**${t.title.substring(0,50)}**\n` +
            `${t.artist || 'Unknown Artist'}${t.album ? ` • ${t.album.substring(0,25)}` : ''}\n\n` +
            `${bar} **${pct}%**\n` +
            `\`${formatTime(elapsed)}\` ─── \`${formatTime(duration)}\`\n\n` +
            `👤 ${t.requestedBy} • 📍 ${q.voiceChannel?.name?.substring(0,15) || 'Voice'} • ${sourceLine}`
        )
        .setThumbnail(t.thumbnail || client.user.displayAvatarURL())
        .setFooter({ text: `BAMAKO_223 🇲🇱 • Queue: ${q.tracks.length} • Loop: ${q.loop ? 'ON' : 'OFF'} • Auto: ${q.autoplay ? 'ON' : 'OFF'} • Updates every 15s` })
        .setTimestamp();

    const hasPrev = q.trackHistory && q.trackHistory.length > 0;
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mc_prev').setLabel('Prev').setStyle(ButtonStyle.Secondary).setEmoji('⏮️').setDisabled(!hasPrev),
        new ButtonBuilder().setCustomId('mc_pause').setLabel(isPaused ? 'Resume' : 'Pause').setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(isPaused ? '▶️' : '⏸️'),
        new ButtonBuilder().setCustomId('mc_skip').setLabel('Skip').setStyle(ButtonStyle.Primary).setEmoji('⏭️'),
        new ButtonBuilder().setCustomId('mc_stop').setLabel('Stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️'),
        new ButtonBuilder().setCustomId('mc_loop').setLabel(q.loop ? 'Loop ON' : 'Loop').setStyle(q.loop ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🔁'),
    );

    try {
        if (q.persistentMsg) {
            await q.persistentMsg.edit({ embeds: [embed], components: [row1] }).catch(() => {
                q.persistentMsg = null;
            });
        }
        if (!q.persistentMsg && q.textChannel) {
            q.persistentMsg = await q.textChannel.send({ embeds: [embed], components: [row1] }).catch(() => null);
            // Set up button collector on persistent message
            if (q.persistentMsg) {
                const collector = q.persistentMsg.createMessageComponentCollector({ time: 21600000 }); // 6 hours
                collector.on('collect', async (i) => {
                    if (!i.member?.voice?.channel) return i.reply({ content: '❌ Join a voice channel!', flags: 64 }).catch(() => {});
                    await i.deferUpdate().catch(() => {});
                    const qNow = getQueue(q.guild.id);
                    if (!qNow) return;
                    if (i.customId === 'mc_prev') {
                        if (!qNow.trackHistory || qNow.trackHistory.length === 0) {
                            await i.followUp({ content: '⏮️ No previous track.', flags: 64 }).catch(() => {});
                            return;
                        }
                        const prev = qNow.trackHistory.shift();
                        // Put current track back at front of queue, play previous
                        if (qNow.currentTrack) qNow.tracks.unshift({...qNow.currentTrack});
                        qNow.tracks.unshift(prev);
                        qNow.player.stop(); // Triggers Idle → playNext
                    } else if (i.customId === 'mc_pause') {
                        if (qNow.player.state.status === AudioPlayerStatus.Paused) {
                            qNow.player.unpause();
                            qNow.totalPaused += Date.now() - (qNow.pausedAt || Date.now());
                            qNow.pausedAt = null;
                        } else { qNow.player.pause(); qNow.pausedAt = Date.now(); }
                        await updatePersistentPanel(qNow);
                    } else if (i.customId === 'mc_skip') {
                        qNow.player.stop();
                    } else if (i.customId === 'mc_stop') {
                        if (qNow.persistentMsg) {
                            const stoppedEmbed = new EmbedBuilder().setColor(ARCHON.red)
                                .setDescription('\`\`\`ansi\n\u001b[1;31m▸ STOPPED — Neural stream terminated.\u001b[0m\n\`\`\`');
                            await qNow.persistentMsg.edit({ embeds: [stoppedEmbed], components: [] }).catch(() => {});
                            qNow.persistentMsg = null;
                        }
                        destroyQueue(q.guild.id);
                    } else if (i.customId === 'mc_loop') {
                        qNow.loop = !qNow.loop;
                        // NOTE: do NOT unshift here — AudioPlayerStatus.Idle handler does it
                        // Unshifting here caused the current track to play twice
                        await updatePersistentPanel(qNow);
                    } else if (i.customId === 'mc_queue') {
                        await i.followUp({ embeds: [buildQueueEmbed(qNow, client)], flags: 64 }).catch(() => {});
                    }
                });
            }
        }
    } catch(e) {
        console.error('[MUSIC PANEL] Update error:', e.message);
    }
}

// Start/stop auto-update interval
function startPanelUpdater(q) {
    if (q.updateInterval) clearInterval(q.updateInterval);
    q.updateInterval = setInterval(() => {
        const qNow = getQueue(q.guild.id);
        if (!qNow || !qNow.currentTrack) {
            clearInterval(q.updateInterval);
            return;
        }
        updatePersistentPanel(qNow).catch(() => {});
    }, 15000);
}

// ═══════════════════════════════════════════════════════
// SPOTIFY TOKEN MANAGER
// ═══════════════════════════════════════════════════════
const { execSync } = require('child_process');
let spotifyToken = null;
let spotifyExpiry = 0;

async function getSpotifyToken() {
    if (spotifyToken && Date.now() < spotifyExpiry) return spotifyToken;
    try {
        const id = process.env.SPOTIFY_CLIENT_ID;
        const secret = process.env.SPOTIFY_CLIENT_SECRET;
        if (!id || !secret) return null;
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=client_credentials&client_id=${id}&client_secret=${secret}`
        });
        const data = await res.json();
        spotifyToken = data.access_token;
        spotifyExpiry = Date.now() + (data.expires_in - 60) * 1000;
        console.log('[MUSIC] Spotify token refreshed ✅');
        return spotifyToken;
    } catch(e) {
        console.error('[MUSIC] Spotify token error:', e.message);
        return null;
    }
}

async function searchSpotify(query) {
    try {
        const token = await getSpotifyToken();
        if (!token) return null;
        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const track = data.tracks?.items?.[0];
        if (!track) return null;
        return {
            title: track.name,
            artist: track.artists?.map(a => a.name).join(', '),
            album: track.album?.name,
            thumbnail: track.album?.images?.[0]?.url,
            duration: Math.floor(track.duration_ms / 1000),
            spotifyUrl: track.external_urls?.spotify,
            previewUrl: track.preview_url,
        };
    } catch(e) {
        return null;
    }
}

// ═══════════════════════════════════════════════════════
// SOUNDCLOUD TOKEN INIT
// ═══════════════════════════════════════════════════════
let scReady = false;
(async () => {
    try {
        const id = await playdl.getFreeClientID();
        await playdl.setToken({ soundcloud: { client_id: id } });
        scReady = true;
        console.log('[MUSIC] SoundCloud ready ✅');
    } catch (e) { console.error('[MUSIC] SoundCloud init failed:', e.message); }
})();
setInterval(async () => {
    try {
        const id = await playdl.getFreeClientID();
        await playdl.setToken({ soundcloud: { client_id: id } });
    } catch (e) {}
}, 12 * 60 * 60 * 1000);

// ═══════════════════════════════════════════════════════
// DOWNLOAD FILE
// ═══════════════════════════════════════════════════════
async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const file = createWriteStream(dest);
        proto.get(url, res => { res.pipe(file); file.on('finish', () => { file.close(); resolve(); }); })
            .on('error', err => { try { unlinkSync(dest); } catch(e) {} reject(err); });
    });
}

// ═══════════════════════════════════════════════════════
// PLAY NEXT
// ═══════════════════════════════════════════════════════
async function playNext(q) {
    const client = q._client;
    if (!q || !q.guild) return; // Guard: queue destroyed
    if (q.tracks.length > 0 && !q.tracks[0]) { q.tracks = q.tracks.filter(Boolean); }
    if (q.tracks.length === 0) {
        // Smart autoplay — library-aware sequential play
        if (q.autoplay && q.currentTrack && q.currentTrack.source !== 'file') {
            try {
                const lib = require('../data/music-library.json');
                // Advance library index
                q.libraryIndex = (q.libraryIndex + 1) % lib.length;
                const next = lib[q.libraryIndex];
                q.tracks.push({
                    title: next.title,
                    query: next.query,
                    artist: 'Unknown', source: 'SoundCloud',
                    duration: 0, thumbnail: null,
                    requestedBy: `🤖 Library • ${next.genre}`, url: null,
                    _libraryIndex: q.libraryIndex,
                });
                console.log(`[MUSIC] Smart autoplay [${q.libraryIndex}/${lib.length}]: ${next.title}`);
            } catch(e) {
                // Fallback to old artist-based search if library missing
                const similar = q.currentTrack.title.split(' ').slice(0,3).join(' ');
                if (similar.length > 2) {
                    q.tracks.push({ title: similar, query: similar, artist: 'Unknown', source: 'SoundCloud', duration: 0, thumbnail: null, requestedBy: '🤖 Autoplay', url: null });
                }
            }
            // DO NOT return here — fall through so playNext plays the track we just pushed
        }
    }

    const track = q.tracks.shift();
    if (!track) { resetInactivityTimer(q); return; }
    // Save previous track to history (max 5)
    if (q.currentTrack) {
        q.trackHistory.unshift({...q.currentTrack});
        if (q.trackHistory.length > 5) q.trackHistory.pop();
    }
    // Sync libraryIndex if this track came from library
    if (track._libraryIndex !== undefined && track._libraryIndex >= 0) {
        q.libraryIndex = track._libraryIndex;
    }
    q.currentTrack = track;
    q.startTime = Date.now();
    q.totalPaused = 0;
    q.pausedAt = null;

    // Enrich with Spotify metadata (album art, duration, artist)
    if (track.source !== 'file') {
        try {
            const spotifyData = await searchSpotify(track.query || track.title);
            if (spotifyData) {
                track.title = spotifyData.title || track.title;
                track.artist = spotifyData.artist || track.artist;
                track.thumbnail = spotifyData.thumbnail || track.thumbnail;
                track.duration = spotifyData.duration || track.duration;
                track.album = spotifyData.album;
                track.spotifyUrl = spotifyData.spotifyUrl;
                console.log('[MUSIC] Spotify metadata ✅:', track.title, 'by', track.artist);
            }
        } catch(e) {}
    }

    // Save to history
    try {
        const db = client.db;
        if (db && q.guild.id) {
            const ex = db.prepare('SELECT id FROM music_history WHERE guild_id = ? AND query = ?').get(q.guild.id, track.query || track.title);
            if (ex) db.prepare('UPDATE music_history SET play_count = play_count + 1, played_at = ? WHERE id = ?').run(Math.floor(Date.now()/1000), ex.id);
            else db.prepare('INSERT OR IGNORE INTO music_history (guild_id, title, query, source) VALUES (?, ?, ?, ?)').run(q.guild.id, track.title, track.query || track.title, track.source || 'SoundCloud');
        }
    } catch(e) {}

    try {
        let resource;

        if (track.source === 'file') {
            resource = createAudioResource(require('fs').createReadStream(track.url), {
                inputType: StreamType.Arbitrary, inlineVolume: true,
            });
        } else {
            let stream = null;

            // SoundCloud primary
            try {
                const id = await playdl.getFreeClientID();
                await playdl.setToken({ soundcloud: { client_id: id } });
                const results = await playdl.search(track.query || track.title, { source: { soundcloud: 'tracks' }, limit: 1 });
                if (results.length > 0) {
                    const url = results[0].permalink || results[0].url;
                    stream = await playdl.stream(url);
                    track.source = 'SoundCloud';
                    track.duration = results[0].durationInSec || 0;
                    track.thumbnail = results[0].thumbnail?.url;
                    track.artist = results[0].publisher?.artist || results[0].user?.name;
                    track.title = results[0].title || track.title;
                    console.log('[MUSIC] ▸ SoundCloud:', track.title);
                }
            } catch (e) { console.log('[MUSIC] SoundCloud error:', e.message); }

            // yt-dlp fallback
            if (!stream) {
                try {
                    const safe = (track.query || track.title).replace(/"/g, '').replace(/'/g, '');
                    const { stdout } = await execAsync(`yt-dlp --no-playlist -x --audio-format opus --get-url "ytsearch1:${safe}" 2>/dev/null`, { timeout: 20000 });
                    const url = stdout.trim().split('\n')[0];
                    if (url?.startsWith('http')) {
                        const ffmpeg = require('child_process').spawn('ffmpeg', [
                            '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
                            '-i', url, '-vn', '-acodec', 'libopus', '-f', 'opus', 'pipe:1'
                        ], { stdio: ['ignore', 'pipe', 'ignore'] });
                        resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus, inlineVolume: true });
                        track.source = 'YouTube';
                        console.log('[MUSIC] ▸ YouTube fallback for:', track.title);
                    }
                } catch (e) { console.log('[MUSIC] yt-dlp error:', e.message); }
            }

            if (!stream && !resource) throw new Error('Could not find audio stream');
            if (!resource) {
                resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
            }
        }

        resource.volume?.setVolume(q.volume / 100);
        q.player.play(resource);

        // Update/create persistent panel
        await updatePersistentPanel(q);
        startPanelUpdater(q);
        clearInactivityTimer(q);

    } catch (err) {
        console.error('[MUSIC] Error:', err.message);
        // Update persistent panel with error instead of spamming
        const errEmbed = new EmbedBuilder().setColor(ARCHON.red)
            .setAuthor({ name: '// CLASSIFIED // ARCHON MUSIC ENGINE //', iconURL: q._client?.user?.displayAvatarURL() })
            .setDescription(`\`\`\`ansi\n\u001b[1;31m▸ STREAM ERROR\u001b[0m\n\u001b[0;37m${err.message.substring(0,80)}\u001b[0m\n\u001b[0;37mTrying next track...\u001b[0m\n\`\`\``);
        if (q.persistentMsg) {
            await q.persistentMsg.edit({ embeds: [errEmbed] }).catch(() => {});
        } else {
            q.persistentMsg = await q.textChannel?.send({ embeds: [errEmbed] }).catch(() => null);
        }
        setTimeout(() => playNext(q), 2000);
    }
}

// ═══════════════════════════════════════════════════════
// ENSURE CONNECTION
// ═══════════════════════════════════════════════════════
async function ensureConnection(q) {
    let conn = getVoiceConnection(q.guild.id);
    if (!conn) {
        const isStage = q.voiceChannel.type === 13;
        conn = joinVoiceChannel({
            channelId: q.voiceChannel.id,
            guildId: q.guild.id,
            adapterCreator: q.guild.voiceAdapterCreator,
            selfDeaf: !isStage, selfMute: false,
        });
        q.connection = conn;
        if (isStage) {
            setTimeout(async () => {
                try { await q.guild.members.me?.voice.setSuppressed(false); console.log('[MUSIC] Stage speaker ✅'); } catch(e) {}
            }, 1500);
        }
        conn.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(conn, VoiceConnectionStatus.Signalling, 5000),
                    entersState(conn, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch(e) { destroyQueue(q.guild.id); }
        });
    }
    try { await entersState(conn, VoiceConnectionStatus.Ready, 20000); }
    catch(e) { destroyQueue(q.guild.id); throw new Error('Could not connect to voice channel'); }

    if (!q.player) {
        const player = createAudioPlayer();
        q.player = player;
        conn.subscribe(player);
        player.on(AudioPlayerStatus.Idle, () => {
            if (q.loop && q.currentTrack) q.tracks.unshift({...q.currentTrack});
            playNext(q);
        });
        player.on('error', err => { console.error('[MUSIC PLAYER]', err.message); playNext(q); });
    }
    return conn;
}

// ═══════════════════════════════════════════════════════
// PLAY HELPER
// ═══════════════════════════════════════════════════════
async function handlePlay(guildId, guild, voiceChannel, textChannel, query, requestedBy, client, replyFn) {
    let q = getQueue(guildId) || createQueue(guild, voiceChannel, textChannel, client);
    q.textChannel = textChannel;
    q._client = client;

    // Check if query matches a library track — sync libraryIndex for smart autoplay
    let libIdx = -1;
    try {
        const lib = require('../data/music-library.json');
        libIdx = lib.findIndex(t => t.query === query || t.title === query);
    } catch(e) {}
    const track = { title: query, query, artist: 'Unknown', source: 'SoundCloud', duration: 0, thumbnail: null, requestedBy, url: null, _libraryIndex: libIdx };
    if (libIdx >= 0) {
        let q2 = getQueue(guildId);
        if (q2) q2.libraryIndex = libIdx;
    }
    if (q.tracks.length >= 50) {
        await replyFn({ content: '❌ Queue is full! Max 50 tracks. Use `/music skip` or `/music stop` to clear.' });
        return;
    }
    q.tracks.push(track);

    // Get suggestions from history
    let suggestions = [];
    try {
        suggestions = client.db?.prepare('SELECT title, query FROM music_history WHERE guild_id = ? AND query != ? ORDER BY play_count DESC, played_at DESC LIMIT 4').all(guildId, query) || [];
    } catch(e) {}

    const isPlaying = q.player && q.currentTrack && q.player.state.status !== AudioPlayerStatus.Idle;
    const embed = new EmbedBuilder().setColor(ARCHON.cyan)
        .setColor(isPlaying ? 0x1DB954 : ARCHON.cyan)
        .setDescription(
            isPlaying
                ? `🎵 Added **${query.substring(0,60)}**\n> Position **#${q.tracks.length}** in queue • Added by **${requestedBy}**`
                : `🎵 **${query.substring(0,60)}**\n> Loading... connecting to voice`
        );

    const components = [];
    if (suggestions.length > 0) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`ms_suggest_${Date.now()}`)
            .setPlaceholder('🎵 Queue a suggested track...')
            .addOptions(suggestions.map(s => ({ label: s.title.substring(0,100), value: s.query.substring(0,100), emoji: '🎵' })));
        components.push(new ActionRowBuilder().addComponents(menu));
    }

    const msg = await replyFn({ embeds: [embed], components });

    if (suggestions.length > 0 && msg) {
        const collector = msg.createMessageComponentCollector({ time: 30000 });
        collector.on('collect', async (i) => {
            if (i.user.id !== (i.message.interaction?.user?.id || i.user.id)) return;
            await i.deferUpdate().catch(() => {});
            const qNow = getQueue(guildId);
            if (qNow) {
                const sel = i.values[0];
                qNow.tracks.push({ title: sel, query: sel, artist: 'Unknown', source: 'SoundCloud', duration: 0, thumbnail: null, requestedBy: i.user.username, url: null });
                await i.followUp({ content: `✅ Added **${sel.substring(0,50)}** to queue!`, flags: 64 }).catch(() => {});
            }
            collector.stop();
        });
        collector.on('end', () => { msg.edit?.({ components: [] }).catch(() => {}); });
    }

    if (!isPlaying) {
        try { await ensureConnection(q); await playNext(q); }
        catch(err) { destroyQueue(guildId); replyFn({ content: `❌ ${err.message}`, embeds: [], components: [] }).catch(() => {}); }
    }
}

// ═══════════════════════════════════════════════════════
// MODULE EXPORT — UNIFIED /music COMMAND
// ═══════════════════════════════════════════════════════
module.exports = {
    name: 'music',
    aliases: ['m', 'musique', 'play', 'p'],
    description: '🎵 Full music system for ARCHON CG-223',
    category: 'MUSIC',
    cooldown: 2000,

    // Export utilities for other plugins
    getQueue, createQueue, destroyQueue, buildNowPlayingEmbed,
    buildControls, buildQueueEmbed, ARCHON, progressBar, formatTime,

    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('🎵 ARCHON Music Engine — play, queue, control')
        .addSubcommand(s => s.setName('play').setDescription('▶️ Play a song').addStringOption(o => o.setName('query').setDescription('Song name or URL').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('file').setDescription('📁 Play from uploaded file').addAttachmentOption(o => o.setName('file').setDescription('Audio file (mp3/wav/ogg/flac)').setRequired(true)))
        .addSubcommand(s => s.setName('pause').setDescription('⏸️ Pause or resume'))
        .addSubcommand(s => s.setName('skip').setDescription('⏭️ Skip current track'))
        .addSubcommand(s => s.setName('stop').setDescription('⏹️ Stop and disconnect'))
        .addSubcommand(s => s.setName('queue').setDescription('📋 View the queue'))
        .addSubcommand(s => s.setName('nowplaying').setDescription('🎵 Now playing info'))
        .addSubcommand(s => s.setName('volume').setDescription('🎚️ Set volume').addIntegerOption(o => o.setName('level').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100)))
        .addSubcommand(s => s.setName('loop').setDescription('🔁 Toggle loop'))
        .addSubcommand(s => s.setName('autoplay').setDescription('🔀 Toggle autoplay'))
        .addSubcommand(s => s.setName('library').setDescription('📚 Browse the curated music library')
            .addStringOption(o => o.setName('genre').setDescription('Filter by genre').setRequired(false)
                .addChoices(
                    { name: '🌍 Afrobeat', value: 'Afrobeat' },
                    { name: '🇲🇱 Mali / West African', value: 'Mali' },
                    { name: '🎤 Hip-Hop / Rap', value: 'HipHop' },
                    { name: '⚡ Electronic / EDM', value: 'EDM' },
                    { name: '🀄 Chinese', value: 'Chinese' },
                    { name: '🎵 All Genres', value: 'all' }
                ))
            .addIntegerOption(o => o.setName('page').setDescription('Page number').setRequired(false).setMinValue(1))),

    // PREFIX — .play <query>
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const query = args.join(' ');
        if (!query) return message.reply('❌ Provide a song name! Usage: `.play <song>`').catch(() => {});
        const vc = message.member?.voice?.channel;
        if (!vc) return message.reply('❌ Join a voice channel first!').catch(() => {});
        await handlePlay(
            message.guild.id, message.guild, vc, message.channel,
            query, message.author.username, client,
            (opts) => message.reply(opts).catch(() => {})
        );
    },

    autocomplete: async (interaction, client) => {
        const focused = interaction.options.getFocused().toLowerCase();
        try {
            const results = [];

            // 1. Guild history first (personalized, max 3)
            const history = client.db?.prepare(
                'SELECT title, query FROM music_history WHERE guild_id = ? AND (LOWER(title) LIKE ? OR LOWER(query) LIKE ?) ORDER BY play_count DESC, played_at DESC LIMIT 3'
            ).all(interaction.guild?.id, `%${focused}%`, `%${focused}%`) || [];
            for (const r of history) {
                results.push({ name: `🕐 ${r.title.substring(0,93)}`, value: r.query.substring(0,100) });
            }

            // 2. Fill remaining slots from curated library (max 5 total)
            if (results.length < 5) {
                try {
                    const lib = require('../data/music-library.json');
                    const genreEmoji = { Afrobeat: '🌍', Mali: '🇲🇱', HipHop: '🎤', EDM: '⚡', Chinese: '🀄' };
                    const filtered = focused.length === 0
                        ? lib.slice(0, 5 - results.length)
                        : lib.filter(t =>
                            t.title.toLowerCase().includes(focused) ||
                            t.query.toLowerCase().includes(focused) ||
                            t.genre.toLowerCase().includes(focused)
                          ).slice(0, 5 - results.length);
                    for (const t of filtered) {
                        const emoji = genreEmoji[t.genre] || '🎵';
                        results.push({ name: `${emoji} ${t.title.substring(0,93)}`, value: t.query.substring(0,100) });
                    }
                } catch(e) {}
            }

            // 3. If user typed something and we have room, add live search option
            if (focused.length >= 2 && results.length < 5) {
                results.push({ name: `🔍 Search: ${focused.substring(0,88)}`, value: focused.substring(0,100) });
            }

            await interaction.respond(results.slice(0,5)).catch(() => {});
        } catch(e) {
            await interaction.respond([]).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild?.id;
        const vc = interaction.member?.voice?.channel;

        // Commands that need voice channel
        if (['play', 'file'].includes(sub) && !vc) {
            return interaction.reply({ content: '❌ Join a voice channel first!', flags: 64 });
        }

        await interaction.deferReply();

        // ── PLAY ──
        if (sub === 'play') {
            const query = interaction.options.getString('query');
            const msg = await interaction.editReply({ content: '⏳ Loading...' });
            await handlePlay(
                guildId, interaction.guild, vc, interaction.channel,
                query, interaction.user.username, client,
                async (opts) => { await interaction.editReply(opts); return await interaction.fetchReply(); }
            );
            return;
        }

        // ── FILE ──
        if (sub === 'file') {
            const att = interaction.options.getAttachment('file');
            const validExts = ['mp3','wav','ogg','flac','m4a','aac','opus'];
            const ext = att.name.split('.').pop()?.toLowerCase();
            if (!validExts.includes(ext || '')) {
                return interaction.editReply({ content: `❌ Invalid file type! Supported: ${validExts.join(', ')}` });
            }
            const tempPath = `/tmp/archon_${Date.now()}.${ext}`;
            const sizeMB = (att.size/1024/1024).toFixed(2);

            // Show downloading state immediately
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(ARCHON.gold)
                    .setDescription(`📥 **${att.name.replace(/\.[^/.]+$/, '').substring(0,60)}**\n> \`[downloading]\` • ${ext?.toUpperCase()} • ${sizeMB} MB — please wait...`)]
            });

            try { await downloadFile(att.url, tempPath); } catch(e) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(ARCHON.red)
                        .setDescription(`❌ Download failed\n> ${e.message.substring(0,80)}`)]
                });
            }

            // Get real duration via ffprobe
            let fileDuration = 0;
            try {
                const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempPath}"`, { timeout: 8000 });
                fileDuration = Math.floor(parseFloat(stdout.trim())) || 0;
            } catch(e) { fileDuration = 0; }

            let q = getQueue(guildId) || createQueue(interaction.guild, vc, interaction.channel, client);
            q._client = client;
            const track = {
                title: att.name.replace(/\.[^/.]+$/, ''),
                query: att.name, artist: 'File Upload',
                source: 'file', duration: fileDuration, thumbnail: null,
                requestedBy: interaction.user.username, url: tempPath,
            };
            q.tracks.push(track);
            const isPlaying = q.player && q.currentTrack && q.player.state.status !== AudioPlayerStatus.Idle;

            // Update to queued/playing state
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(isPlaying ? 0x1DB954 : ARCHON.cyan)
                    .setDescription(
                        isPlaying
                            ? `🎵 Added **${track.title.substring(0,60)}**\n> \`[queued]\` • ${ext?.toUpperCase()} • ${sizeMB} MB • Position **#${q.tracks.length}** in queue`
                            : `🎵 **${track.title.substring(0,60)}**\n> \`[ready]\` • ${ext?.toUpperCase()} • ${sizeMB} MB — connecting to voice...`
                    )]
            });

            if (!isPlaying) {
                try { await ensureConnection(q); await playNext(q); }
                catch(e) { destroyQueue(guildId); }
            }
            return;
        }

        // Commands that need active queue
        const q = getQueue(guildId);
        if (!q && !['play','file','library'].includes(sub)) {
            return interaction.editReply({ content: '❌ Nothing is playing!' });
        }

        // ── PAUSE ──
        if (sub === 'pause') {
            const isPaused = q.player.state.status === AudioPlayerStatus.Paused;
            isPaused ? q.player.unpause() : q.player.pause();
            if (isPaused) { q.totalPaused += Date.now() - (q.pausedAt || Date.now()); q.pausedAt = null; }
            else q.pausedAt = Date.now();
            const embed = new EmbedBuilder().setColor(isPaused ? ARCHON.green : ARCHON.gold)
                .setDescription(`\`\`\`ansi\n\u001b[1;${isPaused?'32':'33'}m▸ ${isPaused?'RESUMED':'PAUSED'}\u001b[0m\n\`\`\``);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── SKIP ──
        if (sub === 'skip') {
            const title = q.currentTrack?.title || 'Unknown';
            q.player.stop();
            const embed = new EmbedBuilder().setColor(ARCHON.cyan)
                .setDescription(`\`\`\`ansi\n\u001b[1;36m▸ SKIPPED\u001b[0m\n\u001b[0;37m${title.substring(0,60)}\u001b[0m\n\`\`\``);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── STOP ──
        if (sub === 'stop') {
            destroyQueue(guildId);
            const embed = new EmbedBuilder().setColor(ARCHON.red)
                .setDescription('```ansi\n\u001b[1;31m▸ STOPPED — Neural stream terminated.\u001b[0m\n```');
            return interaction.editReply({ embeds: [embed] });
        }

        // ── QUEUE ──
        if (sub === 'queue') {
            return interaction.editReply({ embeds: [buildQueueEmbed(q, client)] });
        }

        // ── NOW PLAYING ──
        if (sub === 'nowplaying') {
            if (!q.currentTrack) return interaction.editReply({ content: '❌ Nothing is playing!' });
            return interaction.editReply({ embeds: [buildNowPlayingEmbed(q, client)], components: [buildControls(q)] });
        }

        // ── VOLUME ──
        if (sub === 'volume') {
            const vol = interaction.options.getInteger('level');
            q.volume = vol;
            try { q.player?.state?.resource?.volume?.setVolume(vol/100); } catch(e) {}
            const bar = '█'.repeat(Math.round(vol/10)) + '░'.repeat(10-Math.round(vol/10));
            const embed = new EmbedBuilder().setColor(ARCHON.purple)
                .setDescription(`\`\`\`ansi\n\u001b[1;35m▸ VOLUME\u001b[0m \u001b[1;36m${bar}\u001b[0m \u001b[1;33m${vol}%\u001b[0m\n\`\`\``);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── LOOP ──
        if (sub === 'loop') {
            q.loop = !q.loop;
            if (q.loop && q.currentTrack) q.tracks.unshift({...q.currentTrack});
            const embed = new EmbedBuilder().setColor(q.loop ? ARCHON.green : ARCHON.orange)
                .setDescription(`\`\`\`ansi\n\u001b[1;${q.loop?'32':'33'}m▸ LOOP ${q.loop?'ENABLED':'DISABLED'}\u001b[0m\n\`\`\``);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── AUTOPLAY ──
        if (sub === 'autoplay') {
            q.autoplay = !q.autoplay;
            const embed = new EmbedBuilder().setColor(q.autoplay ? ARCHON.green : ARCHON.orange)
                .setDescription(`\`\`\`ansi\n\u001b[1;${q.autoplay?'32':'33'}m▸ AUTOPLAY ${q.autoplay?'ENABLED':'DISABLED'}\u001b[0m\n\`\`\``);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── LIBRARY ──
        if (sub === 'library') {
            let lib;
            try { lib = require('../data/music-library.json'); }
            catch(e) { return interaction.editReply({ content: '❌ Library not found on server.' }); }

            const genreFilter = interaction.options.getString('genre') || 'all';
            const page = interaction.options.getInteger('page') || 1;
            const PER_PAGE = 10;
            const genreEmoji = { Afrobeat: '🌍', Mali: '🇲🇱', HipHop: '🎤', EDM: '⚡', Chinese: '🀄' };

            const filtered = genreFilter === 'all' ? lib : lib.filter(t => t.genre === genreFilter);
            const totalPages = Math.ceil(filtered.length / PER_PAGE);
            const pageNum = Math.min(page, totalPages);
            const slice = filtered.slice((pageNum - 1) * PER_PAGE, pageNum * PER_PAGE);

            const genreLabel = genreFilter === 'all' ? '🎵 All Genres' : `${genreEmoji[genreFilter] || '🎵'} ${genreFilter}`;
            const trackList = slice.map((t, i) => {
                const idx = (pageNum - 1) * PER_PAGE + i + 1;
                const emoji = genreEmoji[t.genre] || '🎵';
                return `\`${String(idx).padStart(3, '0')}\` ${emoji} **${t.title}**`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(ARCHON.cyan)
                .setAuthor({ name: '// CLASSIFIED // ARCHON MUSIC LIBRARY //', iconURL: client.user.displayAvatarURL() })
                .setTitle(`📚 ${genreLabel}`)
                .setDescription(trackList)
                .addFields(
                    { name: 'Total Tracks', value: `\`${filtered.length}\``, inline: true },
                    { name: 'Page', value: `\`${pageNum}/${totalPages}\``, inline: true },
                    { name: 'Now Playing', value: q?.currentTrack ? `🎵 ${q.currentTrack.title.substring(0,40)}` : '⏹️ Nothing', inline: true },
                )
                .setFooter({ text: `BAMAKO_223 🇲🇱 • Use /music play <song name> to queue any track` })
                .setTimestamp();

            // Play buttons (max 5 per row, up to 2 rows = 10 buttons)
            const rows = [];
            const btnSlice = slice.slice(0, 5); // first 5 tracks get play buttons
            if (btnSlice.length > 0) {
                const { ActionRowBuilder: ARB, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');
                const row = new ARB();
                for (const t of btnSlice) {
                    row.addComponents(
                        new BB()
                            .setCustomId(`ml_play_${Buffer.from(t.query).toString('base64').substring(0,80)}`)
                            .setLabel(t.title.substring(0, 20))
                            .setEmoji(genreEmoji[t.genre] || '🎵')
                            .setStyle(BS.Secondary)
                    );
                }
                rows.push(row);
            }

            const msg = await interaction.editReply({ embeds: [embed], components: rows });

            // Button collector — play the selected track
            if (msg && rows.length > 0) {
                const collector = msg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (i) => {
                    if (!i.member?.voice?.channel) {
                        return i.reply({ content: '❌ Join a voice channel first!', flags: 64 }).catch(() => {});
                    }
                    await i.deferUpdate().catch(() => {});
                    const b64 = i.customId.replace('ml_play_', '');
                    let query;
                    try { query = Buffer.from(b64, 'base64').toString('utf8'); } catch(e) { return; }
                    await handlePlay(
                        interaction.guild.id, interaction.guild,
                        i.member.voice.channel, interaction.channel,
                        query, i.user.username, client,
                        async (opts) => { await i.followUp({ ...opts, flags: 64 }).catch(() => {}); return null; }
                    );
                });
                collector.on('end', () => { msg.edit?.({ components: [] }).catch(() => {}); });
            }
            return;
        }
    }
};
