/**
 * ARCHITECT CG-223 // NEURAL AUDIO ENGINE v3.0 PRO
 * Spotify search + yt-dlp pipe streaming
 * Hetzner-compatible: yt-dlp 2026.06.09+
 *
 * By: Moussa Fofana // Node BAMAKO_223
 */

'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType, SlashCommandBuilder
} = require('discord.js');
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState,
  StreamType, NoSubscriberBehavior, demuxProbe
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================================================
//  COLORS
// ============================================================================

const C = {
  GREEN:  0x00ff88,
  DARK:   0x0a0a0a,
  ACCENT: 0x00d4ff,
  WARN:   0xff6b35,
  RED:    0xe74c3c,
  GOLD:   0xf1c40f,
  SPOTIFY: 0x1DB954,
};

const CONFIG = {
  YTDLP_TIMEOUT:  60000,
  MAX_QUEUE:      100,
  HISTORY_SIZE:   50,
  IDLE_TIMEOUT:   300000,
  NP_UPDATE_MS:   10000,
  VOLUME_DEFAULT: 50,
  SEARCH_RESULTS: 10,
};

// ============================================================================
//  AUDIO STATE MANAGER (Per-Server Isolation)
// ============================================================================

const audioStates = new Map();
const searchCache = new Map(); // Short ID -> track data cache for select menus

function getState(guildId) {
  if (!audioStates.has(guildId)) {
    audioStates.set(guildId, {
      guildId, queue: [], current: null, player: null, connection: null,
      volume: CONFIG.VOLUME_DEFAULT, loop: 'off', paused: false,
      stageInstance: null, nowPlayingMsg: null, dashboardMsg: null,
      textChannel: null, requester: null, startTime: null,
      history: [], isStage: false, status: 'IDLE',
      sessionId: Math.random().toString(36).slice(2, 10).toUpperCase(),
      _updateInterval: null, _ytdlpProcess: null,
    });
  }
  return audioStates.get(guildId);
}

function destroyState(guildId) {
  const s = audioStates.get(guildId);
  if (!s) return;
  killYtDlp(s);
  if (s._updateInterval) { clearInterval(s._updateInterval); s._updateInterval = null; }
  if (s.connection) try { s.connection.destroy(); } catch {}
  if (s.player) try { s.player.stop(); } catch {}
  if (s.stageInstance) try { s.stageInstance.delete().catch(() => {}); } catch {}
  audioStates.delete(guildId);
}

function killYtDlp(s) {
  if (s._ytdlpProcess) {
    try { s._ytdlpProcess.kill('SIGTERM'); } catch {}
    setTimeout(() => {
      try { if (s._ytdlpProcess && !s._ytdlpProcess.killed) s._ytdlpProcess.kill('SIGKILL'); } catch {}
      s._ytdlpProcess = null;
    }, 2000);
  }
}

