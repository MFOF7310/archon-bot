/**
 * ARCHITECT CG-223 // NATIVE AUDIO ENGINE v5.1
 * Pure @discordjs/voice + play-dl — No Lavalink, No Shoukaku
 * FlaviBot-style: Autocomplete, Now Playing, Vote Guard, Dashboard
 * + YouTube IP Block Bypass (Hetzner/OVH/Contabo compatible)
 *
 * By: Moussa Fofana // Node BAMAKO_223
 */

'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder
} = require('discord.js');

const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState,
  NoSubscriberBehavior
} = require('@discordjs/voice');

const play = require('play-dl');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  GREEN: 0x00ff88, DARK: 0x1a1a2e, ACCENT: 0x5865F2,
  WARN: 0xff6b35, RED: 0xe74c3c, GOLD: 0xf1c40f, SPOTIFY: 0x1DB954,
};

const CFG = {
  MAX_QUEUE: 100, IDLE_TIMEOUT_MS: 300000, NP_UPDATE_MS: 8000,
  VOLUME_DEFAULT: 100, AUTOCOMPLETE_MAX: 10, SEARCH_TIMEOUT_MS: 8000,
  COOKIE_PATH: path.join(process.cwd(), 'data', 'cookies.txt'),
  BYPASS_METHOD: process.env.YT_BYPASS || 'auto',
  PROXY_URL: process.env.YT_PROXY || null,
};

