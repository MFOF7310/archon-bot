/**
 * ARCHITECT CG-223 // NATIVE AUDIO ENGINE v5.0
 * Pure @discordjs/voice + play-dl — No Lavalink, No Shoukaku
 * FlaviBot-style: Autocomplete, Now Playing, Vote Guard, Dashboard
 *
 * By: Moussa Fofana // Node BAMAKO_223
 */

'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, PermissionFlagsBits
} = require('discord.js');

const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState,
  NoSubscriberBehavior, StreamType
} = require('@discordjs/voice');

const play = require('play-dl');

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  GREEN:  0x00ff88,
  DARK:   0x1a1a2e,
  ACCENT: 0x5865F2,
  WARN:   0xff6b35,
  RED:    0xe74c3c,
  GOLD:   0xf1c40f,
  SPOTIFY: 0x1DB954,
  YOUTUBE: 0xFF0000,
};

const CFG = {
  MAX_QUEUE: 100,
  IDLE_TIMEOUT_MS: 300000,
  NP_UPDATE_MS: 8000,
  VOLUME_DEFAULT: 100,
  VOTE_CHECK_HOURS: 12,
  AUTOCOMPLETE_MAX: 10,
  SEARCH_TIMEOUT_MS: 5000,
};

const EMOJI = {
  PLAY:    '\u25B6\uFE0F', PAUSE:   '\u23F8\uFE0F', STOP:    '\u23F9\uFE0F',
  SKIP:    '\u23ED\uFE0F', PREV:    '\u23EE\uFE0F', LOOP:    '\u{1F501}',
  LOOP1:   '\u{1F502}',   SHUFFLE: '\u{1F500}',   QUEUE:   '\u{1F4DC}',
  VOLUP:   '\u{1F50A}',   VOLDN:   '\u{1F509}',   VOLMUTE: '\u{1F508}',
  NOTE:    '\u{1F3B5}',   NOTES:   '\u{1F3B6}',   HEART:   '\u2764\uFE0F',
  DASH:    '\u{1F39B}\uFE0F', X:       '\u274C',       CHECK:   '\u2705',
  WARN:    '\u26A0\uFE0F', RED:     '\u{1F534}',   GREEN:   '\u{1F7E2}',
  YELLOW:  '\u{1F7E1}',   BLUE:    '\u{1F535}',   STAR:    '\u2B50',
  FIRE:    '\u{1F525}',   CROWN:   '\u{1F451}',   LOCK:    '\u{1F512}',
  THUMBUP: '\u{1F44D}',   THUMBDN: '\u{1F44E}',   SPOTIFY: '\u{1F31A}',
  YOUTUBE: '\u{1F4FA}',   TOOLS:   '\u{1F6E0}\uFE0F', GLOBE:   '\u{1F310}',
  REFRESH: '\u{1F504}',   FLAG:    '\u{1F1F2}\u{1F1F1}',
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_PREFIX = {
  STREAM: '\x1b[36m[STREAM ENGINE]\x1b[0m',
  QUEUE:  '\x1b[35m[QUEUE INIT]\x1b[0m',
  VOTE:   '\x1b[33m[VOTE GUARD]\x1b[0m',
  AUDIO:  '\x1b[31m[AUDIO ERROR]\x1b[0m',
  VOICE:  '\x1b[32m[VOICE CONN]\x1b[0m',
  PLAY:   '\x1b[34m[PLAY ENGINE]\x1b[0m',
  PLAYER: '\x1b[32m[PLAYER]\x1b[0m',
};

function log(tag, msg) { console.log(`${LOG_PREFIX[tag] || '[MUSIC]'} ${msg}`); }

// ═══════════════════════════════════════════════════════════════════════════════
// TOP.GG VOTE GUARD
// ═══════════════════════════════════════════════════════════════════════════════

class VoteGuard {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL_MS = 10 * 60 * 1000; // 10 min cache
  }

  async hasVoted(userId) {
    const botId = process.env.CLIENT_ID;
    const token = process.env.TOPGG_TOKEN;
    if (!botId || !token) return true; // Vote guard disabled if no token

    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) return cached.voted;

    try {
      const res = await fetch(`https://top.gg/api/bots/${botId}/check?userId=${userId}`, {
        headers: { Authorization: token }, timeout: 5000
      });
      const data = await res.json();
      const voted = data.voted === 1 || data.voted === true;
      this.cache.set(userId, { voted, ts: Date.now() });
      log('VOTE', `User ${userId} vote check: ${voted ? 'VOTED' : 'NOT VOTED'}`);
      return voted;
    } catch (e) {
      log('VOTE', `API error: ${e.message} — allowing access`);
      return true; // Fail open
    }
  }

  buildVoteEmbed(botName, botAvatar) {
    return new EmbedBuilder()
      .setColor(C.ACCENT)
      .setAuthor({ name: `${EMOJI.LOCK} Action Required`, iconURL: botAvatar })
      .setTitle(`${EMOJI.STAR} Support ${botName}`)
      .setDescription(
        `You need to vote for **${botName}** on **top.gg** to use music commands.\n\n` +
        `${EMOJI.CHECK} Takes less than 10 seconds\n` +
        `${EMOJI.STAR} Or unlock everything with **${botName} Premium**`
      )
      .setFooter({ text: `${botName} \u2022 Vote Guard \u2022 BAMAKO_223 ${EMOJI.FLAG}` });
  }

  buildVoteButtons(botId) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(`${EMOJI.THUMBUP} Vote on Top.gg`)
        .setStyle(ButtonStyle.Link)
        .setURL(`https://top.gg/bot/${botId}/vote`),
      new ButtonBuilder()
        .setLabel(`${EMOJI.STAR} Premium`)
        .setStyle(ButtonStyle.Link)
        .setURL(`https://top.gg/bot/${botId}`),
      new ButtonBuilder()
        .setLabel(`${EMOJI.HEART} Support Server`)
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/invite')
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
    this.thumbnail = data.thumbnail?.url || data.thumbnails?.[0]?.url || null;
    this.source = data.source || 'youtube';
    this.requester = requester?.tag || 'Unknown';
    this.requesterId = requester?.id || '0';
    this.addedAt = Date.now();
    this.likes = 0;
    this.dislikes = 0;
  }

  get durationFormatted() { return fmtTime(this.duration * 1000); }
  get sourceEmoji() {
    return this.source === 'spotify' ? EMOJI.SPOTIFY :
           this.source === 'youtube' ? EMOJI.YOUTUBE : EMOJI.NOTE;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUILD QUEUE MANAGER (Map-based, per-guild isolation)
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
    this.loop = 'off'; // off | track | queue
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
  get totalDuration() { return this.tracks.reduce((s, t) => s + (t.duration || 0), 0); }
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
// STREAM ENGINE (play-dl native)
// ═══════════════════════════════════════════════════════════════════════════════

async function resolveTrack(query, requester) {
  log('STREAM', `Resolving: "${query.substring(0, 60)}"`);

  try {
    // Spotify URL
    if (query.includes('open.spotify.com')) {
      if (play.is_expired()) await play.refreshToken();

      if (query.includes('/track/')) {
        const data = await play.spotify(query);
        return new Track({
          id: data.id, title: data.name, artist: data.artists?.[0]?.name,
          duration: Math.floor(data.durationInSec || 0),
          url: data.url, thumbnail: { url: data.thumbnail?.url || '' },
          source: 'spotify', channel: { name: data.artists?.[0]?.name }
        }, requester);
      }
      // Playlist/Album — return first track + queue rest
      if (query.includes('/playlist/') || query.includes('/album/')) {
        const data = await play.spotify(query);
        const tracks = [];
        let count = 0;
        for (const item of data.fetched_tracks || []) {
          if (count++ >= 50) break;
          tracks.push(new Track({
            id: item.id, title: item.name, artist: item.artists?.[0]?.name,
            duration: Math.floor(item.durationInSec || 0),
            url: item.url, thumbnail: { url: item.thumbnail?.url || '' },
            source: 'spotify', channel: { name: item.artists?.[0]?.name }
          }, requester));
        }
        return { playlist: true, tracks };
      }
    }

    // YouTube URL (direct)
    if (play.yt_validate(query) === 'video') {
      const info = await play.video_info(query);
      const basic = info.video_details;
      return new Track({
        id: basic.id, title: basic.title, duration: basic.durationInSec || 0,
        url: basic.url, thumbnail: basic.thumbnails?.[0] || null,
        source: 'youtube', channel: { name: basic.channel?.name || 'YouTube' }
      }, requester);
    }

    // YouTube Playlist URL
    if (play.yt_validate(query) === 'playlist') {
      const plist = await play.playlist_info(query);
      const videos = await plist.all_videos();
      const tracks = videos.slice(0, 50).map(v => new Track({
        id: v.id, title: v.title, duration: v.durationInSec || 0,
        url: v.url, thumbnail: v.thumbnails?.[0] || null,
        source: 'youtube', channel: { name: v.channel?.name || 'YouTube' }
      }, requester));
      return { playlist: true, tracks, playlistName: plist.title };
    }

    // Search query
    const results = await play.search(query, { limit: 1, source: { youtube: 'video' } });
    if (!results?.length) throw new Error('No results found');
    const r = results[0];
    return new Track({
      id: r.id, title: r.title, duration: r.durationInSec || 0,
      url: r.url, thumbnail: r.thumbnails?.[0] || null,
      source: 'youtube', channel: { name: r.channel?.name || 'YouTube' }
    }, requester);

  } catch (e) {
    log('AUDIO', `Stream resolution failed: ${e.message}`);
    throw e;
  }
}

async function createStream(track) {
  try {
    // For Spotify tracks, search YouTube equivalent
    let searchUrl = track.url;
    if (track.source === 'spotify') {
      const ytResults = await play.search(`${track.title} ${track.artist}`, {
        limit: 1, source: { youtube: 'video' }
      });
      if (!ytResults?.length) throw new Error('Could not find YouTube equivalent');
      searchUrl = ytResults[0].url;
    }

    const stream = await play.stream(searchUrl, { quality: 2, discordPlayerCompatibility: true });
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true
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
    queue.paused = false;
    queue.startTime = Date.now();
    log('PLAYER', `Playing: ${queue.current?.title?.substring(0, 40)}`);
    startNpUpdater(queue);
  });

  player.on(AudioPlayerStatus.Paused, () => {
    queue.paused = true;
    log('PLAYER', 'Paused');
  });

  player.on(AudioPlayerStatus.Idle, async () => {
    queue.startTime = null;
    stopNpUpdater(queue);

    if (queue.loop === 'track' && queue.current) {
      await playTrack(queue, queue.current);
    } else {
      if (queue.current && queue.loop === 'queue') {
        queue.tracks.push(queue.current);
      }
      if (queue.current) queue.history.push(queue.current);
      if (queue.history.length > 50) queue.history.shift();

      if (queue.tracks.length > 0) {
        const next = queue.shuffle
          ? queue.tracks.splice(Math.floor(Math.random() * queue.tracks.length), 1)[0]
          : queue.tracks.shift();
        await playTrack(queue, next);
      } else {
        queue.current = null;
        log('PLAYER', 'Queue empty — starting idle timer');
        startIdleTimer(queue);
      }
    }
  });

  player.on('error', (err) => {
    log('AUDIO', `Player error: ${err.message}`);
    if (queue.textChannel) {
      queue.textChannel.send({
        embeds: [new EmbedBuilder().setColor(C.RED).setDescription(`${EMOJI.RED} Audio error: ${err.message.substring(0, 100)}`)]
      }).catch(() => {});
    }
    // Try next track
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
        embeds: [new EmbedBuilder().setColor(C.RED).setDescription(`${EMOJI.RED} Failed to play **${track.title}**\n${e.message}`)]
      }).catch(() => {});
    }
    // Auto-skip on failure
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
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    queue.connection = connection;

    connection.on(VoiceConnectionStatus.Ready, () => {
      log('VOICE', `Connected to ${channel.name}`);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch {
        destroyQueue(queue.guildId);
      }
    });

    connection.on('error', (err) => {
      log('AUDIO', `Connection error: ${err.message}`);
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30000);

    const player = setupPlayer(queue);
    connection.subscribe(player);
    return true;
  } catch (e) {
    log('AUDIO', `Voice connection failed: ${e.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDLE TIMER
// ═══════════════════════════════════════════════════════════════════════════════

function startIdleTimer(queue) {
  if (queue._idleTimer) clearTimeout(queue._idleTimer);
  queue._idleTimer = setTimeout(() => {
    if (!queue.current && queue.tracks.length === 0) {
      if (queue.textChannel) {
        queue.textChannel.send({
          embeds: [new EmbedBuilder().setColor(C.DARK).setDescription(
            `${EMOJI.YELLOW} Left the voice channel due to inactivity.\nYou can disable this with \`/24-7\`.`
          )]
        }).catch(() => {});
      }
      destroyQueue(queue.guildId);
    }
  }, CFG.IDLE_TIMEOUT_MS);
}

