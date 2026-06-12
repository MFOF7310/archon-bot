const { SlashCommandBuilder } = require('discord.js');
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, PermissionsBitField, ChannelType, VoiceConnectionStatus,
  entersState, joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, StreamType, NoSubscriberBehavior
} = require('discord.js');
const ytdl = require('play-dl');
const fs = require('fs');
const path = require('path');

// ================= ARCHITECT CG-223 // NEURAL AUDIO ENGINE v1.2 =================
// Fixes: hoisting, onGuildDelete export, memory leaks, interaction guards, timeouts, permissions

const NEURAL_GREEN = '#00ff88';
const NEURAL_DARK = '#0a0a0a';
const NEURAL_ACCENT = '#00d4ff';
const NEURAL_WARNING = '#ff6b35';
const NEURAL_ERROR = '#ff3333';

// ================= PER-SERVER AUDIO STATE =================
const audioStates = new Map();

function getAudioState(guildId) {
  if (!audioStates.has(guildId)) {
    audioStates.set(guildId, {
      guildId,
      queue: [],
      current: null,
      player: null,
      connection: null,
      volume: 100,
      loop: 'off',
      paused: false,
      stageInstance: null,
      nowPlayingMessage: null,
      dashboardMessage: null,
      textChannel: null,
      requester: null,
      startTime: null,
      listeners: new Set(),
      history: [],
      isStage: false,
      autoplay: false,
      bassBoost: 0,
      nightcore: false,
      neuralStatus: 'IDLE',
      lastActivity: Date.now(),
      sessionId: Math.random().toString(36).slice(2, 10).toUpperCase()
    });
  }
  return audioStates.get(guildId);
}

function destroyAudioState(guildId) {
  const state = audioStates.get(guildId);
  if (!state) return;

  // FIX 3: Remove all listeners to prevent memory leaks
  if (state.player) {
    try {
      state.player.removeAllListeners();
      state.player.stop();
    } catch (e) {}
  }
  if (state.connection) {
    try {
      state.connection.removeAllListeners();
      state.connection.destroy();
    } catch (e) {}
  }
  if (state.stageInstance) {
    try { state.stageInstance.delete().catch(() => {}); } catch (e) {}
  }
  if (state._updateInterval) {
    clearInterval(state._updateInterval);
    state._updateInterval = null;
  }

  audioStates.delete(guildId);
  console.log(`[AUDIO] Destroyed state for guild ${guildId}`);
}

// ================= NEURAL AUDIO PLAYER FACTORY =================
function createNeuralPlayer(guildId) {
  const state = getAudioState(guildId);

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
      maxMissedFrames: 50
    }
  });

  player.on(AudioPlayerStatus.Playing, () => {
    state.neuralStatus = 'PLAYING';
    state.startTime = Date.now();
    state.paused = false;
    updateNowPlayingUI(guildId);
    console.log(`[AUDIO] ${guildId} -> PLAYING: ${state.current?.title?.substring(0, 40)}`);
  });

  player.on(AudioPlayerStatus.Paused, () => {
    state.neuralStatus = 'PAUSED';
    state.paused = true;
    updateNowPlayingUI(guildId);
  });

  player.on(AudioPlayerStatus.Idle, async () => {
    state.neuralStatus = 'IDLE';

    if (state.loop === 'track' && state.current) {
      await playTrack(guildId, state.current);
    } else if (state.loop === 'queue' && state.queue.length === 0 && state.history.length > 0) {
      state.queue = [...state.history];
      state.history = [];
      await playNext(guildId);
    } else if (state.queue.length > 0) {
      await playNext(guildId);
    } else {
      state.current = null;
      updateNowPlayingUI(guildId);
      setTimeout(() => {
        const fresh = getAudioState(guildId);
        if (fresh.neuralStatus === 'IDLE' && fresh.queue.length === 0) {
          destroyAudioState(guildId);
        }
      }, 300000);
    }
  });

  player.on('error', (error) => {
    console.error(`[AUDIO ERROR] ${guildId}:`, error.message);
    state.neuralStatus = 'ERROR';
    if (state.queue.length > 0) playNext(guildId);
  });

  state.player = player;
  return player;
}

// ================= STAGE CHANNEL ORCHESTRATION =================
async function setupStageChannel(guildId, voiceChannel, topic = 'Neural Audio Broadcast') {
  const state = getAudioState(guildId);

  if (voiceChannel.type !== ChannelType.GuildStageVoice) {
    state.isStage = false;
    return false;
  }

  state.isStage = true;

  try {
    const existing = voiceChannel.guild.stageInstances.cache.find(
      si => si.channelId === voiceChannel.id
    );

    if (existing) {
      state.stageInstance = existing;
      await existing.edit({ topic });
    } else {
      state.stageInstance = await voiceChannel.createStageInstance({
        topic,
        privacyLevel: 2,
        sendStartNotification: false
      });
    }

    // FIX 7: Check permission before requesting speaker
    const member = voiceChannel.guild.members.me;
    if (member && member.voice) {
      const canSpeak = voiceChannel.permissionsFor(member).has(PermissionsBitField.Flags.MuteMembers) ||
                       voiceChannel.permissionsFor(member).has(PermissionsBitField.Flags.MoveMembers);
      if (canSpeak) {
        await member.voice.setSuppressed(false).catch(() => {});
      } else {
        console.log(`[STAGE] Bot lacks MuteMembers/MoveMembers, cannot auto-request speaker in ${guildId}`);
      }
    }

    console.log(`[STAGE] Stage Instance created: "${topic}"`);
    return true;
  } catch (err) {
    console.error(`[STAGE ERROR] ${guildId}:`, err.message);
    return false;
  }
}