const EMOJI = {
  PLAY:'\u25B6\uFE0F', PAUSE:'\u23F8\uFE0F', STOP:'\u23F9\uFE0F', SKIP:'\u23ED\uFE0F',
  PREV:'\u23EE\uFE0F', LOOP:'\u{1F501}', LOOP1:'\u{1F502}', SHUFFLE:'\u{1F500}',
  QUEUE:'\u{1F4DC}', VOLUP:'\u{1F50A}', VOLDN:'\u{1F509}', VOLMUTE:'\u{1F508}',
  NOTE:'\u{1F3B5}', NOTES:'\u{1F3B6}', HEART:'\u2764\uFE0F', DASH:'\u{1F39B}\uFE0F',
  X:'\u274C', CHECK:'\u2705', WARN:'\u26A0\uFE0F', RED:'\u{1F534}', GREEN:'\u{1F7E2}',
  YELLOW:'\u{1F7E1}', STAR:'\u2B50', FIRE:'\u{1F525}', CROWN:'\u{1F451}',
  LOCK:'\u{1F512}', THUMBUP:'\u{1F44D}', THUMBDN:'\u{1F44E}', SPOTIFY_E:'\u{1F31A}',
  YOUTUBE_E:'\u{1F4FA}', TOOLS:'\u{1F6E0}\uFE0F', GLOBE:'\u{1F310}', REFRESH:'\u{1F504}',
  FLAG:'\u{1F1F2}\u{1F1F1}', SHIELD:'\u{1F6E1}\uFE0F', COOKIE:'\u{1F36A}',
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

const LP = {
  STREAM:'\x1b[36m[STREAM ENGINE]\x1b[0m', QUEUE:'\x1b[35m[QUEUE INIT]\x1b[0m',
  VOTE:'\x1b[33m[VOTE GUARD]\x1b[0m', AUDIO:'\x1b[31m[AUDIO ERROR]\x1b[0m',
  VOICE:'\x1b[32m[VOICE CONN]\x1b[0m', BYPASS:'\x1b[35m[YT BYPASS]\x1b[0m',
  PLAYER:'\x1b[34m[PLAYER]\x1b[0m', WARN:'\x1b[33m[WARN]\x1b[0m',
};
function log(tag, msg) { console.log(`${LP[tag] || '[MUSIC]'} ${msg}`); }

// ═══════════════════════════════════════════════════════════════════════════════
// YOUTUBE IP BLOCK BYPASS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

class YouTubeBypass {
  constructor() {
    this.cookies = this.loadCookies();
    this.proxy = CFG.PROXY_URL;
    this.method = CFG.BYPASS_METHOD;
    this.datacenterDetected = this.detectDatacenterIP();
    this.stats = { youtube: 0, soundcloud: 0, failures: 0 };

    if (this.datacenterDetected) {
      log('BYPASS', `${EMOJI.SHIELD} Datacenter IP detected — activating bypass`);
      if (!this.cookies && !this.proxy) {
        log('WARN', `${EMOJI.WARN} No cookies or proxy — YouTube may fail. See data/README_COOKIES.md`);
      }
    }
  }

  detectDatacenterIP() {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.family === 'IPv4') {
          const ip = iface.address;
          const dcRanges = [
            /^138\.199\./, /^78\.46\./, /^88\.99\./, /^95\.216\./, /^116\.202\./,
            /^51\./, /^54\.37\./, /^145\.239\./, /^151\.80\./,
            /^144\.91\./, /^161\.97\./, /^173\.212\./, /^194\.163\./,
            /^5\.(9|39|75,104,181,189)\./, /^159\.69\./, /^188\.34\./,
          ];
          if (dcRanges.some(r => r.test(ip))) return true;
        }
      }
    }
    return false;
  }

  loadCookies() {
    if (fs.existsSync(CFG.COOKIE_PATH)) {
      try {
        const raw = fs.readFileSync(CFG.COOKIE_PATH, 'utf8');
        if (raw.trim().startsWith('[')) {
          const parsed = JSON.parse(raw);
          log('BYPASS', `${EMOJI.COOKIE} Loaded ${parsed.length} cookies (JSON)`);
          return parsed;
        }
        const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        const cookies = lines.map(l => {
          const parts = l.split('\t');
          if (parts.length >= 7) return { domain: parts[0], path: parts[2], name: parts[5], value: parts[6] };
          return null;
        }).filter(Boolean);
        log('BYPASS', `${EMOJI.COOKIE} Loaded ${cookies.length} cookies (Netscape)`);
        return cookies;
      } catch (e) { log('WARN', `Cookie load failed: ${e.message}`); }
    }
    if (process.env.YT_COOKIES) {
      try { return JSON.parse(process.env.YT_COOKIES); }
      catch (e) { log('WARN', `YT_COOKIES parse failed: ${e.message}`); }
    }
    return null;
  }

  getOptions() {
    const opts = { quality: 1, discordPlayerCompatibility: true };
    if (this.cookies?.length > 0) {
      opts.cookieHeader = this.cookies.map(c => `${c.name}=${c.value}`).join('; ');
    }
    if (this.proxy) opts.proxy = this.proxy;
    return opts;
  }

  async search(query, limit = 10) {
    const errors = [];

    if (this.method === 'auto' || this.method === 'cookies') {
      try {
        const results = await play.search(query, { limit, source: { youtube: 'video' } });
        if (results?.length) {
          this.stats.youtube++;
          log('BYPASS', `${EMOJI.YOUTUBE_E} YouTube search OK (${results.length} results)`);
          return results.map(r => ({
            title: r.title, durationInSec: r.durationInSec || 0, url: r.url,
            thumbnail: r.thumbnails?.[0] || null, id: r.id,
            channel: r.channel, source: 'youtube'
          }));
        }
      } catch (e) { errors.push(`YT: ${e.message}`); }
    }

    if (this.method === 'auto' || this.method === 'fallback') {
      try {
        const results = await play.search(query, { limit, source: { soundcloud: 'tracks' } });
        if (results?.length) {
          this.stats.soundcloud++;
          log('BYPASS', `${EMOJI.SPOTIFY_E} SoundCloud fallback OK (${results.length})`);
          return results.map(r => ({
            title: r.title, durationInSec: r.durationInSec || 0, url: r.url,
            thumbnail: r.thumbnail || null, id: r.id,
            channel: { name: r.uploader || 'SoundCloud' }, source: 'soundcloud'
          }));
        }
      } catch (e) { errors.push(`SC: ${e.message}`); }
    }

    this.stats.failures++;
    throw new Error(`All sources failed: ${errors.join('; ')}`);
  }

  async stream(url) {
    const errors = [];

    if ((this.method === 'auto' || this.method === 'cookies') && play.yt_validate(url) === 'video') {
      try {
        const stream = await play.stream(url, this.getOptions());
        this.stats.youtube++;
        log('BYPASS', `${EMOJI.YOUTUBE_E} YouTube stream OK`);
        return stream;
      } catch (e) { errors.push(`YT stream: ${e.message}`); }
    }

    if (this.method === 'auto' || this.method === 'fallback') {
      try {
        if (url.includes('soundcloud.com')) {
          const stream = await play.stream(url, { quality: 1, discordPlayerCompatibility: true });
          this.stats.soundcloud++;
          log('BYPASS', `${EMOJI.SPOTIFY_E} SoundCloud stream OK`);
          return stream;
        }
        if (play.yt_validate(url) === 'video') {
          const info = await play.video_info(url).catch(() => null);
          if (info?.video_details?.title) {
            const scResults = await play.search(
              `${info.video_details.title} ${info.video_details.channel?.name || ''}`,
              { limit: 1, source: { soundcloud: 'tracks' } }
            );
            if (scResults?.[0]) {
              const stream = await play.stream(scResults[0].url, { quality: 1, discordPlayerCompatibility: true });
              this.stats.soundcloud++;
              log('BYPASS', `${EMOJI.SPOTIFY_E} SC fallback stream OK`);
              return stream;
            }
          }
        }
      } catch (e) { errors.push(`SC: ${e.message}`); }
    }

    this.stats.failures++;
    throw new Error(`Cannot stream: ${errors.join('; ')}`);
  }

  async videoInfo(url) {
    return await play.video_info(url, this.getOptions());
  }

  async spotifyToYouTube(trackName, artist) {
    try {
      const results = await this.search(`${trackName} ${artist}`, 1);
      return results[0]?.url || null;
    } catch { return null; }
  }

  getStats() {
    return { ...this.stats, method: this.method, cookies: !!this.cookies, proxy: !!this.proxy };
  }
}