function resetIdleTimer(queue) {
  if (queue._idleTimer) clearTimeout(queue._idleTimer);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOW PLAYING UI (FlaviBot-style)
// ═══════════════════════════════════════════════════════════════════════════════

function buildNPEmbed(queue) {
  const track = queue.current;
  if (!track) return new EmbedBuilder().setColor(C.DARK).setDescription(`${EMOJI.NOTE} Nothing playing`);

  const elapsed = queue.startTime ? Math.floor((Date.now() - queue.startTime) / 1000) : 0;
  const progressBar = buildProgressBar(elapsed, track.duration || 0);

  return new EmbedBuilder()
    .setColor(track.source === 'spotify' ? C.SPOTIFY : C.ACCENT)
    .setAuthor({ name: `${EMOJI.NOTE} Now playing`, iconURL: track.thumbnail })
    .setTitle(track.title.length > 80 ? track.title.substring(0, 77) + '...' : track.title)
    .setURL(track.url)
    .setThumbnail(track.thumbnail)
    .addFields(
      { name: '\u200B', value: `\u2022 Added by <@${track.requesterId}>\n\u2022 <#${queue.textChannel?.id || '0'}>`, inline: true },
      { name: '\u200B', value: `Queue: ${queue.size} \u2022 Vol: ${queue.volume}% \u2022 Loop: ${queue.loop === 'off' ? 'Off' : queue.loop}`, inline: true }
    )
    .setDescription(`\`\`\`\n${progressBar}\n${fmtSec(elapsed)} / ${track.durationFormatted}\n\`\`\``)
    .setFooter({ text: `ARCHON CG-223 \u2022 Session ${queue.session} ${EMOJI.FLAG}` })
    .setTimestamp();
}

function buildNPButtons(queue) {
  const isPaused = queue.paused;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mheart_${queue.guildId}`).setEmoji(EMOJI.HEART).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mpp_${queue.guildId}`).setEmoji(isPaused ? EMOJI.PLAY : EMOJI.PAUSE).setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`mskip_${queue.guildId}`).setEmoji(EMOJI.SKIP).setStyle(ButtonStyle.Primary).setDisabled(queue.size === 0 && !queue.autoplay),
      new ButtonBuilder().setCustomId(`mstop_${queue.guildId}`).setEmoji(EMOJI.STOP).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`mloop_${queue.guildId}`).setEmoji(queue.loop === 'off' ? EMOJI.LOOP : EMOJI.LOOP1).setStyle(queue.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mvol50_${queue.guildId}`).setLabel('50%').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mvol100_${queue.guildId}`).setLabel('100%').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mvol150_${queue.guildId}`).setLabel('150%').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mauto_${queue.guildId}`).setLabel('AutoPlay').setEmoji(EMOJI.LOOP).setStyle(queue.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mdash_${queue.guildId}`).setLabel('Dashboard').setEmoji(EMOJI.DASH).setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mlove_${queue.guildId}`).setEmoji(EMOJI.THUMBUP).setLabel('Love this').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`mhate_${queue.guildId}`).setEmoji(EMOJI.THUMBDN).setLabel('Not for me').setStyle(ButtonStyle.Danger)
    )
  ];
}

