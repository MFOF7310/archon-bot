/**
 *  ARCHITECT CG-223 // NEURAL AUDIO ENGINE v2.0
 *  Interactive music with Stage Channel support
 *  Hetzner-compatible: No YouTube dependency, multi-source audio
 *
 *  By: Moussa Fofana // Node BAMAKO_223
 */

'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType, PermissionsBitField
} = require('discord.js');
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState,
  StreamType, NoSubscriberBehavior
} = require('@discordjs/voice');
const playdl = require('play-dl');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  GREEN:  '#00ff88',
  DARK:   '#0a0a0a',
  ACCENT: '#00d4ff',
  WARN:   '#ff6b35',
  RED:    '#e74c3c',
  GOLD:   '#f1c40f',
};

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIO STATE MANAGER (Per-Server Isolation)
// ═══════════════════════════════════════════════════════════════════════════════

const audioStates = new Map();

function getState(guildId) {
  if (!audioStates.has(guildId)) {
    audioStates.set(guildId, {
      guildId, queue: [], current: null, player: null, connection: null,
      volume: 100, loop: 'off', paused: false, stageInstance: null,
      nowPlayingMsg: null, dashboardMsg: null, textChannel: null,
      requester: null, startTime: null, listeners: new Set(),
      history: [], isStage: false, autoplay: false, bassBoost: 0,
      nightcore: false, status: 'IDLE', lastActivity: Date.now(),
      sessionId: Math.random().toString(36).slice(2, 10).toUpperCase(),
    });
  }
  return audioStates.get(guildId);
}

function destroyState(guildId) {
  const s = audioStates.get(guildId);
  if (!s) return;
  if (s._updateInterval) { clearInterval(s._updateInterval); s._updateInterval = null; }
  if (s.connection) try { s.connection.destroy(); } catch {}
  if (s.player) try { s.player.stop(); } catch {}
  if (s.stageInstance) try { s.stageInstance.delete().catch(() => {}); } catch {}
  audioStates.delete(guildId);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PLAYER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

function createPlayer(guildId) {
  const s = getState(guildId);
  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play, maxMissedFrames: 50 }
  });

  player.on(AudioPlayerStatus.Playing, () => {
    s.status = 'PLAYING'; s.startTime = Date.now(); s.paused = false;
    updateNowPlaying(guildId);
  });

  player.on(AudioPlayerStatus.Paused, () => {
    s.status = 'PAUSED'; s.paused = true; updateNowPlaying(guildId);
  });

  player.on(AudioPlayerStatus.Idle, async () => {
    s.status = 'IDLE';
    if (s.loop === 'track' && s.current) {
      await playTrack(guildId, s.current);
    } else if (s.loop === 'queue' && s.queue.length === 0 && s.history.length > 0) {
      s.queue = [...s.history]; s.history = []; await playNext(guildId);
    } else if (s.queue.length > 0) {
      await playNext(guildId);
    } else {
      s.current = null; updateNowPlaying(guildId);
      setTimeout(() => {
        const f = getState(guildId);
        if (f.status === 'IDLE' && f.queue.length === 0) destroyState(guildId);
      }, 300000);
    }
  });

  player.on('error', (err) => {
    console.error(`[AUDIO ERR] ${guildId}: ${err.message}`);
    s.status = 'ERROR';
    if (s.queue.length > 0) playNext(guildId);
  });

  s.player = player;
  return player;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STAGE CHANNEL
// ═══════════════════════════════════════════════════════════════════════════════

async function setupStage(guildId, voiceChannel, topic = 'Neural Audio Broadcast') {
  const s = getState(guildId);
  if (voiceChannel.type !== ChannelType.GuildStageVoice) { s.isStage = false; return false; }
  s.isStage = true;
  try {
    const existing = voiceChannel.guild.stageInstances.cache.find(si => si.channelId === voiceChannel.id);
    if (existing) { s.stageInstance = existing; await existing.edit({ topic }); }
    else { s.stageInstance = await voiceChannel.createStageInstance({ topic, privacyLevel: 2, sendStartNotification: false }); }
    const me = voiceChannel.guild.members.me;
    if (me?.voice) await me.voice.setSuppressed(false).catch(() => {});
    return true;
  } catch (err) { console.error(`[STAGE] ${guildId}: ${err.message}`); return false; }
}