const bypass = new YouTubeBypass();

// ═══════════════════════════════════════════════════════════════════════════════
// VOTE GUARD
// ═══════════════════════════════════════════════════════════════════════════════

class VoteGuard {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL_MS = 10 * 60 * 1000;
  }

  async hasVoted(userId) {
    const botId = process.env.CLIENT_ID;
    const token = process.env.TOPGG_TOKEN;
    if (!botId || !token) return true;

    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) return cached.voted;

    try {
      const res = await fetch(`https://top.gg/api/bots/${botId}/check?userId=${userId}`, {
        headers: { Authorization: token }
      });
      const data = await res.json();
      const voted = data.voted === 1 || data.voted === true;
      this.cache.set(userId, { voted, ts: Date.now() });
      log('VOTE', `User ${userId}: ${voted ? 'VOTED ✓' : 'NOT VOTED ✗'}`);
      return voted;
    } catch (e) {
      log('VOTE', `API error — allowing`);
      return true;
    }
  }

  buildVoteEmbed(botName, botAvatar) {
    return new EmbedBuilder()
      .setColor(C.ACCENT)
      .setAuthor({ name: `${EMOJI.LOCK} Vote Required`, iconURL: botAvatar })
      .setTitle(`${EMOJI.STAR} Support ${botName}`)
      .setDescription(
        `Vote for **${botName}** on **top.gg** to use music.\n\n` +
        `${EMOJI.CHECK} Takes 10 seconds\n${EMOJI.STAR} Or get **Premium** to skip voting`
      )
      .setFooter({ text: `${botName} \u2022 Vote Guard \u2022 BAMAKO_223 ${EMOJI.FLAG}` });
  }

  buildVoteButtons(botId) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Vote on Top.gg').setEmoji(EMOJI.THUMBUP)
        .setStyle(ButtonStyle.Link).setURL(`https://top.gg/bot/${botId}/vote`),
      new ButtonBuilder().setLabel('Premium').setEmoji(EMOJI.STAR)
        .setStyle(ButtonStyle.Link).setURL(`https://top.gg/bot/${botId}`)
    );
  }
}
const voteGuard = new VoteGuard();

// ═══════════════════════════════════════════════════════════════════════════════
// TRACK MODEL
// ═══════════════════════════════════════════════════════════════════════════════

