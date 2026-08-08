const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    ContainerBuilder, TextDisplayBuilder, SectionBuilder,
    ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');
const EMOJIS = require('../config/emojis');

// Parse emoji string to Discord button-compatible object
function parseEmoji(emojiStr) {
    if (!emojiStr) return '🎵';
    const match = emojiStr.match(/<(a?):([^:]+):(\d+)>/);
    if (!match) return emojiStr; // plain unicode
    return { animated: match[1] === 'a', name: match[2], id: match[3] };
}
const {
    joinVoiceChannel, createAudioPlayer, createAudioResource,
    AudioPlayerStatus, VoiceConnectionStatus, entersState,
    getVoiceConnection, StreamType
} = require('@discordjs/voice');
const playdl = require('play-dl');
const { exec, spawn } = require('child_process');
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
        audioFilter: 'normalize', // 🎚️ default audio filter
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

// 👎 DISLIKES (per-guild autoplay blacklist) — data/dislikes.json
const DISLIKES_PATH = require('path').join(__dirname, '../data/dislikes.json');
function loadDislikes() {
    try { return JSON.parse(require('fs').readFileSync(DISLIKES_PATH, 'utf8')); } catch (e) { return {}; }
}
function saveDislikes(data) {
    try { require('fs').writeFileSync(DISLIKES_PATH, JSON.stringify(data, null, 2)); } catch (e) {}
}
function getGuildDislikes(guildId) { return loadDislikes()[guildId] || []; }

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
        if (q._panelCollector) { try { q._panelCollector.stop('destroy'); } catch(e) {} q._panelCollector = null; }
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

// Platform emoji map — sourced from centralized config
const PLATFORM_EMOJI = {
    spotify:    EMOJIS.spotify,
    soundcloud: EMOJIS.soundcloud,
    youtube:    EMOJIS.youtube,
    local:      EMOJIS.folder,
};
function getPlatformEmoji(track) {
    if (track?.spotifyUrl)              return PLATFORM_EMOJI.spotify;
    if (track?.source === 'SoundCloud') return PLATFORM_EMOJI.soundcloud;
    if (track?.source === 'YouTube')    return PLATFORM_EMOJI.youtube;
    if (track?.source === 'Local')      return PLATFORM_EMOJI.local;
    return '🎵';
}

// Always-clickable title — real Spotify URL when we have it, YouTube search as fallback
function trackLinkFor(t, maxLen = 120) {
    const name = (t.artist && t.artist !== 'Unknown' && !t.title.includes(t.artist))
        ? `${t.artist} - ${t.title}` : t.title;
    const url = t.spotifyUrl
        || `https://www.youtube.com/results?search_query=${encodeURIComponent(t.query || t.title)}`;
    return `[${name.substring(0, maxLen)}](${url})`;
}

// ═══════════════════════════════════════════════════════
// EMBEDS
// ═══════════════════════════════════════════════════════
function buildNowPlayingEmbed(q, client) {
    const t = q.currentTrack;
    if (!t) return null;
    const now = Date.now(); const currentPause = q.pausedAt ? now - q.pausedAt : 0; const elapsed = q.startTime ? Math.floor((now - q.startTime - q.totalPaused - currentPause) / 1000) : 0;
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
    const now = Date.now(); const currentPause = q.pausedAt ? now - q.pausedAt : 0; const elapsed = q.startTime ? Math.floor((now - q.startTime - q.totalPaused - currentPause) / 1000) : 0;
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

    // Row 1 — Core (4 buttons max — no wrapping on mobile CV2)
    const rowTransport = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mc_pause').setLabel(isPaused ? 'Resume' : 'Pause').setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary).setEmoji(isPaused ? '▶️' : '⏸️'),
        new ButtonBuilder().setCustomId('mc_skip').setLabel('Skip').setStyle(ButtonStyle.Secondary).setEmoji('⏭️'),
        new ButtonBuilder().setCustomId('mc_stop').setLabel('Stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️'),
        new ButtonBuilder().setCustomId('mc_autoplay').setLabel('AutoPlay').setStyle(q.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🔀'),
    );

    // Row 2 — Extras (emoji only — no labels to avoid wrapping)
    const rowSession = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mc_voldown').setStyle(ButtonStyle.Secondary).setEmoji('🔊').setDisabled(q.volume <= 0),
        new ButtonBuilder().setCustomId('mc_prev').setStyle(ButtonStyle.Secondary).setEmoji('⏮️').setDisabled(!hasPrev),
        new ButtonBuilder().setCustomId('mc_loop').setStyle(q.loop ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🔁'),
        new ButtonBuilder().setCustomId('mc_volup').setStyle(ButtonStyle.Secondary).setEmoji('🔊').setDisabled(q.volume >= 100),
    );

    // Row 3 — Taste + Queue
    const rowTaste = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mc_like').setLabel('Like').setStyle(ButtonStyle.Secondary).setEmoji('❤️'),
        new ButtonBuilder().setCustomId('mc_dislike').setLabel('Not for me').setStyle(ButtonStyle.Secondary).setEmoji('👎'),
        new ButtonBuilder().setCustomId('mc_queue').setLabel('Queue').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
    );

    return [rowTransport, rowSession, rowTaste];
}