async function updateStageTopic(guildId, topic) {
  const state = getAudioState(guildId);
  if (state.stageInstance && state.isStage) {
    try {
      await state.stageInstance.edit({ topic });
    } catch (e) {}
  }
}

// ================= TRACK RESOLUTION (Hetzner-Friendly + Search) =================
async function resolveTrack(query, requester) {
  const track = {
    id: Math.random().toString(36).slice(2, 12),
    title: 'Unknown Track',
    artist: 'Unknown Artist',
    duration: 0,
    url: null,
    source: 'unknown',
    thumbnail: null,
    requester: requester?.tag || 'Unknown',
    requesterId: requester?.id || '0',
    addedAt: Date.now(),
    streamUrl: null,
    stream: null
  };

  // 1. DIRECT AUDIO URL
  if (query.match(/^https?:\/\/.*\.(mp3|wav|ogg|flac|m4a|aac|webm)(\?.*)?$/i)) {
    track.title = path.basename(new URL(query).pathname) || 'Direct Audio';
    track.artist = 'Direct Stream';
    track.url = query;
    track.streamUrl = query;
    track.source = 'direct';
    return track;
  }

  // 2. LOCAL FILE PATH
  if (fs.existsSync(query)) {
    track.title = path.basename(query);
    track.artist = 'Local File';
    track.url = query;
    track.streamUrl = query;
    track.source = 'local';
    return track;
  }

  // 3. SOUNDCLOUD URL
  if (query.includes('soundcloud.com')) {
    try {
      const soInfo = await ytdl.soundcloud(query);
      track.title = soInfo.name;
      track.artist = soInfo.user?.name || 'SoundCloud';
      track.duration = soInfo.durationInMs;
      track.url = query;
      track.thumbnail = soInfo.thumbnail;
      track.source = 'soundcloud';
      track.streamUrl = soInfo.url;
      return track;
    } catch (err) {
      track.error = 'SoundCloud resolution failed: ' + err.message;
      return track;
    }
  }

  // 4. SPOTIFY (Metadata only)
  if (query.includes('spotify.com') || query.includes('open.spotify.com')) {
    try {
      const spInfo = await ytdl.spotify(query);
      track.title = spInfo.name;
      track.artist = spInfo.artists?.map(a => a.name).join(', ') || 'Spotify';
      track.duration = spInfo.durationInMs;
      track.url = query;
      track.thumbnail = spInfo.thumbnail;
      track.source = 'spotify';
      track.error = 'Spotify has no audio stream. Use a direct MP3 URL or SoundCloud link instead.';
      return track;
    } catch (err) {
      track.error = 'Spotify resolution failed: ' + err.message;
      return track;
    }
  }

  // 5. YOUTUBE URL - BLOCKED ON HETZNER
  if (query.includes('youtube.com') || query.includes('youtu.be')) {
    track.error = 'YouTube is blocked on Hetzner IPs. Use:\n• Direct MP3 URLs\n• SoundCloud links\n• Local files on your VPS\n• Spotify links (metadata only)';
    track.title = 'YouTube (Blocked)';
    return track;
  }

  // 6. SEARCH QUERY (Non-URL) - Try SoundCloud Search with timeout
  if (!query.startsWith('http')) {
    try {
      console.log(`[AUDIO] Searching SoundCloud for: "${query}"`);

      // FIX 5: Wrap search in Promise.race with 8s timeout to prevent hanging
      const searchPromise = ytdl.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout (8s)')), 8000)
      );
      const searchResults = await Promise.race([searchPromise, timeoutPromise]);

      if (searchResults && searchResults.length > 0) {
        const result = searchResults[0];
        track.title = result.name || query;
        track.artist = result.user?.name || 'SoundCloud';
        track.duration = result.durationInMs || 0;
        track.url = result.permalink || result.url || `https://soundcloud.com/search?q=${encodeURIComponent(query)}`;
        track.thumbnail = result.thumbnail;
        track.source = 'soundcloud';
        track.streamUrl = result.url;
        console.log(`[AUDIO] SoundCloud search found: ${track.title}`);
        return track;
      } else {
        track.error = `No SoundCloud results for "${query}". Try:\n• A direct MP3 URL\n• A SoundCloud track URL\n• A local file path`;
        track.title = `Search: ${query}`;
        return track;
      }
    } catch (err) {
      console.error(`[AUDIO] SoundCloud search failed:`, err.message);
      track.error = `Search failed for "${query}".\n\nTry these instead:\n• Direct MP3: https://example.com/song.mp3\n• SoundCloud: https://soundcloud.com/artist/track\n• Local: /path/to/music.mp3`;
      track.title = `Search: ${query}`;
      return track;
    }
  }

  // Unknown URL type
  track.error = 'Unsupported URL. Use direct MP3, SoundCloud, Spotify, or local file path.';
  return track;
}