function buildDashboardEmbed(queue) {
  return new EmbedBuilder()
    .setColor(C.DARK)
    .setAuthor({ name: `${EMOJI.DASH} Dashboard \u2022 Session ${queue.session}` })
    .addFields(
      { name: `${EMOJI.VOLMUTE} Volume`, value: `${queue.volume}%`, inline: true },
      { name: `${EMOJI.QUEUE} Queue`, value: `${queue.size} songs`, inline: true },
      { name: `${EMOJI.LOOP} Loop`, value: queue.loop, inline: true },
      { name: `${EMOJI.PREV} Previous`, value: queue.history.length > 0 ? queue.history[queue.history.length - 1].title.substring(0, 30) : 'None', inline: true },
      { name: `${EMOJI.SHUFFLE} Shuffle`, value: queue.shuffle ? 'On' : 'Off', inline: true },
      { name: `${EMOJI.FIRE} AutoPlay`, value: queue.autoplay ? 'On' : 'Off', inline: true }
    )
    .setFooter({ text: `ARCHON CG-223 ${EMOJI.FLAG}` });
}

function buildDashboardButtons(queue) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mprev_${queue.guildId}`).setEmoji(EMOJI.PREV).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(queue.history.length === 0),
      new ButtonBuilder().setCustomId(`mshuffle_${queue.guildId}`).setEmoji(EMOJI.SHUFFLE).setLabel('Shuffle').setStyle(queue.shuffle ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mnp_${queue.guildId}`).setEmoji(EMOJI.NOTE).setLabel('Now Playing').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`mclose_${queue.guildId}`).setEmoji(EMOJI.X).setLabel('Close').setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mvol70_${queue.guildId}`).setEmoji(EMOJI.VOLDN).setLabel('70%').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mvol100_${queue.guildId}`).setEmoji(EMOJI.VOLUP).setLabel('100%').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mvol130_${queue.guildId}`).setEmoji(EMOJI.VOLUP).setLabel('130%').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mfix_${queue.guildId}`).setEmoji(EMOJI.TOOLS).setLabel('Fix Audio Issues').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mregion_${queue.guildId}`).setEmoji(EMOJI.GLOBE).setLabel('Change Region').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`mrecon_${queue.guildId}`).setEmoji(EMOJI.REFRESH).setLabel('Reconnect').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mrecreate_${queue.guildId}`).setEmoji(EMOJI.FIRE).setLabel('Recreate Player').setStyle(ButtonStyle.Danger)
    )
  ];
}