// ═══════════════════════════════════════════════════════
// COMPONENTS V2 — TRUE FLAVIBOT CARD (buttons INSIDE the border)
// ═══════════════════════════════════════════════════════
// Genre-mapped accent colors for the CV2 container border
const GENRE_ACCENT = {
    Afrobeat: 0xE67E22, Mali: 0x14B53A, HipHop: 0x9B59B6,
    EDM: 0x00f0ff, Chinese: 0xE74C3C, FrenchRap: 0x3498DB,
    AfroTrap: 0x2ECC71, Arabic: 0x1ABC9C,
};
function accentForTrack(t) {
    if (t?._genreColor) return t._genreColor;
    const hay = (t?.requestedBy || '').toLowerCase();
    for (const [g, c] of Object.entries(GENRE_ACCENT)) {
        if (hay.includes(g.toLowerCase())) return c;
    }
    return 0x5865F2; // default blurple
}

function buildPanelContainer(q, client) {
    const t = q.currentTrack;
    const now = Date.now(); const currentPause = q.pausedAt ? now - q.pausedAt : 0; const elapsed = q.startTime ? Math.floor((now - q.startTime - q.totalPaused - currentPause) / 1000) : 0;
    const duration = t.duration || 0;
    const isPaused = q.player?.state?.status === AudioPlayerStatus.Paused;

    const botName = client.user?.displayName || client.user?.username || 'ARCHON';
    const autoGenre = t.requestedBy?.split('•')[1]?.trim();
    const requester = t.requestedById
        ? `<@${t.requestedById}>`
        : `🤖 ${botName} • AutoPlay${autoGenre ? ` • ${autoGenre}` : ''}`;

    // CV2 TextDisplay doesn't render markdown hyperlinks — use plain bold title
    const fullTitle = (t.artist && t.artist !== 'Unknown' && !t.title.includes(t.artist))
        ? `${t.artist} - ${t.title}` : t.title;
    const displayTitle = `**${fullTitle.substring(0, 100)}**`;
    const sourceUrl = t.spotifyUrl
        || `https://www.youtube.com/results?search_query=${encodeURIComponent(t.query || t.title)}`;

    const header = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(isPaused ? '## ⏸️ Paused' : '## Now playing'),
            new TextDisplayBuilder().setContent(
                `${displayTitle}\n` +
                `[Open on ${t.spotifyUrl ? 'Spotify' : 'YouTube'}](${sourceUrl})\n\n` +
                `• Added by ${requester}\n` +
                `• 🔊 ${q.voiceChannel?.name?.substring(0, 22) || 'Voice'}`
            )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(t.thumbnail || client.user.displayAvatarURL()));

    const statsLine = new TextDisplayBuilder().setContent(
        `Queue Size: \`${q.tracks.length}\` · Volume: \`${q.volume}%\` · Loop: \`${q.loop ? 'On' : 'Off'}\``
    );

    const [rowTransport, rowSession, rowTaste] = buildPanelRows(q);

    const progress = new TextDisplayBuilder().setContent(
        `${sliderBar(elapsed, duration)}\n` +
        `\`${formatTime(elapsed)}\` ――― \`${formatTime(duration)}\``
    );

    const filterIcon = FILTER_EMOJI[q.audioFilter] || '🎵';
    const footer = new TextDisplayBuilder().setContent(
        `-# BAMAKO_223 🇲🇱 • Auto: ${q.autoplay ? 'On' : 'Off'} • ${q.silentPanel ? '🔕' : '🔔'} • ${filterIcon} ${q.audioFilter || 'Normal'}`
    );

    return new ContainerBuilder()
        .setAccentColor(isPaused ? 0xF1C40F : accentForTrack(t))
        .addSectionComponents(header)
        .addTextDisplayComponents(statsLine)
        .addTextDisplayComponents(progress)
        .addActionRowComponents(rowTransport)
        .addActionRowComponents(rowSession)
        .addActionRowComponents(rowTaste)
        .addTextDisplayComponents(footer);
}