class Track {
  constructor(data, requester) {
    this.id = data.id || Math.random().toString(36).slice(2, 10);
    this.title = data.title || 'Unknown';
    this.artist = data.channel?.name || data.uploader || 'Unknown';
    this.duration = data.durationInSec || data.duration || 0;
    this.url = data.url || data.link || '';
    this.thumbnail = data.thumbnail?.url || data.thumbnails?.[0]?.url || data.thumbnail || null;
    this.source = data.source || 'youtube';
    this.requester = requester?.tag || 'Unknown';
    this.requesterId = requester?.id || '0';
    this.addedAt = Date.now();
  }
  get durationFmt() { return fmtSec(this.duration); }
  get srcEmoji() {
    return this.source === 'spotify' ? EMOJI.SPOTIFY_E :
           this.source === 'soundcloud' ? EMOJI.SPOTIFY_E :
           this.source === 'youtube' ? EMOJI.YOUTUBE_E : EMOJI.NOTE;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUILD QUEUE MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

class GuildQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.tracks = [];
    this.current = null;
    this.player = null;
    this.connection = null;
    this.textChannel = null;
    this.npMessage = null;
    this.volume = CFG.VOLUME_DEFAULT;
    this.loop = 'off';
    this.shuffle = false;
    this.autoplay = false;
    this.paused = false;
    this.startTime = null;
    this.history = [];
    this._idleTimer = null;
    this._npInterval = null;
    this.session = Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  get isPlaying() { return this.player?.state?.status === AudioPlayerStatus.Playing; }
  get size() { return this.tracks.length; }
}

const queues = new Map();
function getQueue(guildId) {
  if (!queues.has(guildId)) queues.set(guildId, new GuildQueue(guildId));
  return queues.get(guildId);
}
function destroyQueue(guildId) {
  const q = queues.get(guildId);
  if (!q) return;
  if (q._idleTimer) clearTimeout(q._idleTimer);
  if (q._npInterval) clearInterval(q._npInterval);
  if (q.connection) { try { q.connection.destroy(); } catch {} }
  if (q.player) { try { q.player.stop(true); } catch {} }
  queues.delete(guildId);
  log('QUEUE', `Destroyed queue for guild ${guildId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAM RESOLUTION (with bypass)
// ═══════════════════════════════════════════════════════════════════════════════

async function resolveTrack(query, requester) {
  log('STREAM', `Resolving: "${query.substring(0, 60)}"`);

  try {
    if (query.includes('open.spotify.com')) {
      if (play.is_expired()) await play.refreshToken();

      if (query.includes('/track/')) {
        const data = await play.spotify(query);
        const ytUrl = await bypass.spotifyToYouTube(data.name, data.artists?.[0]?.name);
        return new Track({
          id: data.id, title: data.name,
          channel: { name: data.artists?.[0]?.name || 'Spotify' },
          durationInSec: Math.floor(data.durationInSec || 0),
          url: ytUrl || data.url, thumbnail: { url: data.thumbnail?.url || '' },
          source: 'spotify'
        }, requester);
      }

      if (query.includes('/playlist/') || query.includes('/album/')) {
        const data = await play.spotify(query);
        const tracks = [];
        let count = 0;
        for (const item of data.fetched_tracks || []) {
          if (count++ >= 50) break;
          const ytUrl = await bypass.spotifyToYouTube(item.name, item.artists?.[0]?.name);
          tracks.push(new Track({
            id: item.id, title: item.name,
            channel: { name: item.artists?.[0]?.name },
            durationInSec: Math.floor(item.durationInSec || 0),
            url: ytUrl || item.url, thumbnail: { url: item.thumbnail?.url || '' },
            source: 'spotify'
          }, requester));
        }
        return { playlist: true, tracks, playlistName: data.name };
      }
    }

    if (play.yt_validate(query) === 'video') {
      const info = await bypass.videoInfo(query);
      const basic = info.video_details;
      return new Track({
        id: basic.id, title: basic.title, durationInSec: basic.durationInSec || 0,
        url: basic.url, thumbnail: basic.thumbnails?.[0] || null,
        channel: { name: basic.channel?.name || 'YouTube' }, source: 'youtube'
      }, requester);
    }

    if (play.yt_validate(query) === 'playlist') {
      const plist = await play.playlist_info(query);
      const videos = await plist.all_videos();
      const tracks = videos.slice(0, 50).map(v => new Track({
        id: v.id, title: v.title, durationInSec: v.durationInSec || 0,
        url: v.url, thumbnail: v.thumbnails?.[0] || null,
        channel: { name: v.channel?.name || 'YouTube' }, source: 'youtube'
      }, requester));
      return { playlist: true, tracks, playlistName: plist.title };
    }

    const results = await bypass.search(query, 1);
    if (!results?.length) throw new Error('No results found');
    return new Track(results[0], requester);

  } catch (e) {
    log('AUDIO', `Resolution failed: ${e.message}`);
    throw e;
  }
}

async function createStream(track) {
  try {
    const streamData = await bypass.stream(track.url);
    const resource = createAudioResource(streamData.stream, {
      inputType: streamData.type, inlineVolume: true
    });
    resource.volume?.setVolume(CFG.VOLUME_DEFAULT / 100);
    return resource;
  } catch (e) {
    log('AUDIO', `Stream creation failed: ${e.message}`);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER SETUP
// ═══════════════════════════════════════════════════════════════════════════════

function setupPlayer(queue) {
  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play, maxMissedFrames: 50 }
  });

  player.on(AudioPlayerStatus.Playing, () => {
    queue.paused = false; queue.startTime = Date.now();
    log('PLAYER', `Playing: ${queue.current?.title?.substring(0, 40)}`);
    startNpUpdater(queue);
  });

  player.on(AudioPlayerStatus.Paused, () => { queue.paused = true; });

  player.on(AudioPlayerStatus.Idle, async () => {
    queue.startTime = null; stopNpUpdater(queue);
    if (queue.loop === 'track' && queue.current) {
      await playTrack(queue, queue.current);
    } else {
      if (queue.current && queue.loop === 'queue') queue.tracks.push(queue.current);
      if (queue.current) queue.history.push(queue.current);
      if (queue.history.length > 50) queue.history.shift();
      if (queue.tracks.length > 0) {
        const next = queue.shuffle
          ? queue.tracks.splice(Math.floor(Math.random() * queue.tracks.length), 1)[0]
          : queue.tracks.shift();
        await playTrack(queue, next);
      } else {
        queue.current = null; startIdleTimer(queue);
      }
    }
  });

  player.on('error', (err) => {
    log('AUDIO', `Player error: ${err.message}`);
    if (queue.tracks.length > 0) {
      const next = queue.tracks.shift();
      playTrack(queue, next);
    }
  });

  queue.player = player;
  return player;
}

async function playTrack(queue, track) {
  try {
    queue.current = track;
    const resource = await createStream(track);
    resource.volume?.setVolume(queue.volume / 100);
    queue.player.play(resource);
    await sendNowPlaying(queue);
    return true;
  } catch (e) {
    log('AUDIO', `Play failed: ${e.message}`);
    if (queue.textChannel) {
      queue.textChannel.send({
        embeds: [new EmbedBuilder().setColor(C.RED).setDescription(
          `${EMOJI.RED} Failed to play **${track.title}**\n${e.message}\n\n${EMOJI.SHIELD} *Tip: If on Hetzner, add YouTube cookies in data/cookies.txt*`)
        ]
      }).catch(() => {});
    }
    if (queue.tracks.length > 0) {
      const next = queue.tracks.shift();
      return playTrack(queue, next);
    }
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE CONNECTION
// ═══════════════════════════════════════════════════════════════════════════════

async function connectVoice(channel, queue) {
  try {
    const connection = joinVoiceChannel({
      channelId: channel.id, guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true, selfMute: false
    });
    queue.connection = connection;

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch { destroyQueue(queue.guildId); }
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30000);
    const player = setupPlayer(queue);
    connection.subscribe(player);
    log('VOICE', `Connected to ${channel.name}`);
    return true;
  } catch (e) {
    log('AUDIO', `Voice connection failed: ${e.message}`);
    return false;
  }
}

function startIdleTimer(queue) {
  if (queue._idleTimer) clearTimeout(queue._idleTimer);
  queue._idleTimer = setTimeout(() => {
    if (!queue.current && queue.tracks.length === 0) destroyQueue(queue.guildId);
  }, CFG.IDLE_TIMEOUT_MS);
}
function resetIdleTimer(queue) { if (queue._idleTimer) clearTimeout(queue._idleTimer); }

// ═══════════════════════════════════════════════════════════════════════════════
// NOW PLAYING UI
// ═══════════════════════════════════════════════════════════════════════════════

function buildProgressBar(elapsed, total, size = 18) {
  if (!total) return '\u25AC'.repeat(size);
  const pct = Math.min(1, Math.max(0, elapsed / total));
  const filled = Math.floor(pct * size);
  return '\u{1F518}'.repeat(filled) + '\u25AC'.repeat(size - filled);
}

function fmtSec(s) {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = (s % 60).toString().padStart(2, '0');
  if (h > 0) return `${h}:${(m % 60).toString().padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

function buildNPEmbed(queue) {
  const track = queue.current;
  if (!track) return new EmbedBuilder().setColor(C.DARK).setDescription(`${EMOJI.NOTE} Nothing playing`);

  const elapsed = queue.startTime ? Math.floor((Date.now() - queue.startTime) / 1000) : 0;
  const bar = buildProgressBar(elapsed, track.duration);

  return new EmbedBuilder()
    .setColor(track.source === 'spotify' ? C.SPOTIFY : C.ACCENT)
    .setAuthor({ name: `${EMOJI.NOTE} Now playing`, iconURL: track.thumbnail })
    .setTitle(track.title.length > 80 ? track.title.substring(0, 77) + '...' : track.title)
    .setURL(track.url)
    .setThumbnail(track.thumbnail)
    .addFields(
      { name: '\u200B', value: `\u2022 Added by <@${track.requesterId}>\n\u2022 <#${queue.textChannel?.id || '0'}>`, inline: true },
      { name: '\u200B', value: `Queue: ${queue.size} \u2022 Vol: ${queue.volume}% \u2022 Loop: ${queue.loop}`, inline: true }
    )
    .setDescription(`\`\`\`\n${bar}\n${fmtSec(elapsed)} / ${track.durationFmt}\n\`\`\``)
    .setFooter({ text: `ARCHON CG-223 \u2022 Session ${queue.session} ${EMOJI.FLAG}` })
    .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON CUSTOM IDs: music_<action>_<guildId>  (matches index.js handlers)
// ═══════════════════════════════════════════════════════════════════════════════

function buildNPButtons(queue) {
  const g = queue.guildId;
  const isPaused = queue.paused;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music_heart_${g}`).setEmoji(EMOJI.HEART).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`music_pp_${g}`).setEmoji(isPaused ? EMOJI.PLAY : EMOJI.PAUSE).setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`music_skip_${g}`).setEmoji(EMOJI.SKIP).setStyle(ButtonStyle.Primary).setDisabled(queue.size === 0),
      new ButtonBuilder().setCustomId(`music_stop_${g}`).setEmoji(EMOJI.STOP).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`music_loop_${g}`).setEmoji(queue.loop === 'off' ? EMOJI.LOOP : EMOJI.LOOP1).setStyle(queue.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music_vol50_${g}`).setLabel('50%').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`music_vol100_${g}`).setLabel('100%').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`music_vol150_${g}`).setLabel('150%').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`music_auto_${g}`).setLabel('AutoPlay').setEmoji(EMOJI.LOOP).setStyle(queue.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`music_dash_${g}`).setLabel('Dashboard').setEmoji(EMOJI.DASH).setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music_love_${g}`).setEmoji(EMOJI.THUMBUP).setLabel('Love').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`music_hate_${g}`).setEmoji(EMOJI.THUMBDN).setLabel('Skip').setStyle(ButtonStyle.Danger)
    )
  ];
}

function buildDashEmbed(queue) {
  const stats = bypass.getStats();
  return new EmbedBuilder()
    .setColor(C.DARK)
    .setAuthor({ name: `${EMOJI.DASH} Dashboard \u2022 Session ${queue.session}` })
    .addFields(
      { name: `${EMOJI.VOLMUTE} Volume`, value: `${queue.volume}%`, inline: true },
      { name: `${EMOJI.QUEUE} Queue`, value: `${queue.size}`, inline: true },
      { name: `${EMOJI.LOOP} Loop`, value: queue.loop, inline: true },
      { name: `${EMOJI.PREV} Previous`, value: queue.history.length > 0 ? queue.history[queue.history.length - 1].title.substring(0, 30) : 'None', inline: true },
      { name: `${EMOJI.SHUFFLE} Shuffle`, value: queue.shuffle ? 'On' : 'Off', inline: true },
      { name: `${EMOJI.FIRE} AutoPlay`, value: queue.autoplay ? 'On' : 'Off', inline: true }
    )
    .setDescription(
      `${EMOJI.SHIELD} **Bypass**: ${stats.method} | YT: ${stats.youtube} | SC: ${stats.soundcloud}\n` +
      `${EMOJI.COOKIE} Cookies: ${stats.cookies ? '\u2705' : '\u274C'} | Proxy: ${stats.proxy ? '\u2705' : '\u274C'}`
    )
    .setFooter({ text: `ARCHON CG-223 ${EMOJI.FLAG}` });
}

function buildDashButtons(queue) {
  const g = queue.guildId;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music_prev_${g}`).setEmoji(EMOJI.PREV).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(queue.history.length === 0),
      new ButtonBuilder().setCustomId(`music_shuffle_${g}`).setEmoji(EMOJI.SHUFFLE).setLabel('Shuffle').setStyle(queue.shuffle ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`music_np_${g}`).setEmoji(EMOJI.NOTE).setLabel('Now Playing').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`music_close_${g}`).setEmoji(EMOJI.X).setLabel('Close').setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music_vol70_${g}`).setEmoji(EMOJI.VOLDN).setLabel('70%').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`music_vol100_${g}`).setEmoji(EMOJI.VOLUP).setLabel('100%').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`music_vol130_${g}`).setEmoji(EMOJI.VOLUP).setLabel('130%').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music_fix_${g}`).setEmoji(EMOJI.TOOLS).setLabel('Fix Audio').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`music_recon_${g}`).setEmoji(EMOJI.REFRESH).setLabel('Reconnect').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`music_recreate_${g}`).setEmoji(EMOJI.FIRE).setLabel('Recreate Player').setStyle(ButtonStyle.Danger)
    )
  ];
}