// ================= AUDIO PLAYBACK ENGINE =================
async function playTrack(guildId, track) {
  const state = getAudioState(guildId);

  if (!track.stream && !track.streamUrl) {
    console.error(`[AUDIO] No stream available for: ${track.title}`);
    if (state.queue.length > 0) return playNext(guildId);
    return;
  }

  try {
    let resource;

    if (track.stream) {
      resource = createAudioResource(track.stream.stream, {
        inputType: track.stream.type || StreamType.Arbitrary,
        inlineVolume: true
      });
    } else if (track.streamUrl) {
      resource = createAudioResource(track.streamUrl, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true
      });
    }

    if (!resource) throw new Error('Failed to create audio resource');

    if (resource.volume) {
      resource.volume.setVolume(state.volume / 100);
    }

    state.current = track;
    state.player.play(resource);

    if (state.isStage) {
      await updateStageTopic(guildId, `🎵 ${track.title} — ${track.artist}`);
    }

    state.history.push(track);
    if (state.history.length > 50) state.history.shift();

  } catch (err) {
    console.error(`[AUDIO PLAY ERROR] ${guildId}:`, err.message);
    state.current = null;
    if (state.queue.length > 0) playNext(guildId);
  }
}

async function playNext(guildId) {
  const state = getAudioState(guildId);
  if (state.queue.length === 0) {
    state.current = null;
    updateNowPlayingUI(guildId);
    return;
  }

  const next = state.queue.shift();
  await playTrack(guildId, next);
}

// ================= NEURAL UI — NOW PLAYING PANEL =================
function buildNowPlayingEmbed(guildId) {
  const state = getAudioState(guildId);
  const track = state.current;

  if (!track) {
    return new EmbedBuilder()
      .setColor(NEURAL_DARK)
      .setTitle('🎵 Neural Audio Engine — IDLE')
      .setDescription(
        '```ansi\n' +
        '\u001b[1;30m╔══════════════════════════════════════╗\n' +
        '║  NO ACTIVE BROADCAST                 ║\n' +
        '║  Queue a track to begin              ║\n' +
        '╚══════════════════════════════════════╝\n' +
        '\u001b[0m```'
      )
      .addFields(
        { name: '📊 Session', value: `\`\`${state.sessionId}\`\``, inline: true },
        { name: '⏱️ Uptime', value: '0s', inline: true },
        { name: '🔊 Volume', value: `\`\`${state.volume}%\`\``, inline: true }
      )
      .setFooter({ text: 'ARCHON CG-223 • Neural Audio v1.2 • BAMAKO_223 🇲🇱' })
      .setTimestamp();
  }

  const elapsed = state.startTime ? Date.now() - state.startTime : 0;
  const duration = track.duration || 0;
  const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

  const barLength = 20;
  const filled = Math.floor((progress / 100) * barLength);
  const progressBar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const embed = new EmbedBuilder()
    .setColor(NEURAL_GREEN)
    .setAuthor({
      name: state.isStage ? '🔴 LIVE STAGE BROADCAST' : '🎵 NEURAL AUDIO ENGINE',
      iconURL: 'https://cdn.discordapp.com/attachments/.../audio-icon.png'
    })
    .setTitle(track.title?.substring(0, 60) || 'Unknown')
    .setURL(track.url || null)
    .setDescription(
      `\`\`ansi\n` +
      `\u001b[1;32m${progressBar}\u001b[0m ${progress.toFixed(1)}%\n` +
      `${formatTime(elapsed)} / ${formatTime(duration)}\n` +
      `\u001b[1;36mSource:\u001b[0m ${track.source.toUpperCase()}\n` +
      `\`\``
    )
    .addFields(
      { name: '🎤 Artist', value: track.artist?.substring(0, 30) || 'Unknown', inline: true },
      { name: '👤 Requester', value: `<@${track.requesterId}>`, inline: true },
      { name: '🔁 Loop', value: state.loop === 'off' ? '❌' : state.loop === 'track' ? '🔂 Track' : '🔁 Queue', inline: true },
      { name: '🔊 Volume', value: `\`\`${state.volume}%\`\``, inline: true },
      { name: '📊 Queue', value: `\`\`${state.queue.length} tracks\`\``, inline: true },
      { name: '⏱️ Session', value: `\`\`${state.sessionId}\`\``, inline: true }
    )
    .setThumbnail(track.thumbnail || 'https://cdn.discordapp.com/attachments/.../default-music.png')
    .setFooter({ text: `ARCHON CG-223 • ${state.isStage ? 'Stage Channel' : 'Voice Channel'} • BAMAKO_223 🇲🇱` })
    .setTimestamp();

  return embed;
}