function attachCollector(q, msg) {
    const client = q._client;
    // Stop any previous collector to prevent duplicate handlers
    if (q._panelCollector) {
        try { q._panelCollector.stop('new-panel'); } catch(e) {}
        q._panelCollector = null;
    }
    // Collector lives until the panel is manually deleted (no timeout)
    const collector = msg.createMessageComponentCollector({ time: 0 });
    q._panelCollector = collector;
    collector.on('collect', async (i) => {
        // ── ZOMBIE GUARD: if this click is on an old panel, tell user to scroll down ──
        if (i.message.id !== q.panelMsgId) {
            return i.reply({ content: '💡 This panel is outdated — scroll down for the live one!', flags: 64 }).catch(() => {});
        }
        if (!i.member?.voice?.channel) return i.reply({ content: '🎤 Hop into a voice channel first — I need a stage!', flags: 64 }).catch(() => {});
        let deferred = true;
        await i.deferUpdate().catch(() => { deferred = false; });
        const qNow = getQueue(q.guild.id);
        if (!qNow) return;
        if (!deferred && i.customId === 'mc_queue') {
            await qNow.textChannel?.send({ embeds: [buildQueueEmbed(qNow, client)] }).catch(() => {});
            return;
        }
        if (!deferred) return;

        if (i.customId === 'mc_prev') {
            if (!qNow.trackHistory || qNow.trackHistory.length === 0) {
                await i.followUp({ content: '🤷 Nothing behind this one — it\'s the opening act!', flags: 64 }).catch(() => {});
                return;
            }
            const prev = qNow.trackHistory.shift();
            if (qNow.currentTrack) qNow.tracks.unshift({...qNow.currentTrack});
            qNow.tracks.unshift(prev);
            await i.followUp({ content: `${EMOJIS.shuffle} Going back to **${prev.title?.substring(0,50)}**…`, flags: 64 }).catch(() => {});
            qNow.player.stop(); // Triggers Idle → playNext
        } else if (i.customId === 'mc_pause') {
            if (qNow.player.state.status === AudioPlayerStatus.Paused) {
                qNow.player.unpause();
                qNow.totalPaused += Date.now() - (qNow.pausedAt || Date.now());
                qNow.pausedAt = null;
                await i.followUp({ content: `${EMOJIS.check} Resumed`, flags: 64 }).catch(() => {});
            } else {
                qNow.player.pause();
                qNow.pausedAt = Date.now();
                await i.followUp({ content: `${EMOJIS.pause} Paused`, flags: 64 }).catch(() => {});
            }
            updatePersistentPanel(qNow).catch(() => {});
        } else if (i.customId === 'mc_skip') {
            await i.followUp({ content: `${EMOJIS.skip} Skipping **${qNow.currentTrack?.title?.substring(0,50) || 'track'}**…`, flags: 64 }).catch(() => {});
            qNow.player.stop();
        } else if (i.customId === 'mc_stop') {
            if (qNow.persistentMsg) {
                await qNow.persistentMsg.delete().catch(() => {});
                qNow.persistentMsg = null; qNow.panelMsgId = null;
                const stoppedEmbed = new EmbedBuilder().setColor(ARCHON.red)
                    .setDescription('⏹️ **Music stopped** — the stage is yours whenever you\'re ready. `/music play` brings me back 🎧');
                await qNow.textChannel?.send({ embeds: [stoppedEmbed] }).catch(() => {});
            }
            destroyQueue(q.guild.id);
        } else if (i.customId === 'mc_voldown' || i.customId === 'mc_volup') {
            qNow.volume = Math.max(0, Math.min(100, (qNow.volume ?? 80) + (i.customId === 'mc_volup' ? 10 : -10)));
            try { qNow.player?.state?.resource?.volume?.setVolume(qNow.volume / 100); } catch(e) {}
            await i.followUp({ content: `${EMOJIS.volume} Volume set to \`${qNow.volume}%\``, flags: 64 }).catch(() => {});
            updatePersistentPanel(qNow).catch(() => {});
        } else if (i.customId === 'mc_loop') {
            qNow.loop = !qNow.loop;
            // NOTE: do NOT unshift here — AudioPlayerStatus.Idle handler does it
            await i.followUp({ content: `${EMOJIS.loop} Loop **${qNow.loop ? 'enabled' : 'disabled'}**`, flags: 64 }).catch(() => {});
            updatePersistentPanel(qNow).catch(() => {});
        } else if (i.customId === 'mc_autoplay') {
            qNow.autoplay = !qNow.autoplay;
            await i.followUp({ content: `${EMOJIS.shuffle} AutoPlay **${qNow.autoplay ? 'enabled' : 'disabled'}**`, flags: 64 }).catch(() => {});
            updatePersistentPanel(qNow).catch(() => {});
        } else if (i.customId === 'mc_like') {
            const t = qNow.currentTrack;
            if (!t) return i.followUp({ content: '🤔 Nothing\'s playing right now — start something and I\'ll save it for you!', flags: 64 }).catch(() => {});
            const all = loadLikes();
            const mine = all[i.user.id] = all[i.user.id] || [];
            const key = (t.query || t.title).toLowerCase();
            if (mine.some(x => (x.query || x.title).toLowerCase() === key)) {
                return i.followUp({ content: `❤️ **${t.title.substring(0, 50)}** is already living in your Liked Songs! 🎧`, flags: 64 }).catch(() => {});
            }
            mine.unshift({ title: t.title.replace(/^🎵\s*/, ''), query: t.query || t.title, folder: '❤️ Liked Songs', likedAt: Date.now() });
            saveLikes(all);
            await i.followUp({ content: `❤️ Saved **${t.title.substring(0, 50)}** — you now have \`${mine.length}\` liked song${mine.length > 1 ? 's' : ''}.\nFind them in \`/music library\` → **❤️ My Liked Songs**!`, flags: 64 }).catch(() => {});
        } else if (i.customId === 'mc_dislike') {
            const t = qNow.currentTrack;
            if (!t) return i.followUp({ content: '🤔 Nothing\'s playing to skip — queue something up first!', flags: 64 }).catch(() => {});
            const artist = (t.artist && t.artist !== 'Unknown') ? t.artist : t.title.replace(/^🎵\s*/, '');
            const all = loadDislikes();
            const list = all[qNow.guild.id] = all[qNow.guild.id] || [];
            const key = artist.toLowerCase();
            if (!list.some(x => x.key === key)) {
                list.unshift({ key, label: artist.substring(0, 60), at: Date.now() });
                if (list.length > 50) list.pop();
                saveDislikes(all);
            }
            await i.followUp({ content: `👎 **${t.title.substring(0, 50)}** skipped — noted!\nI'll keep **${artist.substring(0, 40)}** off your autoplay from now on 🎧`, flags: 64 }).catch(() => {});
            qNow.player.stop(); // Triggers Idle → playNext
        } else if (i.customId === 'mc_queue') {
            await i.followUp({ embeds: [buildQueueEmbed(qNow, client)], flags: 64 }).catch(() => {});
        }
    });
}