// ============================================================================
//  PLAYER FACTORY
// ============================================================================

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
    s.status = 'IDLE'; killYtDlp(s);
    if (s.loop === 'track' && s.current) {
      await playTrack(guildId, s.current);
    } else if (s.queue.length > 0) {
      await playNext(guildId);
    } else {
      s.current = null; updateNowPlaying(guildId);
      setTimeout(() => {
        const f = getState(guildId);
        if (f && f.status === 'IDLE' && f.queue.length === 0) destroyState(guildId);
      }, CONFIG.IDLE_TIMEOUT);
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

// ============================================================================
//  STAGE CHANNEL
// ============================================================================

async function setupStage(guildId, voiceChannel, topic) {
  const s = getState(guildId);
  if (voiceChannel.type !== ChannelType.GuildStageVoice) { s.isStage = false; return false; }
  s.isStage = true;
  try {
    const existing = voiceChannel.guild.stageInstances.cache.find(si => si.channelId === voiceChannel.id);
    if (existing) { s.stageInstance = existing; await existing.edit({ topic }); }
    else { s.stageInstance = await voiceChannel.createStageInstance({ topic, privacyLevel: 2, sendStartNotification: false }); }
    const me = voiceChannel.guild.members.me;
    if (me && me.voice) await me.voice.setSuppressed(false).catch(() => {});
    return true;
  } catch (err) { console.error(`[STAGE] ${guildId}: ${err.message}`); return false; }
}

async function updateStageTopic(guildId, topic) {
  const s = getState(guildId);
  if (s.stageInstance && s.stageInstance.edit) try { await s.stageInstance.edit({ topic }); } catch {}
}

// ============================================================================
//  SPOTIFY API CLIENT
// ============================================================================

let spotifyToken = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (spotifyToken && Date.now() < spotifyTokenExpiry - 60000) return spotifyToken;
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const data = await httpPost('accounts.spotify.com', '/api/token',
      'grant_type=client_credentials',
      { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' });
    if (data.access_token) {
      spotifyToken = data.access_token;
      spotifyTokenExpiry = Date.now() + (data.expires_in * 1000);
      return spotifyToken;
    }
  } catch (err) { console.error('[Spotify] Token error:', err.message); }
  return null;
}

async function searchSpotify(query, limit) {
  const token = await getSpotifyToken();
  if (!token) return null;
  try {
    const encoded = encodeURIComponent(query);
    const data = await httpGet('api.spotify.com', `/v1/search?q=${encoded}&type=track&limit=${limit}`,
      { 'Authorization': `Bearer ${token}` });
    return data.tracks && data.tracks.items ? data.tracks.items.map(t => ({
      title: t.name,
      artist: t.artists ? t.artists.map(a => a.name).join(', ') : 'Unknown',
      duration: t.duration_ms,
      thumbnail: t.album && t.album.images && t.album.images[0] ? t.album.images[0].url : null,
      url: t.external_urls && t.external_urls.spotify ? t.external_urls.spotify : `https://open.spotify.com/track/${t.id}`,
      id: t.id,
      source: 'spotify',
    })) : null;
  } catch (err) { console.error('[Spotify] Search error:', err.message); return null; }
}

// ============================================================================
//  HTTP HELPERS
// ============================================================================

const http = require('http');

function httpGet(host, path, headers, allowHttp) {
  return new Promise((resolve, reject) => {
    const client = allowHttp ? http : https;
    const req = client.request({ host, path, method: 'GET', headers, timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function httpPost(host, path, body, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host, path, method: 'POST', headers, timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

// ============================================================================
//  TRACK RESOLUTION
// ============================================================================

async function resolveTrack(query, requester) {
  const track = {
    id: Math.random().toString(36).slice(2, 12),
    title: 'Unknown Track', artist: 'Unknown Artist',
    duration: 0, url: null, source: 'unknown', thumbnail: null,
    requester: requester ? requester.tag : 'Unknown',
    requesterId: requester ? requester.id : '0',
    addedAt: Date.now(), searchQuery: null,
  };

  // 1. Direct Audio URL
  if (/^https?:\/\/.*\.(mp3|wav|ogg|flac|m4a|aac|webm|opus)(\?.*)?$/i.test(query)) {
    try {
      track.title = path.basename(new URL(query).pathname) || 'Direct Audio';
      track.artist = 'Direct Stream';
      track.url = query; track.source = 'direct'; track.duration = 0;
      track.searchQuery = query;
      return track;
    } catch {}
  }

  // 2. Local File
  if (fs.existsSync(query)) {
    track.title = path.basename(query);
    track.artist = 'Local File';
    track.url = query; track.source = 'local'; track.duration = 0;
    track.searchQuery = query;
    return track;
  }

  // 3. Radio Stream
  if (/^https?:\/\/.*:(\d+)/.test(query) || query.includes('.m3u') || query.includes('.pls')) {
    track.title = `Radio: ${query.split('/').pop() || query}`;
    track.artist = 'Live Stream';
    track.url = query; track.source = 'radio'; track.duration = Infinity;
    track.searchQuery = query;
    return track;
  }

  // 4. YouTube URL
  if (query.includes('youtube.com') || query.includes('youtu.be')) {
    track.title = 'YouTube Track';
    track.artist = 'YouTube';
    track.url = query; track.source = 'youtube';
    track.searchQuery = query;
    return track;
  }

  // 5. SoundCloud URL
  if (query.includes('soundcloud.com')) {
    track.title = 'SoundCloud Track';
    track.artist = 'SoundCloud';
    track.url = query; track.source = 'soundcloud';
    track.searchQuery = query;
    return track;
  }

  // 6. Spotify URL
  if (query.includes('spotify.com') || query.includes('open.spotify.com')) {
    const token = await getSpotifyToken();
    if (token) {
      try {
        const match = query.match(/track\/([a-zA-Z0-9]+)/);
        if (match) {
          const data = await httpGet('api.spotify.com', `/v1/tracks/${match[1]}`,
            { 'Authorization': `Bearer ${token}` });
          track.title = data.name || 'Spotify Track';
          track.artist = data.artists ? data.artists.map(a => a.name).join(', ') : 'Spotify';
          track.duration = data.duration_ms;
          track.thumbnail = data.album && data.album.images && data.album.images[0] ? data.album.images[0].url : null;
          track.url = data.external_urls && data.external_urls.spotify ? data.external_urls.spotify : query;
          track.source = 'spotify';
          track.searchQuery = track.title + ' ' + track.artist;
          return track;
        }
      } catch (err) { console.error('[Spotify] Track fetch error:', err.message); }
    }
    track.source = 'spotify';
    track.searchQuery = query;
    return track;
  }

  // 7. Generic HTTP URL
  if (/^https?:\/\//.test(query)) {
    track.title = `Stream: ${query.substring(0, 50)}`;
    track.artist = 'Web Stream';
    track.url = query; track.source = 'http'; track.duration = 0;
    track.searchQuery = query;
    return track;
  }

  // 8. Search Query (text) - Try Spotify API first for metadata
  const results = await searchSpotify(query, 1);
  if (results && results.length > 0) {
    const r = results[0];
    track.title = r.title;
    track.artist = r.artist;
    track.duration = r.duration;
    track.thumbnail = r.thumbnail;
    track.url = r.url;
    track.source = 'spotify';
    // Use scsearch: prefix for SoundCloud (works without cookies!)
    track.searchQuery = 'scsearch:' + r.title + ' ' + r.artist;
    return track;
  }

  // Fallback: SoundCloud search via yt-dlp (scsearch: works without cookies)
  track.title = query;
  track.artist = 'Search';
  track.source = 'soundcloud';
  track.searchQuery = 'scsearch:' + query;
  return track;
}

async function resolveSearchResults(query, limit) {
  // Try Spotify first
  const spotifyResults = await searchSpotify(query, limit || CONFIG.SEARCH_RESULTS);
  if (spotifyResults && spotifyResults.length > 0) {
    return spotifyResults.map((r, i) => ({
      title: r.title,
      artist: r.artist,
      duration: r.duration,
      thumbnail: r.thumbnail,
      url: r.url,
      source: 'soundcloud', // Will use scsearch: for streaming
      id: r.id,
      index: i + 1,
      label: (r.title + ' - ' + r.artist).substring(0, 100),
      description: (fmtTime(r.duration) + ' - Spotify').substring(0, 100),
      emoji: '\uD83C\uDFB5',
      searchQuery: 'scsearch:' + r.title + ' ' + r.artist,
    }));
  }

  // Fallback: SoundCloud search via yt-dlp scsearch: (no cookies needed!)
  try {
    const result = await spawnAsync('yt-dlp', ytDlpArgs([
      '--dump-json', '--no-playlist', '--flat-playlist',
      'scsearch' + (limit || CONFIG.SEARCH_RESULTS) + ':' + query,
    ]), CONFIG.YTDLP_TIMEOUT);
    const lines = result.stdout.split('\n').filter(l => l.trim());
    const tracks = [];
    for (const line of lines.slice(0, limit || CONFIG.SEARCH_RESULTS)) {
      try {
        const data = JSON.parse(line);
        const dur = (data.duration || 0) * 1000;
        tracks.push({
          title: data.title || 'Unknown',
          artist: data.uploader || 'SoundCloud',
          duration: dur,
          thumbnail: data.thumbnail || null,
          url: data.webpage_url || data.url,
          id: data.id,
          source: 'soundcloud',
          index: tracks.length + 1,
          label: (data.title || 'Unknown').substring(0, 100),
          description: (fmtTime(dur) + ' - ' + (data.uploader || 'SoundCloud')).substring(0, 100),
          emoji: '\u266A',
          searchQuery: 'scsearch:' + data.title,
        });
      } catch {}
    }
    if (tracks.length > 0) return tracks;
  } catch (err) { console.log('[SoundCloud] scsearch failed: ' + err.message); }

  // Last resort: Invidious YouTube proxy
  try {
    for (let i = 0; i < Math.min(3, INVIDIOUS_HOSTS.length); i++) {
      const host = getInvidiousHost();
      try {
        const data = await httpGet(host, '/api/v1/search?q=' + encodeURIComponent(query) + '&type=video', {}, true);
        if (Array.isArray(data) && data.length > 0) {
          return data.slice(0, limit || CONFIG.SEARCH_RESULTS).map((v, idx) => {
            const dur = (v.lengthSeconds || 0) * 1000;
            return {
              title: v.title || 'Unknown',
              artist: v.author || 'YouTube',
              duration: dur,
              thumbnail: v.videoThumbnails ? v.videoThumbnails[0].url : null,
              url: 'https://www.youtube.com/watch?v=' + v.videoId,
              id: v.videoId,
              source: 'youtube',
              index: idx + 1,
              label: (v.title || 'Unknown').substring(0, 100),
              description: (fmtTime(dur) + ' - ' + (v.author || 'YouTube')).substring(0, 100),
              emoji: '\u25B6\uFE0F',
              searchQuery: 'https://www.youtube.com/watch?v=' + v.videoId,
            };
          });
        }
      } catch (err) { console.log('[Invidious] ' + host + ' search failed: ' + err.message); }
    }
  } catch (err) {
    console.error('[Search] Invidious search error:', err.message);
  }
  return null;
}

// ============================================================================
//  STREAM ENGINE -- yt-dlp stdout pipe (The Core)
// ============================================================================

// ============================================================================
//  COOKIE-AWARE yt-dlp HELPER (optional cookies.txt for YouTube on Hetzner)
//  SoundCloud works WITHOUT cookies via scsearch: prefix
// ============================================================================

function getCookiesPath() {
  const p = path.join(__dirname, '..', 'data', 'cookies.txt');
  return fs.existsSync(p) ? p : null;
}

function ytDlpArgs(extra) {
  const args = ['--no-warnings', '--quiet'];
  const cookies = getCookiesPath();
  if (cookies) args.push('--cookies', cookies);
  return args.concat(extra);
}

// Invidious instances for Hetzner-safe YouTube search
const INVIDIOUS_HOSTS = [
  'vid.puffyan.us', 'y.com.sb', 'iv.nboeck.de', 'iv.datura.network',
  'yt.artemislena.eu', 'invidious.perennialte.ch', 'iv.nboeck.de',
];
let invidiousIndex = 0;

function getInvidiousHost() {
  const host = INVIDIOUS_HOSTS[invidiousIndex % INVIDIOUS_HOSTS.length];
  invidiousIndex++;
  return host;
}

async function invidiousSearch(query) {
  // Try multiple Invidious instances
  for (let i = 0; i < Math.min(3, INVIDIOUS_HOSTS.length); i++) {
    const host = getInvidiousHost();
    try {
      const data = await httpGet(host, '/api/v1/search?q=' + encodeURIComponent(query) + '&type=video', {}, true);
      if (Array.isArray(data) && data.length > 0 && data[0].videoId) {
        return 'https://www.youtube.com/watch?v=' + data[0].videoId;
      }
    } catch (err) { console.log('[Invidious] ' + host + ' failed: ' + err.message); }
  }
  return null;
}

async function resolveYouTubeUrl(query) {
  console.log('[DEBUG] resolveYouTubeUrl input: ' + query.substring(0, 80));
  // Direct URLs and yt-dlp native prefixes pass through unchanged
  if (query.startsWith('http') || query.startsWith('scsearch:')) {
    console.log('[DEBUG] resolveYouTubeUrl: passing through directly');
    return query;
  }

  // Use Invidious API for Hetzner-safe YouTube search
  const url = await invidiousSearch(query);
  if (url) return url;

  throw new Error('YouTube search unavailable. Try a direct audio URL.');
}

async function createStreamResource(track) {
  const query = track.searchQuery || track.url;
  console.log('[DEBUG] createStreamResource: source=' + track.source + ' query=' + query.substring(0, 60));
  if (!query) throw new Error('No query or URL for stream');

  // Resolve to direct URL if it's a search query
  let directUrl = query;
  if (!query.startsWith('http')) {
    directUrl = await resolveYouTubeUrl(query);
  }
  console.log('[STREAM] URL: ' + directUrl.substring(0, 80));

  // Stream with cookie-aware yt-dlp
  return new Promise((resolve, reject) => {
    const args = ytDlpArgs([
      '-o', '-',
      '-f', 'bestaudio',
      '--no-playlist',
      directUrl,
    ]);

    if (getCookiesPath()) console.log('[STREAM] Using cookies.txt');
    console.log('[STREAM] Spawning yt-dlp for: ' + (track.title ? track.title.substring(0, 40) : 'track'));

    const ytdlp = spawn('yt-dlp', args, { timeout: CONFIG.YTDLP_TIMEOUT });
    let stderr = '';

    ytdlp.on('error', (err) => reject(new Error('yt-dlp spawn failed: ' + err.message)));
    ytdlp.stderr.on('data', (d) => { stderr += d.toString(); });
    ytdlp.on('close', (code) => { if (code !== 0 && code !== null) console.log('[yt-dlp] exited ' + code + ': ' + stderr.substring(0, 200)); });

    setTimeout(() => {
      demuxProbe(ytdlp.stdout)
        .then(({ stream, type }) => {
          console.log('[STREAM] Format: ' + type);
          const resource = createAudioResource(stream, { inputType: type, inlineVolume: true });
          resource.volume.setVolume(CONFIG.VOLUME_DEFAULT / 100);
          resource._ytdlp = ytdlp;
          resolve(resource);
        })
        .catch((err) => { killProcess(ytdlp); reject(new Error('Stream probe failed: ' + err.message)); });
    }, 500);
  });
}

function spawnAsync(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { timeout: timeoutMs || 30000 });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', (code) => resolve({ stdout, stderr, code }));
    proc.on('error', (err) => reject(err));
  });
}

function killProcess(proc) {
  if (!proc) return;
  try { proc.kill('SIGTERM'); } catch {}
  setTimeout(() => { try { if (!proc.killed) proc.kill('SIGKILL'); } catch {} }, 2000);
}

// ============================================================================
//  PLAYBACK ENGINE
// ============================================================================

async function playTrack(guildId, track) {
  const s = getState(guildId);
  killYtDlp(s);

  try {
    // Local files
    if (track.source === 'local' && fs.existsSync(track.url)) {
      const { stream, type } = await demuxProbe(fs.createReadStream(track.url));
      const resource = createAudioResource(stream, { inputType: type, inlineVolume: true });
      resource.volume.setVolume(s.volume / 100);
      s.current = track;
      s.player.play(resource);
      if (s.isStage) await updateStageTopic(guildId, track.title + ' - ' + track.artist);
      s.history.push(track);
      if (s.history.length > CONFIG.HISTORY_SIZE) s.history.shift();
      return;
    }

    // Radio / direct HTTP streams
    if (track.source === 'radio' || track.source === 'direct' || track.source === 'http') {
      const resource = createAudioResource(track.url, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
      });
      resource.volume.setVolume(s.volume / 100);
      s.current = track;
      s.player.play(resource);
      if (s.isStage) await updateStageTopic(guildId, track.title + ' - ' + track.artist);
      s.history.push(track);
      if (s.history.length > CONFIG.HISTORY_SIZE) s.history.shift();
      return;
    }

    // Everything else: yt-dlp stream pipe
    const resource = await createStreamResource(track);
    s._ytdlpProcess = resource._ytdlp || null;
    resource.volume.setVolume(s.volume / 100);

    s.current = track;
    s.player.play(resource);
    if (s.isStage) await updateStageTopic(guildId, track.title + ' - ' + track.artist);
    s.history.push(track);
    if (s.history.length > CONFIG.HISTORY_SIZE) s.history.shift();

  } catch (err) {
    console.error('[PLAY ERR] ' + guildId + ': ' + err.message);
    if (s.textChannel) {
      s.textChannel.send({
        embeds: [new EmbedBuilder()
          .setColor(C.RED)
          .setDescription('Failed to play ' + track.title + '\n' + err.message)]
      }).catch(() => {});
    }
    s.current = null;
    if (s.queue.length > 0) playNext(guildId);
  }
}

async function playNext(guildId) {
  const s = getState(guildId);
  if (s.queue.length === 0) { s.current = null; updateNowPlaying(guildId); return; }
  await playTrack(guildId, s.queue.shift());
}

// ============================================================================
//  TIME FORMATTER
// ============================================================================

function fmtTime(ms) {
  if (!ms || ms === Infinity) return 'LIVE';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return h + ':' + (m % 60).toString().padStart(2, '0') + ':' + (s % 60).toString().padStart(2, '0');
  return m + ':' + (s % 60).toString().padStart(2, '0');
}

// ============================================================================
//  NOW PLAYING PANEL
// ============================================================================

function buildNPEmbed(guildId) {
  const s = getState(guildId);
  const track = s.current;

  if (!track) {
    return new EmbedBuilder()
      .setColor(C.DARK)
      .setTitle('Neural Audio Engine - IDLE')
      .setDescription('Queue a track to begin playback.\n\nTip: Use /music play query:song name or !play song name')
      .addFields(
        { name: 'Session', value: '`' + s.sessionId + '`', inline: true },
        { name: 'Volume', value: '`' + s.volume + '%`', inline: true },
        { name: 'Loop', value: s.loop === 'off' ? 'Off' : s.loop, inline: true },
      )
      .setFooter({ text: 'ARCHITECT CG-223 // Neural Audio v3.0 PRO' })
      .setTimestamp();
  }

  const elapsed = s.startTime ? Date.now() - s.startTime : 0;
  const dur = track.duration || 0;
  const pct = dur > 0 ? Math.min(100, (elapsed / dur) * 100) : 0;
  const filled = Math.floor((pct / 100) * 18);
  const bar = String.fromCharCode(9608).repeat(filled) + String.fromCharCode(9617).repeat(18 - filled);

  const sourceLabel = {
    spotify: '[SPOTIFY] ',
    youtube: '[YT] ',
    soundcloud: '[SC] ',
    direct: '[URL] ',
    local: '[FILE] ',
    radio: '[RADIO] ',
    http: '[HTTP] ',
  }[track.source] || '[MUSIC] ';

  return new EmbedBuilder()
    .setColor(track.source === 'spotify' ? C.SPOTIFY : C.GREEN)
    .setAuthor({ name: s.isStage ? 'LIVE STAGE BROADCAST' : 'NOW PLAYING', iconURL: track.thumbnail || undefined })
    .setTitle(sourceLabel + (track.title ? track.title.substring(0, 80) : 'Unknown'))
    .setURL(track.url || null)
    .setDescription('```\n' + bar + ' ' + pct.toFixed(0) + '%\n' + fmtTime(elapsed) + ' / ' + fmtTime(dur) + '\nSource: ' + track.source.toUpperCase() + ' | Engine: yt-dlp pipe\n```')
    .addFields(
      { name: 'Artist', value: track.artist ? track.artist.substring(0, 30) : 'Unknown', inline: true },
      { name: 'Requester', value: '<@' + track.requesterId + '>', inline: true },
      { name: 'Loop', value: s.loop === 'off' ? 'Off' : s.loop === 'track' ? 'Track' : 'Queue', inline: true },
      { name: 'Volume', value: '`' + s.volume + '%`', inline: true },
      { name: 'Queue', value: '`' + s.queue.length + ' tracks`', inline: true },
      { name: 'Session', value: '`' + s.sessionId + '`', inline: true },
    )
    .setThumbnail(track.thumbnail || null)
    .setFooter({ text: 'ARCHITECT CG-223 // ' + (s.isStage ? 'Stage' : 'Voice') + ' // BAMAKO_223' })
    .setTimestamp();
}

function buildNPButtons(guildId) {
  const s = getState(guildId);
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_prev_' + guildId).setEmoji('\u23EE\uFE0F').setStyle(ButtonStyle.Secondary).setDisabled(s.history.length < 2),
      new ButtonBuilder().setCustomId('music_pp_' + guildId).setEmoji(s.paused ? '\u25B6\uFE0F' : '\u23F8\uFE0F').setStyle(s.paused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_stop_' + guildId).setEmoji('\u23F9\uFE0F').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('music_next_' + guildId).setEmoji('\u23ED\uFE0F').setStyle(ButtonStyle.Secondary).setDisabled(s.queue.length === 0),
      new ButtonBuilder().setCustomId('music_loop_' + guildId).setEmoji(s.loop === 'off' ? '\uD83D\uDD01' : s.loop === 'track' ? '\uD83D\uDD02' : '\uD83D\uDD01').setStyle(s.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_vd_' + guildId).setEmoji('\uD83D\uDD09').setStyle(ButtonStyle.Secondary).setDisabled(s.volume <= 0),
      new ButtonBuilder().setCustomId('music_vu_' + guildId).setEmoji('\uD83D\uDD0A').setStyle(ButtonStyle.Secondary).setDisabled(s.volume >= 200),
      new ButtonBuilder().setCustomId('music_shuf_' + guildId).setEmoji('\uD83D\uDD00').setStyle(ButtonStyle.Secondary).setDisabled(s.queue.length < 2),
      new ButtonBuilder().setCustomId('music_q_' + guildId).setEmoji('\uD83D\uDCDC').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_dash_' + guildId).setEmoji('\uD83C\uDF9B\uFE0F').setLabel('Dashboard').setStyle(ButtonStyle.Success),
    ),
  ];
}

async function updateNowPlaying(guildId) {
  const s = getState(guildId);
  if (!s.nowPlayingMsg) return;
  try { await s.nowPlayingMsg.edit({ embeds: [buildNPEmbed(guildId)], components: buildNPButtons(guildId) }); } catch {}
}

// ============================================================================
//  DASHBOARD PANEL
// ============================================================================

function buildDashEmbed(guildId) {
  const s = getState(guildId);
  const track = s.current;
  return new EmbedBuilder()
    .setColor(C.ACCENT)
    .setTitle('Neural Audio Dashboard')
    .setDescription('Session `' + s.sessionId + '`\n' + (track ? 'Now: [' + track.title + '](' + track.url + ')' : '*Idle*'))
    .addFields(
      { name: 'Volume', value: '`' + s.volume + '%`', inline: true },
      { name: 'Loop', value: s.loop, inline: true },
      { name: 'Stage', value: s.isStage ? 'Active' : 'Off', inline: true },
      { name: 'Queue', value: String(s.queue.length), inline: true },
      { name: 'History', value: String(s.history.length), inline: true },
      { name: 'Uptime', value: s.startTime ? fmtTime(Date.now() - s.startTime) : '-', inline: true },
    )
    .setFooter({ text: 'ARCHITECT CG-223 // Dashboard v3.0' })
    .setTimestamp();
}

function buildDashComponents(guildId) {
  const s = getState(guildId);
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('music_dashboard_select').setPlaceholder('Dashboard Options')
        .addOptions(
          { label: 'Loop: Off', value: 'loop_off_' + guildId, emoji: '\u274C' },
          { label: 'Loop: Track', value: 'loop_track_' + guildId, emoji: '\uD83D\uDD02' },
          { label: 'Loop: Queue', value: 'loop_queue_' + guildId, emoji: '\uD83D\uDD01' },
          { label: 'Volume: 25%', value: 'vol_25_' + guildId, emoji: '\uD83D\uDD08' },
          { label: 'Volume: 50%', value: 'vol_50_' + guildId, emoji: '\uD83D\uDD09' },
          { label: 'Volume: 100%', value: 'vol_100_' + guildId, emoji: '\uD83D\uDD0A' },
          { label: 'Volume: 150%', value: 'vol_150_' + guildId, emoji: '\uD83D\uDD0A' },
          { label: 'Clear Queue', value: 'clear_' + guildId, emoji: '\uD83D\uDDD1\uFE0F' },
        ),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_np_' + guildId).setEmoji('\uD83C\uDFB5').setLabel('Now Playing').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_close_' + guildId).setEmoji('\u274C').setLabel('Close').setStyle(ButtonStyle.Danger),
    ),
  ];
}