function buildNowPlayingButtons(guildId) {
  const state = getAudioState(guildId);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`music_prev_${guildId}`)
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.history.length < 2),

    new ButtonBuilder()
      .setCustomId(`music_playpause_${guildId}`)
      .setEmoji(state.paused ? '▶️' : '⏸️')
      .setStyle(state.paused ? ButtonStyle.Success : ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`music_stop_${guildId}`)
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId(`music_next_${guildId}`)
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.queue.length === 0),

    new ButtonBuilder()
      .setCustomId(`music_loop_${guildId}`)
      .setEmoji(state.loop === 'off' ? '🔁' : state.loop === 'track' ? '🔂' : '🔁')
      .setStyle(state.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`music_vol_down_${guildId}`)
      .setEmoji('🔉')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.volume <= 0),

    new ButtonBuilder()
      .setCustomId(`music_vol_up_${guildId}`)
      .setEmoji('🔊')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.volume >= 200),

    new ButtonBuilder()
      .setCustomId(`music_shuffle_${guildId}`)
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.queue.length < 2),

    new ButtonBuilder()
      .setCustomId(`music_queue_${guildId}`)
      .setEmoji('📜')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`music_dashboard_${guildId}`)
      .setEmoji('🎛️')
      .setLabel('Dashboard')
      .setStyle(ButtonStyle.Success)
  );

  return [row1, row2];
}

async function updateNowPlayingUI(guildId) {
  const state = getAudioState(guildId);
  if (!state.nowPlayingMessage) return;

  try {
    const embed = buildNowPlayingEmbed(guildId);
    const buttons = buildNowPlayingButtons(guildId);
    await state.nowPlayingMessage.edit({ embeds: [embed], components: buttons });
  } catch (err) {
    console.log(`[UI UPDATE] Failed for ${guildId}:`, err.message);
  }
}

// ================= DASHBOARD PANEL =================
function buildDashboardEmbed(guildId) {
  const state = getAudioState(guildId);

  const embed = new EmbedBuilder()
    .setColor(NEURAL_ACCENT)
    .setTitle('🎛️ Neural Audio Dashboard')
    .setDescription(
      '```ansi\n' +
      '\u001b[1;36m╔══════════════════════════════════════╗\n' +
      '║  ADVANCED AUDIO CONTROLS             ║\n' +
      '║  Session: ' + state.sessionId.padEnd(25) + '║\n' +
      '╚══════════════════════════════════════╝\n' +
      '\u001b[0m```'
    )
    .addFields(
      { name: '🎚️ Volume', value: `\`\`${state.volume}%\`\``, inline: true },
      { name: '🔁 Loop Mode', value: state.loop, inline: true },
      { name: '📻 Stage', value: state.isStage ? '✅ Active' : '❌ Disabled', inline: true },
      { name: '📊 Queue Size', value: String(state.queue.length), inline: true },
      { name: '📈 History', value: String(state.history.length), inline: true },
      { name: '👥 Listeners', value: String(state.listeners.size), inline: true },
      { name: '⚡ Bass Boost', value: `\`\`+${state.bassBoost}dB\`\``, inline: true },
      { name: '🌙 Nightcore', value: state.nightcore ? '✅ On' : '❌ Off', inline: true },
      { name: '🤖 Autoplay', value: state.autoplay ? '✅ On' : '❌ Off', inline: true }
    )
    .setFooter({ text: 'ARCHON CG-223 • Dashboard v1.2' })
    .setTimestamp();

  return embed;
}

function buildDashboardComponents(guildId) {
  const state = getAudioState(guildId);

  const row1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`music_loop_select_${guildId}`)
      .setPlaceholder('🔁 Select Loop Mode')
      .addOptions([
        { label: 'Loop Off', value: 'off', emoji: '❌', description: 'No looping' },
        { label: 'Loop Track', value: 'track', emoji: '🔂', description: 'Repeat current track' },
        { label: 'Loop Queue', value: 'queue', emoji: '🔁', description: 'Repeat entire queue' }
      ]),

    new StringSelectMenuBuilder()
      .setCustomId(`music_vol_select_${guildId}`)
      .setPlaceholder('🔊 Select Volume')
      .addOptions(
        [10, 25, 50, 75, 100, 125, 150, 200].map(v => ({
          label: `${v}%`,
          value: String(v),
          emoji: v <= 50 ? '🔉' : v <= 100 ? '🔊' : '📢',
          description: v > 100 ? 'WARNING: High volume' : 'Standard level',
          default: state.volume === v
        }))
      )
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`music_bass_up_${guildId}`)
      .setEmoji('📈')
      .setLabel('Bass +')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.bassBoost >= 20),

    new ButtonBuilder()
      .setCustomId(`music_bass_down_${guildId}`)
      .setEmoji('📉')
      .setLabel('Bass -')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.bassBoost <= 0),

    new ButtonBuilder()
      .setCustomId(`music_nightcore_${guildId}`)
      .setEmoji('🌙')
      .setLabel('Nightcore')
      .setStyle(state.nightcore ? ButtonStyle.Success : ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`music_autoplay_${guildId}`)
      .setEmoji('🤖')
      .setLabel('Autoplay')
      .setStyle(state.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`music_clear_${guildId}`)
      .setEmoji('🗑️')
      .setLabel('Clear Queue')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(state.queue.length === 0)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`music_np_${guildId}`)
      .setEmoji('🎵')
      .setLabel('Now Playing')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`music_close_${guildId}`)
      .setEmoji('❌')
      .setLabel('Close Dashboard')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

