const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    MessageFlags
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
            await qNow.textChannel?.send({ embeds: [new EmbedBuilder()
                .setColor(0xFEE75C)
                .setAuthor({ name: '💤 Auto-Disconnect' })
                .setDescription('I left the voice channel due to inactivity.\nUse `/music play` to bring me back anytime.')
            ] });
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
        silentPanel: true, // 🔕 send panel as @silent by default
        libraryIndex: -1,
        startTime: null, pausedAt: null, totalPaused: 0,
        persistentMsg: null, panelMsgId: null, updateInterval: null,
        inactivityTimer: null,
    };
    queues.set(guild.id, state);
    return state;
}

// ═══ LIKED SONGS — per-user persistent store (data/likes.json) ═══
const LIKES_PATH = require('path').join(__dirname, '../data/likes.json');
function loadLikes() {
    try { return JSON.parse(require('fs').readFileSync(LIKES_PATH, 'utf8')); } catch (e) { return {}; }
}
function saveLikes(data) {
    try { require('fs').writeFileSync(LIKES_PATH, JSON.stringify(data, null, 2)); } catch (e) {}
}
function getUserLikes(userId) { return loadLikes()[userId] || []; }

function cleanTemp(track) {
    if (track?.tempFile) {
        try { require('fs').unlinkSync(track.tempFile); } catch (e) {}
        track.tempFile = null;
    }
}