async function sendPanel(q) {
    const client = q._client;

    // ── Stop old collector so it doesn't eat clicks meant for the new panel ──
    if (q._panelCollector) {
        try { q._panelCollector.stop('relocate'); } catch(e) {}
        q._panelCollector = null;
    }

    // ── Kill old panel by ID (direct API, no fetch needed) ──
    if (q.panelMsgId) {
        try { await q.textChannel.messages.delete(q.panelMsgId); } catch(e) {}
        q.panelMsgId = null; q.persistentMsg = null;
    }

    // ── Sweep only CV2 panels (not regular embeds/stop messages) ──
    try {
        const recent = await q.textChannel.messages.fetch({ limit: 20 });
        for (const [, m] of recent) {
            if (m.author.id !== client.user.id) continue;
            // Only delete CV2 container messages (flags bit 32768)
            const isCV2Panel = m.flags?.has(MessageFlags.IsComponentsV2);
            if (isCV2Panel) await m.delete().catch(() => {});
        }
    } catch(e) {}

    const flags = MessageFlags.IsComponentsV2 | (q.silentPanel ? MessageFlags.SuppressNotifications : 0);
    const msg = await q.textChannel.send({
        components: [buildPanelContainer(q, client)],
        flags,
    }).catch(() => null);
    if (msg) {
        q.persistentMsg = msg;
        q.panelMsgId = msg.id;
        attachCollector(q, msg);
    }
}