async function sendNowPlaying(guildId, channel) {
  const s = getState(guildId);
  if (s.nowPlayingMsg) try { await s.nowPlayingMsg.delete(); } catch {}
  s.nowPlayingMsg = await channel.send({ embeds: [buildNPEmbed(guildId)], components: buildNPButtons(guildId) });
  if (!s._updateInterval) {
    s._updateInterval = setInterval(() => {
      const f = getState(guildId);
      if (f && f.status === 'PLAYING') updateNowPlaying(guildId);
    }, CONFIG.NP_UPDATE_MS);
  }
}

async function sendDashboard(guildId, channel) {
  const s = getState(guildId);
  if (s.dashboardMsg) try { await s.dashboardMsg.delete(); } catch {}
  s.dashboardMsg = await channel.send({ embeds: [buildDashEmbed(guildId)], components: buildDashComponents(guildId) });
}

// ============================================================================
//  SEARCH MENU UI
// ============================================================================

async function sendSearchMenu(channel, query, requester, guildId) {
  const loading = await channel.send({
    embeds: [new EmbedBuilder().setColor(C.ACCENT).setDescription('Searching Spotify for `' + query.substring(0, 60) + '`...')]
  });

  const results = await resolveSearchResults(query);
  if (!results || results.length === 0) {
    await loading.edit({
      embeds: [new EmbedBuilder().setColor(C.WARN).setDescription(
        'No results found for `' + query + '`\n\nTips:\n- Check your spelling\n- Try a different query\n- Add Spotify credentials for better search'
      )]
    });
    return null;
  }

  const embed = new EmbedBuilder()
    .setColor(C.SPOTIFY)
    .setTitle('Search Results: "' + query.substring(0, 50) + '"')
    .setDescription('Found ' + results.length + ' tracks. Select one to play:')
    .setFooter({ text: 'ARCHITECT CG-223 // Spotify Search' })
    .setTimestamp();

  // Store full track data in cache, use short 8-char IDs as select values
  const select = new StringSelectMenuBuilder()
    .setCustomId('music_search_' + guildId + '_' + Date.now())
    .setPlaceholder('Select a track to play...')
    .addOptions(results.map(r => {
      const cacheId = Math.random().toString(36).slice(2, 10);
      searchCache.set(cacheId, {
        title: r.title, artist: r.artist, duration: r.duration,
        thumbnail: r.thumbnail, url: r.url, source: r.source,
        searchQuery: r.searchQuery || (r.title + ' ' + r.artist),
        requester: requester.tag, requesterId: requester.id,
      });
      // Clean cache after 5 minutes
      setTimeout(() => searchCache.delete(cacheId), 300000);
      return {
        label: r.label.substring(0, 100),
        description: r.description.substring(0, 100),
        value: cacheId,  // Short 8-char ID, well under 100 char limit
        emoji: '\uD83C\uDFB5',
      };
    }));

  const row = new ActionRowBuilder().addComponents(select);

  await loading.edit({ embeds: [embed], components: [row] });
  return results;
}