async function sendNowPlaying(queue) {
  if (!queue.textChannel) return;
  try {
    if (queue.npMessage) await queue.npMessage.delete().catch(() => {});
    queue.npMessage = await queue.textChannel.send({
      embeds: [buildNPEmbed(queue)], components: buildNPButtons(queue)
    });
  } catch (e) { log('AUDIO', `NP send failed: ${e.message}`); }
}

function startNpUpdater(queue) {
  if (queue._npInterval) clearInterval(queue._npInterval);
  queue._npInterval = setInterval(() => {
    if (queue.current && queue.npMessage && !queue.paused) {
      queue.npMessage.edit({ embeds: [buildNPEmbed(queue)], components: buildNPButtons(queue) }).catch(() => {});
    }
  }, CFG.NP_UPDATE_MS);
}
function stopNpUpdater(queue) {
  if (queue._npInterval) { clearInterval(queue._npInterval); queue._npInterval = null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE
// ═══════════════════════════════════════════════════════════════════════════════

async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'query' || !focused.value || focused.value.length < 2) {
    return interaction.respond([]);
  }
  try {
    const results = await bypass.search(focused.value, CFG.AUTOCOMPLETE_MAX);
    if (!results?.length) return interaction.respond([]);
    const choices = results.map(r => ({
      name: `${EMOJI.NOTE} ${r.title.substring(0, 60)} \u2014 ${fmtSec(r.durationInSec || 0)}`.substring(0, 100),
      value: r.url
    }));
    await interaction.respond(choices.slice(0, 25));
  } catch (e) { await interaction.respond([]); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER (parses music_<action>_<guildId>)
// ═══════════════════════════════════════════════════════════════════════════════

async function handleButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('music_')) return false;

  // Parse: music_<action>_<guildId>
  const parts = id.split('_');
  if (parts.length < 3) return false;

  const action = parts[1];
  const guildId = parts[2];
  const queue = getQueue(guildId);

  await interaction.deferUpdate().catch(() => {});

  switch (action) {
    case 'heart': { if (queue.current) queue.current.likes++; break; }

    case 'pp': {
      if (!queue.player) break;
      if (queue.paused) { queue.player.unpause(); queue.paused = false; }
      else { queue.player.pause(); queue.paused = true; }
      if (queue.npMessage) await queue.npMessage.edit({ embeds: [buildNPEmbed(queue)], components: buildNPButtons(queue) }).catch(() => {});
      break;
    }

    case 'skip': { if (queue.player) queue.player.stop(); break; }

    case 'stop': {
      destroyQueue(guildId);
      return true;
    }

    case 'loop': {
      queue.loop = ['off', 'track', 'queue'][(['off', 'track', 'queue'].indexOf(queue.loop) + 1) % 3];
      if (queue.npMessage) await queue.npMessage.edit({ embeds: [buildNPEmbed(queue)], components: buildNPButtons(queue) }).catch(() => {});
      break;
    }

    case 'vol50': case 'vol70': case 'vol100': case 'vol130': case 'vol150': {
      queue.volume = parseInt(action.replace('vol', ''));
      if (queue.player?.state?.resource?.volume) queue.player.state.resource.volume.setVolume(queue.volume / 100);
      if (queue.npMessage) await queue.npMessage.edit({ embeds: [buildNPEmbed(queue)], components: buildNPButtons(queue) }).catch(() => {});
      break;
    }

    case 'auto': {
      queue.autoplay = !queue.autoplay;
      if (queue.npMessage) await queue.npMessage.edit({ embeds: [buildNPEmbed(queue)], components: buildNPButtons(queue) }).catch(() => {});
      break;
    }

    case 'dash': {
      await interaction.channel?.send({
        embeds: [buildDashEmbed(queue)], components: buildDashButtons(queue)
      }).catch(() => {});
      break;
    }

    case 'close': {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C.DARK).setDescription(`${EMOJI.CHECK} Closed.`)], components: [] }).catch(() => {});
      break;
    }

    case 'np': { await sendNowPlaying(queue); break; }

    case 'shuffle': {
      queue.shuffle = !queue.shuffle;
      await interaction.channel?.send({
        embeds: [new EmbedBuilder().setColor(C.GREEN).setDescription(`${EMOJI.SHUFFLE} Shuffle ${queue.shuffle ? 'enabled' : 'disabled'}.`)]
      }).catch(() => {});
      break;
    }

    case 'prev': {
      if (queue.history.length > 0) {
        const prev = queue.history.pop();
        if (queue.current) queue.tracks.unshift(queue.current);
        await playTrack(queue, prev);
      }
      break;
    }

    case 'love': {
      if (queue.current) queue.current.likes++;
      await interaction.channel?.send({ embeds: [new EmbedBuilder().setColor(C.GREEN).setDescription(`${EMOJI.THUMBUP} Glad you like it!`)] }).catch(() => {});
      break;
    }

    case 'hate': {
      if (queue.current) queue.current.dislikes++;
      await interaction.channel?.send({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription(`${EMOJI.THUMBDN} Skipping...`)] }).catch(() => {});
      if (queue.player) queue.player.stop();
      break;
    }

    case 'fix': {
      if (queue.current) await playTrack(queue, queue.current);
      break;
    }

    case 'recon': {
      const vc = interaction.member?.voice?.channel;
      if (vc) {
        if (queue.connection) queue.connection.destroy();
        await connectVoice(vc, queue);
        if (queue.current) await playTrack(queue, queue.current);
      }
      break;
    }

    case 'recreate': {
      setupPlayer(queue);
      if (queue.connection) queue.connection.subscribe(queue.player);
      if (queue.current) await playTrack(queue, queue.current);
      break;
    }
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLASH COMMAND DATA
// ═══════════════════════════════════════════════════════════════════════════════