function destroyQueue(guildId) {
    const q = queues.get(guildId);
    if (q) {
        q.destroyed = true; // guard: any pending playNext/Idle callbacks abort
        if (q.updateInterval) clearInterval(q.updateInterval);
        clearInactivityTimer(q);
        cleanTemp(q.currentTrack);
        try { q.player?.removeAllListeners(); } catch (e) {} // prevent Idle → playNext zombie
        try { q.player?.stop(true); } catch (e) {}
        try { q.connection?.destroy(); } catch (e) {}
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

// FlaviBot-style slider with knob ────●─────
function sliderBar(cur, total, len = 18) {
    if (!total || total <= 0) return '─'.repeat(len);
    const pos = Math.max(0, Math.min(len - 1, Math.round((cur / total) * (len - 1))));
    return '─'.repeat(pos) + '●' + '─'.repeat(len - 1 - pos);
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
// FLAVIBOT-STYLE PERSISTENT PANEL
// ═══════════════════════════════════════════════════════
function buildPanelEmbed(q, client) {
    const t = q.currentTrack;
    const elapsed = q.startTime ? Math.floor((Date.now() - q.startTime - q.totalPaused) / 1000) : 0;
    const duration = t.duration || 0;
    const pct = duration > 0 ? Math.min(100, Math.round((elapsed / duration) * 100)) : 0;
    const isPaused = q.player?.state?.status === AudioPlayerStatus.Paused;
    const bar = progressBar(elapsed, duration, 16);

    const fullTitle = (t.artist && t.artist !== 'Unknown' && !t.title.includes(t.artist))
        ? `${t.artist} - ${t.title}`
        : t.title;
    const trackLink = t.spotifyUrl
        ? `[${fullTitle.substring(0,120)}](${t.spotifyUrl})`
        : `**${fullTitle.substring(0,120)}**`;
    const requester = t.requestedById ? `<@${t.requestedById}>` : `@${t.requestedBy}`;

    return new EmbedBuilder()
        .setColor(isPaused ? ARCHON.gold : 0x5865F2)
        .setTitle(isPaused ? '⏸️ Paused' : 'Now playing')
        .setDescription(
            `${trackLink}\n\n` +
            `• Added by ${requester}\n` +
            `• 🔊 ${q.voiceChannel?.name?.substring(0,22) || 'Voice'}\n\n` +
            `Queue Size: \`${q.tracks.length}\` · Volume: \`${q.volume}%\` · Loop: \`${q.loop ? 'On' : 'Off'}\`\n\n` +
            `${sliderBar(elapsed, duration)}\n` +
            `\`${formatTime(elapsed)}\` ――― \`${formatTime(duration)}\``
        )
        .setThumbnail(t.thumbnail || client.user.displayAvatarURL())
        .setFooter({
            text: `BAMAKO_223 🇲🇱 • Auto: ${q.autoplay ? 'On' : 'Off'}`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
}

function buildPanelRows(q) {
    const isPaused = q.player?.state?.status === AudioPlayerStatus.Paused;
    const hasPrev = q.trackHistory && q.trackHistory.length > 0;
    // FlaviBot layout: Like on top, then 2+2 control rows, utility row last
    const rowLike = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mc_like').setLabel('Like').setStyle(ButtonStyle.Secondary).setEmoji('❤️'),
    );
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mc_pause').setLabel(isPaused ? 'Resume' : 'Pause').setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji(isPaused ? '▶️' : '⏸️'),
        new ButtonBuilder().setCustomId('mc_skip').setLabel('Skip').setStyle(ButtonStyle.Primary).setEmoji('⏭️'),
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mc_stop').setLabel('Stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️'),
        new ButtonBuilder().setCustomId('mc_autoplay').setLabel('AutoPlay').setStyle(q.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🔀'),
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mc_prev').setLabel('Prev').setStyle(ButtonStyle.Secondary).setEmoji('⏮️').setDisabled(!hasPrev),
        new ButtonBuilder().setCustomId('mc_loop').setLabel(q.loop ? 'Loop ON' : 'Loop').setStyle(q.loop ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🔁'),
        new ButtonBuilder().setCustomId('mc_queue').setLabel('Queue').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
    );
    return [rowLike, row1, row2, row3];
}

function attachCollector(q, msg) {
    const client = q._client;
    const collector = msg.createMessageComponentCollector({ time: 21600000 }); // 6 hours
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
                    .setDescription('```ansi\n\u001b[1;31m▸ STOPPED — Neural stream terminated.\u001b[0m\n```');
                await qNow.persistentMsg.edit({ embeds: [stoppedEmbed], components: [] }).catch(() => {});
                qNow.persistentMsg = null; qNow.panelMsgId = null;
            }
            destroyQueue(q.guild.id);
        } else if (i.customId === 'mc_loop') {
            qNow.loop = !qNow.loop;
            // NOTE: do NOT unshift here — AudioPlayerStatus.Idle handler does it
            await updatePersistentPanel(qNow);
        } else if (i.customId === 'mc_autoplay') {
            qNow.autoplay = !qNow.autoplay;
            await updatePersistentPanel(qNow);
        } else if (i.customId === 'mc_like') {
            const t = qNow.currentTrack;
            if (!t) return i.followUp({ content: '⏹️ Nothing playing to like.', flags: 64 }).catch(() => {});
            const all = loadLikes();
            const mine = all[i.user.id] = all[i.user.id] || [];
            const key = (t.query || t.title).toLowerCase();
            if (mine.some(x => (x.query || x.title).toLowerCase() === key)) {
                return i.followUp({ content: `❤️ **${t.title.substring(0, 50)}** is already in your Liked Songs!`, flags: 64 }).catch(() => {});
            }
            mine.unshift({ title: t.title.replace(/^🎵\s*/, ''), query: t.query || t.title, folder: '❤️ Liked Songs', likedAt: Date.now() });
            saveLikes(all);
            await i.followUp({ content: `❤️ Saved **${t.title.substring(0, 50)}** — you now have \`${mine.length}\` liked song${mine.length > 1 ? 's' : ''}.\nFind them in \`/music library\` → **❤️ My Liked Songs**!`, flags: 64 }).catch(() => {});
        } else if (i.customId === 'mc_queue') {
            await i.followUp({ embeds: [buildQueueEmbed(qNow, client)], flags: 64 }).catch(() => {});
        }
    });
}

async function sendPanel(q, embed, rows) {
    const client = q._client;
    // Sweep stray old panels from previous sessions so only ONE panel lives
    try {
        const recent = await q.textChannel.messages.fetch({ limit: 20 });
        const stale = recent.filter(m => m.author.id === client.user.id && m.components.length > 0);
        for (const [, m] of stale) await m.delete().catch(() => {});
    } catch(e) {}

    const msg = await q.textChannel.send({
        embeds: [embed],
        components: rows,
        // 🔕 @silent — suppresses notifications, shows the mute bell icon (send-only flag)
        ...(q.silentPanel ? { flags: MessageFlags.SuppressNotifications } : {}),
    }).catch(() => null);
    if (msg) {
        q.persistentMsg = msg;
        q.panelMsgId = msg.id;
        attachCollector(q, msg);
    }
}

async function updatePersistentPanel(q) {
    const client = q._client;
    if (!client || !q.currentTrack || !q.textChannel) return;

    const embed = buildPanelEmbed(q, client);
    const rows = buildPanelRows(q);

    try {
        let msg = q.persistentMsg;

        // Recover lost reference (e.g. after error paths) via stored ID
        if (!msg && q.panelMsgId) {
            msg = await q.textChannel.messages.fetch(q.panelMsgId).catch(() => null);
            q.persistentMsg = msg;
        }

        if (msg) {
            let resend = false;
            await msg.edit({ embeds: [embed], components: rows }).catch((e) => {
                if (e.code === 10008) { resend = true; } // message genuinely deleted
                // other errors (rate limit, network) → keep panel, retry next 15s tick
            });
            if (resend) {
                q.persistentMsg = null; q.panelMsgId = null;
                await sendPanel(q, embed, rows);
            }
        } else {
            await sendPanel(q, embed, rows);
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
    if (!q || !q.guild || q.destroyed) return; // Guard: queue destroyed
    if (queues.get(q.guild.id) !== q) return; // Guard: stale queue reference
    if (q.tracks.length > 0 && !q.tracks[0]) { q.tracks = q.tracks.filter(Boolean); }
    if (q.tracks.length === 0) {
        // Smart autoplay — library-aware sequential play
        if (q.autoplay && q.currentTrack && q.currentTrack.source !== 'file') {
            try {
                const lib = require('../data/music-library.json');
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
            if (!require('fs').existsSync(track.url)) throw new Error('Uploaded file expired — re-upload it');
            resource = createAudioResource(require('fs').createReadStream(track.url), {
                inputType: StreamType.OggOpus, inlineVolume: true,
            });
        } else {
            let stream = null;

            // SoundCloud primary
            try {
                const id = await playdl.getFreeClientID();
                await playdl.setToken({ soundcloud: { client_id: id } });
                const scQuery = (track.query || track.title).replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
                const results = await playdl.search(scQuery, { source: { soundcloud: 'tracks' }, limit: 1 });
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

            // yt-dlp pipe helper — yt-dlp handles URL signing/cookies/UA and streams
            // raw audio to ffmpeg via stdin, so nothing re-requests the signed URL (no 403)
            const pipeYtDlp = (spec, cookiesFlag, label) => {
                const { spawn } = require('child_process');
                const ytdlpArgs = ['--no-playlist', '--no-warnings', '-q', '-f', 'bestaudio/best'];
                if (cookiesFlag) ytdlpArgs.push('--cookies', cookiesFlag);
                ytdlpArgs.push('-o', '-', spec);
                const ytdlp = spawn('yt-dlp', ytdlpArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
                const ffmpeg = spawn('ffmpeg', [
                    '-i', 'pipe:0', '-vn', '-acodec', 'libopus', '-f', 'opus', 'pipe:1'
                ], { stdio: ['pipe', 'pipe', 'pipe'] });
                let ytErr = '', ffErr = '';
                ytdlp.stderr.on('data', d => { ytErr += d.toString(); });
                ffmpeg.stderr.on('data', d => { ffErr += d.toString(); });
                ytdlp.on('close', code => {
                    if (code !== 0 && code !== null) console.log(`[MUSIC] yt-dlp(${label}) exited ${code}:`, ytErr.slice(-300));
                });
                ffmpeg.on('close', code => {
                    if (code !== 0 && code !== null) console.log(`[MUSIC] ffmpeg(${label}) exited ${code}:`, ffErr.slice(-300));
                });
                ytdlp.on('error', () => { try { ffmpeg.kill(); } catch (e) {} });
                ytdlp.stdout.pipe(ffmpeg.stdin);
                ytdlp.stdout.on('error', () => {});
                ffmpeg.stdin.on('error', () => {});
                return ffmpeg.stdout;
            };

            // yt-dlp SoundCloud fallback — no API key, no cookies, immune to play-dl 404s
            if (!stream && !resource) {
                try {
                    const safe = (track.query || track.title).replace(/"/g, '').replace(/'/g, '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
                    const { stdout } = await execAsync(`yt-dlp --no-playlist --get-url "scsearch1:${safe}" 2>/dev/null`, { timeout: 20000 });
                    if (stdout.trim().split('\n')[0]?.startsWith('http')) {
                        const audioOut = pipeYtDlp(`scsearch1:${safe}`, null, 'SC');
                        resource = createAudioResource(audioOut, { inputType: StreamType.OggOpus, inlineVolume: true });
                        track.source = 'SoundCloud';
                        console.log('[MUSIC] ▸ yt-dlp SoundCloud for:', track.title);
                    }
                } catch (e) { console.log('[MUSIC] yt-dlp SC error:', e.message); }
            }

            // YouTube fallback — download full track to temp file, then play locally.
            // Immune to mid-stream connection resets (yt-dlp retries internally);
            // a 3-min song downloads in ~1-2s on this box.
            if (!stream && !resource) {
                const safe = (track.query || track.title).replace(/"/g, '').replace(/'/g, '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
                const cookiesPath = require('path').join(__dirname, '../data/cookies.txt');
                const cookiesFlag = require('fs').existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';
                // Attempt 2 appends "audio" — rescues titles that match age-restricted/odd first results
                for (const attemptQuery of [safe, `${safe} audio`]) {
                    try {
                        const tmpBase = require('path').join(require('os').tmpdir(), `archon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
                        await execAsync(`yt-dlp --no-playlist ${cookiesFlag} -x --audio-format opus --audio-quality 96K -o "${tmpBase}.%(ext)s" "ytsearch1:${attemptQuery}"`, { timeout: 90000 });
                        const tmpFile = `${tmpBase}.opus`;
                        if (require('fs').existsSync(tmpFile) && require('fs').statSync(tmpFile).size > 10000) {
                            // Real duration from the file itself
                            try {
                                const { stdout: dur } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpFile}"`, { timeout: 8000 });
                                const d = parseFloat(dur.trim());
                                if (d > 0) track.duration = Math.round(d);
                            } catch (e) {}
                            resource = createAudioResource(require('fs').createReadStream(tmpFile), { inputType: StreamType.OggOpus, inlineVolume: true });
                            track.tempFile = tmpFile;
                            track.source = 'YouTube';
                            console.log('[MUSIC] ▸ YouTube download for:', track.title, `(${track.duration}s)`);
                            break;
                        }
                        console.log('[MUSIC] yt-dlp download produced no file for:', attemptQuery);
                    } catch (e) {
                        console.log('[MUSIC] yt-dlp error:', e.message?.slice(0, 300));
                        if (attemptQuery !== safe) console.log('[MUSIC] ⏭️ Giving up on:', track.title);
                    }
                    if (resource) break;
                }
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
        const errEmbed = new EmbedBuilder().setColor(ARCHON.red)
            .setAuthor({ name: '// CLASSIFIED // ARCHON MUSIC ENGINE //', iconURL: q._client?.user?.displayAvatarURL() })
            .setDescription(`\`\`\`ansi\n\u001b[1;31m▸ STREAM ERROR\u001b[0m\n\u001b[0;37m${err.message.substring(0,80)}\u001b[0m\n\u001b[0;37mTrying next track...\u001b[0m\n\`\`\``);
        if (q.persistentMsg) {
            await q.persistentMsg.edit({ embeds: [errEmbed] }).catch(() => {});
        } else {
            q.persistentMsg = await q.textChannel?.send({ embeds: [errEmbed] }).catch(() => null);
            if (q.persistentMsg) q.panelMsgId = q.persistentMsg.id;
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
            if (q.destroyed) return;
            // Diagnostic: stream starved (ended in <5s) — source delivered no audio
            const alive = q.startTime ? (Date.now() - q.startTime - q.totalPaused) / 1000 : 0;
            if (q.currentTrack && alive < 5) {
                console.log(`[MUSIC] ⚠️ Stream starved after ${alive.toFixed(1)}s (${q.currentTrack.source}): ${q.currentTrack.title} — check yt-dlp/play-dl versions`);
            }
            if (q.loop && q.currentTrack) q.tracks.unshift({...q.currentTrack});
            else cleanTemp(q.currentTrack); // delete downloaded file once done (loop keeps it)
            playNext(q);
        });
        player.on('error', err => { console.error('[MUSIC PLAYER]', err.message); playNext(q); });
    }
    return conn;
}

// ═══════════════════════════════════════════════════════
// PLAY HELPER
// ═══════════════════════════════════════════════════════
async function handlePlay(guildId, guild, voiceChannel, textChannel, query, requestedBy, client, replyFn, requestedById) {
    let q = getQueue(guildId) || createQueue(guild, voiceChannel, textChannel, client);
    q.textChannel = textChannel;
    q._client = client;
    q.voiceChannel = voiceChannel;

    let libIdx = -1;
    try {
        const lib = require('../data/music-library.json');
        libIdx = lib.findIndex(t => t.query === query || t.title === query);
    } catch(e) {}
    const track = { title: query, query, artist: 'Unknown', source: 'SoundCloud', duration: 0, thumbnail: null, requestedBy, requestedById: requestedById || null, url: null, _libraryIndex: libIdx };
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

    // Resolve real metadata up-front so the card shows full title + duration (FlaviBot style)
    if (isPlaying && track.source !== 'file') {
        try {
            const sp = await searchSpotify(track.query || track.title);
            if (sp) {
                track.title = sp.title || track.title;
                track.artist = sp.artist || track.artist;
                track.duration = sp.duration || track.duration;
                track.thumbnail = sp.thumbnail || track.thumbnail;
                track.spotifyUrl = sp.spotifyUrl || null;
                track.album = sp.album;
            }
        } catch(e) {}
    }

    const SPOTIFY_ICON = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/512px-Spotify_logo_without_text.svg.png';
    const fullName = (track.artist && track.artist !== 'Unknown') ? `${track.artist} - ${track.title}` : track.title;
    const nameMd = track.spotifyUrl ? `[${fullName}](${track.spotifyUrl})` : fullName;
    const durMd = track.duration > 0 ? ` - \`${formatTime(track.duration)}\`` : '';

    const embed = new EmbedBuilder().setColor(isPlaying ? 0x1DB954 : ARCHON.cyan);
    if (isPlaying) {
        embed.setAuthor({ name: 'Added to the queue', iconURL: SPOTIFY_ICON })
            .setDescription(`Added **${nameMd}**${durMd} to the queue.\n> Position **#${q.tracks.length}** • Added by **${requestedBy}**`);
        if (track.thumbnail) embed.setThumbnail(track.thumbnail);
    } else {
        embed.setDescription(`🎵 **${query.substring(0,60)}**\n> Loading... connecting to voice`);
    }

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
                qNow.tracks.push({ title: sel, query: sel, artist: 'Unknown', source: 'SoundCloud', duration: 0, thumbnail: null, requestedBy: i.user.username, requestedById: i.user.id, url: null });
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
    buildControls, buildQueueEmbed, updatePersistentPanel,
    ARCHON, progressBar, formatTime,

    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('🎵 ARCHON Music Engine — play, queue, control')
        .addSubcommand(s => s.setName('play').setDescription('▶️ Play a song').addStringOption(o => o.setName('query').setDescription('Song name or URL').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('file').setDescription('📁 Play uploaded file(s) — up to 5 at once')
            .addAttachmentOption(o => o.setName('file1').setDescription('Audio file').setRequired(true))
            .addAttachmentOption(o => o.setName('file2').setDescription('Audio file (optional)').setRequired(false))
            .addAttachmentOption(o => o.setName('file3').setDescription('Audio file (optional)').setRequired(false))
            .addAttachmentOption(o => o.setName('file4').setDescription('Audio file (optional)').setRequired(false))
            .addAttachmentOption(o => o.setName('file5').setDescription('Audio file (optional)').setRequired(false)))
        .addSubcommand(s => s.setName('pause').setDescription('⏸️ Pause or resume'))
        .addSubcommand(s => s.setName('skip').setDescription('⏭️ Skip current track'))
        .addSubcommand(s => s.setName('stop').setDescription('⏹️ Stop and disconnect'))
        .addSubcommand(s => s.setName('queue').setDescription('📋 View the queue'))
        .addSubcommand(s => s.setName('nowplaying').setDescription('🎵 Now playing info'))
        .addSubcommand(s => s.setName('volume').setDescription('🎚️ Set volume').addIntegerOption(o => o.setName('level').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100)))
        .addSubcommand(s => s.setName('loop').setDescription('🔁 Toggle loop'))
        .addSubcommand(s => s.setName('autoplay').setDescription('🔀 Toggle autoplay'))
        .addSubcommand(s => s.setName('silent').setDescription('🔕 Toggle @silent panel notifications'))
        .addSubcommand(s => s.setName('library').setDescription('📚 Browse the curated music library — interactive browser')
            .addStringOption(o => o.setName('search').setDescription('🔍 Search inside the library (optional)').setRequired(false).setAutocomplete(true))),

    // PREFIX — .play <query>
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const query = args.join(' ');
        if (!query) return message.reply('❌ Provide a song name! Usage: `.play <song>`').catch(() => {});
        const vc = message.member?.voice?.channel;
        if (!vc) return message.reply('❌ Join a voice channel first!').catch(() => {});
        await handlePlay(
            message.guild.id, message.guild, vc, message.channel,
            query, message.author.username, client,
            (opts) => message.reply(opts).catch(() => {}),
            message.author.id
        );
    },

    autocomplete: async (interaction, client) => {
        const focused = interaction.options.getFocused().trim();
        const focusedLower = focused.toLowerCase();
        try {
            const results = [];
            const seen = new Set();
            const push = (name, value) => {
                const v = String(value).substring(0, 100);
                if (results.length < 25 && v.length > 0 && !seen.has(v)) {
                    seen.add(v);
                    results.push({ name: String(name).substring(0, 100), value: v });
                }
            };
            const genreEmoji = { Afrobeat: '🌍', Mali: '🇲🇱', HipHop: '🎤', EDM: '⚡', Chinese: '🀄', FrenchRap: '🇫🇷', AfroTrap: '🌴' };

            if (focused.length === 0) {
                // ══ DEFAULT POPOUT — ready-to-pick library + recent history ══
                const history = client.db?.prepare(
                    'SELECT title, query FROM music_history WHERE guild_id = ? ORDER BY play_count DESC, played_at DESC LIMIT 5'
                ).all(interaction.guild?.id) || [];
                for (const r of history) push(`🕐 ${r.title}`, r.query);
                try {
                    const lib = require('../data/music-library.json');
                    for (const t of lib.slice(0, 15)) {
                        push(`${genreEmoji[t.genre] || '🎵'} ${t.title}`, t.query);
                    }
                } catch(e) {}
            } else {
                // 1. Guild history (personalized)
                const history = client.db?.prepare(
                    'SELECT title, query FROM music_history WHERE guild_id = ? AND (LOWER(title) LIKE ? OR LOWER(query) LIKE ?) ORDER BY play_count DESC, played_at DESC LIMIT 3'
                ).all(interaction.guild?.id, `%${focusedLower}%`, `%${focusedLower}%`) || [];
                for (const r of history) push(`🕐 ${r.title}`, r.query);

                // 2. Curated library matches
                try {
                    const lib = require('../data/music-library.json');
                    const matches = lib.filter(t =>
                        t.title.toLowerCase().includes(focusedLower) ||
                        t.query.toLowerCase().includes(focusedLower) ||
                        t.genre.toLowerCase().includes(focusedLower)
                    ).slice(0, 5);
                    for (const t of matches) push(`${genreEmoji[t.genre] || '🎵'} ${t.title}`, t.query);
                } catch(e) {}

                // 3. LIVE SPOTIFY SEARCH — FlaviBot-style 🎵 tracks / 🎤 artists / 📁 playlists
                if (focused.length >= 2) {
                    try {
                        const token = await getSpotifyToken();
                        if (token) {
                            const res = await fetch(
                                `https://api.spotify.com/v1/search?q=${encodeURIComponent(focused)}&type=track,artist,playlist&limit=10`,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            const data = await res.json();
                            for (const t of data.tracks?.items?.slice(0, 10) || []) {
                                const artists = t.artists?.map(a => a.name).join(', ') || '';
                                push(`🎵 ${t.name} — ${artists}`, `${t.name} ${t.artists?.[0]?.name || ''}`.trim());
                            }
                            for (const a of data.artists?.items?.slice(0, 2) || []) {
                                push(`🎤 ${a.name}`, a.name);
                            }
                            for (const pl of data.playlists?.items?.slice(0, 3) || []) {
                                if (!pl) continue;
                                push(`📁 ${pl.name} (${pl.tracks?.total ?? '?'} tracks) by ${pl.owner?.display_name || 'Spotify'}`, pl.name);
                            }
                        }
                    } catch(e) {}
                }

                // 4. Fallback: raw search option
                if (focused.length >= 2) push(`🔍 Search: ${focused}`, focused);
            }

            await interaction.respond(results.slice(0, 25)).catch(() => {});
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
            await interaction.editReply({ content: '⏳ Loading...' });
            await handlePlay(
                guildId, interaction.guild, vc, interaction.channel,
                query, interaction.user.username, client,
                async (opts) => { await interaction.editReply(opts); return await interaction.fetchReply(); },
                interaction.user.id
            );
            return;
        }

        // ── FILE (multi — up to 5 attachments queued together) ──
        if (sub === 'file') {
            const validExts = ['mp3','wav','ogg','flac','m4a','aac','opus'];
            const atts = ['file1','file2','file3','file4','file5']
                .map(n => interaction.options.getAttachment(n))
                .filter(Boolean);

            let q = getQueue(guildId) || createQueue(interaction.guild, vc, interaction.channel, client);
            q._client = client;
            q.voiceChannel = vc;

            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor(ARCHON.gold)
                    .setDescription(`📥 Downloading **${atts.length}** file(s)...`)]
            });

            const added = [];
            for (const att of atts) {
                const ext = att.name.split('.').pop()?.toLowerCase();
                if (!validExts.includes(ext || '')) continue;
                const tempPath = `/tmp/archon_${Date.now()}_${added.length}.${ext}`;
                try {
                    await downloadFile(att.url, tempPath);
                    // Transcode to Ogg Opus up front — plays via the same bulletproof
                    // path as YouTube temp downloads (no flaky Arbitrary transcoding)
                    const opusPath = `${tempPath}.opus`;
                    await execAsync(`ffmpeg -y -v error -i "${tempPath}" -vn -acodec libopus -b:a 96k -f opus "${opusPath}"`, { timeout: 60000 });
                    try { require('fs').unlinkSync(tempPath); } catch(e) {}
                    let fileDuration = 0;
                    try {
                        const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${opusPath}"`, { timeout: 8000 });
                        fileDuration = Math.floor(parseFloat(stdout.trim())) || 0;
                    } catch(e) { fileDuration = 0; }
                    q.tracks.push({
                        title: att.name.replace(/\.[^/.]+$/, ''), query: att.name,
                        artist: 'File Upload', source: 'file', duration: fileDuration,
                        thumbnail: null, requestedBy: interaction.user.username,
                        requestedById: interaction.user.id, url: opusPath, tempFile: opusPath,
                    });
                    added.push(`**${att.name.replace(/\.[^/.]+$/, '').substring(0,40)}** \`${ext.toUpperCase()}\``);
                } catch(e) {}
            }

            if (!added.length) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor(ARCHON.red)
                        .setDescription(`❌ No valid audio files! Supported: ${validExts.join(', ')}`)]
                });
            }

            const isPlaying = q.player && q.currentTrack && q.player.state.status !== AudioPlayerStatus.Idle;
            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor(isPlaying ? 0x1DB954 : ARCHON.cyan)
                    .setDescription(`🎵 Added **${added.length}** file(s) to queue:\n${added.map(a => `> ${a}`).join('\n')}`)]
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
            await updatePersistentPanel(q).catch(() => {});
            const embed = new EmbedBuilder().setColor(isPaused ? ARCHON.green : ARCHON.gold)
                .setDescription(`\`\`\`ansi\n[1;${isPaused?'32':'33'}m▸ ${isPaused?'RESUMED':'PAUSED'}\u001b[0m\n\`\`\``);
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
            if (q.persistentMsg) {
                const stoppedEmbed = new EmbedBuilder().setColor(ARCHON.red)
                    .setDescription('```ansi\n\u001b[1;31m▸ STOPPED — Neural stream terminated.\u001b[0m\n```');
                await q.persistentMsg.edit({ embeds: [stoppedEmbed], components: [] }).catch(() => {});
            }
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
            // Try canvas card first, fall back to embed
            try {
                const { createCanvas, loadImage } = require('@napi-rs/canvas');
                const t = q.currentTrack;
                const elapsed = q.startTime ? Math.floor((Date.now() - q.startTime - q.totalPaused) / 1000) : 0;
                const W = 580, H = 200;
                const c = createCanvas(W, H);
                const ctx = c.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.textBaseline = 'middle';

                const bgGrad = ctx.createLinearGradient(0, 0, W, H);
                bgGrad.addColorStop(0, '#04080f');
                bgGrad.addColorStop(0.5, '#08101e');
                bgGrad.addColorStop(1, '#04080f');
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, W, H);

                ctx.strokeStyle = 'rgba(0,240,255,0.04)';
                ctx.lineWidth = 1;
                for (let x = 0; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
                for (let y = 0; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

                ctx.strokeStyle = 'rgba(0,240,255,0.18)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(8,1); ctx.lineTo(W-8,1); ctx.quadraticCurveTo(W-1,1,W-1,8);
                ctx.lineTo(W-1,H-8); ctx.quadraticCurveTo(W-1,H-1,W-8,H-1);
                ctx.lineTo(8,H-1); ctx.quadraticCurveTo(1,H-1,1,H-8);
                ctx.lineTo(1,8); ctx.quadraticCurveTo(1,1,8,1);
                ctx.closePath(); ctx.stroke();

                const thumbSize = 140;
                const thumbX = 30, thumbY = (H - thumbSize) / 2;
                let thumbLoaded = false;
                if (t.thumbnail) {
                    try {
                        const thumb = await loadImage(t.thumbnail);
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(thumbX+8,thumbY); ctx.lineTo(thumbX+thumbSize-8,thumbY);
                        ctx.quadraticCurveTo(thumbX+thumbSize,thumbY,thumbX+thumbSize,thumbY+8);
                        ctx.lineTo(thumbX+thumbSize,thumbY+thumbSize-8);
                        ctx.quadraticCurveTo(thumbX+thumbSize,thumbY+thumbSize,thumbX+thumbSize-8,thumbY+thumbSize);
                        ctx.lineTo(thumbX+8,thumbY+thumbSize); ctx.quadraticCurveTo(thumbX,thumbY+thumbSize,thumbX,thumbY+thumbSize-8);
                        ctx.lineTo(thumbX,thumbY+8); ctx.quadraticCurveTo(thumbX,thumbY,thumbX+8,thumbY);
                        ctx.closePath(); ctx.clip();
                        ctx.drawImage(thumb, thumbX, thumbY, thumbSize, thumbSize);
                        ctx.restore();
                        thumbLoaded = true;
                    } catch(e) {}
                }
                if (!thumbLoaded) {
                    ctx.fillStyle = 'rgba(0,240,255,0.08)';
                    ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
                    ctx.fillStyle = '#00f0ff';
                    ctx.font = 'bold 40px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('🎵', thumbX + thumbSize/2, thumbY + thumbSize/2);
                }

                ctx.strokeStyle = 'rgba(0,240,255,0.35)';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(thumbX, thumbY, thumbSize, thumbSize);

                const tx = thumbX + thumbSize + 22;
                const maxW = W - tx - 20;

                const isPaused = q.player?.state?.status === 'paused';
                ctx.fillStyle = isPaused ? '#f1c40f' : '#00ff88';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(isPaused ? '⏸ PAUSED' : '▶ NOW PLAYING', tx, 28);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 22px sans-serif';
                const title = t.title.length > 28 ? t.title.substring(0,27)+'…' : t.title;
                ctx.fillText(title, tx, 60);

                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.font = '12px sans-serif';
                const artistLine = [t.artist, t.album].filter(x => x && x !== 'Unknown').join(' · ');
                const artistTrim = artistLine.length > 38 ? artistLine.substring(0,37)+'…' : artistLine;
                if (artistTrim) ctx.fillText(artistTrim, tx, 84);

                const barX = tx, barY = 108, barW = maxW, barH = 6;
                const pct = t.duration > 0 ? Math.min(1, elapsed / t.duration) : 0;
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill();
                if (pct > 0) {
                    const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
                    barGrad.addColorStop(0, '#00f0ff');
                    barGrad.addColorStop(1, '#00ff88');
                    ctx.fillStyle = barGrad;
                    ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(6, barW * pct), barH, 3); ctx.fill();
                    ctx.fillStyle = '#00f0ff';
                    ctx.beginPath(); ctx.arc(barX + barW * pct, barY + barH/2, 5, 0, Math.PI*2); ctx.fill();
                }

                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(formatTime(elapsed), barX, barY + 20);
                ctx.textAlign = 'right';
                ctx.fillText(formatTime(t.duration), barX + barW, barY + 20);

                ctx.textAlign = 'left';
                ctx.font = '10px sans-serif';
                const stats = [
                    `🔊 ${q.volume}%`,
                    `📋 ${q.tracks.length} queued`,
                    `🔁 ${q.loop ? 'ON' : 'OFF'}`,
                    t.source || 'SoundCloud'
                ];
                let sx = tx;
                for (const stat of stats) {
                    ctx.fillStyle = 'rgba(0,240,255,0.5)';
                    ctx.fillText(stat, sx, 155);
                    sx += ctx.measureText(stat).width + 16;
                }

                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.font = '9px sans-serif';
                ctx.fillText(`Requested by ${t.requestedBy}`, tx, 175);

                ctx.fillStyle = 'rgba(0,240,255,0.08)';
                ctx.beginPath(); ctx.roundRect(W-108, 14, 90, 18, 4); ctx.fill();
                ctx.fillStyle = '#00f0ff';
                ctx.font = 'bold 7px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('ARCHON CG-223', W-63, 25);

                ctx.strokeStyle = 'rgba(0,240,255,0.2)';
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(W-40,1); ctx.lineTo(W-1,1); ctx.lineTo(W-1,40); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(1,H-40); ctx.lineTo(1,H-1); ctx.lineTo(40,H-1); ctx.stroke();

                const pngRaw = await c.encode('png');
                const png = Buffer.isBuffer(pngRaw) ? pngRaw : Buffer.from(pngRaw);
                const { AttachmentBuilder, EmbedBuilder: EB2 } = require('discord.js');
                const attachment = new AttachmentBuilder(png, { name: 'nowplaying.png' });
                const npEmbed = new EB2()
                    .setColor(q.player?.state?.status === 'paused' ? 0xf1c40f : 0x00f0ff)
                    .setImage('attachment://nowplaying.png')
                    .setFooter({ text: `BAMAKO_223 🇲🇱 • Vol: ${q.volume}% • Queue: ${q.tracks.length} • Loop: ${q.loop ? 'ON' : 'OFF'}` })
                    .setTimestamp();
                return interaction.editReply({ embeds: [npEmbed], files: [attachment], components: [buildControls(q)] });
            } catch(canvasErr) {
                console.error('[MUSIC NP] Canvas error:', canvasErr.message);
                return interaction.editReply({ embeds: [buildNowPlayingEmbed(q, client)], components: [buildControls(q)] });
            }
        }

        // ── VOLUME ──
        if (sub === 'volume') {
            const vol = interaction.options.getInteger('level');
            q.volume = vol;
            try { q.player?.state?.resource?.volume?.setVolume(vol/100); } catch(e) {}
            await updatePersistentPanel(q).catch(() => {});
            const bar = '█'.repeat(Math.round(vol/10)) + '░'.repeat(10-Math.round(vol/10));
            const embed = new EmbedBuilder().setColor(ARCHON.purple)
                .setDescription(`\`\`\`ansi\n\u001b[1;35m▸ VOLUME\u001b[0m \u001b[1;36m${bar}\u001b[0m \u001b[1;33m${vol}%\u001b[0m\n\`\`\``);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── LOOP ──
        if (sub === 'loop') {
            q.loop = !q.loop;
            if (q.loop && q.currentTrack) q.tracks.unshift({...q.currentTrack});
            await updatePersistentPanel(q).catch(() => {});
            const embed = new EmbedBuilder().setColor(q.loop ? ARCHON.green : ARCHON.orange)
                .setDescription(`\`\`\`ansi\n[1;${q.loop?'32':'33'}m▸ LOOP ${q.loop?'ENABLED':'DISABLED'}\u001b[0m\n\`\`\``);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── AUTOPLAY ──
        if (sub === 'autoplay') {
            q.autoplay = !q.autoplay;
            await updatePersistentPanel(q).catch(() => {});
            const embed = new EmbedBuilder().setColor(q.autoplay ? ARCHON.green : ARCHON.orange)
                .setDescription(`\`\`\`ansi\n[1;${q.autoplay?'32':'33'}m▸ AUTOPLAY ${q.autoplay?'ENABLED':'DISABLED'}\u001b[0m\n\`\`\``);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── SILENT ── 🔕 toggle @silent panel notifications
        if (sub === 'silent') {
            q.silentPanel = !q.silentPanel;
            if (q.persistentMsg) {
                const oldMsg = q.persistentMsg;
                q.persistentMsg = null; q.panelMsgId = null;
                try { await oldMsg.delete().catch(() => {}); } catch(e) {}
                await updatePersistentPanel(q);
            }
            const embed = new EmbedBuilder().setColor(q.silentPanel ? ARCHON.gold : ARCHON.green)
                .setDescription(`\`\`\`ansi\n[1;${q.silentPanel?'33':'32'}m▸ SILENT PANEL ${q.silentPanel?'ENABLED 🔕':'DISABLED 🔔'}\u001b[0m\n\`\`\``);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── LIBRARY ──
        if (sub === 'library') {
            let lib;
            try { lib = require('../data/music-library.json'); }
            catch(e) { return interaction.editReply({ content: '❌ Library not found on server.' }); }

            const { StringSelectMenuBuilder: SSM, ActionRowBuilder: ARB, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');
            const PER_PAGE = 10;

            // Folder catalog (order of first appearance, with counts)
            const folders = [];
            const folderMap = new Map();
            for (const t of lib) {
                const f = t.folder || '🎵 Other';
                if (!folderMap.has(f)) { folderMap.set(f, []); folders.push(f); }
                folderMap.get(f).push(t);
            }

            const searchTerm = (interaction.options.getString('search') || '').trim().toLowerCase();
            const state = { folder: searchTerm ? '__search__' : null, page: 1, search: searchTerm, userId: interaction.user.id, viewTracks: [] };

            const resolveTracks = () => {
                if (state.folder === '__all__') return lib;
                if (state.folder === '__liked__') return getUserLikes(state.userId);
                if (state.folder === '__search__') return lib.filter(t => `${t.title} ${t.query || ''}`.toLowerCase().includes(state.search));
                return folderMap.get(state.folder) || lib;
            };

            const renderLibrary = () => {
                const embed = new EmbedBuilder()
                    .setColor(ARCHON.cyan)
                    .setAuthor({ name: '// CLASSIFIED // ARCHON MUSIC LIBRARY //', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();
                const rows = [];

                // Row 1 — folder select (always present)
                const folderMenu = new SSM().setCustomId('mlb_folder').setPlaceholder('📁 Choose a folder to browse…');
                const likedCount = getUserLikes(state.userId).length;
                if (likedCount > 0) {
                    folderMenu.addOptions({
                        label: '❤️ My Liked Songs', value: '__liked__',
                        description: `${likedCount} track${likedCount > 1 ? 's' : ''} · your favorites`,
                        default: state.folder === '__liked__',
                    });
                }
                folderMenu.addOptions({
                    label: '🎵 All Tracks', value: '__all__',
                    description: `${lib.length} tracks · full catalog`,
                    default: state.folder === '__all__',
                });
                for (const f of folders.slice(0, 24)) {
                    folderMenu.addOptions({
                        label: f.substring(0, 95),
                        value: f,
                        description: `${folderMap.get(f).length} tracks`,
                        default: state.folder === f,
                    });
                }
                rows.push(new ARB().addComponents(folderMenu));

                if (state.folder === null) {
                    // Home — catalog overview
                    const overview = folders.map(f => `> ${f} — \`${folderMap.get(f).length} tracks\``).join('\n');
                    embed.setTitle('📚 Music Library')
                        .setDescription(`**${lib.length} curated tracks** across ${folders.length} folders.\nSelect a folder below to browse and queue.\n\n${overview}`)
                        .addFields({ name: 'Now Playing', value: q?.currentTrack ? `🎵 ${q.currentTrack.title.substring(0, 60)}` : '⏹️ Nothing', inline: false })
                        .setFooter({ text: 'BAMAKO_223 🇲🇱 • Pick a folder • /music library search:<term> to search' });
                } else {
                    // Folder view — paginated tracks
                    const tracks = resolveTracks();
                    state.viewTracks = tracks;
                    const totalPages = Math.max(1, Math.ceil(tracks.length / PER_PAGE));
                    state.page = Math.min(Math.max(1, state.page), totalPages);
                    const slice = tracks.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
                    const list = slice.map((t, i) => `\`${String((state.page - 1) * PER_PAGE + i + 1).padStart(3, '0')}\` ${t.title.replace(/^🎵\s*/, '🎵 ')}`).join('\n');
                    const viewTitle = state.folder === '__all__' ? '🎵 All Tracks'
                        : state.folder === '__liked__' ? '❤️ My Liked Songs'
                        : state.folder === '__search__' ? `🔍 "${state.search}" — ${tracks.length} result${tracks.length !== 1 ? 's' : ''}`
                        : state.folder;
                    embed.setTitle(viewTitle)
                        .setDescription(tracks.length ? list : '*Nothing here yet — hit the ❤️ Like button while listening!*')
                        .addFields(
                            { name: 'Tracks', value: `\`${tracks.length}\``, inline: true },
                            { name: 'Page', value: `\`${state.page}/${totalPages}\``, inline: true },
                            { name: 'Now Playing', value: q?.currentTrack ? `🎵 ${q.currentTrack.title.substring(0, 30)}` : '⏹️ Nothing', inline: true },
                        )
                        .setFooter({ text: 'BAMAKO_223 🇲🇱 • Select tracks below to queue them instantly' });

                    if (tracks.length) {
                        // Row 2 — track pick (multi-select queues several at once)
                        const pickMenu = new SSM().setCustomId('mlb_pick').setPlaceholder('🎧 Pick track(s) to queue…')
                            .setMinValues(1).setMaxValues(Math.min(slice.length, 10));
                        for (let i = 0; i < slice.length; i++) {
                            const t = slice[i];
                            pickMenu.addOptions({
                                label: t.title.replace(/^🎵\s*/, '').substring(0, 95),
                                value: String((state.page - 1) * PER_PAGE + i),
                                description: (t.folder || '').substring(0, 95),
                            });
                        }
                        rows.push(new ARB().addComponents(pickMenu));
                    }

                    // Row 3 — pagination + shuffle
                    const nav = new ARB();
                    nav.addComponents(new BB().setCustomId('mlb_prev').setLabel('◀ Prev').setStyle(BS.Secondary).setDisabled(state.page <= 1));
                    nav.addComponents(new BB().setCustomId('mlb_next').setLabel('Next ▶').setStyle(BS.Primary).setDisabled(state.page >= totalPages));
                    nav.addComponents(new BB().setCustomId('mlb_home').setLabel('📚 Folders').setStyle(BS.Secondary));
                    nav.addComponents(new BB().setCustomId('mlb_shuffle').setLabel('🔀 Shuffle').setStyle(BS.Success).setDisabled(!tracks.length));
                    rows.push(nav);
                }
                return { embeds: [embed], components: rows };
            };

            const msg = await interaction.editReply(renderLibrary());
            if (!msg) return;

            const collector = msg.createMessageComponentCollector({ time: 300000 });
            collector.on('collect', async (i) => {
                try {
                    if (i.customId === 'mlb_folder') {
                        state.folder = i.values[0] === '__all__' ? '__all__' : i.values[0];
                        state.page = 1;
                        await i.update(renderLibrary()).catch(() => {});
                    } else if (i.customId === 'mlb_prev' || i.customId === 'mlb_next') {
                        state.page += i.customId === 'mlb_next' ? 1 : -1;
                        await i.update(renderLibrary()).catch(() => {});
                    } else if (i.customId === 'mlb_home') {
                        state.folder = null; state.page = 1;
                        await i.update(renderLibrary()).catch(() => {});
                    } else if (i.customId === 'mlb_pick') {
                        if (!i.member?.voice?.channel) {
                            return i.reply({ content: '❌ Join a voice channel first!', flags: 64 }).catch(() => {});
                        }
                        await i.deferUpdate().catch(() => {});
                        let first = true;
                        for (const v of i.values) {
                            const t = state.viewTracks[parseInt(v)];
                            if (!t) continue;
                            await handlePlay(
                                interaction.guild.id, interaction.guild,
                                i.member.voice.channel, interaction.channel,
                                t.query || t.title, i.user.username, client,
                                async (opts) => {
                                    if (first) { first = false; await i.followUp({ ...opts, flags: 64 }).catch(() => {}); }
                                    return null;
                                },
                                i.user.id
                            );
                        }
                    } else if (i.customId === 'mlb_shuffle') {
                        if (!i.member?.voice?.channel) {
                            return i.reply({ content: '❌ Join a voice channel first!', flags: 64 }).catch(() => {});
                        }
                        const tracks = [...resolveTracks()];
                        if (!tracks.length) return i.reply({ content: '❌ Nothing to shuffle here.', flags: 64 }).catch(() => {});
                        // Fisher-Yates
                        for (let x = tracks.length - 1; x > 0; x--) {
                            const y = Math.floor(Math.random() * (x + 1));
                            [tracks[x], tracks[y]] = [tracks[y], tracks[x]];
                        }
                        const qNow = getQueue(interaction.guild.id);
                        const cap = Math.max(0, 50 - (qNow?.tracks.length || 0));
                        const batch = tracks.slice(0, cap);
                        if (!batch.length) return i.reply({ content: '❌ Queue is full (50 max). Skip or stop first!', flags: 64 }).catch(() => {});
                        await i.deferUpdate().catch(() => {});
                        let first = true;
                        for (const t of batch) {
                            await handlePlay(
                                interaction.guild.id, interaction.guild,
                                i.member.voice.channel, interaction.channel,
                                t.query || t.title, i.user.username, client,
                                async (opts) => {
                                    if (first) {
                                        first = false;
                                        await i.followUp({ content: `🔀 Shuffled **${batch.length} tracks** from ${state.folder === '__liked__' ? '❤️ My Liked Songs' : state.folder === '__all__' ? '🎵 All Tracks' : state.folder} into the queue!`, flags: 64 }).catch(() => {});
                                    }
                                    return null;
                                },
                                i.user.id
                            );
                        }
                    }
                } catch (e) { console.log('[LIBRARY]', e.message); }
            });
            collector.on('end', () => {
                try {
                    const r = renderLibrary();
                    for (const row of r.components) for (const c of row.components) c.setDisabled(true);
                    msg.edit({ embeds: r.embeds, components: r.components }).catch(() => {});
                } catch (e) {}
            });
        }
    }
};