// ============================================================================
//  COMPONENT HANDLERS
// ============================================================================

async function handleComponent(interaction, client) {
  const id = interaction.customId;
  if (!id.startsWith('music_')) return false;

  const gid = interaction.guild.id;
  const s = getState(gid);
  const parts = id.split('_');
  const action = parts[1];

  if (action === 'search') {
    return handleSearchSelection(interaction, gid);
  }

  await interaction.deferUpdate().catch(() => {});

  switch (action) {
    case 'pp': {
      if (s.paused) { s.player.unpause(); s.paused = false; }
      else { s.player.pause(); s.paused = true; }
      break;
    }
    case 'stop': {
      destroyState(gid);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(C.DARK).setDescription('Stopped.')],
        components: []
      }).catch(() => {});
      return true;
    }
    case 'next': { s.player.stop(); break; }
    case 'prev': {
      if (s.history.length >= 2) {
        s.queue.unshift(s.current);
        s.current = s.history[s.history.length - 2];
        s.history = s.history.slice(0, -2);
        await playTrack(gid, s.current);
      }
      break;
    }
    case 'loop': {
      const modes = ['off', 'track', 'queue'];
      s.loop = modes[(modes.indexOf(s.loop) + 1) % 3];
      break;
    }
    case 'vd':
    case 'vu': {
      s.volume = Math.max(0, Math.min(200, s.volume + (action === 'vu' ? 10 : -10)));
      if (s.player && s.player.state && s.player.state.resource && s.player.state.resource.volume) {
        s.player.state.resource.volume.setVolume(s.volume / 100);
      }
      break;
    }
    case 'shuf': {
      for (let i = s.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s.queue[i], s.queue[j]] = [s.queue[j], s.queue[i]];
      }
      break;
    }
    case 'q': { break; }
    case 'dash': { await sendDashboard(gid, interaction.channel); break; }
    case 'close': {
      await interaction.editReply({ embeds: [new EmbedBuilder().setDescription('Dashboard closed.')], components: [] }).catch(() => {});
      s.dashboardMsg = null;
      return true;
    }
    case 'np': { await sendNowPlaying(gid, interaction.channel); break; }
  }

  updateNowPlaying(gid);
  if (s.dashboardMsg) try {
    await s.dashboardMsg.edit({ embeds: [buildDashEmbed(gid)], components: buildDashComponents(gid) });
  } catch {}
  return true;
}