// ================= UI SENDERS (FIXED: defined BEFORE module.exports) =================
async function sendNowPlayingPanel(guildId, channel) {
  const state = getAudioState(guildId);

  // FIX 6: Clear old interval before creating new one to prevent duplicates
  if (state._updateInterval) {
    clearInterval(state._updateInterval);
    state._updateInterval = null;
  }

  if (state.nowPlayingMessage) {
    try { await state.nowPlayingMessage.delete(); } catch (e) {}
  }

  const embed = buildNowPlayingEmbed(guildId);
  const buttons = buildNowPlayingButtons(guildId);

  const msg = await channel.send({ embeds: [embed], components: buttons });
  state.nowPlayingMessage = msg;

  state._updateInterval = setInterval(() => {
    const fresh = getAudioState(guildId);
    if (fresh && fresh.neuralStatus === 'PLAYING') {
      updateNowPlayingUI(guildId);
    }
  }, 10000);
}

async function sendDashboardPanel(guildId, channel) {
  const state = getAudioState(guildId);

  if (state.dashboardMessage) {
    try { await state.dashboardMessage.delete(); } catch (e) {}
  }

  const embed = buildDashboardEmbed(guildId);
  const components = buildDashboardComponents(guildId);

  const msg = await channel.send({ embeds: [embed], components: components });
  state.dashboardMessage = msg;
}