const slashData = new SlashCommandBuilder()
  .setName('play').setDescription('Play a song from YouTube or Spotify')
  .addStringOption(opt =>
    opt.setName('query').setDescription('Song name, link, or playlist')
      .setRequired(true).setAutocomplete(true)
  )
  .addBooleanOption(opt =>
    opt.setName('insert-first').setDescription('Insert at front of queue').setRequired(false)
  );

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

async function executeSlash(interaction, client) {
  const guildId = interaction.guild.id;
  const member = interaction.member;
  const vc = member.voice?.channel;

  if (!vc) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(C.WARN).setDescription(`${EMOJI.WARN} Join a voice channel first!`)], ephemeral: true
    });
  }

  const voted = await voteGuard.hasVoted(interaction.user.id);
  if (!voted) {
    return interaction.reply({
      embeds: [voteGuard.buildVoteEmbed(client.user.username, client.user.displayAvatarURL())],
      components: [voteGuard.buildVoteButtons(client.user.id)], ephemeral: true
    });
  }

  await interaction.deferReply();
  const query = interaction.options.getString('query');
  const insertFirst = interaction.options.getBoolean('insert-first') || false;

  const queue = getQueue(guildId);
  queue.textChannel = interaction.channel;
  resetIdleTimer(queue);

  if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Disconnected) {
    const connected = await connectVoice(vc, queue);
    if (!connected) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(C.RED).setDescription(`${EMOJI.RED} Voice connection failed.`)]
      });
    }
  }

  await interaction.editReply({
    embeds: [new EmbedBuilder().setColor(C.ACCENT).setDescription(`${EMOJI.NOTE} Searching \`${query.substring(0, 60)}\`...`)]
  });

  try {
    const result = await resolveTrack(query, interaction.user);

    if (result?.playlist && Array.isArray(result.tracks)) {
      if (insertFirst) queue.tracks.unshift(...result.tracks);
      else queue.tracks.push(...result.tracks);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(C.GREEN)
          .setDescription(`${EMOJI.SPOTIFY_E} Added **${result.tracks.length}** tracks${result.playlistName ? ` from *${result.playlistName}*` : ''}`)]
      });
      if (!queue.current) { const first = queue.tracks.shift(); await playTrack(queue, first); }
      return;
    }

    const track = result;
    if (insertFirst && queue.current) queue.tracks.unshift(track);
    else queue.tracks.push(track);

    if (queue.current) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(track.source === 'spotify' ? C.SPOTIFY : C.GREEN)
          .setDescription(`${track.srcEmoji} Added **${track.title}** \u2014 ${track.durationFmt}`)]
      });
    } else {
      await playTrack(queue, track);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(C.GREEN)
          .setDescription(`${EMOJI.PLAY} Now playing **${track.title}** \u2014 ${track.durationFmt}`)]
      });
    }
  } catch (e) {
    log('AUDIO', `Play error: ${e.message}`);
    const isDcError = e.message.includes('403') || e.message.includes('429') || e.message.includes('sign in');
    const helpMsg = isDcError
      ? `\n\n${EMOJI.SHIELD} **Datacenter IP detected!**\nAdd YouTube cookies: place \`cookies.txt\` in \`data/\` folder, then restart.`
      : '';
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(C.RED).setDescription(`${EMOJI.RED} ${e.message}${helpMsg}`)]
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS — name: 'music' to match index.js command map + all legacy aliases
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  name: 'music',
  aliases: ['play', 'p', 'skip', 's', 'queue', 'q', 'stop', 'disconnect', 'dc',
    'volume', 'vol', 'loop', 'pause', 'resume', 'np', 'nowplaying', 'dashboard', 'search'],
  category: 'MUSIC',
  description: 'Native Audio Engine v5.1 — play-dl + datacenter bypass',
  data: slashData,

  async autocomplete(interaction) {
    await handleAutocomplete(interaction);
  },

  async execute(interaction, client) {
    await executeSlash(interaction, client);
  },

  async handleComponent(interaction) {
    return await handleButton(interaction);
  },

  async handleSelectMenu() {
    // Dashboard select menu — not used in v5.1 (buttons only)
    return false;
  },

  initLavalink() {
    log('STREAM', 'Native Audio Engine v5.1 — No Lavalink needed');
    if (bypass.datacenterDetected) {
      log('BYPASS', `${EMOJI.SHIELD} Datacenter IP — strategies active`);
      log('BYPASS', `Method: ${bypass.method} | Cookies: ${bypass.cookies ? '\u2705' : '\u274C'} | Proxy: ${bypass.proxy ? '\u2705' : '\u274C'}`);
    }
  },
};

console.log('[NATIVE AUDIO] Engine v5.1 loaded — play-dl + YouTube datacenter bypass');