async function handleSearchSelection(interaction, guildId) {
  const s = getState(guildId);
  const cacheId = interaction.values[0];
  const trackData = searchCache.get(cacheId);
  if (!trackData) {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('Search expired. Please search again.')], ephemeral: true }).catch(() => {});
    return true;
  }
  searchCache.delete(cacheId); // One-time use

  await interaction.deferUpdate().catch(() => {});

  const track = {
    id: Math.random().toString(36).slice(2, 12),
    title: trackData.title,
    artist: trackData.artist,
    duration: trackData.duration || 0,
    url: trackData.url,
    source: trackData.source || 'spotify',
    thumbnail: trackData.thumbnail,
    requester: trackData.requester || 'Unknown',
    requesterId: trackData.requesterId || '0',
    addedAt: Date.now(),
    searchQuery: trackData.searchQuery || (trackData.title + ' ' + trackData.artist),
  };

  const vc = interaction.member.voice.channel;
  if (!vc) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('Join a voice channel first!')]
    }).catch(() => {});
    return true;
  }

  s.textChannel = interaction.channel;

  // Clean up broken connection and create fresh one
  if (s.connection) {
    try { s.connection.destroy(); } catch {}
    s.connection = null;
  }
  s.connection = joinVoiceChannel({
    channelId: vc.id, guildId: vc.guild.id,
    adapterCreator: vc.guild.voiceAdapterCreator,
    selfDeaf: false, selfMute: false
  });
  s.isStage = vc.type === ChannelType.GuildStageVoice;
  if (s.isStage) await setupStage(guildId, vc, track.title);
  const player = createPlayer(guildId);
  s.connection.subscribe(player);
  try { await entersState(s.connection, VoiceConnectionStatus.Ready, 60000); }
  catch {
    destroyState(guildId);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C.RED).setDescription('Voice connection timed out. Please try again.')] }).catch(() => {});
    return true;
  }

  if (s.current) {
    s.queue.push(track);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(C.SPOTIFY).setDescription(
        'Added to queue: [' + track.title + '](' + track.url + ')\n' + track.artist + ' | <@' + track.requesterId + '>'
      ).setThumbnail(track.thumbnail)]
    }).catch(() => {});
  } else {
    await playTrack(guildId, track);
    await sendNowPlaying(guildId, interaction.channel);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(C.GREEN).setDescription(
        'Now Playing: [' + track.title + '](' + track.url + ')\n' + track.artist + ' | <@' + track.requesterId + '>'
      ).setThumbnail(track.thumbnail)]
    }).catch(() => {});
  }

  return true;
}