// ================= COMMAND DEFINITIONS =================
// FIX 1 & 2: All helpers defined above, onGuildDelete inside module.exports
module.exports = {
  name: 'music',
  aliases: ['play', 'p', 'skip', 'queue', 'q', 'stop', 'disconnect', 'dc', 'volume', 'vol', 'loop', 'pause', 'resume', 'np', 'nowplaying', 'dashboard', 'stage'],
  category: 'UTILITY',
  description: 'Neural Audio Engine — Interactive music with Stage Channel support',

  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Neural Audio Engine — Interactive music control')
    .addStringOption(opt => opt
      .setName('action')
      .setDescription('What to do')
      .setRequired(true)
      .addChoices(
        { name: 'play', value: 'play' },
        { name: 'skip', value: 'skip' },
        { name: 'stop', value: 'stop' },
        { name: 'pause', value: 'pause' },
        { name: 'resume', value: 'resume' },
        { name: 'queue', value: 'queue' },
        { name: 'volume', value: 'volume' },
        { name: 'loop', value: 'loop' },
        { name: 'nowplaying', value: 'nowplaying' },
        { name: 'dashboard', value: 'dashboard' },
        { name: 'disconnect', value: 'disconnect' }
      )
    )
    .addStringOption(opt => opt
      .setName('query')
      .setDescription('Song URL or search query (for play)')
      .setRequired(false)
    )
    .addIntegerOption(opt => opt
      .setName('value')
      .setDescription('Volume level 0-200 (for volume)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(200)
    )
    .toJSON(),

  // ================= PREFIX COMMAND HANDLER =================
  run: async (client, message, args, db, usedCommand, serverSettings, lang = 'en') => {
    let cmd, remainingArgs;
    if (usedCommand === 'music') {
      cmd = args[0]?.toLowerCase();
      remainingArgs = args.slice(1);
    } else {
      cmd = usedCommand?.toLowerCase();
      remainingArgs = args;
    }

    const guildId = message.guild?.id;
    if (!guildId) {
      return message.reply('❌ Music commands only work in servers!');
    }

    const member = message.member;
    const voiceChannel = member.voice.channel;

    if (!cmd) {
      return sendDashboardPanel(guildId, message.channel);
    }

    if (!voiceChannel && !['queue', 'q', 'nowplaying', 'np', 'dashboard'].includes(cmd)) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor(NEURAL_WARNING)
          .setTitle('🚫 Voice Channel Required')
          .setDescription('Join a voice or **Stage** channel first!')
        ]
      });
    }

    const state = getAudioState(guildId);
    state.textChannel = message.channel;

    switch (cmd) {
      case 'play':
      case 'p': {
        const query = remainingArgs.join(' ');

        if (!query) {
          return message.reply({
            embeds: [new EmbedBuilder()
              .setColor(NEURAL_WARNING)
              .setTitle('⚠️ Missing Query')
              .setDescription('Please provide a song URL or search query.\n\n**Supported sources:**\n• Direct MP3 URLs\n• SoundCloud links\n• Local file paths\n• Spotify links (metadata only)\n• **Search:** Type any song name to search SoundCloud')
            ]
          });
        }

        await message.reply({
          embeds: [new EmbedBuilder()
            .setColor(NEURAL_ACCENT)
            .setDescription(`🔍 **Neural Search:** \`${query.substring(0, 50)}\`...`)
          ]
        });

        const track = await resolveTrack(query, message.author);

        if (track.error) {
          return message.channel.send({
            embeds: [new EmbedBuilder()
              .setColor(NEURAL_WARNING)
              .setTitle('⚠️ Track Error')
              .setDescription(track.error)
            ]
          });
        }

        if (!state.connection) {
          try {
            const connection = joinVoiceChannel({
              channelId: voiceChannel.id,
              guildId: voiceChannel.guild.id,
              adapterCreator: voiceChannel.guild.voiceAdapterCreator,
              selfDeaf: false,
              selfMute: false
            });

            state.connection = connection;
            state.isStage = voiceChannel.type === ChannelType.GuildStageVoice;

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
              try {
                await Promise.race([
                  entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                  entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
              } catch {
                destroyAudioState(guildId);
              }
            });

            connection.on(VoiceConnectionStatus.Destroyed, () => {
              destroyAudioState(guildId);
            });

            if (state.isStage) {
              await setupStageChannel(guildId, voiceChannel, `🎵 ${track.title}`);
            }

            const player = createNeuralPlayer(guildId);
            connection.subscribe(player);

            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            console.log(`[AUDIO] Voice connection ready for guild ${guildId}`);

          } catch (err) {
            console.error(`[AUDIO JOIN ERROR] ${guildId}:`, err.message);
            destroyAudioState(guildId);
            return message.channel.send({
              embeds: [new EmbedBuilder()
                .setColor(NEURAL_ERROR)
                .setTitle('❌ Connection Failed')
                .setDescription(`Failed to join voice channel:\n${err.message}\n\n**Check:**\n• Bot has "Connect" permission\n• Bot has "Speak" permission\n• You're in a voice channel`)
              ]
            });
          }
        }

        if (state.current) {
          state.queue.push(track);
          message.channel.send({
            embeds: [new EmbedBuilder()
              .setColor(NEURAL_GREEN)
              .setDescription(`✅ **Added to queue:** [${track.title}](${track.url})`)
              .addFields(
                { name: '📊 Position', value: String(state.queue.length), inline: true },
                { name: '⏱️ Duration', value: track.duration ? `${Math.floor(track.duration / 60000)}m` : 'Unknown', inline: true }
              )
            ]
          });
        } else {
          await playTrack(guildId, track);
        }

        await sendNowPlayingPanel(guildId, message.channel);
        break;
      }

      case 'skip':
      case 'next': {
        if (!state.current) return message.reply('❌ Nothing playing!');
        state.player.stop();
        message.reply('⏭️ **Skipped!**');
        break;
      }

      case 'stop': {
        destroyAudioState(guildId);
        message.reply('⏹️ **Neural Audio Engine stopped.**');
        break;
      }

      case 'pause': {
        if (!state.player) return message.reply('❌ Nothing playing!');
        state.player.pause();
        state.paused = true;
        message.reply('⏸️ **Paused!**');
        break;
      }

      case 'resume': {
        if (!state.player) return message.reply('❌ Nothing playing!');
        state.player.unpause();
        state.paused = false;
        message.reply('▶️ **Resumed!**');
        break;
      }

      case 'queue':
      case 'q': {
        if (state.queue.length === 0 && !state.current) {
          return message.reply('📭 **Queue is empty!**');
        }

        const embed = new EmbedBuilder()
          .setColor(NEURAL_ACCENT)
          .setTitle(`📜 Queue — ${state.queue.length + (state.current ? 1 : 0)} tracks`);

        if (state.current) {
          embed.addFields({
            name: '▶️ Now Playing',
            value: `[${state.current.title}](${state.current.url}) — ${state.current.requester}`
          });
        }

        const queueList = state.queue.slice(0, 10).map((t, i) =>
          `\`\`${i + 1}.\`\` [${t.title.substring(0, 40)}](${t.url}) — ${t.requester}`
        ).join('\n');

        if (queueList) embed.addFields({ name: '⏳ Up Next', value: queueList });
        if (state.queue.length > 10) embed.addFields({ name: '📊 Total', value: `${state.queue.length} tracks remaining` });

        message.reply({ embeds: [embed] });
        break;
      }

      case 'volume':
      case 'vol': {
        const vol = parseInt(remainingArgs[0]);
        if (isNaN(vol) || vol < 0 || vol > 200) {
          return message.reply('❌ Volume must be 0-200!');
        }
        state.volume = vol;
        if (state.player && state.player.state.status === AudioPlayerStatus.Playing) {
          const resource = state.player.state.resource;
          if (resource && resource.volume) {
            resource.volume.setVolume(vol / 100);
          }
        }
        message.reply(`🔊 **Volume set to ${vol}%**`);
        updateNowPlayingUI(guildId);
        break;
      }

      case 'loop': {
        const modes = ['off', 'track', 'queue'];
        const current = modes.indexOf(state.loop);
        state.loop = modes[(current + 1) % 3];
        message.reply(`🔁 **Loop:** ${state.loop === 'off' ? '❌ Off' : state.loop === 'track' ? '🔂 Track' : '🔁 Queue'}`);
        updateNowPlayingUI(guildId);
        break;
      }

      case 'nowplaying':
      case 'np': {
        if (!state.current) return message.reply('❌ Nothing playing!');
        await sendNowPlayingPanel(guildId, message.channel);
        break;
      }

      case 'dashboard': {
        await sendDashboardPanel(guildId, message.channel);
        break;
      }

      case 'disconnect':
      case 'dc': {
        destroyAudioState(guildId);
        message.reply('👋 **Disconnected!**');
        break;
      }

      case 'stage': {
        if (!voiceChannel || voiceChannel.type !== ChannelType.GuildStageVoice) {
          return message.reply('❌ Join a **Stage Channel** first!');
        }
        const topic = remainingArgs.join(' ') || 'Neural Audio Broadcast';
        await setupStageChannel(guildId, voiceChannel, topic);
        message.reply('🔴 **Stage Broadcast activated!**');
        break;
      }

      default: {
        message.reply('❓ Use: `play`, `skip`, `stop`, `pause`, `resume`, `queue`, `volume`, `loop`, `nowplaying`, `dashboard`, `disconnect`, `stage`');
      }
    }
  },

  // ================= SLASH COMMAND HANDLER =================
  execute: async (interaction, client) => {
    const action = interaction.options.getString('action');
    const query = interaction.options.getString('query');
    const value = interaction.options.getInteger('value');
    const guildId = interaction.guild.id;
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel && !['queue', 'nowplaying', 'dashboard'].includes(action)) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(NEURAL_WARNING)
          .setTitle('🚫 Voice Channel Required')
          .setDescription('Join a voice or **Stage** channel first!')
        ],
        ephemeral: true
      });
    }

    const state = getAudioState(guildId);
    state.textChannel = interaction.channel;

    await interaction.deferReply();

    switch (action) {
      case 'play': {
        if (!query) {
          return interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(NEURAL_WARNING)
              .setTitle('⚠️ Missing Query')
              .setDescription('Please provide a song URL or search query using the `query` option.')
            ]
          });
        }

        const track = await resolveTrack(query, interaction.user);

        if (track.error) {
          return interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(NEURAL_WARNING)
              .setTitle('⚠️ Track Error')
              .setDescription(track.error)
            ]
          });
        }

        if (!state.connection) {
          try {
            const connection = joinVoiceChannel({
              channelId: voiceChannel.id,
              guildId: voiceChannel.guild.id,
              adapterCreator: voiceChannel.guild.voiceAdapterCreator,
              selfDeaf: false,
              selfMute: false
            });

            state.connection = connection;
            state.isStage = voiceChannel.type === ChannelType.GuildStageVoice;

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
              try {
                await Promise.race([
                  entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                  entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
              } catch {
                destroyAudioState(guildId);
              }
            });

            connection.on(VoiceConnectionStatus.Destroyed, () => {
              destroyAudioState(guildId);
            });

            if (state.isStage) {
              await setupStageChannel(guildId, voiceChannel, `🎵 ${track.title}`);
            }

            const player = createNeuralPlayer(guildId);
            connection.subscribe(player);

            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
          } catch (err) {
            console.error(`[AUDIO JOIN ERROR] ${guildId}:`, err.message);
            destroyAudioState(guildId);
            return interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor(NEURAL_ERROR)
                .setTitle('❌ Connection Failed')
                .setDescription(`Failed to join voice channel: ${err.message}`)
              ]
            });
          }
        }

        if (state.current) {
          state.queue.push(track);
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(NEURAL_GREEN)
              .setDescription(`✅ **Added:** [${track.title}](${track.url})`)
            ]
          });
        } else {
          await playTrack(guildId, track);
          await sendNowPlayingPanel(guildId, interaction.channel);
          await interaction.editReply('🎵 **Playing!**');
        }
        break;
      }

      case 'skip': {
        if (!state.current) return interaction.editReply('❌ Nothing playing!');
        state.player.stop();
        await interaction.editReply('⏭️ **Skipped!**');
        break;
      }

      case 'stop': {
        destroyAudioState(guildId);
        await interaction.editReply('⏹️ **Stopped!**');
        break;
      }

      case 'pause': {
        if (!state.player) return interaction.editReply('❌ Nothing playing!');
        state.player.pause();
        state.paused = true;
        await interaction.editReply('⏸️ **Paused!**');
        break;
      }

      case 'resume': {
        if (!state.player) return interaction.editReply('❌ Nothing playing!');
        state.player.unpause();
        state.paused = false;
        await interaction.editReply('▶️ **Resumed!**');
        break;
      }

      case 'queue': {
        if (state.queue.length === 0 && !state.current) {
          return interaction.editReply('📭 **Queue empty!**');
        }
        const embed = new EmbedBuilder()
          .setColor(NEURAL_ACCENT)
          .setTitle('📜 Queue')
          .setDescription(state.current ? `▶️ [${state.current.title}](${state.current.url})\n\n` +
            state.queue.slice(0, 10).map((t, i) => `\`\`${i+1}.\`\` ${t.title}`).join('\n') : 'Empty');
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'volume': {
        const vol = value !== null ? value : 100;
        state.volume = Math.max(0, Math.min(200, vol));
        if (state.player && state.player.state.status === AudioPlayerStatus.Playing) {
          const resource = state.player.state.resource;
          if (resource && resource.volume) {
            resource.volume.setVolume(vol / 100);
          }
        }
        await interaction.editReply(`🔊 **Volume: ${state.volume}%**`);
        updateNowPlayingUI(guildId);
        break;
      }

      case 'loop': {
        const modes = ['off', 'track', 'queue'];
        state.loop = modes[(modes.indexOf(state.loop) + 1) % 3];
        await interaction.editReply(`🔁 **Loop: ${state.loop}**`);
        updateNowPlayingUI(guildId);
        break;
      }

      case 'nowplaying': {
        if (!state.current) return interaction.editReply('❌ Nothing playing!');
        await sendNowPlayingPanel(guildId, interaction.channel);
        await interaction.editReply('🎵 **Now Playing panel updated!**');
        break;
      }

      case 'dashboard': {
        await sendDashboardPanel(guildId, interaction.channel);
        await interaction.editReply('🎛️ **Dashboard opened!**');
        break;
      }

      case 'disconnect': {
        destroyAudioState(guildId);
        await interaction.editReply('👋 **Disconnected!**');
        break;
      }
    }
  },

  // ================= BUTTON & SELECT MENU HANDLER =================
  handleComponent: async (interaction, client) => {
    const customId = interaction.customId;
    if (!customId.startsWith('music_')) return false;

    const guildId = interaction.guild.id;
    const state = getAudioState(guildId);
    const parts = customId.split('_');
    const action = parts[1];

    // FIX 4: Guard against double-acknowledging interactions
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }

    switch (action) {
      case 'playpause': {
        if (state.paused) {
          state.player?.unpause();
          state.paused = false;
        } else {
          state.player?.pause();
          state.paused = true;
        }
        break;
      }

      case 'stop': {
        destroyAudioState(guildId);
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(NEURAL_DARK)
            .setDescription('⏹️ **Neural Audio Engine stopped.**')
          ],
          components: []
        }).catch(() => {});
        return true;
      }

      case 'next': {
        state.player?.stop();
        break;
      }

      case 'prev': {
        if (state.history.length >= 2) {
          state.queue.unshift(state.current);
          state.current = state.history[state.history.length - 2];
          state.history = state.history.slice(0, -2);
          await playTrack(guildId, state.current);
        }
        break;
      }

      case 'loop': {
        if (parts.length >= 3 && parts[2] === 'select') {
          const mode = interaction.values[0];
          if (mode) state.loop = mode;
        } else {
          const modes = ['off', 'track', 'queue'];
          state.loop = modes[(modes.indexOf(state.loop) + 1) % 3];
        }
        break;
      }

      case 'vol': {
        if (parts.length >= 3 && parts[2] === 'select') {
          const vol = parseInt(interaction.values[0]);
          if (!isNaN(vol)) state.volume = Math.max(0, Math.min(200, vol));
        } else {
          const dir = parts[2];
          const change = dir === 'up' ? 10 : -10;
          state.volume = Math.max(0, Math.min(200, state.volume + change));
        }
        if (state.player && state.player.state.status === AudioPlayerStatus.Playing) {
          const resource = state.player.state.resource;
          if (resource && resource.volume) {
            resource.volume.setVolume(state.volume / 100);
          }
        }
        break;
      }

      case 'shuffle': {
        for (let i = state.queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
        }
        await interaction.followUp({ content: '🔀 **Queue shuffled!**', ephemeral: true });
        break;
      }

      case 'queue': {
        const embed = new EmbedBuilder()
          .setColor(NEURAL_ACCENT)
          .setTitle('📜 Queue')
          .setDescription(state.queue.map((t, i) => `\`\`${i+1}.\`\` ${t.title}`).join('\n') || 'Empty');
        await interaction.followUp({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'dashboard': {
        await sendDashboardPanel(guildId, interaction.channel);
        break;
      }

      case 'bass': {
        const dir = parts[2];
        state.bassBoost = Math.max(0, Math.min(20, state.bassBoost + (dir === 'up' ? 2 : -2)));
        await interaction.followUp({ content: `📈 **Bass Boost: +${state.bassBoost}dB**`, ephemeral: true });
        break;
      }

      case 'nightcore': {
        state.nightcore = !state.nightcore;
        await interaction.followUp({ content: `🌙 **Nightcore: ${state.nightcore ? 'ON' : 'OFF'}**`, ephemeral: true });
        break;
      }

      case 'autoplay': {
        state.autoplay = !state.autoplay;
        await interaction.followUp({ content: `🤖 **Autoplay: ${state.autoplay ? 'ON' : 'OFF'}**`, ephemeral: true });
        break;
      }

      case 'clear': {
        state.queue = [];
        await interaction.followUp({ content: '🗑️ **Queue cleared!**', ephemeral: true });
        break;
      }

      case 'np': {
        await sendNowPlayingPanel(guildId, interaction.channel);
        break;
      }

      case 'close': {
        await interaction.editReply({
          embeds: [new EmbedBuilder().setDescription('🎛️ **Dashboard closed.**')],
          components: []
        }).catch(() => {});
        state.dashboardMessage = null;
        return true;
      }

      default: {
        break;
      }
    }

    updateNowPlayingUI(guildId);
    if (state.dashboardMessage) {
      try {
        await state.dashboardMessage.edit({
          embeds: [buildDashboardEmbed(guildId)],
          components: buildDashboardComponents(guildId)
        });
      } catch (e) {}
    }

    return true;
  },

  // FIX 2: onGuildDelete inside module.exports so index.js loader can find it
  onGuildDelete: (guildId) => {
    destroyAudioState(guildId);
  }
};

console.log('[MUSIC] Neural Audio Engine v1.2 loaded — Stage Channel ready');