async function updatePersistentPanel(q, opts = {}) {
    const client = q._client;
    if (!client || !q.currentTrack || !q.textChannel) return;

    const container = buildPanelContainer(q, client);

    try {
        let msg = q.persistentMsg;

        // Recover lost reference (e.g. after error paths) via stored ID
        if (!msg && q.panelMsgId) {
            msg = await q.textChannel.messages.fetch(q.panelMsgId).catch(() => null);
            q.persistentMsg = msg;
        }

        // New track → relocate panel to the bottom of chat (one message per track, no spam)
        if (opts.resend) {
            if (q.panelMsgId) {
                try { await q.textChannel.messages.delete(q.panelMsgId); } catch(e) {}
                q.panelMsgId = null;
            }
            if (msg) { await msg.delete().catch(() => {}); }
            q.persistentMsg = null; q.panelMsgId = null;
            msg = null;
        }

        if (msg) {
            let resend = false;
            await msg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch((e) => {
                if (e.code === 10008) { resend = true; } // message genuinely deleted
                // other errors (rate limit, network) → keep panel, retry next 15s tick
            });
            if (resend) {
                q.persistentMsg = null; q.panelMsgId = null;
                await sendPanel(q);
            }
        } else {
            await sendPanel(q);
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

// iTunes artwork fallback — free, no key, great non-Spotify coverage
async function searchItunesArtwork(query) {
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`);
        const data = await res.json();
        const item = data.results?.[0];
        if (!item) return null;
        return {
            thumbnail: item.artworkUrl100?.replace('100x100bb', '600x600bb') || null,
            title: item.trackName || null,
            artist: item.artistName || null,
        };
    } catch(e) { return null; }
}

// Branded placeholder when no cover exists anywhere
const NO_COVER_ART = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Font_Awesome_5_solid_music.svg/512px-Font_Awesome_5_solid_music.svg.png';

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

// ═══════════════════════════════════════════════════════
// AUDIO FILTER ENGINE — real-time ffmpeg effects
// ═══════════════════════════════════════════════════════
const FILTER_MAP = {
    bassboost: 'bass=gain=15',
    nightcore: 'asetrate=48000*1.25,atempo=1.25',
    vaporwave: 'asetrate=48000*0.8,atempo=0.8,aecho=0.8:0.9:1000:0.3',
    normalize: 'loudnorm=I=-14:TP=-2:LRA=11',
};
const FILTER_EMOJI = { bassboost: '🔊', nightcore: '🐰', vaporwave: '🌴', normalize: '📊', '': '🎵' };

function createFilteredResource(input, q) {
    const filterStr = FILTER_MAP[q?.audioFilter] || '';
    if (!filterStr) {
        if (typeof input === 'string') {
            return createAudioResource(require('fs').createReadStream(input), { inputType: StreamType.OggOpus, inlineVolume: true });
        }
        return createAudioResource(input, { inputType: StreamType.OggOpus, inlineVolume: true });
    }
    const isFile = typeof input === 'string';
    const args = ['-hide_banner', '-loglevel', 'error'];
    if (isFile) args.push('-i', input);
    else args.push('-i', 'pipe:0');
    args.push('-vn', '-af', filterStr, '-acodec', 'libopus', '-b:a', '128k', '-f', 'opus', 'pipe:1');
    const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let err = '';
    ffmpeg.stderr.on('data', d => { err += d.toString(); });
    ffmpeg.on('close', code => { if (code !== 0 && code !== null) console.log('[FFMPEG] filter exited', code, err.slice(-200)); });
    ffmpeg.on('error', () => {});
    if (!isFile) {
        input.pipe(ffmpeg.stdin);
        input.on('error', () => { try { ffmpeg.kill(); } catch(e) {} });
    }
    ffmpeg.stdin.on('error', () => {});
    ffmpeg.stdout.on('error', () => {});
    return createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus, inlineVolume: true });
}

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const file = createWriteStream(dest);
        proto.get(url, res => { res.pipe(file); file.on('finish', () => { file.close(); resolve(); }); })
            .on('error', err => { try { unlinkSync(dest); } catch(e) {} reject(err); });
    });
}

// ═══════════════════════════════════════════════════════
// PREFETCH — pre-download next track so skip feels instant
// ═══════════════════════════════════════════════════════
async function prefetchNext(q) {
    const track = q.tracks[0];
    if (!track || track.tempFile || track.prefetching || track.source === 'file' || track.url) return;
    track.prefetching = true;
    try {
        const safe = (track.query || track.title).replace(/"/g, '').replace(/'/g, '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
        if (!safe) { track.prefetching = false; return; }
        const cookiesPath = require('path').join(__dirname, '../assets/cookies.txt');
        const cookiesFlag = require('fs').existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';
        const tmpBase = require('path').join(require('os').tmpdir(), `archon_pre_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        await execAsync(`yt-dlp --no-playlist --cookies "${cookiesPath}" -x --audio-format opus --audio-quality 128K -o "${tmpBase}.%(ext)s" "ytsearch1:${safe}"`, { timeout: 300000 });
        const tmpFile = `${tmpBase}.opus`;
        if (require('fs').existsSync(tmpFile) && require('fs').statSync(tmpFile).size > 10000) {
            if (!track.tempFile) {
                track.tempFile = tmpFile;
                if (!track.source || track.source === 'SoundCloud') track.source = 'YouTube';
                if (!track.duration) {
                    try {
                        const { stdout: dur } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpFile}"`, { timeout: 8000 });
                        const d = parseFloat(dur.trim());
                        if (d > 0) track.duration = Math.round(d);
                    } catch (e) {}
                }
                console.log('[MUSIC] ⚡ Prefetched next:', track.title);
            } else {
                try { require('fs').unlinkSync(tmpFile); } catch(e) {}
            }
        }
    } catch (e) { console.log('[MUSIC] Prefetch failed (non-fatal):', e.message?.slice(0, 120)); }
    track.prefetching = false;
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
                const disliked = getGuildDislikes(q.guild.id).map(x => x.key);
                let next = null;
                for (let step = 0; step < lib.length; step++) {
                    q.libraryIndex = (q.libraryIndex + 1) % lib.length;
                    const cand = lib[q.libraryIndex];
                    const hay = `${cand.title} ${cand.query}`.toLowerCase();
                    if (!disliked.some(k => k && hay.includes(k))) { next = cand; break; }
                }
                if (!next) next = lib[q.libraryIndex]; // everything disliked — play anyway rather than stall
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
        try {
            const lib = require('../data/music-library.json');
            const libTrack = lib[track._libraryIndex];
            if (libTrack?.genre && GENRE_ACCENT[libTrack.genre]) {
                track._genreColor = GENRE_ACCENT[libTrack.genre];
            }
        } catch(e) {}
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

        // Cover fallback: iTunes artwork when Spotify came up empty
        if (!track.thumbnail) {
            try {
                const it = await searchItunesArtwork(track.query || track.title);
                if (it?.thumbnail) {
                    track.thumbnail = it.thumbnail;
                    if (track.artist === 'Unknown' && it.artist) track.artist = it.artist;
                    console.log('[MUSIC] iTunes artwork ✅ for:', track.title);
                }
            } catch(e) {}
        }
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
            resource = createFilteredResource(track.url, q);
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
                    const cookiesPath = require('path').join(__dirname, '../assets/cookies.txt');
                    const { stdout } = await execAsync(`yt-dlp --no-playlist --cookies "${cookiesPath}" --get-url "scsearch1:${safe}" 2>/dev/null`, { timeout: 20000 });
                    if (stdout.trim().split('\n')[0]?.startsWith('http')) {
                        const audioOut = pipeYtDlp(`scsearch1:${safe}`, null, 'SC');
                        resource = createFilteredResource(audioOut, q);
                        track.source = 'SoundCloud';
                        console.log('[MUSIC] ▸ yt-dlp SoundCloud for:', track.title);
                    }
                } catch (e) { console.log('[MUSIC] yt-dlp SC error:', e.message); }
            }

            // YouTube fallback — download full track to temp file, then play locally.
            // Immune to mid-stream connection resets (yt-dlp retries internally);
            // a 3-min song downloads in ~1-2s on this box.
            // ⚡ Prefetch hit — file already on disk, skip the download entirely
            if (!stream && !resource && track.tempFile && require('fs').existsSync(track.tempFile)) {
                resource = createFilteredResource(track.tempFile, q);
                console.log('[MUSIC] ⚡ Instant start from prefetch:', track.title);
            }

            if (!stream && !resource) {
                const safe = (track.query || track.title).replace(/"/g, '').replace(/'/g, '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
                const cookiesPath = require('path').join(__dirname, '../assets/cookies.txt');
                const cookiesFlag = require('fs').existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';
                // Attempt 2 appends "audio" — rescues titles that match age-restricted/odd first results
                for (const attemptQuery of [safe, `${safe} audio`]) {
                    try {
                        // ── Defense 1: pre-check search result duration ──
                        let ytDuration = 0;
                        try {
                            const { stdout: durOut } = await execAsync(`yt-dlp --no-playlist --cookies "${cookiesPath}" --print duration "ytsearch1:${attemptQuery}"`, { timeout: 15000 });
                            ytDuration = parseFloat(durOut.trim()) || 0;
                        } catch (e) {}
                        const isShortQuery = track.title.toLowerCase().includes('short') || track.title.toLowerCase().includes('clip') || track.title.toLowerCase().includes('tiktok');
                        if (ytDuration > 0 && ytDuration < 45 && !isShortQuery) {
                            console.log(`[MUSIC] ⚠️ Search result too short (${ytDuration}s) — skipping:`, attemptQuery);
                            continue;
                        }

                        const tmpBase = require('path').join(require('os').tmpdir(), `archon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
                        await execAsync(`yt-dlp --no-playlist --cookies "${cookiesPath}" -x --audio-format opus --audio-quality 128K -o "${tmpBase}.%(ext)s" "ytsearch1:${attemptQuery}"`, { timeout: 300000 });
                        const tmpFile = `${tmpBase}.opus`;
                        if (require('fs').existsSync(tmpFile) && require('fs').statSync(tmpFile).size > 10000) {
                            // ── Defense 2: real duration from the file (format + stream fallback) ──
                            let fileDur = 0;
                            try {
                                const { stdout: dur } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpFile}"`, { timeout: 8000 });
                                const d = parseFloat(dur.trim());
                                if (d > 0) fileDur = Math.round(d);
                            } catch (e) {}
                            // Fallback: try stream duration if format duration failed
                            if (fileDur === 0) {
                                try {
                                    const { stdout: dur2 } = await execAsync(`ffprobe -v error -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 "${tmpFile}"`, { timeout: 8000 });
                                    const d2 = parseFloat(dur2.trim());
                                    if (d2 > 0) fileDur = Math.round(d2);
                                } catch (e) {}
                            }
                            // ── Defense 3: truncation guard (works even when track.duration is 0) ──
                            const expectedDur = track.duration > 0 ? track.duration : (ytDuration > 0 ? ytDuration : 0);
                            const isTruncated = expectedDur > 60 && fileDur > 0 && fileDur < expectedDur * 0.7;
                            const isSuspiciouslyShort = fileDur > 0 && fileDur < 45 && !isShortQuery;
                            if (isTruncated || isSuspiciouslyShort) {
                                console.log(`[MUSIC] ⚠️ ${isTruncated ? 'Truncated' : 'Too short'} download (${fileDur}s of expected ~${expectedDur}s) — retrying:`, track.title);
                                try { require('fs').unlinkSync(tmpFile); } catch(e) {}
                                continue; // next attempt
                            }
                            if (fileDur > 0) track.duration = fileDur;
                            resource = createFilteredResource(tmpFile, q);
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
                resource = createFilteredResource(stream.stream, q);
            }
        }

        resource.volume?.setVolume(q.volume / 100);
        q.player.play(resource);

        // New track starting → panel relocates to the bottom of chat
        await updatePersistentPanel(q, { resend: true });
        startPanelUpdater(q);
        clearInactivityTimer(q);
        // ⚡ Pre-download the next track in the background while this one plays
        prefetchNext(q).catch(() => {});

    } catch (err) {
        console.error('[MUSIC] Error:', err.message);
        const errEmbed = new EmbedBuilder().setColor(ARCHON.red)
            .setAuthor({ name: '// CLASSIFIED // ARCHON MUSIC ENGINE //', iconURL: q._client?.user?.displayAvatarURL() })
            .setDescription(`😤 **That track glitched out** — flipping to the next one…`);
        if (q.persistentMsg) {
            await q.persistentMsg.delete().catch(() => {});
            q.persistentMsg = null; q.panelMsgId = null;
        }
        await q.textChannel?.send({ embeds: [errEmbed] }).catch(() => {});
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
    // Handle folder selection from autocomplete
    if (query.startsWith('__folder__')) {
        const folderName = query.replace('__folder__', '');
        try {
            const lib = require('../data/music-library.json');
            const tracks = lib.filter(t => t.folder === folderName);
            if (!tracks.length) return replyFn({ content: `${EMOJIS.folder} Folder **${folderName}** is empty.` });

            // Use existing handlePlay flow for first track to properly join voice
            const shuffled = [...tracks].sort(() => Math.random() - 0.5);
            const firstTrack = shuffled[0];
            const rest = shuffled.slice(1);

            // Queue the rest first so they're ready after first track loads
            await replyFn({ content: `${EMOJIS.folder} Loading **${tracks.length} tracks** from **${folderName}**… 🎶` });

            // Play first track through normal flow (handles voice join + player setup)
            await handlePlay(guildId, guild, voiceChannel, textChannel, firstTrack.query, requestedBy, client,
                () => {}, requestedById);

            // Then add the rest to the queue
            const q = getQueue(guildId);
            if (q) {
                for (const t of rest) {
                    q.tracks.push({ title: t.title, query: t.query, artist: t.artist || 'Unknown', source: 'SoundCloud', duration: t.duration || 0, thumbnail: null, requestedBy, requestedById: requestedById || null, url: null });
                }
            }
        } catch(e) {
            console.error('[MUSIC FOLDER]', e.message);
            replyFn({ content: `${EMOJIS.error} Could not load folder: ${e.message}` });
        }
        return;
    }
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
        await replyFn({ content: '🎧 The queue is packed — 50 tracks max! `/music skip` a few or `/music stop` to make room.' });
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
    const nameMd = trackLinkFor(track);
    const durMd = track.duration > 0 ? ` - \`${formatTime(track.duration)}\`` : '';

    const embed = new EmbedBuilder().setColor(isPlaying ? 0x1DB954 : ARCHON.cyan);
    if (isPlaying) {
        embed.setAuthor({ name: 'Added to the queue', iconURL: SPOTIFY_ICON })
            .setDescription(`${getPlatformEmoji(track)} Added **${nameMd}**${durMd} to the queue.\n> Position **#${q.tracks.length}** • Added by **${requestedBy}**`);
        if (track.thumbnail) embed.setThumbnail(track.thumbnail);
    } else {
        embed.setDescription(`🎵 **${query.substring(0,60)}**\n> On it — warming up the decks… 🎚️`);
    }

    const components = [];
    if (suggestions.length > 0) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`ms_suggest_${Date.now()}`)
            .setPlaceholder('🎵 Queue a suggested track...')
            .addOptions(suggestions.map(s => ({ label: s.title.substring(0,100), value: s.query.substring(0,100), emoji: '🎵' })));
        components.push(new ActionRowBuilder().addComponents(menu));
    }

    // Loading state is ephemeral — only caller sees it, disappears automatically
    const msgFlags = (!isPlaying && components.length === 0) ? { flags: 64 } : {};
    const msg = await replyFn({ embeds: [embed], components, ...msgFlags });

    if (suggestions.length > 0 && msg) {
        const collector = msg.createMessageComponentCollector({ time: 30000 });
        collector.on('collect', async (i) => {
            if (i.user.id !== (i.message.interaction?.user?.id || i.user.id)) return;
            await i.deferUpdate().catch(() => {});
            const qNow = getQueue(guildId);
            if (qNow) {
                const sel = i.values[0];
                qNow.tracks.push({ title: sel, query: sel, artist: 'Unknown', source: 'SoundCloud', duration: 0, thumbnail: null, requestedBy: i.user.username, requestedById: i.user.id, url: null });
                await i.followUp({ content: `${EMOJIS.check} Added **${sel.substring(0,50)}** to queue!`, flags: 64 }).catch(() => {});
            }
            collector.stop();
        });
        collector.on('end', () => { msg.edit?.({ components: [] }).catch(() => {}); });
    }

    if (!isPlaying) {
        try { await ensureConnection(q); await playNext(q); }
        catch(err) { destroyQueue(guildId); replyFn({ content: `${EMOJIS.error} ${err.message}`, embeds: [], components: [] }).catch(() => {}); }
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
        .addSubcommand(s => s.setName('filter').setDescription('🎚️ Audio filter — bassboost, nightcore, vaporwave, normalize, off')
            .addStringOption(o => o.setName('effect').setDescription('Choose audio effect').setRequired(true)
                .addChoices(
                    {name: '🔊 Bass Boost', value: 'bassboost'},
                    {name: '🐰 Nightcore', value: 'nightcore'},
                    {name: '🌴 Vaporwave', value: 'vaporwave'},
                    {name: '📊 Normalize (default)', value: 'normalize'},
                    {name: '❌ Off', value: 'off'}
                )))
        .addSubcommand(s => s.setName('library').setDescription('📚 Browse the curated music library — interactive browser')
            .addStringOption(o => o.setName('search').setDescription('🔍 Search inside the library (optional)').setRequired(false).setAutocomplete(true))),

    // PREFIX — .play <query>
    run: async (client, message, args, db, serverSettings, usedCommand) => {
        const query = args.join(' ');
        if (!query) return message.reply('❌ Provide a song name or use `/music library` to browse folders!').catch(() => {});
        const vc = message.member?.voice?.channel;
        if (!vc) return message.reply('🎤 Join a voice channel first — then I\'ll bring the music!').catch(() => {});
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
            const genreEmoji = { Afrobeat: '🌍', Mali: '🇲🇱', HipHop: '🎤', EDM: '⚡', Chinese: '🀄', FrenchRap: '🇫🇷', AfroTrap: '🌴', Arabic: '🌙' };

            if (focused.length === 0) {
                // ══ DEFAULT POPOUT — folders first, then recent history ══
                try {
                    const lib = require('../data/music-library.json');
                    // All unique folders
                    const folders = [...new Set(lib.map(t => t.folder).filter(Boolean))];
                    for (const folder of folders) {
                        const count = lib.filter(t => t.folder === folder).length;
                        push(`📂 ${folder} (${count} tracks)`, `__folder__${folder}`);
                    }
                    // Fill remaining slots with top songs
                    const remaining = 25 - results.length;
                    if (remaining > 0) {
                        for (const t of lib.slice(0, remaining)) {
                            push(`🎵 ${t.title}`, t.query);
                        }
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
            return interaction.reply({ content: '🎤 Join a voice channel first — then I\'ll bring the music!', flags: 64 });
        }

        const isLibrary = sub === 'library';
        await interaction.deferReply(isLibrary ? { flags: 1 << 6 } : {});

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
                    await execAsync(`ffmpeg -y -v error -i "${tempPath}" -vn -acodec libopus -b:a 128k -f opus "${opusPath}"`, { timeout: 60000 });
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
                        .setDescription(`${EMOJIS.error} No valid audio files! Supported: ${validExts.join(', ')}`)]
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
            return interaction.editReply({ content: '🦗 All quiet right now — kick something off with `/music play`!' });
        }

        // ── FILTER ── 🎚️
        if (sub === 'filter') {
            const effect = interaction.options.getString('effect');
            const qNow = getQueue(guildId);
            if (qNow) { qNow.audioFilter = effect === 'off' ? '' : effect; await updatePersistentPanel(qNow).catch(() => {}); }
            const names = {bassboost: '🔊 Bass Boost', nightcore: '🐰 Nightcore', vaporwave: '🌴 Vaporwave', normalize: '📊 Normalize', '': '❌ Off'};
            const embed = new EmbedBuilder().setColor(ARCHON.purple)
                .setDescription(`\`\`\`ansi\n\u001b[1;35m▸ FILTER\u001b[0m ${names[effect === 'off' ? '' : effect] || '❌ Off'}\n\`\`\``);
            return interaction.editReply({embeds: [embed]});
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
                await q.persistentMsg.delete().catch(() => {});
                q.persistentMsg = null; q.panelMsgId = null;
                const stoppedEmbed = new EmbedBuilder().setColor(ARCHON.red)
                    .setDescription('⏹️ **Music stopped** — the stage is yours whenever you\'re ready. `/music play` brings me back 🎧');
                await q.textChannel?.send({ embeds: [stoppedEmbed] }).catch(() => {});
            }
            destroyQueue(guildId);
            const embed = new EmbedBuilder().setColor(ARCHON.red)
                .setDescription('⏹️ **Music stopped** — the stage is yours whenever you\'re ready. `/music play` brings me back 🎧');
            return interaction.editReply({ embeds: [embed] });
        }

        // ── QUEUE ──
        if (sub === 'queue') {
            return interaction.editReply({ embeds: [buildQueueEmbed(q, client)] });
        }

        // ── NOW PLAYING ── (CV2 card, same style as the live panel)
        if (sub === 'nowplaying') {
            if (!q.currentTrack) return interaction.editReply({ content: '🦗 All quiet right now — kick something off with `/music play`!' });
            const reply = await interaction.editReply({
                components: [buildPanelContainer(q, client)],
                flags: MessageFlags.IsComponentsV2,
            });
            // Buttons on this reply stay live for 5 min; the main panel remains the persistent one
            try {
                const msg = await interaction.fetchReply();
                const col = msg.createMessageComponentCollector({ time: 300000 });
                col.on('collect', async (i) => {
                    if (!i.member?.voice?.channel) return i.reply({ content: '🎤 Hop into a voice channel first — I need a stage!', flags: 64 }).catch(() => {});
                    const qNow = getQueue(guildId);
                    if (!qNow) return i.reply({ content: '⏹️ The show already ended — `/music play` starts a new one!', flags: 64 }).catch(() => {});
                    await i.deferUpdate().catch(() => {});
                    if (i.customId === 'mc_pause') {
                        if (qNow.player.state.status === AudioPlayerStatus.Paused) { qNow.player.unpause(); qNow.totalPaused += Date.now() - (qNow.pausedAt || Date.now()); qNow.pausedAt = null; }
                        else { qNow.player.pause(); qNow.pausedAt = Date.now(); }
                    } else if (i.customId === 'mc_skip') { qNow.player.stop(); }
                    else if (i.customId === 'mc_stop') { destroyQueue(guildId); }
                    else if (i.customId === 'mc_loop') { qNow.loop = !qNow.loop; }
                    else if (i.customId === 'mc_autoplay') { qNow.autoplay = !qNow.autoplay; }
                    else if (i.customId === 'mc_voldown' || i.customId === 'mc_volup') {
                        qNow.volume = Math.max(0, Math.min(100, (qNow.volume ?? 80) + (i.customId === 'mc_volup' ? 10 : -10)));
                        try { qNow.player?.state?.resource?.volume?.setVolume(qNow.volume / 100); } catch(e) {}
                    } else if (i.customId === 'mc_queue') {
                        await i.followUp({ embeds: [buildQueueEmbed(qNow, client)], flags: 64 }).catch(() => {});
                    } else if (i.customId === 'mc_prev') {
                        if (qNow.trackHistory?.length) {
                            const prev = qNow.trackHistory.shift();
                            if (qNow.currentTrack) qNow.tracks.unshift({...qNow.currentTrack});
                            qNow.tracks.unshift(prev);
                            qNow.player.stop();
                        }
                    } else if (i.customId === 'mc_like' || i.customId === 'mc_dislike') {
                        await i.followUp({ content: '💡 Use the buttons on the main panel for taste controls — it keeps everything in sync!', flags: 64 }).catch(() => {});
                    }
                    await updatePersistentPanel(qNow).catch(() => {});
                });
            } catch(e) {}
            return;
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
                await updatePersistentPanel(q, { resend: true });
            }
            const embed = new EmbedBuilder().setColor(q.silentPanel ? ARCHON.gold : ARCHON.green)
                .setDescription(`\`\`\`ansi\n[1;${q.silentPanel?'33':'32'}m▸ SILENT PANEL ${q.silentPanel?'ENABLED 🔕':'DISABLED 🔔'}\u001b[0m\n\`\`\``);
            return interaction.editReply({ embeds: [embed] });
        }

        // ── LIBRARY ──
        if (sub === 'library') {
            let lib;
            try { lib = require('../data/music-library.json'); }
            catch(e) { return interaction.editReply({ content: '📚 Can\'t reach the music library right now — give it another shot in a moment.' }); }

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
                            return i.reply({ content: '🎤 Hop into a voice channel first — I need a stage!', flags: 64 }).catch(() => {});
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
                            return i.reply({ content: '🎤 Hop into a voice channel first — I need a stage!', flags: 64 }).catch(() => {});
                        }
                        const tracks = [...resolveTracks()];
                        if (!tracks.length) return i.reply({ content: '🤷 This one\'s empty — pick another folder!', flags: 64 }).catch(() => {});
                        // Fisher-Yates
                        for (let x = tracks.length - 1; x > 0; x--) {
                            const y = Math.floor(Math.random() * (x + 1));
                            [tracks[x], tracks[y]] = [tracks[y], tracks[x]];
                        }
                        const qNow = getQueue(interaction.guild.id);
                        const cap = Math.max(0, 50 - (qNow?.tracks.length || 0));
                        const batch = tracks.slice(0, cap);
                        if (!batch.length) return i.reply({ content: '🎧 Queue\'s full (50 max)! Skip or stop something to make room.', flags: 64 }).catch(() => {});
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