async function handleSelectMenu(interaction, client) {
  if (interaction.customId !== 'music_dashboard_select') return false;

  const value = interaction.values[0];
  const parts = value.split('_');
  const action = parts[0];
  const gid = parts[parts.length - 1];
  const s = getState(gid);

  await interaction.deferUpdate().catch(() => {});

  switch (action) {
    case 'loop': { s.loop = parts[1]; break; }
    case 'vol': {
      s.volume = parseInt(parts[1]);
      if (s.player && s.player.state && s.player.state.resource && s.player.state.resource.volume) {
        s.player.state.resource.volume.setVolume(s.volume / 100);
      }
      break;
    }
    case 'clear': { s.queue = []; break; }
  }

  if (s.dashboardMsg) try {
    await s.dashboardMsg.edit({ embeds: [buildDashEmbed(gid)], components: buildDashComponents(gid) });
  } catch {}
  updateNowPlaying(gid);
  return true;
}

// ============================================================================
//  COMMAND DEFINITION
// ============================================================================

const slashData = new SlashCommandBuilder()
  .setName('music').setDescription('Neural Audio Engine v3.0 PRO - Music streaming')
  .addSubcommand(s => s.setName('play').setDescription('Play a track').addStringOption(o => o.setName('query').setDescription('Song name or URL').setRequired(true)))
  .addSubcommand(s => s.setName('search').setDescription('Search and select a track').addStringOption(o => o.setName('query').setDescription('What to search').setRequired(true)))
  .addSubcommand(s => s.setName('skip').setDescription('Skip current track'))
  .addSubcommand(s => s.setName('stop').setDescription('Stop and disconnect'))
  .addSubcommand(s => s.setName('pause').setDescription('Pause playback'))
  .addSubcommand(s => s.setName('resume').setDescription('Resume playback'))
  .addSubcommand(s => s.setName('queue').setDescription('Show queue'))
  .addSubcommand(s => s.setName('volume').setDescription('Set volume').addIntegerOption(o => o.setName('level').setDescription('0-200').setMinValue(0).setMaxValue(200).setRequired(true)))
  .addSubcommand(s => s.setName('loop').setDescription('Toggle loop mode'))
  .addSubcommand(s => s.setName('nowplaying').setDescription('Show now playing'))
  .addSubcommand(s => s.setName('disconnect').setDescription('Disconnect from voice'));