async function updateStageTopic(guildId, topic) {
  const s = getState(guildId);
  if (s.stageInstance?.edit) try { await s.stageInstance.edit({ topic }); } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TRACK RESOLUTION -- HETZNER SAFE (No YouTube dependency)
// ═══════════════════════════════════════════════════════════════════════════════

async function resolveTrack(query, requester) {
  const track = {
    id: Math.random().toString(36).slice(2, 12),
    title: 'Unknown Track', artist: 'Unknown Artist',
    duration: 0, url: null, source: 'unknown', thumbnail: null,
    requester: requester?.tag || 'Unknown', requesterId: requester?.id || '0',
    addedAt: Date.now(), streamUrl: null, stream: null,
  };

  // ── 1. Direct Audio URL (Most reliable) ──
  if (/^https?:\/\/.*\.(mp3|wav|ogg|flac|m4a|aac|webm|opus)(\?.*)?$/i.test(query)) {
    try {
      track.title = path.basename(new URL(query).pathname) || 'Direct Audio';
      track.artist = 'Direct Stream';
      track.url = query; track.streamUrl = query; track.source = 'direct';
      return track;
    } catch { /* malformed URL */ }
  }

  // ── 2. Local File (VPS-hosted) ──
  if (fs.existsSync(query)) {
    track.title = path.basename(query);
    track.artist = 'Local File';
    track.url = query; track.streamUrl = query; track.source = 'local';
    return track;
  }

  // ── 3. Radio Stream (ICECAST/SHOUTCAST) ──
  if (/^https?:\/\/.*\:(\d+)/.test(query) || query.includes('.m3u') || query.includes('.pls')) {
    track.title = `Radio Stream: ${query.split('/').pop() || query}`;
    track.artist = 'Live Stream';
    track.url = query; track.streamUrl = query; track.source = 'radio';
    track.duration = Infinity;
    return track;
  }

  // ── 4. SoundCloud ──
  if (query.includes('soundcloud.com')) {
    try {
      const info = await playdl.soundcloud(query);
      track.title = info.name;
      track.artist = info.user?.name || 'SoundCloud';
      track.duration = info.durationInMs;
      track.url = query;
      track.thumbnail = info.thumbnail;
      track.source = 'soundcloud';
      track.streamUrl = info.url;
      return track;
    } catch (err) { track.error = `SoundCloud: ${err.message}`; return track; }
  }

  // ── 5. Spotify (Metadata only) ──
  if (query.includes('spotify.com') || query.includes('open.spotify.com')) {
    try {
      if (playdl.isSpotify(query)) {
        const info = await playdl.spotify(query);
        track.title = info.name;
        track.artist = info.artists?.map(a => a.name).join(', ') || 'Spotify';
        track.duration = info.durationInMs;
        track.url = query; track.thumbnail = info.thumbnail;
        track.source = 'spotify';
        track.error = 'Spotify links provide metadata only. Add a direct audio URL for playback.';
      }
      return track;
    } catch (err) { track.error = `Spotify: ${err.message}`; return track; }
  }

  // ── 6. YouTube (Hetzner blocked -- try with cookie workaround) ──
  if (query.includes('youtube.com') || query.includes('youtu.be') || !query.startsWith('http')) {
    // Try cookie-based yt-dlp extraction
    const ytResult = await extractYouTubeWithCookies(query);
    if (ytResult) {
      track.title = ytResult.title;
      track.artist = ytResult.artist || 'YouTube';
      track.duration = ytResult.duration * 1000;
      track.url = ytResult.url;
      track.thumbnail = ytResult.thumbnail;
      track.source = 'youtube';
      track.streamUrl = ytResult.streamUrl;
      return track;
    }

    // Failed -- provide helpful error
    track.error = (
      query.startsWith('http') && (query.includes('youtube') || query.includes('youtu.be'))
        ? '**YouTube is blocked on Hetzner IPs.**\n\n**Solutions:**\n1. Use direct MP3/OGG URLs\n2. Use SoundCloud links\n3. Upload files to your VPS\n4. Set up a YouTube cookie (see docs)'
        : `**No playable source found for:** \`${query}\`\n\n**Supported sources:**\n• Direct MP3/OGG URLs\n• SoundCloud links\n• Spotify (metadata only)\n• Local file paths\n• Radio streams (.m3u, direct URL)\n• YouTube (with cookie setup)`
    );
    track.title = query.includes('youtube') || query.includes('youtu.be') ? 'YouTube (Blocked on Hetzner)' : query;
    return track;
  }

  // ── 7. Generic HTTP URL ──
  if (/^https?:\/\//.test(query)) {
    track.title = `HTTP Stream: ${query.substring(0, 50)}`;
    track.artist = 'Web Stream';
    track.url = query; track.streamUrl = query; track.source = 'http';
    return track;
  }

  track.error = `Unsupported query: \`${query}\``;
  return track;
}

// ─── YouTube Cookie Extraction (Bypasses Hetzner IP block) ───
// Requires: yt-dlp installed + cookies.txt from browser
async function extractYouTubeWithCookies(query) {
  try {
    // Check if yt-dlp is available and cookies exist
    const cookiesPath = path.join(__dirname, 'data', 'cookies.txt');
    if (!fs.existsSync(cookiesPath)) return null;

    return new Promise((resolve) => {
      const args = ['--cookies', cookiesPath, '-f', 'bestaudio', '--get-url', '--get-title', '--get-duration', '--get-thumbnail'];
      if (!query.startsWith('http')) args.unshift(`ytsearch1:${query}`);
      else args.push(query);

      const ytdlp = spawn('yt-dlp', args, { timeout: 30000 });
      let stdout = '';
      ytdlp.stdout.on('data', (d) => { stdout += d.toString(); });
      ytdlp.on('close', (code) => {
        if (code !== 0) return resolve(null);
        const lines = stdout.trim().split('\n').filter(Boolean);
        if (lines.length < 2) return resolve(null);
        // Output order: streamUrl, title, duration, thumbnail
        resolve({
          streamUrl: lines[0],
          title: lines[1] || 'YouTube Track',
          artist: 'YouTube',
          duration: parseInt(lines[2]) || 0,
          thumbnail: lines[3] || null,
          url: query.startsWith('http') ? query : `https://youtube.com/results?search_query=${encodeURIComponent(query)}`,
        });
      });
      ytdlp.on('error', () => resolve(null));
    });
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PLAYBACK ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

async function playTrack(guildId, track) {
  const s = getState(guildId);
  if (!track.streamUrl) {
    if (s.queue.length > 0) return playNext(guildId);
    return;
  }

  try {
    const resource = createAudioResource(track.streamUrl, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
    if (resource.volume) resource.volume.setVolume(s.volume / 100);

    s.current = track;
    s.player.play(resource);
    if (s.isStage) await updateStageTopic(guildId, `${track.title} -- ${track.artist}`);
    s.history.push(track);
    if (s.history.length > 50) s.history.shift();
  } catch (err) {
    console.error(`[PLAY ERR] ${guildId}: ${err.message}`);
    s.current = null;
    if (s.queue.length > 0) playNext(guildId);
  }
}

async function playNext(guildId) {
  const s = getState(guildId);
  if (s.queue.length === 0) { s.current = null; updateNowPlaying(guildId); return; }
  await playTrack(guildId, s.queue.shift());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UI -- NOW PLAYING PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function fmtTime(ms) {
  if (!ms || ms === Infinity) return 'LIVE';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function buildNPEmbed(guildId) {
  const s = getState(guildId);
  const track = s.current;

  if (!track) {
    return new EmbedBuilder()
      .setColor(C.DARK)
      .setTitle('Neural Audio Engine -- IDLE')
      .setDescription('Queue a track to begin playback.')
      .addFields(
        { name: 'Session', value: `\`\`${s.sessionId}\`\``, inline: true },
        { name: 'Volume', value: `\`\`${s.volume}%\`\``, inline: true },
        { name: 'Loop', value: s.loop === 'off' ? 'Off' : s.loop, inline: true },
      )
      .setFooter({ text: 'ARCHITECT CG-223 // Neural Audio v2.0' })
      .setTimestamp();
  }

  const elapsed = s.startTime ? Date.now() - s.startTime : 0;
  const dur = track.duration || 0;
  const pct = dur > 0 ? Math.min(100, (elapsed / dur) * 100) : 0;
  const filled = Math.floor((pct / 100) * 20);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(20 - filled);

  return new EmbedBuilder()
    .setColor(C.GREEN)
    .setAuthor({
      name: s.isStage ? 'LIVE STAGE BROADCAST' : 'NEURAL AUDIO ENGINE',
      iconURL: null,
    })
    .setTitle(track.title?.substring(0, 60) || 'Unknown')
    .setURL(track.url || null)
    .setDescription(`\`\`\`\n${bar} ${pct.toFixed(0)}%\n${fmtTime(elapsed)} / ${fmtTime(dur)}\nSource: ${track.source.toUpperCase()}\n\`\`\``)
    .addFields(
      { name: 'Artist', value: track.artist?.substring(0, 30) || 'Unknown', inline: true },
      { name: 'Requester', value: `<@${track.requesterId}>`, inline: true },
      { name: 'Loop', value: s.loop === 'off' ? 'Off' : s.loop === 'track' ? 'Track' : 'Queue', inline: true },
      { name: 'Volume', value: `\`\`${s.volume}%\`\``, inline: true },
      { name: 'Queue', value: `\`\`${s.queue.length} tracks\`\``, inline: true },
      { name: 'Session', value: `\`\`${s.sessionId}\`\``, inline: true },
    )
    .setThumbnail(track.thumbnail || null)
    .setFooter({ text: `ARCHITECT CG-223 // ${s.isStage ? 'Stage' : 'Voice'} // BAMAKO_223` })
    .setTimestamp();
}

function buildNPButtons(guildId) {
  const s = getState(guildId);
  const r1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ma_prev_${guildId}`).setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(s.history.length < 2),
    new ButtonBuilder().setCustomId(`ma_pp_${guildId}`).setEmoji(s.paused ? '\u25b6\ufe0f' : '\u23f8\ufe0f').setStyle(s.paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ma_stop_${guildId}`).setEmoji('\u23f9\ufe0f').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ma_next_${guildId}`).setEmoji('\u23ed\ufe0f').setStyle(ButtonStyle.Secondary).setDisabled(s.queue.length === 0),
    new ButtonBuilder().setCustomId(`ma_loop_${guildId}`).setEmoji(s.loop === 'off' ? '\ud83d\udd01' : s.loop === 'track' ? '\ud83d\udd02' : '\ud83d\udd01').setStyle(s.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success),
  );
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ma_vd_${guildId}`).setEmoji('\ud83d\udd09').setStyle(ButtonStyle.Secondary).setDisabled(s.volume <= 0),
    new ButtonBuilder().setCustomId(`ma_vu_${guildId}`).setEmoji('\ud83d\udd0a').setStyle(ButtonStyle.Secondary).setDisabled(s.volume >= 200),
    new ButtonBuilder().setCustomId(`ma_shuf_${guildId}`).setEmoji('\ud83d\udd00').setStyle(ButtonStyle.Secondary).setDisabled(s.queue.length < 2),
    new ButtonBuilder().setCustomId(`ma_q_${guildId}`).setEmoji('\ud83d\udcdc').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ma_dash_${guildId}`).setEmoji('\ud83c\udf9b\ufe0f').setLabel('Dashboard').setStyle(ButtonStyle.Success),
  );
  return [r1, r2];
}

async function updateNowPlaying(guildId) {
  const s = getState(guildId);
  if (!s.nowPlayingMsg) return;
  try {
    await s.nowPlayingMsg.edit({ embeds: [buildNPEmbed(guildId)], components: buildNPButtons(guildId) });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UI -- DASHBOARD PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function buildDashEmbed(guildId) {
  const s = getState(guildId);
  return new EmbedBuilder()
    .setColor(C.ACCENT)
    .setTitle('Neural Audio Dashboard')
    .setDescription(`Session \`\`${s.sessionId}\`\``)
    .addFields(
      { name: 'Volume', value: `\`\`${s.volume}%\`\``, inline: true },
      { name: 'Loop', value: s.loop, inline: true },
      { name: 'Stage', value: s.isStage ? 'Active' : 'Off', inline: true },
      { name: 'Queue', value: String(s.queue.length), inline: true },
      { name: 'History', value: String(s.history.length), inline: true },
      { name: 'Bass Boost', value: `+${s.bassBoost}dB`, inline: true },
      { name: 'Nightcore', value: s.nightcore ? 'On' : 'Off', inline: true },
      { name: 'Autoplay', value: s.autoplay ? 'On' : 'Off', inline: true },
    )
    .setFooter({ text: 'ARCHITECT CG-223 // Dashboard v2.0' })
    .setTimestamp();
}

function buildDashComponents(guildId) {
  const s = getState(guildId);
  const r1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`ma_ls_${guildId}`).setPlaceholder('Loop Mode')
      .addOptions(
        { label: 'Off', value: 'off', emoji: '\u274c' },
        { label: 'Track', value: 'track', emoji: '\ud83d\udd02' },
        { label: 'Queue', value: 'queue', emoji: '\ud83d\udd01' },
      ),
    new StringSelectMenuBuilder().setCustomId(`ma_vs_${guildId}`).setPlaceholder('Volume')
      .addOptions([10, 25, 50, 75, 100, 125, 150, 200].map(v => ({
        label: `${v}%`, value: String(v), emoji: v <= 50 ? '\ud83d\udd09' : v <= 100 ? '\ud83d\udd0a' : '\ud83d\udce2',
        default: s.volume === v,
      }))),
  );
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ma_bu_${guildId}`).setEmoji('\ud83d\udcc8').setLabel('Bass +').setStyle(ButtonStyle.Secondary).setDisabled(s.bassBoost >= 20),
    new ButtonBuilder().setCustomId(`ma_bd_${guildId}`).setEmoji('\ud83d\udcc9').setLabel('Bass -').setStyle(ButtonStyle.Secondary).setDisabled(s.bassBoost <= 0),
    new ButtonBuilder().setCustomId(`ma_nc_${guildId}`).setEmoji('\ud83c\udf19').setLabel('Nightcore').setStyle(s.nightcore ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ma_ap_${guildId}`).setEmoji('\ud83e\udd16').setLabel('Autoplay').setStyle(s.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ma_cl_${guildId}`).setEmoji('\ud83d\uddd1\ufe0f').setLabel('Clear').setStyle(ButtonStyle.Danger).setDisabled(s.queue.length === 0),
  );
  const r3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ma_np2_${guildId}`).setEmoji('\ud83c\udfb5').setLabel('Now Playing').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ma_close_${guildId}`).setEmoji('\u274c').setLabel('Close').setStyle(ButtonStyle.Danger),
  );
  return [r1, r2, r3];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UI SENDERS
// ═══════════════════════════════════════════════════════════════════════════════

async function sendNowPlaying(guildId, channel) {
  const s = getState(guildId);
  if (s.nowPlayingMsg) try { await s.nowPlayingMsg.delete(); } catch {}
  s.nowPlayingMsg = await channel.send({ embeds: [buildNPEmbed(guildId)], components: buildNPButtons(guildId) });
  if (!s._updateInterval) {
    s._updateInterval = setInterval(() => {
      const f = getState(guildId);
      if (f.status === 'PLAYING') updateNowPlaying(guildId);
    }, 10000);
  }
}

async function sendDashboard(guildId, channel) {
  const s = getState(guildId);
  if (s.dashboardMsg) try { await s.dashboardMsg.delete(); } catch {}
  s.dashboardMsg = await channel.send({ embeds: [buildDashEmbed(guildId)], components: buildDashComponents(guildId) });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMMAND DEFINITION
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  name: 'music',
  aliases: ['play', 'p', 'skip', 's', 'queue', 'q', 'stop', 'disconnect', 'dc',
    'volume', 'vol', 'loop', 'pause', 'resume', 'np', 'nowplaying', 'dashboard', 'stage'],
  category: 'MUSIC',
  description: 'Neural Audio Engine -- Multi-source music with Stage Channels',

  // ─── Slash Command Data ───
  data: new (require('discord.js').SlashCommandBuilder)()
    .setName('music')
    .setDescription('Neural Audio Engine -- Music control')
    .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true)
      .addChoices({ name: 'play', value: 'play' }, { name: 'skip', value: 'skip' },
        { name: 'stop', value: 'stop' }, { name: 'pause', value: 'pause' },
        { name: 'resume', value: 'resume' }, { name: 'queue', value: 'queue' },
        { name: 'volume', value: 'volume' }, { name: 'loop', value: 'loop' },
        { name: 'nowplaying', value: 'nowplaying' }, { name: 'dashboard', value: 'dashboard' },
        { name: 'disconnect', value: 'disconnect' }))
    .addStringOption(o => o.setName('query').setDescription('URL or query (for play)').setRequired(false))
    .addIntegerOption(o => o.setName('value').setDescription('Volume 0-200').setRequired(false).setMinValue(0).setMaxValue(200)),

  // ─── Prefix Command Router ───
  run: async (client, message, args, db, usedCommand, settings, lang = 'en') => {
    let cmd, rest;
    if (usedCommand === 'music') { cmd = args[0]?.toLowerCase(); rest = args.slice(1); }
    else { cmd = usedCommand?.toLowerCase(); rest = args; }

    const gid = message.guild?.id;
    if (!gid) return message.reply('Music commands work in servers only.');

    const member = message.member;
    const vc = member.voice.channel;
    const noVcNeeded = ['queue', 'q', 'nowplaying', 'np', 'dashboard'];

    if (!vc && !noVcNeeded.includes(cmd)) {
      return message.reply({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('Join a voice or Stage channel first!')] });
    }

    const s = getState(gid);
    s.textChannel = message.channel;

    const embed = (color, desc) => new EmbedBuilder().setColor(color).setDescription(desc);

    switch (cmd) {
      // ── PLAY ──
      case 'play':
      case 'p': {
        const query = rest.join(' ');
        if (!query) {
          return message.reply({ embeds: [embed(C.WARN,
            '**Provide a song URL or search query.**\n\n**Supported sources:**\n' +
            '\u2022 Direct MP3/OGG URLs (most reliable)\n' +
            '\u2022 SoundCloud links\n' +
            '\u2022 Radio streams (.m3u, direct URL)\n' +
            '\u2022 Local file paths on your VPS\n' +
            '\u2022 YouTube (with cookie setup -- see docs)'
          )] });
        }

        const loading = await message.reply({ embeds: [embed(C.ACCENT, `Searching: \`${query.substring(0, 60)}\`...`)] });
        const track = await resolveTrack(query, message.author);

        if (track.error) {
          return loading.edit({ embeds: [embed(C.WARN, track.error)] });
        }

        // Establish connection
        if (!s.connection) {
          s.connection = joinVoiceChannel({
            channelId: vc.id, guildId: vc.guild.id,
            adapterCreator: vc.guild.voiceAdapterCreator,
            selfDeaf: false, selfMute: false,
          });
          s.isStage = vc.type === ChannelType.GuildStageVoice;
          if (s.isStage) await setupStage(gid, vc, track.title);
          const player = createPlayer(gid);
          s.connection.subscribe(player);
          try { await entersState(s.connection, VoiceConnectionStatus.Ready, 30000); }
          catch { return loading.edit({ embeds: [embed(C.RED, 'Failed to connect to voice channel.')] }); }
        }

        if (s.current) {
          s.queue.push(track);
          loading.edit({ embeds: [embed(C.GREEN, `Added to queue: **${track.title}**`)] });
        } else {
          await playTrack(gid, track);
          loading.delete().catch(() => {});
          await sendNowPlaying(gid, message.channel);
        }
        break;
      }

      case 'skip':
      case 's': { if (!s.current) return message.reply({ embeds: [embed(C.WARN, 'Nothing playing!')] }); s.player?.stop(); message.reply({ embeds: [embed(C.GREEN, 'Skipped!')] }); break; }

      case 'stop': { destroyState(gid); message.reply({ embeds: [embed(C.GREEN, 'Neural Audio Engine stopped.')] }); break; }

      case 'pause': { if (!s.player) return message.reply({ embeds: [embed(C.WARN, 'Nothing playing!')] }); s.player.pause(); s.paused = true; message.reply({ embeds: [embed(C.GOLD, 'Paused')] }); break; }

      case 'resume': { if (!s.player) return message.reply({ embeds: [embed(C.WARN, 'Nothing playing!')] }); s.player.unpause(); s.paused = false; message.reply({ embeds: [embed(C.GREEN, 'Resumed')] }); break; }

      case 'queue':
      case 'q': {
        if (!s.current && s.queue.length === 0) return message.reply({ embeds: [embed(C.WARN, 'Queue is empty!')] });
        const e = new EmbedBuilder().setColor(C.ACCENT).setTitle(`Queue -- ${s.queue.length + (s.current ? 1 : 0)} tracks`);
        if (s.current) e.addFields({ name: 'Now Playing', value: `[${s.current.title}](${s.current.url})` });
        const list = s.queue.slice(0, 15).map((t, i) => `\`${i + 1}.\` ${t.title}`).join('\n');
        if (list) e.addFields({ name: 'Up Next', value: list });
        if (s.queue.length > 15) e.addFields({ name: 'Total', value: `${s.queue.length} tracks` });
        message.reply({ embeds: [e] });
        break;
      }

      case 'volume':
      case 'vol': {
        const vol = parseInt(rest[0]);
        if (isNaN(vol) || vol < 0 || vol > 200) return message.reply({ embeds: [embed(C.WARN, 'Volume: 0-200')] });
        s.volume = vol;
        if (s.player?.state?.resource?.volume) s.player.state.resource.volume.setVolume(vol / 100);
        message.reply({ embeds: [embed(C.GREEN, `Volume: ${vol}%`)] });
        updateNowPlaying(gid);
        break;
      }

      case 'loop': { const modes = ['off', 'track', 'queue']; s.loop = modes[(modes.indexOf(s.loop) + 1) % 3]; message.reply({ embeds: [embed(C.GREEN, `Loop: ${s.loop}`)] }); updateNowPlaying(gid); break; }

      case 'nowplaying':
      case 'np': { if (!s.current) return message.reply({ embeds: [embed(C.WARN, 'Nothing playing!')] }); await sendNowPlaying(gid, message.channel); break; }

      case 'dashboard': { await sendDashboard(gid, message.channel); break; }

      case 'disconnect':
      case 'dc': { destroyState(gid); message.reply({ embeds: [embed(C.GREEN, 'Disconnected.')] }); break; }

      case 'stage': {
        if (!vc || vc.type !== ChannelType.GuildStageVoice) return message.reply({ embeds: [embed(C.WARN, 'Join a Stage Channel first!')] });
        await setupStage(gid, vc, rest.join(' ') || 'Neural Audio Broadcast');
        message.reply({ embeds: [embed(C.GREEN, 'Stage Broadcast activated!')] });
        break;
      }

      default: { message.reply({ embeds: [embed(C.ACCENT, '**Commands:** `play`, `skip`, `stop`, `pause`, `resume`, `queue`, `volume`, `loop`, `nowplaying`, `dashboard`, `disconnect`, `stage`')] }] }); }
    }
  },

  // ─── Slash Command Handler ───
  execute: async (interaction, client) => {
    const action = interaction.options.getString('action');
    const query  = interaction.options.getString('query');
    const value  = interaction.options.getInteger('value');
    const gid    = interaction.guild.id;
    const vc     = interaction.member.voice.channel;
    const s      = getState(gid);
    s.textChannel = interaction.channel;

    const noVc = ['queue', 'nowplaying', 'dashboard'];
    if (!vc && !noVc.includes(action)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('Join a voice channel first!')], ephemeral: true });
    }

    await interaction.deferReply();
    const e = (color, desc) => new EmbedBuilder().setColor(color).setDescription(desc);

    switch (action) {
      case 'play': {
        if (!query) return interaction.editReply({ embeds: [e(C.WARN, 'Provide a query using the `query` option.')] });
        const track = await resolveTrack(query, interaction.user);
        if (track.error) return interaction.editReply({ embeds: [e(C.WARN, track.error)] });

        if (!s.connection) {
          s.connection = joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
          s.isStage = vc.type === ChannelType.GuildStageVoice;
          if (s.isStage) await setupStage(gid, vc, track.title);
          const player = createPlayer(gid);
          s.connection.subscribe(player);
          try { await entersState(s.connection, VoiceConnectionStatus.Ready, 30000); } catch { return interaction.editReply('Connection failed.'); }
        }

        if (s.current) { s.queue.push(track); await interaction.editReply({ embeds: [e(C.GREEN, `Queued: **${track.title}**`)] }); }
        else { await playTrack(gid, track); await sendNowPlaying(gid, interaction.channel); await interaction.editReply('Playing!'); }
        break;
      }
      case 'skip': { if (!s.current) return interaction.editReply('Nothing playing!'); s.player?.stop(); await interaction.editReply('Skipped!'); break; }
      case 'stop': { destroyState(gid); await interaction.editReply('Stopped!'); break; }
      case 'pause': { s.player?.pause(); s.paused = true; await interaction.editReply('Paused'); break; }
      case 'resume': { s.player?.unpause(); s.paused = false; await interaction.editReply('Resumed'); break; }
      case 'queue': {
        if (!s.current) return interaction.editReply('Queue empty!');
        const em = new EmbedBuilder().setColor(C.ACCENT).setTitle('Queue')
          .setDescription(s.current ? `Now: ${s.current.title}\n` + s.queue.slice(0, 15).map((t, i) => `${i + 1}. ${t.title}`).join('\n') : 'Empty');
        await interaction.editReply({ embeds: [em] });
        break;
      }
      case 'volume': { s.volume = Math.max(0, Math.min(200, value ?? 100)); if (s.player?.state?.resource?.volume) s.player.state.resource.volume.setVolume(s.volume / 100); await interaction.editReply(`Volume: ${s.volume}%`); updateNowPlaying(gid); break; }
      case 'loop': { const modes = ['off', 'track', 'queue']; s.loop = modes[(modes.indexOf(s.loop) + 1) % 3]; await interaction.editReply(`Loop: ${s.loop}`); updateNowPlaying(gid); break; }
      case 'nowplaying': { if (!s.current) return interaction.editReply('Nothing playing!'); await sendNowPlaying(gid, interaction.channel); await interaction.editReply('Now Playing panel updated!'); break; }
      case 'dashboard': { await sendDashboard(gid, interaction.channel); await interaction.editReply('Dashboard opened!'); break; }
      case 'disconnect': { destroyState(gid); await interaction.editReply('Disconnected!'); break; }
    }
  },

  // ─── Component Handler ───
  handleComponent: async (interaction, client) => {
    const id = interaction.customId;
    if (!id.startsWith('ma_')) return false;
    const gid = interaction.guild.id;
    const s = getState(gid);
    const parts = id.split('_');
    const action = parts[1];

    await interaction.deferUpdate().catch(() => {});

    switch (action) {
      case 'pp': { s.paused ? s.player?.unpause() : s.player?.pause(); s.paused = !s.paused; break; }
      case 'stop': { destroyState(gid); await interaction.editReply({ embeds: [new EmbedBuilder().setDescription('Stopped.').setColor(C.DARK)], components: [] }).catch(() => {}); return true; }
      case 'next': { s.player?.stop(); break; }
      case 'prev': { if (s.history.length >= 2) { s.queue.unshift(s.current); s.current = s.history[s.history.length - 2]; s.history = s.history.slice(0, -2); await playTrack(gid, s.current); } break; }
      case 'loop': { if (parts[2] === 'select') { const m = interaction.values[0]; if (m) s.loop = m; } else { const modes = ['off', 'track', 'queue']; s.loop = modes[(modes.indexOf(s.loop) + 1) % 3]; } break; }
      case 'vd': case 'vu': { s.volume = Math.max(0, Math.min(200, s.volume + (action === 'vu' ? 10 : -10))); if (s.player?.state?.resource?.volume) s.player.state.resource.volume.setVolume(s.volume / 100); break; }
      case 'vol': { if (parts[2] === 'select') { const v = parseInt(interaction.values[0]); if (!isNaN(v)) s.volume = v; } break; }
      case 'shuf': { for (let i = s.queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s.queue[i], s.queue[j]] = [s.queue[j], s.queue[i]]; } break; }
      case 'q': case 'np2': { break; }
      case 'dash': { await sendDashboard(gid, interaction.channel); break; }
      case 'bu': case 'bd': { s.bassBoost = Math.max(0, Math.min(20, s.bassBoost + (action === 'bu' ? 2 : -2))); break; }
      case 'nc': { s.nightcore = !s.nightcore; break; }
      case 'ap': { s.autoplay = !s.autoplay; break; }
      case 'cl': { s.queue = []; break; }
      case 'close': { await interaction.editReply({ embeds: [new EmbedBuilder().setDescription('Dashboard closed.')], components: [] }).catch(() => {}); s.dashboardMsg = null; return true; }
    }

    updateNowPlaying(gid);
    if (s.dashboardMsg) try { await s.dashboardMsg.edit({ embeds: [buildDashEmbed(gid)], components: buildDashComponents(gid) }); } catch {}
    return true;
  },

  // ─── Cleanup on guild leave ───
  onGuildDelete: (gid) => destroyState(gid),
};

console.log(`${C.GREEN}[MUSIC]${'\x1b[0m'} Neural Audio Engine v2.0 loaded -- Hetzner-safe multi-source`);