async function sendNowPlaying(queue) {
  if (!queue.textChannel) return;
  try {
    if (queue.npMessage) await queue.npMessage.delete().catch(() => {});
    queue.npMessage = await queue.textChannel.send({
      embeds: [buildNPEmbed(queue)],
      components: buildNPButtons(queue)
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
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function fmtTime(ms) {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = (s % 60).toString().padStart(2, '0');
  if (h > 0) return `${h}:${(m % 60).toString().padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

function fmtSec(s) {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = (s % 60).toString().padStart(2, '0');
  if (h > 0) return `${h}:${(m % 60).toString().padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

function buildProgressBar(elapsed, total, size = 18) {
  if (!total) return '\u25AC'.repeat(size);
  const pct = Math.min(1, Math.max(0, elapsed / total));
  const filled = Math.floor(pct * size);
  return '\u{1F518}'.repeat(filled) + '\u25AC'.repeat(size - filled);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE (Live YouTube Search)
// ═══════════════════════════════════════════════════════════════════════════════

async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'query' || !focused.value || focused.value.length < 2) {
    return interaction.respond([]);
  }

  try {
    const results = await play.search(focused.value, {
      limit: CFG.AUTOCOMPLETE_MAX,
      source: { youtube: 'video' }
    });

    if (!results?.length) return interaction.respond([]);

    const choices = results.map(r => ({
      name: `${EMOJI.NOTE} ${r.title.substring(0, 60)} \u2014 ${fmtSec(r.durationInSec || 0)}`.substring(0, 100),
      value: r.url
    }));

    await interaction.respond(choices.slice(0, 25));
  } catch (e) {
    log('STREAM', `Autocomplete error: ${e.message}`);
    await interaction.respond([]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

async function handleButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('m')) return false;

  const guildId = interaction.guild?.id;
  if (!guildId) return false;

  const queue = getQueue(guildId);
  const action = id.split('_')[0];

  await interaction.deferUpdate().catch(() => {});

  switch (action) {
    case 'mpp': {
      if (!queue.player) break;
      if (queue.paused) { queue.player.unpause(); queue.paused = false; }
      else { queue.player.pause(); queue.paused = true; }
      if (queue.npMessage) await queue.npMessage.edit({ embeds: [buildNPEmbed(queue)], components: buildNPButtons(queue) }).catch(() => {});
      break;
    }
    case 'mskip': {
      if (queue.player) queue.player.stop();
      break;
    }
    case 'mstop': {
      if (queue.textChannel) {
        await queue.textChannel.send({ embeds: [new EmbedBuilder().setColor(C.DARK).setDescription(`${EMOJI.STOP} Music stopped.`)] }).catch(() => {});
      }
      destroyQueue(guildId);
      return true;
    }
    case 'mloop': {
      const modes = ['off', 'track', 'queue'];
      queue.loop = modes[(modes.indexOf(queue.loop) + 1) % 3];
      if (queue.npMessage) await queue.npMessage.edit({ embeds: [buildNPEmbed(queue)], components: buildNPButtons(queue) }).catch(() => {});
      break;
    }
    case 'mvol50': case 'mvol70': case 'mvol100': case 'mvol130': case 'mvol150': {
      const vol = parseInt(action.replace('mvol', ''));
      queue.volume = vol;
      if (queue.player?.state?.resource?.volume) {
        queue.player.state.resource.volume.setVolume(vol / 100);
      }
      if (queue.npMessage) await queue.npMessage.edit({ embeds: [buildNPEmbed(queue)], components: buildNPButtons(queue) }).catch(() => {});
      break;
    }
    case 'mauto': {
      queue.autoplay = !queue.autoplay;
      if (queue.npMessage) await queue.npMessage.edit({ embeds: [buildNPEmbed(queue)], components: buildNPButtons(queue) }).catch(() => {});
      break;
    }
    case 'mdash': {
      await interaction.channel?.send({
        embeds: [buildDashboardEmbed(queue)],
        components: buildDashboardButtons(queue)
      }).catch(() => {});
      break;
    }
    case 'mclose': {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C.DARK).setDescription(`${EMOJI.CHECK} Dashboard closed.`)], components: [] }).catch(() => {});
      break;
    }
    case 'mnp': {
      await sendNowPlaying(queue);
      break;
    }
    case 'mshuffle': {
      queue.shuffle = !queue.shuffle;
      await interaction.channel?.send({
        embeds: [new EmbedBuilder().setColor(C.GREEN).setDescription(`${EMOJI.SHUFFLE} Shuffle ${queue.shuffle ? 'enabled' : 'disabled'}.`)]
      }).catch(() => {});
      break;
    }
    case 'mprev': {
      if (queue.history.length > 0) {
        const prev = queue.history.pop();
        if (queue.current) queue.tracks.unshift(queue.current);
        await playTrack(queue, prev);
      }
      break;
    }
    case 'mheart': {
      if (queue.current) queue.current.likes++;
      break;
    }
    case 'mlove': {
      if (queue.current) queue.current.likes++;
      await interaction.channel?.send({ embeds: [new EmbedBuilder().setColor(C.GREEN).setDescription(`${EMOJI.THUMBUP} Glad you like it!`)] }).catch(() => {});
      break;
    }
    case 'mhate': {
      if (queue.current) queue.current.dislikes++;
      await interaction.channel?.send({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription(`${EMOJI.THUMBDN} Noted. Skipping to something better...`)] }).catch(() => {});
      if (queue.player) queue.player.stop();
      break;
    }
    case 'mfix': {
      await interaction.channel?.send({ embeds: [new EmbedBuilder().setColor(C.ACCENT).setDescription(`${EMOJI.TOOLS} Attempting audio recovery...`)] }).catch(() => {});
      if (queue.current) await playTrack(queue, queue.current);
      break;
    }
    case 'mrecon': {
      const vc = interaction.member?.voice?.channel;
      if (vc) {
        if (queue.connection) queue.connection.destroy();
        await connectVoice(vc, queue);
        if (queue.current) await playTrack(queue, queue.current);
      }
      break;
    }
    case 'mrecreate': {
      if (queue.connection) {
        const oldSub = queue.connection.subscribe(queue.player);
        if (oldSub) oldSub.unsubscribe();
      }
      setupPlayer(queue);
      if (queue.connection) queue.connection.subscribe(queue.player);
      if (queue.current) await playTrack(queue, queue.current);
      break;
    }
    case 'mregion': {
      await interaction.channel?.send({
        embeds: [new EmbedBuilder().setColor(C.ACCENT).setDescription(`${EMOJI.GLOBE} Region change is automatic based on voice channel region.`)]
      }).catch(() => {});
      break;
    }
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLASH COMMAND DATA
// ═══════════════════════════════════════════════════════════════════════════════

const slashData = new SlashCommandBuilder()
  .setName('play').setDescription('Play a song in a voice channel from YouTube or Spotify')
  .addStringOption(opt =>
    opt.setName('query').setDescription('Type a music name, link, playlist, radio or media link')
      .setRequired(true).setAutocomplete(true)
  )
  .addBooleanOption(opt =>
    opt.setName('insert-first').setDescription('Insert at the front of the queue').setRequired(false)
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
      embeds: [new EmbedBuilder().setColor(C.WARN).setDescription(`${EMOJI.WARN} Join a voice channel first!`)],
      ephemeral: true
    });
  }

  // VOTE GUARD
  const voted = await voteGuard.hasVoted(interaction.user.id);
  if (!voted) {
    return interaction.reply({
      embeds: [voteGuard.buildVoteEmbed(client.user.username, client.user.displayAvatarURL())],
      components: [voteGuard.buildVoteButtons(client.user.id)],
      ephemeral: true
    });
  }

  await interaction.deferReply();
  const query = interaction.options.getString('query');
  const insertFirst = interaction.options.getBoolean('insert-first') || false;

  const queue = getQueue(guildId);
  queue.textChannel = interaction.channel;
  resetIdleTimer(queue);

  // Connect voice if not already
  if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Disconnected) {
    const connected = await connectVoice(vc, queue);
    if (!connected) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(C.RED).setDescription(`${EMOJI.RED} Failed to connect to voice channel.`)]
      });
    }
  }

  // Resolve track(s)
  await interaction.editReply({
    embeds: [new EmbedBuilder().setColor(C.ACCENT).setDescription(`${EMOJI.NOTE} Searching for \`${query.substring(0, 60)}\`...`)]
  });

  try {
    const result = await resolveTrack(query, interaction.user);

    // Playlist
    if (result?.playlist && Array.isArray(result.tracks)) {
      if (insertFirst) queue.tracks.unshift(...result.tracks);
      else queue.tracks.push(...result.tracks);

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(C.GREEN)
          .setDescription(`${EMOJI.SPOTIFY} Added **${result.tracks.length}** tracks${result.playlistName ? ` from *${result.playlistName}*` : ''} to the queue.`)]
      });

      if (!queue.current) {
        const first = queue.tracks.shift();
        await playTrack(queue, first);
      }
      return;
    }

    // Single track
    const track = result;
    if (insertFirst && queue.current) queue.tracks.unshift(track);
    else queue.tracks.push(track);

    if (queue.current) {
      // Added to queue
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(track.source === 'spotify' ? C.SPOTIFY : C.GREEN)
          .setDescription(`${track.sourceEmoji} Added **${track.title}** \u2014 ${track.durationFormatted} to the queue.`)]
      });
    } else {
      // Playing now
      await playTrack(queue, track);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(C.GREEN)
          .setDescription(`${EMOJI.PLAY} Now playing **${track.title}** \u2014 ${track.durationFormatted}`)]
      });
    }
  } catch (e) {
    log('AUDIO', `Play error: ${e.message}`);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(C.RED).setDescription(`${EMOJI.RED} Error: ${e.message}`)]
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  name: 'play',
  aliases: ['p'],
  category: 'MUSIC',
  description: 'Native Audio Engine v5.0 — play-dl + @discordjs/voice',
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

  // Legacy initLavalink — no-op since we don't use Lavalink
  initLavalink() {
    log('STREAM', 'Native Audio Engine v5.0 — No Lavalink needed');
  },

  // Legacy select menu handler
  async handleSelectMenu() {
    return false;
  }
};

console.log('[NATIVE AUDIO] Engine v5.0 loaded — play-dl + @discordjs/voice');