module.exports = {
  name: 'music',
  aliases: ['play', 'p', 'skip', 's', 'queue', 'q', 'stop', 'disconnect', 'dc',
    'volume', 'vol', 'loop', 'pause', 'resume', 'np', 'nowplaying', 'dashboard', 'stage', 'search'],
  category: 'MUSIC',
  description: 'Neural Audio Engine v3.0 PRO - Spotify search + yt-dlp pipe',
  data: slashData,

  handleComponent,
  handleSelectMenu,

  // ============================================================================
  //  PREFIX COMMAND ROUTER
  // ============================================================================

  run: async (client, message, args, db, usedCommand, settings, lang) => {
    let cmd, rest;
    if (usedCommand === 'music') { cmd = args[0] ? args[0].toLowerCase() : ''; rest = args.slice(1); }
    else { cmd = usedCommand ? usedCommand.toLowerCase() : ''; rest = args; }

    const gid = message.guild ? message.guild.id : null;
    if (!gid) return message.reply('Music commands work in servers only.');

    const member = message.member;
    const vc = member.voice.channel;
    const noVcNeeded = ['queue', 'q', 'nowplaying', 'np', 'dashboard', 'search'];

    if (!vc && !noVcNeeded.includes(cmd)) {
      return message.reply({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('Join a voice or Stage channel first!')] });
    }

    const s = getState(gid);
    s.textChannel = message.channel;
    const e = (color, desc) => new EmbedBuilder().setColor(color).setDescription(desc);

    switch (cmd) {
      case 'play':
      case 'p': {
        const query = rest.join(' ');
        if (!query) return message.reply({ embeds: [e(C.WARN,
          'Provide a song name, URL, or search query.\n\nExamples:\n!play never gonna give you up\n!play https://open.spotify.com/track/...\n!play https://soundcloud.com/...\n!play https://example.com/song.mp3'
        )] });

        const loading = await message.reply({ embeds: [e(C.ACCENT, 'Resolving: `' + query.substring(0, 60) + '`...')] });
        const track = await resolveTrack(query, message.author);

        // Clean up broken connection and create fresh one
        if (s.connection) {
          try { s.connection.destroy(); } catch {}
          s.connection = null;
        }
        s.connection = joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
        s.isStage = vc.type === ChannelType.GuildStageVoice;
        if (s.isStage) await setupStage(gid, vc, track.title);
        const player = createPlayer(gid);
        s.connection.subscribe(player);
        try { await entersState(s.connection, VoiceConnectionStatus.Ready, 60000); }
        catch {
          destroyState(gid);
          return loading.edit({ embeds: [e(C.RED, 'Voice connection timed out. Please try again.')] });
        }

        if (s.current) {
          s.queue.push(track);
          loading.edit({ embeds: [e(C.SPOTIFY, 'Added to queue: [' + track.title + '](' + track.url + ')\n' + track.artist + ' | ' + s.queue.length + ' in queue')] });
        } else {
          await playTrack(gid, track);
          loading.delete().catch(() => {});
          await sendNowPlaying(gid, message.channel);
        }
        break;
      }

      case 'search': {
        const query = rest.join(' ');
        if (!query) return message.reply({ embeds: [e(C.WARN, 'Provide a search query.\nExample: !search never gonna give you up')] });
        await sendSearchMenu(message.channel, query, message.author, gid);
        break;
      }

      case 'skip':
      case 's': {
        if (!s.current) return message.reply({ embeds: [e(C.WARN, 'Nothing playing!')] });
        s.player.stop();
        message.reply({ embeds: [e(C.GREEN, 'Skipped!')] });
        break;
      }

      case 'stop': {
        destroyState(gid);
        message.reply({ embeds: [e(C.DARK, 'Neural Audio Engine stopped.')] });
        break;
      }

      case 'pause': {
        if (!s.player) return message.reply({ embeds: [e(C.WARN, 'Nothing playing!')] });
        s.player.pause(); s.paused = true;
        message.reply({ embeds: [e(C.GOLD, 'Paused')] });
        break;
      }

      case 'resume': {
        if (!s.player) return message.reply({ embeds: [e(C.WARN, 'Nothing playing!')] });
        s.player.unpause(); s.paused = false;
        message.reply({ embeds: [e(C.GREEN, 'Resumed')] });
        break;
      }

      case 'queue':
      case 'q': {
        if (!s.current && s.queue.length === 0) return message.reply({ embeds: [e(C.WARN, 'Queue is empty!')] });
        const em = new EmbedBuilder().setColor(C.ACCENT).setTitle('Queue - ' + (s.queue.length + (s.current ? 1 : 0)) + ' tracks');
        if (s.current) em.addFields({ name: 'Now Playing', value: '[' + s.current.title + '](' + s.current.url + ') - ' + s.current.artist });
        const list = s.queue.slice(0, 15).map((t, i) => '`' + (i + 1) + '.` [' + t.title + '](' + t.url + ') - ' + t.artist).join('\n');
        if (list) em.addFields({ name: 'Up Next', value: list.substring(0, 1024) });
        if (s.queue.length > 15) em.addFields({ name: '...', value: '+' + (s.queue.length - 15) + ' more' });
        message.reply({ embeds: [em] });
        break;
      }

      case 'volume':
      case 'vol': {
        const vol = parseInt(rest[0]);
        if (isNaN(vol) || vol < 0 || vol > 200) return message.reply({ embeds: [e(C.WARN, 'Volume: 0-200')] });
        s.volume = vol;
        if (s.player && s.player.state && s.player.state.resource && s.player.state.resource.volume) {
          s.player.state.resource.volume.setVolume(vol / 100);
        }
        message.reply({ embeds: [e(C.GREEN, 'Volume: ' + vol + '%')] });
        updateNowPlaying(gid);
        break;
      }

      case 'loop': {
        const modes = ['off', 'track', 'queue'];
        s.loop = modes[(modes.indexOf(s.loop) + 1) % 3];
        message.reply({ embeds: [e(C.GREEN, 'Loop: ' + s.loop)] });
        updateNowPlaying(gid);
        break;
      }

      case 'nowplaying':
      case 'np': {
        if (!s.current) return message.reply({ embeds: [e(C.WARN, 'Nothing playing!')] });
        await sendNowPlaying(gid, message.channel);
        break;
      }

      case 'dashboard': {
        await sendDashboard(gid, message.channel);
        break;
      }

      case 'disconnect':
      case 'dc': {
        destroyState(gid);
        message.reply({ embeds: [e(C.GREEN, 'Disconnected.')] });
        break;
      }

      case 'stage': {
        if (!vc || vc.type !== ChannelType.GuildStageVoice)
          return message.reply({ embeds: [e(C.WARN, 'Join a Stage Channel first!')] });
        await setupStage(gid, vc, rest.join(' ') || 'Neural Audio Broadcast');
        message.reply({ embeds: [e(C.GREEN, 'Stage Broadcast activated!')] });
        break;
      }

      default: {
        message.reply({ embeds: [e(C.ACCENT,
          'Neural Audio Engine v3.0\n\n' +
          '!play <query> - Play a track\n' +
          '!search <query> - Search with selection menu\n' +
          '!skip - Skip current\n' +
          '!stop - Stop and clear\n' +
          '!pause / !resume - Playback control\n' +
          '!queue - Show queue\n' +
          '!volume <0-200> - Set volume\n' +
          '!loop - Toggle loop mode\n' +
          '!nowplaying - Show player\n' +
          '!dashboard - Control panel\n' +
          '!disconnect - Leave voice\n' +
          '!stage - Stage broadcast\n\n' +
          'Supports: Spotify, YouTube, SoundCloud, direct URLs, radio'
        )] });
      }
    }
  },

  // ============================================================================
  //  SLASH COMMAND HANDLER
  // ============================================================================

  execute: async (interaction, client) => {
    const action = interaction.options.getSubcommand();
    const gid = interaction.guild.id;
    const vc = interaction.member.voice.channel;
    const s = getState(gid);
    s.textChannel = interaction.channel;

    const noVc = ['queue', 'nowplaying'];
    if (!vc && !noVc.includes(action)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('Join a voice channel first!')], ephemeral: true });
    }

    await interaction.deferReply();
    const e = (color, desc) => new EmbedBuilder().setColor(color).setDescription(desc);

    switch (action) {
      case 'play': {
        const query = interaction.options.getString('query');
        if (!query) return interaction.editReply({ embeds: [e(C.WARN, 'Provide a query!')] });

        await interaction.editReply({ embeds: [e(C.ACCENT, 'Resolving: `' + query.substring(0, 60) + '`...')] });
        const track = await resolveTrack(query, interaction.user);

        // Clean up broken connection and create fresh one
        if (s.connection) {
          try { s.connection.destroy(); } catch {}
          s.connection = null;
        }
        s.connection = joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
        s.isStage = vc.type === ChannelType.GuildStageVoice;
        if (s.isStage) await setupStage(gid, vc, track.title);
        const player = createPlayer(gid);
        s.connection.subscribe(player);
        try { await entersState(s.connection, VoiceConnectionStatus.Ready, 60000); }
        catch {
          destroyState(gid);
          return interaction.editReply({ embeds: [e(C.RED, 'Voice connection timed out. Please try again.')] });
        }

        if (s.current) {
          s.queue.push(track);
          await interaction.editReply({ embeds: [e(C.SPOTIFY,
            'Added to queue: [' + track.title + '](' + track.url + ')\n' + track.artist + ' | ' + s.queue.length + ' in queue'
          ).setThumbnail(track.thumbnail)] });
        } else {
          await playTrack(gid, track);
          await sendNowPlaying(gid, interaction.channel);
          await interaction.editReply({ embeds: [e(C.GREEN,
            'Now Playing: [' + track.title + '](' + track.url + ')\n' + track.artist
          ).setThumbnail(track.thumbnail)] });
        }
        break;
      }

      case 'search': {
        const query = interaction.options.getString('query');
        if (!query) return interaction.editReply({ embeds: [e(C.WARN, 'Provide a search query!')] });
        await interaction.editReply({ embeds: [e(C.ACCENT, 'Searching for `' + query + '`...')] });
        const results = await sendSearchMenu(interaction.channel, query, interaction.user, gid);
        if (results) {
          await interaction.editReply({ embeds: [e(C.GREEN, 'Found ' + results.length + ' tracks! Select one from the menu below.')] });
        } else {
          await interaction.editReply({ embeds: [e(C.WARN, 'No results found for `' + query + '`')] });
        }
        break;
      }

      case 'skip': {
        if (!s.current) return interaction.editReply({ embeds: [e(C.WARN, 'Nothing playing!')] });
        s.player.stop();
        await interaction.editReply({ embeds: [e(C.GREEN, 'Skipped!')] });
        break;
      }

      case 'stop': {
        destroyState(gid);
        await interaction.editReply({ embeds: [e(C.DARK, 'Neural Audio Engine stopped.')] });
        break;
      }

      case 'pause': {
        s.player.pause(); s.paused = true;
        await interaction.editReply({ embeds: [e(C.GOLD, 'Paused')] });
        break;
      }

      case 'resume': {
        s.player.unpause(); s.paused = false;
        await interaction.editReply({ embeds: [e(C.GREEN, 'Resumed')] });
        break;
      }

      case 'queue': {
        if (!s.current) return interaction.editReply({ embeds: [e(C.WARN, 'Queue empty!')] });
        const em = new EmbedBuilder().setColor(C.ACCENT).setTitle('Queue')
          .setDescription(s.current ? 'Now: [' + s.current.title + '](' + s.current.url + ') - ' + s.current.artist + '\n' + s.queue.slice(0, 15).map((t, i) => '' + (i + 1) + '. [' + t.title + '](' + t.url + ')').join('\n') : 'Empty');
        await interaction.editReply({ embeds: [em] });
        break;
      }

      case 'volume': {
        const vol = interaction.options.getInteger('level');
        s.volume = vol;
        if (s.player && s.player.state && s.player.state.resource && s.player.state.resource.volume) {
          s.player.state.resource.volume.setVolume(s.volume / 100);
        }
        await interaction.editReply({ embeds: [e(C.GREEN, 'Volume: ' + vol + '%')] });
        updateNowPlaying(gid);
        break;
      }

      case 'loop': {
        const modes = ['off', 'track', 'queue'];
        s.loop = modes[(modes.indexOf(s.loop) + 1) % 3];
        await interaction.editReply({ embeds: [e(C.GREEN, 'Loop: ' + s.loop)] });
        updateNowPlaying(gid);
        break;
      }

      case 'nowplaying': {
        if (!s.current) return interaction.editReply({ embeds: [e(C.WARN, 'Nothing playing!')] });
        await sendNowPlaying(gid, interaction.channel);
        await interaction.editReply({ embeds: [e(C.GREEN, 'Now Playing updated!')] });
        break;
      }

      case 'disconnect': {
        destroyState(gid);
        await interaction.editReply({ embeds: [e(C.GREEN, 'Disconnected!')] });
        break;
      }
    }
  },
};

console.log('Neural Audio Engine v3.0 PRO loaded - Spotify + SoundCloud(scsearch) + yt-dlp pipe');
